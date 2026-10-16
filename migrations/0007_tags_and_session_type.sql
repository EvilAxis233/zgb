ALTER TABLE campaigns ADD COLUMN session_type TEXT NOT NULL DEFAULT '语音';
ALTER TABLE campaigns ADD COLUMN preset_tags TEXT NOT NULL DEFAULT '[]';
ALTER TABLE campaigns ADD COLUMN custom_tags TEXT NOT NULL DEFAULT '[]';

CREATE TABLE preset_tags (
  name TEXT PRIMARY KEY,
  created_at TEXT NOT NULL
);

INSERT INTO preset_tags(name, created_at) VALUES
  ('新手友好', datetime('now')),
  ('进阶挑战', datetime('now')),
  ('短团/单次', datetime('now')),
  ('长线战役', datetime('now')),
  ('重角色扮演', datetime('now')),
  ('重战斗规则', datetime('now'));

CREATE TABLE custom_tags (
  name TEXT PRIMARY KEY,
  use_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX custom_tags_rank ON custom_tags(use_count DESC, last_used_at DESC);
