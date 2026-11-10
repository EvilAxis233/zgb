-- 爱心资源：三个分页（规则书 / 模组或世设 / 工具书），每条资源归属一个分页。
-- 存量数据默认进「规则书」，上传者可在「我的分享」里编辑调整。
ALTER TABLE rule_resources ADD COLUMN category TEXT NOT NULL DEFAULT 'rulebook';
CREATE INDEX IF NOT EXISTS idx_rule_resources_category ON rule_resources(category);
