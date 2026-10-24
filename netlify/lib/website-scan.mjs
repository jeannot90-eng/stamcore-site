/* ===========================================================================
   Gedeelde code voor de publieke Website-Scan (/website-scan).
   Gebruikt door netlify/functions/scan-start.mjs. De PageSpeed-meting
   draait als Edge Function (netlify/edge-functions/scan-psi.js) vanwege de tijdslimiet.
   Geen npm-dependencies: alleen Node 18+ (fetch, crypto, dns).

   Environment variables (Netlify → Site configuration → Environment variables):
     SCAN_TOKEN_SECRET     lange willekeurige string; ondertekent de scan-token
     PAGESPEED_API_KEY     (alleen in de Edge Function scan-psi) Google PageSpeed-key
=========================================================================== */
import crypto from 'node:crypto';
import dns from 'node:dns/promises';
import net from 'node:net';

// ── Response-helpers ───────────────────────────────────────────────────────
export function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extraHeaders },
  });
}
export const fail = (status, message) => json(status, { ok: false, error: message });

export async function readJson(req, maxBytes = 10_000) {
  const text = await req.text();
  if (text.length > maxBytes) throw new Error('te groot');
  return JSON.parse(text || '{}');
}

// ── Invoer controleren ────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;
export const isEmail = (s) => typeof s === 'string' && s.length <= 254 && EMAIL_RE.test(s.trim());

/** Maakt van wat de bezoeker typt een nette https-URL van de homepage, of gooit een fout. */
export function normalizeUrl(input) {
  let s = String(input || '').trim();
  if (!s || s.length > 300) throw new Error('Vul een geldig webadres in.');
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  let u;
  try { u = new URL(s); } catch { throw new Error('Vul een geldig webadres in, bijvoorbeeld jouwbedrijf.nl.'); }
  if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Alleen http- en https-adressen.');
  if (u.username || u.password) throw new Error('Vul een gewoon webadres in.');
  if (u.port && !['80', '443'].includes(u.port)) throw new Error('Alleen standaard webadressen (zonder poortnummer).');
  const host = u.hostname.toLowerCase();
  if (net.isIP(host) || !host.includes('.') || host.endsWith('.local') || host.endsWith('.internal') || host === 'localhost') {
    throw new Error('Vul het webadres van een openbare website in.');
  }
  return `${u.protocol}//${host}/`; // alleen de homepage
}

// ── Beveiliging: geen verzoeken naar interne adressen (SSRF) ─────────────────
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v = ip.toLowerCase();
  if (v.startsWith('::ffff:')) return isPrivateIp(v.slice(7));
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') ||
    v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb');
}
async function assertPublicHost(hostname) {
  let addrs;
  try { addrs = await dns.lookup(hostname, { all: true }); } catch { throw new Error('Dit webadres bestaat niet (DNS).'); }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Dit webadres is niet openbaar bereikbaar.');
}

/** Haalt een pagina op met timeout, maximale grootte en veilige redirects. */
export async function safeFetchHtml(startUrl, { timeoutMs = 6000, maxBytes = 2_500_000, maxRedirects = 5 } = {}) {
  let url = startUrl;
  const chain = [];
  const t0 = Date.now();
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Doorverwijzing naar een ongeldig adres.');
    await assertPublicHost(u.hostname);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Math.max(1000, timeoutMs - (Date.now() - t0)));
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; StamCoreWebsiteScan/1.0; +https://stam-core.nl/website-scan)',
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'nl-NL,nl;q=0.9,en;q=0.5',
        },
      });
    } catch (e) {
      clearTimeout(timer);
      throw new Error(e.name === 'AbortError' ? 'De website reageerde niet op tijd.' : 'De website kon niet worden bereikt.');
    }
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      clearTimeout(timer);
      chain.push({ url, status: res.status });
      url = new URL(res.headers.get('location'), url).toString();
      continue;
    }
    // Body lezen met een maximum
    const reader = res.body?.getReader();
    const chunks = [];
    let size = 0;
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.length;
        if (size > maxBytes) { ctrl.abort(); break; }
        chunks.push(value);
      }
    }
    clearTimeout(timer);
    const html = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
    return { finalUrl: url, status: res.status, html, chain, ms: Date.now() - t0, headers: res.headers };
  }
  throw new Error('Te veel doorverwijzingen.');
}

// ── On-page checks (alleen de homepage) ────────────────────────────────────
const decode = (s) => String(s || '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const stripTags = (s) => decode(String(s || '').replace(/<[^>]+>/g, ' '));
function attr(tag, name) {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return m ? decode(m[2] ?? m[3] ?? m[4] ?? '') : null;
}
function metaContent(html, key, value) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    if ((attr(m[0], key) || '').toLowerCase() === value) return attr(m[0], 'content');
  }
  return null;
}

