-- 爱心资源点赞：每个登录用户对每条资源最多点一次，再点一次即取消。
-- 点赞数由 COUNT(*) 现算，不冗余计数，避免并发下计数漂移。
CREATE TABLE IF NOT EXISTS resource_likes (
  resource_id TEXT NOT NULL,
  user_qq TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (resource_id, user_qq)
);
CREATE INDEX IF NOT EXISTS idx_resource_likes_user ON resource_likes(user_qq);
