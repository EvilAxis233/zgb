-- GM圆桌增强：回复作者头像/铭牌/编辑时间；主题与申请可引用站内爱心资源。
ALTER TABLE roundtable_replies ADD COLUMN user_qq TEXT NOT NULL DEFAULT '';
ALTER TABLE roundtable_replies ADD COLUMN avatar_key TEXT NOT NULL DEFAULT '';
ALTER TABLE roundtable_replies ADD COLUMN nameplate TEXT NOT NULL DEFAULT '';
ALTER TABLE roundtable_replies ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

ALTER TABLE roundtable_topics ADD COLUMN resources TEXT NOT NULL DEFAULT '[]';
ALTER TABLE roundtable_applies ADD COLUMN resources TEXT NOT NULL DEFAULT '[]';
