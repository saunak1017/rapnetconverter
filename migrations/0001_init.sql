CREATE TABLE IF NOT EXISTS rapnet_outputs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  payload TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rapnet_outputs_slug ON rapnet_outputs(slug);
