"""Gedeelde datatypes: checklist-items en verbeterpunten.

Alles wordt uiteindelijk als gewone dict/list opgeslagen (zodat --json triviaal is);
deze helpers houden de vorm consistent.
"""

from dataclasses import dataclass, asdict

# Status van een checklist-item. 'info' telt niet mee in de sectiescore.
PASS, WARN, FAIL, INFO = "pass", "warn", "fail", "info"


def check(label: str, status: str, detail: str = "") -> dict:
    """Eén regel in een checklist."""
    return {"label": label, "status": status, "detail": detail}


def section_score(checks: list) -> int | None:
    """Score 0-100 voor een checklist: pass = 1, warn = 0.5, fail = 0; info telt niet mee."""
    points = {PASS: 1.0, WARN: 0.5, FAIL: 0.0}
    scored = [points[c["status"]] for c in checks if c["status"] in points]
    if not scored:
        return None
    return round(100 * sum(scored) / len(scored))


@dataclass
class Finding:
    """Eén verbeterpunt voor bovenaan het rapport.

    impact: 1-10. Grofweg: 9-10 = kost nu direct klanten/zichtbaarheid,
    6-8 = duidelijke achterstand, 3-5 = verbeterpunt, 1-2 = nice to have.
    """

    key: str        # stabiele id, handig voor hergebruik van de JSON
    title: str      # korte kop
    impact: int
    category: str   # 'Snelheid', 'SEO', 'Techniek', 'Meten', 'Conversie', 'Concurrentie'
    why: str        # waarom dit de prospect klanten/zichtbaarheid kost (prospect-taal)
    fix: str        # wat we eraan doen
    detail: str = ""  # concrete meetwaarden

    @property
    def level(self) -> str:
        if self.impact >= 7:
            return "hoog"
        if self.impact >= 4:
            return "middel"
        return "laag"

    def to_dict(self) -> dict:
        d = asdict(self)
        d["level"] = self.level
        return d
