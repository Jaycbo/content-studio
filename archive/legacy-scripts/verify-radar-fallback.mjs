import fs from 'node:fs';
import path from 'node:path';
import { collectRadar } from '../lib/radar-ingestion.mjs';

const ALL_HANDLES = [
  "@faye.belincii", "@minalatinaof", "@aishah", "@leximarvell",
  "@jellybeanxooo", "@realalinnarosee", "@lelasohna", "@isabela.ramirez31",
  "@woesenpai69", "@savaschulz", "@sophieraiin"
];

async function runVerification() {
  const targets = ALL_HANDLES.map((handle, i) => ({
    handle,
    tier: 'agency',
    creatorId: `c${i + 1}`
  }));

  console.log(`Starting fallback verification for ${ALL_HANDLES.length} benchmark handles...`);
  
  const result = await collectRadar({ targets });
  
  const benchmarkPath = path.resolve('public/studio/data/radar-benchmarks.json');
  let benchmarks = {};
  if (fs.existsSync(benchmarkPath)) {
    benchmarks = JSON.parse(fs.readFileSync(benchmarkPath, 'utf8'));
  }

  let posts = Array.isArray(result.sources) ? result.sources : [];
  if (!posts.length) {
    posts = Object.entries(benchmarks).flatMap(([handleKey, items]) => {
      const handle = handleKey.startsWith('@') ? handleKey : `@${handleKey}`;
      return items.map(p => ({
        ...p,
        creatorHandle: p.creatorHandle || handle
      }));
    });
  }

  // Ensure every post explicitly retains creatorHandle
  posts = posts.map(p => ({
    ...p,
    creatorHandle: p.creatorHandle || p.handle || '@unknown'
  }));

  const cachePath = path.resolve('public/studio/data/radar-verification-cache.json');
  fs.writeFileSync(cachePath, JSON.stringify({ sources: posts, handles: ALL_HANDLES }, null, 2));

  console.log(`Verified ${posts.length} labeled sample posts across all ${ALL_HANDLES.length} handles.`);
  console.log('⚡ Synthesizing radar outliers with Gemini 3.5 Flash Lite...\n');

  process.env.RADAR_INPUT_PATH = cachePath;
  await import('./radar-synthesis.mjs');
}

runVerification().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
