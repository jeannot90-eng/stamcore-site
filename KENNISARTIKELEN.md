# Kennisartikelen — wekelijkse workflow

> **Voor Claude Code.** Dit bestand staat in de root van de repo van stam-core.nl naast `SEO-PLAN.md`.
> Het vult `SEO-PLAN.md` aan (§3.4 en §8.3). Bij tegenstrijdigheid geldt de strengste regel.
> Doel: elke week één kennisartikel dat Claude Code zelfstandig onderzoekt, schrijft, controleert en publiceert.

---

## 1. Startopdracht (eenmalig)

1. Lees `SEO-PLAN.md`, dit bestand en de bestaande artikelen en pagina's.
2. Zet de backlog uit §3 in `seo/QUEUE.md` (type `artikel`, status `klaar-voor-bouw`), in de aangegeven volgorde. Artikelen die er al staan of al live zijn, sla je over.
3. Maak `seo/articles/input/` aan, met daarin `_TEMPLATE.md` (zie §6).
4. Breid `seo:check` uit met de artikelregels uit §7.
5. Laat Jeannot een kort plan zien en wacht op akkoord. Daarna geldt §2 voor elke week.

*Uitgevoerd op 2026-10-25.*

---

## 2. Wekelijkse run

De run start elke maandag om 9:00 automatisch (geplande taak `kennisartikel-wekelijks` in de Claude-app; draait alleen als de app open is). Handmatig starten kan ook met: **"Schrijf het kennisartikel van deze week."**

**Besluit Jeannot (2026-10-25):** de run publiceert niet zelf. Stap 1–7 en het rapport gebeuren automatisch, met het artikel als `status: concept` (QUEUE: `concept`, niet gecommit). Pas na "akkoord" van Jeannot volgt stap 8: status `live`, `seo:all`, commit, push.

1. **Kies het onderwerp.** Neem het bovenste artikel uit `QUEUE.md` met status `klaar-voor-bouw`. Staat er voor die slug een bestand in `seo/articles/input/`, gebruik dat dan (§6).
2. **Controleer op overlap met bestaande pagina's (kannibalisatie).** Zoek op de site of een bestaande pagina al op dezelfde zoekintentie mikt (pijler, prijzen, scan, stadspagina, ander artikel). Is dat zo, verander dan de invalshoek zodat het artikel iets toevoegt, en link naar die pagina. Lukt dat niet, sla het onderwerp over, zet het op `overgeslagen` met een reden en neem het volgende.
3. **Zoekintentie bepalen.** Zoek op het hoofdzoekwoord (WebSearch) en bekijk wat er nu rankt. Beantwoord: welke vraag heeft de zoeker, welk formaat verwacht hij (stappenplan, uitleg, vergelijking, checklist), en wat missen de huidige resultaten voor een glazenwasser of klein servicebedrijf? Schrijf het artikel om precies dat gat te vullen.
4. **Feiten verzamelen.** Alles over Google-functies (Bedrijfsprofiel, reviews, PageSpeed, Search Console) controleer je op de officiële Google-helppagina's. Die veranderen vaak. Cijfers en wetgeving alleen uit betrouwbare bronnen (overheid, KVK, CBS, officiële documentatie). Zet alle bronnen in de frontmatter onder `bronnen`. Kun je iets niet verifiëren, laat het dan weg.
5. **Schrijven** volgens §4 en §5.
6. **Interne links** toevoegen volgens §5.4.
7. **Draai `npm run seo:all`.** Faalt de check, herschrijf dan en draai opnieuw. Na drie mislukte pogingen stoppen en melden.
8. **Publiceren.** Commit (`kennis: {slug}`), push naar main, werk `QUEUE.md` (status `live` + datum) en `LOG.md` bij. Voeg het artikel toe aan het blok "Kennis voor glazenwassers" op de pijler en aan de `/kennis/`-overzichtspagina (dat gebeurt automatisch via de generator).
9. **Rapport aan Jeannot**, kort:
   - URL, title, H1, hoofdzoekwoord
   - in één zin welk gat het artikel vult ten opzichte van wat nu rankt
   - herinnering: indexering aanvragen in Search Console
   - drie korte social-postconcepten (Facebook, Instagram, LinkedIn) die naar het artikel linken, met dezelfde regels (§4), zonder beloftes
   - eventuele twijfelpunten die Jeannot moet nalezen (bijv. vakinhoudelijke claims)

