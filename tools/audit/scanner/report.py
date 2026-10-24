"""HTML-rapport in Stam Core-stijl (donker, strak). Eén zelfstandig .html-bestand.

Opbouw: kop -> scores -> geprioriteerde verbeterpunten -> Core Web Vitals -> checklists
-> pagina's -> links -> concurrentie-gap -> nog handmatig checken.
Alle dynamische tekst gaat door e() (HTML-escape).
"""

import datetime as dt
import html
from urllib.parse import quote_plus

from . import __version__
from .models import FAIL, INFO, PASS, WARN

BRAND = "Stam Core"
BRAND_URL = "https://stam-core.nl"
BRAND_CONTACT = "info@stam-core.nl · 0162 560 125"


def e(v) -> str:
    return html.escape("" if v is None else str(v), quote=True)


def light(score) -> str:
    """Stoplichtkleur voor een score 0-100."""
    if score is None:
        return "na"
    return "green" if score >= 90 else "orange" if score >= 50 else "red"


# --------------------------------------------------------------------------- bouwstenen

def ring(score, label: str, sub: str = "") -> str:
    c = light(score)
    pct = 0 if score is None else max(0, min(100, score))
    circ = 2 * 3.14159 * 34
    dash = circ * pct / 100
    value = "—" if score is None else str(score)
    return f"""
    <div class="ring {c}">
      <svg viewBox="0 0 80 80" aria-hidden="true">
        <circle cx="40" cy="40" r="34" class="track"/>
        <circle cx="40" cy="40" r="34" class="bar" stroke-dasharray="{dash:.1f} {circ:.1f}" transform="rotate(-90 40 40)"/>
      </svg>
      <div class="ring-val">{value}</div>
      <div class="ring-label">{e(label)}</div>
      {f'<div class="ring-sub">{e(sub)}</div>' if sub else ''}
    </div>"""


ICON = {PASS: "✓", WARN: "!", FAIL: "✕", INFO: "i"}


def checklist(checks: list) -> str:
    rows = []
    for c in checks:
        rows.append(f"""<li class="chk {c['status']}"><span class="ico">{ICON.get(c['status'], '·')}</span>
          <span class="chk-label">{e(c['label'])}</span><span class="chk-detail">{e(c['detail'])}</span></li>""")
    return f'<ul class="checklist">{"".join(rows)}</ul>'


def section(id_: str, title: str, body: str, intro: str = "") -> str:
    return f"""<section id="{id_}"><h2>{e(title)}</h2>{f'<p class="intro">{intro}</p>' if intro else ''}{body}</section>"""


def _kb(n):
    if n is None:
        return "—"
    return f"{n / 1024:.0f} KB" if n < 1024 * 1024 else f"{n / 1024 / 1024:.1f} MB"


# --------------------------------------------------------------------------- secties

def _scores(r: dict) -> str:
    s = r.get("scores") or {}
    rings = [
        ring(s.get("mobile_performance"), "Snelheid mobiel", "PageSpeed"),
        ring(s.get("desktop_performance"), "Snelheid desktop", "PageSpeed"),
        ring(s.get("mobile_seo"), "SEO", "Lighthouse"),
        ring(s.get("mobile_accessibility"), "Toegankelijkheid", "Lighthouse"),
        ring(s.get("mobile_best-practices"), "Best practices", "Lighthouse"),
        ring(s.get("onpage"), "On-page", "eigen check"),
        ring(s.get("technical"), "Techniek", "eigen check"),
        ring(s.get("tracking"), "Meten", "eigen check"),
    ]
    psi = r.get("psi")
    note = ""
    if psi is None:
        note = '<p class="note">PageSpeed is overgeslagen (--no-psi).</p>'
    else:
        errs = [f"{k}: {v.get('error')}" for k, v in psi.items() if v.get("error")]
        if errs:
            note = f'<p class="note warn">PageSpeed gaf een fout — {e("; ".join(errs))}</p>'
    return f'<div class="rings">{"".join(rings)}</div>{note}'


