# Phase 1: local persistence contract

## Scope

`public/studio/data/workspace-store.js` owns local loading, validation orchestration,
migration, writes, import, export and recovery. The existing UI supplies its model
validator; UI-specific field choices and business rules remain unchanged. The
module has no DOM, D1, network or filesystem dependencies.

The browser store remains localStorage in this phase. It is not SQLite, shared
team storage or a media store. D1 continues to own web-extension references and
assignments. No database migration is required for D1.

## Authoritative record

Key: `luxeva-workspace-v1`.

```json
{
  "format": "luxeva-workspace",
  "schemaVersion": 1,
  "revision": 1,
  "savedAt": "ISO-8601 timestamp",
  "workspace": {
    "version": 2,
    "activeId": "existing-model-id",
    "models": [{"version": 1, "id": "existing-model-id"}]
  }
}
```

The model above is abbreviated; the existing profile, research, ideas and
competitors are retained in full. Storage-envelope, workspace and model versions
are separate. Unknown optional fields are preserved rather than projected away.
Model IDs, research/idea IDs, URLs and `libraryReferenceId` values are not rewritten.
Future normalized asset/publication/performance records can be introduced through
explicit schema migrations without changing these identities. They are not
implemented or represented as fake empty features in Phase 1.

## Migration

Load the authoritative key first. Only if it is absent, inspect
`content-studio-v2`, followed by `content-studio-v1`. Validate before writing.
Existing IDs are preserved; an ID-less v1 record receives an ID at migration.
After a successful write, subsequent loads use only the authoritative key.
Repeated backup imports replace the workspace, never append duplicate models.
An intentionally empty workspace stays empty.

Legacy keys remain byte-for-byte intact. A failed migration leaves them usable
for another attempt. A malformed or newer unsupported authoritative record blocks
saving; it never silently falls back to an old legacy record. Source migration
copies should not be removed until a verified external backup exists.

## Writes and failure behavior

Each write validates the entire workspace and compares the current stored record
with the one this store instance last observed. A stale tab receives a conflict
instead of silently overwriting already-observed newer data. This is optimistic
conflict detection, not a multi-process database lock; truly simultaneous writes
across browser processes are not transactionally serialized by localStorage.

One preceding record is retained at `luxeva-workspace-recovery-v1`. The previous
snapshot is written first; the authoritative record is then replaced with one
atomic localStorage `setItem`. Failure of either write is reported, with the
authoritative record unchanged. The recovery key may have advanced if the second
write failed. This is a bounded rolling snapshot, not an indefinite history.

Restore validates before confirmation, saves before changing UI state, and only
reports success after the write succeeds. Restore does not contact D1 or delete
shared reference assignments. Existing IDs retain those connections. Replacing
a workspace with a backup that omits models can leave shared assignments for
models absent locally, as before; it is not a server-side roster replacement.

## Backup and recovery

The existing Export all models / Export her data controls now emit the versioned
envelope. Restore accepts this envelope and legacy v1/v2 exports. Old application
versions cannot import the new envelope; keep a legacy export before rolling back
the application version. New exports are portable to this Phase 1 version.

When stored data cannot be decoded, Export all models exports the original raw
record instead of a misleading sample workspace. Never overwrite that download.

Support recovery without new screens:

1. Export the current workspace or damaged raw record first.
2. In the studio's browser console, download the previous snapshot:
   `download('luxeva-recovery.json', workspaceStore.exportRecovery(), 'application/json')`.
3. Use the existing Restore all models control to select that file and confirm.

`workspaceStore.recover()` is also available to a support integration after
explicit user confirmation. It validates the snapshot and commits before
returning; a caller must reload the UI after success. Corruption is never repaired
silently. If no valid recovery snapshot exists, restore a valid external export.

LocalStorage has a limited quota. Retaining legacy data and one recovery snapshot
uses additional space. Quota errors fail closed; no automatic deletion is used to
make room. Browser data clearing still removes local records and snapshots.
External backups remain necessary. No RAW files should be put in this store.

## Verification

Run `node tests/profiles.test.cjs`, `node tests/extension.test.cjs`,
`node tests/library.test.cjs`, and `node tests/storage.test.cjs`.
The first three retain their existing behavioral assertions; the profile harness
loads the new module and reads the new envelope. The storage suite covers legacy
migration, identity preservation, malformed and future versions, failed writes,
recovery, repeat imports, empty workspaces, stale tabs and actual restore-handler
success/failure behavior. DOM mocks are not full browser end-to-end coverage.
