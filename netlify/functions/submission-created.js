// Netlify roept deze functie AUTOMATISCH aan bij elke geverifieerde
// formulier-inzending (de functienaam 'submission-created' is een Netlify-trigger).
// Hij stuurt de inzending server-side door naar de Stam Core verkoop-app
// (stamcore-verkoop.netlify.app), waar hij onder "Aanvragen" verschijnt — mét herkomst.
// Het gedeelde geheim staat in de Netlify-omgevingsvariabele AANVRAAG_TOKEN, niet in de repo.
exports.handler = async (event) => {
  try {
    const token = process.env.AANVRAAG_TOKEN || "";
    if (!token) return { statusCode: 503, body: "token niet ingesteld" };
    const res = await fetch("https://stamcore-verkoop.netlify.app/api/aanvraag", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-aanvraag-token": token },
      body: event.body || "{}",
    });
    return { statusCode: res.ok ? 200 : 502, body: res.ok ? "ok" : "aanvraag-fout " + res.status };
  } catch (e) {
    return { statusCode: 500, body: "fout: " + (e && e.message) };
  }
};
