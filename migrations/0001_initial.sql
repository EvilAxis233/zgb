CREATE TABLE users (
  qq TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  bio TEXT NOT NULL DEFAULT '',
  preferences TEXT NOT NULL DEFAULT '[]',
  taboos TEXT NOT NULL DEFAULT '[]',
  gm_hearts INTEGER NOT NULL DEFAULT 0 CHECK (gm_hearts >= 0),
  player_hearts INTEGER NOT NULL DEFAULT 0 CHECK (player_hearts >= 0),
  received_gm INTEGER NOT NULL DEFAULT 0 CHECK (received_gm >= 0),
  received_player INTEGER NOT NULL DEFAULT 0 CHECK (received_player >= 0),
  last_checkin TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE login_codes (
  qq TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  sent_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE login_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  qq TEXT NOT NULL,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX login_requests_qq_time ON login_requests(qq, created_at);
CREATE INDEX login_requests_ip_time ON login_requests(ip, created_at);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  qq TEXT NOT NULL REFERENCES users(qq),
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX sessions_qq ON sessions(qq);

CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  gm_qq TEXT NOT NULL REFERENCES users(qq),
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  time_schedule TEXT NOT NULL,
  image_key TEXT,
  banner_color TEXT NOT NULL DEFAULT '#D62828',
  status TEXT NOT NULL DEFAULT 'recruiting' CHECK (status IN ('recruiting','full','closed','concluded')),
  max_players INTEGER NOT NULL CHECK (max_players BETWEEN 1 AND 12),
  voucher_code TEXT UNIQUE,
  voucher_limit INTEGER,
  voucher_used INTEGER NOT NULL DEFAULT 0,
  deleted_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX campaigns_public ON campaigns(deleted_at, created_at DESC);

CREATE TABLE participations (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL REFERENCES campaigns(id),
  user_qq TEXT NOT NULL REFERENCES users(qq),
  redeemed_at TEXT NOT NULL,
  UNIQUE(campaign_id, user_qq)
);
CREATE INDEX participations_user ON participations(user_qq, redeemed_at DESC);

CREATE TABLE praises (
  id TEXT PRIMARY KEY,
  from_qq TEXT NOT NULL REFERENCES users(qq),
  to_qq TEXT NOT NULL REFERENCES users(qq),
  type TEXT NOT NULL CHECK (type IN ('gm','player')),
  created_at TEXT NOT NULL,
  CHECK (from_qq <> to_qq)
);
