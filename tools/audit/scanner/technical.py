"""Technische checks: HTTPS, redirects, robots.txt, sitemap, mixed content, paginagewicht, 404, server.

Elke functie geeft een dict met meetwaarden terug; run_all() bundelt ze en bouwt de checklist.
"""

import re
import secrets
from concurrent.futures import ThreadPoolExecutor
from urllib.parse import urlsplit

from . import urls
from .crawl import parse_html
from .http import IPV6_BROKEN_HOSTS, Fetcher, FetchResult
from .models import FAIL, INFO, PASS, WARN, check

# --------------------------------------------------------------------------- HTTPS & redirects


def check_https(fetcher: Fetcher, home: FetchResult) -> dict:
    host = urls.host_of(home.final_url)
    d = {
        "final_url": home.final_url,
        "uses_https": home.final_url.lower().startswith("https://"),
        "hsts": "strict-transport-security" in home.headers,
    }
    # Gaat http:// netjes naar https://?
    http_try = fetcher.get(f"http://{host}/", read_body=False, timeout=8)
    d["http_status_chain"] = [s for s, _ in http_try.redirects] + ([http_try.status] if http_try.status else [])
    d["http_final"] = http_try.final_url
    d["http_error"] = http_try.error
    d["http_redirects_to_https"] = bool(http_try.final_url) and http_try.final_url.lower().startswith("https://")
    d["http_redirect_permanent"] = bool(http_try.redirects) and http_try.redirects[0][0] in (301, 308)

    # Komen www en zonder-www op dezelfde plek uit?
    other = urls.bare_host(host) if host.startswith("www.") else f"www.{host}"
    alt = fetcher.get(f"https://{other}/", read_body=False, timeout=8)
    d["alt_host"] = other
    d["alt_host_error"] = alt.error
    d["alt_host_final"] = alt.final_url
    d["alt_host_consistent"] = (not alt.error) and urls.host_of(alt.final_url) == host
    return d


# --------------------------------------------------------------------------- robots.txt


def check_robots(fetcher: Fetcher, base: str) -> dict:
    r = fetcher.get(f"{base}/robots.txt")
    d = {"url": f"{base}/robots.txt", "status": r.status, "error": r.error, "exists": False,
         "sitemaps": [], "blocks_all": False, "disallows": [], "content": ""}
    looks_like_html = "<html" in r.text[:500].lower()
    if r.status != 200 or looks_like_html:
        return d
    d["exists"] = True
    d["content"] = r.text[:3000]
    # Opeenvolgende User-agent-regels vormen één groep; de eerste andere regel sluit de kop af.
    agents, collecting_agents, applies = [], False, False
    for raw in r.text.splitlines():
        line = raw.split("#", 1)[0].strip()
        if ":" not in line:
            continue
        key, value = (x.strip() for x in line.split(":", 1))
        key = key.lower()
        if key == "user-agent":
            if not collecting_agents:
                agents = []
            agents.append(value.lower())
            applies = "*" in agents or "googlebot" in agents
            collecting_agents = True
            continue
        collecting_agents = False
        if key == "sitemap" and value:
            d["sitemaps"].append(value)
        elif key == "disallow" and applies and value:
            d["disallows"].append(value)
            if value == "/":
                d["blocks_all"] = True
    return d


# --------------------------------------------------------------------------- sitemap


_LOC = re.compile(r"<loc>\s*(.*?)\s*</loc>", re.I | re.S)


