PRAGMA defer_foreign_keys = ON;

DROP TABLE participations;

CREATE TABLE campaigns_next (
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

INSERT INTO campaigns_next(
  id,gm_qq,title,rule,summary,description,time_schedule,scheduled_date,time_period,
  image_key,banner_color,max_players,deleted_at,created_at
)
SELECT
  id,gm_qq,title,rule,summary,description,time_schedule,
  COALESCE(scheduled_date, substr(time_schedule, 1, 10)),
  COALESCE(time_period, substr(trim(time_schedule), -1, 1)),
  image_key,banner_color,max_players,deleted_at,created_at
FROM campaigns;

DROP TABLE campaigns;
ALTER TABLE campaigns_next RENAME TO campaigns;
CREATE INDEX campaigns_public ON campaigns(deleted_at, scheduled_date, created_at DESC);
