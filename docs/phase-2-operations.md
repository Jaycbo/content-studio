# Phase 2: navigation, roster and attention dashboard

The Phase 1 `workspaceStore` module is unchanged. All reads/writes still pass
through that boundary; D1 and its API/schema remain unchanged.

## Local model contract

- `status`: `pending`, `active`, `frozen`, `cancelled` (labels are title-cased).
- `pending_reason`: nonblank text required for Pending; cleared on leaving Pending.
- `archived`: independent boolean, default false. Archiving preserves status and reason.
- Legacy missing status means Active. Legacy `status: archived` becomes
  `status: active, archived: true` on load/import; original status history was not
  recorded, so it cannot be reconstructed. Normalized fields persist on the next save.
- New profiles retain the existing Active default. Pending profiles are editable
  for onboarding; Frozen, Cancelled and archived profiles are read-only except for
  lifecycle controls. The reference library respects these guards too.

## Counters

All counters count distinct models and exclude archived profiles.
Active and Pending use the operational status exactly. Review counters include
unarchived Pending/Active/Frozen/Cancelled models so outstanding work stays visible.

Optional model-owned records reserved for later modules:

```json
{
  "assets": [{"id":"asset-1","name":"Example clip","reviewStatus":"unreviewed"}],
  "plans": [{"id":"plan-1","name":"October plan","status":"ready_for_review"}]
}
```

Only those explicit status values enter review queues. Absent arrays mean zero;
ideas, reference links and approved briefs never substitute for assets or plans.
These arrays have unique nonempty record IDs. The intake and plan-review screens
are read-only lists, not Phase 5 processing or a new plan approval workflow.

Counters click through to filtered rosters or grouped review queues. Explanations
open on pointer entry/focus; native details controls also support keyboard/tap.
Empty queues and filters display explicit messages. Existing CSS is unchanged.

## Context

Selecting a model preserves the current model module, resets the idea-week filter,
updates the active ID through workspaceStore and renders only after save success.
From an agency view it opens the selected profile. Failed writes retain the old
context. Browser storage events reload through workspaceStore when no form edits
are pending. Tabs with pending edits retain their view and request export/reload;
Phase 1 stale-write protection remains in force. This is local same-origin tab
coordination, not cross-device/team synchronization.

## Checks

`node tests/dashboard.test.cjs` covers transitions, reasons, legacy normalization,
independent archive/status filters, model-vs-record counts, actual UI handlers,
write failures and cross-tab selection. The original suites and Phase 1 storage
suite remain required. Browser smoke testing uses an isolated localhost origin
and sample data; no production model data is modified.
