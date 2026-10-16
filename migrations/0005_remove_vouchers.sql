DROP TABLE participations;

ALTER TABLE bot_outbox RENAME TO bot_outbox_legacy;
ALTER TABLE campaign_memberships RENAME TO campaign_memberships_legacy;
ALTER TABLE praises RENAME TO praises_legacy;
ALTER TABLE campaigns RENAME TO campaigns_legacy;

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  gm_qq TEXT NOT NULL REFERENCES users(qq),
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  time_schedule TEXT NOT NULL,
  scheduled_date TEXT NOT NULL,
  time_period TEXT NOT NULL CHECK (time_period IN ('早','中','晚')),
  image_key TEXT,
  banner_color TEXT NOT NULL DEFAULT '#D62828',
  max_players INTEGER NOT NULL CHECK (max_players BETWEEN 1 AND 12),
  deleted_at TEXT,
  created_at TEXT NOT NULL
);

INSERT INTO campaigns(
  id,gm_qq,title,rule,summary,description,time_schedule,scheduled_date,time_period,
  image_key,banner_color,max_players,deleted_at,created_at
)
SELECT
  id,gm_qq,title,rule,summary,description,time_schedule,
  CASE
    WHEN scheduled_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' THEN scheduled_date
    WHEN time_schedule GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]*' THEN substr(time_schedule, 1, 10)
    ELSE '1970-01-01'
  END,
  CASE
    WHEN time_period IN ('早','中','晚') THEN time_period
    WHEN substr(trim(time_schedule), -1, 1) IN ('早','中','晚') THEN substr(trim(time_schedule), -1, 1)
    ELSE '晚'
  END,
  image_key,banner_color,max_players,deleted_at,created_at
FROM campaigns_legacy;

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
INSERT INTO bot_outbox SELECT * FROM bot_outbox_legacy;

CREATE TABLE campaign_memberships (
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_qq TEXT NOT NULL REFERENCES users(qq),
  joined_at TEXT NOT NULL,
  gm_rewarded_at TEXT,
  PRIMARY KEY (campaign_id, user_qq)
);
INSERT INTO campaign_memberships SELECT * FROM campaign_memberships_legacy;

CREATE TABLE praises (
  id TEXT PRIMARY KEY,
  from_qq TEXT NOT NULL REFERENCES users(qq),
  to_qq TEXT NOT NULL REFERENCES users(qq),
  type TEXT NOT NULL CHECK (type IN ('gm','player')),
  created_at TEXT NOT NULL,
  campaign_id TEXT REFERENCES campaigns(id),
  CHECK (from_qq <> to_qq)
);
INSERT INTO praises SELECT * FROM praises_legacy;

DROP TABLE bot_outbox_legacy;
DROP TABLE campaign_memberships_legacy;
DROP TABLE praises_legacy;
DROP TABLE campaigns_legacy;

CREATE INDEX campaigns_public ON campaigns(deleted_at, scheduled_date, created_at DESC);
CREATE INDEX bot_outbox_ready ON bot_outbox(status, lease_until, created_at);
CREATE INDEX campaign_memberships_user ON campaign_memberships(user_qq, joined_at DESC);
CREATE INDEX praises_from_time ON praises(from_qq, created_at DESC);
CREATE INDEX praises_to_time ON praises(to_qq, created_at DESC);
CREATE INDEX praises_campaign ON praises(campaign_id, created_at DESC);
