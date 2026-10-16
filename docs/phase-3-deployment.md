# Phase 3 deployment

The October 16 brief supersedes the earlier section titles. Eight collapsible
sections now cover Identity; Visual / Style; Voice / Tone; Boundaries / Off-Limits;
Platform Links; Target Benchmarks; Content Vault Tags; Weekly Filming Quota Tracking.
Earlier agency/team fields remain under Identity; existing brand/content fields
remain under Benchmarks and Vault. No model IDs or reference links are changed.

Profile schema sensitivity flags are descriptive metadata, not access controls.
The pilot currently has owner-only Sites access. Google OAuth / Cloudflare Zero
Trust and manager/SMM access have not been provisioned by this change.

Taxonomy terms have canonical IDs and category-scoped aliases. The workspace
snapshot commits definitions and profile references together through workspaceStore;
`luxeva-taxonomy-v1` mirrors the bank for local access. Rename retains IDs, merge
rewrites all model references including archived models, and deletion unlinks them.
Location/Hook/Format tags can be selected as profile tags and have explicit
Allowed / Ask First / Not Allowed rules. Merge keeps the stricter rule on conflict.
No competitor fetching or paywall access is implemented.

Weekly targets and delivered counts are manual values for the selected week.
The target ranges are shown in labels, not enforced as mandatory quotas. This is
not a historical vault, uploaded-media inventory, or automatic delivery detector.

## Online persistence

`/api/workspace` saves one single-tenant studio workspace in SQLite-backed D1,
with chunked payload rows and an atomic version-checked update. Existing D1
reference tables are unchanged. A local recovery copy remains through Phase 1.
The request limit is 6 MB; raw media must not be included in profile records.

On first connection an empty online workspace receives the local copy. A clean
sample browser can load an existing online workspace. Divergent non-sample copies
require an explicit Load online / Save this copy online choice. Once connected,
local saves queue an online save; failures are shown in the sidebar. A local
"Profile saved" notice does not mean the network save has finished: check Online
workspace for confirmation. Failed/unauthorized requests retain local data.
Concurrent updates return a conflict rather than overwriting newer server data.
Sensitive profile data is within the existing owner-private site boundary.

A 3× baseline ratio is not a robust Z-score. Future public-platform monitoring,
paid fallbacks and AI are not installed, scheduled or billed by this deployment.
The proposed $0–$10/month budget is a target, not a verified service guarantee.
