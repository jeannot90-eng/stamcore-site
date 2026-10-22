# stam-core.nl

Statische site op Netlify. **Netlify bouwt niets**: alles wat gegenereerd wordt (CSS, plaatspagina's, sitemap) draai je lokaal en commit je mee.

```bash
npm install          # eenmalig (Tailwind)
npm run build        # = npm run build:css + npm run generate (in die volgorde)
```

| Script | Wat het doet |
|---|---|
| `npm run generate` | Maakt branche × plaats-pagina's uit `data/seo-paginas.json`, werkt de plaatslijst op de pijlerpagina's bij, vult gedeelde header/footer/scripts in en werkt `sitemap.xml` bij. |
| `npm run generate -- --check` | Alleen controleren, niets schrijven. |
| `npm run generate -- --preview` | Rendert ook concept-records naar `_preview/` (staat niet in git) om ze te bekijken. |
| `npm run build:css` | Compileert Tailwind naar `assets/app.css`. Draai daarna altijd `npm run generate`, want die zet de CSS inline in elke pagina. Gewoon `npm run build` doet beide. |

## URL-structuur

| Type | Patroon | Voorbeeld | Bestand |
|---|---|---|---|
| Branchepijler | `/website-{niche}` | `/website-glazenwasser` | handgeschreven `website-glazenwasser.html` |
| SEO-pijler (optioneel) | `/seo-{niche}` | `/seo-glazenwasser` | handgeschreven `seo-glazenwasser.html` |
| Branche × plaats | `/website-{niche}-{plaats}` | `/website-glazenwasser-tilburg` | **gegenereerd** uit `data/seo-paginas.json` |

- Nieuwe pagina's zijn **zonder `.html`** (Netlify serveert `/prijzen` uit `prijzen.html`). Canonical, sitemap en interne links gebruiken ook de versie zonder `.html`.
- Bestaande pagina's (`/front-end.html`, `/core.html`, `/werk.html`, `/privacy.html`) houden hun huidige URL. De verwijderde AI-pagina's en kennisartikelen hebben een redirect in `_redirects`; `/kennis/` tijdelijk (302), omdat er later nieuwe artikelen komen.
- Plaatsnamen worden automatisch een slug: kleine letters, geen accenten of apostrofs, spaties worden `-` (`'s-Hertogenbosch` → `s-hertogenbosch`).
- Moet een URL ooit veranderen: zet een 301 in `_redirects`.

**Interne links:** home → `#branches` → pijler → plaatspagina's (de generator zet ze automatisch onder de pijler, tussen `<!-- PLAATSEN:START -->` en `<!-- PLAATSEN:END -->`). Plaatspagina's linken terug naar de pijler via de broodkruimel, het systeemblok en de CTA. Elke pagina heeft BreadcrumbList-schema.

## Een plaatspagina toevoegen

1. Voeg één record toe aan `paginas` in `data/seo-paginas.json`, met `"status": "concept"`.
2. Vul alle velden (zie hieronder). Bekijk hem met `npm run generate -- --preview` en open `_preview/website-{niche}-{plaats}.html`.
3. Zet `"status": "live"` en draai `npm run build`.
4. Controleer de pagina lokaal, commit en push.

Nieuwe pagina's met de hand? Zet in de `<head>` gewoon `<link rel="stylesheet" href="/assets/app.css">`; `npm run generate` maakt er inline CSS van.

Een nieuwe **branche** (niche): voeg hem toe aan `niches`, kopieer `website-glazenwasser.html` naar `website-{niche}.html` en herschrijf **alle** tekst voor die branche. Laat in de kopie de markers `<!-- PLAATSEN:START --><!-- PLAATSEN:END -->` en `<!-- partial:… -->` staan. Zet de pijler met de hand in `sitemap.xml` (buiten het gegenereerde blok) en voeg een blok toe aan `#branches` op de homepage.

### Velden per record

| Veld | Uniek per pagina? | Eis bij `live` |
|---|---|---|
| `niche` | — | moet bestaan in `niches` |
| `plaats` | ja | |
| `slug` | ja | optioneel; standaard `website-{niche}-{plaats}` |
| `title` | **ja** | gevuld, liefst ≤ 60 tekens, niet gelijk aan een andere pagina |
| `meta` | **ja** | gevuld, liefst 120–160 tekens |
| `h1` | **ja** | gevuld |
| `intro` | **ja** | minimaal 2 alinea's en 80 woorden, niet hetzelfde als de intro van een andere plaatspagina |
| `scan.zoekterm`, `scan.datum`, `scan.samenvatting` | **ja** | gevuld |
| `scan.bedrijven` | **ja** | minimaal 3, elk met `naam` en `reviews` (getal); `score` mag 0 = onbekend |
| `scan.kansen` | **ja** | minimaal 1 |
| `wijken` | **ja** | minimaal 3 wijken of kernen |
| `beschikbaarheid` | optioneel | tekst (bijv. "Nog beschikbaar in Tilburg") of `""` |
| `faq` | **ja** | minimaal 3 vragen met antwoord (komt ook in FAQPage-schema) |

De vaste blokken (systeem, prijzen, case, CTA) staan in `templates/branche-plaats.html` en zijn op elke plaatspagina gelijk.

## Publicatieregel

> **Een plaatspagina mag pas live als de unieke blokken echt gevuld zijn:** intro, lokale concurrentiescan, wijken/kernen en FAQ, specifiek voor die plaats.

De generator handhaaft dit. Een record op `live` met een leeg veld, een `[[INVULLEN]]` of `[[OPTIONEEL]]`, te weinig woorden, of een intro die te veel lijkt op die van een andere pagina: dan stopt hij en schrijft hij **niets**. Maar een script ziet niet of een tekst klopt. Dezelfde alinea herschrijven en alleen de plaatsnaam veranderen is geen unieke inhoud, en Google ziet dat ook. Schrijf per plaats echt iets over die plaats.

Een record dat niet meer `live` is, wordt bij de volgende `npm run generate` verwijderd, samen met zijn plek in de sitemap en op de pijler. Zet daarna een 301 in `_redirects` naar de pijler, want de URL is al geïndexeerd.

## Gedeelde blokken

`templates/partials/header.html`, `footer.html` en `scripts.html` zijn de bron voor de nieuwe header, footer en scripts. Elke pagina met `<!-- partial:naam --> … <!-- /partial:naam -->` krijgt bij `npm run generate` de actuele versie (nu: home, prijzen, de pijler(s) en alle plaatspagina's). De oudere pagina's (`front-end`, `core`, `werk`, `privacy`) hebben nog hun eigen header en footer.

## Placeholders

`[[INVULLEN: …]]` betekent dat Jeannot iets moet aanleveren. Zoek ze met:

```bash
grep -rn "\[\[INVULLEN" --include=*.html .
```

Deploy niet zolang er nog `[[INVULLEN]]` op een pagina staat.

## Prestaties

- Afbeeldingen als WebP met `width`/`height`, `loading="lazy"` en `decoding="async"`. De originele `.jpg`'s blijven staan als bron (en `og-default.jpg` voor social).
- Geen nieuwe JavaScript-libraries. Doel: Lighthouse mobiel ≥ 90.
- Google Fonts laden niet-blokkerend (`rel="preload"` + `onload`), alleen de gewichten die gebruikt worden (Space Grotesk 600/700, Inter 400–700).
- De CSS staat inline in elke pagina (tussen `<!-- css:app -->` en `<!-- /css:app -->`), zodat er geen render-blokkerend CSS-verzoek is. `assets/app.css` blijft de bron. Tailwind slaat het inline blok over bij het scannen.
- `/templates/*`, `/data/*` en `/scripts/*` geven via `_redirects` een 404.
