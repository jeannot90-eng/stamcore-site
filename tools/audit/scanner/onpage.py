"""On-page SEO: analyse per pagina en een site-brede samenvatting.

analyze_page() geeft een dict met meetwaarden + 'checks' (checklist voor die pagina).
summarize() kijkt over alle pagina's heen (ontbrekende descriptions, dubbele titles, dunne content).
"""

import json
import re
from collections import Counter

from bs4 import BeautifulSoup, Comment, Declaration, Doctype, ProcessingInstruction
from bs4.element import CData

from . import urls
from .models import FAIL, INFO, PASS, WARN, check

# Drempels (aanpassen naar smaak)
TITLE_MIN, TITLE_MAX = 30, 60
DESC_MIN, DESC_MAX = 70, 160
THIN_WORDS, OK_WORDS = 150, 300

# Schema.org-types die op een lokaal bedrijf duiden
LOCAL_TYPES = {
    "localbusiness", "organization", "professionalservice", "homeandconstructionbusiness",
    "store", "restaurant", "medicalbusiness", "legalservice", "automotivebusiness",
    "healthandbeautybusiness", "foodestablishment", "lodgingbusiness", "financialservice",
    "plumber", "electrician", "roofingcontractor", "housepainter", "locksmith", "hvacbusiness",
    "generalcontractor", "movingcompany", "cleaningservice", "dentist", "physician",
    "realestateagent", "accountingservice", "attorney", "autorepair", "hairsalon", "beautysalon",
    "dayspa", "sportsactivitylocation", "childcare", "veterinarycare", "insuranceagency",
}

_SKIP_TEXT_PARENTS = {"script", "style", "noscript", "template", "svg", "head", "title", "iframe"}
_NON_TEXT = (Comment, Declaration, Doctype, ProcessingInstruction, CData)
_WORD = re.compile(r"[^\W\d_][\w'’-]*", re.UNICODE)


# --------------------------------------------------------------------------- helpers

def _meta(soup: BeautifulSoup, key: str) -> str | None:
    """Content van <meta name=key> of <meta property=key> (hoofdletterongevoelig)."""
    for attr in ("name", "property"):
        tag = soup.find("meta", attrs={attr: re.compile(rf"^{re.escape(key)}$", re.I)})
        if tag and tag.get("content") is not None:
            return tag.get("content", "").strip()
    return None


def _rels(tag) -> list[str]:
    rel = tag.get("rel") or []
    if isinstance(rel, str):
        rel = rel.split()
    return [r.lower() for r in rel]


def _clean(text: str, limit: int = 200) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    return text[:limit]


def _schema_types(soup: BeautifulSoup) -> tuple[list[str], list[str]]:
    """Alle @type-waarden uit JSON-LD (incl. @graph en geneste objecten) + microdata itemtypes.

    Geeft (types, fouten) terug; fouten = JSON-LD-blokken die niet te parsen zijn.
    """
    types, errors = [], []

    def walk(node):
        if isinstance(node, dict):
            t = node.get("@type")
            if isinstance(t, str):
                types.append(t)
            elif isinstance(t, list):
                types.extend(x for x in t if isinstance(x, str))
            for v in node.values():
                walk(v)
        elif isinstance(node, list):
            for v in node:
                walk(v)

    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        raw = (script.string or script.get_text() or "").strip()
        if not raw:
            continue
        try:
            walk(json.loads(raw))
        except (ValueError, RecursionError):
            # Veelvoorkomend: trailing comma's of HTML-commentaar eromheen
            try:
                walk(json.loads(re.sub(r",\s*([}\]])", r"\1", raw.strip("<!-->"))))
            except (ValueError, RecursionError):
                errors.append(raw[:80])
    for tag in soup.find_all(attrs={"itemtype": True}):
        it = tag.get("itemtype", "")
        if isinstance(it, list):
            it = " ".join(it)
        for part in it.split():
            types.append(part.rstrip("/").rsplit("/", 1)[-1])
    # Ontdubbelen met behoud van volgorde, zonder schema.org-prefix
    clean = []
    for t in types:
        t = t.rsplit("/", 1)[-1].replace("schema:", "")
        if t and t not in clean:
            clean.append(t)
    return clean, errors


def visible_text(soup: BeautifulSoup) -> str:
    """Zichtbare tekst (ruw): alles behalve script/style/head/svg en commentaar."""
    parts = []
    for s in soup.find_all(string=True):
        if isinstance(s, _NON_TEXT):
            continue
        if s.parent is not None and s.parent.name in _SKIP_TEXT_PARENTS:
            continue
        parts.append(str(s))
    return re.sub(r"\s+", " ", " ".join(parts)).strip()


