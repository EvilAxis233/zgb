-- 0033：0 人报名封车视为弃团 + 猪猪客服对话
-- 1) 给 campaigns 增加 is_abandoned 标记：0 人报名即封车的团（网团/面团）直接视为弃团。
ALTER TABLE campaigns ADD COLUMN is_abandoned INTEGER NOT NULL DEFAULT 0;

-- 回填：历史上已封车（未结团）且 0 人报名的团标记为弃团。
UPDATE campaigns SET is_abandoned = 1
WHERE id IN (
  SELECT c.id FROM campaigns c
  WHERE c.deleted_at IS NULL AND c.kind IN ('online','offline')
    AND c.closed_at IS NOT NULL AND c.finished_at IS NULL
    AND (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id = c.id) = 0
);

-- 2) 猪猪客服对话表：用户与站务的私信记录，按 user_qq 串联每个用户的会话。
CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  user_qq TEXT NOT NULL,
  from_role TEXT NOT NULL,        -- 'user' 玩家 / 'admin' 站务
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  read_at TEXT                    -- 站务侧已读标记（打开会话时写入）
);
CREATE INDEX idx_chat_user ON chat_messages(user_qq, created_at);
