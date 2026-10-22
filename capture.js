/* ===========================================================================
   Stam Core — herkomst-opvanger (referral + UTM) voor stam-core.nl
   - Registreert WAAR een bezoeker vandaan komt (?ref= / ?utm_) in Supabase.
   - Onthoudt de herkomst (FIRST-TOUCH, 30 dagen) in de browser, zodat 'ie ook
     beschikbaar is als de bezoeker doorklikt of later terugkomt.
   - Zet de herkomst in het contactformulier, zodat een lead aan de juiste
     referrer wordt gekoppeld.
   AVG: GEEN persoonsgegevens — alleen herkomst (bron/campagne/pagina). Geen
   cookies van derden; alleen localStorage in de eigen browser.
=========================================================================== */
(function () {
  var SUPABASE_URL = "https://fgpfpdnmktktjmrunlrb.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_RPg4tH4g3T08T2l59oPRsg_zCUC0koz";
  var KEY = "sc_herkomst";            // onthouden herkomst (first-touch)
  var ONCE = "sc_herkomst_logged";    // voorkomt dubbel loggen per sessie
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

  // ── 2) Nieuwe herkomst in de URL? First-touch vastleggen + 1x per sessie loggen
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
    // Bezoek 1x per sessie loggen naar referral_hits.
    var alGelogd = (function () { try { return sessionStorage.getItem(ONCE); } catch (e) { return true; } })();
    if (!alGelogd) {
      fetch(SUPABASE_URL + "/rest/v1/referral_hits", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": "Bearer " + SUPABASE_ANON_KEY,
          "Prefer": "return=minimal"
        },
        body: JSON.stringify(hit)
      }).then(function () {
        try { sessionStorage.setItem(ONCE, "1"); } catch (e) {}
      }).catch(function (err) {
        if (window.console) console.warn("[stamcore] herkomst niet gelogd:", err && err.message);
      });
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
