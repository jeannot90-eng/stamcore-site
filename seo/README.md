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

## Vaste regels

- **Stam Core verstuurt nooit zelf reviewverzoeken naar klanten van klanten; de klant verstuurt ze zelf.** Wij leveren een reviewlink, QR-code en een kant-en-klaar appje. De check faalt op "reviewverzoeken naar je klanten", "stuur ik de reviewverzoeken" en "vragen we je klanten om reviews".
- **Elk getal en elk historisch of feitelijk gegeven in een stadspagina heeft een bron in het JSON-bestand van die stad**, als `{ "feit": "…", "bron": "https://…" }` in `bronnen`. De check faalt als een stadspagina getallen bevat terwijl `bronnen` leeg is. Een script ziet niet of elk feit gedekt is: noteer per feit een bron, en laat weg wat je niet kunt verifiëren.
- **OG-afbeelding per stad:** `img/og/{niche}-{slug}.jpg` (1200×630), gemaakt door `seo/scripts/og.py` (Python + Pillow, lettertype Segoe UI). `seo:build` maakt hem aan als hij ontbreekt; de check faalt zonder. `python seo/scripts/og.py` zonder argumenten maakt ook `img/og-default.jpg` opnieuw.

- **Alles opnieuw bouwen:** `seo:build` genereert bij elke run **alle** live stadspagina's opnieuw, niet alleen de nieuwe, zodat "Ook bekeken", interne links, sitemap en lastmod overal kloppen. Verandert de inhoud van een bestaande pagina (inline CSS niet meegerekend), dan zet de build `gewijzigd` in de stads-JSON op vandaag; de sitemap neemt dat over als `lastmod`. Publiceer daarom altijd met `npm run seo:all` en commit alle gewijzigde stadspagina's en JSON's mee.
- **Kansen-zinnen variëren:** de kansen in het Maps-scanblok komen uit `seo/scripts/kansen.mjs`: per regel minimaal 4 inhoudelijk verschillende varianten, elk met de stadsnaam, een wijk/kern of het scancijfer erin. Per stad wordt de eerste variant gekozen die nog niet op een andere live pagina staat (live op publicatievolgorde, dan concepten), zodat een nieuwe stad bestaande pagina's niet verandert. Zijn alle varianten van een regel in gebruik, voeg er dan een toe. De check faalt als een zin van 12+ woorden uit de unieke blokken letterlijk op een andere stadspagina staat (systeem, case, prijzen en standaard-FAQ tellen niet mee).
- **"Wat {Stad} anders maakt" zonder vast skelet:** geen vaste volgorde (geschiedenis → hoogbouw → studenten → bedrijventerrein → "Voor je website betekent dat"). Kies per stad de 2–3 kenmerken die er voor een glazenwasser echt toe doen en begin met het sterkste. Studentenstad, hoogbouw of bedrijventerrein noem je alleen als het voor die stad echt kenmerkend is. Varieer de afsluitende zin. Richtlijn: 150–250 woorden.
- **Inwonertallen:** zeg altijd waar het getal over gaat (gemeente of woonplaats) en noteer peildatum en bron. Een claim die op Wikipedia "[bron?]" heeft, gebruik je niet.

## Review-afspraken

Wat Jeannot bij reviews heeft besloten. Dit geldt voor alle volgende pagina's.

- **2026-10-24:** `/seo-glazenwasser` en Tilburg zonder wijzigingen goedgekeurd. De opbouw en toon van [`cities/tilburg.json`](cities/tilburg.json) zijn het template voor alle volgende stadspagina's. Tilburg gaat pas live zodra `scans/tilburg.csv` er is.
- **2026-10-24 (review Jeannot):** reviewverzoek-teksten site-breed vervangen door "reviewlink, QR-code en kant-en-klaar appje"; Tilburg-feiten gecorrigeerd met bronnen (bedrijventerreinen zonder getal, LocHal sinds 2019); looptijd-zin in de FAQ vervangen door het maandrapport; OG-afbeelding per stad.
- **2026-10-24 (review steden 1–3):** alles-opnieuw-bouwen met automatische `gewijzigd`; kansen-varianten per stad en check op dubbele zinnen; kenmerken-teksten herschreven zonder vast skelet; feiten gecorrigeerd (Den Bosch gemeentetotaal, Lighthouse sinds 2024, WoensXL zonder "grootste", Meerhoven zonder 1994).
- **2026-10-24:** Indexering: nieuwe pagina's komen via `sitemap.xml` en de links op de pijler vanzelf bij Google. Daarnaast vraagt Claude **per 5 nieuwe live pagina's** in Search Console "Indexering aanvragen" aan, in het browserpaneel, nadat Jeannot daar zelf heeft ingelogd. Houd in `LOG.md` bij welke URL's al zijn aangevraagd (kolom Indexering).
- **2026-10-24:** Claude doet de Maps-scan zelf via de browser. Kolommen `posts_laatste_30d` en `fotos_eigen_werk` vervangen door `reageert_op_reviews` en `fotos`, omdat posts en eigen-vs-klantfoto's niet zichtbaar zijn zonder in te loggen. Gesponsorde resultaten tellen niet mee.
