import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.resolve(__dirname, '../../var/engine.sqlite');

// Ensure the directory exists before connecting
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Open the database (creates it if it doesn't exist)
const db = new Database(dbPath);

// Enable Write-Ahead Logging (WAL) for concurrent reads/writes
db.pragma('journal_mode = WAL');
// Enforce strict relational integrity
db.pragma('foreign_keys = ON');
// Give concurrent workers up to 5 seconds to acquire a write lock before throwing an error
db.pragma('busy_timeout = 5000');

// Export the singleton instance for the workers to share
export default db;

console.log('✓ SQLite Engine connected with WAL concurrency enabled.');
