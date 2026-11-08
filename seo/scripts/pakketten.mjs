/* ===========================================================================
   Pakketten (Start / Groei / Top) en alle prijsblokken van de site, uit seo/config.json.
   Elk blok is een partial: zet <!-- partial:naam --><!-- /partial:naam --> op een pagina of in
   een template en `npm run seo:all` vult hem. Zo staat er nergens een bedrag met de hand.

   Partials:
     pakketkaarten   /prijzen: zin boven de kaarten, drie kaarten, jaarkorting en looptijden,
                     "Binnenkort", vergelijkingstabel
     pakketcompact   compacte kaarten (naam, prijs, 3 punten) + knop naar /prijzen (home, pijlers)
     pakketregel     één regel "Start … · Groei … · Top …, website … eenmalig" + link
     pakketstats     drie tegels in de hero van de homepage
     prijzenfaq      FAQ-blokken van /prijzen
     prijzenschema   JSON-LD van /prijzen (OfferCatalog + FAQPage + BreadcrumbList)
     prijzenmeta     meta description + OG/Twitter-teksten van /prijzen
=========================================================================== */
import { config, SITE, esc, euro, fillTokens } from './lib.mjs';

const P = config.prijzen;
const BTW = P.btw;
const Btw = BTW.replace(/^./, (c) => c.toUpperCase());
const pakketten = P.pakketten;
const byId = Object.fromEntries(pakketten.map((k) => [k.id, k]));
const groei = byId.groei;
const aanrader = pakketten.find((k) => k.aanrader);

/** Tekst uit config met {website_eenmalig} en {paginas_pm} ingevuld voor dit pakket. */
const tekst = (s, k) => fillTokens(String(s), { paginas_pm: k?.paginas_pm != null ? String(k.paginas_pm) : '' });
const pm = (k) => euro(k.prijs_pm);

/** Alle bedragen die op de site mogen staan (voor seo:check). */
export const TOEGESTANE_BEDRAGEN = [...new Set([P.website_eenmalig, P.jaarkorting_groei, ...pakketten.map((k) => k.prijs_pm)])];

// ── Bouwstenen ──────────────────────────────────────────────────────────────
const check = '<span class="text-emerald-400" aria-hidden="true">&check;</span>';
const badge = '<span class="absolute -top-3 left-6 rounded-full bg-electric-500 px-3 py-1 text-xs font-bold uppercase tracking-[0.15em] text-white">Aanrader</span>';
// Op mobiel staat de aanrader bovenaan (order-first), vanaf lg in de normale volgorde.
const order = (k) => (k.aanrader ? 'order-first lg:order-none' : '');
const kaartKlasse = (k) => (k.aanrader
  ? 'relative flex flex-col rounded-3xl border border-electric-500/50 bg-gradient-to-b from-electric-500/15 to-emerald-500/5 p-8'
  : 'relative flex flex-col rounded-3xl border border-white/10 card-sheen p-8');

function prijsRegel(k, groot = true) {
  return `<p class="mt-4 font-display ${groot ? 'text-5xl' : 'text-4xl'} font-bold text-white">${pm(k)}<span class="text-lg font-semibold text-slate-400"> per maand</span></p>`;
}

// ── /prijzen ────────────────────────────────────────────────────────────────
function kaartVol(k) {
  return `<div class="reveal ${kaartKlasse(k)} ${order(k)}">
        ${k.aanrader ? badge : ''}
        <h2 class="font-display text-2xl font-bold text-white">${esc(k.naam)}</h2>
        ${prijsRegel(k)}
        <p class="mt-2 text-sm text-slate-400">${esc(k.looptijd)}</p>
        <ul class="mt-6 flex-1 space-y-3 text-slate-200">
          ${k.inhoud.map((i) => `<li class="flex gap-3">${check}<span>${esc(tekst(i, k))}</span></li>`).join('\n          ')}
        </ul>
        <a href="/#contact" class="mt-8 inline-flex items-center justify-center rounded-xl ${k.aanrader ? 'bg-electric-500 text-white shadow-lg shadow-electric-500/25 hover:bg-electric-400' : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'} px-6 py-3 text-sm font-semibold transition">Kies ${esc(k.naam)}</a>
      </div>`;
}

