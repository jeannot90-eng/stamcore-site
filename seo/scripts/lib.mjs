/* Gedeelde helpers voor build.mjs, check.mjs en sitemap.mjs. Geen dependencies. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const SEO = path.join(ROOT, 'seo');
export const GENERATOR_MARK = '<meta name="generator" content="stamcore-seo">';
export const PREVIEW_DIR = '_preview';

export const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
export const exists = (p) => fs.existsSync(path.join(ROOT, p));
export const readJson = (p) => JSON.parse(read(p));

export const config = readJson('seo/config.json');
export const SITE = config.site;

// ── Tekst ──────────────────────────────────────────────────────────────────
export const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const slugify = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
export const words = (s) => String(s).split(/\s+/).filter(Boolean);
export const asParagraphs = (v) => (Array.isArray(v) ? v : String(v ?? '').split(/\n\s*\n/)).map((s) => s.trim()).filter(Boolean);
export const euro = (n) => `€${n}`;

const MAANDEN = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
export const datumLeesbaar = (iso) => { const [y, m, d] = String(iso).split('-').map(Number); return `${d} ${MAANDEN[m - 1]} ${y}`; };
export const today = () => new Date().toISOString().slice(0, 10);

// Tokens uit config die in niche-/stadsteksten mogen staan, bijv. {seo_per_maand}.
const p = config.prijzen;
const maanden = (n) => `${n} ${n === 1 ? 'maand' : 'maanden'}`;
export const TOKENS = {
  website_eenmalig: euro(p.website.eenmalig),
  website_per_jaar: euro(p.website.perJaar),
  seo_per_maand: euro(p.lokaleSeo.perMaand),
  seo_min_maanden: String(p.lokaleSeo.minimaalMaanden),
  seo_opzegtermijn: maanden(p.lokaleSeo.opzegtermijnMaanden),
  seo_paginas: p.lokaleSeo.paginasPerMaand,
  btw: p.btw,
};
export function fillTokens(s, extra = {}) {
  const all = { ...TOKENS, ...extra };
  return String(s).replace(/\{(\w+)\}/g, (m, k) => (k in all ? all[k] : m));
}

/** {{veld}} = ge-escaped, {{{veld}}} = ruwe HTML. Onbekend veld = fout. */
export function render(tpl, vars) {
  return tpl
    .replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => { if (!(k in vars)) throw new Error(`template: onbekend veld {{{${k}}}}`); return vars[k]; })
    .replace(/\{\{(\w+)\}\}/g, (_, k) => { if (!(k in vars)) throw new Error(`template: onbekend veld {{${k}}}`); return esc(vars[k]); });
}

// ── Data ───────────────────────────────────────────────────────────────────
export function loadNiches() {
  const dir = path.join(SEO, 'niches');
  return Object.fromEntries(fs.readdirSync(dir).filter((f) => f.endsWith('.json'))
    .map((f) => { const n = readJson(`seo/niches/${f}`); return [n.key, n]; }));
}

export function loadCities() {
  const dir = path.join(SEO, 'cities');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json') && !f.startsWith('_'))
    .map((f) => ({ ...readJson(`seo/cities/${f}`), _file: `seo/cities/${f}` }));
}

export function cityInfo(c, niche) {
  const slug = `website-${niche.key}-${slugify(c.slug || c.stad)}`;
  return { slug, file: `${slug}.html`, url: `/${slug}`, canonical: `${SITE}/${slug}` };
}

export const isExcluded = (stad) => config.uitgesloten.some((u) => slugify(u) === slugify(stad));

// Eenvoudige frontmatter: key: waarde per regel, waarden mogen JSON zijn (arrays/objecten/strings).
export function parseFrontmatter(src) {
  const m = src.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: src };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const mm = line.match(/^(\w+):\s*(.*)$/);
    if (!mm) continue;
    const v = mm[2].trim();
    try { data[mm[1]] = JSON.parse(v); } catch { data[mm[1]] = v.replace(/^["']|["']$/g, ''); }
  }
  return { data, body: m[2] };
}

export function loadArticles() {
  const dir = path.join(SEO, 'articles');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md') && !f.startsWith('_')).map((f) => {
    const { data, body } = parseFrontmatter(read(`seo/articles/${f}`));
    const slug = data.slug || f.replace(/\.md$/, '');
    return { ...data, slug, body, _file: `seo/articles/${f}`, file: `kennis/${slug}.html`, url: `/kennis/${slug}`, canonical: `${SITE}/kennis/${slug}` };
  });
}

// ── Maps-scan (CSV) ──────────────────────────────────────────────────────────
export function parseScan(relPath) {
  const lines = read(relPath).split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
  const header = lines.shift().split(',').map((h) => h.trim());
  return lines.map((l) => {
    const cells = l.split(',').map((c) => c.trim());
    return Object.fromEntries(header.map((h, i) => [h, cells[i] ?? '']));
  });
}

