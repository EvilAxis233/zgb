-- 网团 / 面团 / 宣群发布时可引用站内爱心资源，详情弹窗「简介」行右侧展示。
-- 与 GM 圆桌主题一致：只存 id / 名称 / 链接 JSON 数组，最多 8 条。
ALTER TABLE campaigns ADD COLUMN resource_refs TEXT NOT NULL DEFAULT '[]';
