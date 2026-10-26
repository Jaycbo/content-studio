import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Reads captured For You responses (var/fyp-capture/item_list-*.json), keeps only videos worth replicating,
// writes them to SQLite in one transaction per file, then moves the file to var/fyp-archive/.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const FILTERS = {
  MIN_PLAYS: Number(process.env.FYP_MIN_PLAYS ?? 10000),
  MAX_AGE_DAYS: Number(process.env.FYP_MAX_AGE_DAYS ?? 7), // 0 turns the age filter off
};
const num = v => { const n = Number(v); return v !== null && v !== '' && Number.isFinite(n) && n >= 0 ? Math.round(n) : null; };
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const iso = ms => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const clip = (s, n) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

export function normalizeItem(item, capturedAtMs, filters = FILTERS) {
  if (item?.isAd === true) return { skip: 'ads' };
  const id = String(item?.id ?? ''), handle = String(item?.author?.uniqueId ?? '').trim();
  const stats = item?.statsV2 || item?.stats || {};
  const plays = num(stats.playCount), createdMs = Number(item?.createTime) * 1000, soundId = String(item?.music?.id ?? '');
  if (!/^\d+$/.test(id) || !handle || plays === null || !Number.isFinite(createdMs)) return { skip: 'invalid' };
  if (plays < filters.MIN_PLAYS) return { skip: 'lowViews' };
  if (filters.MAX_AGE_DAYS > 0 && capturedAtMs - createdMs > filters.MAX_AGE_DAYS * 864e5) return { skip: 'tooOld' };
  if (!/^\d+$/.test(soundId)) return { skip: 'noSound' };
  const hook = (item.stickersOnItem || []).flatMap(s => s?.stickerText || []).map(t => clip(t, 200)).filter(Boolean).join(' / ');
  return { video: {
    id, handle, authorId: item.author?.id ? String(item.author.id) : null, createdAt: iso(createdMs),
    caption: clip(item.desc, 300) || null, onScreenText: hook || null,
    soundId, soundTitle: clip(item.music?.title, 120) || null, soundOriginal: item.music?.original === true,
    plays, likes: num(stats.diggCount), comments: num(stats.commentCount), shares: num(stats.shareCount),
    followers: num((item.authorStatsV2 || item.authorStats || {}).followerCount), durationSec: num(item.video?.duration),
  } };
}

