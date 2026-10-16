/* Browser-local persistence boundary. No DOM, network or media dependencies. */
(function (root) {
  'use strict';
  const KEY = 'luxeva-workspace-v1';
  const RECOVERY_KEY = 'luxeva-workspace-recovery-v1';
  const LEGACY_KEYS = ['content-studio-v2', 'content-studio-v1'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const error = message => new Error(message);

  function create({storage, validateModel, fresh, uuid}) {
    let observed, revision = 0, loaded = false, blocked = false;

    function validate(workspace) {
      if (!workspace || workspace.version !== 2 || !Array.isArray(workspace.models))
        throw error('Unsupported or invalid workspace.');
      workspace.models.forEach(validateModel);
      const ids = workspace.models.map(model => model.id);
      if (ids.some(id => typeof id !== 'string' || !/^[A-Za-z0-9-]+$/.test(id)) || new Set(ids).size !== ids.length)
        throw error('Missing or duplicate model IDs.');
      if (ids.length ? !ids.includes(workspace.activeId) : workspace.activeId !== null)
        throw error('Invalid active model.');
      return workspace;
    }

    function decode(raw) {
      const record = JSON.parse(raw);
      if (record.format !== 'luxeva-workspace' || record.schemaVersion !== 1 ||
          !Number.isSafeInteger(record.revision) || record.revision < 1)
        throw error('Unsupported local storage version.');
      validate(record.workspace);
      return record;
    }

    function prepareImport(raw) {
      const value = JSON.parse(raw);
      let workspace;
      if (value?.format === 'luxeva-workspace') workspace = decode(raw).workspace;
      else if (value?.version === 1) {
        validateModel(value);
        // An ID-less v1 backup represents one workspace, not an append operation.
        value.id ||= uuid();
        workspace = {version: 2, activeId: value.id, models: [value]};
      } else workspace = value;
      return clone(validate(workspace));
    }

    function encode(workspace, nextRevision) {
      return JSON.stringify({format: 'luxeva-workspace', schemaVersion: 1,
        revision: nextRevision, savedAt: new Date().toISOString(), workspace: validate(clone(workspace))});
    }

    function assertCurrent() {
      if (!loaded) throw error('Load the workspace before saving.');
      if (storage.getItem(KEY) !== observed)
        throw error('This workspace changed in another tab. Export your changes, then reload before saving.');
    }

    function write(workspace, restoring = false) {
      if (blocked && !restoring) throw error('Saved data could not be read. Restore a valid backup before saving.');
      assertCurrent();
      const raw = encode(workspace, revision + 1);
      // Keep exactly one previous snapshot. If either write fails, the current
      // authoritative record stays intact and callers must not report success.
      if (observed !== null) storage.setItem(RECOVERY_KEY, observed);
      storage.setItem(KEY, raw);
      observed = raw;
      revision += 1;
      blocked = false;
      return clone(workspace);
    }

    function load() {
      try {
        observed = storage.getItem(KEY);
        loaded = true;
        if (observed !== null) {
          const record = decode(observed);
          revision = record.revision;
          blocked = false;
          return clone(record.workspace);
        }
        for (const legacyKey of LEGACY_KEYS) {
          const raw = storage.getItem(legacyKey);
          if (raw === null) continue;
          const workspace = prepareImport(raw);
          // Legacy keys remain byte-for-byte intact, including on quota failure.
          return write(workspace);
        }
        const model = fresh();
        model.id ||= uuid();
        return write({version: 2, activeId: model.id, models: [model]});
      } catch (cause) {
        blocked = true;
        throw cause;
      }
    }

    function restore(workspace) {
      // Preserve malformed legacy data as well before a deliberate recovery.
      assertCurrent();
      validate(workspace);
      if (observed === null) {
        for (const key of LEGACY_KEYS) {
          const raw = storage.getItem(key);
          if (raw !== null) { storage.setItem(RECOVERY_KEY, raw); break; }
        }
      }
      return write(workspace, true);
    }

    function exportWorkspace(workspace) {
      return JSON.stringify(JSON.parse(encode(workspace, Math.max(1, revision))), null, 2);
    }

    function exportRecovery() {
      const raw = storage.getItem(RECOVERY_KEY);
      if (raw === null) throw error('No previous workspace snapshot is available.');
      return raw;
    }

    function exportUnreadable() {
      // A damaged workspace must never be exported as a misleading demo backup.
      return storage.getItem(KEY) ?? storage.getItem(LEGACY_KEYS[0]) ?? storage.getItem(LEGACY_KEYS[1]) ?? '';
    }

    function recover() {
      // Explicit recovery only: never silently load an older snapshot.
      return restore(prepareImport(exportRecovery()));
    }

    return {load, save: write, prepareImport, restore, exportWorkspace, exportRecovery,
      exportUnreadable, recover, validate};
  }
  root.LuxevaWorkspaceStore = Object.freeze({create, KEY, RECOVERY_KEY});
})(globalThis);
