/* ===========================================================================
   Stam Core — herkomst-opvanger (referral + UTM) voor stam-core.nl
   - Onthoudt de herkomst (FIRST-TOUCH, 30 dagen) in de browser, zodat 'ie ook
     beschikbaar is als de bezoeker doorklikt of later terugkomt.
   - Zet de herkomst in het contactformulier, zodat een lead aan de juiste
     referrer wordt gekoppeld.
   AVG: GEEN persoonsgegevens — alleen herkomst (bron/campagne/pagina). Geen
   cookies van derden; alleen localStorage in de eigen browser.
=========================================================================== */
(function () {
  var KEY = "sc_herkomst";            // onthouden herkomst (first-touch)
  var VENSTER_MS = 30 * 24 * 60 * 60 * 1000;   // 30 dagen geldig

  function param(name) {
    try { return new URLSearchParams(location.search).get(name) || ""; }
    catch (e) { return ""; }
  }

  // ── 1) De onthouden, nog-geldige herkomst (op ELKE pagina beschikbaar) ──────
  function bewaardeHerkomst() {
    try {
      var h = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!h || !h.tijdstip) return null;
      if (Date.now() - new Date(h.tijdstip).getTime() > VENSTER_MS) return null; // verlopen (>30d)
      return h;
    } catch (e) { return null; }
  }
  function bronTekst(h) {
    if (!h) return "";
    if (h.ref_code) return "referral · " + h.ref_code;
    if (h.utm_source) return h.utm_source + (h.utm_campaign ? " · " + h.utm_campaign : "");
    return "";
  }
  // Voor het contactformulier: leesbare bron-tekst (of "").
  window.stamcoreHerkomst = function () { return bronTekst(bewaardeHerkomst()); };

  // ── 2) Nieuwe herkomst in de URL? First-touch vastleggen (alleen in deze browser)
  var hit = {
    ref_code: param("ref"),
    utm_source: param("utm_source"),
    utm_medium: param("utm_medium"),
    utm_campaign: param("utm_campaign"),
    landingspagina: location.pathname,
    verwijzer: document.referrer || "",
    tijdstip: new Date().toISOString()
  };
  var heeftHerkomst = hit.ref_code || hit.utm_source || hit.utm_campaign;
  if (heeftHerkomst) {
    // FIRST-TOUCH: alleen vastleggen als er nog geen geldige (niet-verlopen) herkomst is.
    if (!bewaardeHerkomst()) {
      try { localStorage.setItem(KEY, JSON.stringify(hit)); } catch (e) {}
    }
  }

  // ── 3) Herkomst in (verborgen) formuliervelden zetten ───────────────────────
  // Zo wordt een contactformulier-lead aan de juiste referrer gekoppeld.
  function vulFormulieren() {
    var bron = window.stamcoreHerkomst();
    var velden = document.querySelectorAll('input[name="herkomst"]');
    for (var i = 0; i < velden.length; i++) velden[i].value = bron;
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", vulFormulieren);
  else vulFormulieren();
  document.addEventListener("submit", vulFormulieren, true); // ook vlak vóór verzenden
})();
