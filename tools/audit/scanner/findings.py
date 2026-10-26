"""Regels die het auditresultaat omzetten in geprioriteerde verbeterpunten.

Uitbreiden = een functie toevoegen met @rule. Een regel krijgt een Ctx (snelle toegang
tot de onderdelen van het resultaat) en geeft None, één Finding of een lijst Findings.
Een regel die crasht wordt overgeslagen (en gemeld in de terminal), de rest gaat door.

Impact-schaal (1-10), zie models.Finding. Houd 'why' in prospect-taal: wat kost het
ze aan klanten of zichtbaarheid, niet hoe het technisch heet.
"""

import sys

from .models import Finding

RULES = []


def rule(fn):
    RULES.append(fn)
    return fn


class Ctx:
    """Handige snelkoppelingen naar delen van het resultaat (altijd veilig, nooit KeyError)."""

    def __init__(self, r: dict):
        self.r = r
        self.pages = r.get("pages") or []
        self.home = self.pages[0] if self.pages else None
        self.site = (r.get("onpage") or {}).get("stats") or {}
        self.tech = r.get("technical") or {}
        self.track = r.get("tracking") or {}
        self.links = r.get("links") or {}
        psi = r.get("psi") or {}
        self.mobile = psi.get("mobile") or {}
        self.desktop = psi.get("desktop") or {}
        self.scores = r.get("scores") or {}

    def t(self, key) -> dict:
        return self.tech.get(key) or {}


def build(r: dict) -> list[Finding]:
    ctx = Ctx(r)
    out = []
    for fn in RULES:
        try:
            res = fn(ctx)
        except Exception as exc:  # noqa: BLE001 - één kapotte regel mag het rapport niet slopen
            print(f"  ! regel {fn.__name__} overgeslagen: {exc}", file=sys.stderr)
            continue
        if res:
            out.extend(res if isinstance(res, list) else [res])
    out.sort(key=lambda f: (-f.impact, f.category, f.key))
    return out


def _ms(v):
    return f"{v / 1000:.1f} s" if v >= 1000 else f"{v:.0f} ms"


# =========================================================================== bereikbaarheid

@rule
def unreachable(c: Ctx):
    if c.r.get("reachable"):
        return None
    hf = c.r.get("home_fetch") or {}
    return Finding("unreachable", "Website is niet (goed) bereikbaar", 10, "Techniek",
                   "Als de site niet laadt voor onze scanner, laadt hij waarschijnlijk ook niet "
                   "(altijd) voor Google en bezoekers. Elke bezoeker die een foutmelding ziet, belt de concurrent.",
                   "Hosting, DNS en certificaat nalopen en de site stabiel online krijgen.",
                   hf.get("error") or f"status {hf.get('status')}")


# =========================================================================== indexering

@rule
def noindex(c: Ctx):
    if c.home and c.home["noindex"]:
        return Finding("noindex_home", "Homepage staat op 'noindex' — Google mag hem niet tonen", 10, "Vindbaarheid",
                       "Met noindex vraag je Google letterlijk om de pagina níet in de zoekresultaten te zetten. "
                       "Zolang dit erop staat, ben je onvindbaar.",
                       "Noindex verwijderen (vaak een vergeten vinkje 'zoekmachines ontmoedigen' in WordPress).",
                       f"robots: {c.home.get('robots_meta')}")
    # Privacy, voorwaarden, bedankt- en loginpagina's horen vaak juist niet in Google
    routine = ("privacy", "cookie", "voorwaarden", "disclaimer", "bedankt", "thank", "login", "inloggen", "account", "registr", "winkelwagen", "cart",
               # zoek-, categorie-, tag- en archiefpagina's op noindex is juist goede praktijk
               "zoeken", "search", "/category/", "/tag/", "/page/", "/author/")
    others = [p for p in c.site.get("noindex", []) if p != "/" and not any(w in p.lower() for w in routine)]
    if others:
        what = "1 pagina staat" if len(others) == 1 else f"{len(others)} pagina's staan"
        return Finding("noindex_pages", f"{what} op 'noindex'", 6, "Vindbaarheid",
                       "Deze pagina's kunnen nooit gevonden worden in Google, ook niet als iemand precies "
                       "op die dienst zoekt.", "Controleren of dat bewust is; zo niet, noindex weghalen.",
                       ", ".join(others[:5]))


