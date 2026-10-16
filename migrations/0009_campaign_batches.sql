ALTER TABLE campaigns ADD COLUMN batch_id TEXT;
CREATE INDEX campaigns_batch ON campaigns(batch_id, deleted_at, scheduled_date);
