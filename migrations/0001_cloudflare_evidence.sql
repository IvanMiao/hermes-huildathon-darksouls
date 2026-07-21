CREATE TABLE IF NOT EXISTS studio_runs (
  run_id TEXT PRIMARY KEY,
  status TEXT NOT NULL CHECK (status IN ('published', 'release_blocked')),
  input_text TEXT NOT NULL,
  recipe_json TEXT NOT NULL,
  events_json TEXT NOT NULL,
  artifacts_json TEXT NOT NULL,
  qa_report_json TEXT NOT NULL,
  voice_json TEXT,
  music_json TEXT,
  mirrored_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS generated_audio (
  run_id TEXT PRIMARY KEY,
  voice_json TEXT,
  music_json TEXT,
  updated_at INTEGER NOT NULL
);
