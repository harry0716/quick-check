CREATE TABLE IF NOT EXISTS attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bank TEXT NOT NULL,
  attempt TEXT NOT NULL,
  received_at TEXT NOT NULL,
  payload_hash TEXT NOT NULL,
  row_json TEXT NOT NULL CHECK(json_valid(row_json)),
  UNIQUE(bank, attempt)
);
CREATE INDEX IF NOT EXISTS attempts_bank_id ON attempts(bank, id);
