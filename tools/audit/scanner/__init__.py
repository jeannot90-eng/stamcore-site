"""Stam Core website-audit: modules voor scannen, beoordelen en rapporteren.

Overzicht (in volgorde van de pijplijn):
    http        - defensieve HTTP-client (timeouts, groottelimiet, nooit exceptions naar buiten)
    urls        - URL-normalisatie en intern/extern bepalen
    crawl       - interne pagina's verzamelen vanaf de homepage
    onpage      - on-page SEO per pagina + site-brede samenvatting
    technical   - HTTPS, robots.txt, sitemap, mixed content, gewicht, 404, server
    tracking    - GA4, GTM, Meta pixel, Search Console, cookiebanner, CMS
    links       - kapotte links op de homepage
    psi         - Google PageSpeed Insights (lab + CrUX-velddata)
    audit       - orkestreert alles hierboven tot één resultaat-dict
    findings    - regels die het resultaat omzetten in geprioriteerde verbeterpunten
    gap         - vergelijking prospect vs. concurrent
    report      - HTML-rapport
"""

__version__ = "2.0.0"
