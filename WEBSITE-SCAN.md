# Gratis Website-Scan (`/website-scan`)

Publieke lead-tool: een bezoeker vult zijn webadres en e-mailadres in en krijgt direct een beknopt rapport. Elke scan komt als contact in Brevo.

## Hoe het werkt

| Onderdeel | Bestand | Wat |
|---|---|---|
| Pagina | `website-scan.html` | Formulier, laadstappen en rapport (stoplichten, top 3–5 verbeterpunten, CTA). De verbeterpunten worden in de browser samengesteld uit de meetgegevens. |
| Stap 1 | `netlify/functions/scan-start.mjs` → `POST /api/scan/start` | Controleert de invoer, honeypot en rate-limit. Haalt de homepage op en doet de on-page checks (title, description, H1, viewport, canonical, schema.org, alt-teksten, https, noindex, tel/WhatsApp, Open Graph). Zet het contact in Brevo en geeft een ondertekende scan-token terug. |
| Stap 2 | `netlify/edge-functions/scan-psi.js` → `GET /api/scan/psi?strategy=mobile\|desktop` | Google PageSpeed (performance, SEO, toegankelijkheid, best practices, LCP, CLS). Mobiel en desktop lopen parallel. Werkt alleen met een geldige token. |
| Stap 3 | `netlify/functions/scan-complete.mjs` → `POST /api/scan/complete` | Zet de scores bij het contact in Brevo en stuurt jou (optioneel) een notificatiemail. |
| Gedeeld | `netlify/lib/website-scan.mjs` | Validatie, veilig ophalen van de homepage, on-page analyse, token, rate-limit, Brevo. |

**Waarom PageSpeed als Edge Function?** Een PageSpeed-meting duurt 10–20 seconden. Een gewone (synchrone) Netlify Function heeft standaard een tijdslimiet van 10 seconden. Een Edge Function mag ongeveer 40 seconden op een antwoord wachten.

## Environment variables

Zet ze in Netlify: **Site configuration → Environment variables**. Scope: *Functions* én *Edge Functions*, of gewoon "All". Ze komen nooit in de pagina terecht.

| Variabele | Verplicht | Waarvoor |
|---|---|---|
| `SCAN_TOKEN_SECRET` | ja | Lange willekeurige tekst (minimaal 16 tekens, liever 40+). Ondertekent de scan-token tussen stap 1 en 2/3. Maak er een met `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. |
| `PAGESPEED_API_KEY` | ja | Google PageSpeed Insights API-key ([aanmaken](https://developers.google.com/speed/docs/insights/v5/get-started)). Zonder key werkt het op een gedeelde quota die vaak vol is (de snelheidsmeting valt dan weg, de rest van het rapport werkt wel). |
| `BREVO_API_KEY` | ja | Brevo → SMTP & API → API-sleutels (v3). |
| `BREVO_LIST_ID` | ja | ID van de lijst voor scan-leads (Brevo → Contacten → Lijsten, het nummer achter de naam). |
| `LEAD_NOTIFY_EMAIL` | nee | Jouw adres. Krijgt per scan een mail met e-mail, website, scores en verbeterpunten. Antwoorden gaan direct naar de prospect. |
| `BREVO_SENDER_EMAIL` | nee | Afzenderadres voor die notificatie. Moet in Brevo geverifieerd zijn (Afzenders & IP). Zonder deze variabele wordt er geen notificatie gestuurd. |

### Contactattributen in Brevo

Maak deze aan via Contacten → Instellingen → Contactattributen:

| Attribuut | Type |
|---|---|
| `WEBSITE` | Tekst |
| `SCAN_DATUM` | Datum |
| `BRON` | Tekst (vult `website-scan`) |
| `SCORE_MOBIEL` | Getal |
| `SCORE_DESKTOP` | Getal |
| `SCORE_SEO` | Getal |

Bestaan ze nog niet, dan weigert Brevo de attributen. De functie probeert het dan opnieuw met alleen het e-mailadres en de lijst, zodat de lead niet verloren gaat. De scores ontbreken dan wel.

## Deployen

1. Zet de environment variables hierboven in Netlify.
2. Merge deze branch naar `main` en push. Netlify bouwt de functions automatisch: `node_bundler = "esbuild"` staat in `netlify.toml` en de Edge Function staat in `netlify/edge-functions/`.
3. Test op de live site: doe een scan met je eigen adres en controleer of het contact in Brevo verschijnt en (als ingesteld) de notificatie binnenkomt.

Lokaal testen:

```bash
netlify dev
```

Zet de variabelen dan in een `.env`-bestand in de root. Dat staat in `.gitignore`; commit het nooit.

## Beveiliging en misbruik

- **Keys** staan alleen in Netlify environment variables, niet in de pagina.
- **Scan-token:** stap 2 en 3 werken alleen met een token die stap 1 heeft ondertekend (HMAC, 15 minuten geldig). Niemand kan dus onze PageSpeed-key of Brevo-koppeling rechtstreeks aanroepen.
- **Botfilter:** een verborgen honeypot-veld, en een formulier dat binnen 2 seconden wordt verstuurd telt als bot.
- **Rate-limit:**
  - Netlify's eigen rate-limit per IP staat in de `config` van elke functie (10/min voor start, 20/min voor PageSpeed).
  - Daarnaast telt de functie zelf: 5 scans per IP per 10 minuten en 5 per e-mailadres per dag. Die telling geldt per warme instantie en is dus een extra rem, geen harde grens.
- **SSRF-bescherming:** alleen openbare http(s)-adressen op poort 80/443. Het adres wordt via DNS opgezocht en geweigerd als het naar een intern of privé-adres wijst; dat gebeurt opnieuw bij elke doorverwijzing. Maximaal 2,5 MB en 6 seconden per pagina.
- **Tikfouten:** een domein dat niet bestaat levert geen lead op; de bezoeker krijgt een foutmelding en kan het adres verbeteren.
- **AVG:** toestemming via een verplicht vinkje. De privacyverklaring noemt de scan, Brevo en PageSpeed.

## Bekende grenzen

- Alleen de homepage, geen crawl. Voor de uitgebreide versie: `tools/audit` (intern).
- De scores die bij de lead in Brevo komen, stuurt de browser mee naar stap 3. In theorie kan iemand die vervalsen. Voor een lead is dat geen probleem.
- Sluit de bezoeker de pagina vóór het rapport klaar is, dan staat het contact wel in Brevo (stap 1), maar zonder scores en zonder notificatie.
