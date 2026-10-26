CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('benchmark','niche','manual','fyp')),
  region TEXT,
  niche TEXT,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0,1)),
  config_json TEXT CHECK (config_json IS NULL OR json_valid(config_json))
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
  id TEXT PRIMARY KEY,
  source_id TEXT NOT NULL REFERENCES sources(id),
  start_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  end_time TEXT,
  status TEXT NOT NULL CHECK (status IN ('running','succeeded','partial','failed')),
  observed_count INTEGER NOT NULL DEFAULT 0 CHECK (observed_count >= 0),
  accepted_count INTEGER NOT NULL DEFAULT 0 CHECK (accepted_count >= 0),
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS runs_source_time ON ingestion_runs(source_id, start_time);

CREATE TABLE IF NOT EXISTS evidence_records (
  id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL REFERENCES ingestion_runs(id),
  capture_time TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  payload_hash TEXT NOT NULL,
  sanitized_payload TEXT NOT NULL CHECK (json_valid(sanitized_payload)),
  UNIQUE (run_id, payload_hash)
);
CREATE TRIGGER IF NOT EXISTS evidence_no_synthetic BEFORE INSERT ON evidence_records
WHEN json_extract(NEW.sanitized_payload,'$.demo') IS 1 OR json_extract(NEW.sanitized_payload,'$.fallback') IS 1
BEGIN SELECT RAISE(ABORT,'synthetic or fallback data is not allowed as evidence'); END;
CREATE TRIGGER IF NOT EXISTS evidence_immutable BEFORE UPDATE ON evidence_records
BEGIN SELECT RAISE(ABORT,'evidence is immutable'); END;

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_account_id TEXT,
  handle TEXT NOT NULL COLLATE NOCASE
);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_platform_handle ON accounts(platform, handle);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_platform_id ON accounts(platform, platform_account_id) WHERE platform_account_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  platform_video_id TEXT NOT NULL,
  account_id TEXT NOT NULL REFERENCES accounts(id),
  canonical_url TEXT NOT NULL,
  published_at TEXT NOT NULL,
  caption TEXT,
  sound_id TEXT,
  sound_url TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS videos_platform_identity ON videos(platform, platform_video_id);
CREATE INDEX IF NOT EXISTS videos_account_time ON videos(account_id, published_at);
CREATE INDEX IF NOT EXISTS videos_sound ON videos(sound_id);

CREATE TABLE IF NOT EXISTS video_metric_snapshots (
  video_id TEXT NOT NULL REFERENCES videos(id),
  evidence_id TEXT NOT NULL REFERENCES evidence_records(id),
  observed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  views INTEGER NOT NULL CHECK (views >= 0),
  likes INTEGER CHECK (likes >= 0),
  comments INTEGER CHECK (comments >= 0),
  shares INTEGER CHECK (shares >= 0)
);
CREATE UNIQUE INDEX IF NOT EXISTS snapshot_evidence_identity ON video_metric_snapshots(video_id, evidence_id);
CREATE INDEX IF NOT EXISTS snapshots_video_time ON video_metric_snapshots(video_id, observed_at);
CREATE INDEX IF NOT EXISTS snapshots_evidence ON video_metric_snapshots(evidence_id);

CREATE TABLE IF NOT EXISTS clusters (
  id TEXT PRIMARY KEY,
  sound_id TEXT,
  hook_family_id TEXT,
  niche TEXT,
  region TEXT
);
CREATE INDEX IF NOT EXISTS clusters_sound ON clusters(sound_id);

CREATE TABLE IF NOT EXISTS cluster_members (
  cluster_id TEXT NOT NULL REFERENCES clusters(id),
  video_id TEXT NOT NULL REFERENCES videos(id),
  match_method TEXT NOT NULL,
  confidence REAL NOT NULL CHECK (confidence >= 0 AND confidence <= 1)
);
CREATE UNIQUE INDEX IF NOT EXISTS cluster_member_identity ON cluster_members(cluster_id, video_id);
CREATE INDEX IF NOT EXISTS cluster_members_video ON cluster_members(video_id);

CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  model_id TEXT NOT NULL,
  source_video_id TEXT NOT NULL REFERENCES videos(id),
  cluster_id TEXT REFERENCES clusters(id),
  status TEXT NOT NULL CHECK (status IN ('queued','filmed','approved','rejected')),
  payload_json TEXT NOT NULL CHECK (json_valid(payload_json)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS briefs_model_video ON briefs(model_id, source_video_id);
CREATE INDEX IF NOT EXISTS briefs_model_queue ON briefs(model_id, status, created_at);
CREATE INDEX IF NOT EXISTS briefs_cluster ON briefs(cluster_id);

CREATE TABLE IF NOT EXISTS jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT CHECK (payload IS NULL OR json_valid(payload)),
  idempotency_key TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','succeeded','failed','dead')),
  priority INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  run_after TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  locked_at TEXT,
  locked_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  finished_at TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS jobs_due ON jobs(status, priority DESC, run_after);
