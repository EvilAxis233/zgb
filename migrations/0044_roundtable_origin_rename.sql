-- GM圆桌主题来源标签文案调整：第三方 → 第三方授权，国内原创 → 民间创作
-- 历史主题与待审申请都要同步，否则旧值在新表单里没有选中态。
UPDATE roundtable_topics SET origin = '第三方授权' WHERE origin = '第三方';
UPDATE roundtable_topics SET origin = '民间创作' WHERE origin = '国内原创';
UPDATE roundtable_applies SET origin = '第三方授权' WHERE origin = '第三方';
UPDATE roundtable_applies SET origin = '民间创作' WHERE origin = '国内原创';
