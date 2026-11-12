-- 0034：弃团记录保留策略（默认保留 30 天，可手动「保留记录」）
ALTER TABLE campaigns ADD COLUMN is_kept INTEGER NOT NULL DEFAULT 0;

-- 存量弃团默认标记为「已保留」，避免上线即被 30 天自动清理规则误删；
-- 新产生的弃团从 is_kept=0 起算，满 30 天且未被保留则自动软删除。
UPDATE campaigns SET is_kept = 1
WHERE id IN (
  SELECT c.id FROM campaigns c
  WHERE c.deleted_at IS NULL AND c.kind IN ('online','offline')
    AND c.is_abandoned = 1
);
