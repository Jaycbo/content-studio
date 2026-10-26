// Measures what the captured For You responses can tell us. Reads every var/fyp-capture/item_list-*.json.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../var/fyp-capture');
const files = fs.readdirSync(dir).filter(f => /^item_list-.*\.json$/.test(f)).sort();
const seen = new Map();
let total = 0;
for (const file of files) {
  const body = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const now = (body.extra?.now || Date.now()) / 1000;
  for (const item of body.itemList || []) { total++; seen.set(item.id, { item, now }); }
}
const uniq = [...seen.values()];
if (!uniq.length) { console.error('No items found in ' + dir); process.exit(1); }
const hours = e => (e.now - e.item.createTime) / 3600;
const pct = (n, d = uniq.length) => Math.round(100 * n / d) + '%';
const soundCounts = new Map();
for (const e of uniq) soundCounts.set(e.item.music?.id, (soundCounts.get(e.item.music?.id) || 0) + 1);
const plays = uniq.map(e => Number(e.item.statsV2?.playCount ?? e.item.stats?.playCount)).sort((a, b) => a - b);

console.log('Responses: ' + files.length + ' | items seen: ' + total + ' | distinct videos: ' + uniq.length + ' | repeats across responses: ' + (total - uniq.length));
console.log('Age: within 72h ' + pct(uniq.filter(e => hours(e) <= 72).length) + ' | within 7 days ' + pct(uniq.filter(e => hours(e) <= 168).length) + ' | older than 30 days ' + pct(uniq.filter(e => hours(e) > 720).length) + ' | newest ' + Math.round(Math.min(...uniq.map(hours)) / 24) + ' days old');
console.log('Sounds: ' + soundCounts.size + ' distinct | used by 2+ videos: ' + [...soundCounts.values()].filter(n => n > 1).length + ' | original sounds ' + pct(uniq.filter(e => e.item.music?.original).length) + ' | ads: ' + uniq.filter(e => e.item.isAd).length);
console.log('Views: median ' + plays[Math.floor(plays.length / 2)].toLocaleString() + ' | under 1M ' + pct(plays.filter(p => p < 1e6).length) + ' | 5M or more ' + pct(plays.filter(p => p >= 5e6).length));
console.log('Authors: ' + new Set(uniq.map(e => e.item.author?.uniqueId)).size + ' distinct');