# --------------------------------------------------------------------------- per pagina

def analyze_page(page, site_host: str) -> dict:
    """On-page analyse van één gecrawlde pagina (crawl.Page)."""
    soup, fetch = page.soup, page.fetch
    d: dict = {"url": page.url, "path": urls.path_label(page.url), "depth": page.depth,
               "status": fetch.status, "size": fetch.size, "ttfb": fetch.ttfb}

    # Title & description
    title_tag = soup.find("title")
    d["title"] = _clean(title_tag.get_text(), 300) if title_tag else ""
    d["title_len"] = len(d["title"])
    d["description"] = _clean(_meta(soup, "description") or "", 400)
    d["description_len"] = len(d["description"])

    # Indexeerbaarheid: meta robots / X-Robots-Tag
    robots_meta = " ".join(filter(None, [_meta(soup, "robots"), _meta(soup, "googlebot")])).lower()
    x_robots = fetch.headers.get("x-robots-tag", "").lower()
    d["noindex"] = "noindex" in robots_meta or "noindex" in x_robots
    d["robots_meta"] = robots_meta or None

    # Koppen
    headings = [(int(h.name[1]), _clean(h.get_text(), 120))
                for h in soup.find_all(re.compile(r"^h[1-6]$"))]
    d["h1"] = [t for lvl, t in headings if lvl == 1]
    d["h2"] = [t for lvl, t in headings if lvl == 2]
    d["h1_count"], d["h2_count"] = len(d["h1"]), len(d["h2"])
    skips, prev = [], 0
    for lvl, text in headings:
        if prev and lvl > prev + 1:
            skips.append(f"H{prev} → H{lvl} ({text[:40]})")
        prev = lvl
    d["heading_skips"] = skips
    d["headings"] = [f"H{lvl}: {t}" for lvl, t in headings[:40]]

    # Canonical, viewport, lang, hreflang
    canonical = None
    hreflang = []
    for link in soup.find_all("link", href=True):
        rels = _rels(link)
        if "canonical" in rels and canonical is None:
            canonical = urls.resolve(page.url, link["href"])
        if "alternate" in rels and link.get("hreflang"):
            hreflang.append({"lang": link["hreflang"], "href": link["href"]})
    d["canonical"] = canonical
    d["canonical_self"] = bool(canonical) and urls.normalize(canonical) == urls.normalize(page.url)
    d["viewport"] = _meta(soup, "viewport")
    html_tag = soup.find("html")
    d["lang"] = (html_tag.get("lang") or "").strip() if html_tag else ""
    d["hreflang"] = hreflang

    # Social: Open Graph + Twitter
    d["og"] = {k: _meta(soup, f"og:{k}") for k in ("title", "description", "image", "url", "type")}
    d["twitter"] = {k: _meta(soup, f"twitter:{k}") for k in ("card", "title", "image")}

    # Gestructureerde data
    d["schema_types"], d["schema_errors"] = _schema_types(soup)
    d["has_local_schema"] = any(t.lower() in LOCAL_TYPES for t in d["schema_types"])

    # Afbeeldingen en alt-teksten
    imgs = soup.find_all("img")
    with_alt = sum(1 for i in imgs if (i.get("alt") or "").strip())
    empty_alt = sum(1 for i in imgs if i.has_attr("alt") and not (i.get("alt") or "").strip())
    missing_alt = len(imgs) - with_alt - empty_alt
    d["images"] = {"total": len(imgs), "with_alt": with_alt, "empty_alt": empty_alt,
                   "missing_alt": missing_alt,
                   "missing_examples": [i.get("src", "")[:120] for i in imgs if not i.has_attr("alt")][:5]}
    d["alt_coverage"] = round(100 * (len(imgs) - missing_alt) / len(imgs)) if imgs else None

    # Woorden
    text = visible_text(soup)
    d["word_count"] = len(_WORD.findall(text))

    # Links
    internal, external, nofollow = set(), set(), 0
    tel, mail, whatsapp = [], [], False
    for a in soup.find_all("a", href=True):
        href = a.get("href", "").strip()
        low = href.lower()
        if low.startswith("tel:"):
            tel.append(href[4:])
            continue
        if low.startswith("mailto:"):
            mail.append(href[7:].split("?")[0])
            continue
        if "wa.me/" in low or "api.whatsapp.com" in low or low.startswith("whatsapp:"):
            whatsapp = True
        absolute = urls.resolve(page.url, href)
        if not absolute:
            continue
        if "nofollow" in _rels(a):
            nofollow += 1
        (internal if urls.is_internal(absolute, site_host) else external).add(urls.normalize(absolute))
    d["links"] = {"internal": len(internal), "external": len(external), "nofollow": nofollow}
    d["contact"] = {"tel": sorted(set(tel))[:5], "mailto": sorted(set(mail))[:5], "whatsapp": whatsapp,
                    "form": bool(soup.find("form"))}

    d["checks"] = _page_checks(d)
    return d


