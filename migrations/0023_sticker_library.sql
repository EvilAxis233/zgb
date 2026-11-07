-- 贴纸库：每个会员可预存最多 10 张，其中 2 张设为默认；发团时可临时改选（只影响该团）
ALTER TABLE users ADD COLUMN sticker_library TEXT;
ALTER TABLE campaigns ADD COLUMN sticker_override TEXT;
-- 已有佩戴贴纸并入贴纸库，避免升级后丢失
UPDATE users SET sticker_library = stickers WHERE sticker_library IS NULL AND stickers IS NOT NULL AND stickers NOT IN ('', '[]');
