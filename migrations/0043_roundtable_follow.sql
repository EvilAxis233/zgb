-- GM圆桌：收藏 + 我的回复（参与关注）
-- kind='fav' 收藏主题；kind='reply' 我在该主题发过回复（自动写入，用于「我的回复」）
-- last_seen_at 记录我上次查看该主题的时间，用于算「有新回复 / 收藏有更新」的未读数。
CREATE TABLE IF NOT EXISTS roundtable_follows (
  user_qq TEXT NOT NULL,
  topic_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (user_qq, topic_id, kind)
);
CREATE INDEX IF NOT EXISTS idx_rt_follows_user ON roundtable_follows(user_qq);
CREATE INDEX IF NOT EXISTS idx_rt_follows_topic ON roundtable_follows(topic_id, kind);
