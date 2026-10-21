ALTER TABLE campaigns ADD COLUMN kind TEXT NOT NULL DEFAULT 'online' CHECK (kind IN ('online','offline','promo'));
ALTER TABLE campaigns ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE campaigns ADD COLUMN address TEXT NOT NULL DEFAULT '';
ALTER TABLE campaign_batches ADD COLUMN kind TEXT NOT NULL DEFAULT 'online' CHECK (kind IN ('online','offline','promo'));
ALTER TABLE campaign_batches ADD COLUMN city TEXT NOT NULL DEFAULT '';
ALTER TABLE campaign_batches ADD COLUMN address TEXT NOT NULL DEFAULT '';
CREATE INDEX campaigns_section ON campaigns(kind,deleted_at,closed_at,scheduled_date);