/** Rekent gemiddelden en tellingen uit, en leidt 2–3 kansen af. Nooit beloftes. */
export function analyseScan(rows, stad) {
  const n = rows.length;
  const ja = (k) => rows.filter((r) => r[k]?.toLowerCase() === 'ja').length;
  const reviews = rows.map((r) => Number(r.reviews) || 0);
  const scores = rows.map((r) => Number(String(r.score).replace(',', '.')) || 0).filter((s) => s > 0);
  const gemReviews = Math.round(reviews.reduce((a, b) => a + b, 0) / (n || 1));
  const gemScore = scores.length ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1).replace('.', ',') : null;
  const t = { website: ja('eigen_website'), plaats: ja('plaatspaginas'), posts: ja('posts_laatste_30d'), fotos: ja('fotos_eigen_werk') };
  // "geen van de 3 heeft", "alle 3 hebben", "2 van de 3 hebben"
  const deel = (k, ev, mv) => (k === 0 ? `geen van de ${n} ${ev}` : k === n ? `alle ${n} ${mv}` : `${k} van de ${n} ${k === 1 ? ev : mv}`);
  const Deel = (...a) => deel(...a).replace(/^./, (c) => c.toUpperCase());
  const kansen = [];
  if (n - t.plaats >= 2) kansen.push(`${t.plaats === 0 ? `Geen van de ${n} bedrijven bovenaan heeft` : `${n - t.plaats} van de ${n} bedrijven bovenaan hebben geen`} pagina's per wijk of kern. Wie die wel heeft, geeft Google meer om op te matchen als iemand zoekt op een wijk of dorp in ${stad}.`);
  if (n - t.posts >= 2) kansen.push(`Weinig activiteit op de profielen: ${t.posts === 0 ? `geen van de ${n} plaatste de afgelopen 30 dagen een post` : `${n - t.posts} van de ${n} plaatsten de afgelopen 30 dagen geen post`}. Regelmatig posten is een van de makkelijkste manieren om te laten zien dat je bedrijf actief is.`);
  if (gemReviews < 30) kansen.push(`De drie bovenaan hebben gemiddeld ${gemReviews} reviews. Met een vaste reviewroutine na elke ronde is dat een gat dat je in maanden kunt dichten, niet in jaren.`);
  else kansen.push(`De drie bovenaan hebben gemiddeld ${gemReviews} reviews. Dat haal je niet in één seizoen in. Begin daarom met pagina's per wijk en een volledig profiel, terwijl je reviews groeien.`);
  if (kansen.length < 3 && n - t.fotos >= 2) kansen.push(`${Deel(t.fotos, 'laat', 'laten')} foto's van eigen werk zien. Echte foto's van je bus en je werk vallen op tussen profielen zonder.`);
  if (kansen.length < 3 && n - t.website >= 1) kansen.push(`${Deel(t.website, 'heeft', 'hebben')} een eigen website. Een site met je diensten en plaatsen geeft Google en klanten meer houvast dan alleen een profiel.`);
  if (kansen.length < 2) kansen.push(`Een Bedrijfsprofiel met "Glazenwasser" als hoofdcategorie, losse diensten en een goed ingesteld werkgebied is de basis. Daar kijk ik als eerste naar.`);
  const samenvatting = `De drie bedrijven bovenaan hebben gemiddeld ${gemReviews} reviews${gemScore ? ` en een gemiddelde score van ${gemScore}` : ''}. ${Deel(t.website, 'heeft', 'hebben')} een eigen website, ${deel(t.plaats, 'heeft', 'hebben')} pagina's per wijk of kern.`;
  return {
    n, gemReviews, gemScore, tellingen: t, kansen: kansen.slice(0, 3), samenvatting,
    datum: rows[0]?.datum, zoekterm: rows[0]?.zoekterm,
  };
}

// ── HTML-analyse (voor check en sitemap) ─────────────────────────────────────
export function visibleText(html) {
  return html
    .replace(/<!-- partial:header -->[\s\S]*?<!-- \/partial:header -->/g, ' ')
    .replace(/<!-- partial:footer -->[\s\S]*?<!-- \/partial:footer -->/g, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<head[\s\S]*?<\/head>/i, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&[a-z]+;|&#\d+;/g, ' ')
    .replace(/\s+/g, ' ').trim();
}
export const uniqueText = (html) => [...html.matchAll(/<!-- uniek -->([\s\S]*?)<!-- \/uniek -->/g)].map((m) => visibleText(`<body>${m[1]}</body>`)).join(' ');

export function trigrams(text) {
  const w = words(text.toLowerCase().replace(/[^a-z0-9à-ÿ\s]/g, ' '));
  const set = new Set();
  for (let i = 0; i + 2 < w.length; i++) set.add(w.slice(i, i + 3).join(' '));
  return set;
}
export function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let n = 0; for (const t of a) if (b.has(t)) n++;
  return n / (a.size + b.size - n);
}

/** URL (zonder domein) → bestand in de repo, of null als het niet bestaat. */
export function resolveUrl(url) {
  const u = url.split('#')[0].split('?')[0];
  if (u === '' || u === '/') return 'index.html';
  const clean = u.replace(/^\//, '').replace(/\/$/, '');
  for (const cand of [clean, `${clean}.html`, `${clean}/index.html`]) {
    if (cand && exists(cand) && fs.statSync(path.join(ROOT, cand)).isFile()) return cand;
  }
  return null;
}
