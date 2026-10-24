// Website-Scan stap 1: invoer controleren, homepage ophalen + on-page checks, de scan
// loggen (Netlify Blobs, zonder IP) en een scan-token teruggeven voor de PageSpeed-metingen.
// Een e-mailadres is niet nodig. Wie contact wil, vult na het rapport het optionele
// formulier in (Netlify Forms "website-scan", net als het contactformulier).
import {
  json, fail, readJson, normalizeUrl, safeFetchHtml, analyzeHtml, signToken, rateLimited,
} from '../lib/website-scan.mjs';
import { overHourlyLimit, logScan, MAX_PER_HOUR } from '../lib/scan-store.mjs';

// Crawlers die een gedeelde scanlink (/website-scan?url=…) openen, starten geen scan.
const BOT_UA = /bot|crawl|spider|slurp|facebookexternalhit|whatsapp|preview|headless|lighthouse|pingdom|monitor/i;

export default async (req, context) => {
  if (req.method !== 'POST') return fail(405, 'Alleen POST.');
  if (BOT_UA.test(req.headers.get('user-agent') || '')) return fail(403, 'Scans door bots zijn uitgeschakeld.');
  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || 'onbekend';

  let input;
  try { input = await readJson(req); } catch { return fail(400, 'Ongeldig verzoek.'); }
  if (input.bedrijfsnaam_extra) return fail(400, 'Er ging iets mis. Probeer het opnieuw.'); // honeypot

  let url;
  try { url = normalizeUrl(input.url); } catch (e) { return fail(400, e.message); }

  const busy = `Je hebt het afgelopen uur al ${MAX_PER_HOUR} scans gedaan. Probeer het later opnieuw, of app ons even.`;
  if (rateLimited(`start:${ip}`, MAX_PER_HOUR, 60 * 60_000) || await overHourlyLimit(ip)) return fail(429, busy);

  let onpage = null;
  let fetchError = null;
  try {
    const page = await safeFetchHtml(url);
    if (page.status >= 400) fetchError = `De homepage gaf foutcode ${page.status}.`;
    else onpage = analyzeHtml(page.html, page.finalUrl, url);
  } catch (e) {
    fetchError = e.message;
  }
  // Tikfout of geen openbaar adres: geen scan, de bezoeker kan het verbeteren.
  if (fetchError && /bestaat niet|niet openbaar/.test(fetchError)) return fail(400, `${fetchError} Klopt het adres?`);

  const bron = String(input.bron || '').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 80) || 'direct';
  const logKey = await logScan({ url, bron, onpage, fetchError });

  let token;
  try { token = signToken({ url, log: logKey }); } catch (e) {
    console.error('[scan-start]', e.message);
    return fail(500, 'De scan is nog niet goed ingesteld. Neem even contact met ons op.');
  }
  return json(200, { ok: true, url, onpage, fetchError, token });
};

export const config = {
  path: '/api/scan/start',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