---

## 3. Backlog (volgorde)

| # | Slug | Werktitel | Hoofdzoekwoord | Insteek |
|---|---|---|---|---|
| 1 | `google-bedrijfsprofiel-glazenwasser` | Google Bedrijfsprofiel voor glazenwassers: zo richt je het in | google bedrijfsprofiel glazenwasser | Stap voor stap: categorie, servicegebied zonder adres, diensten, foto's, posts |
| 2 | `meer-reviews-glazenwasser` | Meer Google-reviews als glazenwasser | meer google reviews krijgen | Timing, QR op bus/factuur, appje na de ronde, reageren. Klant verstuurt zelf. |
| 3 | `website-traag-op-mobiel` | Waarom is mijn website traag op mobiel? | website traag op mobiel | Oorzaken in gewone taal + wat je zelf kunt checken; link naar /website-scan |
| 4 | `wat-kost-website-glazenwasser` | Wat kost een website voor een glazenwasser? | wat kost een website glazenwasser | Eerlijk overzicht: zelf bouwen, freelancer, bureau, Stam Core; waar je op let |
| 5 | `pagespeed-score-uitleg` | Wat betekent mijn PageSpeed-score? | pagespeed score betekenis | Scores en meetwaarden uitgelegd, wat ertoe doet; link naar /website-scan |
| 6 | `klanten-werven-glazenwasser` | Klanten werven als glazenwasser: wat werkt echt | klanten werven glazenwasser | Wijkgericht werven, flyeren bij bestaande rondes, Maps, mond-tot-mond versterken |
| 7 | `negatieve-review-reageren` | Een negatieve review: zo reageer je als vakman | reageren op negatieve review | Rustig, kort, oplossing bieden; voorbeeldopbouw zonder verzonnen cases |
| 8 | `winter-glazenwasser-omzet` | Glazenwasser in de winter: omzet op peil houden | glazenwasser winter | Abonnementen in het voorjaar, zakelijke rondes, extra diensten |
| 9 | `servicegebied-google-instellen` | Je werkgebied instellen in Google als je bij de klant werkt | servicegebied google bedrijfsprofiel | Adres verbergen, servicegebied kiezen, wat het wel en niet doet |
| 10 | `zonnepanelen-reinigen-extra-dienst` | Zonnepanelen reinigen als extra dienst online verkopen | zonnepanelen reinigen klanten | Aparte dienstpagina, plaatspagina's, uitleg voor klanten |
| 11 | `abonnement-glazenwasser-online` | Een glazenwassersabonnement online aanbieden | glazenwasser abonnement | Frequenties uitleggen, aanmelden via de site, betalen via Mollie (boekingsmodule) |
| 12 | `prijzen-op-website-glazenwasser` | Prijzen op je website zetten: wel of niet? | prijzen op website zetten | Voor- en nadelen, vanaf-prijzen, prijsindicatie per woningtype |
| 13 | `fotos-bedrijfsprofiel` | Welke foto's werken op je Bedrijfsprofiel? | foto's google bedrijfsprofiel | Bus, team, voor/na, wat je beter niet doet |
| 14 | `zakelijke-klanten-glazenwasser` | Zakelijke klanten en VvE's werven als glazenwasser | zakelijke glazenbewassing klanten | Contracten, frequentie, één factuur, wat een beheerder wil zien |
| 15 | `whatsapp-business-glazenwasser` | WhatsApp Business voor glazenwassers | whatsapp business tips | Snelle antwoorden, aankondigingen, knop op je website |
| 16 | `offerteformulier-dat-werkt` | Een aanvraagformulier dat klanten wél invullen | offerte formulier website | Weinig velden, adres, woningtype, frequentie; mobiel eerst |
| 17 | `google-ads-glazenwasser` | Google Ads voor glazenwassers: wanneer is het zinvol? | google ads glazenwasser | Lokale campagnes, seizoen, budget-denken; geen beloftes over resultaat |
| 18 | `marketingkalender-glazenwasser` | Marketingkalender voor glazenwassers: wat doe je wanneer? | marketing glazenwasser | Per seizoen: voorjaarspiek, zomer, najaar, winter |
| 19 | `starten-als-glazenwasser-online` | Net gestart als glazenwasser: zo ben je vanaf dag één vindbaar | starten als glazenwasser | Domein, profiel, eerste reviews, simpele site |
| 20 | `domeinnaam-email-glazenwasser` | Domeinnaam en zakelijk e-mailadres voor je bedrijf | domeinnaam kiezen bedrijf | Naam kiezen, .nl, e-mail op eigen domein |

