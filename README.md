# stam-core.nl

Statische site op Netlify. **Netlify bouwt niets**: alles wat gegenereerd wordt (CSS, SEO-pagina's, sitemap) draai je lokaal en commit je mee.

```bash
npm install          # eenmalig (Tailwind)
npm run build        # = npm run build:css + npm run seo:all (in die volgorde)
```

| Script | Wat het doet |
|---|---|
| `npm run seo:all` | Bouwt de SEO-pagina's (stadspagina's, `/seo-glazenwasser`, kennisartikelen), vult header/footer/scripts en inline CSS in alle pagina's, draait de kwaliteitscheck en schrijft `sitemap.xml`. Zie [`seo/README.md`](seo/README.md). `npm run generate` doet hetzelfde. |
| `npm run build:css` | Compileert Tailwind naar `assets/app.css`. Draai daarna altijd `seo:all`, want die zet de CSS inline in elke pagina. Gewoon `npm run build` doet beide. |

Het SEO-plan staat in [`SEO-PLAN.md`](SEO-PLAN.md) en is leidend voor alle SEO-pagina's.

## URL-structuur

| Type | Patroon | Voorbeeld | Bestand |
|---|---|---|---|
| Branchepijler | `/website-{niche}` | `/website-glazenwasser` | handgeschreven `website-glazenwasser.html` |
| SEO-pijler | `/seo-{niche}` | `/seo-glazenwasser` | **gegenereerd** uit `seo/templates/seo-pijler.html` |
| Stadspagina | `/website-{niche}-{stad}` | `/website-glazenwasser-tilburg` | **gegenereerd** uit `seo/cities/{stad}.json` |
| Kennisartikel | `/kennis/{slug}` | `/kennis/meer-reviews-glazenwasser` | **gegenereerd** uit `seo/articles/{slug}.md` |

- Nieuwe pagina's zijn **zonder `.html`** (Netlify serveert `/prijzen` uit `prijzen.html`). Canonical, sitemap en interne links gebruiken ook de versie zonder `.html`.
- Bestaande pagina's (`/front-end.html`, `/werk.html`, `/privacy.html`) houden hun huidige URL. De verwijderde AI-pagina's, `core.html` en de oude kennisartikelen hebben een redirect in `_redirects`; `/kennis` en `/kennis/` tijdelijk (302) naar de home.
- Plaatsnamen worden automatisch een slug: kleine letters, geen accenten of apostrofs, spaties worden `-` (`'s-Hertogenbosch` → `s-hertogenbosch`).
- Moet een URL ooit veranderen: zet een 301 in `_redirects`.

**Interne links:** home → `#branches` → pijler → stadspagina's en artikelen (de generator zet ze onder de pijler, tussen `<!-- PLAATSEN:START/END -->` en `<!-- KENNIS:START/END -->`). Stadspagina's linken naar de pijler, `/seo-glazenwasser`, `/prijzen` en nabije steden. Elke SEO-pagina heeft BreadcrumbList-schema.

## Publicatieregel

> **Een SEO-pagina gaat pas live als `npm run seo:check` zonder fouten draait**, en een stadspagina alleen met een echte Maps-scan in `seo/scans/`.

Maar een script ziet niet of een tekst klopt. Dezelfde alinea herschrijven en alleen de plaatsnaam veranderen is geen unieke inhoud. Schrijf per plaats echt iets over die plaats, met feiten die je kunt verifiëren.

Een stadspagina die niet meer `live` is, wordt bij de volgende build verwijderd (en uit sitemap en pijler gehaald). Zet daarna een 301 in `_redirects` naar de pijler, want de URL is al geïndexeerd.

## Gedeelde blokken

`templates/partials/header.html`, `footer.html` en `scripts.html` zijn de bron voor de nieuwe header, footer en scripts. Elke pagina met `<!-- partial:naam --> … <!-- /partial:naam -->` krijgt bij `npm run generate` de actuele versie (nu: home, prijzen, de pijlers en alle SEO-pagina's). De oudere pagina's (`front-end`, `werk`, `privacy`) hebben nog hun eigen header en footer.

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
- `/templates/*`, `/data/*`, `/seo/*` en `/scripts/*` geven via `_redirects` een 404.
- Fonts (Inter en Space Grotesk, SIL Open Font License) staan zelf-gehost in `assets/fonts/` en worden voorgeladen; geen verbinding met Google Fonts meer.