function cel(waarde, k) {
  if (waarde === true) return `<span class="text-emerald-400" aria-label="ja">&check;</span>`;
  if (waarde === false || waarde == null) return `<span class="text-slate-600" aria-label="nee">&ndash;</span>`;
  return esc(tekst(waarde, k));
}

function vergelijking() {
  const head = pakketten.map((k) => `<th scope="col" class="px-4 py-3 text-center font-display font-semibold ${k.aanrader ? 'text-electric-400' : 'text-white'}">${esc(k.naam)}</th>`).join('');
  const rows = P.vergelijking.map((r) => `<tr class="border-t border-white/5"><th scope="row" class="px-4 py-3 text-left font-normal text-slate-300">${esc(tekst(r.onderdeel))}</th>${pakketten.map((k) => `<td class="px-4 py-3 text-center text-slate-200">${cel(r[k.id], k)}</td>`).join('')}</tr>`);
  rows.push(`<tr class="border-t border-white/5"><th scope="row" class="px-4 py-3 text-left font-normal text-slate-300">Looptijd</th>${pakketten.map((k) => `<td class="px-4 py-3 text-center text-xs text-slate-400">${esc(k.looptijd)}</td>`).join('')}</tr>`);
  rows.push(`<tr class="border-t border-white/10"><th scope="row" class="px-4 py-3 text-left font-semibold text-white">Per maand</th>${pakketten.map((k) => `<td class="px-4 py-3 text-center font-display text-lg font-bold text-white">${pm(k)}${k.id === 'groei' ? `<span class="block text-xs font-normal text-slate-400">${euro(P.jaarkorting_groei)} bij een jaar</span>` : ''}</td>`).join('')}</tr>`);
  return `<div class="reveal mt-16">
      <h2 class="font-display text-2xl font-bold text-white sm:text-3xl">Vergelijk de pakketten</h2>
      <div class="mt-6 overflow-x-auto rounded-2xl border border-white/10 bg-slate-950/60" tabindex="0" role="region" aria-label="Vergelijkingstabel van de pakketten">
        <table class="w-full min-w-[560px] text-sm">
          <thead class="bg-white/5"><tr><th scope="col" class="px-4 py-3 text-left font-semibold text-slate-400">Onderdeel</th>${head}</tr></thead>
          <tbody>
            ${rows.join('\n            ')}
          </tbody>
        </table>
      </div>
      <p class="mt-3 text-xs text-slate-500">Alle bedragen ${esc(BTW)}. Website ${euro(P.website_eenmalig)} eenmalig bij elk pakket.</p>
    </div>`;
}

export function pakketKaarten() {
  return `<div class="mx-auto max-w-7xl px-6">
    <p class="reveal mx-auto max-w-2xl text-center text-lg text-slate-200">Elke website kost ${euro(P.website_eenmalig)} eenmalig. Daarna kies je hoeveel groei je wilt.</p>
    <div class="mt-12 grid gap-6 lg:grid-cols-3">
      ${pakketten.map(kaartVol).join('\n      ')}
    </div>
    <div class="reveal mt-10 grid gap-6 md:grid-cols-2">
      <div class="rounded-2xl border border-white/10 bg-slate-900/40 p-6">
        <h3 class="font-display text-lg font-semibold text-white">Jaarkorting en looptijden</h3>
        <ul class="mt-3 space-y-2 text-sm text-slate-300">
          <li><strong class="text-white">${esc(groei.naam)} voor een jaar vastleggen:</strong> ${euro(P.jaarkorting_groei)} per maand in plaats van ${pm(groei)}.</li>
          ${pakketten.map((k) => `<li><strong class="text-white">${esc(k.naam)}:</strong> ${esc(k.looptijd.replace(/^./, (c) => c.toLowerCase()))}.</li>`).join('\n          ')}
          <li>Overstappen naar een hoger pakket kan altijd. Alle bedragen ${esc(BTW)}.</li>
        </ul>
      </div>
      <div class="rounded-2xl border border-dashed border-white/15 p-6">
        <h3 class="font-display text-lg font-semibold text-white">Binnenkort</h3>
        <p class="mt-2 text-sm text-slate-400">Hier werk ik aan. Wil je het nu al? Vraag ernaar.</p>
        <ul class="mt-3 flex flex-wrap gap-2">
          ${P.later.map((l) => `<li class="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-slate-300">${esc(l)}</li>`).join('\n          ')}
        </ul>
      </div>
    </div>
    ${vergelijking()}
  </div>`;
}