@rule
def robots_blocks(c: Ctx):
    if c.t("robots").get("blocks_all"):
        return Finding("robots_block", "robots.txt blokkeert de hele site voor Google", 10, "Vindbaarheid",
                       "'Disallow: /' houdt Google buiten de deur. Nieuwe of gewijzigde pagina's worden "
                       "niet meer opgepakt en de site zakt weg uit de resultaten.",
                       "robots.txt aanpassen zodat Google alles mag lezen behalve beheerpagina's.")


# =========================================================================== https

@rule
def https(c: Ctx):
    h = c.t("https")
    if not h:
        return None
    if not h.get("uses_https"):
        return Finding("no_https", "Geen HTTPS — Chrome toont 'Niet veilig'", 9, "Vertrouwen",
                       "Bezoekers zien een waarschuwing naast het adres en haken af, zeker bij een "
                       "contactformulier. Google rankt onveilige sites bovendien lager.",
                       "Gratis SSL-certificaat (Let's Encrypt) activeren en alles naar https sturen.")
    if not h.get("http_redirects_to_https"):
        return Finding("no_https_redirect", "http:// stuurt niet door naar https://", 7, "Techniek",
                       "Wie een oude link of het adres zonder https intypt, komt op een 'Niet veilig'-versie "
                       "of een foutmelding. Google ziet bovendien twee versies van dezelfde site.",
                       "Permanente (301) redirect van http naar https instellen.",
                       h.get("http_error") or f"blijft op {h.get('http_final')}")
    if not h.get("alt_host_consistent"):
        return Finding("www_inconsistent", f"{h.get('alt_host')} komt niet op de hoofdsite uit", 3, "Techniek",
                       "Wie het adres net anders intypt (met of zonder www) krijgt een fout of een dubbele site. "
                       "Dat kost bezoekers en verdeelt de autoriteit bij Google.",
                       "De variant met een 301 naar het hoofdadres laten doorsturen.",
                       h.get("alt_host_error") or f"komt uit op {h.get('alt_host_final')}")


# =========================================================================== snelheid

@rule
def mobile_speed(c: Ctx):
    score = (c.mobile.get("scores") or {}).get("performance")
    if score is None or score >= 90:
        return None
    lcp = (c.mobile.get("lab") or {}).get("LCP", {}).get("display", "")
    opps = ", ".join(o["title"] for o in (c.mobile.get("opportunities") or [])[:3])
    impact = 9 if score < 50 else 6
    return Finding("mobile_speed", f"Trage mobiele site (PageSpeed {score}/100)", impact, "Snelheid",
                   "Het grootste deel van de lokale zoekopdrachten gebeurt op een telefoon. Bij elke extra "
                   "seconde laadtijd haken bezoekers af, en Google laat snelheid meewegen in de ranking.",
                   "Afbeeldingen comprimeren en verkleinen (WebP), onnodige scripts/plugins weg, caching aan.",
                   (f"LCP {lcp}. " if lcp else "") + (f"Grootste winst: {opps}" if opps else ""))


@rule
def desktop_speed(c: Ctx):
    score = (c.desktop.get("scores") or {}).get("performance")
    if score is None or score >= 50:
        return None
    return Finding("desktop_speed", f"Ook op desktop traag (PageSpeed {score}/100)", 4, "Snelheid",
                   "Zelfs op een snelle computer moet de bezoeker wachten — een slechte eerste indruk.",
                   "Zelfde aanpak als mobiel: zware afbeeldingen en scripts aanpakken.")


