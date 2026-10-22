#!/usr/bin/env node
/* ===========================================================================
   Stam Core — paginagenerator (geen dependencies, draait lokaal; Netlify bouwt niets)

   Doet vier dingen, in deze volgorde:
   1. Branche × plaats-pagina's maken uit data/seo-paginas.json + templates/branche-plaats.html.
      Alleen records met "status": "live" worden gepubliceerd, en alleen als alle
      unieke blokken echt gevuld zijn (zie README → "Publicatieregel").
   2. Per pijlerpagina (bijv. website-glazenwasser.html) het blok met plaatspagina's
      bijwerken tussen <!-- PLAATSEN:START --> en <!-- PLAATSEN:END -->.
   3. Gedeelde blokken (header/footer/scripts uit templates/partials/) invullen in
      elke pagina met <!-- partial:naam --> … <!-- /partial:naam -->, en assets/app.css
      inline zetten in elke pagina (draai daarom eerst build:css).
   4. sitemap.xml bijwerken tussen <!-- GENERATED:START --> en <!-- GENERATED:END -->.

   Gebruik:
     npm run generate              → alles bijwerken
     npm run generate -- --check   → alleen controleren, niets schrijven
     npm run generate -- --preview → óók concept-records renderen naar _preview/ (niet in git)
=========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://stam-core.nl';
const GENERATOR_MARK = '<meta name="generator" content="stamcore-generate">';
const args = new Set(process.argv.slice(2));
const CHECK = args.has('--check');
const PREVIEW = args.has('--preview');

const errors = [];
const warnings = [];
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const write = (p, s) => {
  if (CHECK) return;
  fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, p), s);
};

// ── Helpers ────────────────────────────────────────────────────────────────
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const words = (s) => String(s).split(/\s+/).filter(Boolean);
const isPlaceholder = (v) => /\[\[(INVULLEN|OPTIONEEL)/.test(JSON.stringify(v ?? ''));
const filled = (v) => typeof v === 'string' ? v.trim() !== '' && !isPlaceholder(v) : v != null && !isPlaceholder(v);

function render(tpl, vars) {
  return tpl
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => { if (!(k in vars)) throw new Error(`template: onbekend veld {{{${k}}}}`); return vars[k]; })
    .replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in vars)) throw new Error(`template: onbekend veld {{${k}}}`); return esc(vars[k]); });
}

function replaceBetween(src, start, end, content, file) {
  const a = src.indexOf(start), b = src.indexOf(end);
  if (a < 0 || b < a) { errors.push(`${file}: markers ${start} … ${end} niet gevonden`); return src; }
  return src.slice(0, a + start.length) + content + src.slice(b);
}

// Woord-trigrammen om te checken dat intro's niet op elkaar lijken.
function trigrams(text) {
  const w = words(text.toLowerCase().replace(/[^a-z0-9à-ÿ\s]/g, ' '));
  const set = new Set();
  for (let i = 0; i + 2 < w.length; i++) set.add(w.slice(i, i + 3).join(' '));
  return set;
}
function overlap(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0; for (const t of a) if (b.has(t)) n++;
  return n / Math.min(a.size, b.size);
}

// ── 1. Data laden en valideren ───────────────────────────────────────────────
const data = JSON.parse(read('data/seo-paginas.json'));
const niches = data.niches || {};
const paginas = data.paginas || [];

function pageInfo(p) {
  const n = niches[p.niche];
  const slug = p.slug ? slugify(p.slug) : `website-${slugify(p.niche)}-${slugify(p.plaats)}`;
  return { niche: n, slug, file: `${slug}.html`, url: `/${slug}`, canonical: `${SITE}/${slug}` };
}

/** Geeft een lijst met problemen terug; leeg = publiceerbaar. */
function validate(p) {
  const out = [];
  const need = (cond, msg) => { if (!cond) out.push(msg); };
  need(niches[p.niche], `onbekende niche "${p.niche}" (voeg hem toe aan "niches")`);
  need(filled(p.plaats), 'plaats ontbreekt');
  need(filled(p.title), 'title ontbreekt of is placeholder');
  need(filled(p.meta), 'meta ontbreekt of is placeholder');
  need(filled(p.h1), 'h1 ontbreekt of is placeholder');
  // Verplichte unieke blokken
  const intro = Array.isArray(p.intro) ? p.intro : [];
  need(intro.length >= 2 && intro.every(filled), 'intro: minimaal 2 gevulde alinea\'s');
  need(words(intro.join(' ')).length >= 80, `intro: minimaal 80 woorden (nu ${words(intro.join(' ')).length})`);
  const s = p.scan || {};
  need(filled(s.zoekterm) && filled(s.datum) && filled(s.samenvatting), 'scan: zoekterm, datum en samenvatting verplicht');
  const bedrijven = Array.isArray(s.bedrijven) ? s.bedrijven : [];
  need(bedrijven.length >= 3, 'scan: minimaal 3 bedrijven');
  need(bedrijven.every((b) => filled(b.naam) && Number.isFinite(b.reviews) && b.reviews >= 0), 'scan: elk bedrijf heeft een naam en een aantal reviews');
  need(Array.isArray(s.kansen) && s.kansen.length >= 1 && s.kansen.every(filled), 'scan: minimaal 1 gevulde kans');
  need(Array.isArray(p.wijken) && p.wijken.length >= 3 && p.wijken.every(filled), 'wijken: minimaal 3 gevulde wijken/kernen');
  need(Array.isArray(p.faq) && p.faq.length >= 3 && p.faq.every((f) => filled(f.vraag) && filled(f.antwoord)), 'faq: minimaal 3 gevulde vragen met antwoord');
  need(!p.beschikbaarheid || filled(p.beschikbaarheid), 'beschikbaarheid: vul in of laat leeg ("")');
  // Vangnet: nergens nog een placeholder
  need(!isPlaceholder(p), 'record bevat nog een [[INVULLEN]] of [[OPTIONEEL]]');
  return out;
}

