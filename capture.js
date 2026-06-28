/* ===========================================================================
   Stam Core — herkomst-opvanger (referral + UTM) voor stam-core.nl
   Registreert WAAR een bezoeker vandaan komt (welke ?ref= / ?utm_-link),
   welke pagina 'ie als eerste zag en de verwijzer. Schrijft naar Supabase
   (referral_hits) en onthoudt de herkomst lokaal voor het contactformulier.
   AVG: GEEN persoonsgegevens — alleen herkomst (bron/campagne/pagina). Geen
   cookies van derden; alleen localStorage in de eigen browser.
=========================================================================== */
(function () {
  var SUPABASE_URL = "https://fgpfpdnmktktjmrunlrb.supabase.co";
  var SUPABASE_ANON_KEY = "sb_publishable_RPg4tH4g3T08T2l59oPRsg_zCUC0koz";
  var KEY = "sc_herkomst";          // eerste herkomst (voor het formulier)
  var ONCE = "sc_herkomst_logged";  // voorkomt dubbel loggen per sessie

  function param(name) {
    try { return new URLSearchParams(location.search).get(name) || ""; }
    catch (e) { return ""; }
  }

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
  if (!heeftHerkomst) return;   // gewoon direct/organisch bezoek: niets te registreren

  // Bewaar de EERSTE herkomst voor een eventueel contactformulier (niet overschrijven).
  try { if (!localStorage.getItem(KEY)) localStorage.setItem(KEY, JSON.stringify(hit)); } catch (e) {}

  // Leesbare bron-tekst die een formulier kan meesturen naar het CRM.
  window.stamcoreHerkomst = function () {
    try {
      var h = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!h) return "";
      if (h.ref_code) return "referral · " + h.ref_code;
      if (h.utm_source) return h.utm_source + (h.utm_campaign ? " · " + h.utm_campaign : "");
      return "";
    } catch (e) { return ""; }
  };

  // Eén keer per sessie naar Supabase wegschrijven (referral_hits).
  var alGelogd = (function () { try { return sessionStorage.getItem(ONCE); } catch (e) { return true; } })();
  if (alGelogd) return;

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
})();
