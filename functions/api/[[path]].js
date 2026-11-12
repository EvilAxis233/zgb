const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status = 400) => json({ error: message }, status);
const OWNER_QQS = new Set(['407457008']);
const PERMANENT_MEMBERSHIP = 253402300799;
const RULE_LIMIT = 10;
const RULE_MAX_LENGTH = 20;
const now = () => Math.floor(Date.now() / 1000);
// 角色：站长（owner）可任命管理员；管理员可进后台但不自动获得会员。
const roleOf = (user) => {
  if (!user) return null;
  if (OWNER_QQS.has(user.qq) || user.role === 'owner') return 'owner';
  if (user.role === 'admin') return 'admin';
  return null;
};
const isSiteAdmin = (user) => !!roleOf(user);
const isOwner = (user) => roleOf(user) === 'owner';
const isMember = (user) => !!user && (roleOf(user) === 'owner' || (user.membership_expires_at ?? 0) > now());
// 标签宽度：中文/全角按 2，半角英文按 1，最多 12（＝6 个汉字或 12 个英文字符）。
const TAG_MAX_WIDTH = 12;
const tagWidth = (value) => Array.from(String(value)).reduce((total, ch) => total + (/^[\x00-\x7F]$/.test(ch) ? 1 : 2), 0);
const clampTag = (value) => {
  let out = '', width = 0;
  for (const ch of String(value).trim()) {
    const w = /^[\x00-\x7F]$/.test(ch) ? 1 : 2;
    if (width + w > TAG_MAX_WIDTH) break;
    out += ch; width += w;
  }
  return out;
};
const campaignTags = (c) => [...new Set([...parseTags(c.custom_tags), ...parseTags(c.preset_tags)].map(clampTag).filter(Boolean))].slice(0, 6);
const dateHK = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
const id = () => crypto.randomUUID();
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256(value) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
async function botAuth(request, secret) {
  if (!secret) return false;
  const authorization = request.headers.get('Authorization') || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token || token.length > 512) return false;
  const [actual, expected] = await Promise.all([sha256(token), sha256(secret)]);
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return difference === 0;
}
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}
const qqValid = (v) => typeof v === 'string' && /^[1-9][0-9]{4,11}$/.test(v);
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const nicknameLength = (value) => Array.from(value).reduce((total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2), 0);
const parseTags = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
const parseJsonSafe = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const assetUrl = (key) => key ? `/api/images/${key}` : '';
// 动态图（GIF/APNG/动画 WebP）必须原样直传：canvas 裁剪只会留下第一帧。
// 放宽直传体积，并在浏览器没给出 MIME 时按扩展名兜底，避免把 .gif 判成非法文件。
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
const UPLOAD_TYPES = new Set(['image/png','image/jpeg','image/gif','image/webp']);
const EXT_UPLOAD_TYPE = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp' };
const uploadTypeOf = (file) => {
  const provided = String(file.type || '').toLowerCase();
  if (UPLOAD_TYPES.has(provided)) return provided;
  const ext = String(file.name || '').split('.').pop()?.toLowerCase() || '';
  return EXT_UPLOAD_TYPE[ext] || '';
};
// 规则库只保留最近使用的 RULE_LIMIT 个，保证后台与发车下拉完全一致。
async function touchRule(db, name, iso) {
  await db.prepare('INSERT INTO rules(name,created_at,last_used_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET last_used_at=excluded.last_used_at').bind(name, iso, iso).run();
  await db.prepare('DELETE FROM rules WHERE name NOT IN (SELECT name FROM rules ORDER BY last_used_at DESC, rowid DESC LIMIT ?)').bind(RULE_LIMIT).run();
}
const userDto = (u) => {
  const role = roleOf(u);
  const permanent = role === 'owner' || u.membership_expires_at === PERMANENT_MEMBERSHIP;
  return { id: u.qq, qq: u.qq, name: u.name, avatar: assetUrl(u.avatar_key), bio: u.bio, preferences: parseTags(u.preferences), taboos: parseTags(u.taboos), receivedGmPraises: u.received_gm, receivedPlayerPraises: u.received_player, inventory: { gmHearts: u.gm_hearts, playerHearts: u.player_hearts }, lastCheckInDate: u.last_checkin || '', role, isAdmin: !!role, isOwner: role === 'owner', membershipPermanent: permanent, membershipExpiresAt: permanent ? PERMANENT_MEMBERSHIP : u.membership_expires_at ?? null, nameplate: parseJsonSafe(u.nameplate), stickers: parseTags(u.stickers).map((key) => assetUrl(key)).filter(Boolean), stickerKeys: parseTags(u.stickers), stickerLibrary: parseTags(u.sticker_library).map((key) => assetUrl(key)).filter(Boolean), stickerLibraryKeys: parseTags(u.sticker_library), stickerLibraryPublic: u.sticker_library_public !== 0, notifyEmail: u.notify_email || '', signupNotifyEnabled: u.signup_notify_enabled !== 0 };
};
// 通知邮箱属于隐私，公开用户列表里不带出这两个字段。
const publicUserDto = (u) => { const { notifyEmail, signupNotifyEnabled, ...rest } = userDto(u); return { ...rest, role: null, isAdmin: false, isOwner: false, inventory: { gmHearts: 0, playerHearts: 0 }, lastCheckInDate: '', membershipExpiresAt: null, membershipPermanent: false, stickerKeys: [], stickerLibrary: [], stickerLibraryKeys: [] }; };
const campaignExpired = (c) => (c.scheduled_date || String(c.time_schedule || '').slice(0, 10)) < dateHK();
const campDto = (c, signedUp = false, canSeeContact = false) => {
  const currentPlayers = Number(c.member_count || 0);
  return { id: c.id, kind: c.kind || 'online', province: c.province || '', city: c.city || '', address: c.address || '', batchId: c.batch_id || null, title: c.title, rule: c.rule, sessionType: c.kind === 'offline' ? '' : c.session_type === '留言板' ? '其他游戏形式' : c.session_type || '语音', platforms: parseTags(c.platforms), presetTags: [], customTags: campaignTags(c), summary: c.summary || '', description: c.description, timeSchedule: c.time_schedule, imageUrl: assetUrl(c.image_key), imageKey: c.image_key, bannerColor: c.banner_color, maxPlayers: c.max_players, currentPlayers, isClosed: !!c.closed_at, isFull: c.kind !== 'promo' && currentPlayers >= c.max_players, hasEnded: !!c.finished_at, hasExpired: campaignExpired(c), isSignedUp: signedUp, gmId: c.gm_qq, gmName: c.gm_name, gmAvatar: assetUrl(c.gm_avatar_key), gmQq: c.gm_qq, gmPraises: Number(c.gm_received_praises ?? c.received_gm ?? 0), gmNameplate: parseJsonSafe(c.gm_nameplate), gmStickers: parseTags(c.sticker_override || c.gm_stickers).map((key) => assetUrl(key)).filter(Boolean), stickerKeys: parseTags(c.sticker_override || c.gm_stickers), gmIsMember: c.gm_role === 'owner' || Number(c.gm_membership_expires_at ?? 0) > now(), contact: canSeeContact ? (c.contact || c.gm_qq) : undefined, createdAt: c.created_at.slice(0, 10) };
};
// 编辑团时补充贴纸：可来自个人贴纸库，也可以是发车/编辑时现场上传裁剪的图。
// 与封面图同口径：key 格式合法且文件真实存在于 R2 即可；null 表示恢复默认佩戴。
async function resolveStickerOverride(db, env, editor, gmQq, input) {
  if (input === null) return { value: null };
  if (!Array.isArray(input) || input.length > 2) return { error: '最多可以佩戴 2 张贴纸' };
  const keys = [...new Set(input.map((item) => clean(item, 120)).filter(Boolean))];
  if (keys.length !== input.length) return { error: '贴纸不能重复' };
  for (const key of keys) {
    if (!/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) return { error: '贴纸文件无效' };
    if (!await env.COVERS?.head(key)) return { error: '贴纸文件不存在，请重新上传' };
  }
  return { value: keys.length ? JSON.stringify(keys) : null };
}
const slotDto = (c, joined) => ({ id: c.id, timeSchedule: c.time_schedule, currentPlayers: Number(c.member_count || 0), maxPlayers: c.max_players, isClosed: !!c.closed_at, isFull: c.kind !== 'promo' && Number(c.member_count || 0) >= c.max_players, hasEnded: !!c.finished_at, hasExpired: campaignExpired(c), isSignedUp: joined.has(c.id) });
const batchMasterDto = (b) => ({ id: b.id, kind: b.kind || 'online', province: b.province || '', city: b.city || '', address: b.address || '', title: b.title, rule: b.rule, sessionType: b.session_type, platforms: parseTags(b.platforms), presetTags: [], customTags: campaignTags(b), maxPlayers: b.max_players, contact: b.contact, description: b.description, imageUrl: assetUrl(b.image_key), bannerColor: b.banner_color });
function campaignsDto(rows, joined = new Set(), viewer = null, batchMasters = new Map()) {
  const groups = new Map();
  for (const c of rows) if (c.batch_id) groups.set(c.batch_id, [...(groups.get(c.batch_id) || []), c]);
  return rows.map((c) => ({ ...campDto(c, joined.has(c.id), (c.kind === 'promo' && !!viewer) || viewer === c.gm_qq || joined.has(c.id)), ...(c.batch_id ? { slots: groups.get(c.batch_id).map((slot) => slotDto(slot, joined)).sort((a, b) => a.timeSchedule.localeCompare(b.timeSchedule)) } : {}), ...(viewer === c.gm_qq && batchMasters.has(c.batch_id) ? { batchMaster: batchMasterDto(batchMasters.get(c.batch_id)) } : {}) }));
}
const memberDto = (u, role) => ({ id: u.qq, qq: u.qq, name: u.name, avatar: assetUrl(u.avatar_key), role, receivedPraises: role === 'gm' ? u.received_gm : u.received_player, nameplate: parseJsonSafe(u.nameplate), stickers: parseTags(u.stickers).map((key) => assetUrl(key)).filter(Boolean), isMember: isMember(u), bio: u.bio, preferences: parseTags(u.preferences), taboos: parseTags(u.taboos) });
// 爱心资源：只存规则名 + 自填链接，昵称展示时 JOIN users 取当前值，不下发上传者 QQ。
const RESOURCE_TYPES = new Set(['pan', 'wiki', 'other']);
const RESOURCE_CATEGORIES = new Set(['rulebook', 'module', 'tool', 'fun']); // 规则书 / 模组或世设 / 实用工具 / 趣味书籍
const RESOURCE_CATEGORY_DEFAULT = 'rulebook';
const RESOURCE_FLAGS = new Set(['zh', 'en', 'ja', 'other_lang', 'reprint', 'self', 'machine']); // 中文 / 英文 / 日文 / 其它语言 / 转载 / 自译 / 机翻
const RESOURCE_LANG_FLAGS = new Set(['zh', 'en', 'ja', 'other_lang']); // 语言标签：必选，四选一
const RESOURCE_FLAG_ORDER = ['zh', 'en', 'ja', 'other_lang', 'reprint', 'self', 'machine'];
// 备注限 30 个中文字符（60 个英文字符）：按中文 1、ASCII 0.5 加权计算，上限 30。
const RESOURCE_NOTE_WEIGHT = 30;
const resourceNoteWeight = (s) => [...String(s || '')].reduce((n, ch) => n + (/[\u0000-\u007F]/.test(ch) ? 0.5 : 1), 0);
const parseResourceFlags = (s) => {
  // 旧标签 en_other（英文或其它）已拆分，历史数据统一按「英文」展示。
  const picked = new Set(String(s || '').split(',').map((v) => v.trim()).map((v) => (v === 'en_other' ? 'en' : v)).filter((v) => RESOURCE_FLAGS.has(v)));
  const langs = [...picked].filter((v) => RESOURCE_LANG_FLAGS.has(v));
  if (langs.length > 1) langs.slice(1).forEach((v) => picked.delete(v)); // 语言互斥，只保留先出现的
  return RESOURCE_FLAG_ORDER.filter((v) => picked.has(v)); // 固定顺序：语言在前、来源在后
};
const resourceSelect = 'SELECT r.*, u.name uploader_name, u.avatar_key uploader_avatar_key FROM rule_resources r LEFT JOIN users u ON u.qq=r.uploader_qq';
const RESOURCE_REVIEW_STATUSES = new Set(['pending', 'approved', 'rejected']);
const resourceReviewStatus = (r) => RESOURCE_REVIEW_STATUSES.has(r.review_status) ? r.review_status : 'approved';
const resourceDto = (r, viewerQq, admin) => ({
  id: r.id, name: r.name, url: r.url, type: r.type, note: r.note || '',
  category: RESOURCE_CATEGORIES.has(r.category) ? r.category : RESOURCE_CATEGORY_DEFAULT,
  flags: parseResourceFlags(r.flags),
  uploaderName: r.uploader_name || '未命名', uploaderAvatar: assetUrl(r.uploader_avatar_key),
  reviewStatus: resourceReviewStatus(r), reviewNote: r.review_note || '',
  createdAt: (r.created_at || '').slice(0, 10), updatedAt: (r.updated_at || '').slice(0, 10),
  mine: !!viewerQq && viewerQq === r.uploader_qq,
  canManage: (!!viewerQq && viewerQq === r.uploader_qq) || !!admin,
});
// 后台审核列表专用：管理员可以看到上传者 QQ、审核人与完整时间，不下发给普通访客。
const adminResourceDto = (r) => ({
  ...resourceDto(r, null, true),
  uploaderQq: r.uploader_qq,
  createdAtFull: r.created_at || '', updatedAtFull: r.updated_at || '',
  reviewedAt: r.reviewed_at || null, reviewedBy: r.reviewed_by || null,
});
const resourceInput = (b, base = {}) => {
  const name = b.name === undefined ? (base.name || '') : clean(b.name, 60);
  const link = b.url === undefined ? (base.url || '') : clean(b.url, 500);
  const type = b.type === undefined ? (base.type || 'other') : b.type;
  const category = b.category === undefined ? (base.category || RESOURCE_CATEGORY_DEFAULT) : b.category;
  const note = b.note === undefined ? (base.note || '') : clean(b.note, 200);
  const rawFlags = b.flags === undefined ? (base.flags || '') : (Array.isArray(b.flags) ? b.flags.join(',') : '');
  const flags = parseResourceFlags(rawFlags).join(',');
  if (!name) return { error: '请填写规则名字' };
  if (resourceNoteWeight(note) > RESOURCE_NOTE_WEIGHT) return { error: '备注最多 30 个中文字符（60 个英文字符）' };
  // 链接由玩家自行填写，不再强制 http/https 前缀；只拦截可执行脚本协议，避免 XSS。
  if (!link) return { error: '请填写链接地址' };
  if (/^\s*(javascript|data|vbscript|file)\s*:/i.test(link)) return { error: '链接地址无效' };
  if (!RESOURCE_TYPES.has(type)) return { error: '地址类型无效' };
  if (!RESOURCE_CATEGORIES.has(category)) return { error: '所属分页无效' };
  // 新建必须选语言；更新时只要带了标签，也必须保留一项语言。旧数据不带标签的更新不强制。
  if ((b.flags !== undefined || !base.id) && !flags.split(',').some((v) => RESOURCE_LANG_FLAGS.has(v))) {
    return { error: '请选择语言标签：中文 / 英文 / 日文 / 其它语言' };
  }
  return { name, url: link, type, note, flags, category };
};
// 贴纸广场数据源：只取有效会员（站主或未到期会员）、未被拉黑、排除自己、且本人已勾选「公开贴纸库存」；
// 每张图片必须格式合法且未被站主下架。广场不下发任何 QQ 号，会员分组只用匿名序号标识。
const plazaKeyOk = (key, blocked) => /^[A-Za-z0-9._/-]+$/.test(key) && !key.includes('..') && !blocked.has(key);
async function plazaSource(db, viewerQq) {
  const [users, blocks, copies] = await db.batch([
    db.prepare(`SELECT u.* FROM users u WHERE u.qq<>? AND COALESCE(u.sticker_library_public,1)<>0 AND NOT EXISTS (SELECT 1 FROM user_blacklist b WHERE b.qq=u.qq AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>?))`).bind(viewerQq, now()),
    db.prepare('SELECT image_key FROM sticker_blocks'),
    db.prepare('SELECT image_key,copy_count FROM sticker_copies')
  ]);
  const blocked = new Set(blocks.results.map((row) => row.image_key));
  const counts = new Map(copies.results.map((row) => [row.image_key, Number(row.copy_count || 0)]));
  const members = users.results
    .filter((u) => isMember(u))
    .map((u) => ({ user: u, keys: [...new Set(parseTags(u.sticker_library))].filter((key) => plazaKeyOk(key, blocked)) }))
    .filter((item) => item.keys.length);
  return { members, blocked, counts };
}
const plazaMemberDto = (item, counts, index) => ({
  id: `m${index}`,
  name: item.user.name || '未命名',
  avatar: assetUrl(item.user.avatar_key),
  createdAt: item.user.created_at || '',
  count: item.keys.length,
  stickers: item.keys.map((key) => ({ key, copies: Number(counts.get(key) || 0) }))
});
async function body(request) { try { return await request.json(); } catch { throw new Error('无效的 JSON 请求'); } }
function sessionCookie(token, age) { return `zgb_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
function adminCookie(token, age) { return `zgb_admin=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
// 后台只认 QQ 登录 + 角色（owner/admin）；旧的密码应急通道已下线。
const adminAuth = async (request, db) => isSiteAdmin(await auth(request, db));
async function auth(request, db) {
  const token = /(?:^|;\s*)zgb_session=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (!token) return null;
  const hash = await sha256(token), t = now();
  const user = await db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.qq=s.qq WHERE s.token_hash=? AND s.expires_at>?').bind(hash, t).first();
  if (user) {
    // 在线心跳：同一会话每 60 秒最多写一次，未满足条件时 SQLite 不会产生写入。
    await db.prepare('UPDATE sessions SET last_seen_at=? WHERE token_hash=? AND (last_seen_at IS NULL OR last_seen_at<?)').bind(t, hash, t - 60).run();
  }
  return user;
}
async function sendCode(env, qq, code) {
  if (!env.RESEND_API_KEY) return { ok: false, reason: 'missing_key' };
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM || '诸告板 <zgb@pigbee.fun>', to: `${qq}@qq.com`, subject: '诸告板登录验证码', text: `验证码：${code}\n十分钟内有效。如非本人操作，请忽略此邮件。` }) });
  if (response.ok) return { ok: true };
  const error = await response.json().catch(() => ({}));
  return { ok: false, status: response.status, reason: typeof error.name === 'string' ? error.name.slice(0, 80) : 'unknown' };
}