// ── Compact (home, pijlers) ─────────────────────────────────────────────────
function kaartCompact(k) {
  return `<div class="reveal ${kaartKlasse(k)} ${order(k)}">
        ${k.aanrader ? badge : ''}
        <h3 class="font-display text-xl font-bold text-white">${esc(k.naam)}</h3>
        ${prijsRegel(k, false)}
        <ul class="mt-5 flex-1 space-y-2 text-sm text-slate-200">
          ${k.inhoud.slice(0, 3).map((i) => `<li class="flex gap-3">${check}<span>${esc(tekst(i, k))}</span></li>`).join('\n          ')}
        </ul>
      </div>`;
}

export function pakketCompact() {
  return `<div>
      <p class="reveal text-center text-slate-300">Elke website kost ${euro(P.website_eenmalig)} eenmalig. Daarna kies je hoeveel groei je wilt.</p>
      <div class="mt-10 grid gap-6 lg:grid-cols-3">
        ${pakketten.map(kaartCompact).join('\n        ')}
      </div>
      <p class="reveal mt-6 text-center text-sm text-slate-400">Alle bedragen ${esc(BTW)}. ${esc(groei.naam)} voor een jaar vastleggen: ${euro(P.jaarkorting_groei)} per maand.</p>
      <div class="reveal mt-8 text-center">
        <a href="/prijzen" class="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-6 py-3 text-sm font-semibold text-white transition hover:border-white/30 hover:bg-white/10">Bekijk alle details &rarr;</a>
      </div>
    </div>`;
}

// ── Eén regel (stadspagina's, contactblok home) ─────────────────────────────
export function pakketRegel() {
  const rij = pakketten.map((k) => `${esc(k.naam)} ${pm(k)} p/m`).join(' &middot; ');
  return `<p class="text-sm text-slate-300">${rij}, website ${euro(P.website_eenmalig)} eenmalig (${esc(BTW)}). <a href="/prijzen" class="font-semibold text-electric-400 underline-offset-4 transition hover:text-white hover:underline">Bekijk de pakketten</a></p>`;
}

// ── Hero-tegels homepage ────────────────────────────────────────────────────
export function pakketStats() {
  const vanaf = Math.min(...pakketten.map((k) => k.prijs_pm));
  return `<div class="mx-auto mt-14 grid max-w-3xl grid-cols-1 gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/5 sm:grid-cols-3">
        <div class="bg-slate-950/40 px-6 py-5"><p class="font-display text-2xl font-bold text-white">${euro(P.website_eenmalig)}</p><p class="mt-1 text-sm text-slate-400">website, eenmalig</p></div>
        <div class="bg-slate-950/40 px-6 py-5"><p class="font-display text-2xl font-bold text-white">vanaf ${euro(vanaf)}/mnd</p><p class="mt-1 text-sm text-slate-400">pakketten Start, Groei, Top</p></div>
        <div class="bg-slate-950/40 px-6 py-5"><p class="font-display text-2xl font-bold text-white">Van jou</p><p class="mt-1 text-sm text-slate-400">alles wat we bouwen</p></div>
      </div>`;
}

// ── FAQ /prijzen ────────────────────────────────────────────────────────────
export const PRIJZEN_FAQ = [
  { vraag: 'Wat is het verschil tussen de pakketten?', antwoord: `${byId.start.naam} (${pm(byId.start)} per maand) houdt je website online en bijgehouden, met een ingericht Google Bedrijfsprofiel. ${groei.naam} (${pm(groei)} per maand) laat je groeien: tot ${groei.paginas_pm} nieuwe plaats- of dienstpagina's per maand, je Bedrijfsprofiel bijgehouden, een reviewlink met QR-code en een maandoverzicht. ${byId.top.naam} (${pm(byId.top)} per maand) doet dat met tot ${byId.top.paginas_pm} pagina's per maand, plus een kennisartikel per maand met kant-en-klare posts. De website kost bij elk pakket ${euro(P.website_eenmalig)} eenmalig. Alle bedragen ${BTW}.` },
  { vraag: 'Kan ik later overstappen?', antwoord: 'Ja. Naar een hoger pakket kan op elk moment. Naar een lager pakket kan na de minimale looptijd.' },
  { vraag: 'Hoe lang zit ik vast?', antwoord: `${pakketten.map((k) => `${k.naam}: ${k.looptijd.replace(/^./, (c) => c.toLowerCase())}`).join('. ')}. Leg je ${groei.naam} voor een jaar vast, dan betaal je ${euro(P.jaarkorting_groei)} per maand.` },
  { vraag: 'Is de website van mij?', antwoord: 'Ja. Website, domein, teksten en alle pagina\'s blijven van jou, ook als je stopt.' },
  { vraag: 'Belooft Stam Core posities in Google?', antwoord: 'Nee. Niemand kan een plek in Google beloven, en wie dat wel doet, moet je wantrouwen. Ik zorg dat je site en Bedrijfsprofiel goed in elkaar zitten en dat er elke maand iets bijkomt. In het maandoverzicht zie je hoe vaak je gevonden, aangeklikt en gebeld wordt.' },
];

