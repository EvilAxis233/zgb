-- 每日活跃回访：注册用户在香港时区每天的活跃记录，同一用户每天只存一行。
-- 由登录心跳（auth）在心跳真正更新时埋点，供数据看板按天统计活跃回访数与注册占比。
CREATE TABLE IF NOT EXISTS daily_active (
  day TEXT NOT NULL,
  qq TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (day, qq)
);
CREATE INDEX IF NOT EXISTS idx_daily_active_day ON daily_active(day);