def _page_checks(d: dict) -> list:
    c = []
    # Indexeerbaar
    c.append(check("Indexeerbaar (geen noindex)", FAIL if d["noindex"] else PASS,
                   f"robots: {d['robots_meta']}" if d["noindex"] else ""))
    # Title
    tl = d["title_len"]
    if not tl:
        c.append(check("Title-tag", FAIL, "ontbreekt"))
    else:
        st = PASS if TITLE_MIN <= tl <= TITLE_MAX else WARN
        hint = "" if st == PASS else (" — te kort" if tl < TITLE_MIN else " — wordt afgekapt in Google")
        c.append(check("Title-tag", st, f"{tl} tekens{hint}: “{d['title'][:90]}”"))
    # Description
    dl = d["description_len"]
    if not dl:
        c.append(check("Meta description", FAIL, "ontbreekt — Google kiest zelf een stukje tekst"))
    else:
        st = PASS if DESC_MIN <= dl <= DESC_MAX else WARN
        hint = "" if st == PASS else (" — te kort" if dl < DESC_MIN else " — wordt afgekapt")
        c.append(check("Meta description", st, f"{dl} tekens{hint}"))
    # H1
    n = d["h1_count"]
    if n == 0:
        c.append(check("Eén H1-kop", FAIL, "geen H1 gevonden"))
    elif n > 1:
        c.append(check("Eén H1-kop", WARN, f"{n} H1's: " + " | ".join(h[:40] for h in d["h1"][:3])))
    else:
        c.append(check("Eén H1-kop", PASS, f"“{d['h1'][0][:80]}”"))
    c.append(check("H2-structuur", PASS if d["h2_count"] else WARN,
                   f"{d['h2_count']} H2's" + (f"; sprongen: {', '.join(d['heading_skips'][:2])}"
                                              if d["heading_skips"] else "")))
    # Techniek op pagina
    if d["canonical"]:
        c.append(check("Canonical", PASS if d["canonical_self"] else INFO,
                       "verwijst naar zichzelf" if d["canonical_self"] else f"→ {d['canonical']}"))
    else:
        c.append(check("Canonical", WARN, "ontbreekt"))
    c.append(check("Mobiele viewport", PASS if d["viewport"] else FAIL,
                   d["viewport"] or "geen meta viewport — pagina is niet mobielvriendelijk"))
    c.append(check("html lang", PASS if d["lang"] else WARN, d["lang"] or "ontbreekt"))
    # Social
    og = d["og"]
    if og["title"] and og["image"]:
        c.append(check("Open Graph", PASS, "titel + afbeelding aanwezig"))
    elif any(og.values()):
        missing = [k for k in ("title", "description", "image") if not og[k]]
        c.append(check("Open Graph", WARN, "mist: " + ", ".join(f"og:{m}" for m in missing)))
    else:
        c.append(check("Open Graph", WARN, "geen og-tags — gedeelde links tonen geen nette preview"))
    c.append(check("Twitter card", PASS if d["twitter"]["card"] else INFO,
                   d["twitter"]["card"] or "ontbreekt (X valt terug op Open Graph)"))
    # Schema
    if d["schema_types"]:
        st = PASS if not d["schema_errors"] else WARN
        extra = f"; {len(d['schema_errors'])} kapot JSON-LD-blok" if d["schema_errors"] else ""
        c.append(check("Schema.org (JSON-LD)", st, ", ".join(d["schema_types"][:8]) + extra))
    else:
        c.append(check("Schema.org (JSON-LD)", WARN, "geen gestructureerde data"))
    # Alt-teksten
    im = d["images"]
    if not im["total"]:
        c.append(check("Alt-teksten", INFO, "geen afbeeldingen"))
    else:
        cov = d["alt_coverage"]
        st = PASS if im["missing_alt"] == 0 else (WARN if cov >= 70 else FAIL)
        c.append(check("Alt-teksten", st,
                       f"{cov}% gedekt ({im['missing_alt']} zonder alt, {im['empty_alt']} leeg van {im['total']})"))
    # Content
    w = d["word_count"]
    st = PASS if w >= OK_WORDS else (WARN if w >= THIN_WORDS else FAIL)
    c.append(check("Hoeveelheid tekst", st, f"±{w} woorden" + ("" if st == PASS else " — dunne content")))
    c.append(check("Links", INFO, f"{d['links']['internal']} intern, {d['links']['external']} extern"))
    if d["hreflang"]:
        c.append(check("hreflang", INFO, ", ".join(h["lang"] for h in d["hreflang"][:6])))
    return c


