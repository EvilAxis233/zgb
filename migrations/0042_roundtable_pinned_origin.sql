-- GM圆桌增强2：规则页置顶讨论贴、主题来源标签（官方/第三方/国内原创）、原模组所属规则版本。
ALTER TABLE roundtable_topics ADD COLUMN is_pinned INTEGER NOT NULL DEFAULT 0;
ALTER TABLE roundtable_topics ADD COLUMN origin TEXT NOT NULL DEFAULT '';
ALTER TABLE roundtable_topics ADD COLUMN rule_version TEXT NOT NULL DEFAULT '';

ALTER TABLE roundtable_applies ADD COLUMN origin TEXT NOT NULL DEFAULT '';
ALTER TABLE roundtable_applies ADD COLUMN rule_version TEXT NOT NULL DEFAULT '';