def _findings(findings: list) -> str:
    if not findings:
        return '<p class="empty">Geen verbeterpunten gevonden — netjes!</p>'
    cards = []
    for i, f in enumerate(findings, 1):
        cards.append(f"""
        <article class="finding {f['level']}">
          <div class="f-num">{i}</div>
          <div class="f-body">
            <div class="f-meta"><span class="pill {f['level']}">impact {e(f['level'])}</span>
              <span class="cat">{e(f['category'])}</span></div>
            <h3>{e(f['title'])}</h3>
            <p class="why">{e(f['why'])}</p>
            <p class="fix"><strong>Oplossing:</strong> {e(f['fix'])}</p>
            {f'<p class="detail">{e(f["detail"])}</p>' if f.get('detail') else ''}
          </div>
        </article>""")
    counts = {lvl: sum(1 for f in findings if f["level"] == lvl) for lvl in ("hoog", "middel", "laag")}
    summary = (f'<div class="fcount"><span class="pill hoog">{counts["hoog"]} hoog</span>'
               f'<span class="pill middel">{counts["middel"]} middel</span>'
               f'<span class="pill laag">{counts["laag"]} laag</span></div>')
    return summary + "".join(cards)


_CAT_CLASS = {"FAST": "green", "AVERAGE": "orange", "SLOW": "red"}
_CAT_NL = {"FAST": "goed", "AVERAGE": "matig", "SLOW": "slecht"}


def _vitals(r: dict) -> str:
    psi = r.get("psi") or {}
    if not psi:
        return '<p class="empty">Niet gemeten.</p>'
    mob, desk = psi.get("mobile") or {}, psi.get("desktop") or {}

    def lab_cell(run, metric):
        v = (run.get("lab") or {}).get(metric)
        if not v:
            return "<td>—</td>"
        sc = v.get("score")
        cls = "na" if sc is None else "green" if sc >= 0.9 else "orange" if sc >= 0.5 else "red"
        return f'<td><span class="dot {cls}"></span>{e(v.get("display"))}</td>'

    lab_rows = "".join(f"<tr><th>{m}</th>{lab_cell(mob, m)}{lab_cell(desk, m)}</tr>"
                       for m in ("LCP", "CLS", "FCP", "TBT", "Speed Index"))
    out = f"""<h3>Labmeting (Lighthouse)</h3>
      <table class="tbl"><thead><tr><th>Metric</th><th>Mobiel</th><th>Desktop</th></tr></thead>
      <tbody>{lab_rows}</tbody></table>"""

    def field_table(title, fm, fd):
        if not fm and not fd:
            return ""
        rows = ""
        for m in ("LCP", "INP", "CLS", "FCP", "TTFB"):
            cells = ""
            for f in (fm, fd):
                v = ((f or {}).get("metrics") or {}).get(m)
                if v:
                    cls = _CAT_CLASS.get(v.get("category"), "na")
                    cells += f'<td><span class="dot {cls}"></span>{e(v["display"])} <span class="muted">({_CAT_NL.get(v.get("category"), "?")})</span></td>'
                else:
                    cells += "<td>—</td>"
            rows += f"<tr><th>{m}</th>{cells}</tr>"
        return f"""<h3>{e(title)}</h3><table class="tbl"><thead><tr><th>Metric (p75)</th><th>Mobiel</th><th>Desktop</th></tr></thead>
          <tbody>{rows}</tbody></table>"""

    page_field = field_table("Velddata — echte bezoekers op deze pagina (CrUX)", mob.get("field"), desk.get("field"))
    origin_field = field_table("Velddata — echte bezoekers op het hele domein (CrUX)", mob.get("origin_field"), desk.get("origin_field"))
    if page_field or origin_field:
        out += page_field + origin_field
    else:
        out += ('<p class="note">Geen CrUX-velddata: de site heeft te weinig Chrome-bezoekers om in het '
                'openbare rapport te staan. Alleen labmetingen beschikbaar.</p>')

    opps = mob.get("opportunities") or []
    if opps:
        items = "".join(f'<li><span>{e(o["title"])}</span><span class="muted">{e(o.get("display") or "")}</span></li>'
                        for o in opps)
        out += f'<h3>Grootste snelheidswinst (mobiel)</h3><ul class="opps">{items}</ul>'
    tb = (mob.get("diagnostics") or {}).get("total_bytes")
    if tb:
        out += f'<p class="note">Totaal paginagewicht volgens Lighthouse: {_kb(tb)}.</p>'
    return out


