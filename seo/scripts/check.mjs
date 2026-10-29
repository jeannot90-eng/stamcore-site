#!/usr/bin/env node
/* ===========================================================================
   Kwaliteitscheck (SEO-PLAN.md §6). Controleert de gegenereerde HTML van:
   stadspagina's (live + _preview), kennisartikelen, de pijlers.
   Exit code 1 bij één of meer FOUTEN. Een pagina met een fout gaat niet live.
=========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, SITE, PREVIEW_DIR, config, read, exists, slugify, words, loadNiches, loadCities, loadArticles, cityInfo, isExcluded,
  visibleText, uniqueText, trigrams, jaccard, resolveUrl,
} from './lib.mjs';

const niches = loadNiches();
const cities = loadCities();
const articles = loadArticles();

// ── Welke pagina's? ─────────────────────────────────────────────────────────
const pages = [];
const add = (file, type, url, extra = {}) => { if (exists(file)) pages.push({ file, type, url, ...extra }); };
for (const n of Object.values(niches)) {
  add(n.pijlerBestand, 'pijler', n.pijlerUrl, { isPijler: true });
  add(`${n.seoPijlerUrl.slice(1)}.html`, 'seo-pijler', n.seoPijlerUrl);
}
for (const c of cities) {
  const n = niches[c.niche]; if (!n) continue;
  const info = cityInfo(c, n);
  const file = c.status === 'live' ? info.file : `${PREVIEW_DIR}/${info.file}`;
  add(file, 'stad', info.url, { preview: c.status !== 'live', stad: c.stad, wijken: c.wijken || [], wikidata: c.wikidata || null, bronnen: Array.isArray(c.bronnen) ? c.bronnen.length : 0 });
  if (c.status === 'live' && !exists(file)) pages.push({ file, type: 'stad', url: info.url, missing: true });
}
add('kennis/index.html', 'overzicht', '/kennis/');
for (const a of articles) {
  const live = a.status === 'live';
  add(live ? a.file : `${PREVIEW_DIR}/${a.file}`, 'artikel', a.url, { preview: !live });
}

// Titels/meta/h1 van de hele site, voor uniekheid
const sitePages = [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
  ...(exists('kennis') ? fs.readdirSync(path.join(ROOT, 'kennis')).filter((f) => f.endsWith('.html')).map((f) => `kennis/${f}`) : []),
  ...pages.filter((p) => p.preview).map((p) => p.file),
];
const decode = (s) => s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
const getTitle = (h) => decode((h.match(/<title>([^<]*)<\/title>/) || [])[1] || '');
const getMeta = (h) => decode((h.match(/<meta name="description" content="([^"]*)"/) || [])[1] || '');
const getH1s = (h) => [...h.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)].map((m) => decode(m[1].replace(/<[^>]+>/g, '')));
const index = { title: new Map(), meta: new Map(), h1: new Map() };
for (const f of sitePages) {
  const h = read(f);
  const push = (k, v) => { if (!v) return; if (!index[k].has(v)) index[k].set(v, []); index[k].get(v).push(f); };
  push('title', getTitle(h)); push('meta', getMeta(h)); getH1s(h).forEach((v) => push('h1', v));
}

const MIN_WORDS = { stad: 700, artikel: 1000, 'seo-pijler': 1000, pijler: 1000, overzicht: 250 };
const TYPES = {
  stad: ['Service', 'BreadcrumbList', 'FAQPage'],
  'seo-pijler': ['Service', 'BreadcrumbList', 'FAQPage'],
  pijler: ['Service', 'BreadcrumbList'],
  artikel: ['Article', 'BreadcrumbList'],
  overzicht: ['CollectionPage', 'BreadcrumbList'],
};
const verboden = [...config.verboden, ...config.verboden_namen].map((v) => v.toLowerCase());
const pijlerUrls = new Set(Object.values(niches).map((n) => n.pijlerUrl));

// ── Per pagina ──────────────────────────────────────────────────────────────
const results = [];
for (const p of pages) {
  const fout = [], waarschuwing = [];
  if (p.missing) { results.push({ p, fout: ['pagina staat op live maar is niet gebouwd (draai seo:build)'], waarschuwing }); continue; }
  const html = read(p.file);
  const text = visibleText(html);

  const title = getTitle(html);
  if (!title) fout.push('title ontbreekt');
  else {
    if (title.length > 60) fout.push(`title is ${title.length} tekens (max 60)`);
    if (index.title.get(title)?.length > 1) fout.push(`title niet uniek (ook: ${index.title.get(title).filter((f) => f !== p.file).join(', ')})`);
  }
  const meta = getMeta(html);
  if (!meta) fout.push('meta description ontbreekt');
  else {
    if (meta.length < 120 || meta.length > 160) fout.push(`meta description is ${meta.length} tekens (120–160)`);
    if (index.meta.get(meta)?.length > 1) fout.push(`meta description niet uniek (ook: ${index.meta.get(meta).filter((f) => f !== p.file).join(', ')})`);
  }
  const h1s = getH1s(html);
  if (h1s.length !== 1) fout.push(`${h1s.length} H1's (precies 1 nodig)`);
  else if (index.h1.get(h1s[0])?.length > 1) fout.push(`H1 niet uniek (ook: ${index.h1.get(h1s[0]).filter((f) => f !== p.file).join(', ')})`);

  const canonical = (html.match(/<link rel="canonical" href="([^"]*)"/) || [])[1];
  if (canonical !== `${SITE}${p.url}`) fout.push(`canonical is "${canonical ?? '—'}", verwacht ${SITE}${p.url}`);

  const nWords = words(text).length;
  if (nWords < MIN_WORDS[p.type]) fout.push(`${nWords} woorden (minimaal ${MIN_WORDS[p.type]})`);
  let nUniek = null;
  if (p.type === 'stad') {
    nUniek = words(uniqueText(html)).length;
    if (nUniek < 350) fout.push(`${nUniek} woorden in de unieke blokken (minimaal 350)`);
  }

  // JSON-LD
  const types = new Set();
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const j = JSON.parse(m[1]);
      for (const node of j['@graph'] || [j]) [].concat(node['@type']).forEach((t) => types.add(t));
    } catch (e) { fout.push(`JSON-LD niet parsebaar: ${e.message}`); }
  }
  const missingTypes = TYPES[p.type].filter((t) => !types.has(t));
  if (missingTypes.length) fout.push(`JSON-LD mist: ${missingTypes.join(', ')}`);

  // Interne links
  const hrefs = [...html.replace(/<!-- partial:(header|footer) -->[\s\S]*?<!-- \/partial:\1 -->/g, '').matchAll(/<a\s[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  const internal = hrefs.filter((h) => h.startsWith('/') || h.startsWith(SITE)).map((h) => h.replace(SITE, '') || '/');
  const uniq = [...new Set(internal.map((h) => h.split('#')[0] || '/'))];
  if (uniq.length < 3) fout.push(`${uniq.length} interne links in de inhoud (minimaal 3)`);
  if (!p.isPijler && !uniq.some((u) => pijlerUrls.has(u))) fout.push('geen link naar de pijler');
  if (!uniq.includes('/prijzen')) fout.push('geen link naar /prijzen');
  const broken = [...new Set(internal)].filter((h) => !resolveUrl(h));
  if (broken.length) fout.push(`links naar niet-bestaande pagina's: ${broken.join(', ')}`);

  // Afbeeldingen
  for (const m of html.matchAll(/<img\b[^>]*>/g)) {
    const tag = m[0];
    const miss = ['alt', 'width', 'height'].filter((a) => !new RegExp(`\\s${a}="`).test(tag));
    if (!/fetchpriority="high"/.test(tag) && !/loading="lazy"/.test(tag)) miss.push('loading="lazy"');
    if (miss.length) fout.push(`afbeelding mist ${miss.join(', ')}: ${tag.slice(0, 80)}…`);
  }

  // Placeholders en verboden woorden
  const scanText = `${title} ${meta} ${text}`;
  for (const ph of ['[[', 'TODO', 'lorem', '{Stad}', '{stad}', '{{']) if (scanText.toLowerCase().includes(ph.toLowerCase())) fout.push(`placeholder gevonden: "${ph}"`);
  const token = scanText.match(/\{[a-z_]+\}/);
  if (token) fout.push(`niet-ingevulde token: ${token[0]}`);
  for (const v of verboden) if (v && scanText.toLowerCase().includes(v)) fout.push(`verboden woord/frase: "${v}"`);

  if (p.type === 'stad' && isExcluded(p.stad)) fout.push(`${p.stad} staat in de uitsluitlijst`);
  // Bronnen horen in de JSON, nooit in de paginatekst.
  const bronTekst = scanText.match(/volgens wikipedia|wikipedia|\bbron:|\baldus\b/i);
  if (bronTekst) fout.push(`bronvermelding in de paginatekst: "${bronTekst[0]}" (bronnen alleen in de stads-JSON)`);
  if (p.type === 'stad') {
    const kansen = [...html.matchAll(/<li class="flex gap-3"><span class="text-emerald-400">\+<\/span><span>([^<]*)<\/span><\/li>/g)].map((m) => m[1]);
    // Wijknaam als los woord (dus "Zuid" telt niet mee in "Oud-Zuid").
    const letter = (ch) => !!ch && /[\p{L}-]/u.test(ch);
    const noemt = (zin, w) => { let i = zin.indexOf(w); while (i >= 0) { if (!letter(zin[i - 1]) && !letter(zin[i + w.length])) return true; i = zin.indexOf(w, i + 1); } return false; };
    const metWijk = kansen.filter((k) => p.wijken.some((w) => noemt(k, w)));
    if (metWijk.length > 1) fout.push(`${metWijk.length} kans-zinnen noemen een wijk (max 1)`);
  }
  if (p.type === 'stad') {
    if (/\d/.test(uniqueText(html).replace(/Gemeten op[^.]*\./g, '')) && !p.bronnen) fout.push('bevat getallen, maar "bronnen" in de stads-JSON is leeg');
    const og = (html.match(/<meta property="og:image" content="([^"]*)"/) || [])[1] || '';
    const tw = (html.match(/<meta name="twitter:image" content="([^"]*)"/) || [])[1] || '';
    if (!og.startsWith(`${SITE}/img/og/`)) fout.push(`og:image is geen stads-afbeelding (${og || '—'})`);
    else if (!exists(og.replace(`${SITE}/`, ''))) fout.push(`og:image-bestand ontbreekt: ${og.replace(`${SITE}/`, '')}`);
    if (tw !== og) fout.push('twitter:image wijkt af van og:image');
    // Service-schema moet areaServed (City met naam) hebben; sameAs naar Wikidata/Wikipedia als die in de stads-JSON staan.
    let service = null;
    for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      try { service = (JSON.parse(m[1])['@graph'] || []).find((n) => n['@type'] === 'Service') || service; } catch { /* al gemeld */ }
    }
    if (!service?.areaServed?.name) fout.push('Service-schema mist areaServed met plaatsnaam');
    else if (p.wikidata && !(service.areaServed.sameAs || []).includes(p.wikidata)) fout.push('areaServed mist de Wikidata-link uit de stads-JSON');
  }
  if (/VOORBEELDDATA/.test(html)) (p.preview ? waarschuwing : fout).push('bevat VOORBEELDDATA (geen echte Maps-scan)');
  if (p.preview && !/<meta name="robots" content="noindex">/.test(html)) fout.push('concept zonder noindex');

  results.push({ p, fout, waarschuwing, nWords, nUniek, html, text });
}

