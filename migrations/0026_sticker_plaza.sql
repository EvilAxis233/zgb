-- 贴纸广场：其他会员公开展示自己的贴纸库，会员可以把别人的贴纸「加入我的库存」。
-- 只复制图片引用，不复制文件、不改动原作者库存、不自动默认佩戴。
CREATE TABLE IF NOT EXISTS sticker_copies (
  image_key TEXT PRIMARY KEY,
  copy_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT
);

-- 站主/管理员下架违规贴纸：只影响广场展示与后续加入，已发团上引用的图片不受影响。
CREATE TABLE IF NOT EXISTS sticker_blocks (
  image_key TEXT PRIMARY KEY,
  blocked_by TEXT NOT NULL,
  created_at TEXT NOT NULL
);