export function ingestFile(db, filePath, { source = 'burner', filters = FILTERS } = {}) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const runId = 'fyp-' + sha(raw).slice(0, 32); // same file content = same run, so nothing is ever stored twice
  if (db.prepare('SELECT 1 AS found FROM ingestion_runs WHERE id=?').get(runId)) return { status: 'already' };
  const body = JSON.parse(raw);
  if (!Array.isArray(body.itemList)) throw new Error('not an item_list response (no itemList array)');
  const capturedMs = Number(body.extra?.now) || fs.statSync(filePath).mtimeMs, stamp = iso(capturedMs);
  const skipped = { ads: 0, lowViews: 0, tooOld: 0, noSound: 0, invalid: 0 }, kept = new Map();
  for (const item of body.itemList) {
    const r = normalizeItem(item, capturedMs, filters);
    if (r.skip) skipped[r.skip]++; else kept.set(r.video.id, r.video);
  }
  const videos = [...kept.values()], seen = body.itemList.length;
  const payload = JSON.stringify({ source, capturedAt: stamp, hasMore: body.hasMore ?? null, itemsSeen: seen, skipped, videos });
  const q = {
    source: db.prepare("INSERT INTO sources(id,kind,region,niche,enabled,config_json) VALUES (?,'fyp','US','pop-culture',1,?) ON CONFLICT(id) DO NOTHING"),
    run: db.prepare("INSERT INTO ingestion_runs(id,source_id,start_time,end_time,status,observed_count,accepted_count) VALUES (?,?,?,?,'succeeded',?,?)"),
    evidence: db.prepare('INSERT INTO evidence_records(id,run_id,capture_time,payload_hash,sanitized_payload) VALUES (?,?,?,?,?)'),
    account: db.prepare("INSERT INTO accounts(id,platform,platform_account_id,handle) VALUES (?,'tiktok',?,?) ON CONFLICT(platform,handle) DO UPDATE SET platform_account_id=COALESCE(accounts.platform_account_id,excluded.platform_account_id)"),
    video: db.prepare("INSERT INTO videos(id,platform,platform_video_id,account_id,canonical_url,published_at,caption,sound_id,sound_url,on_screen_text) VALUES (?,'tiktok',?,?,?,?,?,?,NULL,?) ON CONFLICT(platform,platform_video_id) DO UPDATE SET caption=COALESCE(excluded.caption,videos.caption), sound_id=COALESCE(excluded.sound_id,videos.sound_id), on_screen_text=COALESCE(excluded.on_screen_text,videos.on_screen_text)"),
    snapshot: db.prepare('INSERT INTO video_metric_snapshots(video_id,evidence_id,observed_at,views,likes,comments,shares) VALUES (?,?,?,?,?,?,?) ON CONFLICT(video_id,evidence_id) DO NOTHING'),
  };
  db.transaction(() => {
    const sourceId = 'fyp:' + source, evidenceId = crypto.randomUUID();
    q.source.run(sourceId, JSON.stringify({ source }));
    q.run.run(runId, sourceId, stamp, stamp, seen, videos.length);
    q.evidence.run(evidenceId, runId, stamp, sha(payload), payload);
    for (const v of videos) {
      const accountId = 'tiktok:' + v.handle.toLowerCase();
      q.account.run(accountId, v.authorId, '@' + v.handle);
      q.video.run('tiktok:' + v.id, v.id, accountId, 'https://www.tiktok.com/@' + v.handle + '/video/' + v.id, v.createdAt, v.caption, v.soundId, v.onScreenText);
      q.snapshot.run('tiktok:' + v.id, evidenceId, stamp, v.plays, v.likes, v.comments, v.shares);
    }
  }).immediate();
  return { status: 'ingested', seen, kept: videos.length, skipped };
}

export function processCaptureDir(db, { dir = path.join(ROOT, 'var/fyp-capture'), archiveDir = path.join(ROOT, 'var/fyp-archive'), source, filters } = {}) {
  const totals = { files: 0, ingested: 0, already: 0, failed: 0, seen: 0, kept: 0 };
  if (!fs.existsSync(dir)) return totals;
  fs.mkdirSync(archiveDir, { recursive: true });
  for (const name of fs.readdirSync(dir).filter(f => /^item_list-.*\.json$/.test(f)).sort()) {
    const file = path.join(dir, name);
    totals.files++;
    try {
      const r = ingestFile(db, file, { source, filters });
      if (r.status === 'already') totals.already++;
      else { totals.ingested++; totals.seen += r.seen; totals.kept += r.kept; }
      let dest = path.join(archiveDir, name);
      if (fs.existsSync(dest)) dest = path.join(archiveDir, Date.now() + '-' + name);
      fs.renameSync(file, dest);
      console.log(name + ': ' + (r.status === 'already' ? 'already stored, archived' : r.kept + ' of ' + r.seen + ' kept (ads ' + r.skipped.ads + ', low views ' + r.skipped.lowViews + ', too old ' + r.skipped.tooOld + ', no sound ' + r.skipped.noSound + ', invalid ' + r.skipped.invalid + '), archived'));
    } catch (error) {
      totals.failed++;
      console.error(name + ': left in place (' + error.message + ')');
    }
  }
  return totals;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const arg = name => process.argv.find(a => a.startsWith('--' + name + '='))?.split('=')[1];
  const { default: db } = await import('../db.mjs');
  const t = processCaptureDir(db, { source: arg('source') || 'burner', dir: arg('dir') && path.resolve(arg('dir')) });
  console.log('Done: ' + t.files + ' files, ' + t.ingested + ' stored (' + t.kept + ' of ' + t.seen + ' videos kept), ' + t.already + ' already stored, ' + t.failed + ' failed.');
  process.exitCode = t.failed ? 1 : 0;
}
