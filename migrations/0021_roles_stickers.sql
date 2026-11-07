-- 角色体系：'owner' 站长 / 'admin' 管理员 / NULL 普通用户
ALTER TABLE users ADD COLUMN role TEXT;

-- 会员贴纸：最多 2 张图片的 key 数组（JSON 字符串）
ALTER TABLE users ADD COLUMN stickers TEXT NOT NULL DEFAULT '[]';

-- 规则标签最近使用时间：规则库只保留最近使用的 10 个
ALTER TABLE rules ADD COLUMN last_used_at TEXT;
UPDATE rules SET last_used_at = created_at WHERE last_used_at IS NULL;

-- 会员发放记录（替代已下线的密钥兑换记录）
CREATE TABLE membership_grants (
  id TEXT PRIMARY KEY,
  user_qq TEXT NOT NULL REFERENCES users(qq),
  months INTEGER NOT NULL CHECK (months > 0),
  days INTEGER NOT NULL CHECK (days > 0),
  granted_by TEXT NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > 0),
  created_at TEXT NOT NULL
);
CREATE INDEX membership_grants_user ON membership_grants(user_qq, created_at DESC);

-- 站长与既有管理员
UPDATE users SET role = 'owner' WHERE qq = '407457008';
UPDATE users SET role = 'admin' WHERE qq = '3486636827' AND role IS NULL;
