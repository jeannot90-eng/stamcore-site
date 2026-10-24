"""Defensieve HTTP-client.

Regel: niets in dit bestand gooit een exception naar de aanroeper. Elke fout
(DNS, SSL, timeout, rare encoding, te grote body) komt terug als FetchResult.error.
"""

import socket
import threading
import time
from dataclasses import dataclass, field
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter

# Gewone Chrome-UA: we willen zien wat een bezoeker ziet. Een extra token (bv. 'StamCoreAudit')
# achter een browser-UA wordt door botfilters juist als nep herkend en geblokkeerd.
# Aan te passen met --user-agent.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36"
)
MAX_BYTES = 5_000_000  # body wordt na 5 MB afgekapt; genoeg voor elke normale HTML-pagina


@dataclass
class FetchResult:
    url: str
    final_url: str = ""
    status: int | None = None
    headers: dict = field(default_factory=dict)  # keys lowercase
    text: str = ""
    size: int = 0                 # bytes over de lijn (gedecomprimeerd), max MAX_BYTES
    ttfb: float | None = None     # seconden tot de headers binnen waren
    elapsed: float | None = None  # seconden totaal, incl. body
    redirects: list = field(default_factory=list)  # [(status, url), ...] van de keten
    error: str | None = None

    @property
    def ok(self) -> bool:
        return self.error is None and self.status is not None and 200 <= self.status < 400

    @property
    def content_type(self) -> str:
        return self.headers.get("content-type", "").lower()

    @property
    def is_html(self) -> bool:
        ct = self.content_type
        return "html" in ct or (not ct and "<html" in self.text[:2000].lower())

    def summary(self) -> dict:
        """Compacte versie voor de JSON-export (zonder de volledige HTML)."""
        return {
            "url": self.url, "final_url": self.final_url, "status": self.status,
            "size": self.size, "ttfb": self.ttfb, "elapsed": self.elapsed,
            "redirects": self.redirects, "error": self.error,
            "content_type": self.content_type,
        }


def _short_error(exc: Exception) -> str:
    """Maak van een requests-exception een leesbare, korte melding."""
    if isinstance(exc, requests.exceptions.SSLError):
        return "SSL-certificaat ongeldig of verlopen"
    if isinstance(exc, requests.exceptions.Timeout):
        return "Timeout (site reageert te traag)"
    if isinstance(exc, requests.exceptions.TooManyRedirects):
        return "Redirect-lus (te veel doorverwijzingen)"
    if isinstance(exc, requests.exceptions.ConnectionError):
        msg = str(exc)
        if "NameResolution" in msg or "getaddrinfo" in msg or "Name or service" in msg:
            return "Domein bestaat niet / DNS-fout"
        return "Verbinding mislukt"
    text = str(exc) or exc.__class__.__name__
    return text[:160]


def _decode(body: bytes, response: requests.Response) -> str:
    """UTF-8 eerst (meest voorkomend), dan de door de server opgegeven charset, dan cp1252."""
    declared = None
    if "charset=" in response.headers.get("content-type", "").lower():
        declared = response.encoding
    for enc in ("utf-8", declared, "cp1252"):
        if not enc:
            continue
        try:
            return body.decode(enc)
        except (UnicodeDecodeError, LookupError):
            continue
    return body.decode("utf-8", errors="replace")


# --------------------------------------------------------------------------- IPv6-fallback
# Heeft een host een IPv6-adres dat (vanaf hier) niet reageert, dan wacht elke verbinding
# eerst op een timeout (~20 s op Windows) voordat IPv4 wordt geprobeerd. Dat maakt de scan
# traag en de tijdmetingen waardeloos. Daarom testen we per host één keer kort het
# IPv6-adres; werkt dat niet, dan krijgt die host alleen nog IPv4-adressen.

_real_getaddrinfo = socket.getaddrinfo
_ipv6_ok: dict = {}
_ipv6_lock = threading.Lock()
IPV6_BROKEN_HOSTS: set = set()


