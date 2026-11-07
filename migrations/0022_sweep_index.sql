-- 加速自动关团扫库：每个请求前的 UPDATE 按 deleted_at/closed_at/finished_at/scheduled_date 过滤
CREATE INDEX IF NOT EXISTS campaigns_sweep ON campaigns(deleted_at, closed_at, finished_at, scheduled_date);