@rule
def field_vitals(c: Ctx):
    field = c.mobile.get("field") or c.mobile.get("origin_field")
    if not field:
        return None
    m = field.get("metrics") or {}
    bad = {k: v for k, v in m.items() if k in ("LCP", "INP", "CLS") and v.get("category") in ("SLOW", "AVERAGE")}
    if not bad:
        return None
    slow = any(v["category"] == "SLOW" for v in bad.values())
    detail = ", ".join(f"{k} {v['display']} ({'slecht' if v['category'] == 'SLOW' else 'matig'})" for k, v in bad.items())
    src = "deze pagina" if c.mobile.get("field") else "het hele domein"
    return Finding("cwv_field", "Echte bezoekers ervaren de site als traag (Core Web Vitals)", 8 if slow else 6,
                   "Snelheid",
                   "Dit is gemeten bij echte Chrome-gebruikers, niet in een test. Google gebruikt precies deze "
                   "cijfers als rankingsignaal: zakt de site hiervoor, dan wint de snellere concurrent.",
                   "LCP: hoofdafbeelding sneller laden. INP: minder zware JavaScript. CLS: vaste afmetingen voor beelden/banners.",
                   f"Velddata ({src}, 75e percentiel): {detail}")


@rule
def page_weight(c: Ctx):
    total = (c.mobile.get("diagnostics") or {}).get("total_bytes") or (c.t("weight").get("total_bytes"))
    if not total or total < 2_500_000:
        return None
    mb = total / 1024 / 1024
    largest = [l for l in (c.t("weight").get("largest") or []) if l["bytes"] > 200_000][:2]
    detail = f"±{mb:.1f} MB"
    if largest:
        detail += "; grootste: " + ", ".join(f"{l['url'].rsplit('/', 1)[-1][:40]} ({l['bytes'] / 1024 / 1024:.1f} MB)"
                                             for l in largest)
    return Finding("heavy_page", "Homepage is erg zwaar", 6 if mb > 4 else 4, "Snelheid",
                   "Op mobiel netwerk duurt het downloaden lang en het kost bezoekers hun databundel. "
                   "Een gemiddelde snelle pagina is onder de 1,5 MB.",
                   "Afbeeldingen naar WebP/AVIF in de juiste afmeting, video's extern hosten, ongebruikte code weg.",
                   detail)


@rule
def slow_server(c: Ctx):
    ttfb = c.t("server").get("ttfb")
    if ttfb is None or ttfb < 0.8:
        return None
    return Finding("slow_server", f"Server reageert traag ({ttfb * 1000:.0f} ms)", 5 if ttfb >= 1.5 else 3, "Snelheid",
                   "Voordat er ook maar iets op het scherm komt, wacht de bezoeker al op de server. "
                   "Vaak een teken van goedkope gedeelde hosting of geen caching.",
                   "Pagina-caching aanzetten, of verhuizen naar snellere hosting/CDN.")


@rule
def no_compression(c: Ctx):
    sv = c.t("server")
    if sv and sv.get("ttfb") is not None and not sv.get("compression"):
        return Finding("no_compression", "Geen compressie (gzip/brotli) op de server", 3, "Snelheid",
                       "Elke pagina wordt onnodig groot verstuurd; dat is gratis snelheid die blijft liggen.",
                       "Gzip of Brotli aanzetten in de server/hosting.")


# =========================================================================== on-page (homepage)

@rule
def viewport(c: Ctx):
    if c.home and not c.home["viewport"]:
        return Finding("no_viewport", "Site is niet mobielvriendelijk ingesteld (geen viewport)", 9, "Vindbaarheid",
                       "Op een telefoon wordt de site als piepklein desktopscherm getoond. Bezoekers moeten "
                       "inzoomen en haken af; Google indexeert mobiel-eerst en straft dit af.",
                       "Responsive maken (meta viewport + mobiele layout).")