def _getaddrinfo_with_fallback(host, port, family=0, type=0, proto=0, flags=0):
    infos = _real_getaddrinfo(host, port, family, type, proto, flags)
    v6 = [i for i in infos if i[0] == socket.AF_INET6]
    v4 = [i for i in infos if i[0] == socket.AF_INET]
    if not v6 or not v4 or not isinstance(host, str) or not port:
        return infos
    with _ipv6_lock:
        if host not in _ipv6_ok:
            try:
                s = socket.socket(socket.AF_INET6, socket.SOCK_STREAM)
                s.settimeout(2.5)
                s.connect(v6[0][4])
                s.close()
                _ipv6_ok[host] = True
            except OSError:
                _ipv6_ok[host] = False
                IPV6_BROKEN_HOSTS.add(host)
    return infos if _ipv6_ok[host] else v4


def _prime_dns(url: str):
    """Doe de (eenmalige) IPv6-test per host vóór de tijdmeting begint."""
    try:
        host = urlsplit(url).hostname
        if host and host not in _ipv6_ok:
            socket.getaddrinfo(host, 443, 0, socket.SOCK_STREAM)
    except (OSError, ValueError):
        pass


def ensure_working_ip_family():
    if socket.getaddrinfo is not _getaddrinfo_with_fallback:
        socket.getaddrinfo = _getaddrinfo_with_fallback


class Fetcher:
    """Eén gedeelde sessie (keep-alive) met vaste timeout. Veilig voor threads bij GET/HEAD."""

    def __init__(self, timeout: float = 15, user_agent: str | None = None):
        ensure_working_ip_family()
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent or USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
        })
        adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20, max_retries=0)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def get(self, url: str, allow_redirects: bool = True, read_body: bool = True,
            timeout: float | None = None) -> FetchResult:
        res = FetchResult(url=url)
        _prime_dns(url)  # IPv6-test buiten de tijdmeting houden
        start = time.monotonic()
        try:
            r = self.session.get(url, timeout=timeout or self.timeout,
                                 allow_redirects=allow_redirects, stream=True)
        except Exception as exc:  # noqa: BLE001 - bewust breed: nooit crashen
            res.error = _short_error(exc)
            res.elapsed = time.monotonic() - start
            return res
        try:
            res.status = r.status_code
            res.final_url = r.url
            res.headers = {k.lower(): v for k, v in r.headers.items()}
            res.redirects = [(h.status_code, h.url) for h in r.history]
            res.ttfb = r.elapsed.total_seconds()
            if read_body:
                chunks, total = [], 0
                for chunk in r.iter_content(65536):
                    chunks.append(chunk)
                    total += len(chunk)
                    if total > MAX_BYTES:
                        break
                res.size = total
                res.text = _decode(b"".join(chunks), r)
        except Exception as exc:  # noqa: BLE001
            res.error = _short_error(exc)
        finally:
            r.close()
            res.elapsed = time.monotonic() - start
        return res

    def head(self, url: str) -> FetchResult:
        """HEAD-request; bij een foutstatus of fout nog één keer met GET (zonder body).

        Veel servers implementeren HEAD slecht (405/403/404 terwijl de pagina wel
        werkt), dus een slechte HEAD wordt altijd met GET bevestigd.
        """
        res = FetchResult(url=url)
        _prime_dns(url)
        start = time.monotonic()
        try:
            r = self.session.head(url, timeout=self.timeout, allow_redirects=True)
            res.status, res.final_url = r.status_code, r.url
            res.headers = {k.lower(): v for k, v in r.headers.items()}
            r.close()
        except Exception as exc:  # noqa: BLE001
            res.error = _short_error(exc)
        res.elapsed = time.monotonic() - start
        if res.error or (res.status or 0) >= 400:
            return self.get(url, read_body=False)
        return res
