-- 玩家报名/取消报名后给主持人发送邮件通知。
-- 默认收件地址是登录用的 <QQ>@qq.com；主持人可在个人档案里改成其它邮箱或关闭通知。
ALTER TABLE users ADD COLUMN notify_email TEXT;
ALTER TABLE users ADD COLUMN signup_notify_enabled INTEGER NOT NULL DEFAULT 1;

-- 发送结果留痕，方便站长在 GM 反馈「没收到」时排查；不存邮件正文，只记收件地址与状态。
CREATE TABLE signup_mail_log (
  id TEXT PRIMARY KEY,
  campaign_id TEXT NOT NULL,
  gm_qq TEXT NOT NULL,
  player_qq TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('signup','cancel')),
  recipient TEXT NOT NULL,
  subject TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('sent','failed','skipped','disabled')),
  error TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX signup_mail_log_time ON signup_mail_log(created_at DESC);
CREATE INDEX signup_mail_log_campaign ON signup_mail_log(campaign_id, created_at DESC);
