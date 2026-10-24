#!/usr/bin/env python3
"""Stam Core website-audit — prospects doorlichten en een verbeterrapport maken.

Gebruik:
    python stamcore_scan.py voorbeeld.nl
    python stamcore_scan.py voorbeeld.nl --pages 20 --dienst glazenwasser --plaats Tilburg
    python stamcore_scan.py voorbeeld.nl --competitor concurrent.nl --json
    python stamcore_scan.py voorbeeld.nl --no-psi          # snel, zonder PageSpeed

PageSpeed API-key: --key of omgevingsvariabele PSI_API_KEY (of GOOGLE_API_KEY).
Uitvoer: rapporten/<domein>-<datum>.html (en .json met --json).
Zie README.md voor uitleg en uitbreiden.
"""

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

from scanner import __version__, gap as gap_mod, report, urls
from scanner.audit import run_audit

DEFAULT_OUT = Path(__file__).resolve().parent / "rapporten"


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        prog="stamcore_scan",
        description="Website-audit voor prospects: PageSpeed, on-page SEO, techniek, tracking, links.",
    )
    p.add_argument("url", help="website van de prospect (https:// mag weg)")
    p.add_argument("--key", help="Google PageSpeed API-key (anders env PSI_API_KEY / GOOGLE_API_KEY)")
    p.add_argument("--pages", type=int, default=10, help="max aantal pagina's crawlen (default 10)")
    p.add_argument("--competitor", metavar="URL", help="concurrent meescannen voor een gap-analyse")
    p.add_argument("--json", nargs="?", const="auto", metavar="PAD",
                   help="ruwe data als JSON wegschrijven (optioneel pad)")
    p.add_argument("--out", metavar="PAD", help="pad voor het HTML-rapport")
    p.add_argument("--bedrijf", help="bedrijfsnaam (voor kop rapport en Maps-zoeklink)")
    p.add_argument("--dienst", help="dienst voor de rankingcheck, bv. 'glazenwasser'")
    p.add_argument("--plaats", help="plaats voor de rankingcheck, bv. 'Tilburg'")
    p.add_argument("--no-psi", action="store_true", help="PageSpeed Insights overslaan (veel sneller)")
    p.add_argument("--no-links", action="store_true", help="kapotte-linkscheck overslaan")
    p.add_argument("--timeout", type=float, default=15, help="timeout per request in seconden (default 15)")
    p.add_argument("--user-agent", help="eigen User-Agent (default: gewone Chrome op Windows)")
    p.add_argument("-q", "--quiet", action="store_true", help="alleen de samenvatting tonen")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p.parse_args(argv)


# --------------------------------------------------------------------------- terminal

def _setup_console():
    """UTF-8 uitvoer en ANSI-kleuren (ook op Windows)."""
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8", errors="replace")
        except (AttributeError, ValueError):
            pass
    if os.name == "nt":
        os.system("")  # zet VT-modus aan in de Windows-console
    return sys.stdout.isatty() and not os.environ.get("NO_COLOR")


COLOR = False


def c(text, code):
    return f"\033[{code}m{text}\033[0m" if COLOR else str(text)


def score_color(s):
    if s is None:
        return c("  —", "90")
    return c(f"{s:>3}", "32" if s >= 90 else "33" if s >= 50 else "31")


