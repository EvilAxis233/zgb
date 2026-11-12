-- 后台「资源审核」：新分享 / 改过链接的分享需管理员审核通过后才在爱心资源页展示。
-- 存量数据一律视为已通过，避免上线当天已有资源集体消失。
ALTER TABLE rule_resources ADD COLUMN review_status TEXT NOT NULL DEFAULT 'approved'; -- pending / approved / rejected
ALTER TABLE rule_resources ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
ALTER TABLE rule_resources ADD COLUMN reviewed_at TEXT;
ALTER TABLE rule_resources ADD COLUMN reviewed_by TEXT;
CREATE INDEX IF NOT EXISTS idx_rule_resources_review ON rule_resources(review_status, created_at);

-- 后台看板「弃团」统计：团是物理删除的，删除前留一条日志，之后仍可统计与追溯。
-- 宣群历史记录的删除也会写入 kind='promo'，看板只统计网团 / 面团。
CREATE TABLE IF NOT EXISTS campaign_abandons (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  gm_qq TEXT NOT NULL,
  actor_qq TEXT NOT NULL,
  title TEXT NOT NULL,
  kind TEXT NOT NULL,
  rule TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  abandoned_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaign_abandons_at ON campaign_abandons(abandoned_at);
