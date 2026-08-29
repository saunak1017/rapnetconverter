CREATE TABLE IF NOT EXISTS rapnet_output_media_chunks (
  output_id TEXT NOT NULL,
  row_index TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  data TEXT NOT NULL,
  PRIMARY KEY (output_id, row_index, chunk_index),
  FOREIGN KEY (output_id) REFERENCES rapnet_outputs(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rapnet_output_media_chunks_output
  ON rapnet_output_media_chunks(output_id, row_index, chunk_index);
