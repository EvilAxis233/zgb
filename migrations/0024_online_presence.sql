-- 实时在线人数：记录每个登录会话最后一次活跃时间。
-- 旧会话的 last_seen_at 为 NULL，直到该会话再次发起请求才会被计入在线。
ALTER TABLE sessions ADD COLUMN last_seen_at INTEGER;
CREATE INDEX IF NOT EXISTS sessions_last_seen_at ON sessions(last_seen_at);
