"""Detectie van meet- en marketingtools, cookiebanner en CMS.

Werkt op de HTML van alle gecrawlde pagina's (scripts kunnen per pagina verschillen).
Let op: tools die via Google Tag Manager worden geladen zijn niet zichtbaar in de HTML;
daarom is 'GTM aanwezig, GA4 niet gezien' een waarschuwing en geen fout.
"""

import re

from .models import FAIL, INFO, PASS, WARN, check

# Patronen worden alleen op script-inhoud, script-src en noscript-iframes losgelaten
PATTERNS = {
    "ga4": [r"gtag/js\?id=(G-[A-Z0-9]{6,12})", r"['\"](G-[A-Z0-9]{8,12})['\"]"],
    "ua": [r"\b(UA-\d{4,10}-\d{1,4})\b"],
    "gtm": [r"\b(GTM-[A-Z0-9]{4,9})\b"],
    "google_ads": [r"\b(AW-\d{6,12})\b"],
    "meta_pixel": [r"fbq\(\s*['\"]init['\"]\s*,\s*['\"](\d{6,20})", r"facebook\.com/tr\?id=(\d{6,20})",
                   r"connect\.facebook\.net/[^'\"]*/(fbevents)\.js"],
    "hotjar": [r"static\.hotjar\.com|hjid\s*:\s*(\d+)"],
    "clarity": [r"clarity\.ms/tag/([a-z0-9]+)"],
    "linkedin": [r"snap\.licdn\.com|_linkedin_partner_id"],
    "tiktok": [r"analytics\.tiktok\.com"],
    "plausible": [r"plausible\.io/js"],
    "matomo": [r"matomo\.js|piwik\.js|_paq\.push"],
}

LABELS = {
    "ga4": "Google Analytics 4", "ua": "Universal Analytics (oud)", "gtm": "Google Tag Manager",
    "google_ads": "Google Ads-tag", "meta_pixel": "Meta (Facebook) pixel", "hotjar": "Hotjar",
    "clarity": "Microsoft Clarity", "linkedin": "LinkedIn Insight", "tiktok": "TikTok pixel",
    "plausible": "Plausible", "matomo": "Matomo",
}

CONSENT = {
    "Cookiebot": r"consent\.cookiebot\.com|cookiebot",
    "CookieYes": r"cookieyes|cookie-law-info",
    "Complianz": r"complianz|cmplz",
    "OneTrust": r"onetrust|optanon",
    "Usercentrics": r"usercentrics",
    "Iubenda": r"iubenda",
    "CookieFirst": r"cookiefirst",
    "Cookie Notice": r"cookie-notice|cn-notice",
    "Borlabs": r"borlabs",
    "Termly": r"termly\.io",
    "Google Consent Mode": r"gtag\(\s*['\"]consent['\"]",
}

CMS = {
    "WordPress": r"wp-content|wp-includes|wp-json",
    "Wix": r"static\.wixstatic\.com|wix\.com|_wixCIDX",
    "Squarespace": r"squarespace\.com|static1\.squarespace",
    "Shopify": r"cdn\.shopify\.com|Shopify\.theme",
    "Webflow": r"webflow\.js|data-wf-page|assets\.website-files\.com",
    "Jimdo": r"jimdo|jimstatic",
    "Joomla": r"/media/jui/|joomla",
    "Drupal": r"drupal\.js|/sites/default/files",
    "Framer": r"framerusercontent\.com|framer\.com",
    "GoDaddy Websites": r"img1\.wsimg\.com",
    "Lightspeed": r"lightspeedhq|seoshop",
    "WooCommerce": r"woocommerce",
    "Elementor": r"elementor",
    "Divi": r"et_pb_|/themes/Divi",
}


def _script_haystack(soup) -> str:
    parts = []
    for s in soup.find_all("script"):
        parts.append(s.get("src") or "")
        parts.append(s.string or s.get_text() or "")
    for ns in soup.find_all("noscript"):
        parts.append(str(ns)[:2000])
    return "\n".join(parts)


