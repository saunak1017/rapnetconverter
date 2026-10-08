CREATE TABLE IF NOT EXISTS rapnet_proposal_requests (
  request_id TEXT PRIMARY KEY,
  output_id TEXT NOT NULL,
  request_payload TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  email_id TEXT,
  FOREIGN KEY (output_id) REFERENCES rapnet_outputs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rapnet_proposal_requests_output_created
  ON rapnet_proposal_requests(output_id, created_at);
