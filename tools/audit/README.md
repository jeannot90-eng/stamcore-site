# Stam Core website-audit

Interne CLI om de website van een prospect door te lichten en een gebrand verbeterrapport (HTML) te maken.

## Installeren

```bash
pip install -r tools/audit/requirements.txt
```

PageSpeed-key (gratis, [aanmaken](https://developers.google.com/speed/docs/insights/v5/get-started)) als omgevingsvariabele `PSI_API_KEY`, of per run met `--key`. Zonder key werkt PageSpeed met een gedeelde quota die vaak op is (fout 429). De rest van de scan draait dan gewoon door.

## Gebruik

```bash
python tools/audit/stamcore_scan.py voorbeeld.nl
python tools/audit/stamcore_scan.py voorbeeld.nl --bedrijf "Glazenwasserij Jansen" --dienst glazenwasser --plaats Tilburg
python tools/audit/stamcore_scan.py voorbeeld.nl --competitor concurrent.nl --json
python tools/audit/stamcore_scan.py voorbeeld.nl --no-psi --pages 25
```

| Optie | Wat |
|---|---|
| `--key` | PageSpeed API-key (anders `PSI_API_KEY` / `GOOGLE_API_KEY`) |
| `--pages N` | max pagina's crawlen (default 10) |
| `--competitor URL` | concurrent meescannen + gap-analyse |
| `--json [PAD]` | alle ruwe data als JSON (default naast het rapport) |
| `--out PAD` | pad voor het HTML-rapport |
| `--bedrijf`, `--dienst`, `--plaats` | vullen de kop en de zoeklinks in "Nog handmatig checken" |
| `--no-psi`, `--no-links` | PageSpeed of de linkcheck overslaan (sneller) |
| `--timeout S` | timeout per request (default 15) |
| `--user-agent` | eigen User-Agent (default: gewone Chrome) |
| `-q` | alleen de samenvatting |

Rapporten komen in `tools/audit/rapporten/`. Die map staat in `.gitignore`: daar staan prospectgegevens, die horen niet in git of op de site.

## Wat er gecheckt wordt

- **PageSpeed Insights** (mobiel + desktop): performance, SEO, toegankelijkheid, best practices, labmetingen (LCP, CLS, FCP, TBT, Speed Index), CrUX-velddata (pagina of domein) en de grootste verbeterkansen. Draait op de achtergrond terwijl de crawler werkt.
- **Crawl**: vanaf de homepage, interne links breadth-first, tot `--pages`.
- **On-page per pagina**: title/description (+ lengte), noindex, H1/H2-structuur, canonical, viewport, `lang`, hreflang, Open Graph, Twitter card, JSON-LD/microdata-types, alt-tekstdekking, woordtelling, interne/externe links, tel:/mailto:/WhatsApp. Site-breed: dubbele titles/descriptions, dunne pagina's.
- **Techniek**: HTTPS, http→https (301?), www/zonder-www, HSTS, robots.txt (blokkeert alles?, sitemapregel), sitemap.xml (ook index-sitemaps), mixed content, geschat paginagewicht, 404-afhandeling (soft 404), serverreactietijd, compressie, IPv6-bereikbaarheid.
- **Tracking**: GA4, oude UA, GTM, Google Ads, Meta pixel, Hotjar/Clarity/LinkedIn/TikTok/Matomo/Plausible, Search Console-verificatie, cookiebanner, CMS.
- **Links**: alle links op de homepage (HEAD, bij twijfel GET). Sites die bots blokkeren (LinkedIn, Facebook, 403/429/999) gelden als "onzeker", niet als kapot.
- **Concurrent** (`--competitor`): zelfde scan, vergelijkingstabel en extra verbeterpunten bij grote achterstand.

## Code-opbouw

```
stamcore_scan.py       CLI: argumenten, bestanden wegschrijven, terminalsamenvatting
scanner/
  http.py              defensieve HTTP-client (gooit nooit exceptions, IPv6-fallback per host)
  urls.py              normaliseren, intern/extern
  crawl.py             pagina's verzamelen
  onpage.py            on-page analyse + site-brede samenvatting
  technical.py         techniek-checks
  tracking.py          tools/CMS-detectie (patronen bovenaan het bestand)
  links.py             kapotte links
  psi.py               PageSpeed Insights API
  audit.py             voert alles uit voor één site, levert één dict
  findings.py          regels → geprioriteerde verbeterpunten
  gap.py               prospect vs. concurrent
  report.py            HTML-rapport (CSS onderaan)
  models.py            checklist-items, sectiescore, Finding
```

### Uitbreiden

- **Nieuw verbeterpunt**: functie met `@rule` in `findings.py`. Krijgt een `Ctx` en geeft `None` of een `Finding` terug (impact 1–10, `why` in prospecttaal). Een regel die crasht wordt overgeslagen.
- **Nieuwe check in een checklist**: voeg een `check(label, PASS/WARN/FAIL/INFO, detail)` toe in de `build_checks`/`_page_checks` van de module. De sectiescore telt automatisch mee (`info` niet).
- **Nieuwe tool herkennen**: regex toevoegen aan `PATTERNS`/`LABELS` (of `CONSENT`/`CMS`) in `tracking.py`.
- **Nieuwe vergelijkingsregel**: regel in `METRICS` in `gap.py`.
- **Drempels** (title-/descriptionlengte, dunne content): bovenaan `onpage.py`.

Exitcode is `2` als de homepage niet bereikbaar was, anders `0`.