// ── Uniekheid stadspagina's onderling ─────────────────────────────────────────
const stadRes = results.filter((r) => r.p.type === 'stad' && r.html);
for (let i = 0; i < stadRes.length; i++) for (let j = i + 1; j < stadRes.length; j++) {
  const a = stadRes[i], b = stadRes[j];
  const u = jaccard(trigrams(uniqueText(a.html)), trigrams(uniqueText(b.html)));
  const f = jaccard(trigrams(a.text), trigrams(b.text));
  const pct = (x) => `${Math.round(x * 100)}%`;
  if (u > 0.25) for (const [x, y] of [[a, b], [b, a]]) x.fout.push(`unieke blokken lijken te veel op ${y.p.url} (${pct(u)} overlap, max 25%)`);
  if (f > 0.6) for (const [x, y] of [[a, b], [b, a]]) x.fout.push(`hele pagina lijkt te veel op ${y.p.url} (${pct(f)} overlap, max 60%)`);
  else if (f > 0.5) for (const [x, y] of [[a, b], [b, a]]) x.waarschuwing.push(`hele pagina lijkt op ${y.p.url} (${pct(f)} overlap, advies ≤ 50%)`);
}

// Geen zin van 12+ woorden letterlijk op twee stadspagina's (alleen de unieke blokken; systeem, case,
// prijzen en standaard-FAQ staan buiten <!-- uniek --> en tellen dus niet mee).
const zinnen = (html) => new Set(uniqueText(html).split(/(?<=[.!?])\s+/)
  .map((z) => z.toLowerCase().replace(/\s+/g, ' ').trim()).filter((z) => words(z).length >= 12));
