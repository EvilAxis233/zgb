-- 爱心资源：玩家分享小众规则的下载地址 / 在线查询地址（网盘、Wiki 或其他）。
-- 昵称不冗余存表，展示时 JOIN users 取当前昵称；上传者本人可改可删，站主 / 管理员也可处置违规链接。
CREATE TABLE IF NOT EXISTS rule_resources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'pan' CHECK (type IN ('pan', 'wiki', 'other')),
  note TEXT NOT NULL DEFAULT '',
  uploader_qq TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rule_resources_name ON rule_resources(name);
CREATE INDEX IF NOT EXISTS idx_rule_resources_uploader ON rule_resources(uploader_qq);