// === SIGNUP_MAIL_TEMPLATE_START ===
// 报名通知邮件的唯一真源：线上发送与本地预览（scripts/gen-signup-mail-preview.mjs）都调用这个函数。
// 全部内联样式 + table 布局，兼容 QQ 邮箱与手机客户端；不加载任何外部字体、图片或脚本。
const mailEsc = (value) => String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
function buildSignupMail(d) {
  // 只在「玩家报名成功」时发信；取消报名不通知（站主确认）。
  const accent = '#D62828';
  const title = String(d.title || '未命名团');
  const subject = `【诸告板】新玩家报名 · ${title.replace(/<[^>]*>/g, '').replace(/[\r\n]+/g, ' ').slice(0, 30)}`;
  const remaining = Math.max(0, Number(d.maxPlayers) - Number(d.currentPlayers));
  const countNote = remaining === 0 ? '已经满员，可以准备封车了' : `还差 ${remaining} 人满员`;
  const rows = [
    ['团名', title],
    ['规则', d.rule || '—'],
    ['形式', d.modeLine || '—'],
    ['开团时间', d.timeSchedule || '—'],
    ...(d.location ? [['地点', d.location]] : []),
  ];
  const infoRows = rows.map(([label, value]) => `<tr>
    <td style="padding:7px 0;font-size:13px;color:#777;font-weight:bold;width:76px;vertical-align:top;white-space:nowrap;">${mailEsc(label)}</td>
    <td style="padding:7px 0;font-size:13px;color:#121212;font-weight:bold;word-break:break-all;">${mailEsc(value)}</td>
  </tr>`).join('');
  const playerRows = [
    ['玩家昵称', d.playerName || '—'],
    ['玩家 QQ', d.playerQq || '—'],
    ['时间', d.happenedAt || '—'],
  ].map(([label, value]) => `<tr>
    <td style="padding:6px 0;font-size:13px;color:#555;font-weight:bold;width:76px;vertical-align:top;white-space:nowrap;">${mailEsc(label)}</td>
    <td style="padding:6px 0;font-size:13px;color:#121212;font-weight:bold;word-break:break-all;">${mailEsc(value)}</td>
  </tr>`).join('');
  const headline = '有新玩家报名了';
  const lead = `你发布的团「${mailEsc(title)}」刚刚收到一位新玩家。`;
  const actionNote = '请尽快通过 QQ 联系玩家确认，也可以在「团务管理 → 查看」里看到完整的成员名单和玩家 QQ 号。';
  const html = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${mailEsc(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F3EE;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F3EE;"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#FFFFFF;border:2px solid #121212;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <tr><td style="background:#121212;padding:18px 26px;">
    <span style="color:#FFFFFF;font-size:20px;font-weight:900;letter-spacing:2px;">诸告板</span>
    <span style="color:#F4A261;font-size:11px;font-weight:bold;letter-spacing:1px;">&nbsp;&nbsp;PIGBEE.FUN</span>
    <span style="float:right;color:#9A9A9A;font-size:11px;font-weight:bold;line-height:26px;">报名通知</span>
  </td></tr>
  <tr><td style="height:6px;line-height:6px;font-size:0;background:${accent};">&nbsp;</td></tr>
  <tr><td style="padding:28px 26px 10px 26px;">
    <div style="display:inline-block;background:${accent};color:#FFFFFF;font-size:11px;font-weight:900;padding:5px 10px;letter-spacing:1px;">NEW PLAYER COMING</div>
    <div style="margin-top:14px;font-size:23px;line-height:1.35;font-weight:900;color:#121212;">${headline}</div>
    <div style="margin-top:8px;font-size:13px;line-height:1.7;color:#666666;">${lead}</div>
  </td></tr>
  <tr><td style="padding:14px 26px 0 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F6F5F0;border-left:4px solid #121212;"><tr><td style="padding:14px 16px;">
      <div style="font-size:11px;font-weight:900;color:#121212;letter-spacing:1px;margin-bottom:6px;">团次信息</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${infoRows}</table>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:12px 26px 0 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F0F5FA;border-left:4px solid #004E98;"><tr><td style="padding:14px 16px;">
      <div style="font-size:11px;font-weight:900;color:#004E98;letter-spacing:1px;margin-bottom:6px;">本次报名玩家</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${playerRows}</table>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:16px 26px 0 26px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border:2px solid #121212;"><tr>
      <td width="96" align="center" style="padding:12px 6px;background:#121212;"><span style="color:#FFFFFF;font-size:22px;font-weight:900;">${mailEsc(d.currentPlayers)}<span style="color:#9A9A9A;font-size:14px;">/${mailEsc(d.maxPlayers)}</span></span></td>
      <td style="padding:12px 14px;"><div style="font-size:13px;font-weight:900;color:#121212;">当前报名人数</div><div style="font-size:12px;color:#666666;margin-top:3px;">${mailEsc(countNote)}</div></td>
    </tr></table>
  </td></tr>
  <tr><td align="center" style="padding:24px 26px 6px 26px;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#004E98" style="border:2px solid #121212;">
      <a href="${mailEsc(d.manageUrl)}" target="_blank" style="display:inline-block;padding:13px 30px;color:#FFFFFF;font-size:14px;font-weight:900;text-decoration:none;letter-spacing:1px;">查看团务管理 &rarr;</a>
    </td></tr></table>
  </td></tr>
  <tr><td style="padding:10px 26px 26px 26px;">
    <div style="font-size:12px;line-height:1.8;color:#666666;">${mailEsc(actionNote)}</div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid #E4E2DB;font-size:11px;line-height:1.8;color:#999999;">本邮件由诸告板系统自动发送，请勿直接回复。<br>不想再收到此类通知，可在「个人档案 → 报名邮件通知」中关闭。</div>
  </td></tr>
  <tr><td style="background:#121212;padding:14px 26px;color:#9A9A9A;font-size:11px;line-height:1.6;">诸告板 · pigbee.fun&nbsp;&nbsp;|&nbsp;&nbsp;${mailEsc(d.happenedAt)}</td></tr>
</table>
<div style="max-width:600px;margin:14px auto 0 auto;padding:0 6px;font-size:11px;line-height:1.7;color:#9A9A9A;">如果按钮无法打开，请复制此链接到浏览器：${mailEsc(d.manageUrl)}</div>
</td></tr></table>
</body></html>`;
  const text = [
    '【诸告板】新玩家报名通知',
    '',
    `${d.gmName || '主持人'} 你好：`,
    `你发布的团「${title}」刚刚收到一位新玩家报名。`,
    '',
    ...rows.map(([label, value]) => `${label}：${value}`),
    '',
    `玩家昵称：${d.playerName || '—'}`,
    `玩家 QQ：${d.playerQq || '—'}`,
    `时间：${d.happenedAt || '—'}`,
    `当前报名人数：${d.currentPlayers}/${d.maxPlayers}（${countNote}）`,
    '',
    actionNote,
    `团务管理：${d.manageUrl}`,
    '',
    '本邮件由系统自动发送，请勿直接回复。可在「个人档案 → 报名邮件通知」中关闭。',
  ].join('\n');
  return { subject, html, text };
}
// === SIGNUP_MAIL_TEMPLATE_END ===

// 报名成功后异步发信（取消报名不通知）：整段放进 waitUntil，不占用报名接口的响应时间；任何失败都不影响报名结果。
const MAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const hkStamp = (iso) => {
  const value = new Intl.DateTimeFormat('zh-CN', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  return value;
};
async function writeSignupMailLog(db, entry) {
  await db.prepare('INSERT INTO signup_mail_log(id,campaign_id,gm_qq,player_qq,event_type,recipient,subject,status,error,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    .bind(entry.id, entry.campaignId, entry.gmQq, entry.playerQq, entry.event, entry.recipient, entry.subject, entry.status, entry.error || null, entry.createdAt).run();
}
function queueSignupMail(context, { campaign, actor, siteUrl }) {
  const { env } = context;
  const db = env.DB;
  const createdAt = new Date().toISOString();
  const logId = id();
  const task = (async () => {
    const gm = await db.prepare('SELECT qq,name,notify_email,signup_notify_enabled FROM users WHERE qq=?').bind(campaign.gm_qq).first();
    if (!gm) return;
    const recipient = MAIL_RE.test(String(gm.notify_email || '')) ? String(gm.notify_email).trim() : `${gm.qq}@qq.com`;
    const count = await db.prepare('SELECT COUNT(*) n FROM campaign_memberships WHERE campaign_id=?').bind(campaign.id).first();
    const platforms = parseTags(campaign.platforms);
    const modeLine = campaign.kind === 'offline'
      ? `面团 · ${[campaign.province, campaign.city].filter(Boolean).join(' ')}`
      : `网团 · ${campaign.session_type || '语音'}${platforms.length ? ' · ' + platforms.join('、') : ''}`;
    const location = campaign.kind === 'offline' ? [campaign.province, campaign.city, campaign.address].filter(Boolean).join(' ') : '';
    const mail = buildSignupMail({
      gmName: gm.name,
      playerName: actor.name,
      playerQq: actor.qq,
      title: campaign.title,
      rule: campaign.rule,
      timeSchedule: campaign.time_schedule,
      modeLine,
      location,
      currentPlayers: Number(count?.n ?? 0),
      maxPlayers: campaign.max_players,
      happenedAt: hkStamp(createdAt),
      manageUrl: `${siteUrl}/?view=manage`,
    });
    const base = { id: logId, campaignId: campaign.id, gmQq: gm.qq, playerQq: actor.qq, event: 'signup', recipient, subject: mail.subject, createdAt };
    if (gm.signup_notify_enabled === 0) return void await writeSignupMailLog(db, { ...base, status: 'skipped' });
    if (!env.RESEND_API_KEY) return void await writeSignupMailLog(db, { ...base, status: 'disabled' });
    let status = 'sent', error = '';
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.RESEND_FROM || '诸告板 <zgb@pigbee.fun>', to: recipient, subject: mail.subject, html: mail.html, text: mail.text }),
      });
      if (!response.ok) {
        status = 'failed';
        const detail = await response.json().catch(() => ({}));
        error = `${response.status}:${typeof detail.name === 'string' ? detail.name.slice(0, 80) : 'unknown'}`;
      }
    } catch (e) {
      status = 'failed';
      error = String(e?.message || e).slice(0, 120);
    }
    await writeSignupMailLog(db, { ...base, status, error });
  })().catch((e) => console.error('signup mail task failed', e));
  if (typeof context.waitUntil === 'function') context.waitUntil(task);
  else task.catch(() => {});
}
function validateCampaign(b, fixedKind = null, requireLocation = true) {
  const kind = fixedKind || (['online', 'offline', 'promo'].includes(b.kind) ? b.kind : 'online');
  const title = clean(b.title, 100), rule = clean(b.rule, 100), summary = clean(b.summary, 300) || '', time = clean(b.timeSchedule, 200), contact = clean(b.contact, 200);
  const players = kind === 'promo' ? 1 : Number(b.maxPlayers);
  const matched = /^(\d{4}-\d{2}-\d{2}).*(早|中|晚)$/.exec(time);
  if (!title || !rule || !matched) throw new Error(kind === 'promo' ? '请填写完整宣群标题、规则和日期时段' : '请填写完整团名、规则和日期时段');
  if (nicknameLength(rule) > RULE_MAX_LENGTH) throw new Error('规则系统最多 10 个中文字符或 20 个英文字符');
  if (!Number.isInteger(players) || players < 1 || players > 12) throw new Error('请填写 1–12 人的预计人数');
  const sessionType = kind === 'promo' ? clean(b.sessionType, 40) : kind === 'offline' ? '' : ['语音', '文字', '其他游戏形式'].includes(b.sessionType) ? b.sessionType : '语音';
  const platforms = kind === 'promo' ? (Array.isArray(b.platforms) ? b.platforms.map((item) => clean(item, 80)).filter(Boolean).slice(0, 1) : []) : kind === 'offline' ? [] : Array.isArray(b.platforms) ? [...new Set(b.platforms.filter((item) => ['QQ', 'Kook', 'Oopz', '枭熊', 'Fvtt', '菠萝', 'excalidraw', '其它'].includes(item)))].slice(0, 8) : [];
  const province = kind === 'offline' ? clean(b.province, 40) : '';
  const city = kind === 'offline' ? clean(b.city, 40) : '';
  const address = kind === 'offline' ? clean(b.address, 200) : '';
  if (kind === 'offline' && requireLocation && (!(province || city) || Array.from(province + city).length > 8)) throw new Error('请填写省份和城市，合计最多八个字');
  if (kind === 'promo' && (!sessionType || !platforms.length)) throw new Error('请填写宣群方式和平台');
  // 宣群平台自填最多 10 个中文字符（英文按半宽，可 20 个）；后端同样校验，防止绕过前端。
  if (kind === 'promo' && platforms.some((item) => nicknameLength(item) > 20)) throw new Error('宣群平台最多 10 个中文字符或 20 个英文字符');
  const presetTags = [];
  if (!Array.isArray(b.customTags ?? [])) throw new Error('自定义标签格式无效');
  const customTags = [...new Set((b.customTags || []).map((tag) => typeof tag === 'string' ? tag.trim() : '').filter(Boolean))];
  if (customTags.length > 6 || customTags.some((tag) => tagWidth(tag) > TAG_MAX_WIDTH)) throw new Error('最多 6 个自定义标签，每个最多 6 个中文字符或 12 个英文字符');
  return { kind, title, rule, sessionType, platforms, province, city, address, presetTags, customTags, summary, contact, time, scheduledDate: matched[1], period: matched[2], players, description: clean(b.description, 10000), color: /^#[0-9a-fA-F]{6}$/.test(b.bannerColor) ? b.bannerColor : '#D62828' };
}
function validateNewSlot(raw, unrestricted = false) {
  const time = clean(raw, 100);
  const matched = /^(\d{4}-\d{2}-\d{2})（星期[一二三四五六日]）(早|中|晚)$/.exec(time);
  if (!matched) throw new Error('请填写有效的开团日期和时段');
  const date = matched[1];
  const parsed = new Date(`${date}T00:00:00+08:00`);
  const actualDate = Number.isNaN(parsed.getTime()) ? '' : new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(parsed);
  const latest = new Date(`${dateHK()}T00:00:00+08:00`);
  latest.setUTCDate(latest.getUTCDate() + 31);
  const latestDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(latest);
  if (actualDate !== date || date < dateHK() || (!unrestricted && date > latestDate)) throw new Error('请填写有效的开团日期和时段');
  return { time, date, period: matched[2] };
}
const campaignSelect = `SELECT c.*,u.name gm_name,u.avatar_key gm_avatar_key,u.received_gm gm_received_praises,u.nameplate gm_nameplate,u.stickers gm_stickers,u.role gm_role,u.membership_expires_at gm_membership_expires_at,(SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=c.id) member_count FROM campaigns c JOIN users u ON u.qq=c.gm_qq WHERE c.deleted_at IS NULL`;
// 每个 Worker 实例内记录上次自动关团时间，实现 60 秒节流。
let lastSweepAt = 0;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method;
  const db = env.DB;
  if (!db) return fail('数据库未配置', 503);
  try {
    if (method !== 'GET' && method !== 'HEAD' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return fail('请求来源无效', 403);
    // 自动关团扫库按实例节流（60 秒一次），避免每个请求都先跑一条 UPDATE 写查询拖慢响应。
    if (Date.now() - lastSweepAt > 60000) {
      lastSweepAt = Date.now();
      await db.prepare(`UPDATE campaigns SET closed_at=?, is_abandoned = CASE WHEN (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)=0 THEN 1 ELSE 0 END WHERE deleted_at IS NULL AND closed_at IS NULL AND finished_at IS NULL AND scheduled_date<?`).bind(new Date().toISOString(), dateHK()).run();
      // 弃团记录默认保留 30 天：超过且未被「保留记录」的自动软删除（仅后台封存不可见，数据仍可恢复）。
      const purgeBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await db.prepare(`UPDATE campaigns SET deleted_at=? WHERE deleted_at IS NULL AND is_abandoned=1 AND is_kept=0 AND closed_at IS NOT NULL AND closed_at < ?`).bind(new Date().toISOString(), purgeBefore).run();
    }
    if (path[0] === 'health' && method === 'GET') { await db.prepare('SELECT 1').first(); return json({ ok: true }); }
    if (path[0] === 'internal' && path[1] === 'bot') {
      if (!env.BOT_BRIDGE_TOKEN) return fail('机器人接口未配置', 503);
      if (!await botAuth(request, env.BOT_BRIDGE_TOKEN)) return fail('未经授权', 401);
      if (path[2] === 'events' && path.length === 3 && method === 'GET') {
        const claimId = id();
        const event = await db.prepare(`UPDATE bot_outbox SET status='leased',claim_id=?,lease_until=?
          WHERE event_id=(SELECT event_id FROM bot_outbox WHERE status='pending' OR (status='leased' AND lease_until<=?) ORDER BY created_at,event_id LIMIT 1)
          AND (status='pending' OR (status='leased' AND lease_until<=?))
          RETURNING event_id,campaign_id,rule,claim_id`).bind(claimId, now() + 120, now(), now()).first();
        const campaign = event ? await db.prepare('SELECT kind FROM campaigns WHERE id=?').bind(event.campaign_id).first() : null;
        return json({ event: event ? { eventId: event.event_id, campaignId: event.campaign_id, kind: campaign?.kind || 'online', rule: event.rule, claimId: event.claim_id } : null });
      }
      if (path[2] === 'events' && path[3] && path[4] === 'ack' && path.length === 5 && method === 'POST') {
        const claimId = (await body(request)).claimId;
        if (typeof claimId !== 'string' || !/^[0-9a-f-]{36}$/.test(claimId)) return fail('确认编号无效');
        const result = await db.prepare(`UPDATE bot_outbox SET status='done',lease_until=NULL,delivered_at=?
          WHERE event_id=? AND claim_id=? AND status='leased'`).bind(new Date().toISOString(), path[3], claimId).run();
        if (result.meta.changes) return json({ ok: true });
        const existing = await db.prepare('SELECT status FROM bot_outbox WHERE event_id=? AND claim_id=?').bind(path[3], claimId).first();
        return existing?.status === 'done' ? json({ ok: true }) : fail('事件不存在或认领已失效', 409);
      }
      return fail('接口不存在', 404);
    }
    if (path[0] === 'images' && method === 'GET' && path[1]) {
      const object = await env.COVERS?.get(path.slice(1).join('/'));
      return object ? new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' } }) : fail('图片不存在', 404);
    }
    if (path[0] === 'admin') {
      if (path[1] === 'me' && method === 'GET') {
        const account = await auth(request, db);
        return json({ authenticated: isSiteAdmin(account), role: roleOf(account), name: account?.name || '' });
      }
      if (path[1] === 'logout' && method === 'POST') {
        const account = await auth(request, db);
        const response = json({ ok: true }, 200, { 'Set-Cookie': adminCookie('', 0) });
        if (isSiteAdmin(account)) {
          const userToken = /(?:^|;\s*)zgb_session=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
          if (userToken) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(userToken)).run();
          response.headers.append('Set-Cookie', sessionCookie('', 0));
        }
        return response;
      }
      if (!await adminAuth(request, db)) return fail('请先登录后台', 401);
      if (path[1] === 'dashboard' && path.length === 2 && method === 'GET') {
        const today = dateHK();
        const sevenDaysAgo = new Date(`${today}T00:00:00+08:00`);
        sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
        const thirtyDaysAgo = new Date(`${today}T00:00:00+08:00`);
        thirtyDaysAgo.setUTCDate(thirtyDaysAgo.getUTCDate() - 29);
        const asDate = (value) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(value);
        const [users, campaigns, engagement, submissions, campaignKinds, topRules, dailyUsers, dailyCampaigns, abandons, pendingResources] = await db.batch([
          db.prepare(`SELECT COUNT(*) total,
            SUM(CASE WHEN substr(created_at,1,10)=? THEN 1 ELSE 0 END) today,
            SUM(CASE WHEN substr(created_at,1,10)>=? THEN 1 ELSE 0 END) last7,
            SUM(CASE WHEN substr(created_at,1,10)>=? THEN 1 ELSE 0 END) last30
            FROM users`).bind(today, asDate(sevenDaysAgo), asDate(thirtyDaysAgo)),
          // 宣群不算开团：全部团次 = 网团 + 面团；报名数与满员率同样排除宣群。
          db.prepare(`SELECT
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind IN ('online','offline') THEN 1 ELSE 0 END),0) total,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind='online' THEN 1 ELSE 0 END),0) online_total,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind='offline' THEN 1 ELSE 0 END),0) offline_total,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind IN ('online','offline') AND finished_at IS NULL AND closed_at IS NULL AND scheduled_date>=? AND (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)<max_players THEN 1 ELSE 0 END),0) recruiting,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind='online' AND finished_at IS NULL AND closed_at IS NULL AND scheduled_date>=? AND (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)<max_players THEN 1 ELSE 0 END),0) online_recruiting,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind='offline' AND finished_at IS NULL AND closed_at IS NULL AND scheduled_date>=? AND (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)<max_players THEN 1 ELSE 0 END),0) offline_recruiting,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind IN ('online','offline') AND finished_at IS NULL AND closed_at IS NOT NULL THEN 1 ELSE 0 END),0) closed,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind='online' AND finished_at IS NULL AND closed_at IS NOT NULL THEN 1 ELSE 0 END),0) online_closed,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind='offline' AND finished_at IS NULL AND closed_at IS NOT NULL THEN 1 ELSE 0 END),0) offline_closed,
            COALESCE(SUM(CASE WHEN deleted_at IS NULL AND kind IN ('online','offline') AND finished_at IS NOT NULL THEN 1 ELSE 0 END),0) finished,
            COALESCE(SUM(CASE WHEN kind IN ('online','offline') AND deleted_at IS NOT NULL THEN 1 ELSE 0 END),0) deleted,
            COALESCE(SUM(CASE WHEN kind='promo' AND deleted_at IS NULL AND closed_at IS NULL AND finished_at IS NULL THEN 1 ELSE 0 END),0) promo_live,
            COALESCE(SUM(CASE WHEN kind='promo' AND (closed_at IS NOT NULL OR finished_at IS NOT NULL) THEN 1 ELSE 0 END),0) promo_history,
            COALESCE(SUM(CASE WHEN kind='promo' THEN 1 ELSE 0 END),0) promo_total,
            COALESCE(SUM(CASE WHEN kind IN ('online','offline') THEN (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id) ELSE 0 END),0) members,
            COALESCE(ROUND(AVG(CASE WHEN deleted_at IS NULL AND kind IN ('online','offline') THEN 100.0*(SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)/max_players END),1),0) avg_fill_rate
            FROM campaigns`).bind(today, today, today),
          db.prepare(`SELECT
            (SELECT COUNT(*) FROM campaign_memberships m JOIN campaigns c ON c.id=m.campaign_id WHERE c.kind IN ('online','offline')) memberships,
            (SELECT COUNT(*) FROM praises) praises,
            (SELECT COUNT(*) FROM praises WHERE type='gm') gm_praises,
            (SELECT COUNT(*) FROM praises WHERE type='player') player_praises,
            (SELECT COUNT(*) FROM sessions WHERE expires_at>?) active_sessions,
            (SELECT COUNT(DISTINCT qq) FROM sessions WHERE expires_at>? AND last_seen_at>?) online_now`)
            .bind(now(), now(), now() - 15 * 60),
          db.prepare(`SELECT COUNT(*) total,
            SUM(CASE WHEN type='feedback' THEN 1 ELSE 0 END) feedback,
            SUM(CASE WHEN type='report' THEN 1 ELSE 0 END) reports,
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,
            SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) processing,
            SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) resolved,
            SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) rejected
            FROM submissions`),
          db.prepare(`SELECT kind,COUNT(*) total,
            SUM(CASE WHEN deleted_at IS NULL THEN 1 ELSE 0 END) alive,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NULL AND closed_at IS NULL AND scheduled_date>=? THEN 1 ELSE 0 END) active,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NULL AND closed_at IS NOT NULL THEN 1 ELSE 0 END) closed,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NOT NULL THEN 1 ELSE 0 END) finished
            FROM campaigns GROUP BY kind ORDER BY total DESC`).bind(today),
          db.prepare(`SELECT rule,COUNT(*) total FROM campaigns WHERE deleted_at IS NULL GROUP BY rule ORDER BY total DESC,rule LIMIT 8`),
          db.prepare(`SELECT substr(created_at,1,10) day,COUNT(*) count FROM users WHERE substr(created_at,1,10)>=? GROUP BY day ORDER BY day`).bind(asDate(thirtyDaysAgo)),
          db.prepare(`SELECT substr(created_at,1,10) day,COUNT(*) count FROM campaigns WHERE kind IN ('online','offline') AND substr(created_at,1,10)>=? GROUP BY day ORDER BY day`).bind(asDate(thirtyDaysAgo)),
          // 弃团 = 0 人报名即封车的团（网团/面团），自本统计上线起累计。
          db.prepare(`SELECT COUNT(*) abandoned FROM campaigns WHERE deleted_at IS NULL AND kind IN ('online','offline') AND is_abandoned=1`),
          db.prepare(`SELECT COUNT(*) pending FROM rule_resources WHERE review_status='pending'`)
        ]);
        return json({
          users: users.results[0],
          campaigns: { ...campaigns.results[0], abandoned: Number(abandons.results[0].abandoned || 0) },
          engagement: engagement.results[0], submissions: submissions.results[0],
          resourceReviews: { pending: Number(pendingResources.results[0].pending || 0) },
          campaignKinds: campaignKinds.results, topRules: topRules.results, dailyUsers: dailyUsers.results, dailyCampaigns: dailyCampaigns.results,
          onlineWindow: 15, generatedAt: new Date().toISOString()
        });
      }
      if (path[1] === 'rules' && path.length === 2) {
        if (method === 'GET') {
          const rows = await db.prepare('SELECT name FROM rules ORDER BY last_used_at DESC, rowid DESC LIMIT ?').bind(RULE_LIMIT).all();
          return json({ rules: rows.results.map((row) => row.name) });
        }
        if (method === 'POST') {
          const name = clean((await body(request)).name, 100);
          if (!name) return fail('请输入规则名');
          if (nicknameLength(name) > RULE_MAX_LENGTH) return fail('规则名最多 10 个中文字符或 20 个英文字符');
          await touchRule(db, name, new Date().toISOString());
          return json({ ok: true }, 201);
        }
        if (method === 'DELETE') {
          const name = clean((await body(request)).name, 100);
          const result = await db.prepare('DELETE FROM rules WHERE name=?').bind(name).run();
          return result.meta.changes ? json({ ok: true }) : fail('规则不存在', 404);
        }
      }
      if (path[1] === 'users' && path.length === 2 && method === 'GET') {
        const search = clean(url.searchParams.get('search'), 40);
        const offset = Math.max(0, Math.min(100000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
        const pattern = `%${search.replace(/[\\%_]/g, '\\$&')}%`;
        const where = "WHERE u.qq LIKE ? ESCAPE '\\' OR u.name LIKE ? ESCAPE '\\'";
        const [count, users, memberCount] = await db.batch([
          db.prepare(`SELECT COUNT(*) n FROM users u ${where}`).bind(pattern, pattern),
          db.prepare(`SELECT u.qq,u.name,u.role,u.created_at,u.gm_hearts,u.player_hearts,u.received_gm,u.received_player,u.membership_expires_at,` +
            `(SELECT COUNT(*) FROM praises p WHERE p.from_qq=u.qq) sent_count,` +
            `(SELECT COUNT(*) FROM praises p WHERE p.to_qq=u.qq) received_count,` +
            `(SELECT COUNT(*) FROM submissions s WHERE s.type='report' AND s.reported_qq=u.qq) report_count,` +
            // 带团/参团只算网团与面团：宣群不算开团，也没有报名记录。
            `(SELECT COUNT(*) FROM campaigns c WHERE c.gm_qq=u.qq AND c.deleted_at IS NULL AND c.kind IN ('online','offline')) hosted_count,` +
            `(SELECT COUNT(*) FROM campaign_memberships m JOIN campaigns c ON c.id=m.campaign_id WHERE m.user_qq=u.qq AND c.deleted_at IS NULL AND c.kind IN ('online','offline')) joined_count,` +
            `b.expires_at blacklist_expires_at,b.banned_at blacklist_banned_at,` +
            `CASE WHEN b.qq IS NOT NULL AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>?) THEN 1 ELSE 0 END blacklisted ` +
            `FROM users u LEFT JOIN user_blacklist b ON b.qq=u.qq ${where} ORDER BY u.created_at DESC LIMIT 100 OFFSET ?`).bind(now(), pattern, pattern, offset),
          db.prepare('SELECT COUNT(*) n FROM users WHERE role=\'owner\' OR membership_expires_at=? OR membership_expires_at>?').bind(PERMANENT_MEMBERSHIP, now())
        ]);
        return json({ users: users.results.map((account) => { const role = roleOf(account); const permanent = role === 'owner' || account.membership_expires_at === PERMANENT_MEMBERSHIP; return { ...account, role, isAdmin: !!role, isOwner: role === 'owner', membershipPermanent: permanent, membership_expires_at: permanent ? PERMANENT_MEMBERSHIP : account.membership_expires_at }; }), total: count.results[0].n, memberTotal: memberCount.results[0].n });
      }
      if (path[1] === 'users' && path[2] && path[3] === 'blacklist' && path.length === 4) {
        const qq = path[2];
        if (!qqValid(qq)) return fail('QQ 号无效');
        if (method === 'POST') {
          const duration = (await body(request)).duration;
          if (!['7d', '30d', '6m', '1y', 'permanent'].includes(duration)) return fail('黑名单期限无效');
          const target = await db.prepare('SELECT 1 FROM users WHERE qq=?').bind(qq).first();
          if (!target) return fail('账号不存在', 404);
          const until = new Date();
          if (duration === '7d') until.setUTCDate(until.getUTCDate() + 7);
          if (duration === '30d') until.setUTCDate(until.getUTCDate() + 30);
          if (duration === '6m') until.setUTCMonth(until.getUTCMonth() + 6);
          if (duration === '1y') until.setUTCFullYear(until.getUTCFullYear() + 1);
          await db.prepare(`INSERT INTO user_blacklist(qq,banned_at,expires_at,lifted_at) VALUES(?,?,?,NULL)
            ON CONFLICT(qq) DO UPDATE SET banned_at=excluded.banned_at,expires_at=excluded.expires_at,lifted_at=NULL`)
            .bind(qq, new Date().toISOString(), duration === 'permanent' ? null : Math.floor(until.getTime() / 1000)).run();
          return json({ ok: true });
        }
        if (method === 'DELETE') {
          const result = await db.prepare('UPDATE user_blacklist SET lifted_at=? WHERE qq=? AND lifted_at IS NULL').bind(new Date().toISOString(), qq).run();
          return result.meta.changes ? json({ ok: true }) : fail('该账号不在黑名单中', 409);
        }
      }
      // 后台按 QQ 发放 N 个月会员：单月按 30 天，12 个月按 365 天。
      if (path[1] === 'users' && path[2] && path[3] === 'membership' && path.length === 4 && method === 'POST') {
        const qq = path[2];
        if (!qqValid(qq)) return fail('QQ 号无效');
        const months = Math.floor(Number((await body(request)).months));
        if (!Number.isInteger(months) || months < 1 || months > 12) return fail('请填写 1–12 个月');
        const operator = await auth(request, db);
        const target = await db.prepare('SELECT qq,role,membership_expires_at FROM users WHERE qq=?').bind(qq).first();
        if (!target) return fail('账号不存在', 404);
        if (target.role === 'owner') return fail('站长本身是永久会员，无需发放', 409);
        const days = months === 12 ? 365 : months * 30;
        const base = Math.max(now(), target.membership_expires_at || 0);
        const expiresAt = base + days * 86400;
        await db.batch([
          db.prepare('UPDATE users SET membership_expires_at=? WHERE qq=?').bind(expiresAt, qq),
          db.prepare('INSERT INTO membership_grants(id,user_qq,months,days,granted_by,expires_at,created_at) VALUES(?,?,?,?,?,?,?)').bind(id(), qq, months, days, operator?.qq || 'admin', expiresAt, new Date().toISOString())
        ]);
        return json({ ok: true, months, days, membershipExpiresAt: expiresAt });
      }
      if (path[1] === 'users' && path[2] && path[3] === 'grants' && path.length === 4 && method === 'GET') {
        const qq = path[2], offset = Math.max(0, Math.min(100000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
        if (!qqValid(qq)) return fail('QQ 号无效');
        const [count, records] = await db.batch([
          db.prepare('SELECT COUNT(*) n FROM membership_grants WHERE user_qq=?').bind(qq),
          db.prepare('SELECT id,months,days,granted_by,expires_at,created_at FROM membership_grants WHERE user_qq=? ORDER BY created_at DESC LIMIT 50 OFFSET ?').bind(qq, offset)
        ]);
        return json({ records: records.results, total: count.results[0].n });
      }
      // 只有站长可以任命或取消后台管理员（管理员不带会员）。
      if (path[1] === 'users' && path[2] && path[3] === 'role' && path.length === 4 && method === 'PATCH') {
        if (!isOwner(await auth(request, db))) return fail('只有站长可以任命管理员', 403);
        const qq = path[2];
        if (!qqValid(qq)) return fail('QQ 号无效');
        const next = (await body(request)).role;
        if (!['admin', ''].includes(next)) return fail('角色无效');
        const target = await db.prepare('SELECT role FROM users WHERE qq=?').bind(qq).first();
        if (!target) return fail('账号不存在', 404);
        if (target.role === 'owner') return fail('不能修改站长角色', 409);
        await db.prepare('UPDATE users SET role=? WHERE qq=?').bind(next || null, qq).run();
        return json({ ok: true, role: next || null });
      }
      if (path[1] === 'submissions' && path.length === 2 && method === 'GET') {
        const type = ['feedback','report'].includes(url.searchParams.get('type')) ? url.searchParams.get('type') : '';
        const rawStatus = url.searchParams.get('status');
        const status = ['pending','processing','resolved','rejected','open','done'].includes(rawStatus) ? rawStatus : '';
        const offset = Math.max(0, Math.min(100000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
        // open = 未处理（待受理 + 处理中），done = 已处理（已解决 + 已驳回）；后台默认只拉 open，done 折叠后再看。
        const statusClause = status === 'open' ? ` AND s.status IN ('pending','processing')` : status === 'done' ? ` AND s.status IN ('resolved','rejected')` : status ? ' AND s.status=?' : '';
        const binds = [type, type, ...(status && status !== 'open' && status !== 'done' ? [status] : [])];
        const where = `WHERE (?='' OR s.type=?)` + statusClause;
        const [count, rows] = await db.batch([
          db.prepare(`SELECT COUNT(*) n FROM submissions s ${where}`).bind(...binds),
          db.prepare(`SELECT s.*,u.name user_name,r.name reported_name FROM submissions s JOIN users u ON u.qq=s.user_qq LEFT JOIN users r ON r.qq=s.reported_qq ${where} ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,s.created_at DESC LIMIT 30 OFFSET ?`).bind(...binds, offset)
        ]);
        const items = await Promise.all(rows.results.map(async (item) => {
          const images = await db.prepare('SELECT image_key FROM submission_images WHERE submission_id=? ORDER BY sort_order,id').bind(item.id).all();
          return { ...item, images: images.results.map((image) => assetUrl(image.image_key)) };
        }));
        return json({ submissions: items, total: count.results[0].n });
      }
      if (path[1] === 'submissions' && path[2] && path.length === 3 && method === 'PATCH') {
        const b = await body(request);
        const status = ['pending','processing','resolved','rejected'].includes(b.status) ? b.status : '';
        const adminNote = clean(b.adminNote, 2000);
        if (!status) return fail('受理状态无效');
        const updatedAt = new Date().toISOString();
        const result = await db.prepare(`UPDATE submissions SET status=?,admin_note=?,updated_at=?,resolved_at=CASE WHEN ? IN ('resolved','rejected') THEN ? ELSE NULL END WHERE id=?`).bind(status, adminNote, updatedAt, status, updatedAt, path[2]).run();
        return result.meta.changes ? json({ ok: true }) : fail('记录不存在', 404);
      }
      // 后台「封存团务」：已封车 / 已结团的网团与面团（宣群「结束宣发」不在此列）。
      if (path[1] === 'archived-campaigns' && path.length === 2 && method === 'GET') {
        const raw = url.searchParams.get('status');
        const status = raw === 'closed' || raw === 'finished' || raw === 'abandoned' ? raw : 'all';
        const offset = Math.max(0, Math.min(100000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
        // 三个筛选互斥：已封车（未结团且非弃团）/ 已结团 / 弃团（0 人报名即封车）。
        const where = `WHERE c.deleted_at IS NULL AND c.kind IN ('online','offline') AND (c.closed_at IS NOT NULL OR c.finished_at IS NOT NULL)`
          + (status === 'closed' ? ' AND c.finished_at IS NULL AND c.is_abandoned=0'
            : status === 'finished' ? ' AND c.finished_at IS NOT NULL'
              : status === 'abandoned' ? ' AND c.is_abandoned=1 AND c.finished_at IS NULL' : '');
        const [count, rows] = await db.batch([
          db.prepare(`SELECT COUNT(*) n FROM campaigns c ${where}`),
          db.prepare(`SELECT c.*,u.name gm_name,(SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=c.id) member_count FROM campaigns c JOIN users u ON u.qq=c.gm_qq ${where} ORDER BY COALESCE(c.finished_at,c.closed_at) DESC,c.id DESC LIMIT 30 OFFSET ?`).bind(offset)
        ]);
        const ids = rows.results.map((row) => row.id);
        const members = ids.length
          ? await db.prepare(`SELECT m.campaign_id,u.qq,u.name FROM campaign_memberships m JOIN users u ON u.qq=m.user_qq WHERE m.campaign_id IN (${ids.map(() => '?').join(',')}) ORDER BY m.joined_at`).bind(...ids).all()
          : null;
        const byId = new Map();
        (members?.results || []).forEach((m) => byId.set(m.campaign_id, [...(byId.get(m.campaign_id) || []), { qq: m.qq, name: m.name }]));
        return json({
          items: rows.results.map((c) => ({
            id: c.id, title: c.title, rule: c.rule, kind: c.kind,
            gmQq: c.gm_qq, gmName: c.gm_name || '未命名',
            timeSchedule: c.time_schedule, scheduledDate: c.scheduled_date, timePeriod: c.time_period,
            maxPlayers: c.max_players, memberCount: Number(c.member_count || 0),
            summary: c.summary || '', description: c.description || '', contact: c.contact || '',
            sessionType: c.session_type || '', platforms: parseTags(c.platforms),
            province: c.province || '', city: c.city || '', address: c.address || '',
            imageUrl: assetUrl(c.image_key),
            status: c.finished_at ? 'finished' : 'closed',
            abandoned: !!c.is_abandoned,
            kept: !!c.is_kept,
            closedAt: c.closed_at || null, finishedAt: c.finished_at || null, createdAt: c.created_at || '',
            members: byId.get(c.id) || []
          })),
          total: count.results[0].n
        });
      }
      // 后台「资源审核」：默认看待审核，通过后才会出现在爱心资源页。
      if (path[1] === 'resources' && path.length === 2 && method === 'GET') {
        const raw = url.searchParams.get('status');
        const status = ['pending', 'approved', 'rejected', 'all'].includes(raw) ? raw : 'pending';
        const offset = Math.max(0, Math.min(100000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
        const clause = status === 'all' ? '' : ` WHERE COALESCE(r.review_status,'approved')='${status}'`;
        const order = ` ORDER BY CASE COALESCE(r.review_status,'approved') WHEN 'pending' THEN 0 WHEN 'rejected' THEN 1 ELSE 2 END,r.created_at DESC,r.id DESC`;
        const [count, rows] = await db.batch([
          db.prepare(`SELECT COUNT(*) n FROM rule_resources r${clause}`),
          db.prepare(`${resourceSelect}${clause}${order} LIMIT 30 OFFSET ?`).bind(offset)
        ]);
        const counts = await db.prepare(`SELECT
          COALESCE(SUM(CASE WHEN review_status='pending' THEN 1 ELSE 0 END),0) pending,
          COALESCE(SUM(CASE WHEN COALESCE(review_status,'approved')='approved' THEN 1 ELSE 0 END),0) approved,
          COALESCE(SUM(CASE WHEN review_status='rejected' THEN 1 ELSE 0 END),0) rejected
          FROM rule_resources`).first();
        return json({ items: rows.results.map(adminResourceDto), total: count.results[0].n, counts });
      }
      if (path[1] === 'resources' && path[2] && path.length === 3 && method === 'PATCH') {
        const b = await body(request);
        const status = ['pending', 'approved', 'rejected'].includes(b.status) ? b.status : '';
        if (!status) return fail('审核状态无效');
        const note = clean(b.note, 200);
        const operator = await auth(request, db);
        const result = await db.prepare('UPDATE rule_resources SET review_status=?,review_note=?,reviewed_at=?,reviewed_by=? WHERE id=?')
          .bind(status, status === 'approved' ? '' : note, new Date().toISOString(), operator?.qq || 'admin', path[2]).run();
        return result.meta.changes ? json({ ok: true }) : fail('资源不存在', 404);
      }
      if (path[1] === 'resources' && path[2] && path.length === 3 && method === 'DELETE') {
        const result = await db.prepare('DELETE FROM rule_resources WHERE id=?').bind(path[2]).run();
        return result.meta.changes ? json({ ok: true }) : fail('资源不存在', 404);
      }
      // 后台「客服系统」→ 猪猪客服对话
      if (path[1] === 'chat' && path.length === 2 && method === 'GET') {
        const rows = await db.prepare(`SELECT m.user_qq, u.name user_name,
          (SELECT content FROM chat_messages lm WHERE lm.user_qq=m.user_qq ORDER BY lm.created_at DESC, lm.id DESC LIMIT 1) last_content,
          (SELECT created_at FROM chat_messages lm WHERE lm.user_qq=m.user_qq ORDER BY lm.created_at DESC, lm.id DESC LIMIT 1) last_at,
          SUM(CASE WHEN m.from_role='user' AND m.read_at IS NULL THEN 1 ELSE 0 END) unread
          FROM chat_messages m JOIN users u ON u.qq=m.user_qq GROUP BY m.user_qq, u.name ORDER BY last_at DESC`).all();
        return json({ conversations: rows.results.map((r) => ({ userQq: r.user_qq, userName: r.user_name || '未命名', lastContent: r.last_content || '', lastAt: r.last_at || '', unread: Number(r.unread || 0) })) });
      }
      if (path[1] === 'chat' && path[2] && path.length === 3 && method === 'GET') {
        const qq = String(path[2]);
        const rows = await db.prepare('SELECT * FROM chat_messages WHERE user_qq=? ORDER BY created_at,id').bind(qq).all();
        await db.prepare("UPDATE chat_messages SET read_at=? WHERE user_qq=? AND from_role='user' AND read_at IS NULL").bind(new Date().toISOString(), qq).run();
        return json({ messages: rows.results.map((m) => ({ id: m.id, fromRole: m.from_role, content: m.content, createdAt: m.created_at })) });
      }
      if (path[1] === 'chat' && path[2] && path[3] === 'reply' && path.length === 4 && method === 'POST') {
        const qq = String(path[2]), b = await body(request);
        const content = clean(String(b?.content || ''), 2000).trim();
        if (!content) return fail('请输入回复内容');
        await db.prepare('INSERT INTO chat_messages(id,user_qq,from_role,content,created_at) VALUES(?,?,?,?,?)').bind(id(), qq, 'admin', content, new Date().toISOString()).run();
        return json({ ok: true });
      }
      if (path[1] === 'chat' && path[2] && path.length === 3 && method === 'DELETE') {
        await db.prepare('DELETE FROM chat_messages WHERE user_qq=?').bind(String(path[2])).run();
        return json({ ok: true });
      }
      return fail('接口不存在', 404);
    }
    // === 猪猪客服：玩家侧对话（需登录）===
    if (path[0] === 'chat') {
      const user = await auth(request, db);
      if (!user) return fail('请先登录后再使用客服', 401);
      if (path[1] === 'send' && path.length === 2 && method === 'POST') {
        const b = await body(request);
        const content = clean(String(b?.content || ''), 2000).trim();
        if (!content) return fail('请输入内容');
        const mid = id(), iso = new Date().toISOString();
        await db.prepare('INSERT INTO chat_messages(id,user_qq,from_role,content,created_at) VALUES(?,?,?,?,?)').bind(mid, user.qq, 'user', content, iso).run();
        return json({ ok: true, message: { id: mid, fromRole: 'user', content, createdAt: iso } });
      }
      if (path[1] === 'thread' && path.length === 2 && method === 'GET') {
        const rows = await db.prepare('SELECT * FROM chat_messages WHERE user_qq=? ORDER BY created_at,id').bind(user.qq).all();
        return json({ messages: rows.results.map((m) => ({ id: m.id, fromRole: m.from_role, content: m.content, createdAt: m.created_at })) });
      }
      if (path[1] === 'thread' && path.length === 2 && method === 'DELETE') {
        await db.prepare('DELETE FROM chat_messages WHERE user_qq=?').bind(user.qq).run();
        return json({ ok: true });
      }
      return fail('接口不存在', 404);
    }
    if (path[0] === 'auth' && path[1] === 'request-code' && method === 'POST') {
      const b = await body(request), qq = String(b.qq || '').trim();
      if (!qqValid(qq)) return fail('请输入有效 QQ 号');
      if (!env.OTP_SECRET) return fail('验证码服务未配置', 503);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown', t = now();
      const recent = await db.prepare('SELECT sent_at FROM login_codes WHERE qq=?').bind(qq).first();
      if (recent && t - recent.sent_at < 60) return fail('请 60 秒后重试', 429);
      const counts = await db.batch([
        db.prepare('SELECT COUNT(*) n FROM login_requests WHERE qq=? AND created_at>?').bind(qq, t - 3600),
        db.prepare('SELECT COUNT(*) n FROM login_requests WHERE ip=? AND created_at>?').bind(ip, t - 3600)
      ]);
      if (counts[0].results[0].n >= 5 || counts[1].results[0].n >= 20) return fail('请求过于频繁，请稍后再试', 429);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
      const hash = await hmac(`${qq}:${code}`, env.OTP_SECRET);
      await db.batch([
        db.prepare('INSERT INTO login_codes(qq,code_hash,expires_at,sent_at,attempts) VALUES(?,?,?,?,0) ON CONFLICT(qq) DO UPDATE SET code_hash=excluded.code_hash,expires_at=excluded.expires_at,sent_at=excluded.sent_at,attempts=0').bind(qq, hash, t + 600, t),
        db.prepare('INSERT INTO login_requests(qq,ip,created_at) VALUES(?,?,?)').bind(qq, ip, t)
      ]);
      const delivery = await sendCode(env, qq, code).catch(() => ({ ok: false, reason: 'network_error' }));
      if (!delivery.ok) { console.error('Resend delivery failed', delivery.status || 0, delivery.reason); await db.prepare('DELETE FROM login_codes WHERE qq=? AND code_hash=?').bind(qq, hash).run(); return fail('邮件发送失败，请稍后重试', 503); }
      return json({ ok: true, message: '验证码已发送至对应 QQ 邮箱' });
    }
    if (path[0] === 'auth' && path[1] === 'verify' && method === 'POST') {
      const b = await body(request), qq = String(b.qq || '').trim(), code = String(b.code || '').trim();
      if (!qqValid(qq) || !/^[0-9]{6}$/.test(code)) return fail('QQ 号或验证码格式错误');
      if (!env.OTP_SECRET) return fail('验证码服务未配置', 503);
      const record = await db.prepare('SELECT * FROM login_codes WHERE qq=?').bind(qq).first();
      if (!record || record.expires_at <= now() || record.attempts >= 5) return fail('验证码已失效，请重新获取', 400);
      if (record.code_hash !== await hmac(`${qq}:${code}`, env.OTP_SECRET)) { await db.prepare('UPDATE login_codes SET attempts=attempts+1 WHERE qq=?').bind(qq).run(); return fail('验证码错误'); }
      const consumed = await db.prepare('DELETE FROM login_codes WHERE qq=? AND code_hash=? AND expires_at>? AND attempts<5').bind(qq, record.code_hash, now()).run();
      if (consumed.meta.changes !== 1) return fail('验证码已使用');
      const name = `PL_${String(crypto.getRandomValues(new Uint32Array(1))[0] % 10000).padStart(4, '0')}`;
      await db.prepare('INSERT OR IGNORE INTO users(qq,name,created_at) VALUES(?,?,?)').bind(qq, name, new Date().toISOString()).run();
      const token = hex(crypto.getRandomValues(new Uint8Array(32)));
      await db.prepare('INSERT INTO sessions(token_hash,qq,expires_at,created_at) VALUES(?,?,?,?)').bind(await sha256(token), qq, now() + 30 * 86400, now()).run();
      const user = await db.prepare('SELECT * FROM users WHERE qq=?').bind(qq).first();
      return json({ user: userDto(user) }, 200, { 'Set-Cookie': sessionCookie(token, 30 * 86400) });
    }
    let user = await auth(request, db);
    if (path[0] === 'auth' && path[1] === 'me' && method === 'GET') return json({ user: user ? userDto(user) : null });
    if (path[0] === 'auth' && path[1] === 'logout' && method === 'POST') {
      const token = /(?:^|;\s*)zgb_session=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }
    if (path[0] === 'campaigns' && path.length === 1 && method === 'GET') {
      const rows = await db.prepare(`${campaignSelect} ORDER BY c.created_at DESC`).all();
      const hosts = await db.prepare('SELECT DISTINCT u.* FROM users u JOIN campaigns c ON c.gm_qq=u.qq WHERE c.deleted_at IS NULL').all();
      const rules = await db.prepare('SELECT name FROM rules ORDER BY last_used_at DESC, rowid DESC LIMIT 10').all();
      const popularCustomTags = await db.prepare('SELECT name FROM custom_tags ORDER BY use_count DESC, last_used_at DESC LIMIT 10').all();
      const campaigns = campaignsDto(rows.results);
      return json({ campaigns: campaigns.filter((c) => !c.hasEnded && !c.isClosed && !c.isFull), users: hosts.results.map(publicUserDto), rules: rules.results.map((row) => row.name), popularCustomTags: popularCustomTags.results.map((row) => row.name) });
    }
    if (path[0] === 'campaigns' && path[1] && path.length === 2 && method === 'GET') {
      const c = await db.prepare(`${campaignSelect} AND c.id=?`).bind(path[1]).first();
      if (!c) return fail('团不存在', 404);
      const membership = user ? await db.prepare('SELECT 1 FROM campaign_memberships WHERE campaign_id=? AND user_qq=?').bind(c.id, user.qq).first() : null;
      const siblings = c.batch_id ? await db.prepare(`${campaignSelect} AND c.batch_id=? ORDER BY c.scheduled_date,c.time_period`).bind(c.batch_id).all() : null;
      const isPublic = !c.finished_at && ((!c.closed_at && (c.kind === 'promo' || Number(c.member_count) < c.max_players)) || !!siblings?.results.some((slot) => !slot.finished_at && !slot.closed_at && (slot.kind === 'promo' || Number(slot.member_count) < slot.max_players)));
      if (!isPublic && (!user || (c.gm_qq !== user.qq && !membership))) return fail('团不存在', 404);
      const players = await db.prepare('SELECT u.* FROM campaign_memberships m JOIN users u ON u.qq=m.user_qq WHERE m.campaign_id=? ORDER BY m.joined_at,u.qq').bind(c.id).all();
      const gm = await db.prepare('SELECT * FROM users WHERE qq=?').bind(c.gm_qq).first();
      const canSeeContact = !!user && (c.kind === 'promo' || c.gm_qq === user.qq || !!membership);
      const joined = new Set();
      if (user && siblings?.results.length) {
        const records = await db.prepare('SELECT campaign_id FROM campaign_memberships WHERE user_qq=? AND campaign_id IN (SELECT id FROM campaigns WHERE batch_id=?)').bind(user.qq, c.batch_id).all();
        records.results.forEach((record) => joined.add(record.campaign_id));
      }
      return json({ campaign: { ...campDto(c, !!membership, canSeeContact), ...(siblings ? { slots: siblings.results.map((slot) => slotDto(slot, joined)) } : {}), members: [memberDto(gm, 'gm'), ...players.results.map((p) => memberDto(p, 'player'))] } });
    }
    // 爱心资源：浏览对所有访客开放，按规则名字模糊检索 + 按分页筛选，不下发上传者 QQ。
    // 不带 cat 时返回全部分页（兼容旧调用）；cat 非法时按全部分页处理。
    if (path[0] === 'resources' && path.length === 1 && method === 'GET') {
      const q = clean(url.searchParams.get('q') || '', 60).replace(/[%_\\]/g, '');
      const cat = url.searchParams.get('cat') || '';
      // 公开列表只展示审核通过的资源；待审核 / 已驳回仍可在「我的分享」里看到。
      const where = [`COALESCE(r.review_status,'approved')='approved'`], binds = [];
      if (q) { where.push('r.name LIKE ?'); binds.push(`%${q}%`); }
      if (RESOURCE_CATEGORIES.has(cat)) { where.push('r.category=?'); binds.push(cat); }
      const clause = ` WHERE ${where.join(' AND ')}`;
      const stmt = db.prepare(`${resourceSelect}${clause} ORDER BY r.created_at DESC, r.id DESC LIMIT 200`);
      const rows = binds.length ? await stmt.bind(...binds).all() : await stmt.all();
      return json({ items: rows.results.map((r) => resourceDto(r, user?.qq, isSiteAdmin(user))) });
    }
    if (!user) return fail('请先登录', 401);
    if (path[0] === 'membership' && path.length === 2 && method === 'GET') {
      return json({ isMember: isMember(user), membershipExpiresAt: roleOf(user) === 'owner' ? PERMANENT_MEMBERSHIP : user.membership_expires_at ?? null, renewalContact: '917744498' });
    }
    if (path[0] === 'submissions' && path.length === 1 && method === 'GET') {
      const offset = Math.max(0, Math.min(100000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
      const [count, rows] = await db.batch([
        db.prepare('SELECT COUNT(*) n FROM submissions WHERE user_qq=?').bind(user.qq),
        db.prepare('SELECT s.id,s.type,s.content,s.status,s.created_at,s.updated_at,s.reported_qq,r.name reported_name FROM submissions s LEFT JOIN users r ON r.qq=s.reported_qq WHERE s.user_qq=? ORDER BY s.created_at DESC,s.id DESC LIMIT 30 OFFSET ?').bind(user.qq, offset)
      ]);
      const submissions = await Promise.all(rows.results.map(async (item) => {
        const images = await db.prepare('SELECT image_key FROM submission_images WHERE submission_id=? ORDER BY sort_order,id').bind(item.id).all();
        return { ...item, images: images.results.map((image) => assetUrl(image.image_key)) };
      }));
      return json({ submissions, total: count.results[0].n });
    }
    if (path[0] === 'submissions' && path.length === 1 && method === 'POST') {
      const form = await request.formData();
      const type = form.get('type');
      const content = clean(form.get('content'), 5000);
      const reportedInput = clean(form.get('reportedUser'), 40);
      const files = form.getAll('images').filter((value) => value instanceof File && value.size > 0);
      if (!['feedback','report'].includes(type)) return fail('提交类型无效');
      if (!content) return fail(type === 'report' ? '请填写举报说明' : '请填写反馈内容');
      if (files.length > 9) return fail('最多上传 9 张图片');
      if (type === 'report' && files.length < 1) return fail('举报至少需要上传 1 张图片');
      if (type === 'report' && !reportedInput) return fail('请填写被举报人的昵称或 QQ 号');
      const reported = type === 'report' ? await db.prepare('SELECT qq FROM users WHERE qq=? OR name=? COLLATE NOCASE ORDER BY CASE WHEN qq=? THEN 0 ELSE 1 END LIMIT 1').bind(reportedInput, reportedInput, reportedInput).first() : null;
      if (type === 'report' && !reported) return fail('被举报账号不存在，请核对昵称或 QQ 号');
      if (reported?.qq === user.qq) return fail('不能举报自己');
      if (files.some((file) => !['image/png','image/jpeg','image/gif','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024)) return fail('图片仅支持 PNG、JPG、GIF、WebP，且每张不超过 5MB');
      if (files.length && !env.COVERS) return fail('图片存储未配置', 503);
      const submissionId = id(), createdAt = new Date().toISOString(), uploaded = [];
      try {
        for (let index = 0; index < files.length; index++) {
          const file = files[index];
          const type = uploadTypeOf(file) || file.type;
          const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
          const key = `submissions/${submissionId}/${index + 1}-${id()}.${ext}`;
          await env.COVERS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
          uploaded.push(key);
        }
        await db.batch([
          db.prepare('INSERT INTO submissions(id,user_qq,reported_qq,type,content,status,admin_note,created_at,updated_at) VALUES(?,?,?,?,?,\'pending\',\'\',?,?)').bind(submissionId, user.qq, reported?.qq || null, type, content, createdAt, createdAt),
          ...uploaded.map((key, index) => db.prepare('INSERT INTO submission_images(id,submission_id,image_key,sort_order,created_at) VALUES(?,?,?,?,?)').bind(id(), submissionId, key, index, createdAt))
        ]);
      } catch (error) {
        await Promise.all(uploaded.map((key) => env.COVERS?.delete(key).catch(() => {})));
        throw error;
      }
      return json({ id: submissionId }, 201);
    }
    if (path[0] === 'bootstrap' && method === 'GET') {
      const [cs, memberships, hosts, rules, popularCustomTags] = await db.batch([
        db.prepare(`${campaignSelect} ORDER BY c.created_at DESC`),
        db.prepare('SELECT campaign_id FROM campaign_memberships WHERE user_qq=?').bind(user.qq),
        db.prepare('SELECT DISTINCT u.* FROM users u JOIN campaigns c ON c.gm_qq=u.qq WHERE c.deleted_at IS NULL'),
        db.prepare('SELECT name FROM rules ORDER BY last_used_at DESC, rowid DESC LIMIT 10'),
        db.prepare('SELECT name FROM custom_tags ORDER BY use_count DESC, last_used_at DESC LIMIT 10')
      ]);
      const joined = new Set(memberships.results.map((m) => m.campaign_id));
      const visible = cs.results.filter((c) => (!c.finished_at && !c.closed_at && (c.kind === 'promo' || Number(c.member_count) < c.max_players)) || c.gm_qq === user.qq || joined.has(c.id));
      const masters = await db.prepare('SELECT * FROM campaign_batches WHERE gm_qq=?').bind(user.qq).all();
      const campaigns = campaignsDto(cs.results, joined, user.qq, new Map(masters.results.map((master) => [master.id, master])));
      return json({ user: userDto(user), users: hosts.results.map(publicUserDto), campaigns: campaigns.filter((c) => visible.some((item) => item.id === c.id)), rules: rules.results.map((row) => row.name), popularCustomTags: popularCustomTags.results.map((row) => row.name) });
    }
    if (path[0] === 'profile' && path.length === 1 && method === 'PATCH') {
      const b = await body(request), name = clean(b.name, 40), bio = clean(b.bio, 100);
      const tags = (v) => Array.isArray(v) ? [...new Set(v.map((x) => clean(x, 40)).filter(Boolean))].slice(0, 20) : [];
      if (!name) return fail('昵称不能为空');
      if (nicknameLength(name) > 20) return fail('昵称最多 10 个中文字符或 20 个英文字符，中文及全角字符按 2 个计算');
      const duplicate = await db.prepare('SELECT 1 FROM users WHERE name=? COLLATE NOCASE AND qq!=?').bind(name, user.qq).first();
      if (duplicate) return fail('该昵称已被使用，请换一个昵称', 409);
      // 报名通知邮箱：留空表示恢复默认的 QQ 邮箱；关闭开关后不再收到新玩家报名邮件。
      const requestedEmail = b.notifyEmail === undefined ? undefined : clean(b.notifyEmail, 120).toLowerCase();
      if (requestedEmail && !MAIL_RE.test(requestedEmail)) return fail('通知邮箱格式不正确');
      const requestedNotify = b.signupNotifyEnabled === undefined ? undefined : (b.signupNotifyEnabled ? 1 : 0);
      const sets = ['name=?', 'bio=?', 'preferences=?', 'taboos=?'];
      const binds = [name, bio, JSON.stringify(tags(b.preferences)), JSON.stringify(tags(b.taboos))];
      if (requestedEmail !== undefined) { sets.push('notify_email=?'); binds.push(requestedEmail); }
      if (requestedNotify !== undefined) { sets.push('signup_notify_enabled=?'); binds.push(requestedNotify); }
      await db.prepare(`UPDATE users SET ${sets.join(',')} WHERE qq=?`).bind(...binds, user.qq).run();
      const updated = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
      return json({ user: userDto(updated) });
    }
    if (path[0] === 'profile' && path[1] === 'nameplate' && method === 'PATCH') {
      const isMemberUser = isMember(user);
      if (!isMemberUser) return fail('只有会员可以使用自定义铭牌功能', 403);
      const b = await body(request);
      if (!b.nameplate) {
        await db.prepare('UPDATE users SET nameplate=NULL WHERE qq=?').bind(user.qq).run();
      } else {
        const allowedStyles = ['nb-s01','nb-s02','nb-s03','nb-s06','nb-s10','nb-s12','nb-s16','nb-s18','nb-d01','nb-d02','nb-d04','nb-d09','nb-d12','nb-d16'];
        const styleId = String(b.nameplate.styleId || '');
        const isReferenceStyle = /^nb-ref-(?:d(?:0[1-9]|[12]\d|30)|s(?:0[1-9]|1\d|20))$/.test(styleId)
          && !['nb-ref-d08', 'nb-ref-d20', 'nb-ref-d26'].includes(styleId);
        const isVipStyle = /^nb-vip-0[1-7]$/.test(styleId);
        if (!allowedStyles.includes(styleId) && !isReferenceStyle && !isVipStyle) return fail('无效的铭牌样式');
        const text = clean(b.nameplate.text, 24);
        if (!text) return fail('铭牌文字不能为空');
        let zh = 0, en = 0;
        for (const ch of text) {
          if (/[\u4e00-\u9fa5]/.test(ch)) zh++;
          else en++;
        }
        // 6 个中文字符（按 2 计）＝ 12，与前端 NameplateModal 的口径一致。
        if (zh > 6 || (zh * 2 + en) > 12) return fail('铭牌最多 6 个汉字或 12 个英文字符');
        await db.prepare('UPDATE users SET nameplate=? WHERE qq=?').bind(JSON.stringify({ styleId, text }), user.qq).run();
      }
      const updated = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
      return json({ user: userDto(updated) });
    }
    // 爱心资源：上传者可更新 / 删除自己的分享，站主 / 管理员也可处置违规链接。
    if (path[0] === 'resources' && path[1] === 'mine' && path.length === 2 && method === 'GET') {
      const rows = await db.prepare(`${resourceSelect} WHERE r.uploader_qq=? ORDER BY r.created_at DESC, r.id DESC LIMIT 100`).bind(user.qq).all();
      return json({ items: rows.results.map((r) => resourceDto(r, user.qq, isSiteAdmin(user))) });
    }
    if (path[0] === 'resources' && path.length === 1 && method === 'POST') {
      const input = resourceInput(await body(request));
      if (input.error) return fail(input.error);
      const total = await db.prepare('SELECT COUNT(*) n FROM rule_resources WHERE uploader_qq=?').bind(user.qq).first();
      if (Number(total?.n || 0) >= 50) return fail('每人最多分享 50 条资源', 409);
      const rid = id(), iso = new Date().toISOString(), adminPost = isSiteAdmin(user);
      // 玩家新分享先进待审核；站主 / 管理员自己发布视为已通过。
      await db.prepare('INSERT INTO rule_resources(id,name,url,type,note,flags,category,uploader_qq,created_at,updated_at,review_status,reviewed_at,reviewed_by) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)')
        .bind(rid, input.name, input.url, input.type, input.note, input.flags, input.category, user.qq, iso, iso,
          adminPost ? 'approved' : 'pending', adminPost ? iso : null, adminPost ? user.qq : null).run();
      const row = await db.prepare(`${resourceSelect} WHERE r.id=?`).bind(rid).first();
      return json({ item: resourceDto(row, user.qq, adminPost) });
    }
    if (path[0] === 'resources' && path[1] && path.length === 2 && (method === 'PATCH' || method === 'DELETE')) {
      const row = await db.prepare('SELECT * FROM rule_resources WHERE id=?').bind(path[1]).first();
      if (!row) return fail('这条资源不存在或已被删除', 404);
      if (row.uploader_qq !== user.qq && !isSiteAdmin(user)) return fail('只能修改或删除自己分享的资源', 403);
      if (method === 'DELETE') {
        await db.prepare('DELETE FROM rule_resources WHERE id=?').bind(row.id).run();
        return json({ ok: true });
      }
      const input = resourceInput(await body(request), row);
      if (input.error) return fail(input.error);
      const adminEdit = isSiteAdmin(user);
      // 只有链接被改动（或被驳回后重新编辑）才回到待审核；只改标题 / 备注 / 标签 / 分页 / 类型不改变审核状态。
      const urlChanged = input.url !== (row.url || '');
      const needsReview = urlChanged || (row.review_status === 'rejected' && !adminEdit);
      const iso = new Date().toISOString();
      const nextStatus = needsReview ? (adminEdit ? 'approved' : 'pending') : resourceReviewStatus(row);
      const nextNote = needsReview ? '' : (row.review_note || '');
      const nextReviewedAt = needsReview ? (adminEdit ? iso : null) : (row.reviewed_at || null);
      const nextReviewedBy = needsReview ? (adminEdit ? user.qq : null) : (row.reviewed_by || null);
      await db.prepare('UPDATE rule_resources SET name=?,url=?,type=?,note=?,flags=?,category=?,review_status=?,review_note=?,reviewed_at=?,reviewed_by=?,updated_at=? WHERE id=?')
        .bind(input.name, input.url, input.type, input.note, input.flags, input.category,
          nextStatus, nextNote, nextReviewedAt, nextReviewedBy, iso, row.id).run();
      const updated = await db.prepare(`${resourceSelect} WHERE r.id=?`).bind(row.id).first();
      return json({ item: resourceDto(updated, user.qq, adminEdit) });
    }
    // 贴纸广场：会员可浏览其他会员公开的贴纸库，并把某张复制进自己的库存。
    if (path[0] === 'sticker-plaza' && path.length === 1 && method === 'GET') {
      if (!isMember(user)) return fail('贴纸广场仅会员可用', 403);
      const source = await plazaSource(db, user.qq);
      const canModerate = !!roleOf(user);
      return json({ members: source.members.map((item, index) => plazaMemberDto(item, source.counts, index)), canModerate, blocked: canModerate ? [...source.blocked] : [] });
    }
    if (path[0] === 'sticker-plaza' && path[1] === 'copy' && method === 'POST') {
      if (!isMember(user)) return fail('只有会员可以使用贴纸广场', 403);
      const b = await body(request);
      const key = clean(b.key, 120), replaceKey = clean(b.replaceKey, 120);
      if (!/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) return fail('贴纸文件无效');
      const source = await plazaSource(db, user.qq);
      if (source.blocked.has(key)) return fail('这张贴纸已下架', 403);
      const available = new Set(source.members.flatMap((item) => item.keys));
      if (!available.has(key)) return fail('这张贴纸不在贴纸广场中', 404);
      if (!await env.COVERS?.head(key)) return fail('贴纸文件不存在', 404);
      const current = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
      const library = parseTags(current?.sticker_library);
      if (library.includes(key)) return json({ ok: true, already: true, note: '这张贴纸已经在你的库存里', user: userDto(current) });
      const full = library.length >= 10;
      if (full && (!replaceKey || !library.includes(replaceKey))) return fail('贴纸库已满 10 张，请先选择要替换的一张', 409);
      const next = full ? library.map((item) => item === replaceKey ? key : item) : [...library, key];
      // 只复制引用，不改原作者库存、不自动默认佩戴；被替换的贴纸若原本是默认佩戴则摘掉。
      const equipped = parseTags(current?.stickers).filter((item) => item !== replaceKey && next.includes(item));
      await db.batch([
        db.prepare('UPDATE users SET sticker_library=?,stickers=? WHERE qq=?').bind(JSON.stringify(next), JSON.stringify(equipped), user.qq),
        db.prepare('INSERT INTO sticker_copies(image_key,copy_count,updated_at) VALUES(?,1,?) ON CONFLICT(image_key) DO UPDATE SET copy_count=copy_count+1,updated_at=excluded.updated_at').bind(key, new Date().toISOString())
      ]);
      const updated = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
      return json({ ok: true, already: false, note: full ? '已替换并加入库存（不会自动默认佩戴）' : '已加入我的库存（不会自动默认佩戴）', user: userDto(updated) });
    }
    // 站主 / 管理员下架违规贴纸：只影响广场展示与后续加入，已发团上引用的图片不受影响。
    if (path[0] === 'sticker-plaza' && path[1] === 'block' && method === 'POST') {
      if (!roleOf(user)) return fail('只有站主 / 管理员可以下架贴纸', 403);
      const key = clean((await body(request)).key, 120);
      if (!/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) return fail('贴纸文件无效');
      await db.prepare('INSERT INTO sticker_blocks(image_key,blocked_by,created_at) VALUES(?,?,?) ON CONFLICT(image_key) DO UPDATE SET blocked_by=excluded.blocked_by,created_at=excluded.created_at').bind(key, user.qq, new Date().toISOString()).run();
      return json({ ok: true });
    }
    if (path[0] === 'sticker-plaza' && path[1] === 'block' && path[2] && method === 'DELETE') {
      if (!roleOf(user)) return fail('只有站主 / 管理员可以撤销下架', 403);
      await db.prepare('DELETE FROM sticker_blocks WHERE image_key=?').bind(clean(path[2], 120)).run();
      return json({ ok: true });
    }
    // 「我的贴纸」标题右侧的打勾：是否把自己的贴纸库存公开到贴纸广场。
    // 会员可随时切换；取消公开只影响他人广场的展示，自己已发布的团和已加入的库存都不变。
    if (path[0] === 'profile' && path[1] === 'sticker-library-public' && method === 'PATCH') {
      if (!isMember(user)) return fail('只有会员可以设置贴纸库存公开状态', 403);
      const b = await body(request);
      if (typeof b.public !== 'boolean') return fail('参数无效');
      await db.prepare('UPDATE users SET sticker_library_public=? WHERE qq=?').bind(b.public ? 1 : 0, user.qq).run();
      const updated = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
      return json({ user: userDto(updated) });
    }
    // 贴纸库：会员最多预存 10 张，发团时从这里挑（不允许现场上传）
    if (path[0] === 'profile' && path[1] === 'sticker-library' && method === 'PATCH') {
      if (!isMember(user)) return fail('只有会员可以使用贴纸功能', 403);
      const input = (await body(request)).stickers;
      if (!Array.isArray(input) || input.length > 10) return fail('贴纸库最多存放 10 张');
      const keys = [...new Set(input.map((item) => clean(item, 120)).filter(Boolean))];
      if (keys.length !== input.length) return fail('贴纸不能重复');
      for (const key of keys) {
        if (!/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) return fail('贴纸文件无效');
        if (!await env.COVERS?.head(key)) return fail('贴纸文件不存在，请重新上传');
      }
      // 从贴纸库移除的图片，同时从默认佩戴里摘掉
      const equipped = parseTags(user.stickers).filter((key) => keys.includes(key));
      await db.prepare('UPDATE users SET sticker_library=?,stickers=? WHERE qq=?').bind(JSON.stringify(keys), JSON.stringify(equipped), user.qq).run();
      const updated = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
      return json({ user: userDto(updated) });
    }
    // 默认佩戴：只能从贴纸库里选，最多 2 张
    if (path[0] === 'profile' && path[1] === 'stickers' && method === 'PATCH') {
      if (!isMember(user)) return fail('只有会员可以使用贴纸功能', 403);
      const input = (await body(request)).stickers;
      if (!Array.isArray(input) || input.length > 2) return fail('最多可以佩戴 2 张贴纸');
      const keys = [...new Set(input.map((item) => clean(item, 120)).filter(Boolean))];
      if (keys.length !== input.length) return fail('贴纸不能重复');
      const library = parseTags(user.sticker_library);
      if (keys.some((key) => !library.includes(key))) return fail('请先从贴纸库上传该贴纸');
      await db.prepare('UPDATE users SET stickers=? WHERE qq=?').bind(JSON.stringify(keys), user.qq).run();
      const updated = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
      return json({ user: userDto(updated) });
    }
    if (path[0] === 'profile' && path[1] === 'avatar' && method === 'POST') {
      if (!env.COVERS) return fail('图片存储未配置', 503);
      const form = await request.formData(), file = form.get('file');
      if (!(file instanceof File)) return fail('请选择图片');
      const type = uploadTypeOf(file);
      if (!type || file.size > MAX_UPLOAD_BYTES) return fail('仅支持小于 8MB 的 PNG、JPG、GIF、WebP 图片');
      const ext = type === 'image/jpeg' ? 'jpg' : type.split('/')[1];
      const key = `avatars/${id()}.${ext}`;
      // 用完整字节写入，避免流式上传在 GIF 多帧数据上被截断成静态首帧。
      await env.COVERS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
      await db.prepare('UPDATE users SET avatar_key=? WHERE qq=?').bind(key, user.qq).run();
      return json({ avatar: assetUrl(key) });
    }
    if (path[0] === 'checkin' && method === 'POST') {
      const today = dateHK();
      const yesterday = dateHK(new Date(Date.now() - 86400000));
      const memberNow = isMember(user) ? 1 : 0;
      // 累计签到次数全站统一：升级会员 / 变为普通用户都不清零，切换身份时已攒次数继续有效。
      // 断签：本次签到仍是会员则保留累计（会员权益），普通用户期间断签才归 1 重新计算。
      // 每累计满 7 次发一次 GM 点赞券，只按发奖当次的身份决定张数（会员 3 / 普通 1）。
      // checkin_streak 仅保留给前端展示「连续签到天数」，不再参与发奖。
      const nextCount = '(CASE WHEN last_checkin=? OR ?=1 THEN checkin_count+1 ELSE 1 END)';
      const result = await db.prepare(`UPDATE users SET
        gm_hearts=gm_hearts+CASE WHEN ${nextCount}%7=0 THEN CASE WHEN ?=1 THEN 3 ELSE 1 END ELSE 0 END,
        checkin_count=${nextCount},
        checkin_streak=CASE WHEN last_checkin=? THEN checkin_streak+1 ELSE 1 END,
        last_checkin=?,player_hearts=player_hearts+1
        WHERE qq=? AND (last_checkin IS NULL OR last_checkin<>?)
        RETURNING checkin_count,checkin_streak`).bind(
          yesterday, memberNow, memberNow,
          yesterday, memberNow,
          yesterday, today, user.qq, today).first();
      if (!result) return fail('今日已签到');
      const count = result.checkin_count;
      const gmHeartsAwarded = count % 7 === 0 ? (memberNow ? 3 : 1) : 0;
      return json({ ok: true, streak: result.checkin_streak, checkinCount: count,
        memberCheckinCount: count, // 兼容旧前端字段，语义已改为「统一累计签到次数」
        isMember: !!memberNow,
        daysUntilGmReward: gmHeartsAwarded ? 0 : 7 - count % 7,
        gmHeartsAwarded, gmAwarded: gmHeartsAwarded > 0 });
    }
    if (path[0] === 'praise' && method === 'POST') {
      const b = await body(request), target = String(b.toUserId || ''), type = b.type, campaignId = String(b.campaignId || '');
      if (!['gm','player'].includes(type) || !qqValid(target) || target === user.qq || !/^[0-9a-f-]{36}$/.test(campaignId)) return fail('点赞对象无效');
      const c = await db.prepare('SELECT * FROM campaigns WHERE id=? AND deleted_at IS NULL').bind(campaignId).first();
      if (!c || c.kind === 'promo' || !c.finished_at) return fail('结团后才能点赞');
      const senderMember = c.gm_qq === user.qq || await db.prepare('SELECT 1 FROM campaign_memberships WHERE campaign_id=? AND user_qq=?').bind(campaignId, user.qq).first();
      const targetValid = type === 'gm' ? c.gm_qq === target && c.gm_qq !== user.qq : await db.prepare('SELECT 1 FROM campaign_memberships WHERE campaign_id=? AND user_qq=?').bind(campaignId, target).first();
      if (!senderMember || !targetValid) return fail('只能给本团成员点赞', 403);
      const column = type === 'gm' ? 'gm_hearts' : 'player_hearts', received = type === 'gm' ? 'received_gm' : 'received_player';
      const result = await db.batch([
        db.prepare(`UPDATE users SET ${column}=${column}-1 WHERE qq=? AND ${column}>0 AND EXISTS(SELECT 1 FROM users WHERE qq=?)`).bind(user.qq, target),
        db.prepare(`UPDATE users SET ${received}=${received}+1 WHERE qq=? AND changes()=1`).bind(target),
        db.prepare('INSERT INTO praises(id,from_qq,to_qq,type,created_at,campaign_id) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(), user.qq, target, type, new Date().toISOString(), campaignId)
      ]);
      return result[0].meta.changes ? json({ ok: true }) : fail('点赞道具不足或用户不存在');
    }
    if (path[0] === 'upload' && method === 'POST') {
      if (!env.COVERS) return fail('图片存储未配置', 503);
      const form = await request.formData(), file = form.get('file');
      if (!(file instanceof File)) return fail('请选择图片');
      const type = uploadTypeOf(file);
      if (!type || file.size > MAX_UPLOAD_BYTES) return fail('仅支持小于 8MB 的 PNG、JPG、GIF、WebP 图片');
      // 贴纸上传是会员专享（封面上传不带 purpose / saveToLibrary，不受影响）。
      const intoLibrary = form.get('saveToLibrary') === '1';
      if ((intoLibrary || form.get('purpose') === 'sticker') && !isMember(user)) return fail('只有会员可以上传贴纸', 403);
      const replaceKey = clean(form.get('replaceKey'), 120);
      // 贴纸库满 10 张时不再自动挤掉最早一张：必须由用户先选好要替换哪一张。
      // 校验放在写 R2 之前，避免留下「图已传、库存没更新」的孤儿文件。
      let current = null, library = [];
      if (intoLibrary) {
        current = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
        library = parseTags(current?.sticker_library);
        if (library.length >= 10 && (!replaceKey || !library.includes(replaceKey))) return fail('贴纸库已满 10 张，请先选择要替换的一张', 409);
      }
      const key = `${id()}.${type === 'image/jpeg' ? 'jpg' : type.split('/')[1]}`;
      await env.COVERS.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: type } });
      let savedToLibrary = false, libraryNote = '', updatedUser = null;
      if (intoLibrary) {
        const next = replaceKey && library.includes(replaceKey)
          ? library.map((item) => item === replaceKey ? key : item)
          : [...new Set([...library, key])];
        // 贴纸不像铭牌会自动默认佩戴：新上传的只进库存，绝不自动加入 stickers。
        // 仅当被替换掉的那张恰好是默认佩戴时，把它摘掉，避免佩戴一张已不在库里的图。
        const equipped = parseTags(current?.stickers).filter((item) => item !== replaceKey && next.includes(item));
        await db.prepare('UPDATE users SET sticker_library=?,stickers=? WHERE qq=?').bind(JSON.stringify(next), JSON.stringify(equipped), user.qq).run();
        updatedUser = await db.prepare('SELECT * FROM users WHERE qq=?').bind(user.qq).first();
        savedToLibrary = true;
        libraryNote = replaceKey ? '已替换选中的贴纸' : '已存入贴纸库（不会自动默认佩戴）';
      }
      return json({ imageKey: key, imageUrl: `/api/images/${key}`, savedToLibrary, libraryNote, user: updatedUser ? userDto(updatedUser) : null });
    }
    if (path[0] === 'campaigns' && method === 'POST' && path.length === 1) {
      const b = await body(request), c = validateCampaign(b), imageKey = clean(b.imageKey, 100) || null;
      if (imageKey && !await env.COVERS?.head(imageKey)) return fail('图片不存在');
      // 贴纸可来自个人贴纸库，也可以是发车时现场上传裁剪的图：本团临时选择，不改默认佩戴。
      const pickedStickers = Array.isArray(b.stickerKeys) ? [...new Set(b.stickerKeys.map((item) => clean(item, 120)).filter(Boolean))].slice(0, 2) : [];
      for (const key of pickedStickers) {
        if (!/^[A-Za-z0-9._/-]+$/.test(key) || key.includes('..')) return fail('贴纸文件无效');
        if (!await env.COVERS?.head(key)) return fail('贴纸文件不存在，请重新上传');
      }
      const stickerOverride = pickedStickers.length ? JSON.stringify(pickedStickers) : null;
      const cid = id();
      const createdAt = new Date().toISOString();
      const contact = c.contact || user.qq;
      const rawSlots = Array.isArray(b.timeSlots) ? b.timeSlots : [];
      if (c.kind === 'promo' && rawSlots.length > 1) return fail('宣群只能选择一个时间');
      // 防重复发车：同一账号 2 分钟内的「同名 + 同开团时间」直接拒绝（误触/网络卡顿导致的双发）。
      // 批量团一次请求插入全部时段，只在这里校验一次，不会被自身批次误伤；不同时间的同名团也不受影响。
      if (await db.prepare('SELECT 1 FROM campaigns WHERE gm_qq=? AND title=? AND time_schedule=? AND deleted_at IS NULL AND created_at>? LIMIT 1').bind(user.qq, c.title, c.time, new Date(Date.now() - 120000).toISOString()).first()) return fail('发布太快啦，同样的团刚刚已提交，请勿重复发布', 429);
      if (rawSlots.length > 96) return fail('一次最多选择 96 个时段');
      const slots = rawSlots.length > 1 ? rawSlots.map((raw) => { const slot = validateNewSlot(raw, c.kind !== 'online'); return { ...c, time: slot.time, scheduledDate: slot.date, period: slot.period }; }) : [c];
      const slotKeys = slots.map((slot) => `${slot.scheduledDate}:${slot.period}`);
      const today = dateHK();
      const latest = new Date(`${today}T00:00:00+08:00`);
      latest.setUTCDate(latest.getUTCDate() + 31);
      const latestDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(latest);
      if (new Set(slotKeys).size !== slots.length || slots.some((slot) => slot.scheduledDate < today || (c.kind === 'online' && slot.scheduledDate > latestDate)) || (rawSlots.length > 1 && !slotKeys.includes(`${c.scheduledDate}:${c.period}`))) return fail('所选时段无效或重复');
      const batchId = slots.length > 1 ? cid : null;
      const statements = slots.map((slot, index) => db.prepare('INSERT INTO campaigns(id,gm_qq,title,rule,summary,description,time_schedule,scheduled_date,time_period,image_key,banner_color,max_players,created_at,contact,session_type,platforms,preset_tags,custom_tags,batch_id,kind,province,city,address,sticker_override) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(index === 0 ? cid : id(), user.qq, c.title, c.rule, c.summary || '', c.description, slot.time, slot.scheduledDate, slot.period, imageKey, c.color, c.players, createdAt, contact, c.sessionType, JSON.stringify(c.platforms), JSON.stringify(c.presetTags), JSON.stringify(c.customTags), batchId, c.kind, c.province, c.city, c.address, stickerOverride));
      await db.batch([
        ...(batchId ? [db.prepare('INSERT INTO campaign_batches(id,gm_qq,title,rule,summary,description,image_key,banner_color,max_players,contact,session_type,platforms,preset_tags,custom_tags,created_at,kind,province,city,address) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(cid, user.qq, c.title, c.rule, c.summary || '', c.description, imageKey, c.color, c.players, contact, c.sessionType, JSON.stringify(c.platforms), JSON.stringify(c.presetTags), JSON.stringify(c.customTags), createdAt, c.kind, c.province, c.city, c.address)] : []),
        ...statements,
        db.prepare('INSERT INTO bot_outbox(event_id,campaign_id,rule,created_at) VALUES(?,?,?,?)').bind(id(), cid, c.rule, createdAt)
      ]);
      await touchRule(db, c.rule, createdAt);
      for (const tag of c.customTags) {
        await db.prepare('INSERT INTO custom_tags(name,use_count,last_used_at,created_at) VALUES(?,1,?,?) ON CONFLICT(name) DO UPDATE SET use_count=use_count+1,last_used_at=excluded.last_used_at').bind(tag, createdAt, createdAt).run();
      }
      return json({ id: cid }, 201);
    }
    if (path[0] === 'batches' && path[1] && path[2] === 'slots' && path.length === 3 && method === 'POST') {
      const template = await db.prepare('SELECT kind FROM campaign_batches WHERE id=? AND gm_qq=?').bind(path[1], user.qq).first();
      if (!template) return fail('主团不存在', 404);
      const slot = validateNewSlot((await body(request)).timeSchedule, template.kind !== 'online');
      const cid = id(), createdAt = new Date().toISOString();
      const result = await db.prepare(`INSERT INTO campaigns(id,gm_qq,title,rule,summary,description,time_schedule,scheduled_date,time_period,image_key,banner_color,max_players,created_at,contact,session_type,platforms,preset_tags,custom_tags,batch_id,kind,province,city,address,sticker_override)
        SELECT ?,b.gm_qq,b.title,b.rule,b.summary,b.description,?,?,?,b.image_key,b.banner_color,b.max_players,?,b.contact,b.session_type,b.platforms,b.preset_tags,b.custom_tags,b.id,b.kind,b.province,b.city,b.address,(SELECT x.sticker_override FROM campaigns x WHERE x.batch_id=b.id AND x.deleted_at IS NULL ORDER BY x.created_at LIMIT 1)
        FROM campaign_batches b WHERE b.id=? AND b.gm_qq=?
        AND (SELECT COUNT(*) FROM campaigns WHERE batch_id=b.id AND deleted_at IS NULL)<96
        AND EXISTS(SELECT 1 FROM campaigns WHERE batch_id=b.id AND deleted_at IS NULL AND finished_at IS NULL)
        AND NOT EXISTS(SELECT 1 FROM campaigns WHERE batch_id=b.id AND deleted_at IS NULL AND scheduled_date=? AND time_period=?)`)
        .bind(cid, slot.time, slot.date, slot.period, createdAt, path[1], user.qq, slot.date, slot.period).run();
      return result.meta.changes ? json({ id: cid }, 201) : fail('主团不存在或该时段已有团', 409);
    }
    if (path[0] === 'campaigns' && path[1]) {
      const cid = path[1], c = await db.prepare(`${campaignSelect} AND c.id=?`).bind(cid).first();
      if (!c) {
        // 删除是物理删除且幂等：用户重复点「结束宣发」时按成功返回，避免界面误报「团不存在」让人以为第一次没删掉。
        if (path.length === 2 && method === 'DELETE') return json({ ok: true, alreadyDeleted: true });
        return fail('团不存在', 404);
      }
      if (path[2] === 'signup' && path.length === 3 && method === 'POST') {
        if (c.kind === 'promo') return fail('宣群无需报名，请登录后查看联系方式', 409);
        if (c.gm_qq === user.qq) return fail('主持人不能报名自己的团');
        const blacklisted = await db.prepare('SELECT 1 FROM user_blacklist WHERE qq=? AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at>?)').bind(user.qq, now()).first();
        if (blacklisted) return fail('当前账号在黑名单中，暂时无法报名', 403);
        if (c.finished_at || c.closed_at || campaignExpired(c)) return fail('该团报名已经结束');
        const result = await db.prepare(`INSERT INTO campaign_memberships(campaign_id,user_qq,joined_at)
          SELECT ?,?,? WHERE NOT EXISTS(SELECT 1 FROM campaign_memberships WHERE campaign_id=? AND user_qq=?)
          AND (SELECT COUNT(*) FROM campaign_memberships WHERE campaign_id=?) < ? AND EXISTS(SELECT 1 FROM campaigns WHERE id=? AND closed_at IS NULL AND finished_at IS NULL AND scheduled_date>=?)
          AND NOT EXISTS(SELECT 1 FROM user_blacklist WHERE qq=? AND lifted_at IS NULL AND (expires_at IS NULL OR expires_at>?))`).bind(cid, user.qq, new Date().toISOString(), cid, user.qq, cid, c.max_players, cid, dateHK(), user.qq, now()).run();
        if (!result.meta.changes) return fail('你已经报名或该团已满员', 409);
        queueSignupMail(context, { campaign: c, actor: user, siteUrl: url.origin });
        return json({ ok: true }, 201);
      }
      if (path[2] === 'signup' && path.length === 3 && method === 'DELETE') {
        if (campaignExpired(c) || c.finished_at) return fail('开团日结束后不能取消报名');
        if (c.closed_at) return fail('本团已锁车，不能取消报名', 409);
        const result = await db.prepare('DELETE FROM campaign_memberships WHERE campaign_id=? AND user_qq=? AND EXISTS(SELECT 1 FROM campaigns WHERE id=? AND closed_at IS NULL AND finished_at IS NULL AND scheduled_date>=?)').bind(cid, user.qq, cid, dateHK()).run();
        // 取消报名不发邮件（站主确认），只返回成功。
        if (result.meta.changes) return json({ ok: true });
        const current = await db.prepare('SELECT closed_at FROM campaigns WHERE id=?').bind(cid).first();
        return current?.closed_at ? fail('本团已锁车，不能取消报名', 409) : fail('你尚未报名', 404);
      }
      if (path[2] === 'members' && path[3] && path.length === 4 && method === 'DELETE') {
        if (c.gm_qq !== user.qq) return fail('只有主持人可以移除玩家', 403);
        if (campaignExpired(c) || c.finished_at) return fail('开团日结束后不能移除玩家');
        const target = path[3];
        if (!qqValid(target)) return fail('玩家信息无效');
        const result = await db.prepare('DELETE FROM campaign_memberships WHERE campaign_id=? AND user_qq=?').bind(cid, target).run();
        return result.meta.changes ? json({ ok: true }) : fail('玩家不在本团', 404);
      }
      if (c.gm_qq !== user.qq && !isSiteAdmin(user)) return fail('只有主持人可以操作', 403);
      if (path[2] === 'finish' && path.length === 3 && method === 'POST') {
        if (c.kind === 'promo') return fail('宣群不需要结团', 409);
        const result = await db.prepare('UPDATE campaigns SET finished_at=?,closed_at=COALESCE(closed_at,?) WHERE id=? AND finished_at IS NULL').bind(new Date().toISOString(), new Date().toISOString(), cid).run();
        return result.meta.changes ? json({ ok: true }) : fail('本团已经结团', 409);
      }
      // 结束宣发：只把宣群标记为「已结束」并保留记录（closed_at），不再出现在宣群板块，
      // 但主持人仍能在团务管理里看到这条历史，随时可以用 DELETE 物理删除。幂等，重复点击按成功返回。
      if (path[2] === 'end-promo' && path.length === 3 && method === 'POST') {
        if (c.kind !== 'promo') return fail('只有宣群可以结束宣发', 409);
        if (c.closed_at || c.finished_at) return json({ ok: true, alreadyEnded: true });
        await db.prepare('UPDATE campaigns SET closed_at=? WHERE id=? AND kind=\'promo\' AND deleted_at IS NULL AND closed_at IS NULL AND finished_at IS NULL').bind(new Date().toISOString(), cid).run();
        return json({ ok: true });
      }
      if (path[2] === 'status' && path.length === 3 && method === 'PATCH') {
        const b = await body(request);
        if (typeof b.closed !== 'boolean') return fail('状态无效');
        // 宣群不走封车/解封，结束宣发请用专用接口 end-promo。
        if (c.kind === 'promo') return fail('宣群请使用「结束宣发」', 409);
        if (c.finished_at) return fail('已结团，不能重新开放', 409);
        if (!b.closed && campaignExpired(c)) return fail('预定时间已过，请先修改时间', 409);
        await db.prepare(`UPDATE campaigns SET closed_at=?, is_abandoned = CASE WHEN ?=1 AND (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)=0 THEN 1 ELSE 0 END WHERE id=?`).bind(b.closed ? new Date().toISOString() : null, b.closed ? 1 : 0, cid).run();
        return json({ ok: true });
      }
      // 弃团记录保留：仅站务可「保留记录」或「直接删除」（软删除，仅后台封存不可见）。
      if (path[2] === 'keep' && path.length === 3 && method === 'POST') {
        if (!isSiteAdmin(user)) return fail('只有站务可以操作', 403);
        if (!c) return fail('团不存在', 404);
        await db.prepare('UPDATE campaigns SET is_kept=1 WHERE id=?').bind(cid).run();
        return json({ ok: true });
      }
      if (path[2] === 'abandoned' && path.length === 3 && method === 'DELETE') {
        if (!isSiteAdmin(user)) return fail('只有站务可以操作', 403);
        if (!c) return fail('团不存在', 404);
        if (!c.is_abandoned) return fail('该团不是弃团', 409);
        await db.prepare('UPDATE campaigns SET deleted_at=? WHERE id=? AND is_abandoned=1').bind(new Date().toISOString(), cid).run();
        return json({ ok: true });
      }
      if (path.length === 2 && method === 'PATCH') {
        const b = await body(request);
        const siteAdmin = isSiteAdmin(user);
        // 普通主持人改批量团仍只同步简介/标签/封面/贴纸；站主/管理员走下方的全量编辑。
        if (c.batch_id && !siteAdmin) {
          if (!b || typeof b.description !== 'string' || !Array.isArray(b.customTags) || Object.keys(b).some((key) => !['description','presetTags','customTags','imageKey','stickerKeys'].includes(key))) return fail('批量团只允许修改简介、标签、封面和贴纸');
          const tags = validateCampaign({ ...campDto(c), ...b }, c.kind, false);
          const presetTags = JSON.stringify(tags.presetTags), customTags = JSON.stringify(tags.customTags);
          // 批量团共用一张封面：主团与新时段都跟着替换。
          const imageKey = b.imageKey === null ? null : clean(b.imageKey, 100) || c.image_key;
          if (imageKey && !await env.COVERS?.head(imageKey)) return fail('图片不存在');
          const sticker = 'stickerKeys' in b
            ? await resolveStickerOverride(db, env, user, c.gm_qq, b.stickerKeys ?? null)
            : { value: c.sticker_override };
          if (sticker.error) return fail(sticker.error);
          // 站长/管理员可代为修改任意批量团；主持人只能改自己的。
          const ownerFilter = c.gm_qq === user.qq ? ' AND gm_qq=?' : '';
          const ownerBinds = c.gm_qq === user.qq ? [user.qq] : [];
          const sets = ['description=?', 'preset_tags=?', 'custom_tags=?', 'image_key=?'];
          const binds = [tags.description, presetTags, customTags, imageKey];
          if ('stickerKeys' in b) { sets.push('sticker_override=?'); binds.push(sticker.value); }
          await db.batch([
            db.prepare(`UPDATE campaign_batches SET description=?,preset_tags=?,custom_tags=?,image_key=? WHERE id=?${ownerFilter}`).bind(tags.description, presetTags, customTags, imageKey, c.batch_id, ...ownerBinds),
            db.prepare(`UPDATE campaigns SET ${sets.join(',')} WHERE batch_id=? AND deleted_at IS NULL${ownerFilter}`).bind(...binds, c.batch_id, ...ownerBinds)
          ]);
          const nowIso = new Date().toISOString();
          for (const tag of tags.customTags) {
            await db.prepare('INSERT INTO custom_tags(name,use_count,last_used_at,created_at) VALUES(?,1,?,?) ON CONFLICT(name) DO UPDATE SET use_count=use_count+1,last_used_at=excluded.last_used_at').bind(tag, nowIso, nowIso).run();
          }
          return json({ ok: true });
        }
        // 站主/管理员在主页的全量编辑：所有内容字段都能改，批量团同步全部时段，已结团也不受限。
        if (c.finished_at && !siteAdmin) return fail('已结团，不能修改', 409);
        const nextKind = siteAdmin && ['online','offline','promo'].includes(b.kind) ? b.kind : c.kind;
        if (nextKind !== c.kind && nextKind === 'promo') {
          // 宣群不能报名，已有成员（含同一批量团的其它时段）时不允许切换，避免成员数据被隐藏。
          const anyMember = c.batch_id
            ? await db.prepare('SELECT 1 FROM campaign_memberships m JOIN campaigns x ON x.id=m.campaign_id WHERE x.batch_id=? LIMIT 1').bind(c.batch_id).first()
            : await db.prepare('SELECT 1 FROM campaign_memberships WHERE campaign_id=? LIMIT 1').bind(cid).first();
          if (anyMember) return fail('该团已有报名成员，不能改为宣群', 409);
        }
        const data = validateCampaign({ ...campDto(c), ...b, kind: nextKind }, nextKind);
        const imageKey = b.imageKey === null ? null : clean(b.imageKey, 100) || c.image_key;
        if (data.scheduledDate < dateHK() && data.time !== c.time_schedule && !siteAdmin) return fail('开团日期不能早于今天');
        if (imageKey && !await env.COVERS?.head(imageKey)) return fail('图片不存在');
        // 编辑时可补充/更换贴纸，也可清空恢复默认佩戴。
        const sticker = 'stickerKeys' in b
          ? await resolveStickerOverride(db, env, user, c.gm_qq, b.stickerKeys ?? null)
          : { value: c.sticker_override };
        if (sticker.error) return fail(sticker.error);
        const contact = data.contact || c.contact || user.qq;
        const nowIso = new Date().toISOString();
        const common = [data.title, data.rule, data.summary || '', data.description, imageKey, data.color, data.players, contact, data.sessionType, JSON.stringify(data.platforms), JSON.stringify(data.presetTags), JSON.stringify(data.customTags), data.province, data.city, data.address];
        const statements = [];
        if (c.batch_id) {
          // 共享字段写回主团模板 + 该批次下所有时段，之后新增时段也会沿用新内容。
          statements.push(
            db.prepare('UPDATE campaign_batches SET title=?,rule=?,summary=?,description=?,image_key=?,banner_color=?,max_players=?,contact=?,session_type=?,platforms=?,preset_tags=?,custom_tags=?,province=?,city=?,address=?,kind=? WHERE id=?').bind(...common, nextKind, c.batch_id),
            db.prepare('UPDATE campaigns SET title=?,rule=?,summary=?,description=?,image_key=?,banner_color=?,max_players=?,contact=?,session_type=?,platforms=?,preset_tags=?,custom_tags=?,province=?,city=?,address=?,sticker_override=?,kind=? WHERE batch_id=? AND deleted_at IS NULL').bind(...common, sticker.value, nextKind, c.batch_id)
          );
          // 各时段可单独改期，格式与发布时一致：2026-11-20（星期五）晚
          if (siteAdmin && Array.isArray(b.slotTimes)) {
            for (const raw of b.slotTimes) {
              if (!raw || typeof raw.id !== 'string' || typeof raw.timeSchedule !== 'string') return fail('时段格式无效');
              const matched = /^(\d{4}-\d{2}-\d{2})（星期[一二三四五六日]）(早|中|晚)$/.exec(raw.timeSchedule);
              if (!matched) return fail('时段格式无效');
              const exists = await db.prepare('SELECT 1 FROM campaigns WHERE id=? AND batch_id=? AND deleted_at IS NULL').bind(raw.id, c.batch_id).first();
              if (!exists) return fail('时段不存在', 404);
              statements.push(db.prepare('UPDATE campaigns SET time_schedule=?,scheduled_date=?,time_period=? WHERE id=? AND batch_id=?').bind(raw.timeSchedule, matched[1], matched[2], raw.id, c.batch_id));
            }
          }
        } else {
          statements.push(db.prepare('UPDATE campaigns SET title=?,rule=?,summary=?,description=?,time_schedule=?,scheduled_date=?,time_period=?,image_key=?,banner_color=?,max_players=?,contact=?,session_type=?,platforms=?,preset_tags=?,custom_tags=?,province=?,city=?,address=?,sticker_override=?,kind=? WHERE id=?')
            .bind(data.title, data.rule, data.summary || '', data.description, data.time, data.scheduledDate, data.period, imageKey, data.color, data.players, contact, data.sessionType, JSON.stringify(data.platforms), JSON.stringify(data.presetTags), JSON.stringify(data.customTags), data.province, data.city, data.address, sticker.value, nextKind, cid));
        }
        await db.batch(statements);
        await touchRule(db, data.rule, nowIso);
        for (const tag of data.customTags) {
          await db.prepare('INSERT INTO custom_tags(name,use_count,last_used_at,created_at) VALUES(?,1,?,?) ON CONFLICT(name) DO UPDATE SET use_count=use_count+1,last_used_at=excluded.last_used_at').bind(tag, nowIso, nowIso).run();
        }
        return json({ ok: true });
      }
      if (path.length === 2 && method === 'DELETE') {
        // 团是物理删除的，先留一条弃团日志，后台看板才能统计「弃团」。
        await db.batch([
          db.prepare('INSERT INTO campaign_abandons(id,campaign_id,gm_qq,actor_qq,title,kind,rule,created_at,abandoned_at) VALUES(?,?,?,?,?,?,?,?,?)')
            .bind(id(), cid, c.gm_qq, user.qq, c.title, c.kind, c.rule || '', c.created_at || '', new Date().toISOString()),
          db.prepare('UPDATE users SET received_gm=MAX(0,received_gm-(SELECT COUNT(*) FROM praises WHERE campaign_id=? AND to_qq=users.qq AND type=\'gm\')),received_player=MAX(0,received_player-(SELECT COUNT(*) FROM praises WHERE campaign_id=? AND to_qq=users.qq AND type=\'player\'))').bind(cid, cid),
          db.prepare('DELETE FROM praises WHERE campaign_id=?').bind(cid),
          db.prepare('DELETE FROM campaign_memberships WHERE campaign_id=?').bind(cid),
          db.prepare('DELETE FROM bot_outbox WHERE campaign_id=?').bind(cid),
          db.prepare('DELETE FROM campaigns WHERE id=?').bind(cid),
          db.prepare('DELETE FROM campaign_batches WHERE id=? AND NOT EXISTS(SELECT 1 FROM campaigns WHERE batch_id=?)').bind(c.batch_id || cid, c.batch_id || cid)
        ]);
        return json({ ok: true });
      }
    }
    return fail('接口不存在', 404);
  } catch (error) {
    console.error('API error', error);
    const validation = error instanceof Error && /无效的 JSON|请填写|自定义标签|规则系统最多|规则名最多/.test(error.message);
    return fail(validation ? error.message : '操作失败，请稍后重试', validation ? 400 : 500);
  }
}
