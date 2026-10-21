CREATE TABLE submissions (
  id TEXT PRIMARY KEY,
  user_qq TEXT NOT NULL REFERENCES users(qq),
  type TEXT NOT NULL CHECK (type IN ('feedback','report')),
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','resolved','rejected')),
  admin_note TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  resolved_at TEXT
);

CREATE TABLE submission_images (
  id TEXT PRIMARY KEY,
  submission_id TEXT NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  image_key TEXT NOT NULL UNIQUE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX submissions_queue ON submissions(type, status, created_at DESC);
CREATE INDEX submissions_user ON submissions(user_qq, created_at DESC);
CREATE INDEX submission_images_submission ON submission_images(submission_id, sort_order);
