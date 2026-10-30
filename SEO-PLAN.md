# SEO-plan Stam Core — niche: glazenwassers

> **Voor Claude Code.** Plaats dit bestand in de root van de repo van stam-core.nl als `SEO-PLAN.md`.
> Lees het volledig voordat je iets bouwt. Dit plan is leidend voor alle SEO-pagina's, nu en in de toekomst.

---

## 0. Samenvatting

- **Doel:** glazenwassers buiten de eigen regio van Jeannot vinden Stam Core via Google, en elke pagina werkt tegelijk als landingspagina voor directe outreach ("ik heb jouw stad doorgelicht").
- **Niche golf 1:** alleen **glazenwassers**. Andere niches pas na evaluatie (§9).
- **Paginatypes:**
  1. **Pijler**: `/website-glazenwasser` (bestaat al) en `/seo-glazenwasser` (nieuw)
  2. **Stadspagina's**: `/website-glazenwasser-{stad}` (8 in golf 1)
  3. **Kennisartikelen**: `/kennis/{slug}`, gericht op wat glazenwassers zelf zoeken
- **Werkwijze:** één stadspagina (Tilburg) wordt volledig gebouwd als template en door Jeannot goedgekeurd. Daarna genereert en lanceert Claude Code alle volgende pagina's zelfstandig, via het datamodel, de generator en de kwaliteitscheck in dit plan.

### Eerlijke verwachting
Zoektermen als "website glazenwasser tilburg" hebben weinig zoekvolume. De waarde zit in drie dingen:
1. de pagina's ranken samen mee op bredere termen ("website glazenwasser", "glazenwasser meer klanten");
2. ze zijn de beste landingspagina voor outreach per stad;
3. de kennisartikelen trekken het echte verkeer, omdat glazenwassers daar zelf naar zoeken.

Reken op 2–4 maanden voordat er structureel organisch verkeer is.

---

## 1. Harde regels (altijd van toepassing)

1. **Geen beloftes over posities.** Nooit "wij brengen je in de top 3", "gegarandeerd bovenaan" of iets vergelijkbaars. De Maps-scan beschrijft de huidige situatie, het is geen belofte. Gebruik formuleringen als "hier zit ruimte", "dit missen de meeste bedrijven", "dit is waar ik naar kijk".
2. **Geen concurrenten bij naam.** Lokale Maps-data verschijnt alleen geanonimiseerd en als gemiddelde: "de drie bedrijven bovenaan hebben gemiddeld X reviews". Geen bedrijfsnamen, geen URL's, geen screenshots van concurrenten.
3. **Geen verzonnen feiten.** Geen verzonnen cijfers, klanten, reviews, quotes of resultaten. Wijken en kenmerken van een stad moet je verifiëren (gemeentesite, Wikipedia of CBS-wijkindeling). Kun je iets niet verifiëren, laat het dan weg.
4. **Geen claims over het eigen bedrijf die niet kloppen.** Wel waar: Jeannot runt 6+ jaar een glazenwassersbedrijf (Kustermans Glas & Gevelreiniging), bouwde de backoffice voor zijn eigen bedrijf, en bouwde het website/SEO/review-systeem voor Clean up support Nederland. **Niet** zeggen dat de website, de pagina's per plaats of de reviewmotor van Kustermans Glas door hem gebouwd zijn of op dit systeem draaien.
5. **Eén echt adres.** Stam Core zit in Oosterhout (Rietbeemd 48, 4907 ED). Stadspagina's gebruiken `areaServed`, nooit een nep-adres of `LocalBusiness` per stad.
6. **Geen dunne duplicaten.** Elke stadspagina moet de kwaliteitscheck (§6) halen, anders wordt hij niet gepubliceerd.
7. **Uitgesloten steden** (eigen werkgebied en klantregio): Oosterhout, Breda, Dongen, Geertruidenberg, Drimmelen, Etten-Leur, Gilze en Rijen, Amersfoort (en kernen daarbinnen). Maak voor deze plaatsen nooit een stadspagina, tenzij Jeannot dit expliciet wijzigt in `seo/config.json`.
8. **Prijzen en voorwaarden** altijd uit `seo/config.json`, nooit hardcoded in teksten: website €350 eenmalig + €300/jaar; lokale SEO €199/maand, minimaal 3 maanden, daarna maandelijks opzegbaar met 1 maand opzegtermijn; alle bedragen excl. btw.
9. **Reviews:** Stam Core verstuurt nooit zelf reviewverzoeken naar klanten van klanten; de klant verstuurt ze zelf. Wat we leveren: een vaste reviewlink, een QR-code en een kant-en-klaar appje dat de klant na de ronde zelf verstuurt. *(toegevoegd 2026-10-24)*
10. **Bronnen:** elk getal en elk historisch of feitelijk gegeven in een stadspagina heeft een bron in het JSON-bestand van die stad (`bronnen`: `{ "feit", "bron" }`). Geen bron = weglaten. *(toegevoegd 2026-10-24)*
11. **Geen bronvermelding in de paginatekst:** "volgens Wikipedia", "bron:", "aldus" en dergelijke staan nooit op de pagina; bronnen staan alleen in het JSON-bestand van de stad. *(toegevoegd 2026-10-24)*
12. **FAQ vanuit de glazenwasser:** stads-FAQ's zijn vragen die een glazenwasser aan Stam Core stelt ("Kan mijn werkgebied … mee?"), nooit vragen die klinken alsof Stam Core zelf ramen wast ("Doe je ook …?"). *(toegevoegd 2026-10-24)*
13. **Geen negatieve typering van wijken of plaatsen:** geen onrust, overlast, criminaliteit, armoede, "probleemwijk" of lage inkomens, ook niet als het op Wikipedia staat. Beschrijf wat een wijk is en wat er voor een glazenwasser te doen is, niet wat er mis was. *(toegevoegd 2026-10-30)*
14. Toon: Nederlands, direct, van ondernemer tot ondernemer, vakjargon van glazenwassers mag (rondes, osmose, telescoopsteel, frequentie). Geen bureau-taal.