export function analyzeHtml(html, finalUrl, startUrl) {
  const head = html.slice(0, 400_000);
  const title = stripTags((head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '');
  const description = metaContent(head, 'name', 'description') || '';
  const viewport = metaContent(head, 'name', 'viewport') || '';
  const robots = (metaContent(head, 'name', 'robots') || '').toLowerCase();
  const lang = attr((head.match(/<html\b[^>]*>/i) || [''])[0], 'lang') || '';
  let canonical = '';
  for (const m of head.matchAll(/<link\b[^>]*>/gi)) {
    if ((attr(m[0], 'rel') || '').toLowerCase().split(/\s+/).includes('canonical')) { canonical = attr(m[0], 'href') || ''; break; }
  }
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1])).filter(Boolean);
  // schema.org (JSON-LD): types verzamelen
  const schemaTypes = new Set();
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (n) => {
        if (Array.isArray(n)) return n.forEach(walk);
        if (n && typeof n === 'object') {
          const t = n['@type'];
          (Array.isArray(t) ? t : t ? [t] : []).forEach((x) => schemaTypes.add(String(x)));
          Object.values(n).forEach(walk);
        }
      };
      walk(JSON.parse(m[1].trim()));
    } catch { /* kapotte JSON-LD: telt niet mee */ }
  }
  if (/itemtype\s*=\s*["']https?:\/\/schema\.org\//i.test(html)) schemaTypes.add('Microdata');
  const LOCAL_TYPES = /LocalBusiness|ProfessionalService|HomeAndConstructionBusiness|Store|Restaurant|Dentist|Plumber|Electrician|HousePainter|RoofingContractor|Locksmith|MovingCompany|CleaningService|AutoRepair|HVACBusiness|GeneralContractor|LegalService|AccountingService|MedicalBusiness|HealthAndBeautyBusiness|Organization/i;
  const hasLocalSchema = [...schemaTypes].some((t) => LOCAL_TYPES.test(t) && !/^Organization$/i.test(t));
  // Afbeeldingen + alt-dekking (lege alt telt als bewust decoratief = ok)
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  const withAlt = imgs.filter((t) => attr(t, 'alt') !== null).length;
  const altCoverage = imgs.length ? Math.round((withAlt / imgs.length) * 100) : null;
  // Woorden in de body (zonder scripts/styles)
  const body = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>/gi, ' ');
  const wordCount = stripTags(body).split(' ').filter((w) => /[a-z0-9à-ÿ]/i.test(w)).length;
  const hasTel = /href\s*=\s*["']tel:/i.test(html);
  const hasWhatsApp = /wa\.me\/|api\.whatsapp\.com|whatsapp:\/\//i.test(html);
  const ogTitle = metaContent(head, 'property', 'og:title');
  const ogImage = metaContent(head, 'property', 'og:image');
  const https = finalUrl.startsWith('https://');

  return {
    url: startUrl,
    finalUrl,
    https,
    title, titleLength: title.length,
    description, descriptionLength: description.length,
    h1Count: h1s.length, h1: h1s.slice(0, 3),
    viewport: !!viewport,
    canonical,
    noindex: robots.includes('noindex'),
    lang,
    schemaTypes: [...schemaTypes].slice(0, 12),
    hasLocalSchema,
    images: imgs.length, altCoverage,
    wordCount,
    contact: { tel: hasTel, whatsapp: hasWhatsApp },
    openGraph: !!(ogTitle && ogImage),
  };
}

// ── Scan-token: koppelt de vervolgverzoeken aan een geldige scan ──────────
// Zonder token kan niemand onze PageSpeed-key via deze functies aanroepen.
// Let op: netlify/edge-functions/scan-psi.js controleert dezelfde token (Web Crypto).
function secret() {
  const s = process.env.SCAN_TOKEN_SECRET;
  if (s && s.length >= 16) return s;
  throw new Error('SCAN_TOKEN_SECRET ontbreekt of is te kort');
}
const b64url = (buf) => Buffer.from(buf).toString('base64url');
export function signToken(payload, ttlSec = 15 * 60) {
  const body = b64url(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const sig = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
  return `${body}.${sig}`;
}
export function verifyToken(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const expect = b64url(crypto.createHmac('sha256', secret()).update(body).digest());
  if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

// ── Eenvoudige rate-limit per IP (per warme functie-instantie; Netlify's eigen
//    rate-limit in de function-config is de eerste verdedigingslinie) ──────────
const buckets = new Map();
export function rateLimited(key, limit, windowMs) {
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 5000) buckets.clear();
  return hits.length > limit;
}