@rule
def title(c: Ctx):
    if not c.home:
        return None
    t, n = c.home["title"], c.home["title_len"]
    if not n:
        return Finding("no_title", "Homepage heeft geen title", 9, "Vindbaarheid",
                       "De title is de blauwe kop in Google. Zonder title verzint Google zelf iets en "
                       "mis je je belangrijkste kans om dienst + plaats te noemen.",
                       "Title schrijven als '[Dienst] in [Plaats] | [Bedrijfsnaam]'.")
    if n > 60 or n < 30:
        return Finding("title_length", f"Title van de homepage is {'te lang' if n > 60 else 'te kort'} ({n} tekens)",
                       4, "Vindbaarheid",
                       "Een te lange title wordt afgekapt in Google; een te korte laat kansen liggen om "
                       "op dienst en plaats gevonden te worden.",
                       "Title van 30-60 tekens met dienst + plaats vooraan.", f"“{t[:100]}”")


@rule
def description(c: Ctx):
    missing = c.site.get("no_description") or []
    n = c.site.get("pages") or 0
    if c.home and not c.home["description"]:
        return Finding("no_description", "Homepage heeft geen meta description", 6, "Vindbaarheid",
                       "De description is het verkooppraatje onder je kop in Google. Zonder kiest Google een "
                       "willekeurig stukje tekst en klikken minder mensen door.",
                       "Wervende description van 120-155 tekens met dienst, plaats en een reden om te klikken.",
                       f"Ontbreekt op {len(missing)}/{n} pagina's" if missing else "")
    if missing and n and len(missing) / n >= 0.3:
        return Finding("missing_descriptions", f"Meta description ontbreekt op {len(missing)} pagina's", 4,
                       "Vindbaarheid",
                       "Elke pagina zonder description toont een willekeurige tekst in Google, wat minder kliks oplevert.",
                       "Per pagina een eigen description schrijven.", ", ".join(missing[:5]))


@rule
def h1(c: Ctx):
    if not c.home:
        return None
    if c.home["h1_count"] == 0:
        return Finding("no_h1", "Homepage heeft geen H1-kop", 5, "Vindbaarheid",
                       "De H1 vertelt Google (en de bezoeker) in één zin waar de pagina over gaat. "
                       "Zonder H1 is minder duidelijk dat je die dienst in die plaats levert.",
                       "Eén duidelijke H1 met dienst + plaats, bv. 'Glazenwasser in Tilburg'.")
    if c.home["h1_count"] > 1:
        return Finding("multi_h1", f"Homepage heeft {c.home['h1_count']} H1-koppen", 2, "Vindbaarheid",
                       "Meerdere hoofdkoppen maken minder duidelijk wat het hoofdonderwerp is.",
                       "Eén H1 houden, de rest H2 maken.", " | ".join(h[:40] for h in c.home["h1"][:3]))


@rule
def local_schema(c: Ctx):
    if not c.pages or c.site.get("has_local_schema"):
        return None
    types = ", ".join(c.site.get("schema_types") or []) or "geen"
    return Finding("no_local_schema", "Geen LocalBusiness-gegevens voor Google (schema.org)", 6, "Vindbaarheid",
                   "Met LocalBusiness-schema geef je Google je naam, adres, telefoon, werkgebied en "
                   "openingstijden in een vorm die het direct begrijpt. Dat helpt in de lokale resultaten en Maps.",
                   "JSON-LD met LocalBusiness (of het juiste subtype) toevoegen, gelijk aan het Google Bedrijfsprofiel.",
                   f"Gevonden types: {types}")


@rule
def thin_home(c: Ctx):
    if c.home and c.home["word_count"] < 300:
        return Finding("thin_home", f"Weinig tekst op de homepage (±{c.home['word_count']} woorden)", 6, "Vindbaarheid",
                       "Google moet kunnen lezen wat je doet, waar en voor wie. Met een paar zinnen heb je "
                       "simpelweg te weinig om op te ranken tegen concurrenten met uitgebreide pagina's.",
                       "Homepage uitbreiden naar 500+ woorden: diensten, werkgebied, werkwijze, FAQ, reviews.")


