import fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import db from './db.mjs';

// Ordered list of schema files. New versions are appended; user_version records how many have run.
const FILES = ['./schema-001.sql', './schema-002.sql'];

export function migrate() {
  const sql = FILES.map(f => fs.readFileSync(new URL(f, import.meta.url), 'utf8'));
  db.transaction(() => {
    const current = db.pragma('user_version', { simple: true });
    for (let i = current; i < sql.length; i++) db.exec(sql[i]);
    db.pragma('user_version = ' + sql.length);
  }).immediate();
  return db.pragma('user_version', { simple: true });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  console.log('Schema version: ' + migrate());
  console.log(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name).join(', '));
}
