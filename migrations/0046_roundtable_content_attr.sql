-- GM圆桌主题「内容属性」：单选必填（冒险/世设/扩展资料/杂志/自填），作为 tag 展示。
-- 历史主题/申请留空，编辑时会补选。
ALTER TABLE roundtable_topics ADD COLUMN content_attr TEXT NOT NULL DEFAULT '';
ALTER TABLE roundtable_applies ADD COLUMN content_attr TEXT NOT NULL DEFAULT '';
