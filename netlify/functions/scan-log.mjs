// Website-Scan stap 3: de PageSpeed-scores bij de gelogde scan zetten (Netlify Blobs).
// Werkt alleen met de token uit stap 1; elke scan kan maar één keer scores krijgen.
import { json, fail, readJson, verifyToken } from '../lib/website-scan.mjs';
import { addScores } from '../lib/scan-store.mjs';

const score = (v) => (Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null);

export default async (req) => {
  if (req.method !== 'POST') return fail(405, 'Alleen POST.');
  let input;
  try { input = await readJson(req); } catch { return fail(400, 'Ongeldig verzoek.'); }
  let token;
  try { token = verifyToken(input.token); } catch { return fail(500, 'De scan is nog niet goed ingesteld.'); }
  if (!token || !token.log) return fail(401, 'Deze scan is verlopen.');

  const m = input.mobile || {};
  const d = input.desktop || {};
  await addScores(token.log, {
    mobiel: score(m.performance),
    desktop: score(d.performance),
    seo: score(m.seo ?? d.seo),
    toegankelijkheid: score(m.accessibility ?? d.accessibility),
    bestPractices: score(m.bestPractices ?? d.bestPractices),
  });
  return json(200, { ok: true });
};

export const config = {
  path: '/api/scan/log',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
