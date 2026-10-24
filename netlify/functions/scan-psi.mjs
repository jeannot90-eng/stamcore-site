// Website-Scan stap 2: PageSpeed Insights voor één strategie (mobile of desktop).
// Twee losse aanroepen (parallel vanuit de pagina) houden elke functie binnen de timeout.
import { json, fail, verifyToken, rateLimited, runPageSpeed } from '../lib/website-scan.mjs';

export default async (req, context) => {
  if (req.method !== 'GET') return fail(405, 'Alleen GET.');
  const params = new URL(req.url).searchParams;
  const strategy = params.get('strategy');
  if (!['mobile', 'desktop'].includes(strategy)) return fail(400, 'Onbekende strategie.');

  let token;
  try { token = verifyToken(req.headers.get('x-scan-token')); } catch (e) {
    console.error('[scan-psi]', e.message);
    return fail(500, 'De scan is nog niet goed ingesteld.');
  }
  if (!token) return fail(401, 'Deze scan is verlopen. Start een nieuwe scan.');

  const ip = context.ip || 'onbekend';
  if (rateLimited(`psi:${ip}`, 12, 10 * 60_000)) return fail(429, 'Even te veel metingen tegelijk. Probeer het zo opnieuw.');

  const result = await runPageSpeed(token.url, strategy);
  return json(200, result);
};

export const config = {
  path: '/api/scan/psi',
  rateLimit: { windowLimit: 20, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
