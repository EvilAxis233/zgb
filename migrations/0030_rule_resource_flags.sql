-- 爱心资源：来源标签（转载 / 自译 / 机翻），可多选，逗号分隔的英文 key。
-- 空串表示未勾选任何标签；展示在卡片「网盘下载」类型标签左边。
ALTER TABLE rule_resources ADD COLUMN flags TEXT NOT NULL DEFAULT '';