---

## 2. Bestandsstructuur (bouwen of controleren)

Controleer eerst of er al een generator en datamodel bestaan uit een eerdere ronde. Hergebruik die als dat kan. Zo niet, bouw dan:

```
/seo/
  config.json              # prijzen, uitgesloten steden, contactgegevens, case-feiten
  niches/glazenwasser.json # niche-brede content: problemen, diensten, FAQ-pool, terminologie
  cities/                  # één JSON per stadspagina
    tilburg.json
    ...
  scans/                   # Maps-scans door Jeannot (CSV, zie §5)
    tilburg.csv
  articles/                # kennisartikelen in Markdown + frontmatter
  templates/
    city.html              # template stadspagina
    article.html           # template kennisartikel
  scripts/
    build.mjs              # genereert HTML uit data + templates
    check.mjs              # kwaliteitscheck (§6), faalt bij overtreding
    sitemap.mjs            # werkt sitemap.xml bij
  QUEUE.md                 # publicatiewachtrij (§8)
  LOG.md                   # wat is wanneer gepubliceerd
```

Gegenereerde HTML komt op de bestaande URL-structuur van de site (bijv. `/website-glazenwasser-tilburg/index.html` of `.html`, afhankelijk van hoe de site nu werkt; volg de bestaande conventie).

**URL-structuur (vastgelegd 2026-10-25, besluit Jeannot):** bestaande URL's blijven zoals ze zijn. Voor elke branche geldt hetzelfde patroon: `/website-{niche}` (pijler), `/seo-{niche}` (SEO-pijler) en `/website-{niche}-{stad}` (stadspagina), kennisartikelen op `/kennis/{slug}`. Geen mappenstructuur zoals `/branches/{niche}/{stad}/`. De ordening gebeurt in de bronbestanden (`seo/niches/`, `seo/cities/`), en de samenhang voor Google via interne links en `BreadcrumbList`, niet via de URL.

Voeg aan `package.json` toe:
```
"seo:build": "node seo/scripts/build.mjs",
"seo:check": "node seo/scripts/check.mjs",
"seo:sitemap": "node seo/scripts/sitemap.mjs",
"seo:all": "npm run seo:build && npm run seo:check && npm run seo:sitemap"
```

