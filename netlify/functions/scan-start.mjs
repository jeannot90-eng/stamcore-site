// Website-Scan stap 1: invoer controleren, homepage ophalen + on-page checks,
// lead in Brevo zetten en een scan-token teruggeven voor de PageSpeed-metingen.
import {
  json, fail, readJson, isEmail, normalizeUrl, safeFetchHtml, analyzeHtml,
  signToken, rateLimited, upsertBrevoContact,
} from '../lib/website-scan.mjs';

export default async (req, context) => {
  if (req.method !== 'POST') return fail(405, 'Alleen POST.');
  const ip = context.ip || req.headers.get('x-nf-client-connection-ip') || 'onbekend';
  if (rateLimited(`start:${ip}`, 5, 10 * 60_000)) {
    return fail(429, 'Je hebt net al een paar scans gedaan. Probeer het over een paar minuten opnieuw.');
  }

  let input;
  try { input = await readJson(req); } catch { return fail(400, 'Ongeldig verzoek.'); }

  // Bots: verborgen veld ingevuld of formulier binnen 2 seconden verstuurd
  if (input.bedrijfsnaam_extra || (Number(input.startedAt) && Date.now() - Number(input.startedAt) < 2000)) {
    return fail(400, 'Er ging iets mis. Probeer het opnieuw.');
  }
  const email = String(input.email || '').trim().toLowerCase();
  if (!isEmail(email)) return fail(400, 'Vul een geldig e-mailadres in.');
  if (input.consent !== true) return fail(400, 'Geef toestemming om je het rapport te sturen en contact op te nemen.');
  let url;
  try { url = normalizeUrl(input.url); } catch (e) { return fail(400, e.message); }
  if (rateLimited(`email:${email}`, 5, 24 * 60 * 60_000)) {
    return fail(429, 'Met dit e-mailadres zijn vandaag al genoeg scans gedaan.');
  }

  // Homepage ophalen en checken. Lukt dat niet, dan nemen we de lead toch op.
  let onpage = null;
  let fetchError = null;
  try {
    const page = await safeFetchHtml(url);
    if (page.status >= 400) fetchError = `De homepage gaf foutcode ${page.status}.`;
    else onpage = analyzeHtml(page.html, page.finalUrl, url);
  } catch (e) {
    fetchError = e.message;
  }
  // Tikfout of geen openbaar adres: geen lead en geen scan, de bezoeker kan het verbeteren.
  if (fetchError && /bestaat niet|niet openbaar/.test(fetchError)) return fail(400, `${fetchError} Klopt het adres?`);

  await upsertBrevoContact(email, {
    WEBSITE: url,
    SCAN_DATUM: new Date().toISOString().slice(0, 10),
    BRON: 'website-scan',
  });

  let token;
  try { token = signToken({ email, url }); } catch (e) {
    console.error('[scan-start]', e.message);
    return fail(500, 'De scan is nog niet goed ingesteld. Neem even contact met ons op.');
  }
  return json(200, { ok: true, url, onpage, fetchError, token });
};

export const config = {
  path: '/api/scan/start',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
