// Website-Scan stap 2: PageSpeed Insights voor één strategie (mobile of desktop).
// Edge Function i.p.v. een gewone Function: PageSpeed doet er 10-20 s over en een gewone
// (synchrone) Function heeft standaard een limiet van 10 s. Een Edge Function mag ~40 s
// wachten op het antwoord; wachten op fetch telt niet als rekentijd.
// De PageSpeed-key en het token-geheim komen uit de Netlify environment variables.

const b64url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/** Zelfde token als netlify/lib/website-scan.mjs maakt (HMAC-SHA256, base64url). */
async function verifyToken(token, secret) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const expect = b64url(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body)));
  if (expect.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) diff |= sig.charCodeAt(i) ^ expect.charCodeAt(i);
  if (diff) return null;
  try {
    const p = JSON.parse(fromB64url(body));
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}

async function runPageSpeed(url, strategy, apiKey) {
  const qs = new URLSearchParams({ url, strategy });
  for (const c of ['PERFORMANCE', 'SEO', 'ACCESSIBILITY', 'BEST_PRACTICES']) qs.append('category', c);
  if (apiKey) qs.set('key', apiKey);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 35000);
  try {
    const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, { signal: ctrl.signal });
    if (!res.ok) return { ok: false, error: res.status === 429 ? 'PageSpeed is even overbelast (quota).' : `PageSpeed gaf fout ${res.status}.` };
    const lh = (await res.json()).lighthouseResult || {};
    const cat = lh.categories || {};
    const score = (k) => (cat[k] && typeof cat[k].score === 'number' ? Math.round(cat[k].score * 100) : null);
    const audit = (k) => (lh.audits && lh.audits[k]) || {};
    const lcp = audit('largest-contentful-paint');
    const cls = audit('cumulative-layout-shift');
    const opportunities = Object.values(lh.audits || {})
      .filter((a) => a.details?.type === 'opportunity' && (a.details.overallSavingsMs || 0) > 300)
      .sort((a, b) => (b.details.overallSavingsMs || 0) - (a.details.overallSavingsMs || 0))
      .slice(0, 3)
      .map((a) => ({ id: a.id, title: a.title, savingsMs: Math.round(a.details.overallSavingsMs) }));
    return {
      ok: true,
      strategy,
      scores: { performance: score('performance'), seo: score('seo'), accessibility: score('accessibility'), bestPractices: score('best-practices') },
      lcp: { ms: Math.round(lcp.numericValue || 0) || null, display: lcp.displayValue || null },
      cls: { value: typeof cls.numericValue === 'number' ? Math.round(cls.numericValue * 1000) / 1000 : null, display: cls.displayValue || null },
      opportunities,
    };
  } catch (e) {
    return { ok: false, error: e.name === 'AbortError' ? 'PageSpeed deed er te lang over.' : 'PageSpeed was niet bereikbaar.' };
  } finally {
    clearTimeout(timer);
  }
}

export default async (req) => {
  if (req.method !== 'GET') return json(405, { ok: false, error: 'Alleen GET.' });
  const strategy = new URL(req.url).searchParams.get('strategy');
  if (!['mobile', 'desktop'].includes(strategy)) return json(400, { ok: false, error: 'Onbekende strategie.' });

  const secret = Netlify.env.get('SCAN_TOKEN_SECRET');
  if (!secret || secret.length < 16) {
    console.error('[scan-psi] SCAN_TOKEN_SECRET ontbreekt of is te kort');
    return json(500, { ok: false, error: 'De scan is nog niet goed ingesteld.' });
  }
  const token = await verifyToken(req.headers.get('x-scan-token'), secret);
  if (!token) return json(401, { ok: false, error: 'Deze scan is verlopen. Start een nieuwe scan.' });

  return json(200, await runPageSpeed(token.url, strategy, Netlify.env.get('PAGESPEED_API_KEY') || ''));
};

export const config = {
  path: '/api/scan/psi',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