const zinnenPer = stadRes.map((r) => zinnen(r.html));
for (let i = 0; i < stadRes.length; i++) for (let j = i + 1; j < stadRes.length; j++) {
  for (const z of zinnenPer[i]) if (zinnenPer[j].has(z)) {
    const kort = z.length > 90 ? `${z.slice(0, 90)}…` : z;
    stadRes[i].fout.push(`zin staat ook op ${stadRes[j].p.url}: "${kort}"`);
    stadRes[j].fout.push(`zin staat ook op ${stadRes[i].p.url}: "${kort}"`);
  }
}
// Zelfde sjabloon, andere stad of ander getal: de patronen uit config.herhaalpatronen mogen op hooguit één stadspagina staan.
for (const patroon of config.herhaalpatronen || []) {
  const re = new RegExp(patroon, 'i');
  const met = stadRes.filter((r) => re.test(uniqueText(r.html)));
  if (met.length > 1) for (const r of met) r.fout.push(`formulering /${patroon}/ staat op ${met.length} stadspagina's (max 1): ${met.filter((x) => x !== r).map((x) => x.p.url).join(', ')}`);
}

// ── Kennisartikelen (KENNISARTIKELEN.md §7) ──────────────────────────────────
// Gemeten op de Markdown van het artikel zelf (+ FAQ), niet op de vaste blokken van het template.
const mdText = (md) => String(md)
  .replace(/\[([^\]]+)\]\([^)\s]+\)/g, '$1').replace(/\*\*/g, '')
  .replace(/^\s*#{2,3}\s+/gm, '').replace(/^\s*([-*]|\d+\.)\s+(\[( |x)\]\s+)?/gm, '');
const norm = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
// Zoekwoord "staat erin" als elk woord ervan als (begin van een) woord voorkomt: "glazenwasser" telt in "glazenwassers".
const heeftZoekwoord = (veld, kw) => { const w = words(norm(veld)); return words(norm(kw)).every((k) => w.some((x) => x.startsWith(k))); };
const verbodenArtikel = (config.verboden_artikel || []).map((v) => v.toLowerCase());
const GOOGLE_ONDERWERP = /google|bedrijfsprofiel|pagespeed|search console|review/i;
const artikelZinnen = [];
for (const a of articles) {
  const r = results.find((x) => x.p.type === 'artikel' && x.p.url === a.url);
  if (!r) continue;
  const faqTekst = Array.isArray(a.faq) ? a.faq.map((f) => `${f.vraag} ${f.antwoord}`).join(' ') : '';
  const body = mdText(a.body);
  const n = words(`${body} ${faqTekst}`).length;
  if (n < 1000 || n > 2200) r.fout.push(`artikeltekst is ${n} woorden (1.000–2.200)`);

  const blokken = a.body.split(/\r?\n\s*\r?\n/).map((b) => b.trim()).filter(Boolean);
  const eerste = mdText(blokken.find((b) => !/^#/.test(b)) || '');
  if (!a.zoekwoord) r.fout.push('frontmatter "zoekwoord" ontbreekt');
  else if (![a.title, a.h1, eerste].some((v) => heeftZoekwoord(v, a.zoekwoord))) r.fout.push(`zoekwoord "${a.zoekwoord}" staat niet in de title, de H1 of de eerste alinea`);
  if (words(eerste).length > 80) r.waarschuwing.push(`eerste alinea is ${words(eerste).length} woorden (advies ≤ 80)`);

  const links = [...new Set([...a.body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((m) => m[1].split('#')[0].replace(/\/$/, '') || '/'))];
  if (links.length < 3) r.fout.push(`${links.length} interne links in de artikeltekst (minimaal 3)`);
  if (!links.some((u) => pijlerUrls.has(u) || Object.values(niches).some((ni) => ni.seoPijlerUrl === u))) r.fout.push('geen link naar een pijler in de artikeltekst');

  const bronnen = Array.isArray(a.bronnen) ? a.bronnen.filter(Boolean) : [];
  if (/\d/.test(`${body} ${faqTekst}`) && !bronnen.length) r.fout.push('bevat getallen of jaartallen, maar "bronnen" in de frontmatter is leeg');
  const bronInTekst = `${body} ${faqTekst}`.match(/\(bron\b|\bbronnen?:|volgens (wikipedia|[a-z]+\.(nl|com|org))/i);
  if (bronInTekst) r.fout.push(`bronvermelding in de artikeltekst: "${bronInTekst[0]}"`);

  const input = exists(`seo/articles/input/${a.slug}.md`) ? read(`seo/articles/input/${a.slug}.md`).toLowerCase() : '';
  const laag = `${a.title} ${a.meta} ${a.h1} ${body} ${faqTekst}`.toLowerCase();
  for (const v of verbodenArtikel) if (v && laag.includes(v) && !input.includes(v)) r.fout.push(`verboden frase: "${v}"`);

  if (!/^\s*(\d+\.|[-*]\s+\[( |x)\])\s+/m.test(a.body) && !/^#{2,3}\s+(stap|checklist)/im.test(a.body)) r.waarschuwing.push('geen stappenplan, checklist of genummerde lijst');
  const gewijzigd = new Date(a.dateModified || a.datePublished);
  if (Date.now() - gewijzigd > 365 * 864e5 && GOOGLE_ONDERWERP.test(`${a.title} ${a.body}`)) r.waarschuwing.push('ouder dan 12 maanden en over Google-functies: controleer opnieuw en werk dateModified bij');

  artikelZinnen.push({ r, zinnen: new Set(`${body} ${faqTekst}`.split(/(?<=[.!?])\s+/).map((z) => z.toLowerCase().replace(/\s+/g, ' ').trim()).filter((z) => words(z).length >= 12)) });
}
for (let i = 0; i < artikelZinnen.length; i++) for (let j = i + 1; j < artikelZinnen.length; j++) {
  const a = artikelZinnen[i], b = artikelZinnen[j];
  for (const z of a.zinnen) if (b.zinnen.has(z)) {
    const kort = z.length > 90 ? `${z.slice(0, 90)}…` : z;
    a.r.fout.push(`zin staat ook in ${b.r.p.url}: "${kort}"`);
    b.r.fout.push(`zin staat ook in ${a.r.p.url}: "${kort}"`);
  }
}

// ── Rapport ──────────────────────────────────────────────────────────────────
let nFout = 0;
console.log('Kwaliteitscheck SEO-pagina\'s\n');
for (const r of results) {
  const status = r.fout.length ? 'FOUT' : r.waarschuwing.length ? 'WAARSCHUWING' : 'OK';
  const stats = r.nWords != null ? ` · ${r.nWords} woorden${r.nUniek != null ? `, ${r.nUniek} uniek` : ''}` : '';
  console.log(`${status.padEnd(12)} ${r.p.url}${r.p.preview ? ' (concept)' : ''}  [${r.p.type}${stats}]`);
  for (const f of r.fout) console.log(`             ✗ ${f}`);
  for (const w of r.waarschuwing) console.log(`             ! ${w}`);
  nFout += r.fout.length;
}
console.log(`\n${results.length} pagina('s) gecontroleerd, ${nFout} fout(en).`);
process.exit(nFout ? 1 : 0);
