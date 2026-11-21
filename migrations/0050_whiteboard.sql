-- 联机白板：房间 + 画布元素（整幅 JSON）+ 聊天/骰子消息。
-- 画布用 version 号做增量检测，前端轮询比对，无需 WebSocket。
CREATE TABLE IF NOT EXISTS table_rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_qq TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_active_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_table_rooms_active ON table_rooms(last_active_at);

CREATE TABLE IF NOT EXISTS table_scenes (
  room_id TEXT PRIMARY KEY,
  elements TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS table_messages (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  user_qq TEXT NOT NULL,
  author TEXT NOT NULL,
  author_avatar TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'chat',
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_table_messages_room ON table_messages(room_id, created_at);
