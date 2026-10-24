"""Kapotte links op de homepage opsporen (HEAD, met GET als bevestiging)."""

from concurrent.futures import ThreadPoolExecutor

from . import urls
from .crawl import page_links
from .http import Fetcher

# Sites die bots blokkeren of altijd een rare status geven: niet als 'kapot' rekenen
BOT_HOSTILE = ("linkedin.com", "facebook.com", "instagram.com", "x.com", "twitter.com",
               "tiktok.com", "werkspot.nl", "trustpilot.com", "google.com", "maps.app.goo.gl")
UNSURE_STATUS = {401, 403, 405, 429, 999}


def check_links(fetcher: Fetcher, home_page, max_links: int = 150, workers: int = 10) -> dict:
    if home_page is None:
        return {"checked": 0, "broken": [], "unsure": [], "results": [], "skipped": 0}
    links = page_links(home_page.soup, home_page.url)
    to_check, skipped = links[:max_links], max(0, len(links) - max_links)
    site_host = urls.host_of(home_page.url)

    def probe(url):
        r = fetcher.head(url)
        host = urls.host_of(url)
        if r.error:
            verdict = "unsure" if "Timeout" in r.error else "broken"
        elif r.status in UNSURE_STATUS or (r.status >= 400 and any(host.endswith(b) for b in BOT_HOSTILE)):
            verdict = "unsure"
        elif r.status >= 400:
            verdict = "broken"
        else:
            verdict = "ok"
        return {"url": url, "status": r.status, "final_url": r.final_url, "error": r.error,
                "internal": urls.is_internal(url, site_host), "verdict": verdict}

    with ThreadPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(probe, to_check))
    return {
        "checked": len(results), "skipped": skipped, "results": results,
        "broken": [r for r in results if r["verdict"] == "broken"],
        "unsure": [r for r in results if r["verdict"] == "unsure"],
    }
