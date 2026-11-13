-- 网站浏览统计：每次页面浏览写一行，visitor 区分「注册用户」与「游客（未登录）」。
-- day 用香港时区 YYYY-MM-DD，看板的今日/本月/近 7 天都按这个字段聚合，避免跨时区错位。
CREATE TABLE IF NOT EXISTS page_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  day TEXT NOT NULL,
  visitor TEXT NOT NULL,
  path TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_page_views_day ON page_views(day);
