import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const script = fileURLToPath(new URL('../scripts/radar-synthesis.mjs', import.meta.url));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'radar-synthesis-'));
const now = Date.now();
const post = (id, handle, extra = {}) => ({id, creatorHandle: handle, tier: 'agency', creatorId: '', multiplier: 3.2, viewCount: 9000, medianViews: 2800,
  caption: 'real post ' + id, publishedAt: new Date(now - 3600e3).toISOString(), observedAt: new Date(now).toISOString(), provenance: 'Public TikTok metadata', ...extra});

let prompts = [];
let reply;
const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    prompts.push(JSON.parse(body).contents[0].parts[0].text);
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({candidates: [{finishReason: 'STOP', content: {parts: [{text: '```json\n' + JSON.stringify(reply) + '\n```'}]}}]}));
  });
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const endpoint = `http://127.0.0.1:${server.address().port}/v1beta/models/test:generateContent`;

function run(cache, name) {
  const input = path.join(dir, name + '-cache.json'), output = path.join(dir, name + '-pulse.json');
  if (cache) fs.writeFileSync(input, JSON.stringify({sources: cache}));
  return new Promise(resolve => {
    const child = spawn(process.execPath, [script], {env: {...process.env, GEMINI_API_KEY: 'test-key', GEMINI_ENDPOINT: endpoint,
      RADAR_INPUT_PATH: input, RADAR_OUTPUT_PATH: output,
      RADAR_TARGETS_JSON: JSON.stringify(['@a', '@b', '@c'].map(handle => ({handle, tier: 1})))}});
    let log = '';
    child.stdout.on('data', d => log += d); child.stderr.on('data', d => log += d);
    child.on('close', code => resolve({code, log, output}));
  });
}

reply = {
  benchmarkAudits: [
    {handle: '@a', status: 'HOT', action: 'PROMOTE', reason: 'Steady breakouts this week.', suggestedReplacement: '@newcreator_benchmark'},
    {handle: '@b', status: 'STEADY', action: 'KEEP', reason: 'One solid outlier.'},
    {handle: '@c', status: 'HOT', action: 'PROMOTE', reason: 'Strong 4.8x performer.'}],
  formatDistribution: {lipSyncTextPct: 50, microDancePct: 0, talkingHeadPct: 25, aestheticLoopPct: 25},
  winningHookPatterns: [{angle: 'Relatable Pivot', estimatedSharePct: 100, formula: 'When the [x] changes', example: 'When the plans change'}]
};

// 1. @c has no real outliers (its only samples are demo/fallback data and must be ignored).
const mixed = await run([post('1', '@a'), post('2', '@B'), post('3', '@c', {demo: true, multiplier: 9}), post('4', '@c', {fallback: true})], 'mixed');
assert.equal(mixed.code, 0, mixed.log);
assert.equal(prompts.length, 1);
assert(prompts[0].includes('No recent outliers found for this creator.'), 'prompt must tell Gemini the creator had no outliers');
assert(!/demo|preview|synthetic/i.test(prompts[0].replace(/never invent[^\n]*/i, '')), 'no demo/preview wording or data may reach Gemini');
assert(!prompts[0].includes('real post 3') && !prompts[0].includes('real post 4'), 'demo/fallback posts must not be sent');
const pulse = JSON.parse(fs.readFileSync(mixed.output, 'utf8'));
const byHandle = Object.fromEntries(pulse.benchmarkAudits.map(a => [a.handle, a]));
assert.deepEqual(byHandle['@c'], {handle: '@c', status: 'COLD', action: 'KEEP', reason: 'No viral outliers detected this week.'});
assert.equal(byHandle['@a'].action, 'PROMOTE');
assert.equal(byHandle['@a'].suggestedReplacement, undefined, 'invented replacement handles are dropped');
assert.equal(pulse.demo, false);
assert.deepEqual(pulse.demoHandles, []);
assert.deepEqual(pulse.benchmarksWithoutOutliers, ['@c']);
assert.equal(pulse.sources.length, 2);
assert(!/preview|not live performance|synthetic/i.test(JSON.stringify(pulse)), 'no Preview/demo wording may appear in the pulse');

// 2. A cache with no real outliers must not fabricate a pulse: exit code 3, nothing written.
const empty = await run([post('5', '@a', {demo: true})], 'empty');
assert.equal(empty.code, 3, empty.log);
assert.equal(fs.existsSync(empty.output), false);
assert.equal(prompts.length, 1, 'Gemini is not called when there is no real data');
const missing = await run(null, 'missing');
assert.equal(missing.code, 3, missing.log);

server.close();
console.log('PASS: synthesis sends only real outliers, reports quiet creators honestly, never adds Preview/demo text, and refuses to fabricate a pulse');
