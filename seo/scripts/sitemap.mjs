#!/usr/bin/env node
/* Schrijft sitemap.xml volledig opnieuw: vaste pagina's uit config.json + live stadspagina's + live artikelen.
   lastmod: stad/artikel uit de data (gewijzigd / dateModified), vaste pagina's uit de laatste git-commit
   (of vandaag als het bestand lokaal gewijzigd is). Zo verandert de sitemap alleen als er echt iets verandert. */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { ROOT, SITE, config, exists, today, loadNiches, loadCities, loadArticles, cityInfo } from './lib.mjs';

const git = (...args) => { try { return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim(); } catch { return ''; } };
function fileDate(file) {
  if (git('status', '--porcelain', '--', file)) return today();
  return git('log', '-1', '--format=%cs', '--', file) || today();
}

const niches = loadNiches();
const entries = [];
for (const s of config.statischeSitemap) {
  if (!exists(s.bestand)) { console.warn(`! sitemap: ${s.bestand} bestaat niet, overgeslagen`); continue; }
  entries.push({ loc: `${SITE}${s.url}`, lastmod: fileDate(s.bestand), priority: s.priority });
}
for (const c of loadCities().filter((c) => c.status === 'live').sort((a, b) => a.slug.localeCompare(b.slug))) {
  const info = cityInfo(c, niches[c.niche]);
  entries.push({ loc: info.canonical, lastmod: c.gewijzigd || c.gepubliceerd || today(), priority: '0.7' });
}
const liveArtikelen = loadArticles().filter((a) => a.status === 'live');
if (liveArtikelen.length && exists('kennis/index.html')) {
  const nieuwste = liveArtikelen.map((a) => a.dateModified || a.datePublished || today()).sort().pop();
  entries.push({ loc: `${SITE}/kennis/`, lastmod: nieuwste, priority: '0.7' });
}
for (const a of liveArtikelen.sort((a, b) => a.slug.localeCompare(b.slug))) {
  entries.push({ loc: a.canonical, lastmod: a.dateModified || a.datePublished || today(), priority: '0.6' });
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Gegenereerd door seo/scripts/sitemap.mjs (npm run seo:sitemap). Niet met de hand bewerken. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries.map((e) => `  <url>
    <loc>${e.loc}</loc>
    <lastmod>${e.lastmod}</lastmod>
    <priority>${e.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;
const file = path.join(ROOT, 'sitemap.xml');
if (fs.readFileSync(file, 'utf8') !== xml) { fs.writeFileSync(file, xml); console.log(`↻ sitemap.xml bijgewerkt (${entries.length} URL's)`); }
else console.log(`= sitemap.xml ongewijzigd (${entries.length} URL's)`);
