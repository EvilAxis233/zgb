-- 后台「客服系统」未读红点：按板块记录最后一次查看时间，之后产生的新内容即视为未读。
CREATE TABLE IF NOT EXISTS admin_read_marks (
  section TEXT PRIMARY KEY,
  read_at TEXT NOT NULL
);