def detect(pages) -> dict:
    found = {k: set() for k in PATTERNS}
    pages_with = {k: 0 for k in PATTERNS}
    consent, cms = set(), set()
    verification = {"google": None, "bing": None}
    generator = None

    for i, page in enumerate(pages):
        hay = _script_haystack(page.soup)
        full = page.fetch.text
        for key, pats in PATTERNS.items():
            hit = False
            for pat in pats:
                for m in re.finditer(pat, hay, re.I if key not in ("ga4", "gtm", "ua") else 0):
                    hit = True
                    if m.groups() and m.group(1) and m.group(1) != "fbevents":
                        found[key].add(m.group(1))
            if hit:
                pages_with[key] += 1
        for name, pat in CONSENT.items():
            if re.search(pat, full, re.I):
                consent.add(name)
        for name, pat in CMS.items():
            if re.search(pat, full, re.I):
                cms.add(name)
        if i == 0:  # verificatie-tags horen op de homepage te staan
            g = page.soup.find("meta", attrs={"name": re.compile(r"^google-site-verification$", re.I)})
            b = page.soup.find("meta", attrs={"name": re.compile(r"^msvalidate\.01$", re.I)})
            verification["google"] = g.get("content") if g else None
            verification["bing"] = b.get("content") if b else None
            gen = page.soup.find("meta", attrs={"name": re.compile(r"^generator$", re.I)})
            generator = gen.get("content") if gen else None

    tools = {k: {"label": LABELS[k], "found": pages_with[k] > 0, "ids": sorted(found[k]),
                 "pages": pages_with[k]} for k in PATTERNS}
    d = {"tools": tools, "consent": sorted(consent), "cms": sorted(cms), "generator": generator,
         "verification": verification, "pages_scanned": len(pages)}
    d["checks"] = build_checks(d)
    return d


def build_checks(d: dict) -> list:
    t = d["tools"]
    c = []
    ga4, gtm, ua = t["ga4"]["found"], t["gtm"]["found"], t["ua"]["found"]
    if ga4:
        c.append(check("Google Analytics 4", PASS, ", ".join(t["ga4"]["ids"]) or "gtag gevonden"))
    elif gtm:
        c.append(check("Google Analytics 4", WARN, "niet in de HTML; mogelijk via Tag Manager geladen — controleer in GTM"))
    elif ua:
        c.append(check("Google Analytics 4", FAIL, "alleen oude Universal Analytics (verzamelt sinds 2023 niets meer)"))
    else:
        c.append(check("Google Analytics 4", FAIL, "geen analytics gevonden"))
    c.append(check("Google Tag Manager", PASS if gtm else INFO, ", ".join(t["gtm"]["ids"]) or "niet gevonden"))
    if ua:
        c.append(check("Universal Analytics opgeruimd", WARN, f"oude code staat er nog: {', '.join(t['ua']['ids'])}"))
    c.append(check("Meta pixel", PASS if t["meta_pixel"]["found"] else INFO,
                   ", ".join(i for i in t["meta_pixel"]["ids"]) or ("gevonden" if t["meta_pixel"]["found"] else "niet gevonden")))
    c.append(check("Search Console-verificatietag", PASS if d["verification"]["google"] else INFO,
                   "gevonden op homepage" if d["verification"]["google"]
                   else "geen meta-tag (kan ook via DNS/GA zijn geverifieerd — navragen)"))
    others = [v["label"] for k, v in t.items() if v["found"] and k not in ("ga4", "gtm", "ua", "meta_pixel")]
    if others:
        c.append(check("Overige tools", INFO, ", ".join(others)))
    trackers = ga4 or gtm or ua or t["meta_pixel"]["found"] or t["hotjar"]["found"] or t["clarity"]["found"]
    if trackers:
        c.append(check("Cookiebanner / consent", PASS if d["consent"] else WARN,
                       ", ".join(d["consent"]) or "tracking zonder herkenbare cookiebanner (AVG-risico)"))
    cms = ", ".join(d["cms"]) or (d["generator"] or "onbekend / maatwerk")
    c.append(check("CMS / bouwplatform", INFO, cms))
    return c
