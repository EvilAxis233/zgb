-- 赞助会员 Key：后台批量生成（或导入）→ 复制到爱发电「自动随机回复」→ 粉丝在赞助会员弹窗激活。
-- key_norm 是大写且去掉连字符/空格后的规范形式，作为主键防重复、避免大小写与连字符造成激活失败。
CREATE TABLE IF NOT EXISTS membership_keys (
  key_norm TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  months INTEGER NOT NULL CHECK (months > 0),
  days INTEGER NOT NULL CHECK (days > 0),
  batch TEXT NOT NULL,
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  redeemed_by TEXT,
  redeemed_at TEXT,
  expires_at INTEGER,
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_membership_keys_status ON membership_keys(redeemed_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_keys_user ON membership_keys(redeemed_by, redeemed_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_keys_batch ON membership_keys(batch, created_at DESC);

-- 站点可配置项：爱发电主页链接等，后台「内容配置」可改，无需发版。
CREATE TABLE IF NOT EXISTS site_settings (
  setting_key TEXT PRIMARY KEY,
  setting_value TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