Is de backlog leeg? Stel dan zelf vijf nieuwe onderwerpen voor (met slug, titel, zoekwoord en insteek) in het rapport, en wacht op akkoord van Jeannot voordat je ze in de queue zet.

---

## 4. Harde regels (aanvulling op SEO-PLAN.md §1)

1. **Geen verzonnen ervaringen.** Artikelen staan op naam van Jeannot, maar je verzint nooit persoonlijke anekdotes, klanten, gesprekken of resultaten ("vorige week had ik een klant die..."). Algemene vakkennis mag ("in het voorjaar komt de vraag tegelijk"). Persoonlijke ervaringen alleen als ze in het inputbestand staan (§6).
2. **Geen beloftes** over posities, aantallen klanten of omzet.
3. **Geen verzonnen cijfers.** Elk getal heeft een bron in de frontmatter. Geen bronvermelding in de lopende tekst ("volgens Wikipedia"); verwijs hooguit naar de officiële bron als dat de lezer echt helpt (bijv. "in de helppagina's van Google").
4. **Geen juridisch, fiscaal of financieel advies.** Bij zulke onderwerpen: algemeen uitleggen en verwijzen naar een adviseur of officiële bron.
5. **Stam Core verstuurt geen reviewverzoeken** namens klanten. De klant verstuurt ze zelf.
6. **Geen concurrenten** (bedrijven of bureaus) bij naam noemen of afkraken. Algemene tools of platforms noemen mag, neutraal.
7. **Echt nuttig zonder Stam Core.** De lezer moet na het artikel zelf iets kunnen doen. Stam Core komt pas aan het eind, kort en zonder druk.

---

## 5. Opbouw en stijl

### 5.1 Lengte en vorm
- 1.000–1.800 woorden. Liever korter en scherper dan opgevuld.
- Begin met het antwoord: de eerste alinea beantwoordt de vraag uit de titel direct (2–4 zinnen).
- Daarna uitleg met H2's en H3's die als vragen of duidelijke stappen geformuleerd zijn.
- Minimaal één praktisch onderdeel: een stappenplan, checklist of "dit kun je vandaag doen".
- Optioneel een korte FAQ (3–5 vragen) als er logische vervolgvragen zijn.
- Afsluiter: een samenvatting in 2–3 zinnen + een zachte CTA (gratis website-scan of Maps-scan via WhatsApp, of de relevante pijler).

### 5.2 Toon
- Nederlands, "je/jij", van ondernemer tot ondernemer, korte zinnen.
- Vakjargon van glazenwassers waar het past (ronde, frequentie, osmose, telescoopsteel, VvE). Leg technische webtermen kort uit.
- Geen bureautaal ("holistische strategie", "next level", "in het huidige digitale landschap").
- Geen opsommingen van lege tips. Elke tip is concreet: wat, waarom, hoe.

### 5.3 SEO
- **Title:** ≤ 60 tekens, met het hoofdzoekwoord vooraan, eindigend op ` | Stam Core` als dat past.
- **Meta description:** 120–160 tekens, met het hoofdzoekwoord en een concreet voordeel.
- **H1:** mag afwijken van de title, met het hoofdzoekwoord.
- **URL:** `/kennis/{slug}`.
- Gebruik het hoofdzoekwoord natuurlijk in de eerste alinea en in minimaal één H2. Gebruik verwante termen en synoniemen; geen opgepropte zoekwoorden.
- **Schema:** `Article` (headline, author "Jeannot Kustermans" met verwijzing naar de site, publisher Stam Core, datePublished, dateModified, image), `BreadcrumbList` (Home › Kennis › Titel), en `FAQPage` als er een FAQ is.
- **Afbeelding:** één OG-afbeelding per artikel in de huisstijl (1200×630) met de titel. Geen stockfoto's van wolkenkrabbers. In de tekst alleen afbeeldingen die iets uitleggen (bijv. een schematische weergave); geen screenshots van concurrenten.

