# Gratis Website-Scan (`/website-scan`)

Publieke lead-tool: bezoeker vult webadres + e-mail in en krijgt direct een beknopt rapport. Elke scan is een lead via **Netlify Forms** (formulier `website-scan`), dus dezelfde route als het contactformulier: `submission-created` stuurt hem door naar de cockpit (lead-ingest).

| Onderdeel | Bestand | Wat |
|---|---|---|
| Pagina | `website-scan.html` | Formulier, laadstappen, rapport, CTA. Verstuurt de lead (met scores en verbeterpunten in `bericht`) zodra het rapport klaar is, of bij het sluiten van de pagina. |
| Stap 1 | `netlify/functions/scan-start.mjs` → `POST /api/scan/start` | Invoercontrole, honeypot, rate-limit, homepage ophalen + on-page checks, ondertekende scan-token. |
| Stap 2 | `netlify/edge-functions/scan-psi.js` → `GET /api/scan/psi` | PageSpeed mobiel/desktop. Edge Function omdat PageSpeed langer duurt dan de 10 s-limiet van een gewone function. |
| Gedeeld | `netlify/lib/website-scan.mjs` | Validatie, SSRF-veilig ophalen, on-page analyse, token, rate-limit. |

## Environment variables (Netlify → Site configuration → Environment variables, scope: All)

| Variabele | Waarvoor |
|---|---|
| `SCAN_TOKEN_SECRET` | Willekeurige tekst van 40+ tekens: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `PAGESPEED_API_KEY` | Google PageSpeed-key (dezelfde als `PSI_API_KEY` van `tools/audit` kan). |

Zonder `SCAN_TOKEN_SECRET` geeft de scan een foutmelding. Zonder PageSpeed-key valt alleen de snelheidsmeting vaak weg (gedeelde quota).

**Notificatie per scan:** Netlify → Forms → `website-scan` → Form notifications → e-mail.

## Deployen

1. Env vars hierboven instellen.
2. Branch naar `main` mergen en pushen.
3. Eén testscan doen en controleren dat hij in Netlify Forms én in de cockpit verschijnt (lead-ingest moet het formulier `website-scan` accepteren; velden: naam, email, bedrijf, website, interesse, herkomst, bericht, score_*).

Lokaal: `netlify dev` met de variabelen in een `.env` (staat in `.gitignore`).

## Beveiliging

Keys alleen in Netlify-env; PageSpeed alleen met geldige token (HMAC, 15 min); honeypot + minimale invultijd; Netlify rate-limit + eigen limiet per IP/e-mail; alleen openbare http(s)-adressen (DNS-check per redirect, max 2,5 MB / 6 s); Netlify-spamfilter op de inzending; toestemmingsvinkje + privacyverklaring bijgewerkt.
