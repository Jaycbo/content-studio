import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Adds 'fyp' to the allowed values of sources.kind. SQLite cannot edit a CHECK constraint,
// so the table is rebuilt (the documented 12-step method). Safe to run more than once.
export function migrateSourcesKind(db, { backupPath } = {}) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='sources'").get();
  if (!row) throw new Error('No sources table found. Has the base schema been created?');
  const check = row.sql.match(/CHECK\s*\(\s*kind\s+IN\s*\(([^)]*)\)\s*\)/i);
  if (!check) return { changed: false, reason: 'sources.kind has no CHECK constraint, so fyp is already allowed' };
  if (/'fyp'/i.test(check[1])) return { changed: false, reason: 'sources.kind already allows fyp' };

  const newSql = row.sql
    .replace(check[0], 'CHECK (kind IN (' + check[1].trim() + ",'fyp'))")
    .replace(/^CREATE TABLE\s+(IF NOT EXISTS\s+)?["`]?sources["`]?/i, 'CREATE TABLE sources_new');
  if (!newSql.startsWith('CREATE TABLE sources_new')) throw new Error('Could not rewrite the sources definition: ' + row.sql);
  const extras = db.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='sources' AND type IN ('index','trigger') AND sql IS NOT NULL").all();

  if (backupPath) db.exec("VACUUM INTO '" + backupPath.replace(/'/g, "''") + "'");
  const fkWasOn = db.prepare('PRAGMA foreign_keys').get().foreign_keys === 1;
  db.exec('PRAGMA foreign_keys=OFF'); // must be set outside a transaction
  try {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec('DROP TABLE IF EXISTS sources_new');
      db.exec(newSql);
      db.exec('INSERT INTO sources_new SELECT * FROM sources');
      db.exec('DROP TABLE sources');
      db.exec('ALTER TABLE sources_new RENAME TO sources');
      for (const x of extras) db.exec(x.sql);
      const broken = db.prepare('PRAGMA foreign_key_check').all();
      if (broken.length) throw new Error('foreign_key_check failed: ' + JSON.stringify(broken.slice(0, 3)));
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  } finally { if (fkWasOn) db.exec('PRAGMA foreign_keys=ON'); }
  return { changed: true, reason: 'sources.kind now allows fyp' };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { default: db } = await import('../db.mjs');
  const dir = path.join(path.dirname(db.name), 'backups');
  fs.mkdirSync(dir, { recursive: true });
  const backupPath = path.join(dir, 'engine-before-002-' + new Date().toISOString().replace(/[:.]/g, '-') + '.sqlite');
  const result = migrateSourcesKind(db, { backupPath });
  if (!result.changed && fs.existsSync(backupPath)) fs.unlinkSync(backupPath);
  console.log((result.changed ? 'MIGRATED: ' : 'NO CHANGE: ') + result.reason + (result.changed ? '\nBackup saved at ' + backupPath : ''));
}
