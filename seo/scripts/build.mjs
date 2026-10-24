#!/usr/bin/env node
/* ===========================================================================
   Stam Core — SEO-generator (geen dependencies; Netlify bouwt niets, dus lokaal draaien en committen)

   1. Stadspagina's uit seo/cities/*.json + seo/templates/city.html
        status "live"    → /website-{niche}-{stad}.html  (alleen met een echte scan in seo/scans/)
        status "concept" → _preview/ (noindex; zonder scan met gemarkeerde voorbeelddata)
   2. SEO-pijler /seo-{niche} uit seo/templates/seo-pijler.html (prijzen uit config)
   3. Kennisartikelen uit seo/articles/*.md → /kennis/{slug}.html (concept → _preview/kennis/)
   4. Blokken "Per stad" en "Kennis" op de pijler bijwerken (markers PLAATSEN / KENNIS)
   5. Header/footer/scripts uit templates/partials/ en inline CSS in alle pagina's
   Daarna: npm run seo:check en npm run seo:sitemap (of in één keer: npm run seo:all).
=========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT, GENERATOR_MARK, PREVIEW_DIR, config, SITE, read, exists, esc, slugify, asParagraphs, euro, datumLeesbaar, today,
  TOKENS, fillTokens, render, loadNiches, loadCities, loadArticles, cityInfo, isExcluded, parseScan, analyseScan,
} from './lib.mjs';

const errors = [];
const written = new Set();
const write = (p, s) => {
  fs.mkdirSync(path.dirname(path.join(ROOT, p)), { recursive: true });
  fs.writeFileSync(path.join(ROOT, p), s);
  written.add(p.replace(/\\/g, '/'));
};

const niches = loadNiches();
const cities = loadCities();
const articles = loadArticles();
const P = config.prijzen;
const OG = `${SITE}/img/og-default.jpg`;
const waUrl = (text) => `https://wa.me/${config.bedrijf.whatsapp}?text=${encodeURIComponent(text)}`;
const jsonldStr = (o) => JSON.stringify(o, null, 2).replace(/</g, '\\u003c');
const noindex = '<meta name="robots" content="noindex">';
const voorbeeldBanner = '<div class="fixed inset-x-0 bottom-0 z-[60] bg-amber-400 px-4 py-2 text-center text-sm font-semibold text-slate-950">VOORBEELDDATA: de Maps-scan op deze pagina is geen echte meting. Niet publiceren.</div>';

const sharedVars = {
  prijsWebsite: euro(P.website.eenmalig),
  prijsWebsiteJaar: euro(P.website.perJaar),
  prijsSeo: euro(P.lokaleSeo.perMaand),
  seoPaginas: P.lokaleSeo.paginasPerMaand,
  seoPaginasHoofdletter: P.lokaleSeo.paginasPerMaand.replace(/^./, (c) => c.toUpperCase()),
  seoVoorwaarden: `na ${P.lokaleSeo.minimaalMaanden} maanden maandelijks opzegbaar · ${P.btw}`,
  seoVoorwaardenLang: `Minimaal ${TOKENS.seo_min_maanden} maanden, daarna maandelijks opzegbaar met ${TOKENS.seo_opzegtermijn} opzegtermijn. ${P.btw.replace(/^./, (c) => c.toUpperCase())}.`,
  btw: P.btw,
  caseNaam: config.case.naam,
  caseUrl: config.case.url,
  caseSamenvatting: config.case.samenvatting,
  caseLighthouseHtml: config.case.lighthouse.map((l, i, a) =>
    `<div class="rounded-lg border ${i === a.length - 1 ? 'border-electric-500/20 bg-electric-500/10' : 'border-white/5 bg-white/5'} px-4 py-3"><p class="font-display text-2xl font-bold text-white">${esc(l.waarde)}</p><p class="text-xs text-slate-400">${esc(l.label)}</p></div>`).join('\n            '),
  ogImage: OG,
};

const offers = [
  { '@type': 'Offer', name: 'Website', price: String(P.website.eenmalig), priceCurrency: 'EUR', url: `${SITE}/prijzen`,
    description: `Eenmalig, plus ${euro(P.website.perJaar)} per jaar voor hosting en onderhoud. ${P.btw}.` },
  { '@type': 'Offer', name: 'Lokale SEO', price: String(P.lokaleSeo.perMaand), priceCurrency: 'EUR', url: `${SITE}/prijzen`,
    priceSpecification: { '@type': 'UnitPriceSpecification', price: String(P.lokaleSeo.perMaand), priceCurrency: 'EUR', unitText: 'maand', valueAddedTaxIncluded: false },
    description: sharedVars.seoVoorwaardenLang },
];
const breadcrumb = (items) => ({
  '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item })),
});
const faqPage = (faq) => ({ '@type': 'FAQPage', mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.vraag, acceptedAnswer: { '@type': 'Answer', text: f.antwoord } })) });
const faqItemHtml = (f) => `<div class="reveal rounded-2xl border border-white/5 bg-slate-900/40 p-6">
        <h3 class="font-display text-lg font-semibold text-white">${esc(f.vraag)}</h3>
        <p class="mt-2 text-slate-400">${esc(f.antwoord)}</p>
      </div>`;
const resolvePool = (niche, refs) => refs.map((r) => {
  const key = typeof r === 'string' ? r : r.ref;
  const f = niche.faq_pool[key];
  if (!f) { errors.push(`faq_pool: onbekende sleutel "${key}" in niche ${niche.key}`); return null; }
  return { vraag: fillTokens(f.vraag), antwoord: fillTokens(f.antwoord) };
}).filter(Boolean);

const pillCls = 'inline-block rounded-full border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-slate-200 transition hover:border-electric-500/40 hover:text-white';

// ── 1. Steden valideren ─────────────────────────────────────────────────────
const SCAN_COLS = ['datum', 'stad', 'zoekterm', 'positie', 'reviews', 'score', 'eigen_website', 'plaatspaginas', 'reageert_op_reviews', 'fotos'];
const REQUIRED = ['stad', 'slug', 'niche', 'status', 'title', 'meta', 'h1', 'intro', 'wijken', 'wijken_tekst', 'kenmerken', 'faq_stad', 'faq_pool', 'cta_tekst', 'nabije_steden', 'scan', 'bronnen'];
const live = [];
const concept = [];
for (const c of cities) {
  const label = c._file;
  const missing = REQUIRED.filter((k) => c[k] == null || c[k] === '' || (Array.isArray(c[k]) && !c[k].length));
  if (missing.length) { errors.push(`${label}: verplichte velden leeg: ${missing.join(', ')}`); continue; }
  const niche = niches[c.niche];
  if (!niche) { errors.push(`${label}: onbekende niche "${c.niche}"`); continue; }
  if (isExcluded(c.stad)) { errors.push(`${label}: ${c.stad} staat in de uitsluitlijst (config.json → uitgesloten)`); continue; }
  if (!['live', 'concept'].includes(c.status)) { errors.push(`${label}: status moet "live" of "concept" zijn`); continue; }
  const scanPath = `seo/${c.scan}`;
  const hasScan = exists(scanPath);
  if (c.status === 'live' && !hasScan) { errors.push(`${label}: staat op live maar ${scanPath} ontbreekt. Zet hem in QUEUE.md op wacht-op-scan.`); continue; }
  const rows = parseScan(hasScan ? scanPath : 'seo/scans/_voorbeeld.csv');
  if (rows.length < 3) errors.push(`${scanPath}: minimaal 3 rijen (top 3) nodig, nu ${rows.length}`);
  const missingCols = SCAN_COLS.filter((k) => !(k in (rows[0] || {})));
  if (missingCols.length) { errors.push(`${scanPath}: kolommen ontbreken: ${missingCols.join(', ')} (zie scans/_TEMPLATE.csv)`); continue; }
  const rec = { c, niche, info: cityInfo(c, niche), scan: analyseScan(rows, c.stad), voorbeeld: !hasScan };
  if (rec.voorbeeld) rec.scan.zoekterm = fillTokens(niche.zoekterm, { stad: c.stad.toLowerCase() });
  (c.status === 'live' ? live : concept).push(rec);
}
// Live zonder publicatiedatum: vandaag invullen in de JSON.
for (const { c } of live) {
  if (!c.gepubliceerd) {
    const { _file, ...data } = c;
    data.gepubliceerd = today(); data.gewijzigd = data.gewijzigd || today();
    fs.writeFileSync(path.join(ROOT, _file), JSON.stringify(data, null, 2) + '\n');
    c.gepubliceerd = data.gepubliceerd; c.gewijzigd = data.gewijzigd;
    console.log(`  ${_file}: gepubliceerd = ${c.gepubliceerd}`);
  }
}

const liveArticles = articles.filter((a) => a.status === 'live');
const conceptArticles = articles.filter((a) => a.status !== 'live');

if (errors.length) bail();

// ── 2. Stadspagina's renderen ───────────────────────────────────────────────
const partials = Object.fromEntries(['header', 'footer', 'scripts'].map((n) => [n, read(`templates/partials/${n}.html`).trimEnd()]));
const fillPartials = (src) => src.replace(/<!-- partial:(\w+) -->[\s\S]*?<!-- \/partial:\1 -->/g, (m, n) => {
  if (!partials[n]) { errors.push(`onbekende partial "${n}"`); return m; }
  return `<!-- partial:${n} -->\n${partials[n]}\n<!-- /partial:${n} -->`;
});
const CSS_LINK = '<link rel="stylesheet" href="/assets/app.css">';
const appCss = read('assets/app.css').trim();
const inlineCss = (src) => src
  .replace(CSS_LINK, '<!-- css:app --><!-- /css:app -->')
  .replace(/<!-- css:app -->[\s\S]*?<!-- \/css:app -->/, () => `<!-- css:app --><style>${appCss}</style><!-- /css:app -->`);
const finish = (html) => inlineCss(fillPartials(html));

const cityTpl = read('seo/templates/city.html');
const ps = (arr, cls = '') => asParagraphs(arr).map((t) => `<p${cls ? ` class="${cls}"` : ''}>${esc(fillTokens(t))}</p>`).join('\n        ');

function buildCity({ c, niche, info, scan, voorbeeld }, isPreview) {
  const faqStad = c.faq_stad.map((f) => ({ vraag: f.vraag, antwoord: fillTokens(f.antwoord) }));
  const faqPool = resolvePool(niche, c.faq_pool);
  const liveSlugs = new Map(live.filter((r) => r.c.niche === c.niche && r.c.slug !== c.slug).map((r) => [slugify(r.c.slug), r]));
  const andere = [...c.nabije_steden.map(slugify).filter((s) => liveSlugs.has(s)), ...liveSlugs.keys()]
    .filter((s, i, a) => a.indexOf(s) === i).slice(0, 4).map((s) => liveSlugs.get(s));
  const t = scan.tellingen;
  const tegel = (waarde, label) => `<div class="rounded-2xl border border-white/10 bg-slate-950/60 p-5"><p class="font-display text-3xl font-bold text-white">${esc(waarde)}</p><p class="mt-1 text-xs text-slate-400">${esc(label)}</p></div>`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Service', '@id': `${info.canonical}#service`, name: c.h1, serviceType: niche.serviceType, url: info.canonical,
      provider: { '@id': `${SITE}/#organization` }, areaServed: { '@type': 'City', name: c.stad },
      audience: { '@type': 'BusinessAudience', name: niche.meervoud }, offers },
    breadcrumb([['Home', `${SITE}/`], [niche.pijlerTitel, `${SITE}${niche.pijlerUrl}`], [c.stad, info.canonical]]),
    faqPage([...faqStad, ...faqPool]),
  ] };
  return finish(render(cityTpl, {
    ...sharedVars,
    slug: c.slug, title: c.title, meta: c.meta, h1: c.h1, stad: c.stad, canonical: info.canonical,
    robotsMeta: isPreview ? noindex : '',
    voorbeeldBanner: voorbeeld ? voorbeeldBanner : '',
    pijlerUrl: niche.pijlerUrl, pijlerTitel: niche.pijlerTitel, seoPijlerUrl: niche.seoPijlerUrl, nicheMeervoud: niche.meervoud,
    whatsappUrl: waUrl(`Hoi Jeannot, ik ben ${niche.enkelvoud} in ${c.stad} en wil graag een gratis Maps-scan.`),
    jsonld: jsonldStr(jsonld),
    introHtml: ps(c.intro),
    scanSamenvatting: scan.samenvatting,
    scanDatum: datumLeesbaar(scan.datum),
    scanZoekterm: scan.zoekterm,
    scanTegelsHtml: [
      tegel(scan.gemReviews, 'gemiddeld aantal reviews top 3'),
      tegel(scan.gemScore ?? '—', 'gemiddelde score'),
      tegel(`${t.website}/${scan.n}`, 'met eigen website'),
      tegel(`${t.plaats}/${scan.n}`, "met pagina's per wijk of kern"),
      tegel(`${t.reageert}/${scan.n}`, 'reageert op reviews'),
      tegel(scan.gemFotos, "gemiddeld aantal foto's"),
    ].join('\n          '),
    kansenHtml: scan.kansen.map((k) => `<li class="flex gap-3"><span class="text-emerald-400">+</span><span>${esc(k)}</span></li>`).join('\n            '),
    wijkenHtml: c.wijken.map((w) => `<li class="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-200">${esc(w)}</li>`).join('\n      '),
    wijkenTekstHtml: ps(c.wijken_tekst),
    kenmerkenHtml: ps(c.kenmerken),
    systeemHtml: niche.systeem.map((s, i) => `<li class="reveal rounded-3xl border ${i === niche.systeem.length - 1 ? 'border-emerald-400/20' : 'border-white/5'} card-sheen p-8">
        <span class="font-display text-4xl font-bold ${i === niche.systeem.length - 1 ? 'text-emerald-400/40' : 'text-electric-500/40'}">0${i + 1}</span>
        <h3 class="mt-4 font-display text-xl font-bold text-white">${esc(s.titel)}</h3>
        <p class="mt-3 text-slate-400">${esc(fillTokens(s.tekst, { stad: c.stad }))}</p>
      </li>`).join('\n      '),
    faqStadHtml: faqStad.map(faqItemHtml).join('\n      '),
    faqPoolHtml: faqPool.map(faqItemHtml).join('\n      '),
    ctaTekst: fillTokens(c.cta_tekst),
    andereStedenHtml: andere.length
      ? `<p class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Ook bekeken</p>
    <ul class="mt-5 flex flex-wrap justify-center gap-3">
      ${andere.map((r) => `<li><a href="${r.info.url}" class="${pillCls}">${esc(niche.enkelvoud.replace(/^./, (x) => x.toUpperCase()))} in ${esc(r.c.stad)}</a></li>`).join('\n      ')}
    </ul>`
      : `<p class="text-slate-400">Meer steden volgen. Intussen staat de hele aanpak op <a href="${niche.pijlerUrl}" class="font-semibold text-electric-400 transition hover:text-white">${esc(niche.pijlerTitel.toLowerCase())}</a>.</p>`,
  }));
}

for (const r of live) { write(r.info.file, buildCity(r, false)); console.log(`✓ ${r.info.url}`); }
fs.rmSync(path.join(ROOT, PREVIEW_DIR), { recursive: true, force: true });
for (const r of concept) {
  write(`${PREVIEW_DIR}/${r.info.file}`, buildCity(r, true));
  console.log(`◌ concept → ${PREVIEW_DIR}/${r.info.file}${r.voorbeeld ? '  (VOORBEELDDATA: scan ontbreekt)' : ''}`);
}

// ── 3. Kennisartikelen ────────────────────────────────────────────────────────
function mdInline(s) {
  return esc(s)
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="text-white">$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" class="font-semibold text-electric-400 underline-offset-4 hover:underline">$1</a>');
}
function markdown(md) {
  const out = []; let list = null;
  const close = () => { if (list) { out.push(`</${list}>`); list = null; } };
  for (const block of fillTokens(md).split(/\r?\n\s*\r?\n/)) {
    const lines = block.split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) continue;
    const h = lines[0].match(/^(#{2,3})\s+(.*)$/);
    if (h && lines.length === 1) {
      close();
      out.push(h[1] === '##'
        ? `<h2 class="pt-6 font-display text-2xl font-bold tracking-tight text-white sm:text-3xl">${mdInline(h[2])}</h2>`
        : `<h3 class="pt-2 font-display text-xl font-semibold text-white">${mdInline(h[2])}</h3>`);
      continue;
    }
    if (lines.every((l) => /^\s*([-*]|\d+\.)\s+/.test(l))) {
      const tag = /^\s*\d+\./.test(lines[0]) ? 'ol' : 'ul';
      close();
      out.push(tag === 'ol' ? '<ol class="list-decimal space-y-2 pl-6 marker:font-semibold marker:text-electric-400">' : '<ul class="space-y-2">');
      list = tag;
      for (const l of lines) {
        const txt = l.replace(/^\s*([-*]|\d+\.)\s+/, '');
        const box = txt.match(/^\[( |x)\]\s+(.*)$/);
        out.push(tag === 'ol' ? `<li>${mdInline(txt)}</li>`
          : `<li class="flex gap-3"><span class="text-emerald-400">${box ? '&#9744;' : '&check;'}</span><span>${mdInline(box ? box[2] : txt)}</span></li>`);
      }
      close();
      continue;
    }
    close();
    out.push(`<p>${mdInline(lines.join(' '))}</p>`);
  }
  close();
  return out.join('\n      ');
}

const articleTpl = read('seo/templates/article.html');
const glazen = niches.glazenwasser;
function buildArticle(a, isPreview) {
  const faq = Array.isArray(a.faq) ? a.faq.map((f) => ({ vraag: f.vraag, antwoord: fillTokens(f.antwoord) })) : [];
  const rel = (a.gerelateerd || []).map((s) => liveArticles.find((x) => x.slug === s)).filter(Boolean).slice(0, 2);
  const graph = [
    { '@type': 'Article', '@id': `${a.canonical}#article`, headline: a.h1, description: a.meta, url: a.canonical, inLanguage: 'nl-NL',
      datePublished: a.datePublished, dateModified: a.dateModified || a.datePublished, image: OG,
      author: { '@type': 'Person', name: config.bedrijf.eigenaar }, publisher: { '@id': `${SITE}/#organization` },
      mainEntityOfPage: a.canonical },
    breadcrumb([['Home', `${SITE}/`], [glazen.pijlerTitel, `${SITE}${glazen.pijlerUrl}`], [a.h1, a.canonical]]),
  ];
  if (faq.length) graph.push(faqPage(faq));
  return finish(render(articleTpl, {
    ...sharedVars,
    slug: a.slug, title: a.title, meta: a.meta, h1: a.h1, canonical: a.canonical,
    robotsMeta: isPreview ? noindex : '',
    jsonld: jsonldStr({ '@context': 'https://schema.org', '@graph': graph }),
    pijlerUrl: glazen.pijlerUrl, pijlerTitel: glazen.pijlerTitel, seoPijlerUrl: glazen.seoPijlerUrl, seoPijlerTitel: glazen.seoPijlerTitel,
    auteur: config.bedrijf.eigenaar, dateModified: a.dateModified || a.datePublished, datumLeesbaar: datumLeesbaar(a.dateModified || a.datePublished),
    bodyHtml: markdown(a.body),
    faqHtml: faq.length ? `<section class="relative py-16">
  <div class="absolute inset-x-0 top-0 h-px hairline"></div>
  <div class="mx-auto max-w-3xl px-6">
    <h2 class="font-display text-3xl font-bold tracking-tight text-white">Veelgestelde vragen</h2>
    <div class="mt-8 space-y-4">
      ${faq.map(faqItemHtml).join('\n      ')}
    </div>
  </div>
</section>` : '',
    gerelateerdHtml: rel.length ? `<div class="mt-10">
      <p class="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">Lees ook</p>
      <ul class="mt-4 space-y-2">${rel.map((r) => `<li><a href="${r.url}" class="font-semibold text-electric-400 transition hover:text-white">${esc(r.h1)} &rarr;</a></li>`).join('')}</ul>
    </div>` : '',
  }));
}
for (const a of liveArticles) { write(a.file, buildArticle(a, false)); console.log(`✓ ${a.url}`); }
for (const a of conceptArticles) { write(`${PREVIEW_DIR}/${a.file}`, buildArticle(a, true)); console.log(`◌ concept → ${PREVIEW_DIR}/${a.file}`); }

const kennisList = (niche) => liveArticles.length ? `
<!-- ================= KENNIS (gegenereerd) ================= -->
<section id="kennis" class="relative py-20 sm:py-24">
  <div class="absolute inset-x-0 top-0 h-px hairline"></div>
  <div class="mx-auto max-w-3xl px-6">
    <span class="reveal text-sm font-semibold uppercase tracking-[0.18em] text-electric-400">Kennis</span>
    <h2 class="reveal mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Kennis voor ${esc(niche.meervoud)}</h2>
    <ul class="reveal mt-8 space-y-3">
${liveArticles.map((a) => `      <li><a href="${a.url}" class="flex items-center justify-between gap-4 rounded-xl border border-white/5 bg-slate-900/40 px-5 py-4 text-slate-200 transition hover:border-electric-500/40 hover:text-white"><span>${esc(a.h1)}</span><span class="text-electric-400">&rarr;</span></a></li>`).join('\n')}
    </ul>
  </div>
</section>
` : '';

// ── 4. SEO-pijler ───────────────────────────────────────────────────────────
const seoTpl = read('seo/templates/seo-pijler.html');
for (const niche of Object.values(niches)) {
  if (!niche.seo_pijler_faq) continue;
  const canonical = `${SITE}${niche.seoPijlerUrl}`;
  const faq = niche.seo_pijler_faq.map((f) => (f.ref ? resolvePool(niche, [f.ref])[0] : { vraag: f.vraag, antwoord: fillTokens(f.antwoord) })).filter(Boolean);
  const title = `${niche.seoPijlerTitel} | Stam Core`;
  const meta = `Gevonden worden per plaats en in Google Maps, uitgelegd door een glazenwasser. Reviews, Bedrijfsprofiel en pagina's per wijk. ${euro(P.lokaleSeo.perMaand)} per maand.`;
  const jsonld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'Service', '@id': `${canonical}#service`, name: niche.seoPijlerTitel, serviceType: niche.serviceType, url: canonical,
      provider: { '@id': `${SITE}/#organization` }, areaServed: { '@type': 'Country', name: 'Nederland' },
      audience: { '@type': 'BusinessAudience', name: niche.meervoud }, offers },
    breadcrumb([['Home', `${SITE}/`], [niche.pijlerTitel, `${SITE}${niche.pijlerUrl}`], ['Lokale SEO', canonical]]),
    faqPage(faq),
  ] };
  const file = `${niche.seoPijlerUrl.replace(/^\//, '')}.html`;
  write(file, finish(render(seoTpl, {
    ...sharedVars, title, meta, h1: 'Gevonden worden in de wijken waar je al rijdt', canonical,
    pijlerUrl: niche.pijlerUrl, pijlerTitel: niche.pijlerTitel,
    whatsappUrl: waUrl(`Hoi Jeannot, ik ben ${niche.enkelvoud} en wil graag een gratis Maps-scan van mijn plaats.`),
    jsonld: jsonldStr(jsonld),
    faqHtml: faq.map(faqItemHtml).join('\n      '),
    kennisHtml: kennisList(niche),
  })));
  console.log(`✓ ${niche.seoPijlerUrl}`);
}

// ── 5. Oude gegenereerde pagina's opruimen ───────────────────────────────────
const generatedFiles = [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
  ...(exists('kennis') ? fs.readdirSync(path.join(ROOT, 'kennis')).filter((f) => f.endsWith('.html')).map((f) => `kennis/${f}`) : []),
];
for (const f of generatedFiles) {
  if (written.has(f)) continue;
  const s = read(f);
  if (s.includes(GENERATOR_MARK) || s.includes('<meta name="generator" content="stamcore-generate">')) {
    fs.unlinkSync(path.join(ROOT, f));
    console.log(`✗ verwijderd (niet meer live): /${f.replace(/\.html$/, '')}  → zet een 301 in _redirects als hij al geïndexeerd was`);
  }
}

// ── 6. Pijlers: "Per stad" en "Kennis" ────────────────────────────────────────
function replaceBetween(src, start, end, content, file) {
  const a = src.indexOf(start), b = src.indexOf(end);
  if (a < 0 || b < a) { errors.push(`${file}: markers ${start} … ${end} niet gevonden`); return src; }
  return src.slice(0, a + start.length) + content + src.slice(b);
}
for (const [key, niche] of Object.entries(niches)) {
  if (!exists(niche.pijlerBestand)) { errors.push(`niche ${key}: ${niche.pijlerBestand} bestaat niet`); continue; }
  const items = live.filter((r) => r.c.niche === key).sort((a, b) => a.c.stad.localeCompare(b.c.stad, 'nl'));
  const plaatsen = items.length ? `
<!-- ================= PER STAD (gegenereerd) ================= -->
<section id="plaatsen" class="relative py-20 sm:py-24">
  <div class="absolute inset-x-0 top-0 h-px hairline"></div>
  <div class="mx-auto max-w-7xl px-6">
    <div class="mx-auto max-w-2xl text-center">
      <span class="reveal text-sm font-semibold uppercase tracking-[0.18em] text-electric-400">Per stad</span>
      <h2 class="reveal mt-4 font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Zo staan ${esc(niche.meervoud)} ervoor, per stad</h2>
    </div>
    <ul class="reveal mt-10 flex flex-wrap justify-center gap-3">
${items.map((r) => `      <li><a href="${r.info.url}" class="${pillCls}">${esc(r.c.stad)}</a></li>`).join('\n')}
    </ul>
  </div>
</section>
` : '';
  let src = read(niche.pijlerBestand);
  let out = replaceBetween(src, '<!-- PLAATSEN:START -->', '<!-- PLAATSEN:END -->', plaatsen, niche.pijlerBestand);
  out = replaceBetween(out, '<!-- KENNIS:START -->', '<!-- KENNIS:END -->', kennisList(niche), niche.pijlerBestand);
  if (out !== src) write(niche.pijlerBestand, out);
}

// ── 7. Partials en inline CSS in alle pagina's ────────────────────────────────
let synced = 0;
const allPages = [
  ...fs.readdirSync(ROOT).filter((f) => f.endsWith('.html')),
  ...(exists('kennis') ? fs.readdirSync(path.join(ROOT, 'kennis')).filter((f) => f.endsWith('.html')).map((f) => `kennis/${f}`) : []),
];
for (const f of allPages) {
  const src = read(f);
  const out = inlineCss(src.includes('<!-- partial:') ? fillPartials(src) : src);
  if (out !== src) { fs.writeFileSync(path.join(ROOT, f), out); synced++; }
}
if (synced) console.log(`↻ gedeelde blokken / inline CSS bijgewerkt in ${synced} pagina('s)`);

console.log(`\nSteden: ${live.length} live, ${concept.length} concept · Artikelen: ${liveArticles.length} live, ${conceptArticles.length} concept`);
if (errors.length) bail();

function bail() {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} fout(en). Los ze op en draai opnieuw.`);
  process.exit(1);
}
