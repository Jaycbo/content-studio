import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { processCaptureDir, normalizeItem } from '../lib/engine/adapters/fyp.mjs';

// Stand-in for better-sqlite3's API on top of the SQLite built into Node.
const raw = new DatabaseSync(':memory:');
raw.exec('PRAGMA foreign_keys=ON');
for (const f of ['schema-001.sql', 'schema-002.sql']) raw.exec(fs.readFileSync(new URL('../lib/engine/' + f, import.meta.url), 'utf8'));
const db = { exec: s => raw.exec(s), prepare: s => raw.prepare(s),
  transaction: fn => ({ immediate: () => { raw.exec('BEGIN IMMEDIATE'); try { const v = fn(); raw.exec('COMMIT'); return v; } catch (e) { raw.exec('ROLLBACK'); throw e; } } }) };
const count = sql => Object.values(raw.prepare(sql).get())[0];

const NOW = Date.parse('2026-10-25T12:00:00Z'), DAY = 864e5;
const item = (id, o = {}) => ({ id: String(id), desc: 'caption ' + id, createTime: Math.floor((NOW - 2 * DAY) / 1000), isAd: false,
  author: { id: '555' + id, uniqueId: 'creator' + id }, authorStatsV2: { followerCount: '123456' },
  music: { id: '7600000000000000' + id, title: 'Some song', original: false, playUrl: 'https://sf16.tiktokcdn-us.com/obj/x?sig=SECRET' },
  stats: { playCount: 500000 }, statsV2: { playCount: '500000', diggCount: '40000', commentCount: '900', shareCount: '1200' }, video: { duration: 12 }, ...o });
const body = items => JSON.stringify({ extra: { now: NOW }, hasMore: true, itemList: items });
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fyp-')), archive = path.join(dir, 'archive'), cap = path.join(dir, 'capture');
fs.mkdirSync(cap);
const good = item(101, { stickersOnItem: [{ stickerText: ['when my teacher', 'randomly decided'], stickerType: 4 }, { stickerText: ['it was my time'] }] });
const content = body([good, item(102, { isAd: true }), item(103, { stats: { playCount: 9999 }, statsV2: { playCount: '9999' } }),
  item(104, { stats: { playCount: 10000 }, statsV2: { playCount: '10000', diggCount: '40000', commentCount: '900', shareCount: '1200' } }), item(105, { createTime: Math.floor((NOW - 30 * DAY) / 1000) }),
  item(106, { music: {} }), item(107, { author: {} }), good]);
fs.writeFileSync(path.join(cap, 'item_list-1.json'), content);

// A video the benchmark recorder already stored (same id convention, no author id yet).
raw.exec("INSERT INTO sources(id,kind) VALUES ('benchmark:creator101','benchmark')");
raw.exec("INSERT INTO accounts(id,platform,handle) VALUES ('tiktok:creator101','tiktok','@creator101')");
raw.exec("INSERT INTO videos(id,platform,platform_video_id,account_id,canonical_url,published_at) VALUES ('tiktok:101','tiktok','101','tiktok:creator101','https://x','2026-10-23T12:00:00Z')");

const t = processCaptureDir(db, { dir: cap, archiveDir: archive });
assert.deepEqual([t.files, t.ingested, t.failed, t.seen, t.kept], [1, 1, 0, 8, 2]);
assert.deepEqual(fs.readdirSync(cap), []); assert.deepEqual(fs.readdirSync(archive), ['item_list-1.json']);
const run = raw.prepare('SELECT observed_count o, accepted_count a, status s FROM ingestion_runs').get();
assert.deepEqual([run.o, run.a, run.s], [8, 2, 'succeeded']);
assert.equal(count('SELECT COUNT(*) FROM videos'), 2, 'video 101 reused, 104 added, nothing else stored');
const v = raw.prepare("SELECT on_screen_text h, sound_id s, sound_url u, canonical_url c FROM videos WHERE id='tiktok:101'").get();
assert.equal(v.h, 'when my teacher / randomly decided / it was my time');
assert.equal(v.s, '7600000000000000101'); assert.equal(v.u, null); assert.equal(v.c, 'https://x', 'an existing video keeps its stored link');
assert.equal(raw.prepare("SELECT canonical_url c FROM videos WHERE id='tiktok:104'").get().c, 'https://www.tiktok.com/@creator104/video/104');
assert.equal(raw.prepare("SELECT platform_account_id p FROM accounts WHERE id='tiktok:creator101'").get().p, '555101', 'existing account gets its platform id');
const snap = raw.prepare("SELECT views,likes,comments,shares,observed_at FROM video_metric_snapshots WHERE video_id='tiktok:104'").get();
assert.deepEqual([snap.views, snap.likes, snap.comments, snap.shares, snap.observed_at], [10000, 40000, 900, 1200, '2026-10-25T12:00:00.000Z']);
const evidence = raw.prepare('SELECT sanitized_payload p FROM evidence_records').get().p;
assert(!/SECRET|tiktokcdn|playUrl/.test(evidence), 'no signed media links are stored');
assert.deepEqual(JSON.parse(evidence).skipped, { ads: 1, lowViews: 1, tooOld: 1, noSound: 1, invalid: 1 });

// The same file again (even under another name) is never stored twice; broken files stay put.
fs.writeFileSync(path.join(cap, 'item_list-2.json'), content);
fs.writeFileSync(path.join(cap, 'item_list-3.json'), '{not json');
fs.writeFileSync(path.join(cap, 'item_list-4.json'), JSON.stringify({ hello: 1 }));
const t2 = processCaptureDir(db, { dir: cap, archiveDir: archive });
assert.deepEqual([t2.ingested, t2.already, t2.failed], [0, 1, 2]);
assert.deepEqual(fs.readdirSync(cap).sort(), ['item_list-3.json', 'item_list-4.json']);
assert.equal(count('SELECT COUNT(*) FROM ingestion_runs'), 1); assert.equal(count('SELECT COUNT(*) FROM video_metric_snapshots'), 2);

// Filters are tunable; the age filter can be switched off.
assert.equal(normalizeItem(item(105, { createTime: Math.floor((NOW - 30 * DAY) / 1000) }), NOW, { MIN_PLAYS: 10000, MAX_AGE_DAYS: 0 }).video.id, '105');
console.log('PASS: FYP adapter filters, flattens hooks, stores atomically, never double-ingests, and archives processed files');