def check_sitemap(fetcher: Fetcher, base: str, robots: dict) -> dict:
    candidates = list(robots.get("sitemaps") or []) + [f"{base}/sitemap.xml", f"{base}/sitemap_index.xml", f"{base}/wp-sitemap.xml"]
    d = {"found": False, "url": None, "is_index": False, "url_count": 0, "children": 0,
         "sample": [], "tried": [], "in_robots": bool(robots.get("sitemaps"))}
    for cand in dict.fromkeys(candidates):  # ontdubbelen, volgorde behouden
        r = fetcher.get(cand)
        d["tried"].append({"url": cand, "status": r.status, "error": r.error})
        if r.status != 200 or ("<urlset" not in r.text and "<sitemapindex" not in r.text):
            continue
        d.update(found=True, url=r.final_url)
        if "<sitemapindex" in r.text:
            d["is_index"] = True
            children = _LOC.findall(r.text)
            d["children"] = len(children)
            # Maximaal 5 sub-sitemaps ophalen om het aantal URL's te schatten
            for child in children[:5]:
                cr = fetcher.get(child)
                locs = _LOC.findall(cr.text) if cr.status == 200 else []
                d["url_count"] += len(locs)
                d["sample"] += locs[: max(0, 10 - len(d["sample"]))]
            d["url_count_partial"] = len(children) > 5
        else:
            locs = _LOC.findall(r.text)
            d["url_count"] = len(locs)
            d["sample"] = locs[:10]
        break
    return d


# --------------------------------------------------------------------------- mixed content


_RESOURCE_TAGS = {"img": "src", "script": "src", "iframe": "src", "source": "src", "video": "src",
                  "audio": "src", "embed": "src", "object": "data", "link": "href"}


def find_mixed_content(pages) -> list[dict]:
    """http://-resources op https-pagina's (afbeeldingen, scripts, css, iframes)."""
    out = []
    for page in pages:
        if not page.url.lower().startswith("https://"):
            continue
        for tag, attr in _RESOURCE_TAGS.items():
            for el in page.soup.find_all(tag):
                if tag == "link" and "stylesheet" not in [r.lower() for r in (el.get("rel") or [])]:
                    continue
                val = (el.get(attr) or "").strip()
                srcset = el.get("srcset") or ""
                candidates = [val] + [s.strip().split(" ")[0] for s in srcset.split(",") if s.strip()]
                for v in candidates:
                    if v.lower().startswith("http://"):
                        out.append({"page": page.url, "tag": tag, "url": v[:200]})
    # ontdubbelen
    seen, uniq = set(), []
    for m in out:
        k = (m["page"], m["url"])
        if k not in seen:
            seen.add(k)
            uniq.append(m)
    return uniq


# --------------------------------------------------------------------------- paginagewicht


def estimate_weight(fetcher: Fetcher, home_page, max_resources: int = 80) -> dict:
    """Schat het gewicht van de homepage: HTML + scripts + CSS + afbeeldingen (via HEAD Content-Length).

    Het is een schatting: lazy-loaded en via JS geladen bestanden ontbreken, en niet elke
    server stuurt Content-Length. PageSpeed (total-byte-weight) is nauwkeuriger als die er is.
    """
    soup, base = home_page.soup, home_page.url
    res = []
    for s in soup.find_all("script", src=True):
        res.append(("js", s["src"]))
    for link in soup.find_all("link", href=True):
        if "stylesheet" in [r.lower() for r in (link.get("rel") or [])]:
            res.append(("css", link["href"]))
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src")
        if src and not src.startswith("data:"):
            res.append(("img", src))
    resolved = []
    seen = set()
    for kind, href in res:
        u = urls.resolve(base, href)
        if u and u not in seen:
            seen.add(u)
            resolved.append((kind, u))
    resolved = resolved[:max_resources]

    def size_of(item):
        kind, u = item
        r = fetcher.head(u)
        try:
            return kind, int(r.headers.get("content-length", "")), u
        except ValueError:
            return kind, None, u

    by_kind = {"html": home_page.fetch.size, "js": 0, "css": 0, "img": 0}
    unknown = 0
    largest = []
    with ThreadPoolExecutor(max_workers=10) as pool:
        for kind, size, u in pool.map(size_of, resolved):
            if size is None:
                unknown += 1
                continue
            by_kind[kind] += size
            largest.append((size, u))
    largest.sort(reverse=True)
    return {
        "total_bytes": sum(by_kind.values()), "by_kind": by_kind, "resources": len(resolved),
        "unknown_size": unknown,
        "largest": [{"url": u, "bytes": s} for s, u in largest[:5]],
        "requests_estimate": len(resolved) + 1,
    }


