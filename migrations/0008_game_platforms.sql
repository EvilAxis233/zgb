ALTER TABLE campaigns ADD COLUMN platforms TEXT NOT NULL DEFAULT '[]';
UPDATE campaigns SET session_type='其他游戏形式' WHERE session_type='留言板';
