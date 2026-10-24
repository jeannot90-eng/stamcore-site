# SEO-pagina's (glazenwassers)

Het plan staat in [`SEO-PLAN.md`](../SEO-PLAN.md) en is leidend. Dit bestand beschrijft hoe de techniek werkt, en (§ Review-afspraken) wat er tijdens reviews is besloten, zodat het voor alle volgende pagina's geldt.

```bash
npm run seo:all      # = seo:build → seo:check → seo:sitemap
npm run build        # = build:css + seo:all (draai dit als je Tailwind-klassen hebt toegevoegd)
```

| Script | Wat het doet |
|---|---|
| `seo:build` | Bouwt stadspagina's, de SEO-pijler en kennisartikelen; werkt "Per stad" en "Kennis" op de pijler bij; zet header/footer/scripts en inline CSS in alle pagina's. Concepten gaan naar `_preview/` (noindex, niet in git). |
| `seo:check` | Kwaliteitscheck uit het plan (§6). Exit code 1 bij een fout. Rapport per pagina: OK / WAARSCHUWING / FOUT. |
| `seo:sitemap` | Schrijft `sitemap.xml` volledig opnieuw. |

## Bestanden

| Pad | Inhoud |
|---|---|
| `config.json` | Prijzen en voorwaarden, contactgegevens, case-feiten (Lighthouse), uitgesloten steden (incl. kernen), verboden woorden, vaste pagina's voor de sitemap. **Prijzen alleen hier wijzigen.** |
| `niches/glazenwasser.json` | Niche-brede inhoud: systeemblok, FAQ-pool, FAQ van de SEO-pijler. |
| `cities/{slug}.json` | Eén stadspagina (velden: zie hieronder). |
| `scans/{slug}.csv` | Maps-scan, door Claude in de browser (zie SEO-PLAN.md §5). Formaat: `scans/_TEMPLATE.csv`. `scans/_voorbeeld.csv` is nep-data, alleen voor de preview. |
| `articles/{slug}.md` | Kennisartikel (Markdown + frontmatter). |
| `templates/city.html`, `seo-pijler.html`, `article.html` | Templates. `{{veld}}` = tekst (ge-escaped), `{{{veld}}}` = HTML. |
| `scripts/` | `lib.mjs` (gedeeld), `build.mjs`, `check.mjs`, `sitemap.mjs`. Geen dependencies. |
| `QUEUE.md`, `LOG.md` | Wachtrij en publicatielog. |

`/seo/*` geeft op Netlify een 404 en staat in `robots.txt` op Disallow.

## Tokens in teksten

In de JSON- en Markdown-teksten mogen deze tokens staan; de build vult ze in uit `config.json`:
`{website_eenmalig}` `{website_per_jaar}` `{seo_per_maand}` `{seo_min_maanden}` `{seo_opzegtermijn}` `{seo_paginas}` `{btw}`, en in het systeemblok `{stad}`.
Een token dat niet is ingevuld, laat de check falen.

## Stadspagina

URL: `/website-glazenwasser-{slug}` (bestand in de root, zonder `.html` in links/canonical/sitemap).

Velden in `cities/{slug}.json` (allemaal verplicht):

| Veld | Blok | Uniek? |
|---|---|---|
| `stad`, `slug`, `niche` | | |
| `status` | `concept` → `_preview/`, `live` → publiceren | |
| `title`, `meta`, `h1` | head + hero | ja; ≤ 60 / 120–160 tekens |
| `intro` | 1. hero (2–3 zinnen met een echt kenmerk) | ja |
| scan (`scan` = pad naar CSV) | 2. Maps-scan: gemiddelden, tellingen, 2–3 automatische kansen | data |
| `wijken`, `wijken_tekst` | 3. wijken en kernen (≥ 6, geverifieerd) + uitleg | ja |
| `kenmerken` | 4. wat de stad anders maakt (150–250 woorden, alleen verifieerbare feiten) | ja |
| — | 5. systeem, 6. case, 7. prijzen | gedeeld |
| `faq_stad` (2) + `faq_pool` (sleutels uit de niche) | 8. FAQ + FAQPage-schema | deels |
| `cta_tekst` | 9. CTA met WhatsApp-tekst incl. stadsnaam | ja |
| `nabije_steden` | 10. andere steden (alleen live pagina's, nabij eerst) | auto |
| `bronnen` | niet op de pagina; waar de feiten vandaan komen | |
| `gepubliceerd`, `gewijzigd` | sitemap `lastmod`. `gepubliceerd` vult de build in bij de eerste live-build; `gewijzigd` zelf bijwerken bij een nieuwe scan of tekstwijziging. | |

Tekstvelden mogen een string of een lijst van alinea's zijn.

De unieke blokken staan in de HTML tussen `<!-- uniek -->` en `<!-- /uniek -->`; daarop meet de check het woordaantal (≥ 350) en de overlap met andere steden (Jaccard op woord-trigrammen, max 0,25). Hele pagina: waarschuwing > 0,5, fout > 0,6.

**Zonder scan** wordt een concept gebouwd met `scans/_voorbeeld.csv` en een gele balk "VOORBEELDDATA". Een live pagina zonder `scans/{slug}.csv` stopt de build; een pagina met voorbeelddata faalt de check.

### Kansen uit de scan (automatisch, nooit beloftes)

- ≥ 2 zonder plaatspagina's → kans op pagina's per wijk/kern
- ≥ 2 die niet reageren op reviews → reageren op reviews
- gemiddeld < 30 reviews → reviewroutine; ≥ 30 → eerst pagina's en profiel, reviews laten groeien
- aanvulling tot 3: ≥ 2 met minder dan 10 foto's, geen eigen website

Tegels op de pagina: gemiddeld aantal reviews, gemiddelde score, eigen website x/3, plaatspagina's x/3, reageert op reviews x/3, gemiddeld aantal foto's.

## Kennisartikel

`articles/{slug}.md` → `/kennis/{slug}`. Frontmatter (één veld per regel; lijsten/objecten als JSON):

```
---
status: concept
title: Meer Google-reviews als glazenwasser
meta: …120–160 tekens…
h1: Zo krijg je als glazenwasser meer reviews
datePublished: 2026-11-02
dateModified: 2026-11-02
gerelateerd: ["google-bedrijfsprofiel-glazenwasser"]
faq: [{"vraag": "…", "antwoord": "…"}]
---
```

Markdown: `##`/`###`, alinea's, `-` lijsten, `1.` stappen, `- [ ]` checklist, `**vet**`, `[tekst](/url)`. Minimaal 1.000 woorden. Het template linkt zelf naar beide pijlers en `/prijzen`.

Let op: `_redirects` stuurt `/kennis` en `/kennis/` (alleen die twee) tijdelijk door naar `/`. Artikelen op `/kennis/{slug}` werken gewoon.

## Review-afspraken

Wat Jeannot bij reviews heeft besloten. Dit geldt voor alle volgende pagina's.

- **2026-10-24:** `/seo-glazenwasser` en Tilburg zonder wijzigingen goedgekeurd. De opbouw en toon van [`cities/tilburg.json`](cities/tilburg.json) zijn het template voor alle volgende stadspagina's. Tilburg gaat pas live zodra `scans/tilburg.csv` er is.
- **2026-10-24:** Claude doet de Maps-scan zelf via de browser. Kolommen `posts_laatste_30d` en `fotos_eigen_werk` vervangen door `reageert_op_reviews` en `fotos`, omdat posts en eigen-vs-klantfoto's niet zichtbaar zijn zonder in te loggen. Gesponsorde resultaten tellen niet mee.
