import {readPlatformTrends} from './platform-trends.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import benchmarkStore from '../public/studio/data/radar-benchmarks.json' with { type: 'json' };
const projectRoot = fileURLToPath(new URL('../', import.meta.url));
const dataDir = path.join(projectRoot, 'public/studio/data');
const NO_DATA_EXIT_CODE = 3; // "nothing real to report"; lets callers tell this apart from a crash

// 1. Load API Key
const envPath = path.join(projectRoot, '.env');
let apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && fs.existsSync(envPath)) {
  const match = fs.readFileSync(envPath, 'utf8').match(/GEMINI_API_KEY="?([^"\n]+)"?/);
  if (match) apiKey = match[1];
}

if (!apiKey) {
  console.error("Missing GEMINI_API_KEY in .env");
  process.exit(1);
}

// Read structured ingestion output; never parse source code as a data store.
const cachePath = process.env.RADAR_INPUT_PATH
  ? path.resolve(process.env.RADAR_INPUT_PATH) : path.join(dataDir, 'radar-cache.json');
const outputPath = process.env.RADAR_OUTPUT_PATH
  ? path.resolve(process.env.RADAR_OUTPUT_PATH) : path.join(dataDir, 'latest-pulse.json');
const endpoint = process.env.GEMINI_ENDPOINT ||
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent';

const targets=process.env.RADAR_TARGETS_JSON?JSON.parse(process.env.RADAR_TARGETS_JSON):benchmarkStore.targets;
const benchmarks=[...new Set(targets.map(t=>'@'+t.handle.replace(/^@/,'').toLowerCase()))];
const handleOf = p => String(p?.creatorHandle || '').toLowerCase();

// Only real, observed outliers are analyzed. Synthetic/demo samples are never used and
// no creator is padded: a benchmark with no recent outliers is reported to Gemini as such.
let outliers = [];
if (fs.existsSync(cachePath)) {
  const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
  if (!Array.isArray(cache.sources)) throw Error('Radar cache must contain a sources array.');
  outliers = cache.sources.filter(p => p && p.demo !== true && p.fallback !== true &&
    benchmarks.includes(handleOf(p)) && Number.isFinite(p.multiplier) && p.multiplier > 0);
}
const benchmarkActivity = benchmarks.map(handle => {
  const posts = outliers.filter(p => handleOf(p) === handle);
  return posts.length
    ? {handle, recentOutlierCount: posts.length, recentOutliers: posts}
    : {handle, recentOutlierCount: 0, recentOutliers: [], note: 'No recent outliers found for this creator.'};
});
const quietHandles = benchmarkActivity.filter(b => !b.recentOutlierCount).map(b => b.handle);

const prompt = `You are a TikTok Growth Intelligence Agent for an elite creator agency.
Curated themes (not a verified live trend feed): ${JSON.stringify(readPlatformTrends())}. Weave activeThemes into hook examples and append trendingHashtags.

Below is the recent activity for every benchmark creator we track. Every post listed is real, observed metadata. An outlier is a post that reached at least 1.8x the creator's usual views.
A creator with recentOutlierCount 0 had no outliers in the latest scan. That is real information, not missing data.

${JSON.stringify(benchmarkActivity, null, 2)}

Rules:
- Use only the data above. Never invent posts, view counts, multipliers, creators or trends.
- Return exactly one audit for EACH benchmark creator listed.
- Never invent creator handles. Leave suggestedReplacement empty unless you are naming a handle that appears in the data above.

Tasks:
1. Benchmark Audit: Grade each creator HOT (generating 2.5x+ outliers), STEADY, or COLD (underperforming, low multiplier, stale format, or no outliers detected). Recommend KEEP, PROMOTE, or DROP.
   - A creator with no recent outliers has no breakout evidence this week: grade COLD, say plainly in the reason that no viral outliers were detected, do not cite any multiplier or post, and recommend KEEP or DROP (never PROMOTE).
2. Format Distribution: Using only the outlier posts provided, calculate the percentage breakdown across:
   - lipSyncTextPct: Short text-over-video / lip-sync (typically 5-8s)
   - microDancePct: Quick beat sync / dance (typically 5-10s)
   - talkingHeadPct: Direct address / storytime (>10s)
   - aestheticLoopPct: Silent B-roll / mirror loop (<7s)
   (Percentages must total 100).
3. Winning Hook Patterns: Identify the top 1-3 psychological narrative angles driving views in the posts provided (only as many as the data supports), give an exact fill-in-the-blank formula, and a realistic example.`;