const live = [];
const concept = [];
for (const [i, p] of paginas.entries()) {
  const label = `paginas[${i}] (${p.niche || '?'} × ${p.plaats || '?'})`;
  if (!['live', 'concept'].includes(p.status)) { errors.push(`${label}: status moet "live" of "concept" zijn`); continue; }
  const problems = validate(p);
  if (p.status === 'live') {
    if (problems.length) errors.push(`${label} staat op live maar is niet publiceerbaar:\n    - ${problems.join('\n    - ')}`);
    else live.push(p);
  } else {
    concept.push(p);
    if (problems.length) warnings.push(`${label} (concept) nog niet klaar: ${problems.length} punt(en) open`);
  }
}

// Uniciteit: slug, title, meta, h1 en intro tussen live-pagina's onderling
const seen = { slug: new Map(), title: new Map(), meta: new Map(), h1: new Map() };
const handwritten = fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))
  .map((f) => ({ f, s: fs.readFileSync(path.join(ROOT, f), 'utf8') }))
  .filter(({ s }) => !s.includes(GENERATOR_MARK));
for (const { f, s } of handwritten) {
  const t = (s.match(/<title>([^<]*)<\/title>/) || [])[1];
  if (t) seen.title.set(t.replace(/&amp;/g, '&'), f);
}
for (const p of live) {
  const { slug } = pageInfo(p);
  for (const k of ['slug', 'title', 'meta', 'h1']) {
    const v = k === 'slug' ? slug : p[k];
    if (seen[k].has(v)) errors.push(`${slug}: ${k} is niet uniek (ook gebruikt door ${seen[k].get(v)})`);
    seen[k].set(v, slug);
  }
  if (p.title.length > 60) warnings.push(`${slug}: title is ${p.title.length} tekens (advies ≤ 60)`);
  if (p.meta.length < 120 || p.meta.length > 160) warnings.push(`${slug}: meta is ${p.meta.length} tekens (advies 120–160)`);
}
for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
  const o = overlap(trigrams(live[i].intro.join(' ')), trigrams(live[j].intro.join(' ')));
  if (o > 0.3) errors.push(`${pageInfo(live[i]).slug} en ${pageInfo(live[j]).slug}: intro's lijken te veel op elkaar (${Math.round(o * 100)}% overlap)`);
}