# --------------------------------------------------------------------------- site-breed

def summarize(pages: list[dict]) -> dict:
    """Site-brede on-page statistiek + checklist (over alle gecrawlde pagina's)."""
    n = len(pages)
    if not n:
        return {"checks": [check("Pagina's geanalyseerd", FAIL, "geen enkele pagina bereikbaar")], "stats": {}}

    def paths(cond):
        return [p["path"] for p in pages if cond(p)]

    no_title = paths(lambda p: not p["title"])
    no_desc = paths(lambda p: not p["description"])
    no_h1 = paths(lambda p: p["h1_count"] == 0)
    multi_h1 = paths(lambda p: p["h1_count"] > 1)
    thin = paths(lambda p: p["word_count"] < OK_WORDS)
    noindex = paths(lambda p: p["noindex"])
    no_canonical = paths(lambda p: not p["canonical"])
    no_schema = paths(lambda p: not p["schema_types"])

    titles = Counter(p["title"].lower() for p in pages if p["title"])
    dup_titles = {t: c for t, c in titles.items() if c > 1}
    descs = Counter(p["description"].lower() for p in pages if p["description"])
    dup_descs = {t: c for t, c in descs.items() if c > 1}

    total_imgs = sum(p["images"]["total"] for p in pages)
    missing_alt = sum(p["images"]["missing_alt"] for p in pages)
    alt_cov = round(100 * (total_imgs - missing_alt) / total_imgs) if total_imgs else None
    schema_all = sorted({t for p in pages for t in p["schema_types"]})
    avg_words = round(sum(p["word_count"] for p in pages) / n)

    def ratio_check(label, bad, fail_ratio=0.5, detail_ok="op alle pagina's in orde"):
        if not bad:
            return check(label, PASS, detail_ok)
        st = FAIL if len(bad) / n >= fail_ratio else WARN
        return check(label, st, f"{len(bad)}/{n} pagina's: " + ", ".join(bad[:4]) + (" …" if len(bad) > 4 else ""))

    checks = [
        ratio_check("Title op elke pagina", no_title, 0.2),
        check("Unieke titles", PASS if not dup_titles else WARN,
              "alle titles uniek" if not dup_titles else
              f"{sum(dup_titles.values())} pagina's delen een title (bv. “{next(iter(dup_titles))[:60]}”)"),
        ratio_check("Meta description op elke pagina", no_desc),
        check("Unieke descriptions", PASS if not dup_descs else WARN,
              "alle descriptions uniek" if not dup_descs else f"{sum(dup_descs.values())} pagina's delen een description"),
        ratio_check("H1 op elke pagina", no_h1, 0.3),
        ratio_check("Niet meer dan één H1", multi_h1, 0.6),
        ratio_check("Genoeg tekst (≥300 woorden)", thin, 0.6),
        ratio_check("Canonical op elke pagina", no_canonical, 0.6),
        ratio_check("Schema.org op elke pagina", no_schema, 0.8),
        check("Alt-tekstdekking (site)", INFO if alt_cov is None else
              (PASS if alt_cov == 100 else WARN if alt_cov >= 70 else FAIL),
              "geen afbeeldingen" if alt_cov is None else f"{alt_cov}% van {total_imgs} afbeeldingen"),
    ]
    if noindex:
        checks.insert(0, check("Pagina's indexeerbaar", FAIL, f"noindex op: {', '.join(noindex[:5])}"))

    stats = {
        "pages": n, "avg_words": avg_words, "thin_pages": thin, "no_title": no_title,
        "no_description": no_desc, "no_h1": no_h1, "multi_h1": multi_h1, "noindex": noindex,
        "no_canonical": no_canonical, "no_schema": no_schema,
        "duplicate_titles": dup_titles, "duplicate_descriptions": dup_descs,
        "images": total_imgs, "missing_alt": missing_alt, "alt_coverage": alt_cov,
        "schema_types": schema_all,
        "has_local_schema": any(p["has_local_schema"] for p in pages),
        "has_review_schema": any(t.lower() in ("aggregaterating", "review") for t in schema_all),
        "has_faq_schema": "FAQPage" in schema_all,
    }
    return {"checks": checks, "stats": stats}
