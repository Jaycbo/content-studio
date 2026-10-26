import db from '../lib/engine/db.mjs';
const count = sql => Object.values(db.prepare(sql).get())[0];
const results = [];
const check = (name, ok) => { results.push(ok); console.log((ok ? 'PASS  ' : 'FAIL  ') + name); };
check('10 tables', count("SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'") === 10);
check('16 indexes', count("SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_autoindex%'") === 16);
check('2 evidence triggers', count("SELECT COUNT(*) FROM sqlite_master WHERE type='trigger'") === 2);
check('foreign keys on', count('PRAGMA foreign_keys') === 1);
check('WAL mode', count('PRAGMA journal_mode') === 'wal');
const rejects = sql => {
  db.exec('SAVEPOINT t');
  try { db.exec(sql); return false; } catch { return true; } finally { db.exec('ROLLBACK TO t'); db.exec('RELEASE t'); }
};
db.exec('BEGIN');
try {
  db.exec("INSERT INTO sources(id,kind) VALUES ('verify-src','fyp')");
  db.exec("INSERT INTO ingestion_runs(id,source_id,status) VALUES ('verify-run','verify-src','running')");
  check('fyp source accepted', true);
  check('bad source kind rejected', rejects("INSERT INTO sources(id,kind) VALUES ('b','bogus')"));
  check('demo evidence rejected', rejects("INSERT INTO evidence_records(id,run_id,payload_hash,sanitized_payload) VALUES ('e','verify-run','h','{\"demo\":true}')"));
  check('snapshot without evidence rejected', rejects("INSERT INTO video_metric_snapshots(video_id,views) VALUES ('v',1)"));
} finally { db.exec('ROLLBACK'); }
check('test rows rolled back', count('SELECT COUNT(*) FROM sources') === 0);
process.exit(results.every(Boolean) ? 0 : 1);