def _technical(r: dict) -> str:
    t = r.get("technical") or {}
    body = checklist(t.get("checks") or [])
    rb = t.get("robots") or {}
    if rb.get("content"):
        body += f'<details><summary>robots.txt</summary><pre>{e(rb["content"][:2000])}</pre></details>'
    w = t.get("weight") or {}
    if w.get("largest"):
        rows = "".join(f'<li><span>{e(x["url"][-90:])}</span><span class="muted">{_kb(x["bytes"])}</span></li>'
                       for x in w["largest"])
        body += f'<details><summary>Zwaarste bestanden (homepage)</summary><ul class="opps">{rows}</ul></details>'
    mc = t.get("mixed_content") or []
    if mc:
        rows = "".join(f'<li><span>{e(m["url"])}</span><span class="muted">{e(m["tag"])} op {e(m["page"][-50:])}</span></li>'
                       for m in mc[:20])
        body += f'<details open><summary>Mixed content</summary><ul class="opps">{rows}</ul></details>'
    return body


def _tracking(r: dict) -> str:
    return checklist((r.get("tracking") or {}).get("checks") or [])


def _onpage(r: dict) -> str:
    pages = r.get("pages") or []
    if not pages:
        return '<p class="empty">Geen pagina\'s geanalyseerd.</p>'
    home = pages[0]
    out = f'<h3>Homepage</h3>{checklist(home["checks"])}'
    out += f'<h3>Site-breed ({len(pages)} pagina\'s)</h3>{checklist((r.get("onpage") or {}).get("checks") or [])}'
    if home.get("headings"):
        out += ('<details><summary>Kopstructuur homepage</summary><pre>'
                + e("\n".join(home["headings"])) + "</pre></details>")
    return out


def _pages(r: dict) -> str:
    pages = r.get("pages") or []
    if not pages:
        return ""
    rows = []
    for p in pages:
        issues = sum(1 for c in p["checks"] if c["status"] in (FAIL, WARN))
        fails = sum(1 for c in p["checks"] if c["status"] == FAIL)
        cls = "red" if fails else "orange" if issues else "green"
        alt = "—" if p["alt_coverage"] is None else f'{p["alt_coverage"]}%'
        rows.append(f"""<tr>
          <td class="path"><a href="{e(p['url'])}">{e(p['path'][:60])}</a><div class="muted small">{e(p['title'][:70])}</div></td>
          <td>{p['title_len']}</td><td>{p['description_len']}</td><td>{p['h1_count']}</td>
          <td>{p['word_count']}</td><td>{alt}</td><td class="small">{e(', '.join(p['schema_types'][:3]) or '—')}</td>
          <td><span class="dot {cls}"></span>{issues}</td></tr>""")
    table = f"""<div class="tbl-wrap"><table class="tbl pages"><thead><tr><th>Pagina</th><th>Title</th><th>Descr.</th>
      <th>H1</th><th>Woorden</th><th>Alt</th><th>Schema</th><th>Punten</th></tr></thead><tbody>{''.join(rows)}</tbody></table></div>"""
    details = "".join(f'<details><summary>{e(p["path"][:80])}</summary>{checklist(p["checks"])}</details>'
                      for p in pages[1:])
    cr = r.get("crawl") or {}
    note = (f'<p class="note">{cr.get("count", 0)} pagina\'s geanalyseerd (limiet {cr.get("limit")}), '
            f'{cr.get("discovered", 0)} interne URL\'s ontdekt.</p>')
    return note + table + details


