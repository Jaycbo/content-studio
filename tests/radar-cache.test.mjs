import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {mergeRadarCache, saveRadarCache, isRealOutlier} from '../scripts/radar-cache.mjs';
const now = Date.parse('2026-10-24T12:00:00Z');
const iso = hoursAgo => new Date(now - hoursAgo * 3600e3).toISOString();
const real = (id, handle, extra = {}) => ({id, creatorHandle: handle, tier: 'agency', creatorId: '', multiplier: 3, observedAt: iso(1), publishedAt: iso(5), ...extra});

assert(isRealOutlier(real('1', '@a')));
assert(!isRealOutlier(real('1', '@a', {demo: true})));
assert(!isRealOutlier(real('1', '@a', {fallback: true})));
assert(!isRealOutlier(real('1', '@a', {multiplier: null})));

const merged = mergeRadarCache(
  [real('1', '@Sophie', {multiplier: 2}), real('old', '@b', {observedAt: iso(24 * 8)})],
  [real('1', '@sophie', {multiplier: 4}), real('2', '@c', {demo: true})], now);
assert.equal(merged.length, 1);
assert.equal(merged[0].creatorHandle, '@sophie');
assert.equal(merged[0].multiplier, 4);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-cache-'));
const file = path.join(dir, 'radar-cache.json');
assert.deepEqual(saveRadarCache({sources: [real('1', '@a'), real('2', '@b', {demo: true})]}, {file, now}), {added: 1, total: 1});
assert.deepEqual(saveRadarCache({sources: [real('3', '@c')]}, {file, now}), {added: 1, total: 2});
assert.deepEqual(saveRadarCache({sources: []}, {file, now}), {added: 0, total: 2});
assert.deepEqual(fs.readdirSync(dir), ['radar-cache.json']);

const cache = JSON.parse(fs.readFileSync(file, 'utf8'));
assert(Array.isArray(cache.sources));
const benchmarks = ['@a', '@c'];
assert.equal(cache.sources.filter(p => benchmarks.includes(p?.creatorHandle || '') && Number.isFinite(p.multiplier) && p.multiplier > 0).length, 2);

fs.writeFileSync(file, '{not json');
assert.deepEqual(saveRadarCache({sources: [real('9', '@z')]}, {file, now}), {added: 1, total: 1});
console.log('PASS: radar cache keeps only real outliers, dedupes, prunes at 7 days, writes atomically and matches the synthesis input contract');
