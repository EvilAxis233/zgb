ALTER TABLE users ADD COLUMN membership_expires_at INTEGER;

CREATE TABLE membership_redemptions (
  key_hash TEXT PRIMARY KEY,
  key_code TEXT NOT NULL,
  user_qq TEXT NOT NULL REFERENCES users(qq),
  redeemed_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > 0)
);
CREATE INDEX membership_redemptions_user_time ON membership_redemptions(user_qq, redeemed_at DESC);