# --------------------------------------------------------------------------- 404


def check_not_found(fetcher: Fetcher, base: str) -> dict:
    probe = f"{base}/stamcore-check-{secrets.token_hex(4)}-bestaat-niet"
    r = fetcher.get(probe)
    d = {"probe": probe, "status": r.status, "final_url": r.final_url, "error": r.error,
         "redirected": bool(r.redirects), "proper": r.status in (404, 410), "helpful": False}
    if r.text:
        soup = parse_html(r.text)
        d["helpful"] = len(soup.find_all("a", href=True)) >= 3  # menu/terugknop aanwezig
        title = soup.find("title")
        d["title"] = title.get_text(strip=True)[:100] if title else ""
    if r.status == 200:
        d["verdict"] = "soft404-redirect" if r.redirects else "soft404"
    elif d["proper"]:
        d["verdict"] = "ok"
    else:
        d["verdict"] = "other"
    return d


# --------------------------------------------------------------------------- server


def server_info(home: FetchResult) -> dict:
    h = home.headers
    return {
        "ttfb": home.ttfb, "elapsed": home.elapsed, "html_bytes": home.size,
        "compression": h.get("content-encoding"), "server": h.get("server"),
        "ipv6_unreachable": urls.host_of(home.final_url or home.url) in IPV6_BROKEN_HOSTS,
        "powered_by": h.get("x-powered-by"), "cache_control": h.get("cache-control"),
        "security_headers": {k: k in h for k in ("strict-transport-security", "content-security-policy",
                                                  "x-content-type-options", "x-frame-options",
                                                  "referrer-policy")},
    }


# --------------------------------------------------------------------------- bundelen


def run_all(fetcher: Fetcher, crawl_result: dict, log=print) -> dict:
    home_fetch = crawl_result["home_fetch"]
    home_page = crawl_result["home"]
    base = urls.origin(home_fetch.final_url or home_fetch.url)
    t = {}
    steps = [
        ("https", lambda: check_https(fetcher, home_fetch)),
        ("robots", lambda: check_robots(fetcher, base)),
        ("not_found", lambda: check_not_found(fetcher, base)),
        ("server", lambda: server_info(home_fetch)),
        ("mixed_content", lambda: find_mixed_content(crawl_result["pages"])),
        ("weight", lambda: estimate_weight(fetcher, home_page) if home_page else None),
    ]
    for key, fn in steps:
        try:
            t[key] = fn()
        except Exception as exc:  # noqa: BLE001 - één kapotte check mag de rest niet slopen
            log(f"  ! technische check '{key}' faalde: {exc}")
            t[key] = None
    try:
        t["sitemap"] = check_sitemap(fetcher, base, t.get("robots") or {})
    except Exception as exc:  # noqa: BLE001
        log(f"  ! sitemap-check faalde: {exc}")
        t["sitemap"] = None
    t["internal_errors"] = crawl_result.get("errors", [])
    t["checks"] = build_checks(t)
    return t


def _kb(n):
    return f"{n / 1024:.0f} KB" if n < 1024 * 1024 else f"{n / 1024 / 1024:.1f} MB"


