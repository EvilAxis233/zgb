CREATE TABLE rules (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

INSERT INTO rules(name, created_at) VALUES
  ('Call of Cthulhu 7th', datetime('now')),
  ('D&D 5th Edition', datetime('now')),
  ('Cyberpunk RED / 赛博朋克', datetime('now')),
  ('Pathfinder 2e', datetime('now')),
  ('密林剧团 / 日系微恐', datetime('now')),
  ('无限流 / 跑投团', datetime('now')),
  ('剑世界 2.5', datetime('now')),
  ('其他原创规则', datetime('now'));

INSERT OR IGNORE INTO rules(name, created_at)
SELECT DISTINCT rule, datetime('now') FROM campaigns WHERE trim(rule) <> '';

CREATE TABLE admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE admin_login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ip TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX admin_login_attempts_ip_time ON admin_login_attempts(ip, created_at);

CREATE INDEX praises_from_time ON praises(from_qq, created_at DESC);
CREATE INDEX praises_to_time ON praises(to_qq, created_at DESC);