def _links(r: dict) -> str:
    lk = r.get("links")
    if not lk:
        return '<p class="empty">Niet gecontroleerd.</p>'
    out = f'<p class="note">{lk["checked"]} links op de homepage gecontroleerd'
    out += f' ({lk["skipped"]} overgeslagen).</p>' if lk.get("skipped") else ".</p>"
    if lk["broken"]:
        rows = "".join(f'<li class="chk fail"><span class="ico">✕</span><span class="chk-label">{e(b["url"][:100])}</span>'
                       f'<span class="chk-detail">{e(b["status"] or b["error"])}</span></li>' for b in lk["broken"])
        out += f'<ul class="checklist">{rows}</ul>'
    else:
        out += checklist([{"label": "Geen kapotte links gevonden", "status": PASS, "detail": ""}])
    if lk["unsure"]:
        rows = "".join(f'<li class="chk info"><span class="ico">?</span><span class="chk-label">{e(b["url"][:100])}</span>'
                       f'<span class="chk-detail">{e(b["status"] or b["error"])} — blokkeert bots, even handmatig klikken</span></li>'
                       for b in lk["unsure"])
        out += f'<details><summary>Onzeker ({len(lk["unsure"])})</summary><ul class="checklist">{rows}</ul></details>'
    return out


def _gap(gap: dict | None) -> str:
    if not gap:
        return ""
    rows = []
    for row in gap["rows"]:
        v = row["verdict"]
        cls = {"voor": "green", "achter": "red"}.get(v, "na")
        rows.append(f"""<tr><th>{e(row['label'])}</th><td>{e(row['prospect_display'])}</td>
          <td>{e(row['competitor_display'])}</td><td><span class="dot {cls}"></span>{e(v)}</td></tr>""")
    body = f"""<p class="intro">Prospect staat op <strong>{gap['behind']} van de {gap['compared']}</strong> punten achter op
      <strong>{e(gap['competitor_host'])}</strong>.</p>
      <div class="tbl-wrap"><table class="tbl"><thead><tr><th>Onderdeel</th><th>Prospect</th><th>Concurrent</th><th>Prospect staat</th></tr></thead>
      <tbody>{''.join(rows)}</tbody></table></div>"""
    return section("gap", "Concurrentie-gap", body)


def _manual(r: dict, opts: dict) -> str:
    host = r.get("host") or ""
    dienst, plaats = opts.get("dienst") or "", opts.get("plaats") or ""
    bedrijf = opts.get("bedrijf") or host
    query = f"{dienst} {plaats}".strip() or "[dienst] [plaats]"
    q_url = f"https://www.google.com/search?q={quote_plus(query)}&hl=nl&gl=nl&pws=0"
    maps_url = f"https://www.google.com/maps/search/?api=1&query={quote_plus(bedrijf + (' ' + plaats if plaats else ''))}"
    site_url = f"https://www.google.com/search?q={quote_plus('site:' + host.removeprefix('www.'))}&hl=nl"
    sm = ((r.get("technical") or {}).get("sitemap") or {}).get("url_count")

    def item(title, link, link_label, points):
        lis = "".join(f'<li><span class="box"></span>{p}</li>' for p in points)
        a = f'<a class="btn" href="{e(link)}" target="_blank" rel="noopener">{e(link_label)} ↗</a>' if link else ""
        return f'<div class="manual"><div class="manual-head"><h3>{e(title)}</h3>{a}</div><ul>{lis}</ul></div>'

    blank = '<span class="fill"></span>'
    return "".join([
        item("Google Bedrijfsprofiel & reviews", maps_url, "Open in Maps", [
            f"Profiel bestaat en is geclaimd/geverifieerd {blank}",
            f"Hoofdcategorie klopt met de dienst {blank}",
            f"Aantal reviews {blank} · gemiddelde score {blank}",
            f"Laatste review (datum) {blank} — recent = actief bedrijf",
            f"Reageert de eigenaar op reviews (ook negatieve)? {blank}",
            f"Foto's, openingstijden, werkgebied en websitelink ingevuld {blank}",
            "Naam/adres/telefoon identiek aan de website (NAP)",
        ]),
        item(f"Ranking op “{query}”", q_url, "Zoek in Google", [
            "Incognito zoeken (of via de link: zonder personalisatie), locatie = de plaats zelf",
            f"Positie in het kaartblok (top 3) {blank}",
            f"Positie in de organische resultaten {blank}",
            f"Wie staan er boven de prospect? {blank}",
            "Herhalen voor 2-3 varianten (andere dienst / buurplaats)",
        ]),
        item("Aantal geïndexeerde pagina's", site_url, "site: zoeken", [
            f"Aantal resultaten bij site:{e(host.removeprefix('www.'))} {blank}",
            f"Vergelijk: {r.get('crawl', {}).get('count', 0)} pagina's gecrawld, {sm if sm is not None else '—'} in sitemap",
            "Veel minder geïndexeerd dan in sitemap = indexatieprobleem; veel meer = rommel/duplicaten",
        ]),
        item("Concurrentie-gap", q_url, "Bekijk top 3", [
            f"Top 3 in het kaartblok: reviews en score per concurrent {blank}",
            "Hebben zij aparte pagina's per dienst/plaats? (draai de scan met --competitor)",
            "Wat bieden zij wat de prospect mist (prijzen, offerteformulier, WhatsApp, foto's)?",
        ]),
    ])


