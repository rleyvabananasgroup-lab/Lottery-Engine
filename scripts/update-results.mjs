// Downloads the latest Powerball and Mega Millions results and saves them to data/feed.json,
// which the app reads every time it opens. Run automatically by GitHub (see
// .github/workflows/update-results.yml). Never invents or deletes results: records are only
// added after validation, and a record that disagrees with a stored one is kept as stored.
import { readFile, writeFile } from 'node:fs/promises';

const FILE = new URL('../data/feed.json', import.meta.url);
const GAMES = {
  pb: { name: 'Powerball', ny: 'd6yy-54nr', mirror: 'powerball', wMax: 69, bMax: 26, days: [1, 3, 6] },
  mm: { name: 'Mega Millions', ny: '5xaw-6ayf', mirror: 'megamillions', wMax: 70, bMax: 24, days: [2, 5] },
};

async function get(url) {
  const c = new AbortController(); const t = setTimeout(() => c.abort(), 30000);
  try {
    const r = await fetch(url, { signal: c.signal, headers: { 'User-Agent': 'LotteryIntelligenceEngine/1.2' } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}
function fromNY(g, row) {
  const t = String(row.winning_numbers || '').trim().split(/\s+/).map(Number);
  let w, b;
  if (g === 'pb') { if (t.length !== 6) return null; w = t.slice(0, 5); b = t[5]; }
  else { if (t.length !== 5) return null; w = t; b = parseInt(row.mega_ball, 10); }
  const m = row.multiplier ? parseInt(row.multiplier, 10) : null;
  let dp = null;
  if (row.double_play_winning_numbers) {
    const x = row.double_play_winning_numbers.trim().split(/\s+/).map(Number);
    if (x.length === 6) dp = x.slice(0, 5).sort((a, c) => a - c).concat(x[5]);
  }
  return { d: String(row.draw_date).slice(0, 10), w: w.sort((a, c) => a - c), b, m: Number.isFinite(m) ? m : null, dp };
}
function fromMirror(text) {
  const lines = text.trim().split(/\r?\n/); const h = lines.shift().split(','); const ix = k => h.indexOf(k);
  return lines.map(l => {
    const c = l.split(',');
    return {
      d: c[ix('draw_date')], w: [1, 2, 3, 4, 5].map(i => +c[ix('w' + i)]).sort((a, b) => a - b), b: +c[ix('bonus')],
      m: c[ix('multiplier')] ? +c[ix('multiplier')] : null,
      dp: c[ix('dp_w1')] ? [1, 2, 3, 4, 5].map(i => +c[ix('dp_w' + i)]).concat(+c[ix('dp_bonus')]) : null,
    };
  });
}
function problems(g, r) {
  const G = GAMES[g], e = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(r.d)) e.push('bad date');
  else if (!G.days.includes(new Date(r.d + 'T12:00:00Z').getUTCDay())) e.push('not a drawing day');
  if (!Array.isArray(r.w) || r.w.length !== 5 || new Set(r.w).size !== 5 || r.w.some(n => !Number.isInteger(n) || n < 1 || n > G.wMax)) e.push('bad white balls');
  if (!Number.isInteger(r.b) || r.b < 1 || r.b > G.bMax) e.push('bad bonus ball');
  if (r.m != null && ![2, 3, 4, 5, 10].includes(r.m)) e.push('bad multiplier');
  return e;
}
const toRow = r => `${r.d.replace(/-/g, '')} ${r.w.join('.')} ${r.b} ${r.m ?? '-'} ${r.dp ? r.dp.join('.') : '-'}`;
const fromRow = line => {
  const [d, w, b, m, dp] = line.split(' ');
  return { d: `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`, w: w.split('.').map(Number), b: +b, m: m === '-' ? null : +m, dp: dp && dp !== '-' ? dp.split('.').map(Number) : null };
};

const feed = JSON.parse(await readFile(FILE, 'utf8'));
let changed = false;
for (const g of Object.keys(GAMES)) {
  const cur = feed[g]; const since = cur.since;
  const stored = new Map((cur.rows ? cur.rows.split('|') : []).map(fromRow).map(r => [r.d, r]));
  let incoming = null, source = null;
  try {
    const where = encodeURIComponent(`draw_date > '${since}T00:00:00.000'`);
    incoming = JSON.parse(await get(`https://data.ny.gov/resource/${GAMES[g].ny}.json?$where=${where}&$order=draw_date%20ASC&$limit=1000`))
      .map(r => fromNY(g, r)).filter(Boolean);
    source = `NY Open Data ${GAMES[g].ny}`;
  } catch (e) { console.warn(`${GAMES[g].name}: NY Open Data failed (${e.message}); trying the archive mirror.`); }
  if (!incoming) {
    try {
      incoming = fromMirror(await get(`https://raw.githubusercontent.com/cruiseliner/lottery-master-archive/HEAD/data/${GAMES[g].mirror}/draws.csv`)).filter(r => r.d > since);
      source = 'Lottery Master Archive (mirror of NY Open Data)';
    } catch (e) { console.warn(`${GAMES[g].name}: mirror failed too (${e.message}). Keeping existing data.`); continue; }
  }
  let added = 0;
  for (const r of incoming) {
    const bad = problems(g, r);
    if (bad.length) { console.warn(`${GAMES[g].name} ${r.d} rejected: ${bad.join(', ')}`); continue; }
    const ex = stored.get(r.d);
    if (!ex) { stored.set(r.d, r); added++; continue; }
    if (ex.w.join() !== r.w.join() || ex.b !== r.b) { console.warn(`${GAMES[g].name} ${r.d}: source disagrees with stored record; stored kept.`); continue; }
    if (ex.m == null && r.m != null) { ex.m = r.m; added++; }
    if (!ex.dp && r.dp) { ex.dp = r.dp; added++; }
  }
  const rows = [...stored.values()].sort((a, b) => (a.d < b.d ? -1 : 1)).map(toRow).join('|');
  if (rows !== cur.rows) {
    feed[g] = { ...cur, rows, source: `${source} (scheduled update)`, updated: new Date().toISOString() };
    delete feed[g].jackpot; changed = true;
  }
  console.log(`${GAMES[g].name}: ${added} new/updated record(s) from ${source}; ${stored.size} on file since ${since}.`);
}
if (changed) { await writeFile(FILE, JSON.stringify(feed, null, 1) + '\n'); console.log('data/feed.json updated.'); }
else console.log('No changes.');
