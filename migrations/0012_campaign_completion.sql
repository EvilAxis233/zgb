ALTER TABLE campaigns ADD COLUMN finished_at TEXT;
CREATE INDEX campaigns_finished ON campaigns(deleted_at, finished_at);
