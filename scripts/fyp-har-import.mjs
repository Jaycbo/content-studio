import fs from 'node:fs';
import path from 'node:path';

const harFile = process.argv[2];
if (!harFile || !fs.existsSync(harFile)) {
  console.error("Usage: node scripts/fyp-har-import.mjs <path-to-har-file>");
  process.exit(1);
}

console.log(`Reading HAR from: ${harFile}`);
const harRaw = JSON.parse(fs.readFileSync(harFile, 'utf8'));
const entries = harRaw.log?.entries || [];

const extracted = new Map();

for (const entry of entries) {
  const url = entry.request?.url || '';
  if (!url.includes('/api/recommend/item_list') && 
      !url.includes('/api/post/item_list') && 
      !url.includes('/api/related/item_list') &&
      !url.includes('/item_list')) continue;

  const content = entry.response?.content;
  if (!content || !content.text) continue;

  let rawText = content.text;
  if (content.encoding === 'base64') {
    try {
      rawText = Buffer.from(rawText, 'base64').toString('utf8');
    } catch (e) {
      continue;
    }
  }

  try {
    const data = JSON.parse(rawText);
    const itemList = data.itemList || data.items || [];
    for (const item of itemList) {
      if (item && item.id) {
        extracted.set(item.id, item);
      }
    }
  } catch (e) {
    // Ignore malformed text
  }
}

console.log(`Extracted ${extracted.size} distinct videos from this session.`);

if (extracted.size === 0) {
  console.warn("⚠️ No video items extracted. Keeping existing history untouched.");
  process.exit(0);
}

const outDir = 'var/fyp-capture';
fs.mkdirSync(outDir, { recursive: true });
const historyFile = path.join(outDir, 'HISTORY.json');

let history = {};
if (fs.existsSync(historyFile)) {
  try {
    history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
  } catch (e) {
    history = {};
  }
}

const nowMs = Date.now();
let overlapCount = 0;

for (const [id, item] of extracted.entries()) {
  const currentViews = item.stats?.playCount || 0;
  const currentLikes = item.stats?.diggCount || 0;

  if (!history[id]) {
    history[id] = {
      id,
      item,
      firstSeen: nowMs,
      snapshots: []
    };
  } else {
    overlapCount++;
    history[id].item = item;
  }

  history[id].snapshots.push({
    timestamp: nowMs,
    views: currentViews,
    likes: currentLikes
  });
}

fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

const activeItems = Object.values(history).map(h => h.item);
fs.writeFileSync(path.join(outDir, 'SAMPLE.json'), JSON.stringify(activeItems, null, 2));

console.log(`Master history updated: ${Object.keys(history).length} total videos tracked.`);
console.log(`🔁 ${overlapCount} videos overlapped with previous sessions.`);
