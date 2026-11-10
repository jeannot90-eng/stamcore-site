#!/usr/bin/env node
/**
 * Zet geplande kennisartikelen live waarvan de geplande datum vandaag of eerder is.
 *
 *   node seo/scripts/publiceer-gepland.mjs            → voert het uit
 *   node seo/scripts/publiceer-gepland.mjs --droog    → laat alleen zien wat er zou gebeuren
 *
 * Per artikel met status `gepland` in seo/QUEUE.md en Datum <= vandaag:
 *   - seo/articles/{slug}.md: status live, datePublished en dateModified op vandaag
 *   - seo/QUEUE.md: status live, datum vandaag
 *   - seo/LOG.md: regel in de publicatietabel
 * Daarna: `npm run build`, controleren, committen en pushen (doet de geplande taak).
 * Print de gepubliceerde slugs als laatste regel: "GEPUBLICEERD: slug1 slug2" (of "GEPUBLICEERD: -").
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const droog = process.argv.includes('--droog');
const vandaag = process.env.SEO_VANDAAG || new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Amsterdam' }); // YYYY-MM-DD

const lees = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const schrijf = (p, s, origineel) => {
  const nl = origineel.includes('\r\n') ? '\r\n' : '\n';
  fs.writeFileSync(path.join(ROOT, p), s.replace(/\r\n/g, '\n').replace(/\n/g, nl));
};

const queueOrig = lees('seo/QUEUE.md');
let queue = queueOrig.replace(/\r\n/g, '\n');
const rijRe = /^\| artikel \| ([a-z0-9-]+) \| gepland \| (\d{4}-\d{2}-\d{2}) \|[^\n]*$/gm;
const teDoen = [...queue.matchAll(rijRe)].filter((m) => m[2] <= vandaag).map((m) => ({ rij: m[0], slug: m[1], gepland: m[2] }));

if (!teDoen.length) {
  console.log(`Niets gepland voor ${vandaag} of eerder.`);
  console.log('GEPUBLICEERD: -');
  process.exit(0);
}

const logOrig = lees('seo/LOG.md');
let log = logOrig.replace(/\r\n/g, '\n');
const urls = [];

for (const a of teDoen) {
  const mdPad = `seo/articles/${a.slug}.md`;
  if (!fs.existsSync(path.join(ROOT, mdPad))) { console.error(`✗ ${mdPad} ontbreekt`); process.exit(1); }
  const mdOrig = lees(mdPad);
  let md = mdOrig.replace(/\r\n/g, '\n');
  if (!/^status: concept$/m.test(md)) { console.error(`✗ ${mdPad} heeft geen "status: concept"`); process.exit(1); }
  md = md.replace(/^status: concept$/m, 'status: live')
    .replace(/^datePublished: .*$/m, `datePublished: ${vandaag}`)
    .replace(/^dateModified: .*$/m, `dateModified: ${vandaag}`);
  queue = queue.replace(a.rij, `| artikel | ${a.slug} | live | ${vandaag} | Gepland op ${a.gepland}, automatisch gepubliceerd (taak kennisartikel-publiceren); concept 2026-11-10, akkoord Jeannot |`);
  const url = `https://stam-core.nl/kennis/${a.slug}`;
  urls.push(url);
  console.log(`${droog ? '(droog) ' : ''}→ ${a.slug} (gepland ${a.gepland}) live`);
  if (!droog) schrijf(mdPad, md, mdOrig);
}

const logRegel = `| ${vandaag} | Gepland kennisartikel live (taak kennisartikel-publiceren): ${teDoen.map((a) => a.slug).join(', ')} | ${urls.join(' · ')} | kennis: ${teDoen.map((a) => a.slug).join(', ')} |`;
const anker = '\n\n## Indexering';
if (!log.includes(anker)) { console.error('✗ seo/LOG.md: kop "## Indexering" niet gevonden'); process.exit(1); }
log = log.replace(anker, `\n${logRegel}${anker}`);

if (!droog) {
  schrijf('seo/QUEUE.md', queue, queueOrig);
  schrijf('seo/LOG.md', log, logOrig);
}
console.log(`GEPUBLICEERD: ${teDoen.map((a) => a.slug).join(' ')}`);