Gebruik geen frameworks of zware dependencies. Node zonder of met minimale packages; de site blijft statisch op Netlify.

---

## 3. Paginatypes en inhoud

### 3.1 Pijler: `/website-glazenwasser` (bestaat al)
- Niet herschrijven. Alleen toevoegen:
  - een blok "**Per stad**" met links naar alle live stadspagina's (automatisch door de generator);
  - een blok "**Kennis voor glazenwassers**" met links naar de kennisartikelen;
  - een link naar `/seo-glazenwasser`.
- Pas "5 nieuwe pagina's per maand" aan naar "**tot 5** nieuwe pagina's per maand", als dat nog niet gebeurd is.

### 3.2 Pijler: `/seo-glazenwasser` (nieuw)
- **Title:** `Lokale SEO voor glazenwassers | Stam Core`
- **Meta:** ±150 tekens: gevonden worden per plaats en in Google Maps, uitgelegd door een glazenwasser. €199/mnd.
- **H1:** *Gevonden worden in de wijken waar je al rijdt*
- **Inhoud (≥ 1.000 woorden):**
  1. Waarom Maps voor een glazenwasser belangrijker is dan de gewone zoekresultaten
  2. De drie dingen die bepalen of je in Maps verschijnt: relevantie (diensten, categorieën, plaatspagina's), afstand (werkgebied) en bekendheid (reviews, vermeldingen). Leg uit, zonder beloftes.
  3. Pagina's per dienst × plaats: wat ze zijn en waarom ze unieke inhoud nodig hebben
  4. Reviews: wanneer je erom vraagt (als de ramen nog glimmen), QR op de bus of de factuur
  5. Bedrijfsprofiel: categorieën ("Glazenwasser" als hoofdcategorie), diensten, foto's, posts
  6. Wat je elke maand krijgt voor €199 (uit config)
  7. Wat je zelf kunt doen zonder ons (geeft vertrouwen)
  8. FAQ (5–7 vragen, `FAQPage`-schema)
  9. CTA: gratis website-scan (`/website-scan?bron=seo-glazenwasser`) als hoofdactie; Maps-scan via WhatsApp als tweede optie voor wie nog geen website heeft *(gewijzigd 2026-10-24)*

### 3.3 Stadspagina: `/website-glazenwasser-{stad}`

**Patronen:**
- **Title (≤ 60 tekens):** `Website glazenwasser {Stad} | Stam Core`
- **Meta (140–160 tekens):** varieer per stad, met "glazenwasser", "{Stad}", "Google Maps" en een concreet haakje uit de scan of de stadskenmerken.
- **H1:** varieer per stad, bijvoorbeeld:
  - *Glazenwasser in {Stad}? Zo vind je klanten in jouw wijken*
  - *Meer vaste klanten als glazenwasser in {Stad}*
  - *Zo staan glazenwassers in {Stad} ervoor in Google Maps*
  Gebruik nooit twee keer dezelfde H1.
- **Broodkruimel:** Home › Website voor glazenwassers › {Stad}

**Opbouw (blokken):**

| # | Blok | Uniek per stad? | Inhoud |
|---|---|---|---|
| 1 | Hero | ✅ | H1, korte intro (2–3 zinnen) met een echt kenmerk van de stad, CTA's (gratis website-scan als hoofdactie + WhatsApp) |
| 2 | **Zo staat {Stad} ervoor in Maps** | ✅ verplicht | Geanonimiseerde scan (§5): gemiddeld aantal reviews top 3, gemiddelde score, hoeveel een eigen website hebben, hoeveel plaatspagina's hebben, hoeveel actief posten. Met datum: "gemeten op {datum}". Afsluiten met 2–3 concrete kansen die uit déze data volgen. Geen beloftes. |
| 3 | **Wijken en kernen** | ✅ verplicht | Geverifieerde wijken en kernen van {Stad} (minimaal 6). Plus uitleg: waarom pagina's per wijk of kern helpen om rondes te vullen in plaats van door de stad te zigzaggen. |
| 4 | **Wat {Stad} anders maakt** | ✅ verplicht | 150–250 woorden over het type bebouwing en de klantkansen, alleen met verifieerbare feiten: bijvoorbeeld veel nieuwbouw met grote glaspartijen, een historische binnenstad met winkelpanden, een studentenstad met veel huurwoningen, bedrijventerreinen (zakelijke rondes), VvE's of hoogbouw. Vertaal dat naar diensten (ramen, zonnepanelen, dakgoten, kozijnen, zakelijk) en naar wat er op de website moet. |
| 5 | Het systeem | ⚪ gedeeld, met stadsnaam ingevuld | Website → plaatspagina's → Bedrijfsprofiel → reviewmotor. Korte versie van de pijler. |
| 6 | Case Clean up support | ⚪ gedeeld | Korte casus + Lighthouse-scores (uit config) + link `/werk#cleanup` |
| 7 | Prijzen | ⚪ gedeeld (uit config) | Website + lokale SEO, link naar `/prijzen` |
| 8 | FAQ | ✅ deels | 4–5 vragen: 2 stadspecifiek (bijv. "Werk je ook in {kern}?", "Heeft het zin in een stad met al veel glazenwassers?") + 2–3 uit de FAQ-pool. `FAQPage`-schema. |
| 9 | CTA | ✅ | **Hoofdactie: gratis website-scan** (`/website-scan?bron=website-glazenwasser-{stad}`), met een eigen tekst per stad. Tweede optie: "Geen website? Vraag een Maps-scan" via WhatsApp met vooringevulde tekst inclusief de stadsnaam. *(gewijzigd 2026-10-24, besluit Jeannot)* |
| 10 | Andere steden | ⚪ automatisch | Links naar 3–4 andere stadspagina's (bij voorkeur nabijgelegen) + terug naar de pijler |

**Minimaal 700 woorden, waarvan ≥ 350 woorden in de unieke blokken (1–4, 8-stad, 9).**

### 3.4 Kennisartikelen: `/kennis/{slug}`
Richten op wat glazenwassers zelf zoeken. Elk artikel ≥ 1.000 woorden, praktisch, met een checklist of stappenplan, en een interne link naar de pijlers en de prijzen. Schema: `Article` + `BreadcrumbList` (+ `FAQPage` als er een FAQ is).

Golf 1 (in deze volgorde):

| # | Slug | Title | H1 | Insteek |
|---|---|---|---|---|
| 1 | `google-bedrijfsprofiel-glazenwasser` | Google Bedrijfsprofiel voor glazenwassers: zo richt je het in | Je Bedrijfsprofiel als glazenwasser: stap voor stap | Categorieën, werkgebied, diensten, foto's van de bus, posts. Concreet en uitvoerbaar. |
| 2 | `meer-reviews-glazenwasser` | Meer Google-reviews als glazenwasser | Zo krijg je als glazenwasser meer reviews | Timing (ramen glimmen nog), QR op de bus/factuur/kaartje, appje na de ronde, reageren op reviews |
| 3 | `wat-kost-website-glazenwasser` | Wat kost een website voor een glazenwasser? | Wat kost een website voor een glazenwasser in 2026? | Eerlijk overzicht: doe-het-zelf, freelancer, bureau, Stam Core; waar je op moet letten |
| 4 | `klanten-werven-glazenwasser` | Klanten werven als glazenwasser: wat werkt echt | Nieuwe klanten voor je glazenwassersbedrijf | Wijkgericht werven, flyeren bij bestaande rondes, Maps, mond-tot-mond versterken |
| 5 | `winter-glazenwasser-omzet` | Glazenwasser in de winter: omzet op peil houden | Rustige wintermaanden als glazenwasser opvangen | Abonnementen in het voorjaar binnenhalen, zakelijke rondes, extra diensten (dakgoten, zonnepanelen) |
| 6 | `zonnepanelen-reinigen-extra-dienst` | Zonnepanelen reinigen als extra dienst online verkopen | Zonnepanelen reinigen: zo verkoop je het online | Aparte dienstpagina, plaatspagina's, uitleg voor klanten |
| 7 | `website-traag-op-mobiel` | Waarom is mijn website traag op mobiel? | Waarom is mijn website traag op mobiel? | De meest voorkomende oorzaken bij sites van servicebedrijven (zware foto's, sliders, plugins, goedkope hosting), hoe je het zelf meet, wat je zelf kunt doen. Interne link naar /website-scan ("scan je eigen site") |
| 8 | `pagespeed-score-uitleg` | Wat betekent mijn PageSpeed-score? | Wat betekent mijn PageSpeed-score? | Uitleg van de vier scores en LCP/CLS in gewone taal, waarom mobiel lager uitvalt dan desktop, welke score goed genoeg is, waar je begint. Interne link naar /website-scan |

Artikel 7 en 8 (toegevoegd 2026-10-24, besluit Jeannot) linken allebei naar `/website-scan`. De overzichtspagina `/kennis/` staat sinds 2026-10-25 live en de tijdelijke 302 naar home is weg.

Vanaf 2026-10-25 geldt voor kennisartikelen ook [`KENNISARTIKELEN.md`](KENNISARTIKELEN.md): wekelijkse workflow, backlog van 20 artikelen (vervangt de volgorde hierboven) en extra checks.

---

## 4. Steden golf 1 en golf 2

Golf 1 (Brabant, buiten het eigen werkgebied):

| Volgorde | Stad | Slug | Mogelijke insteek (verifiëren!) |
|---|---|---|---|
| 1 (template) | Tilburg | `tilburg` | Grote stad met veel verschillende wijken, studentenstad, groeiende nieuwbouw |
| 2 | Eindhoven | `eindhoven` | Grootste stad van Brabant, veel nieuwbouw en hoogbouw, zakelijke panden |
| 3 | 's-Hertogenbosch | `s-hertogenbosch` | Historische binnenstad, winkelpanden, monumentale ramen |
| 4 | Helmond | `helmond` | Grote nieuwbouwwijken |
| 5 | Roosendaal | `roosendaal` | Middelgrote stad, mogelijk minder concurrentie |
| 6 | Bergen op Zoom | `bergen-op-zoom` | Middelgrote stad met historische kern |
| 7 | Waalwijk | `waalwijk` | Kleinere stad, bedrijventerreinen |
| 8 | Oss | `oss` | Middelgrote stad, zakelijke panden |

Golf 2 (na evaluatie): Veldhoven, Uden, Boxtel, Best, Rotterdam, Dordrecht, Utrecht, Nijmegen, Den Haag, Zwolle.

De "insteek" is een richting, geen feit. Verifieer alles voordat je het gebruikt, en laat het weg als je het niet kunt verifiëren.

---

## 5. Maps-scan (door Claude, via de browser)

> **Gewijzigd op 2026-10-24 (besluit Jeannot):** Claude doet de scan zelf in de browser, als onderdeel van het bouwen van een stadspagina. Posts zijn niet zichtbaar zonder in te loggen en eigen foto's zijn niet te onderscheiden van klantfoto's; daarom zijn `posts_laatste_30d` en `fotos_eigen_werk` vervangen door `reageert_op_reviews` en `fotos` (aantal). Bij opschalen naar honderden plaatsen: overstappen op de Google Places API.

Claude vult per stad `seo/scans/{stad}.csv` in: zoeken op "glazenwasser {stad}" (of de naam die mensen gebruiken, zoals "den bosch") in Google Maps, bij voorkeur niet ingelogd; noteer in de eerste regel van de CSV hoe er gemeten is, de eerste 3 **organische** resultaten bekijken (gesponsorde overslaan), en op hun websites controleren of er pagina's per wijk of plaats zijn.

**CSV-formaat** (één rij per bedrijf; geen namen):
```csv
datum,stad,zoekterm,positie,reviews,score,eigen_website,plaatspaginas,reageert_op_reviews,fotos
2026-10-24,Tilburg,glazenwasser tilburg,1,19,4.7,ja,nee,ja,9
```
- `positie`: 1–3
- `reviews`: aantal reviews (getal)
- `score`: gemiddelde score (bijv. 4.8)
- `eigen_website`, `plaatspaginas`, `reageert_op_reviews`: `ja` / `nee`
- `fotos`: aantal foto's op het profiel (getal)
- `type_bedrijf` (optioneel, laatste kolom): hoofdcategorie in Maps, `glazenwasser` / `schoonmaakbedrijf` / `anders`. Alleen gebruikt als elke rij hem heeft; dan zegt de samenvatting hoeveel bedrijven bovenaan niet als glazenwasser staan ingeschreven. **Uitspraken over het soort bedrijf bovenaan ("vooral schoonmaakbedrijven") staan alleen op een pagina als ze uit deze kolom komen**, nooit als losse tekst in de stads-JSON.

Maak `seo/scans/_TEMPLATE.csv` aan met de header en één voorbeeldrij die duidelijk als voorbeeld gemarkeerd is.

**Verwerking door de generator:**
- Bereken gemiddelden (reviews, score) en tellingen ("2 van de 3 hebben geen plaatspagina's").
- Leid er automatisch 2–3 kansen uit af, met regels zoals:
  - `plaatspaginas = nee` bij ≥ 2 bedrijven → kans: "de meeste bedrijven bovenaan hebben geen pagina's per wijk of kern";
  - `reageert_op_reviews = nee` bij ≥ 2 → kans: "de meeste reageren niet op hun reviews";
  - `fotos` < 10 bij ≥ 2 → kans: "weinig foto's op de profielen";
  - gemiddeld < 30 reviews → kans: "met een vaste reviewroutine is het gat te overbruggen in maanden, niet jaren". Formuleer dit altijd zonder garantie.
- Toon altijd: "Gemeten op {datum} via een zoekopdracht in Google Maps. Resultaten verschillen per locatie en per moment."

**Lukt de scan niet** (bijv. Google toont een CAPTCHA of geen resultaten)? Dan wordt de stadspagina **niet** gepubliceerd. Zet hem in `QUEUE.md` op status `wacht-op-scan` en meld dat aan Jeannot.

---

## 6. Kwaliteitscheck (`npm run seo:check`)

`check.mjs` faalt (exit code ≠ 0) als één van deze regels geschonden wordt. Een pagina die faalt wordt niet gepubliceerd.

**Per pagina:**
- Title aanwezig, uniek op de site, ≤ 60 tekens.
- Meta description aanwezig, uniek, 120–160 tekens.
- Precies één H1, uniek op de site.
- Canonical aanwezig en gelijk aan de eigen URL.
- Woordaantal: stadspagina ≥ 700 (unieke blokken ≥ 350), artikel ≥ 1.000, pijler ≥ 1.000.
- Geldige JSON-LD (parsebaar), met de juiste types per paginatype (§7).
- Minimaal 3 interne links, waaronder de pijler en `/prijzen`; geen links naar niet-bestaande pagina's.
- Alle afbeeldingen hebben `alt`, `width`, `height` en `loading="lazy"` (behalve de hero).
- Geen achtergebleven placeholders (`[[`, `TODO`, `lorem`, `{Stad}`).
- **Verboden woorden/frasen** (hoofdletterongevoelig): `gegarandeerd`, `garantie op`, `top 3 garantie`, `wij brengen je bovenaan`, `nummer 1 in google`, en namen van bedrijven uit de scans als die ooit in de data terechtkomen.
- Stad niet in de uitsluitlijst uit `config.json`.

**Uniekheid (stadspagina's onderling):**
- Bereken voor de unieke blokken de overlap met alle andere stadspagina's (bijv. Jaccard op woord-trigrammen). Faal bij overlap > 0,25.
- Bereken voor de volledige pagina de overlap. Waarschuw bij > 0,5, faal bij > 0,6.

**Uitvoer:** een leesbaar rapport per pagina (OK / WAARSCHUWING / FOUT met reden).

---

## 7. Technische SEO

- **Schema (JSON-LD)**
  - Alle pagina's: `BreadcrumbList`.
  - Site-breed (alleen op home): `ProfessionalService` met het echte adres in Oosterhout, telefoon 06 42628444, info@stam-core.nl, KvK, en `sameAs` (Facebook, Instagram, LinkedIn).
  - Pijlers en stadspagina's: `Service` (`serviceType`: "Website en lokale SEO voor glazenwassers", `provider`: verwijzing naar het ProfessionalService via `@id`, `areaServed`: `City` met de stadsnaam op stadspagina's) + `Offer`(s) uit config.
  - FAQ-blokken: `FAQPage`.
  - Artikelen: `Article` (auteur: Jeannot Kustermans, `datePublished`, `dateModified`).
- `sitemap.xml` wordt door `sitemap.mjs` volledig opnieuw gegenereerd, met `lastmod` per pagina.
- `robots.txt` verwijst naar de sitemap.
- Elke pagina heeft OG- en Twitter-tags. Gebruik een OG-afbeelding per paginatype (pijler/stad/artikel); maak ze één keer in de huisstijl (1200×630) met tekst in de afbeelding als de bestaande site dat ondersteunt, anders `og-default.jpg`.
- Prestaties: mobiel Lighthouse ≥ 90. Geen nieuwe externe scripts.
- **Interne links (automatisch door de generator):**
  - pijler `/website-glazenwasser` → alle stadspagina's + artikelen + `/seo-glazenwasser`
  - stadspagina → pijler, `/seo-glazenwasser`, `/prijzen`, 3–4 andere steden (nabij eerst)
  - artikel → beide pijlers, `/prijzen`, 1–2 relevante andere artikelen
  - homepage-blok "Branches" → pijler (bestaat al)
  - footer: link naar de pijler (bestaat al)

---

## 8. Workflow: zelfstandig nieuwe pagina's maken

### 8.1 Eerste keer (template)
1. Bouw de structuur uit §2 (of hergebruik wat er is).
2. Bouw `/seo-glazenwasser` en **Tilburg** volledig.
3. Draai `npm run seo:all`. Alles moet OK zijn.
4. **Stop en laat Jeannot beide pagina's lokaal beoordelen.** Pas na zijn akkoord is de Tilburg-pagina het vaste template.
5. Leg in `seo/README.md` vast wat er tijdens die review is aangepast, zodat het voor alle volgende pagina's geldt.

### 8.2 Elke volgende stadspagina (zelfstandig)
Als Jeannot zegt "maak de volgende stadspagina" of "verwerk de nieuwe scans":
1. Pak de bovenste stad uit `QUEUE.md` die nog niet live is, en doe de Maps-scan (§5).
2. Onderzoek de stad: wijken/kernen en bebouwingskenmerken via betrouwbare bronnen (gemeente, CBS, Wikipedia). Noteer de bronnen in het JSON-bestand onder `bronnen`.
3. Schrijf `seo/cities/{stad}.json` met alle unieke velden (zie het voorbeeld hieronder).
4. Draai `npm run seo:all`.
5. Faalt de check: herschrijf de unieke blokken en draai opnieuw. Na drie mislukte pogingen stoppen en melden.
6. Slaagt de check: commit (`seo: stadspagina {stad}`), push naar de main-branch (Netlify deployt), werk `QUEUE.md` en `LOG.md` bij.
7. Meld aan Jeannot: de URL, de title, de H1, en de herinnering om de URL in Search Console te laten indexeren (URL-inspectie → indexering aanvragen).

### 8.3 Elk kennisartikel (zelfstandig)
Hetzelfde proces, met `seo/articles/{slug}.md`. Gebruik de volgorde uit §3.4.

### 8.4 Datamodel stadspagina (voorbeeld, velden zijn verplicht)
```json
{
  "stad": "Tilburg",
  "slug": "tilburg",
  "status": "concept",
  "title": "Website glazenwasser Tilburg | Stam Core",
  "meta": "",
  "h1": "",
  "intro": "",
  "wijken": [],
  "kenmerken": "",
  "faq_stad": [
    { "vraag": "", "antwoord": "" },
    { "vraag": "", "antwoord": "" }
  ],
  "faq_pool": ["prijs", "eigendom"],
  "cta_tekst": "",
  "nabije_steden": ["eindhoven", "waalwijk", "s-hertogenbosch"],
  "scan": "scans/tilburg.csv",
  "bronnen": [],
  "gepubliceerd": null,
  "gewijzigd": null
}
```

### 8.5 `QUEUE.md`
Een tabel met: type (stad/artikel), slug, status (`wacht-op-scan` / `klaar-voor-bouw` / `live`), datum. Vul hem bij de start met alle steden uit golf 1 (Tilburg: `klaar-voor-bouw` zodra de scan er is) en alle artikelen uit §3.4.

### 8.6 Bijwerken
- Bij een nieuwe scan van een bestaande stad (elk kwartaal): data verversen, `dateModified` en `lastmod` bijwerken, opnieuw checken en publiceren.
- Wijzigingen in prijzen of voorwaarden: alleen in `config.json`, daarna `npm run seo:all`.

---

## 9. Publicatieritme en evaluatie

| Periode | Wat |
|---|---|
| Week 1 | Structuur, `/seo-glazenwasser`, Tilburg (template) → review Jeannot |
| Week 2 | De overige 7 steden uit golf 1 (zodra de scans er zijn) + artikel 1 |
| Week 3–8 | 1 kennisartikel per week (artikel 2 t/m 6) |
| Week 9–12 | Evaluatie (zie hieronder); daarna 1 stadspagina uit golf 2 per 2 weken + 1 artikel per 2 weken |

> **Regel (besluit Jeannot, 2026-10-29):** na elke golf geen nieuwe stadspagina's tot Jeannot de indexering in Search Console heeft geëvalueerd en ten minste 80% van de stadspagina's van die golf geïndexeerd is. Bestaande pagina's verbeteren mag wel, kennisartikelen gaan door.
>
> **Golf 2 geëvalueerd op 2026-10-30:** alle 10 pagina's "URL staat op Google" (samen met golf 1: 18 van 18). Pauze opgeheven; golf 3 mag gestart worden.
>
> **Hoe we "geïndexeerd" meten:** per URL de URL-inspectie in Search Console. Telt als geïndexeerd: "URL staat op Google" (groene vinkjes bij Pagina-indexering). De status van een *validatie* ("Oplossing valideren" bij een probleem, of bij Broodkruimels/FAQ onder Verbeteringen) telt **niet** mee: die loopt vaak weken achter en zegt iets over de controle van een melding, niet over of de pagina in Google staat. Groene vinkjes per pagina is dus voldoende; met 10–20 pagina's is dat handmatig te doen, daarna via het rapport Pagina-indexering (filter op de sitemap).

**Evaluatie na 8–12 weken (Jeannot in Search Console):**
- Zijn alle pagina's geïndexeerd? (Zo niet: inhoud verbeteren, niet meer pagina's maken.)
- Vertoningen en positie per pagina, en op welke zoektermen.
- Aanvragen en gesprekken die via een stadspagina binnenkwamen (ook via outreach).
- **Door naar niche 2** (bijvoorbeeld gevel-/hogedrukreiniging) als: ≥ 80% geïndexeerd, er stijgende vertoningen zijn op niche-termen, en er minstens één klant of serieus gesprek via de pagina's is ontstaan. Dupliceer dan `niches/glazenwasser.json` naar de nieuwe niche en volg hetzelfde proces.

---

## 10. Eerste opdracht voor Claude Code

1. Lees dit plan en de hele repo.
2. Laat Jeannot een kort plan zien: welke bestanden je toevoegt of wijzigt, en of je een bestaande generator hergebruikt.
3. Bouw na akkoord §2, `config.json`, `niches/glazenwasser.json`, het scan-template, `/seo-glazenwasser` en Tilburg.
4. Is de Tilburg-scan er nog niet? Bouw de pagina dan met duidelijk gemarkeerde voorbeelddata **lokaal**, publiceer hem niet, en vraag Jeannot om `seo/scans/tilburg.csv`.
5. Draai `npm run seo:all`, laat het rapport zien en wacht op de review (§8.1).
