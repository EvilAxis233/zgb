CREATE TABLE campaign_batches (
  id TEXT PRIMARY KEY,
  gm_qq TEXT NOT NULL REFERENCES users(qq),
  title TEXT NOT NULL,
  rule TEXT NOT NULL,
  summary TEXT NOT NULL,
  description TEXT NOT NULL,
  image_key TEXT,
  banner_color TEXT NOT NULL,
  max_players INTEGER NOT NULL,
  contact TEXT NOT NULL,
  session_type TEXT NOT NULL,
  platforms TEXT NOT NULL,
  preset_tags TEXT NOT NULL,
  custom_tags TEXT NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO campaign_batches (
  id, gm_qq, title, rule, summary, description, image_key,
  banner_color, max_players, contact, session_type, platforms,
  preset_tags, custom_tags, created_at
)
SELECT
  c.batch_id, c.gm_qq, c.title, c.rule, c.summary, c.description, c.image_key,
  c.banner_color, c.max_players, c.contact, c.session_type, c.platforms,
  c.preset_tags, c.custom_tags, c.created_at
FROM campaigns c
WHERE c.batch_id IS NOT NULL AND c.id = c.batch_id;