@rule
def thin_site(c: Ctx):
    thin = [p for p in c.site.get("thin_pages") or [] if p != "/"]
    n = c.site.get("pages") or 0
    if n >= 3 and len(thin) / n >= 0.5:
        return Finding("thin_site", f"{len(thin)} van {n} pagina's hebben dunne content", 4, "Vindbaarheid",
                       "Pagina's met weinig tekst ranken zelden. Ze tellen voor Google nauwelijks mee.",
                       "Belangrijkste dienstpagina's uitbreiden met echte, specifieke informatie.",
                       ", ".join(thin[:5]))


@rule
def few_pages(c: Ctx):
    n = c.r.get("crawl", {}).get("count") or 0
    sm = c.t("sitemap").get("url_count") or 0
    limit = c.r.get("crawl", {}).get("limit") or 10
    if not c.pages or n >= min(6, limit) or sm >= 6:
        return None
    found = max(n, sm)
    word = "pagina" if found == 1 else "pagina's"
    return Finding("few_pages", f"Maar {found} {word} gevonden — te weinig om lokaal te scoren", 7,
                   "Vindbaarheid",
                   "Iemand zoekt '[dienst] [plaats]'. Zonder aparte pagina per dienst en per plaats in je "
                   "werkgebied heeft Google niets om te tonen; de concurrent met die pagina's wint.",
                   "Per kerndienst en per belangrijke plaats een eigen, unieke pagina bouwen.",
                   f"{n} pagina's gecrawld, {sm} URL's in sitemap")


@rule
def duplicate_titles(c: Ctx):
    dups = c.site.get("duplicate_titles") or {}
    if dups:
        cnt = sum(dups.values())
        return Finding("dup_titles", f"{cnt} pagina's delen dezelfde title", 4, "Vindbaarheid",
                       "Pagina's met dezelfde title concurreren met elkaar; Google weet niet welke te tonen "
                       "en toont vaak geen van beide.",
                       "Elke pagina een unieke title met zijn eigen dienst/plaats.",
                       f"bv. “{next(iter(dups))[:70]}”")


@rule
def alt_text(c: Ctx):
    cov = c.site.get("alt_coverage")
    if cov is None or cov >= 90:
        return None
    return Finding("alt_text", f"{c.site.get('missing_alt')} afbeeldingen zonder alt-tekst ({cov}% gedekt)",
                   4 if cov < 60 else 3, "Vindbaarheid",
                   "Google kan foto's niet 'zien'; alt-tekst vertelt wat erop staat (bv. 'dakgoot reinigen Tilburg'). "
                   "Zonder alt mis je Google Afbeeldingen en is de site slecht toegankelijk.",
                   "Elke inhoudelijke afbeelding een korte beschrijvende alt-tekst geven.")


@rule
def canonical(c: Ctx):
    if c.home and not c.home["canonical"]:
        return Finding("no_canonical", "Geen canonical-tag", 3, "Vindbaarheid",
                       "Zonder canonical kan Google meerdere varianten van dezelfde pagina zien "
                       "(met/zonder www, met parameters) en de waarde verdelen.",
                       "Op elke pagina een canonical naar zichzelf zetten.")


@rule
def open_graph(c: Ctx):
    if c.home and not (c.home["og"].get("title") and c.home["og"].get("image")):
        return Finding("no_og", "Gedeelde links tonen geen nette preview (Open Graph)", 3, "Conversie",
                       "Wordt de site gedeeld via WhatsApp, Facebook of LinkedIn, dan verschijnt er een kale "
                       "link zonder foto. Juist mond-tot-mondreclame via WhatsApp is lokaal belangrijk.",
                       "og:title, og:description en og:image (1200×630) toevoegen.")


@rule
def lang(c: Ctx):
    if c.home and not c.home["lang"]:
        return Finding("no_lang", "Taal van de pagina niet ingesteld (html lang)", 2, "Vindbaarheid",
                       "Google en schermlezers moeten raden welke taal de site is.",
                       "<html lang=\"nl\"> instellen.")


