ALTER TABLE campaigns ADD COLUMN closed_at TEXT;
CREATE INDEX campaigns_recruitment ON campaigns(deleted_at, closed_at, scheduled_date);