def print_summary(r: dict, html_path: Path, json_path: Path | None, gap: dict | None, seconds: float):
    s = r.get("scores") or {}
    print()
    print(c(f"━━ Stam Core audit · {r.get('host')} ━━", "1;36"))
    if not r.get("reachable"):
        print(c("  Homepage niet bereikbaar — rapport bevat alleen beperkte checks.", "31"))
    rows = [("Snelheid mobiel", s.get("mobile_performance")), ("Snelheid desktop", s.get("desktop_performance")),
            ("SEO (Lighthouse)", s.get("mobile_seo")), ("Toegankelijkheid", s.get("mobile_accessibility")),
            ("On-page", s.get("onpage")), ("Techniek", s.get("technical")), ("Meten", s.get("tracking"))]
    for i in range(0, len(rows), 2):
        line = "   ".join(f"{label:<17}{score_color(v)}" for label, v in rows[i:i + 2])
        print("  " + line)
    findings = r.get("findings") or []
    print()
    print(c(f"Top 5 verbeterpunten (van {len(findings)}):", "1"))
    level_col = {"hoog": "31", "middel": "33", "laag": "32"}
    for i, f in enumerate(findings[:5], 1):
        tag = c(f"[{f['level']:<6}]", level_col[f["level"]])
        print(f"  {i}. {tag} {f['title']}")
        if f.get("detail"):
            print(c(f"              {f['detail'][:110]}", "90"))
    if not findings:
        print("  Geen verbeterpunten gevonden.")
    if gap:
        print()
        print(f"Concurrent {gap['competitor_host']}: prospect staat op {gap['behind']}/{gap['compared']} punten achter.")
    print()
    print(f"Rapport: {html_path}")
    if json_path:
        print(f"JSON:    {json_path}")
    print(c(f"Klaar in {seconds:.0f} s.", "90"))


# --------------------------------------------------------------------------- main

def main(argv=None) -> int:
    global COLOR
    COLOR = _setup_console()
    args = parse_args(argv)
    key = args.key or os.environ.get("PSI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
    log = (lambda *a, **k: None) if args.quiet else (lambda msg: print(msg, file=sys.stderr, flush=True))
    if not args.no_psi and not key:
        log("Let op: geen PageSpeed API-key — de API werkt dan met een zeer lage quota (kans op fout 429).")

    started = time.monotonic()
    common = dict(max_pages=max(1, args.pages), psi_key=key, use_psi=not args.no_psi, timeout=args.timeout,
                  user_agent=args.user_agent, log=log)

    log(c(f"\n▶ Prospect: {args.url}", "1"))
    result = run_audit(args.url, check_links=not args.no_links, **common)

    competitor, gap = None, None
    if args.competitor:
        log(c(f"\n▶ Concurrent: {args.competitor}", "1"))
        try:
            competitor = run_audit(args.competitor, check_links=False, **common)
            if competitor.get("reachable") and result.get("reachable"):
                gap = gap_mod.compare(result, competitor)
                extra = [f.to_dict() for f in gap_mod.findings(gap)]
                result["findings"] = sorted(result["findings"] + extra,
                                            key=lambda f: (-f["impact"], f["category"], f["key"]))
            else:
                log("  ! concurrent niet bereikbaar — geen gap-analyse")
        except Exception as exc:  # noqa: BLE001
            log(f"  ! concurrent-scan mislukt: {exc}")

    # Bestandsnamen
    slug = re.sub(r"[^a-z0-9.-]+", "-", urls.bare_host(result.get("host") or "site").lower())
    stamp = time.strftime("%Y-%m-%d")
    html_path = Path(args.out) if args.out else DEFAULT_OUT / f"{slug}-{stamp}.html"
    html_path.parent.mkdir(parents=True, exist_ok=True)
    opts = {"bedrijf": args.bedrijf, "dienst": args.dienst, "plaats": args.plaats}
    html_path.write_text(report.render(result, opts, gap), encoding="utf-8")

    json_path = None
    if args.json:
        json_path = html_path.with_suffix(".json") if args.json == "auto" else Path(args.json)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        payload = {"tool": "stamcore_scan", "version": __version__, "options": opts,
                   "prospect": result, "competitor": competitor, "gap": gap}
        json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2, default=str), encoding="utf-8")

    print_summary(result, html_path, json_path, gap, time.monotonic() - started)
    return 0 if result.get("reachable") else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        print("\nAfgebroken.", file=sys.stderr)
        sys.exit(130)
