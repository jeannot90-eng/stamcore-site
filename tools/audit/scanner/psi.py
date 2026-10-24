"""Google PageSpeed Insights API v5: Lighthouse-scores (lab) + CrUX-velddata (echte bezoekers).

Zonder API-key werkt de API ook, maar met een zeer lage quota (snel 429). Key aanmaken:
https://developers.google.com/speed/docs/insights/v5/get-started
"""

import time

import requests

ENDPOINT = "https://www.googleapis.com/pagespeedonline/v5/runPagespeed"
CATEGORIES = ("performance", "seo", "accessibility", "best-practices")

# Lab-metrics uit Lighthouse: audit-id -> label
LAB_METRICS = {
    "largest-contentful-paint": "LCP",
    "cumulative-layout-shift": "CLS",
    "first-contentful-paint": "FCP",
    "total-blocking-time": "TBT",
    "speed-index": "Speed Index",
}

# Velddata (CrUX): metric-key -> (label, eenheid, deler)
FIELD_METRICS = {
    "LARGEST_CONTENTFUL_PAINT_MS": ("LCP", "ms", 1),
    "INTERACTION_TO_NEXT_PAINT": ("INP", "ms", 1),
    "CUMULATIVE_LAYOUT_SHIFT_SCORE": ("CLS", "", 100),  # CrUX levert CLS × 100
    "FIRST_CONTENTFUL_PAINT_MS": ("FCP", "ms", 1),
    "EXPERIMENTAL_TIME_TO_FIRST_BYTE": ("TTFB", "ms", 1),
}


def _fmt(label: str, val: float) -> str:
    """Weergave met Nederlandse decimale komma: '4,1 s', '180 ms', '0,12'."""
    if label == "CLS":
        text = f"{val:.2f}"
    elif val >= 1000:
        text = f"{val / 1000:.1f} s"
    else:
        text = f"{val:.0f} ms"
    return text.replace(".", ",")


def _field(block: dict | None) -> dict | None:
    if not block or not block.get("metrics"):
        return None
    metrics = {}
    for key, (label, unit, div) in FIELD_METRICS.items():
        m = block["metrics"].get(key)
        if not m or m.get("percentile") is None:
            continue
        val = m["percentile"] / div
        metrics[label] = {"p75": val, "unit": unit, "category": m.get("category"),
                          "display": _fmt(label, val)}
    return {"overall": block.get("overall_category"), "metrics": metrics,
            "origin_fallback": bool(block.get("origin_fallback")), "id": block.get("id")}


def run(url: str, strategy: str, key: str | None, timeout: float = 120) -> dict:
    """Eén PSI-run. Geeft altijd een dict terug; bij problemen staat de reden in 'error'."""
    params = [("url", url), ("strategy", strategy), ("locale", "nl")]
    params += [("category", c) for c in CATEGORIES]
    if key:
        params.append(("key", key))
    out = {"strategy": strategy, "error": None, "scores": {}, "lab": {}, "field": None,
           "origin_field": None, "opportunities": [], "diagnostics": {}}
    data = None
    for attempt in range(2):  # PSI geeft soms een incidentele 500; één herkansing
        try:
            r = requests.get(ENDPOINT, params=params, timeout=timeout)
        except requests.exceptions.RequestException as exc:
            out["error"] = f"PSI niet bereikbaar: {exc.__class__.__name__}"
            continue
        if r.status_code == 200:
            try:
                data = r.json()
                out["error"] = None
            except ValueError:
                out["error"] = "PSI gaf geen geldige JSON"
            break
        try:
            msg = r.json().get("error", {}).get("message", "")
        except ValueError:
            msg = r.text[:200]
        out["error"] = f"PSI {r.status_code}: {msg[:200]}"
        if r.status_code in (400, 403, 429):  # foute URL / key / quota: opnieuw proberen heeft geen zin
            break
        time.sleep(3 * (attempt + 1))
    if data is None:
        return out

    lh = data.get("lighthouseResult", {}) or {}
    for cid, cat in (lh.get("categories") or {}).items():
        if cat.get("score") is not None:
            out["scores"][cid] = round(cat["score"] * 100)
    audits = lh.get("audits", {}) or {}
    for aid, label in LAB_METRICS.items():
        a = audits.get(aid) or {}
        if a.get("numericValue") is not None:
            out["lab"][label] = {"value": a["numericValue"], "display": a.get("displayValue", ""),
                                 "score": a.get("score")}

    # Verbeterkansen (Lighthouse 'opportunities' + insights), gesorteerd op tijdwinst
    opps = []
    for aid, a in audits.items():
        details = a.get("details") or {}
        score = a.get("score")
        if score is None or score >= 0.9:
            continue
        savings = details.get("overallSavingsMs") or (a.get("metricSavings") or {}).get("LCP") or 0
        if details.get("type") == "opportunity" or savings:
            opps.append({"id": aid, "title": a.get("title", aid), "display": a.get("displayValue", ""),
                         "savings_ms": savings or 0, "score": score})
    opps.sort(key=lambda o: o["savings_ms"], reverse=True)
    out["opportunities"] = opps[:8]

    tbw = audits.get("total-byte-weight") or {}
    out["diagnostics"] = {
        "total_bytes": tbw.get("numericValue"),
        "final_url": lh.get("finalDisplayedUrl") or lh.get("finalUrl"),
        "lighthouse_version": lh.get("lighthouseVersion"),
        "run_warnings": lh.get("runWarnings", [])[:3],
    }
    out["field"] = _field(data.get("loadingExperience"))
    out["origin_field"] = _field(data.get("originLoadingExperience"))
    # Is de 'pagina'-velddata eigenlijk origin-data? Dan alleen origin tonen.
    if out["field"] and out["field"]["origin_fallback"]:
        out["field"] = None
    return out


def run_both(url: str, key: str | None, timeout: float = 120) -> dict:
    """Mobiel + desktop (sequentieel; parallellisatie gebeurt op een hoger niveau)."""
    return {"mobile": run(url, "mobile", key, timeout), "desktop": run(url, "desktop", key, timeout)}
