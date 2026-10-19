# Phase 4 — public competitor intelligence

## Workflow
Add a creator under Competitors. Collect public metadata locally or export a provider dataset, then select that competitor and import JSON under Public competitor signals. Review eligible cards in Content Ideas, create a draft, edit it and approve through the existing plan controls. Nothing publishes automatically.

The importer assigns the uploaded catalog to the selected competitor: verify the export contains only that creator. Platform-specific baselines are separate. Imports retain at most 200 recent posts per creator (latest snapshot per canonical URL), captions capped at 3,000 characters; no video or thumbnails. Existing workspace envelopes and online D1 sync include the catalogs. No new database migration.

## Adapter contract
`AnalyticsAdapter(source).parse(payload)` accepts `local`, `apify`, `scrapebadger`; payload is an array or `{posts:[]}`, `{items:[]}`, `{data:{items:[]}}`. Canonical fields: `url`, `publishedAt` (ISO), `observedAt` (ISO), `views`, `likes`, `caption`. Common provider keys such as webVideoUrl, playCount, videoViewCount, stats.playCount and created_at are mapped. Missing counts stay null. Provider schemas differ by actor/endpoint: unsupported exports must be transformed to this contract, not silently interpreted.

These are payload adapters, not credentialed live provider integrations. No paid scraping call is made automatically. No AI service or paid API is enabled. An enrichment callback boundary exists and recomputes eligibility before calling a configured provider; only compressed public text, tag IDs and voice tags are passed, never private profile details. This is not a billing ledger or connected LLM client.

## Local collection
Install Playwright in this checkout (`npm install --no-save playwright`), then `npx playwright install chromium`. Run:

```
node scripts/analytics/collect.mjs urls.json catalog.json
```

`urls.json` is an array of up to 50 HTTPS public URLs on tiktok.com, instagram.com, youtube.com or x.com/twitter.com. The headless browser reads public hydration/JSON-LD without signing in, downloading media, circumventing challenges or calling paid providers. Output includes usable posts and per-URL errors. Import catalog.json in Studio. No local HTTP server, cron or background monitoring is installed.

This initial collector is best-effort, not a guaranteed full profile crawler: it does not paginate entire histories. Dynamic layouts, absent publication dates, hidden metrics and login walls can produce no usable data. Provider exports are the explicit fallback. No live-platform reliability claim has been made; fixture/contract tests do not substitute for real collection tests.

## Math and limitations
Candidate excluded; at least 5 distinct older same-platform posts from the preceding 90 days, capped to the latest 30. Only snapshots collected within 7 days count. Thresholds: candidate / median >= 3 AND 0.67448975 × (candidate − median) / MAD >= 3. Zero median/MAD => insufficient evidence, never infinity. Unknown metrics and future collection timestamps cannot pass. Caption-based taxonomy matches canonical labels or aliases, and are not visual/video understanding.

Current total counts have different exposure ages; these are screening signals, not causal evidence of virality. Mature baseline posts may understate new-post potential. Snapshot histories and age-normalized growth are future work.

Not Allowed taxonomy tags/public-content permission exclude recommendations. Missing/Ask First tags and unstructured boundaries/capabilities require human review. The badge only reports mapped-rule alignment, not a safety guarantee. Free local drafts adapt a small set of structural formats and persona/interests; they are deterministic templates, not AI-generated scripts. Human approval remains required. No OnlyFans/Fansly collection, Phase 5 media tools or automatic publishing.

## Verification
`node tests/intelligence.test.cjs` plus all existing test suites. Tests cover dual threshold, zero MAD, insufficient/stale data, canonical URLs, import/dedup, rule exclusion, and paid callback gating.
