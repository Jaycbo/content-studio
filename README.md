# Luxeva Content Studio

Private Sites app, migrated from static HTML to the supported Vinext/D1 starter. The existing app is under public/studio; root redirects there without changing origin or localStorage keys. Existing profile/plan state is untouched and remains browser-local. The shared reference library uses D1. Access remains owner-private through Sites authentication.

Phase 1 now routes model/workspace persistence through `public/studio/data/workspace-store.js`.
It migrates the old browser keys into a versioned authoritative local record while
preserving the old values, IDs and links. See [storage and recovery](docs/storage-foundation.md)
for the schema, migration behavior, recovery procedure and browser-storage limitations.

## Reference library

GET /api/library supports inbox/assigned/used/all, search, model filter and 20-item pages. All requests require an authenticated Sites user. Writes also require same-origin Origin and the custom X-Luxeva-Request header. Saved video URLs are canonical TikTok post URLs; arbitrary fetch targets and short URLs are rejected. No server-side video downloads or external scraping.

POST actions: save (idempotent by video ID), assign, unassign, used, delete (unassigned only), removeModel. The application does not change Sites sharing. Assignments preserve model IDs/names; full model profiles and plans still use browser storage. Frozen/archived local models cannot receive new assignments or drafts from the UI. Profile deletion clears its shared reference assignments before deleting local data.

Cleanup runs on library GET: unassigned references expire at 60 days. Assigned/used entries remain. Unassigning refreshes the expiry window. No scheduled job, pin feature, media files, thumbnails, metric histories, or transcripts are stored.

## Extension

extension/ is a Manifest V3 Chrome test build with activeTab+scripting only. It captures a chosen visible post and sends a bounded link/text payload in a URL fragment to the studio. The studio removes the fragment, temporarily retains the pending reference in sessionStorage, and requires Save confirmation. No passwords, API keys, background workers, broad host access or browsing history collection. ZIP and guide are in public/downloads and the user-facing outputs directory.

## Checks

node tests/library.test.cjs: API handlers executed against an in-memory SQLite database, including auth/CSRF, retention, duplicates, search, pagination, and assignment states.
node tests/extension.test.cjs: extraction fixtures and minimal permissions.
node tests/profiles.test.cjs: existing workspace/profile/idea regression checks.
node tests/storage.test.cjs: migrations, recovery, failed saves/imports and stale-tab detection.
node node_modules/typescript/bin/tsc --noEmit

Production build uses the Sites build-site helper. Drizzle migrations are schema-only. Browser QA was blocked by automatic approval usage limits; no browser workaround was attempted. Chrome installation/live TikTok extraction still needs a user test.
