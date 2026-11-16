-- GM圆桌：规则页、主题、回复、开主题申请，前后台共用真实持久化数据。
-- 时间统一用香港时区 nowHK() 生成 'YYYY-MM-DD HH:mm:ss'，与全站口径一致。

CREATE TABLE IF NOT EXISTS roundtable_channels (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS roundtable_topics (
  id TEXT PRIMARY KEY,
  channel_id TEXT NOT NULL,
  title TEXT NOT NULL,
  rule TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  views INTEGER NOT NULL DEFAULT 0,
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_reply_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roundtable_topics_channel ON roundtable_topics(channel_id);

CREATE TABLE IF NOT EXISTS roundtable_replies (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL,
  parent_id TEXT NOT NULL DEFAULT '',
  author TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  images TEXT NOT NULL DEFAULT '[]',
  likes INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_roundtable_replies_topic ON roundtable_replies(topic_id);

CREATE TABLE IF NOT EXISTS roundtable_applies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  rule TEXT NOT NULL DEFAULT '',
  channel_id TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  applicant TEXT NOT NULL,
  created_at TEXT NOT NULL
);
