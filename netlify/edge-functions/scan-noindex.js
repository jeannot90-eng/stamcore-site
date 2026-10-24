// Gedeelde scanlinks (/website-scan?url=…) niet laten indexeren: de pagina is statisch, dus
// de noindex gaat als HTTP-header mee (Google behandelt X-Robots-Tag net als de meta-tag).
// De canonical in de HTML wijst altijd naar /website-scan.
export default async (req, context) => {
  const res = await context.next();
  if (new URL(req.url).searchParams.has('url')) res.headers.set('X-Robots-Tag', 'noindex');
  return res;
};

export const config = { path: ['/website-scan', '/website-scan.html'] };