@rule
def contact(c: Ctx):
    if not c.home:
        return None
    ct = c.home.get("contact") or {}
    if not ct.get("tel") and not ct.get("whatsapp"):
        return Finding("no_tel", "Geen klikbaar telefoonnummer op de homepage", 5, "Conversie",
                       "Bij lokale diensten bellen of appen de meeste mensen direct vanaf hun telefoon. "
                       "Moet iemand een nummer overtikken (of zoeken), dan is die klant vaak al weg.",
                       "Klikbaar tel:-nummer (en WhatsApp-knop) bovenin en onderaan elke pagina.")


# =========================================================================== techniek

@rule
def sitemap(c: Ctx):
    s = c.t("sitemap")
    if s and not s.get("found"):
        return Finding("no_sitemap", "Geen sitemap.xml", 5, "Vindbaarheid",
                       "Met een sitemap geef je Google een lijst van al je pagina's. Zonder vindt Google "
                       "nieuwe of diep weggestopte pagina's langzamer of niet.",
                       "sitemap.xml laten genereren en aanmelden in Google Search Console.")
    if s.get("found") and not c.t("robots").get("sitemaps"):
        return Finding("sitemap_not_in_robots", "Sitemap staat niet in robots.txt", 2, "Vindbaarheid",
                       "Zoekmachines vinden de sitemap het makkelijkst via robots.txt.",
                       f"Regel 'Sitemap: {s.get('url')}' aan robots.txt toevoegen.")


@rule
def robots_missing(c: Ctx):
    r = c.t("robots")
    if r and not r.get("exists"):
        return Finding("no_robots", "Geen robots.txt", 2, "Techniek",
                       "Geen ramp, maar een gemiste kans om Google naar de sitemap te wijzen en "
                       "onbelangrijke pagina's buiten de index te houden.",
                       "Eenvoudige robots.txt met sitemap-verwijzing plaatsen.")


@rule
def mixed_content(c: Ctx):
    mc = c.tech.get("mixed_content") or []
    if mc:
        return Finding("mixed_content", f"Onveilige (http) bestanden op beveiligde pagina's ({len(mc)}×)", 6, "Vertrouwen",
                       "Browsers blokkeren deze bestanden of tonen een waarschuwing; afbeeldingen of formulieren "
                       "werken dan niet en het slotje verdwijnt.",
                       "Alle verwijzingen naar https omzetten.", mc[0]["url"][:100])


