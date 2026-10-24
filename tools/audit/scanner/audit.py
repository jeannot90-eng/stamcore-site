"""Orkestratie: één volledige audit van één site, als gewone dict (direct JSON-baar).

PageSpeed draait op de achtergrond (duurt 20-60 s per run) terwijl we crawlen.
"""

import datetime as dt
from concurrent.futures import ThreadPoolExecutor

from . import crawl, findings, links, onpage, psi, technical, tracking, urls
from .http import Fetcher
from .models import section_score


def run_audit(url: str, *, max_pages: int = 10, psi_key: str | None = None, use_psi: bool = True,
              check_links: bool = True, timeout: float = 15, user_agent: str | None = None,
              log=print) -> dict:
    explicit_scheme = url.strip().lower().startswith(("http://", "https://"))
    url = urls.ensure_scheme(url)
    fetcher = Fetcher(timeout=timeout, user_agent=user_agent)
    # Geen schema opgegeven en https werkt niet? Dan is het waarschijnlijk een http-only site.
    if not explicit_scheme and fetcher.get(url, read_body=False).error:
        http_url = "http://" + url.split("://", 1)[1]
        if not fetcher.get(http_url, read_body=False).error:
            log("https werkt niet, verder via http://")
            url = http_url
    result: dict = {
        "input_url": url,
        "scanned_at": dt.datetime.now().isoformat(timespec="seconds"),
        "host": urls.host_of(url),
        "reachable": False,
        "psi": None,
    }

    with ThreadPoolExecutor(max_workers=2) as pool:
        psi_futures = {}
        if use_psi:
            log("PageSpeed Insights gestart (mobiel + desktop, op de achtergrond)…")
            psi_futures = {s: pool.submit(psi.run, url, s, psi_key) for s in ("mobile", "desktop")}

        log(f"Crawlen (max {max_pages} pagina's)…")
        cr = crawl.crawl(fetcher, url, max_pages=max_pages, log=log)
        home_fetch = cr["home_fetch"]
        result["home_fetch"] = home_fetch.summary()
        result["final_url"] = home_fetch.final_url or url
        result["host"] = urls.host_of(result["final_url"]) or result["host"]
        result["reachable"] = cr["home"] is not None
        result["crawl"] = {"limit": max_pages, "count": len(cr["pages"]),
                           "discovered": cr.get("discovered", 0), "errors": cr["errors"]}

        if result["reachable"]:
            log("On-page analyse…")
            result["pages"] = [onpage.analyze_page(p, result["host"]) for p in cr["pages"]]
            result["onpage"] = onpage.summarize(result["pages"])
            log("Techniek (https, robots, sitemap, 404, gewicht)…")
            result["technical"] = technical.run_all(fetcher, cr, log=log)
            log("Tracking & tools…")
            result["tracking"] = tracking.detect(cr["pages"])
            if check_links:
                log("Links op de homepage controleren…")
                result["links"] = links.check_links(fetcher, cr["home"])
        else:
            result["pages"] = []

        if psi_futures:
            log("Wachten op PageSpeed Insights…")
            result["psi"] = {}
            for strategy, fut in psi_futures.items():
                try:
                    result["psi"][strategy] = fut.result(timeout=300)
                except Exception as exc:  # noqa: BLE001
                    result["psi"][strategy] = {"strategy": strategy, "error": str(exc), "scores": {}}
                err = result["psi"][strategy].get("error")
                log(f"  · {strategy}: {'fout — ' + err if err else 'klaar'}")

    result["scores"] = compute_scores(result)
    result["findings"] = [f.to_dict() for f in findings.build(result)]
    return result


def compute_scores(r: dict) -> dict:
    """Alle scores 0-100 op één plek (None = niet gemeten)."""
    s = {}
    p = r.get("psi") or {}
    for strategy in ("mobile", "desktop"):
        for cat in psi.CATEGORIES:
            s[f"{strategy}_{cat}"] = ((p.get(strategy) or {}).get("scores") or {}).get(cat)
    home = (r.get("pages") or [None])[0]
    onpage_checks = (home["checks"] if home else []) + ((r.get("onpage") or {}).get("checks") or [])
    s["onpage"] = section_score(onpage_checks)
    s["technical"] = section_score((r.get("technical") or {}).get("checks") or [])
    s["tracking"] = section_score((r.get("tracking") or {}).get("checks") or [])
    return s
