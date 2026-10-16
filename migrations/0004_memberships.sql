ALTER TABLE users ADD COLUMN avatar_key TEXT;

ALTER TABLE campaigns ADD COLUMN scheduled_date TEXT;
ALTER TABLE campaigns ADD COLUMN time_period TEXT;

UPDATE campaigns
SET scheduled_date = substr(time_schedule, 1, 10),
    time_period = substr(trim(time_schedule), -1, 1)
WHERE time_schedule GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*'
  AND substr(trim(time_schedule), -1, 1) IN ('早', '中', '晚');

CREATE TABLE campaign_memberships (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_qq TEXT NOT NULL REFERENCES users(qq),
  joined_at TEXT NOT NULL,
  gm_rewarded_at TEXT,
  PRIMARY KEY (campaign_id, user_qq)
);
CREATE INDEX campaign_memberships_user ON campaign_memberships(user_qq, joined_at DESC);

ALTER TABLE praises ADD COLUMN campaign_id TEXT REFERENCES campaigns(id);
CREATE INDEX praises_campaign ON praises(campaign_id, created_at DESC);
