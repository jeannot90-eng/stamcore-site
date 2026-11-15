// Netlify roept deze functie AUTOMATISCH aan bij elke geverifieerde
// formulier-inzending (de functienaam 'submission-created' is een Netlify-trigger).
// Hij stuurt de inzending server-side door naar Stam Leads (organisatie Stam Core → Aanvragen),
// mét herkomst. Tijdens de overstap gaat er ook nog een kopie naar de oude verkoop-app.
// Het gedeelde geheim staat in de Netlify-omgevingsvariabele AANVRAAG_TOKEN, niet in de repo.
const DOELEN = [
  "https://leadhuis-backoffice.netlify.app/api/aanvraag", // Stam Leads (hoofdbestemming)
  "https://stamcore-verkoop.netlify.app/api/aanvraag", // oude verkoop-app (tijdelijk)
];

exports.handler = async (event) => {
  const token = process.env.AANVRAAG_TOKEN || "";
  if (!token) return { statusCode: 503, body: "token niet ingesteld" };
  const uitkomsten = await Promise.allSettled(
    DOELEN.map((url) =>
      fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-aanvraag-token": token },
        body: event.body || "{}",
      }),
    ),
  );
  const status = uitkomsten.map((u) => (u.status === "fulfilled" ? u.value.status : "fout"));
  if (status[1] !== 200) console.warn("oude verkoop-app: " + status[1]);
  return status[0] === 200 ? { statusCode: 200, body: "ok" } : { statusCode: 502, body: "aanvraag-fout " + status[0] };
};