// Bij validatiefouten niets schrijven: liever geen update dan een halve.
if (errors.length) {
  for (const w of warnings) console.warn(`! ${w}`);
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} fout(en). Er is niets geschreven. Los ze op en draai opnieuw.`);
  process.exit(1);
}

// ── 2. Pagina's renderen ───────────────────────────────────────────────────────
const partials = Object.fromEntries(['header', 'footer', 'scripts']
  .map((n) => [n, read(`templates/partials/${n}.html`).trimEnd()]));
const fillPartials = (src) => src.replace(/<!-- partial:(\w+) -->[\s\S]*?<!-- \/partial:\1 -->/g, (m, n) => {
  if (!partials[n]) { errors.push(`onbekende partial "${n}"`); return m; }
  return `<!-- partial:${n} -->\n${partials[n]}\n<!-- /partial:${n} -->`;
});
const template = fillPartials(read('templates/branche-plaats.html'));

// CSS inline in elke pagina: scheelt een render-blokkerend verzoek (sneller eerste beeld op mobiel).
// Een pagina mag <link rel="stylesheet" href="/assets/app.css"> bevatten; die wordt omgezet naar
// <!-- css:app --><style>…</style><!-- /css:app --> en bij elke run ververst. Draai dus eerst build:css.
const CSS_LINK = '<link rel="stylesheet" href="/assets/app.css">';
const appCss = read('assets/app.css').trim();
const inlineCss = (src) => src
  .replace(CSS_LINK, '<!-- css:app --><!-- /css:app -->')
  .replace(/<!-- css:app -->[\s\S]*?<!-- \/css:app -->/, () => `<!-- css:app --><style>${appCss}</style><!-- /css:app -->`);

function buildPage(p) {
  const info = pageInfo(p);
  const n = info.niche;
  const scan = p.scan || {};
  const wa = `Hoi Jeannot, ik ben ${n.enkelvoud} in ${p.plaats} en wil graag een gratis lokale scan.`;
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        '@id': `${info.canonical}#service`,
        name: p.h1,
        serviceType: `Website en lokale SEO voor ${n.meervoud}`,
        url: info.canonical,
        provider: { '@id': `${SITE}/#organization` },
        areaServed: { '@type': 'City', name: p.plaats },
        audience: { '@type': 'BusinessAudience', name: n.meervoud },
        offers: [{ '@id': `${SITE}/prijzen#website` }, { '@id': `${SITE}/prijzen#lokale-seo` }],
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: n.pijlerTitel, item: `${SITE}${n.pijlerUrl}` },
          { '@type': 'ListItem', position: 3, name: p.plaats, item: info.canonical },
        ],
      },
      {
        '@type': 'FAQPage',
        mainEntity: (p.faq || []).map((f) => ({ '@type': 'Question', name: f.vraag, acceptedAnswer: { '@type': 'Answer', text: f.antwoord } })),
      },
    ],
  };
  const vars = {
    title: p.title ?? '', meta: p.meta ?? '', h1: p.h1 ?? '', plaats: p.plaats ?? '',
    canonical: info.canonical,
    pijlerUrl: n.pijlerUrl, pijlerTitel: n.pijlerTitel, nicheMeervoud: n.meervoud,
    whatsappUrl: `https://wa.me/31162560125?text=${encodeURIComponent(wa)}`,
    jsonld: JSON.stringify(jsonld, null, 2).replace(/</g, '\\u003c'),
    beschikbaarheidHtml: p.beschikbaarheid
      ? `<span class="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-emerald-300"><span class="h-1.5 w-1.5 rounded-full bg-emerald-400"></span>${esc(p.beschikbaarheid)}</span>`
      : '',
    introHtml: (p.intro || []).map((t) => `<p>${esc(t)}</p>`).join('\n        '),
    scanZoekterm: scan.zoekterm ?? '', scanDatum: scan.datum ?? '', scanSamenvatting: scan.samenvatting ?? '',
    scanRijen: (scan.bedrijven || []).map((b, i) =>
      `<tr><td class="px-3 py-3 sm:px-5 text-slate-500">${i + 1}</td><td class="px-3 py-3 sm:px-5 font-medium text-white">${esc(b.naam)}</td><td class="px-3 py-3 sm:px-5 text-right">${esc(b.reviews)}</td><td class="px-3 py-3 sm:px-5 text-right">${b.score ? esc(String(b.score).replace('.', ',')) : '—'}</td></tr>`
    ).join('\n              '),
    kansenHtml: (scan.kansen || []).map((k) => `<li class="flex gap-3"><span class="text-emerald-400">+</span><span>${esc(k)}</span></li>`).join('\n            '),
    wijkenHtml: (p.wijken || []).map((w) => `<li class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">${esc(w)}</li>`).join('\n      '),
    faqHtml: (p.faq || []).map((f) =>
      `<div class="reveal rounded-2xl border border-white/5 bg-slate-900/40 p-6">\n        <h3 class="font-display text-lg font-semibold text-white">${esc(f.vraag)}</h3>\n        <p class="mt-2 text-slate-400">${esc(f.antwoord)}</p>\n      </div>`
    ).join('\n      '),
  };
  return render(template, vars);
}

const liveFiles = new Set();
for (const p of live) {
  const info = pageInfo(p);
  liveFiles.add(info.file);
  write(info.file, inlineCss(buildPage(p)));
  console.log(`✓ ${info.url}`);
}
if (PREVIEW) {
  for (const p of concept) {
    if (!niches[p.niche]) continue;
    const info = pageInfo(p);
    write(path.join('_preview', info.file), inlineCss(buildPage(p)).replace('<head>', '<head>\n<meta name="robots" content="noindex">'));
    console.log(`◌ concept → _preview/${info.file}`);
  }
}

