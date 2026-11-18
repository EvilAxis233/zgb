-- 结团点赞重复清理 + 唯一约束
-- 背景：旧版点赞没有去重，同一人在同一团里可对同一成员重复点赞，每次都扣券并给对方加获赞数。
-- 本迁移先按盘点结果返还多扣的点赞券、扣回多记的获赞数，再删掉多余记录，最后加唯一索引，
-- 之后 /praise 接口会把「再次点击」当作取消赞（返还券、扣回获赞数、删除记录）。

-- 1) 返还多扣的玩家点赞券：1622929837 在「飞吧！向着遥远的天空」给 4 人各点了 3 次（每人多 2 次 = 8 张），
--    775268884 给 3224069281 点了 2 次（多 1 次 = 1 张）。
UPDATE users SET player_hearts = player_hearts + 8 WHERE qq = '1622929837';
UPDATE users SET player_hearts = player_hearts + 1 WHERE qq = '775268884';

-- 2) 扣回多记的获赞数（保留每人最早的那 1 次）：
--    1789542336 多 2、3224069281 多 3（1622929837 多 2 + 775268884 多 1）、630457139 多 2、775268884 多 2。
UPDATE users SET received_player = MAX(0, received_player - 2) WHERE qq = '1789542336';
UPDATE users SET received_player = MAX(0, received_player - 3) WHERE qq = '3224069281';
UPDATE users SET received_player = MAX(0, received_player - 2) WHERE qq = '630457139';
UPDATE users SET received_player = MAX(0, received_player - 2) WHERE qq = '775268884';

-- 3) 删除同一团、同一发送者、同一接收者的多余点赞（按时间保留最早一条）。
DELETE FROM praises WHERE EXISTS (
  SELECT 1 FROM praises p2
  WHERE p2.campaign_id = praises.campaign_id
    AND p2.from_qq = praises.from_qq
    AND p2.to_qq = praises.to_qq
    AND (p2.created_at < praises.created_at OR (p2.created_at = praises.created_at AND p2.id < praises.id))
);

-- 4) 数据库层兜底：一个团里一个人只能给同一对象留一条点赞记录。
CREATE UNIQUE INDEX IF NOT EXISTS praises_campaign_from_to ON praises(campaign_id, from_qq, to_qq);