function parseModelJson(raw) {
  const cleaned = raw.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
  return JSON.parse(cleaned || '{}');
}

async function runSynthesis() {
  if (!outliers.length) {
    const error = Error('No real outliers are in the radar cache yet; previous pulse retained. Run a Radar Scan first.');
    error.noData = true;
    throw error;
  }
  process.stdout.write(`⚡ Synthesizing ${outliers.length} real outliers across ${benchmarks.length - quietHandles.length} of ${benchmarks.length} benchmarks with Gemini 3.5 Flash Lite...\n`);

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    signal: AbortSignal.timeout(90000),
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "OBJECT",
          properties: {
            benchmarkAudits: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  handle: { type: "STRING" },
                  status: { type: "STRING", enum: ["HOT", "STEADY", "COLD"] },
                  action: { type: "STRING", enum: ["KEEP", "PROMOTE", "DROP"] },
                  reason: { type: "STRING" },
                  suggestedReplacement: { type: "STRING" }
                },
                required: ["handle", "status", "action", "reason"]
              }
            },
            formatDistribution: {
              type: "OBJECT",
              properties: {
                lipSyncTextPct: { type: "INTEGER" },
                microDancePct: { type: "INTEGER" },
                talkingHeadPct: { type: "INTEGER" },
                aestheticLoopPct: { type: "INTEGER" }
              },
              required: ["lipSyncTextPct", "microDancePct", "talkingHeadPct", "aestheticLoopPct"]
            },
            winningHookPatterns: {
              type: "ARRAY",
              items: {
                type: "OBJECT",
                properties: {
                  angle: { type: "STRING" },
                  estimatedSharePct: { type: "INTEGER" },
                  formula: { type: "STRING" },
                  example: { type: "STRING" }
                },
                required: ["angle", "estimatedSharePct", "formula", "example"]
              }
            }
          },
          required: ["benchmarkAudits", "formatDistribution", "winningHookPatterns"]
        }
      }
    })
  });

  const data = await response.json();
  if (!response.ok || data.error) throw Error(data.error?.message || `Gemini HTTP ${response.status}`);

  const candidate = data.candidates?.[0];
  if (candidate?.finishReason && candidate.finishReason !== 'STOP') console.warn(`⚠ Gemini finishReason: ${candidate.finishReason}`);
  let result;
  try {
    result = parseModelJson(candidate?.content?.parts?.map(p => p.text || '').join('') || '');
  } catch (error) {
    throw Error(`Gemini returned unreadable JSON (${error.message}); previous pulse retained.`);
  }
  if (!Array.isArray(result.benchmarkAudits) || !Array.isArray(result.winningHookPatterns) || !result.formatDistribution) {
    throw Error('Gemini returned an incomplete pulse; previous pulse retained.');
  }
  const formats = ['lipSyncTextPct','microDancePct','talkingHeadPct','aestheticLoopPct'];
  if (formats.some(k => !Number.isFinite(result.formatDistribution[k]) || result.formatDistribution[k] < 0) ||
      formats.reduce((sum,k) => sum + result.formatDistribution[k], 0) !== 100) {
    throw Error('Invalid format distribution; previous pulse retained.');
  }

  const observedHandles = new Set(outliers.map(handleOf));
  result.benchmarkAudits = benchmarks.map(handle => {
    const found = result.benchmarkAudits.find(a => a?.handle?.toLowerCase().replace(/^@/, '') === handle.slice(1));
    if (!found || !['HOT','STEADY','COLD'].includes(found.status) || !['KEEP','PROMOTE','DROP'].includes(found.action) || typeof found.reason !== 'string') {
      throw Error(`Missing or invalid audit for ${handle}; previous pulse retained.`);
    }
    const audit = {...found, handle};
    // Never keep an invented replacement creator: it must be a handle seen in the scraped data.
    const replacement = typeof audit.suggestedReplacement === 'string' ? audit.suggestedReplacement.trim().toLowerCase() : '';
    if (!replacement || !observedHandles.has(replacement.startsWith('@') ? replacement : '@' + replacement) || replacement.replace(/^@/, '') === handle.slice(1)) delete audit.suggestedReplacement;
    // A creator with no outliers has no data to praise: keep Gemini's grading unless it contradicts the facts.
    if (quietHandles.includes(handle)) {
      const inventedMetric = /\d+(\.\d+)?\s*[x×]/i.test(audit.reason);
      if (audit.status !== 'COLD' || audit.action === 'PROMOTE' || inventedMetric) {
        console.warn(`⚠ ${handle}: Gemini graded a creator with no outliers as ${audit.status}/${audit.action}${inventedMetric ? ' and cited a multiplier' : ''}; corrected to the observed facts.`);
        audit.status = 'COLD';
        if (audit.action === 'PROMOTE') audit.action = 'KEEP';
        audit.reason = 'No viral outliers detected this week.';
      }
    }
    return audit;
  });
  result.demo = false;
  result.demoHandles = [];
  result.benchmarksWithoutOutliers = quietHandles;
  result.generatedAt = new Date().toISOString();
  result.provenance = 'Radar ingestion cache';
  result.sources = outliers;
  result.inputSummary = outliers.map(p => ({creatorHandle:p.creatorHandle,id:p.id,multiplier:p.multiplier,publishedAt:p.publishedAt,provenance:p.provenance}));
  for (const hook of result.winningHookPatterns) {
    if (!hook || ['angle','formula','example'].some(k => typeof hook[k] !== 'string')) throw Error('Invalid hook template; previous pulse retained.');
  }

  console.log("\n========================================================");
  console.log("             WEEKLY RADAR INTELLIGENCE PULSE            ");
  console.log("========================================================");

  console.log("\n📊 FORMAT BREAKDOWN (% of Outliers):");
  console.log(` • Lip Sync + Text:  ${result.formatDistribution.lipSyncTextPct}%`);
  console.log(` • Micro-Dance:      ${result.formatDistribution.microDancePct}%`);
  console.log(` • Aesthetic Loops:  ${result.formatDistribution.aestheticLoopPct}%`);
  console.log(` • Talking Head/POV: ${result.formatDistribution.talkingHeadPct}%`);

  console.log("\n📋 BENCHMARK HYGIENE AUDIT:");
  for (const b of result.benchmarkAudits) {
    const badge = b.action === "DROP" ? "❌ DROP" : b.action === "PROMOTE" ? "🔥 PROMOTE" : "✅ KEEP";
    console.log(` [${badge}] ${b.handle} (${b.status}): ${b.reason}`);
    if (b.suggestedReplacement) console.log(`    ↳ Suggestion: Swap for ${b.suggestedReplacement}`);
  }

  console.log("\n✍️ WINNING HOOK FORMULAS:");
  result.winningHookPatterns.forEach((h, i) => {
    console.log(`\n ${i + 1}. [${h.angle} · ~${h.estimatedSharePct}% of Outliers]`);
    console.log(`    Formula: "${h.formula}"`);
    console.log(`    Example: "${h.example}"`);
  });
  console.log("\n========================================================\n");

  // Cache output locally for the UI drawer
  const temporary = outputPath + '.' + process.pid + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(result, null, 2) + '\n');
    fs.renameSync(temporary, outputPath);
  } finally {
    if (fs.existsSync(temporary)) fs.unlinkSync(temporary);
  }
  console.log(`✓ Saved structured synthesis to ${path.relative(projectRoot, outputPath)}`);
}

runSynthesis().catch(error => {
  console.error('Synthesis failed:', error.message);
  process.exitCode = error.noData ? NO_DATA_EXIT_CODE : 1;
});