# --------------------------------------------------------------------------- pagina

CSS = """
:root{--bg:#020617;--card:#0b1222;--card2:#0f172a;--line:rgba(255,255,255,.08);--text:#e2e8f0;--muted:#94a3b8;
--accent:#38bdf8;--accent2:#0ea5e9;--green:#22c55e;--orange:#f59e0b;--red:#ef4444;--na:#475569}
*{box-sizing:border-box}html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.6 Inter,ui-sans-serif,system-ui,sans-serif}
a{color:var(--accent);text-decoration:none}a:hover{text-decoration:underline}
.wrap{max-width:1040px;margin:0 auto;padding:0 20px 80px}
header.top{border-bottom:1px solid var(--line);background:radial-gradient(1200px 300px at 20% -50%,rgba(14,165,233,.25),transparent)}
header.top .wrap{padding-top:36px;padding-bottom:36px}
.brand{font:700 15px "Space Grotesk",Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--accent)}
.brand span{color:var(--text)}
h1{font:700 clamp(28px,4vw,40px)/1.15 "Space Grotesk",Inter,sans-serif;margin:14px 0 6px;letter-spacing:-.01em}
.sub{color:var(--muted)}.sub a{color:var(--text)}
nav.toc{display:flex;flex-wrap:wrap;gap:8px;margin-top:20px}
nav.toc a{font-size:13px;color:var(--muted);border:1px solid var(--line);border-radius:999px;padding:4px 12px}
nav.toc a:hover{color:var(--text);border-color:var(--accent);text-decoration:none}
section{margin-top:56px}
h2{font:700 24px "Space Grotesk",Inter,sans-serif;margin:0 0 16px;letter-spacing:-.01em}
h2::before{content:"";display:inline-block;width:10px;height:10px;border-radius:2px;background:var(--accent);margin-right:12px;vertical-align:middle}
h3{font:600 16px "Space Grotesk",Inter,sans-serif;margin:24px 0 10px}
.intro{color:var(--muted);margin:-6px 0 18px}.note{color:var(--muted);font-size:13px}.note.warn{color:var(--orange)}
.muted{color:var(--muted)}.small{font-size:12px}.empty{color:var(--muted);font-style:italic}
.rings{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
@media (min-width:960px){.rings{grid-template-columns:repeat(8,1fr)}}
@media (max-width:420px){.rings{grid-template-columns:repeat(2,1fr)}}
.ring{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 8px 14px;text-align:center;position:relative}
.ring svg{width:80px;height:80px;display:block;margin:0 auto}
.ring .track{fill:none;stroke:rgba(255,255,255,.07);stroke-width:7}
.ring .bar{fill:none;stroke-width:7;stroke-linecap:round}
.ring.green .bar{stroke:var(--green)}.ring.orange .bar{stroke:var(--orange)}.ring.red .bar{stroke:var(--red)}
.ring-val{position:absolute;top:16px;left:0;right:0;height:80px;font:700 24px/80px "Space Grotesk",Inter,sans-serif}
.ring.green .ring-val{color:var(--green)}.ring.orange .ring-val{color:var(--orange)}.ring.red .ring-val{color:var(--red)}.ring.na .ring-val{color:var(--na)}
.ring-label{font-weight:600;font-size:13px;margin-top:6px}.ring-sub{font-size:11px;color:var(--muted)}
.fcount{display:flex;gap:8px;margin-bottom:14px}
.pill{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;border-radius:999px;padding:2px 10px}
.pill.hoog{background:rgba(239,68,68,.15);color:#fca5a5}.pill.middel{background:rgba(245,158,11,.15);color:#fcd34d}
.pill.laag{background:rgba(34,197,94,.13);color:#86efac}
.finding{display:flex;gap:16px;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--na);border-radius:12px;padding:18px 20px;margin-bottom:10px;break-inside:avoid}
.finding.hoog{border-left-color:var(--red)}.finding.middel{border-left-color:var(--orange)}.finding.laag{border-left-color:var(--green)}
.f-num{font:700 20px "Space Grotesk",Inter,sans-serif;color:var(--muted);min-width:26px}
.f-body{flex:1;min-width:0}.f-meta{display:flex;gap:10px;align-items:center}.cat{font-size:12px;color:var(--muted)}
.finding h3{margin:6px 0 6px;font-size:17px}.why{margin:0 0 8px}.fix{margin:0;color:#cbd5e1}.fix strong{color:var(--accent)}
.detail{margin:8px 0 0;font-size:13px;color:var(--muted);font-family:ui-monospace,Consolas,monospace;word-break:break-word}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:6px 20px 18px}
.checklist{list-style:none;padding:0;margin:0}
.chk{display:grid;grid-template-columns:26px minmax(160px,240px) 1fr;gap:10px;align-items:baseline;padding:9px 0;border-bottom:1px solid var(--line)}
.chk:last-child{border-bottom:0}
.ico{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:50%;font-size:11px;font-weight:700}
.chk.pass .ico{background:rgba(34,197,94,.15);color:var(--green)}.chk.warn .ico{background:rgba(245,158,11,.15);color:var(--orange)}
.chk.fail .ico{background:rgba(239,68,68,.15);color:var(--red)}.chk.info .ico{background:rgba(148,163,184,.12);color:var(--muted)}
.chk-label{font-weight:600}.chk-detail{color:var(--muted);font-size:13px;word-break:break-word}
.tbl-wrap{overflow-x:auto}
.tbl{width:100%;border-collapse:collapse;font-size:14px;background:var(--card);border:1px solid var(--line);border-radius:12px;overflow:hidden}
.tbl th,.tbl td{text-align:left;padding:9px 12px;border-bottom:1px solid var(--line);vertical-align:top}
.tbl thead th{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);background:var(--card2)}
.tbl tbody th{font-weight:600}.tbl.pages td.path{max-width:320px;word-break:break-all}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:8px;background:var(--na)}
.dot.green{background:var(--green)}.dot.orange{background:var(--orange)}.dot.red{background:var(--red)}
.opps{list-style:none;padding:0;margin:0}.opps li{display:flex;justify-content:space-between;gap:16px;padding:8px 0;border-bottom:1px solid var(--line);font-size:14px;word-break:break-all}
details{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 16px;margin-top:10px}
summary{cursor:pointer;font-weight:600;color:var(--text)}details[open] summary{margin-bottom:8px}
pre{white-space:pre-wrap;font-size:12px;color:var(--muted);margin:0}
.manual{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:16px 20px;margin-bottom:12px;break-inside:avoid}
.manual-head{display:flex;justify-content:space-between;align-items:center;gap:12px}.manual h3{margin:0}
.manual ul{list-style:none;padding:0;margin:10px 0 0}.manual li{display:flex;gap:10px;align-items:baseline;padding:5px 0;color:#cbd5e1}
.box{flex:none;width:14px;height:14px;border:1.5px solid var(--muted);border-radius:3px;transform:translateY(2px)}
.fill{display:inline-block;min-width:90px;border-bottom:1px dashed var(--muted);margin-left:4px}
.btn{font-size:13px;font-weight:600;color:var(--bg);background:var(--accent);border-radius:8px;padding:6px 12px;white-space:nowrap}
.btn:hover{background:var(--accent2);text-decoration:none}
footer{margin-top:72px;padding-top:20px;border-top:1px solid var(--line);color:var(--muted);font-size:13px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:8px}
@media (max-width:640px){.chk{grid-template-columns:26px 1fr}.chk-detail{grid-column:2}.finding{padding:14px}.f-num{display:none}}
@media print{nav.toc,.btn{display:none}section{margin-top:32px}details{display:block}}
"""