@rule
def broken_links(c: Ctx):
    broken = c.links.get("broken") or []
    if not broken:
        return None
    detail = ", ".join(f"{b['url'][:70]} ({b['status'] or b['error']})" for b in broken[:3])
    return Finding("broken_links", f"{len(broken)} kapotte link(s) op de homepage", min(7, 4 + len(broken) // 3),
                   "Techniek",
                   "Een bezoeker die op een dode link klikt, denkt dat het bedrijf niet meer actief is. "
                   "Google ziet het als teken van een slecht onderhouden site.",
                   "Links herstellen of verwijderen; voor verhuisde pagina's een 301-redirect.", detail)


@rule
def internal_errors(c: Ctx):
    errs = [e for e in c.tech.get("internal_errors") or [] if (e.get("status") or 0) >= 400 or e.get("error")]
    if len(errs) >= 2:
        return Finding("internal_errors", f"{len(errs)} interne pagina's geven een foutmelding", 5, "Techniek",
                       "Links in je eigen menu of tekst die op een fout uitkomen, kosten bezoekers en vertrouwen.",
                       "Pagina's herstellen of de links aanpassen/redirecten.",
                       ", ".join(f"{e['url'][-60:]} ({e['status'] or e['error']})" for e in errs[:3]))


@rule
def soft_404(c: Ctx):
    nf = c.t("not_found")
    v = nf.get("verdict")
    if v == "soft404":
        return Finding("soft_404", "Niet-bestaande pagina's geven geen echte 404", 4, "Techniek",
                       "Google ziet daardoor eindeloos veel 'pagina's' met dezelfde inhoud, wat de site "
                       "rommelig maakt in de index. Bezoekers krijgen geen duidelijke melding.",
                       "Server laten antwoorden met status 404 en een nette foutpagina met links terug.")
    if v == "soft404-redirect":
        return Finding("soft_404_redirect", "Onbekende URL's worden doorgestuurd in plaats van 404", 2, "Techniek",
                       "Google behandelt dit als 'soft 404'. Niet direct schadelijk, wel onnodig.",
                       "Een echte 404-pagina tonen met links naar de belangrijkste pagina's.",
                       f"→ {nf.get('final_url')}")


# =========================================================================== meten

@rule
def analytics(c: Ctx):
    tools = c.track.get("tools") or {}
    if not tools:
        return None
    ga4, gtm, ua = (tools.get(k, {}).get("found") for k in ("ga4", "gtm", "ua"))
    others = any(tools.get(k, {}).get("found") for k in ("plausible", "matomo", "clarity"))
    if ga4 or gtm or others:
        return None
    if ua:
        return Finding("ua_only", "Alleen de oude Google Analytics (meet sinds 2023 niets meer)", 7, "Meten",
                       "De code staat er nog, maar Universal Analytics is uitgezet. Er wordt dus helemaal "
                       "niets gemeten: je weet niet hoeveel aanvragen de site oplevert.",
                       "GA4 installeren (liefst via Tag Manager) en conversies (bellen, formulier) meten.")
    return Finding("no_analytics", "Er wordt niets gemeten (geen Google Analytics)", 7, "Meten",
                   "Zonder analytics weet je niet hoeveel bezoekers er komen, waar ze vandaan komen en of de "
                   "site klanten oplevert. Elke marketingeuro is dan een gok.",
                   "GA4 + Tag Manager installeren en klikken op bellen/WhatsApp/formulier als conversie meten.")


@rule
def search_console(c: Ctx):
    if c.track and not (c.track.get("verification") or {}).get("google"):
        return Finding("no_gsc_tag", "Geen Search Console-verificatie zichtbaar", 3, "Meten",
                       "Search Console laat zien op welke zoekwoorden je gevonden wordt en waarschuwt bij problemen. "
                       "We zien geen verificatietag (kan ook via DNS zijn gedaan — navragen).",
                       "Search Console koppelen en sitemap indienen.")


@rule
def consent(c: Ctx):
    tools = c.track.get("tools") or {}
    tracks = any(tools.get(k, {}).get("found") for k in ("ga4", "gtm", "meta_pixel", "hotjar", "clarity", "tiktok", "linkedin"))
    if tracks and not c.track.get("consent"):
        return Finding("no_consent", "Tracking zonder herkenbare cookiebanner", 4, "Vertrouwen",
                       "In Nederland mag je marketing- en analytics-cookies alleen plaatsen na toestemming. "
                       "Zonder banner loop je een AVG-risico en kan Google Ads zonder Consent Mode minder meten.",
                       "Cookiebanner met Google Consent Mode v2 instellen.")


# =========================================================================== scores Lighthouse

@rule
def lighthouse_seo(c: Ctx):
    s = (c.mobile.get("scores") or {}).get("seo")
    if s is not None and s < 90:
        return Finding("lh_seo", f"Lighthouse SEO-score {s}/100", 4 if s < 80 else 3, "Vindbaarheid",
                       "Google's eigen test vindt technische SEO-basics die ontbreken.",
                       "De SEO-meldingen uit Lighthouse oplossen (zie PageSpeed-rapport).")


@rule
def lighthouse_a11y(c: Ctx):
    s = (c.mobile.get("scores") or {}).get("accessibility")
    if s is not None and s < 75:
        return Finding("lh_a11y", f"Toegankelijkheid scoort {s}/100", 3, "Conversie",
                       "Slecht leesbare teksten, te kleine knoppen of ontbrekende labels maken de site lastig "
                       "voor oudere bezoekers en mensen met een beperking — een grote doelgroep voor lokale diensten.",
                       "Contrast, knopgroottes en formulierlabels verbeteren.")
