// Website-Scan stap 3: scores bij de lead in Brevo zetten en (optioneel) Jeannot een
// notificatie sturen. Wordt door de pagina aangeroepen zodra het rapport compleet is.
import {
  json, fail, readJson, verifyToken, rateLimited, upsertBrevoContact, notifyLead, escapeHtml,
} from '../lib/website-scan.mjs';

const seen = new Set(); // voorkomt dubbele notificaties per token (per warme instantie)
const score = (v) => (Number.isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null);

export default async (req, context) => {
  if (req.method !== 'POST') return fail(405, 'Alleen POST.');
  let input;
  try { input = await readJson(req, 20_000); } catch { return fail(400, 'Ongeldig verzoek.'); }

  let token;
  try { token = verifyToken(input.token); } catch (e) {
    console.error('[scan-complete]', e.message);
    return fail(500, 'De scan is nog niet goed ingesteld.');
  }
  if (!token) return fail(401, 'Deze scan is verlopen.');
  if (rateLimited(`complete:${context.ip || 'onbekend'}`, 10, 10 * 60_000)) return fail(429, 'Te veel verzoeken.');

  const m = input.mobile?.scores || {};
  const d = input.desktop?.scores || {};
  const s = {
    mobiel: score(m.performance),
    desktop: score(d.performance),
    seo: score(m.seo ?? d.seo),
    toegankelijkheid: score(m.accessibility ?? d.accessibility),
    bestPractices: score(m.bestPractices ?? d.bestPractices),
  };
  const findings = (Array.isArray(input.findings) ? input.findings : []).slice(0, 5).map((f) => String(f).slice(0, 160));

  await upsertBrevoContact(token.email, {
    WEBSITE: token.url,
    SCORE_MOBIEL: s.mobiel,
    SCORE_DESKTOP: s.desktop,
    SCORE_SEO: s.seo,
  });

  const key = `${token.email}|${token.url}|${token.exp}`;
  if (!seen.has(key)) {
    seen.add(key);
    const row = (label, v) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${label}</td><td style="padding:4px 0"><b>${v ?? '–'}</b></td></tr>`;
    await notifyLead(
      `Nieuwe website-scan: ${new URL(token.url).hostname}`,
      `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111">
        <p>Er is een nieuwe scan gedaan via <a href="https://stam-core.nl/website-scan">stam-core.nl/website-scan</a>.</p>
        <table>
          ${row('E-mail', `<a href="mailto:${escapeHtml(token.email)}">${escapeHtml(token.email)}</a>`)}
          ${row('Website', `<a href="${escapeHtml(token.url)}">${escapeHtml(token.url)}</a>`)}
          ${row('PageSpeed mobiel', s.mobiel)}
          ${row('PageSpeed desktop', s.desktop)}
          ${row('SEO', s.seo)}
          ${row('Toegankelijkheid', s.toegankelijkheid)}
          ${row('Best practices', s.bestPractices)}
        </table>
        ${findings.length ? `<p style="margin-top:16px"><b>Belangrijkste verbeterpunten</b></p><ol>${findings.map((f) => `<li>${escapeHtml(f)}</li>`).join('')}</ol>` : ''}
        <p style="color:#777;font-size:12px">Antwoorden op deze mail gaan rechtstreeks naar de prospect.</p>
      </div>`,
      token.email,
    );
  }
  return json(200, { ok: true });
};

export const config = {
  path: '/api/scan/complete',
  rateLimit: { windowLimit: 10, windowSize: 60, aggregateBy: ['ip', 'domain'] },
};
