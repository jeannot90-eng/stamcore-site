# Gratis Website-Scan (`/website-scan`)

Publieke tool: een bezoeker vult alleen een webadres in en ziet direct een rapport. Geen e-mail en geen account nodig. Wie wil dat Jeannot meekijkt, vult onder het rapport het optionele formulier in. Dat gaat als Netlify Forms-inzending "website-scan" naar je mail en (via `submission-created`) naar de cockpit.

| Onderdeel | Bestand | Wat |
|---|---|---|
| Pagina | `website-scan.html` | Tool, rapport, optioneel contactformulier, uitleg, voorbeeld, FAQ (FAQPage-schema). `?url=…` start automatisch. `?bron=…` gaat mee naar het logboek en het formulier. |
| Stap 1 | `netlify/functions/scan-start.mjs` → `POST /api/scan/start` | Controle, honeypot, botfilter, rate limit (10 per IP per uur), homepage-checks, scan loggen, token. |
| Stap 2 | `netlify/edge-functions/scan-psi.js` → `GET /api/scan/psi` | PageSpeed mobiel/desktop. Edge Function omdat PageSpeed langer duurt dan de 10 s van een gewone function. |
| Stap 3 | `netlify/functions/scan-log.mjs` → `POST /api/scan/log` | Scores bij de gelogde scan zetten. |
| Noindex | `netlify/edge-functions/scan-noindex.js` | `X-Robots-Tag: noindex` op `/website-scan?url=…` (gedeelde links). De canonical blijft `/website-scan`. |
| Opslag | `netlify/lib/scan-store.mjs` | Netlify Blobs: store `website-scans` (logboek, 12 maanden) en `website-scan-limiet` (gehasht IP per uur). |
| Blok | `templates/partials/scanblok.html` | "Scan eerst je eigen website". Wordt door `npm run seo:all` ingevuld waar `<!-- partial:scanblok -->` staat. De bron wordt automatisch de pagina zelf. |

## Logboek bekijken

Netlify → project **stamcore** → **Blobs** → store **website-scans**. Per scan: tijd, URL, bron, homepage-checks, scores. Geen IP, naam of e-mail. Of in de terminal:

```bash
netlify blobs:list website-scans
```

## Environment variables

| Variabele | Waarvoor |
|---|---|
| `SCAN_TOKEN_SECRET` | Ondertekent de scan-token en dient als zout voor de IP-hash. |
| `PAGESPEED_API_KEY` | Google PageSpeed-key (alleen in de Edge Function, nooit in de pagina). |

## Lokaal testen

`netlify dev`, met de twee variabelen in een `.env` in de root (staat in `.gitignore`). Blobs werkt lokaal automatisch in `.netlify/blobs-serve`.
