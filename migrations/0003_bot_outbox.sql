CREATE TABLE bot_outbox (
  event_id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL UNIQUE REFERENCES campaigns(id),
  rule TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','leased','done')),
  claim_id TEXT,
  lease_until INTEGER,
  created_at TEXT NOT NULL,
  delivered_at TEXT
);
CREATE INDEX bot_outbox_ready ON bot_outbox(status, lease_until, created_at);
