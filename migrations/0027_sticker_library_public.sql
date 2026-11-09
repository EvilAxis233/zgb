-- 会员可自行决定「我的贴纸」库存是否公开到贴纸广场。
-- 默认 1 = 公开，保持功能上线时的原有行为；设为 0 后其他会员的广场里不再出现该会员的贴纸。
-- 只影响广场展示与后续加入，已发团引用的贴纸、自己已加入的库存都不受影响。
ALTER TABLE users ADD COLUMN sticker_library_public INTEGER NOT NULL DEFAULT 1;
