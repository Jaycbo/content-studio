// Shrinks the captured responses into one small SAMPLE.json that is easy to attach to a chat.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../var/fyp-capture');
const shrink = (v, depth = 0) => typeof v === 'string' ? (v.length > 80 ? v.slice(0, 80) + '…' : v)
  : Array.isArray(v) ? v.slice(0, depth ? 3 : 2).map(x => shrink(x, depth + 1))
  : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shrink(x, depth + 1)])) : v;
const files = fs.readdirSync(dir).filter(f => /^item_list-.*\.json$/.test(f)).sort();
if (!files.length) { console.error('No captured responses found in ' + dir); process.exit(1); }
const report = files.map(file => {
  const body = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const items = body.itemList || body.items || [];
  return { file, topLevelKeys: Object.keys(body), itemCount: items.length, firstItems: shrink(items.slice(0, 2)), everythingElse: shrink({ ...body, itemList: undefined, items: undefined }) };
});
fs.writeFileSync(path.join(dir, 'SAMPLE.json'), JSON.stringify(report, null, 2));
console.log('Wrote ' + path.join(dir, 'SAMPLE.json') + ' (' + files.length + ' response files, ' + report.reduce((n, r) => n + r.itemCount, 0) + ' items)');
