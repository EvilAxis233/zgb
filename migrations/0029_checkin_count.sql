-- 统一签到计数：所有身份共用一个「累计签到次数」，断签不清零、切换会员身份也不清零。
-- 每累计满 7 次发一次 GM 点赞券；会员 3 张、普通用户 1 张。
ALTER TABLE users ADD COLUMN checkin_count INTEGER NOT NULL DEFAULT 0 CHECK (checkin_count >= 0);

-- 存量没有签到流水，取三者最大值，尽量保住用户已攒的进度：
--   checkin_streak       连续签到天数（旧规则，断签会归 1）
--   member_checkin_count 旧「仅会员签到」累计次数（中断不清零）
--   player_hearts        每日签到 +1 的玩家点赞券余额；截至本次迁移全站无点赞消耗，可近似累计签到次数
UPDATE users SET checkin_count = MAX(COALESCE(checkin_streak, 0), COALESCE(member_checkin_count, 0), COALESCE(player_hearts, 0));
