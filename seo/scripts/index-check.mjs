// Indexeringsstatus van alle sitemap-URL's via de Search Console URL Inspection API.
// Gebruik: npm run seo:index  (optioneel: GSC_KEY=pad\naar\sleutel.json, GSC_SITE=sc-domain:stam-core.nl)
// De sleutel van het serviceaccount staat buiten de repo en wordt nooit gecommit.
import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { homedir } from 'node:os';
import { join } from 'node:path';

const KEY = process.env.GSC_KEY || join(homedir(), '.stamcore', 'gsc-key.json');
const SITES = process.env.GSC_SITE ? [process.env.GSC_SITE] : ['sc-domain:stam-core.nl', 'https://stam-core.nl/'];

if (!existsSync(KEY)) {
  console.error(`Geen sleutel gevonden op ${KEY}. Zet GSC_KEY of plaats het JSON-bestand daar.`);
  process.exit(1);
}
const key = JSON.parse(readFileSync(KEY, 'utf8'));

async function token() {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  const body = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({
    iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  })}`;
  const jwt = `${body}.${createSign('RSA-SHA256').update(body).sign(key.private_key, 'base64url')}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error(`Token mislukt: ${JSON.stringify(j)}`);
  return j.access_token;
}

async function inspect(tok, site, url) {
  const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
    method: 'POST', headers: { authorization: `Bearer ${tok}`, 'content-type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: url, siteUrl: site, languageCode: 'nl' }),
  });
  const j = await res.json();
  if (!res.ok) throw Object.assign(new Error(j.error?.message || res.status), { status: res.status });
  return j.inspectionResult.indexStatusResult;
}

const urls = [...readFileSync(new URL('../../sitemap.xml', import.meta.url), 'utf8').matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
const tok = await token();

// Eerste property waar het serviceaccount toegang toe heeft.
let site;
for (const s of SITES) {
  try { await inspect(tok, s, urls[0]); site = s; break; } catch (e) { if (e.status !== 403) throw e; }
}
if (!site) {
  console.error(`Geen toegang tot ${SITES.join(' of ')}. Voeg ${key.client_email} toe als gebruiker in Search Console.`);
  process.exit(1);
}

const rows = [];
for (let i = 0; i < urls.length; i += 5) {
  rows.push(...await Promise.all(urls.slice(i, i + 5).map(async (url) => {
    try { return { url, ...(await inspect(tok, site, url)) }; } catch (e) { return { url, verdict: 'FOUT', coverageState: e.message }; }
  })));
}

const pad = (s, n) => String(s ?? '').padEnd(n);
const kort = (u) => u.replace('https://stam-core.nl', '') || '/';
const breed = Math.max(...rows.map((r) => kort(r.url).length));
console.log(`Property: ${site}  ·  ${new Date().toLocaleString('nl-NL')}\n`);
for (const r of rows.sort((a, b) => (a.verdict === 'PASS') - (b.verdict === 'PASS') || a.url.localeCompare(b.url))) {
  const ok = r.verdict === 'PASS' ? '✓' : '✗';
  console.log(`${ok} ${pad(kort(r.url), breed)}  ${pad(r.coverageState, 38)} ${r.lastCrawlTime ? r.lastCrawlTime.slice(0, 10) : ''}`);
}
const ja = rows.filter((r) => r.verdict === 'PASS').length;
console.log(`\n${ja}/${rows.length} geïndexeerd.`);