def build_checks(t: dict) -> list:
    c = []
    h = t.get("https") or {}
    if h:
        c.append(check("HTTPS", PASS if h["uses_https"] else FAIL,
                       "site draait op https" if h["uses_https"] else "site draait op http — 'Niet veilig' in Chrome"))
        if h["http_redirects_to_https"]:
            c.append(check("http → https redirect", PASS if h["http_redirect_permanent"] else WARN,
                           "keten: " + " → ".join(map(str, h["http_status_chain"]))
                           + ("" if h["http_redirect_permanent"] else " (geen 301: tijdelijke redirect)")))
        else:
            c.append(check("http → https redirect", FAIL,
                           h["http_error"] or f"http blijft op {h['http_final'] or 'http'}"))
        c.append(check(f"www/zonder-www gelijk ({h['alt_host']})",
                       PASS if h["alt_host_consistent"] else WARN,
                       "stuurt door naar dezelfde host" if h["alt_host_consistent"]
                       else (h["alt_host_error"] or f"komt uit op {h['alt_host_final']}")))
        c.append(check("HSTS-header", PASS if h["hsts"] else INFO, "" if h["hsts"] else "niet ingesteld"))

    r = t.get("robots") or {}
    if r:
        if not r["exists"]:
            c.append(check("robots.txt", WARN, f"niet gevonden (status {r['status'] or r['error']})"))
        elif r["blocks_all"]:
            c.append(check("robots.txt", FAIL, "Disallow: / — blokkeert Google voor de hele site!"))
        else:
            c.append(check("robots.txt", PASS, f"{len(r['disallows'])} disallow-regel(s)"))
        c.append(check("Sitemap in robots.txt", PASS if r["sitemaps"] else WARN,
                       ", ".join(r["sitemaps"][:2]) or "geen Sitemap:-regel"))

    s = t.get("sitemap") or {}
    if s:
        if s["found"]:
            n = s["url_count"]
            c.append(check("sitemap.xml", PASS if n else WARN,
                           f"{n}{'+' if s.get('url_count_partial') else ''} URL's"
                           + (f" in {s['children']} sub-sitemaps" if s["is_index"] else "") + f" — {s['url']}"))
        else:
            c.append(check("sitemap.xml", FAIL, "geen sitemap gevonden"))

    mc = t.get("mixed_content")
    if mc is not None:
        c.append(check("Geen mixed content", PASS if not mc else FAIL,
                       "" if not mc else f"{len(mc)} http-bestand(en) op https-pagina's, bv. {mc[0]['url'][:80]}"))

    w = t.get("weight")
    if w:
        tb = w["total_bytes"]
        st = PASS if tb < 2_000_000 else WARN if tb < 4_000_000 else FAIL
        c.append(check("Paginagewicht homepage (schatting)", st,
                       f"±{_kb(tb)} over {w['requests_estimate']} bestanden"
                       + (f" ({w['unknown_size']} onbekend)" if w["unknown_size"] else "")))

    nf = t.get("not_found") or {}
    if nf:
        verdict = nf.get("verdict")
        if verdict == "ok":
            c.append(check("Nette 404-pagina", PASS if nf["helpful"] else WARN,
                           f"status {nf['status']}" + ("" if nf["helpful"] else ", maar zonder links terug")))
        elif verdict == "soft404-redirect":
            c.append(check("Nette 404-pagina", WARN, f"onbekende URL stuurt door naar {nf['final_url']} (status 200)"))
        elif verdict == "soft404":
            c.append(check("Nette 404-pagina", FAIL, "onbekende URL geeft status 200 (soft 404)"))
        else:
            c.append(check("Nette 404-pagina", WARN, f"status {nf['status'] or nf['error']}"))

    sv = t.get("server") or {}
    if sv and sv.get("ttfb") is not None:
        ttfb = sv["ttfb"]
        c.append(check("Serverreactietijd", PASS if ttfb < 0.8 else WARN if ttfb < 1.8 else FAIL,
                       f"{ttfb * 1000:.0f} ms tot eerste byte"))
        c.append(check("Compressie (gzip/brotli)", PASS if sv["compression"] else WARN,
                       sv["compression"] or "HTML wordt ongecomprimeerd verstuurd"))
        if sv.get("ipv6_unreachable"):
            c.append(check("IPv6 (AAAA) bereikbaar", WARN,
                           "IPv6-adres reageert niet vanaf de scanlocatie; bezoekers met IPv6 kunnen "
                           "seconden wachten. Even dubbelchecken via een externe IPv6-test."))

    errs = t.get("internal_errors") or []
    if errs:
        broken = [e for e in errs if (e.get("status") or 0) >= 400 or e.get("error")]
        if broken:
            c.append(check("Interne pagina's bereikbaar", FAIL if len(broken) > 2 else WARN,
                           f"{len(broken)} interne link(s) geven een fout, bv. {urls.path_label(broken[0]['url'])}"))
    return c
