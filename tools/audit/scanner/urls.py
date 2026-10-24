"""URL-hulpfuncties: normaliseren, host bepalen, intern vs. extern."""

import re
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit

try:  # tldextract is optioneel; zonder valt het terug op 'laatste twee labels'
    import tldextract

    # suffix_list_urls=() -> gebruik de meegeleverde lijst, geen netwerkverzoek
    _EXTRACT = tldextract.TLDExtract(suffix_list_urls=(), cache_dir=None)
except Exception:  # noqa: BLE001
    _EXTRACT = None

TRACKING_PARAMS = re.compile(r"^(utm_\w+|gclid|fbclid|msclkid|mc_cid|mc_eid|_ga|ref)$", re.I)

# Bestanden die we niet als pagina crawlen
NON_PAGE_EXT = re.compile(
    r"\.(pdf|jpe?g|png|gif|webp|avif|svg|ico|bmp|tiff?|zip|rar|7z|gz|docx?|xlsx?|pptx?|"
    r"odt|csv|mp[34]|mov|avi|wav|webm|ics|xml|css|js|json|txt|woff2?|ttf|eot|exe|dmg)$",
    re.I,
)


def ensure_scheme(url: str) -> str:
    url = url.strip()
    if not re.match(r"^https?://", url, re.I):
        url = "https://" + url.lstrip("/")
    return url


def host_of(url: str) -> str:
    try:
        return (urlsplit(url).hostname or "").lower()
    except ValueError:
        return ""


def bare_host(host: str) -> str:
    """'www.voorbeeld.nl' -> 'voorbeeld.nl'."""
    return host[4:] if host.startswith("www.") else host


def registered_domain(host: str) -> str:
    """'shop.voorbeeld.co.uk' -> 'voorbeeld.co.uk' (met tldextract), anders laatste twee labels."""
    host = host.lower().strip(".")
    if _EXTRACT is not None:
        try:
            r = _EXTRACT(host)
            rd = getattr(r, "top_domain_under_public_suffix", None) or r.registered_domain
            if rd:
                return rd
        except Exception:  # noqa: BLE001
            pass
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host


def origin(url: str) -> str:
    p = urlsplit(url)
    return f"{p.scheme}://{p.netloc}"


def normalize(url: str) -> str:
    """Canonieke vorm voor deduplicatie: kleine letters host, geen fragment, geen tracking-params."""
    try:
        p = urlsplit(url.strip())
    except ValueError:
        return url
    scheme = p.scheme.lower()
    netloc = p.netloc.lower()
    if (scheme == "http" and netloc.endswith(":80")) or (scheme == "https" and netloc.endswith(":443")):
        netloc = netloc.rsplit(":", 1)[0]
    query = urlencode([(k, v) for k, v in parse_qsl(p.query, keep_blank_values=True)
                       if not TRACKING_PARAMS.match(k)])
    return urlunsplit((scheme, netloc, p.path or "/", query, ""))


def resolve(base: str, href: str) -> str | None:
    """Absolute http(s)-URL voor een href, of None voor mailto:/tel:/javascript:/#anker."""
    if not href:
        return None
    href = href.strip()
    if href.startswith("#") or re.match(r"^(mailto|tel|javascript|data|sms|whatsapp|callto):", href, re.I):
        return None
    try:
        absolute = urljoin(base, href)
    except ValueError:
        return None
    if not absolute.lower().startswith(("http://", "https://")):
        return None
    return absolute


def is_internal(url: str, site_host: str) -> bool:
    """Intern = zelfde geregistreerde domein (subdomeinen tellen mee)."""
    h = host_of(url)
    return bool(h) and registered_domain(h) == registered_domain(site_host)


def same_site(url: str, site_host: str) -> bool:
    """Voor de crawler: zelfde host, www wel/niet maakt niet uit."""
    return bare_host(host_of(url)) == bare_host(site_host)


def path_label(url: str) -> str:
    """Kort label voor in tabellen: het pad (+ query)."""
    p = urlsplit(url)
    return (p.path or "/") + (f"?{p.query}" if p.query else "")
