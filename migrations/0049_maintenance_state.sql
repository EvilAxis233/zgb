-- 0049：维护任务状态表。记录孤儿图片自动清理的上次执行时间，
-- 让「请求触发 + 节流」的每周清理能跨 Worker 实例可靠运行（Pages Functions 无原生 cron）。
CREATE TABLE IF NOT EXISTS maintenance_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
