// Netlify roept deze functie AUTOMATISCH aan bij elke geverifieerde
// formulier-inzending (de functienaam 'submission-created' is een Netlify-trigger).
// Hij stuurt de inzending server-side door naar de Stam Core lead-ingest, zodat
// elke contactaanvraag een lead in de cockpit wordt — mét herkomst (referral).
// Het token staat in een Netlify-omgevingsvariabele, niet in de (publieke) repo.
exports.handler = async (event) => {
  try {
    const token = process.env.STAMCORE_INGEST_TOKEN || "";
    if (!token) return { statusCode: 503, body: "token niet ingesteld" };
    const res = await fetch(
      "https://fgpfpdnmktktjmrunlrb.functions.supabase.co/lead-ingest?token=" + encodeURIComponent(token),
      { method: "POST", headers: { "Content-Type": "application/json" }, body: event.body || "{}" }
    );
    return { statusCode: res.ok ? 200 : 502, body: res.ok ? "ok" : "ingest-fout " + res.status };
  } catch (e) {
    return { statusCode: 500, body: "fout: " + (e && e.message) };
  }
};