export function prijzenFaq() {
  return PRIJZEN_FAQ.map((f) => `<div class="reveal rounded-2xl border border-white/5 bg-slate-900/40 p-6">
        <h3 class="font-display text-lg font-semibold text-white">${esc(f.vraag)}</h3>
        <p class="mt-2 text-slate-400">${esc(f.antwoord)}</p>
      </div>`).join('\n      ');
}

// ── Schema ──────────────────────────────────────────────────────────────────
export function offers() {
  return [
    { '@type': 'Offer', '@id': `${SITE}/prijzen#website`, name: 'Website', price: String(P.website_eenmalig), priceCurrency: 'EUR', url: `${SITE}/prijzen`,
      priceSpecification: { '@type': 'PriceSpecification', price: String(P.website_eenmalig), priceCurrency: 'EUR', valueAddedTaxIncluded: false },
      description: `Eenmalig, bij elk pakket. ${Btw}.` },
    ...pakketten.map((k) => ({
      '@type': 'Offer', '@id': `${SITE}/prijzen#${k.id}`, name: `Pakket ${k.naam}`, price: String(k.prijs_pm), priceCurrency: 'EUR', url: `${SITE}/prijzen`,
      priceSpecification: { '@type': 'UnitPriceSpecification', price: String(k.prijs_pm), priceCurrency: 'EUR', unitCode: 'MON', unitText: 'maand', valueAddedTaxIncluded: false },
      description: `${k.inhoud.map((i) => tekst(i, k)).join('; ')}. ${k.looptijd}. ${Btw}.`,
    })),
  ];
}

export function prijzenSchema() {
  const graph = [
    { '@type': 'OfferCatalog', '@id': `${SITE}/prijzen#aanbod`, name: 'Pakketten Stam Core', url: `${SITE}/prijzen`, itemListElement: offers() },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
      { '@type': 'ListItem', position: 2, name: 'Prijzen', item: `${SITE}/prijzen` },
    ] },
    { '@type': 'FAQPage', mainEntity: PRIJZEN_FAQ.map((f) => ({ '@type': 'Question', name: f.vraag, acceptedAnswer: { '@type': 'Answer', text: f.antwoord } })) },
  ];
  return `<script type="application/ld+json">\n${JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c')}\n</script>`;
}

export function prijzenMeta() {
  const rij = pakketten.map((k) => `${k.naam} ${pm(k)}`).join(', ');
  const desc = `Wat kost een website en lokale SEO voor je servicebedrijf? Website ${euro(P.website_eenmalig)} eenmalig, daarna een pakket: ${rij} per maand. ${Btw}.`;
  const kort = `Website ${euro(P.website_eenmalig)} eenmalig. Pakketten ${rij} per maand. ${Btw}.`;
  return [
    `<meta name="description" content="${esc(desc)}">`,
    `<meta property="og:description" content="${esc(kort)}">`,
    `<meta name="twitter:description" content="${esc(kort)}">`,
  ].join('\n');
}

/** Alle pakket-partials, voor de partial-stap in build.mjs. */
export function pakketPartials() {
  return {
    pakketkaarten: pakketKaarten(),
    pakketcompact: pakketCompact(),
    pakketregel: pakketRegel(),
    pakketstats: pakketStats(),
    prijzenfaq: prijzenFaq(),
    prijzenschema: prijzenSchema(),
    prijzenmeta: prijzenMeta(),
  };
}

export { aanrader };