// Oude gegenereerde pagina's opruimen (alleen bestanden met de generator-markering)
for (const f of fs.readdirSync(ROOT).filter((f) => f.endsWith('.html'))) {
  if (liveFiles.has(f)) continue;
  if (fs.readFileSync(path.join(ROOT, f), 'utf8').includes(GENERATOR_MARK)) {
    if (!CHECK) fs.unlinkSync(path.join(ROOT, f));
    console.log(`✗ verwijderd (niet meer live): /${f.replace(/\.html$/, '')}`);
  }
}

// ── 3. Pijlerpagina's: lijst met plaatspagina's ─────────────────────────────
for (const [key, n] of Object.entries(niches)) {
  if (!fs.existsSync(path.join(ROOT, n.pijlerBestand))) { errors.push(`niche ${key}: pijlerbestand ${n.pijlerBestand} bestaat niet`); continue; }
  const items = live.filter((p) => p.niche === key).sort((a, b) => a.plaats.localeCompare(b.plaats, 'nl'));
  const block = items.length ? `
<!-- ================= PLAATSEN (gegenereerd) ================= -->
<section id="plaatsen" class="relative py-20 sm:py-24">
  <div class="absolute inset-x-0 top-0 h-px hairline"></div>
  <div class="mx-auto max-w-7xl px-6">
    <div class="mx-auto max-w-2xl text-center">
      <span class="reveal text-sm font-semibold uppercase tracking-[0.18em] text-electric-400">Per plaats</span>
      <h2 class="reveal mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">${esc(n.pijlerTitel)} per plaats</h2>
    </div>
    <ul class="reveal mt-10 flex flex-wrap justify-center gap-3">
${items.map((p) => `      <li><a href="${pageInfo(p).url}" class="inline-block rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-electric-500/40 hover:text-white">${esc(p.plaats)}</a></li>`).join('\n')}
    </ul>
  </div>
</section>
` : '';
  const src = read(n.pijlerBestand);
  const out = replaceBetween(src, '<!-- PLAATSEN:START -->', '<!-- PLAATSEN:END -->', block, n.pijlerBestand);
  if (out !== src) write(n.pijlerBestand, out);
}

// ── 4. Partials en inline CSS in alle pagina's ─────────────────────────────────
const pageFiles = [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
  ...fs.readdirSync(path.join(ROOT, 'kennis')).filter((f) => f.endsWith('.html')).map((f) => `kennis/${f}`),
];
let synced = 0;
for (const f of pageFiles) {
  const src = read(f);
  const out = inlineCss(src.includes('<!-- partial:') ? fillPartials(src) : src);
  if (out !== src) { write(f, out); synced++; }
}
if (synced) console.log(`↻ gedeelde blokken / inline CSS bijgewerkt in ${synced} pagina('s)`);

// ── 5. Sitemap ──────────────────────────────────────────────────────────────
const today = new Date().toISOString().slice(0, 10);
const sitemapEntries = live.map((p) => pageInfo(p)).sort((a, b) => a.url.localeCompare(b.url)).map((i) =>
  `\n  <url>\n    <loc>${i.canonical}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`
).join('');
const sm = read('sitemap.xml');
const oldBlock = (sm.match(/<!-- GENERATED:START -->([\s\S]*?)<!-- GENERATED:END -->/) || [])[1] ?? null;
// lastmod alleen verversen als de lijst met URL's verandert, anders blijft de sitemap stabiel in git
const strip = (s) => (s || '').replace(/<lastmod>[^<]*<\/lastmod>/g, '');
if (oldBlock === null) errors.push('sitemap.xml: markers <!-- GENERATED:START/END --> niet gevonden');
else if (strip(oldBlock) !== strip(sitemapEntries + '\n  ')) {
  write('sitemap.xml', replaceBetween(sm, '<!-- GENERATED:START -->', '<!-- GENERATED:END -->', sitemapEntries + '\n  ', 'sitemap.xml'));
  console.log('↻ sitemap.xml bijgewerkt');
}

// ── Verslag ───────────────────────────────────────────────────────────────────
console.log(`\n${live.length} live, ${concept.length} concept${CHECK ? ' (check: niets geschreven)' : ''}`);
for (const w of warnings) console.warn(`! ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} fout(en). Los ze op en draai opnieuw.`);
  process.exit(1);
}