### 5.4 Interne links
- Naar minimaal één pijler (`/website-glazenwasser` of `/seo-glazenwasser`).
- Naar `/website-scan` als het artikel over websites, snelheid of vindbaarheid gaat.
- Naar `/prijzen` alleen als prijs relevant is.
- Naar 1–2 andere live kennisartikelen met een verwant onderwerp.
- Pas bij publicatie 1–2 bestaande artikelen aan zodat ze naar het nieuwe artikel linken, waar dat inhoudelijk past.
- Ankerteksten beschrijvend ("je Bedrijfsprofiel goed inrichten"), niet "klik hier".

---

## 6. Inputbestand van Jeannot (optioneel)

Jeannot kan per onderwerp `seo/articles/input/{slug}.md` aanmaken (kopieer `seo/articles/input/_TEMPLATE.md`), met daarin:

```markdown
---
slug: meer-reviews-glazenwasser
---
## Eigen ervaring (mag letterlijk of herschreven gebruikt worden)
- ...

## Wat ik zeker wil noemen
- ...

## Wat ik niet wil
- ...
```

- Staat er een inputbestand: verwerk de ervaring en de wensen. Persoonlijke ervaringen alleen zoals Jeannot ze beschrijft, niet aandikken.
- Staat er geen: schrijf zonder persoonlijke anekdotes (§4.1).

---

## 7. Extra checks in `seo:check` voor artikelen

Gemeten op de Markdown van het artikel (+ FAQ), niet op de vaste blokken van het template (die linken altijd al naar beide pijlers en `/prijzen`).

Faal als:
- het woordaantal < 1.000 of > 2.200 is;
- het hoofdzoekwoord (frontmatter `zoekwoord`) niet in de title, de H1 of de eerste alinea staat (elk woord van het zoekwoord als begin van een woord, dus "glazenwasser" telt in "glazenwassers");
- er minder dan 3 interne links in de artikeltekst zijn, of geen link naar een pijler;
- `bronnen` leeg is terwijl de tekst getallen of jaartallen bevat;
- er bronvermeldingen in de lopende tekst staan ("volgens Wikipedia", "bron:");
- verboden frasen voorkomen (`verboden` + `verboden_artikel` in `seo/config.json`), tenzij die passage letterlijk uit het inputbestand komt;
- de title of H1 al op een andere pagina bestaat;
- een zin van 12+ woorden letterlijk in een ander artikel voorkomt (let op: varieer dus ook de introductie over Jeannot);
- de JSON-LD niet parsebaar is of `Article` ontbreekt.

Waarschuw (niet falen) als:
- de eerste alinea langer is dan 80 woorden;
- er geen stappenplan, checklist of genummerde lijst in staat;
- het artikel ouder is dan 12 maanden en over Google-functies gaat (dan opnieuw controleren en `dateModified` bijwerken).

---

## 8. Frontmatter

Volgt het bestaande formaat uit `seo/README.md` (één veld per regel, lijsten/objecten als JSON). De slug is de bestandsnaam: `seo/articles/{slug}.md`.

```markdown
---
status: concept
title: Meer Google-reviews als glazenwasser | Stam Core
meta: …120–160 tekens…
h1: Zo krijg je als glazenwasser meer Google-reviews
zoekwoord: meer google reviews krijgen
datePublished: 2026-11-01
dateModified: 2026-11-01
og: ["Meer Google-reviews", "als glazenwasser", "…", "…"]
gerelateerd: ["google-bedrijfsprofiel-glazenwasser", "negatieve-review-reageren"]
faq: [{"vraag": "…", "antwoord": "…"}]
bronnen: ["https://support.google.com/… (waarvoor)"]
---
```

`status: concept` bouwt naar `_preview/` (noindex); `status: live` publiceert.

---

## 9. Onderhoud (elke 4e run)

Doe bij elke vierde wekelijkse run, naast het nieuwe artikel:
- Controleer het oudste live artikel over Google-functies tegen de actuele Google-helppagina's. Werk het bij als er iets veranderd is (en `dateModified`).
- Controleer alle interne links in `/kennis/` op dode links.
- Meld in het rapport welk artikel is nagelopen en wat er veranderd is.

Houd in `seo/LOG.md` bij welk run-nummer elke publicatie is, zodat duidelijk is wanneer de 4e run valt.