def render(r: dict, opts: dict | None = None, gap: dict | None = None) -> str:
    opts = opts or {}
    host = r.get("host") or r.get("input_url")
    when = dt.datetime.fromisoformat(r["scanned_at"]).strftime("%d-%m-%Y %H:%M")
    bedrijf = opts.get("bedrijf")
    title_line = f"{bedrijf} — {host}" if bedrijf else host

    toc = [("verbeterpunten", "Verbeterpunten"), ("snelheid", "Snelheid & Core Web Vitals"),
           ("onpage", "On-page SEO"), ("techniek", "Techniek"), ("meten", "Meten & tools"),
           ("paginas", "Pagina's"), ("links", "Links")]
    if gap:
        toc.append(("gap", "Concurrentie"))
    toc.append(("handmatig", "Handmatig checken"))
    toc_html = "".join(f'<a href="#{i}">{e(t)}</a>' for i, t in toc)

    if not r.get("reachable"):
        unreachable = '<p class="note warn">De homepage kon niet worden geladen; alleen beperkte checks zijn uitgevoerd.</p>'
    else:
        unreachable = ""

    body = "".join([
        section("scores", "Scores", _scores(r) + unreachable,
                "Groen ≥ 90 · oranje 50–89 · rood &lt; 50. PageSpeed-scores zijn mobiel tenzij anders vermeld."),
        section("verbeterpunten", "Verbeterpunten op volgorde van impact", _findings(r.get("findings") or []),
                "Bovenaan staat wat de meeste klanten of zichtbaarheid kost. Per punt: waarom het telt en wat de oplossing is."),
        section("snelheid", "Snelheid & Core Web Vitals", _vitals(r)),
        section("onpage", "On-page SEO", f'<div class="card">{_onpage(r)}</div>'),
        section("techniek", "Techniek", f'<div class="card">{_technical(r)}</div>'),
        section("meten", "Meten & tools", f'<div class="card">{_tracking(r)}</div>',
                "Tools die via Google Tag Manager laden zijn niet altijd zichtbaar in de broncode."),
        section("paginas", "Pagina's", _pages(r)),
        section("links", "Links op de homepage", f'<div class="card">{_links(r)}</div>'),
        _gap(gap),
        section("handmatig", "Nog handmatig checken", _manual(r, opts),
                "Dit kan (of mag) niet automatisch: Google-resultaten en het Bedrijfsprofiel bekijk je zelf."),
    ])

    return f"""<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow">
<title>Website-audit {e(host)} · {BRAND}</title>
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=Space+Grotesk:wght@600;700&display=swap" rel="stylesheet">
<style>{CSS}</style></head>
<body>
<header class="top"><div class="wrap">
  <div class="brand">Stam <span>Core</span> · Website-audit</div>
  <h1>{e(title_line)}</h1>
  <div class="sub">Gescand op {e(when)} · <a href="{e(r.get('final_url') or r.get('input_url'))}">{e(r.get('final_url') or r.get('input_url'))}</a></div>
  <nav class="toc">{toc_html}</nav>
</div></header>
<main class="wrap">{body}
<footer><span>Opgesteld door {BRAND} · <a href="{BRAND_URL}">{BRAND_URL.removeprefix('https://')}</a> · {e(BRAND_CONTACT)}</span>
<span>stamcore_scan v{__version__}</span></footer>
</main></body></html>"""
