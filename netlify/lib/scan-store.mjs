/* ===========================================================================
   Logboek en rate-limit van de Website-Scan in Netlify Blobs (ingebouwde opslag).
   Bekijken: Netlify → project → Blobs → store "website-scans".

   Per scan: tijdstip, gescande URL, bron (van welke pagina) en de scores. Geen IP-adres.
   Bewaartermijn: 12 maanden (oudere maanden worden af en toe automatisch opgeruimd).
   Rate-limit: max. 10 scans per IP per uur; het IP wordt alleen gehasht gebruikt en niet bewaard.
   Gaat Blobs mis, dan draait de scan gewoon door (dan geldt alleen de in-memory limiet).
=========================================================================== */
import crypto from 'node:crypto';
import { getStore } from '@netlify/blobs';

const LOG_STORE = 'website-scans';
const LIMIT_STORE = 'website-scan-limiet';
export const MAX_PER_HOUR = 10;

const store = (name) => getStore({ name, consistency: 'strong' });
const month = (d) => d.toISOString().slice(0, 7); // 2026-10

/** Telt deze scan mee en geeft true als het IP de limiet overschrijdt. */
export async function overHourlyLimit(ip) {
  const salt = process.env.SCAN_TOKEN_SECRET || 'stamcore';
  const hash = crypto.createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 24);
  const hour = new Date().toISOString().slice(0, 13); // 2026-10-24T16
  const key = `${hour}/${hash}`;
  try {
    const s = store(LIMIT_STORE);
    const n = Number((await s.get(key)) || 0) + 1;
    await s.set(key, String(n));
    if (Math.random() < 0.02) cleanupLimits(s, hour).catch(() => {});
    return n > MAX_PER_HOUR;
  } catch (e) {
    console.warn('[scan-store] rate-limit niet beschikbaar:', e.message);
    return false;
  }
}

async function cleanupLimits(s, currentHour) {
  const { blobs } = await s.list();
  await Promise.all(blobs.filter((b) => b.key.slice(0, 13) < currentHour).map((b) => s.delete(b.key)));
}

/** Legt een nieuwe scan vast; geeft de sleutel terug (of null als het niet lukte). */
export async function logScan({ url, bron, onpage, fetchError }) {
  const now = new Date();
  const key = `${month(now)}/${now.toISOString()}-${crypto.randomBytes(3).toString('hex')}`;
  try {
    const s = store(LOG_STORE);
    await s.setJSON(key, {
      tijd: now.toISOString(),
      url,
      bron: bron || 'direct',
      homepage: fetchError ? { fout: fetchError } : onpage ? {
        title: onpage.titleLength, description: onpage.descriptionLength, h1: onpage.h1Count,
        https: onpage.https, viewport: onpage.viewport, schema: onpage.hasLocalSchema,
      } : null,
      scores: null,
    });
    if (Math.random() < 0.02) cleanupOldMonths(s, now).catch(() => {});
    return key;
  } catch (e) {
    console.warn('[scan-store] loggen mislukt:', e.message);
    return null;
  }
}

/** Voegt de PageSpeed-scores toe aan een eerder gelogde scan. */
export async function addScores(key, scores) {
  if (!key) return;
  try {
    const s = store(LOG_STORE);
    const entry = await s.get(key, { type: 'json' });
    if (!entry || entry.scores) return; // onbekend of al ingevuld
    entry.scores = scores;
    await s.setJSON(key, entry);
  } catch (e) {
    console.warn('[scan-store] scores opslaan mislukt:', e.message);
  }
}

/** Verwijdert scans van meer dan 12 maanden geleden. */
async function cleanupOldMonths(s, now) {
  const cutoff = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 12, 1));
  const { directories } = await s.list({ directories: true });
  for (const dir of directories) {
    if (dir < month(cutoff)) {
      const { blobs } = await s.list({ prefix: `${dir}/` });
      await Promise.all(blobs.map((b) => s.delete(b.key)));
    }
  }
}
