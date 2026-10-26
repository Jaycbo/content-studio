import fs from 'node:fs';
import {fileURLToPath} from 'node:url';

// Real scan results the weekly synthesis reads. Only observed (non-demo) outliers are
// ever stored here; benchmarks without real data still fall back to labeled samples.
export const RADAR_CACHE_PATH = fileURLToPath(new URL('../public/studio/data/radar-cache.json', import.meta.url));
const MAX_AGE_MS = 7 * 864e5;
const MAX_SOURCES = 200;

const handleOf = p => {
  const h = String(p.creatorHandle || '').trim().toLowerCase();
  return h ? (h.startsWith('@') ? h : '@' + h) : '';
};
const keyOf = p => [p.id || p.originalVideoUrl, p.creatorHandle, p.tier || '', p.creatorId || ''].join('|');
const stamp = p => Date.parse(p.observedAt || p.publishedAt);

export function isRealOutlier(p) {
  return !!p && typeof p === 'object' && p.demo !== true && p.fallback !== true &&
    Number.isFinite(p.multiplier) && p.multiplier > 0 && handleOf(p) !== '';
}

export function mergeRadarCache(existing, fresh, now = Date.now()) {
  const map = new Map();
  for (const p of [...(Array.isArray(existing) ? existing : []), ...fresh]) {
    if (!isRealOutlier(p)) continue;
    const entry = {...p, creatorHandle: handleOf(p)};
    const t = stamp(entry);
    if (!Number.isFinite(t) || now - t > MAX_AGE_MS) continue;
    map.set(keyOf(entry), entry); // later entries (fresh) win
  }
  return [...map.values()].sort((a, b) => stamp(b) - stamp(a)).slice(0, MAX_SOURCES);
}

export function saveRadarCache(result, {file = RADAR_CACHE_PATH, now = Date.now()} = {}) {
  const fresh = (result?.sources || []).filter(isRealOutlier);
  let existing = [];
  try { existing = JSON.parse(fs.readFileSync(file, 'utf8')).sources || []; } catch { /* first run or unreadable: start clean */ }
  const sources = mergeRadarCache(existing, fresh, now);
  const temporary = file + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify({updatedAt: new Date(now).toISOString(), sources}, null, 2) + '\n');
    fs.renameSync(temporary, file);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  return {added: fresh.length, total: sources.length};
}
