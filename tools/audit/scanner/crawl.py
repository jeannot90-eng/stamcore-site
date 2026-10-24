"""Interne pagina's verzamelen: breadth-first vanaf de homepage tot max_pages."""

from collections import deque
from dataclasses import dataclass

from bs4 import BeautifulSoup

from . import urls
from .http import Fetcher, FetchResult


@dataclass
class Page:
    url: str              # de URL zoals gevonden
    fetch: FetchResult    # de HTTP-response
    soup: BeautifulSoup   # geparste HTML
    depth: int            # klikdiepte vanaf de homepage


def parse_html(text: str) -> BeautifulSoup:
    """html.parser zit in de standaardbibliotheek; geen lxml nodig."""
    try:
        return BeautifulSoup(text, "html.parser")
    except Exception:  # noqa: BLE001 - extreem kapotte HTML
        return BeautifulSoup("", "html.parser")


def page_links(soup: BeautifulSoup, base_url: str) -> list[str]:
    """Alle absolute http(s)-links uit <a href>, in documentvolgorde, ontdubbeld."""
    out, seen = [], set()
    for a in soup.find_all("a", href=True):
        absolute = urls.resolve(base_url, a.get("href", ""))
        if absolute:
            n = urls.normalize(absolute)
            if n not in seen:
                seen.add(n)
                out.append(n)
    return out


def crawl(fetcher: Fetcher, start_url: str, max_pages: int = 10, log=print) -> dict:
    """Crawl de site. Geeft {'home': Page|None, 'pages': [Page], 'errors': [...], 'home_fetch': FetchResult}.

    - Alleen links op dezelfde host (www wel/niet maakt niet uit).
    - Alleen HTML-pagina's met status 200 tellen als pagina.
    - Interne links die een fout geven (404, 500, timeout) komen in 'errors'.
    """
    home_fetch = fetcher.get(start_url)
    result = {"home": None, "pages": [], "errors": [], "home_fetch": home_fetch}
    if not home_fetch.ok or not home_fetch.is_html:
        reason = home_fetch.error or f"status {home_fetch.status}, type '{home_fetch.content_type}'"
        log(f"  ! homepage niet bruikbaar: {reason}")
        return result

    site_host = urls.host_of(home_fetch.final_url)
    seen = {urls.normalize(start_url), urls.normalize(home_fetch.final_url)}
    page_set: set = set()
    queue: deque = deque()

    def accept(fetch: FetchResult, url: str, depth: int) -> Page | None:
        if not fetch.ok or fetch.status != 200 or not fetch.is_html:
            result["errors"].append({"url": url, "status": fetch.status, "error": fetch.error,
                                     "content_type": fetch.content_type})
            return None
        # Redirect naar een andere site? Dan niet meetellen.
        if not urls.same_site(fetch.final_url, site_host):
            return None
        # Redirect naar een pagina die we al hebben (bv. /index.html -> /)? Niet dubbel tellen.
        final = urls.normalize(fetch.final_url)
        if final in page_set:
            return None
        page_set.add(final)
        seen.add(final)
        page = Page(url=fetch.final_url, fetch=fetch, soup=parse_html(fetch.text), depth=depth)
        result["pages"].append(page)
        for link in page_links(page.soup, fetch.final_url):
            if (link not in seen and urls.same_site(link, site_host)
                    and not urls.NON_PAGE_EXT.search(link.split("?")[0])):
                seen.add(link)
                queue.append((link, depth + 1))
        return page

    result["home"] = accept(home_fetch, home_fetch.final_url, 0)
    log(f"  · {urls.path_label(home_fetch.final_url)}")

    while queue and len(result["pages"]) < max_pages:
        url, depth = queue.popleft()
        fetch = fetcher.get(url)
        if accept(fetch, url, depth):
            log(f"  · {urls.path_label(fetch.final_url)}")

    result["discovered"] = len(seen)
    return result
