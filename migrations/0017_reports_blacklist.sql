ALTER TABLE submissions ADD COLUMN reported_qq TEXT REFERENCES users(qq);
CREATE INDEX submissions_reported_user ON submissions(reported_qq, type);

CREATE TABLE user_blacklist (
  qq TEXT PRIMARY KEY REFERENCES users(qq),
  banned_at TEXT NOT NULL,
  expires_at INTEGER,
  lifted_at TEXT
);
