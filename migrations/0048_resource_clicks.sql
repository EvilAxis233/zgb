-- 爱心资源：累计点击（打开链接）次数。每次点击标题外链 +1，不做用户去重。
ALTER TABLE rule_resources ADD COLUMN clicks INTEGER NOT NULL DEFAULT 0;
