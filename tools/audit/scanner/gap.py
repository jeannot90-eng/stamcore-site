"""Gap-analyse: prospect vs. concurrent op de punten die lokaal het verschil maken.

Elke METRIC is (label, functie die de waarde uit een resultaat haalt, 'hoger is beter'?,
weergave). Uitbreiden = een regel toevoegen.
"""

from .models import Finding


def _score(r, key):
    return (r.get("scores") or {}).get(key)


def _home(r):
    return (r.get("pages") or [None])[0] or {}


def _stats(r):
    return (r.get("onpage") or {}).get("stats") or {}


def _lab(r, metric):
    v = (((r.get("psi") or {}).get("mobile") or {}).get("lab") or {}).get(metric) or {}
    return v.get("value")


def _yes(v):
    return "ja" if v else "nee"


METRICS = [
    ("Mobiele snelheid (PageSpeed)", lambda r: _score(r, "mobile_performance"), True, lambda v: f"{v}/100"),
    ("Desktop snelheid (PageSpeed)", lambda r: _score(r, "desktop_performance"), True, lambda v: f"{v}/100"),
    ("Lighthouse SEO", lambda r: _score(r, "mobile_seo"), True, lambda v: f"{v}/100"),
    ("Toegankelijkheid", lambda r: _score(r, "mobile_accessibility"), True, lambda v: f"{v}/100"),
    ("LCP mobiel (lab)", lambda r: _lab(r, "LCP"), False, lambda v: f"{v / 1000:.1f} s".replace(".", ",")),
    ("On-page score (eigen check)", lambda r: _score(r, "onpage"), True, lambda v: f"{v}/100"),
    ("Techniek score (eigen check)", lambda r: _score(r, "technical"), True, lambda v: f"{v}/100"),
    ("Pagina's gevonden (crawl)", lambda r: (r.get("crawl") or {}).get("count"), True, str),
    ("URL's in sitemap", lambda r: ((r.get("technical") or {}).get("sitemap") or {}).get("url_count"), True, str),
    ("Woorden op homepage", lambda r: _home(r).get("word_count"), True, str),
    ("Gem. woorden per pagina", lambda r: _stats(r).get("avg_words"), True, str),
    ("LocalBusiness-schema", lambda r: int(bool(_stats(r).get("has_local_schema"))), True, _yes),
    ("FAQ-schema", lambda r: int(bool(_stats(r).get("has_faq_schema"))), True, _yes),
    ("Klikbaar telefoonnummer", lambda r: int(bool((_home(r).get("contact") or {}).get("tel"))), True, _yes),
    ("Analytics aanwezig", lambda r: int(any(((r.get("tracking") or {}).get("tools") or {}).get(k, {}).get("found")
                                             for k in ("ga4", "gtm"))), True, _yes),
    ("Serverreactie (TTFB)", lambda r: (((r.get("technical") or {}).get("server") or {}).get("ttfb")), False,
     lambda v: f"{v * 1000:.0f} ms"),
]


def compare(prospect: dict, competitor: dict) -> dict:
    rows = []
    behind = 0
    for label, get, higher_better, fmt in METRICS:
        try:
            a, b = get(prospect), get(competitor)
        except Exception:  # noqa: BLE001
            a = b = None
        if a is None or b is None:
            verdict = "n.v.t."
        elif a == b:
            verdict = "gelijk"
        else:
            prospect_wins = (a > b) if higher_better else (a < b)
            verdict = "voor" if prospect_wins else "achter"
            behind += verdict == "achter"
        rows.append({"label": label, "prospect": a, "competitor": b, "verdict": verdict,
                     "prospect_display": fmt(a) if a is not None else "—",
                     "competitor_display": fmt(b) if b is not None else "—"})
    return {"competitor_host": competitor.get("host"), "rows": rows, "behind": behind,
            "compared": sum(1 for r in rows if r["verdict"] != "n.v.t.")}


def findings(gap: dict) -> list[Finding]:
    """Verbeterpunten waar de achterstand op de concurrent groot is."""
    out = []
    rows = {r["label"]: r for r in gap["rows"]}
    host = gap["competitor_host"]

    sp = rows.get("Mobiele snelheid (PageSpeed)")
    if sp and sp["verdict"] == "achter" and sp["competitor"] - sp["prospect"] >= 15:
        out.append(Finding("gap_speed", f"Concurrent {host} is op mobiel flink sneller", 6, "Concurrentie",
                           "Wie op mobiel twee sites naast elkaar opent, blijft bij de site die als eerste laadt. "
                           "Google weegt dat ook mee bij gelijkwaardige bedrijven.",
                           "Snelheid naar minimaal het niveau van de concurrent brengen.",
                           f"{sp['prospect_display']} vs. {sp['competitor_display']}"))
    pg = rows.get("Pagina's gevonden (crawl)")
    sm = rows.get("URL's in sitemap")
    if pg and pg["verdict"] == "achter" and (pg["competitor"] or 0) >= 2 * max(1, pg["prospect"] or 0):
        extra = f"; sitemap {sm['prospect_display']} vs. {sm['competitor_display']}" if sm and sm["verdict"] != "n.v.t." else ""
        out.append(Finding("gap_pages", f"Concurrent {host} heeft veel meer pagina's", 6, "Concurrentie",
                           "Meer (goede) pagina's = meer zoekopdrachten waarop je kunt verschijnen: per dienst, "
                           "per plaats, per vraag. De concurrent vist met een groter net.",
                           "Content-plan: dienst- en plaatspagina's die de concurrent heeft en de prospect niet.",
                           f"{pg['prospect_display']} vs. {pg['competitor_display']} gecrawld{extra}"))
    wd = rows.get("Woorden op homepage")
    if wd and wd["verdict"] == "achter" and (wd["competitor"] or 0) >= 1.8 * max(1, wd["prospect"] or 0) and wd["competitor"] > 400:
        out.append(Finding("gap_content", f"Concurrent {host} heeft veel meer inhoud op de homepage", 4, "Concurrentie",
                           "Google beoordeelt welke pagina de zoekvraag het best beantwoordt; meer relevante "
                           "inhoud wint vaak.", "Homepage inhoudelijk minstens zo compleet maken.",
                           f"{wd['prospect_display']} vs. {wd['competitor_display']} woorden"))
    ls = rows.get("LocalBusiness-schema")
    if ls and ls["verdict"] == "achter":
        out.append(Finding("gap_schema", f"Concurrent {host} heeft LocalBusiness-schema, prospect niet", 4, "Concurrentie",
                           "De concurrent geeft Google zijn bedrijfsgegevens kant-en-klaar aan; dat helpt in Maps "
                           "en de lokale resultaten.", "LocalBusiness-schema toevoegen."))
    return out
