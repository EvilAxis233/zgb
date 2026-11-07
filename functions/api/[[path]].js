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
const campaignTags = (c) => [...new Set([...parseTags(c.custom_tags), ...parseTags(c.preset_tags)].map((tag) => Array.from(String(tag).trim()).slice(0, 6).join('')).filter(Boolean))].slice(0, 6);
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
// 规则库只保留最近使用的 RULE_LIMIT 个，保证后台与发车下拉完全一致。
async function touchRule(db, name, iso) {
  await db.prepare('INSERT INTO rules(name,created_at,last_used_at) VALUES(?,?,?) ON CONFLICT(name) DO UPDATE SET last_used_at=excluded.last_used_at').bind(name, iso, iso).run();
  await db.prepare('DELETE FROM rules WHERE name NOT IN (SELECT name FROM rules ORDER BY last_used_at DESC, rowid DESC LIMIT ?)').bind(RULE_LIMIT).run();
}
const userDto = (u) => {
  const role = roleOf(u);
  const permanent = role === 'owner' || u.membership_expires_at === PERMANENT_MEMBERSHIP;
  return { id: u.qq, qq: u.qq, name: u.name, avatar: assetUrl(u.avatar_key), bio: u.bio, preferences: parseTags(u.preferences), taboos: parseTags(u.taboos), receivedGmPraises: u.received_gm, receivedPlayerPraises: u.received_player, inventory: { gmHearts: u.gm_hearts, playerHearts: u.player_hearts }, lastCheckInDate: u.last_checkin || '', role, isAdmin: !!role, isOwner: role === 'owner', membershipPermanent: permanent, membershipExpiresAt: permanent ? PERMANENT_MEMBERSHIP : u.membership_expires_at ?? null, nameplate: parseJsonSafe(u.nameplate), stickers: parseTags(u.stickers).map((key) => assetUrl(key)).filter(Boolean), stickerKeys: parseTags(u.stickers), stickerLibrary: parseTags(u.sticker_library).map((key) => assetUrl(key)).filter(Boolean), stickerLibraryKeys: parseTags(u.sticker_library) };
};
const publicUserDto = (u) => ({ ...userDto(u), role: null, isAdmin: false, isOwner: false, inventory: { gmHearts: 0, playerHearts: 0 }, lastCheckInDate: '', membershipExpiresAt: null, membershipPermanent: false, stickerKeys: [], stickerLibrary: [], stickerLibraryKeys: [] });
const campaignExpired = (c) => (c.scheduled_date || String(c.time_schedule || '').slice(0, 10)) < dateHK();
const campDto = (c, signedUp = false, canSeeContact = false) => {
  const currentPlayers = Number(c.member_count || 0);
  return { id: c.id, kind: c.kind || 'online', province: c.province || '', city: c.city || '', address: c.address || '', batchId: c.batch_id || null, title: c.title, rule: c.rule, sessionType: c.kind === 'offline' ? '' : c.session_type === '留言板' ? '其他游戏形式' : c.session_type || '语音', platforms: parseTags(c.platforms), presetTags: [], customTags: campaignTags(c), summary: c.summary || '', description: c.description, timeSchedule: c.time_schedule, imageUrl: assetUrl(c.image_key), imageKey: c.image_key, bannerColor: c.banner_color, maxPlayers: c.max_players, currentPlayers, isClosed: !!c.closed_at, isFull: c.kind !== 'promo' && currentPlayers >= c.max_players, hasEnded: !!c.finished_at, hasExpired: campaignExpired(c), isSignedUp: signedUp, gmId: c.gm_qq, gmName: c.gm_name, gmAvatar: assetUrl(c.gm_avatar_key), gmQq: c.gm_qq, gmPraises: Number(c.gm_received_praises ?? c.received_gm ?? 0), gmNameplate: parseJsonSafe(c.gm_nameplate), gmStickers: parseTags(c.sticker_override || c.gm_stickers).map((key) => assetUrl(key)).filter(Boolean), gmIsMember: c.gm_role === 'owner' || Number(c.gm_membership_expires_at ?? 0) > now(), contact: canSeeContact ? (c.contact || c.gm_qq) : undefined, createdAt: c.created_at.slice(0, 10) };
};
const slotDto = (c, joined) => ({ id: c.id, timeSchedule: c.time_schedule, currentPlayers: Number(c.member_count || 0), maxPlayers: c.max_players, isClosed: !!c.closed_at, isFull: c.kind !== 'promo' && Number(c.member_count || 0) >= c.max_players, hasEnded: !!c.finished_at, hasExpired: campaignExpired(c), isSignedUp: joined.has(c.id) });
const batchMasterDto = (b) => ({ id: b.id, kind: b.kind || 'online', province: b.province || '', city: b.city || '', address: b.address || '', title: b.title, rule: b.rule, sessionType: b.session_type, platforms: parseTags(b.platforms), presetTags: [], customTags: campaignTags(b), maxPlayers: b.max_players, contact: b.contact, description: b.description, imageUrl: assetUrl(b.image_key), bannerColor: b.banner_color });
function campaignsDto(rows, joined = new Set(), viewer = null, batchMasters = new Map()) {
  const groups = new Map();
  for (const c of rows) if (c.batch_id) groups.set(c.batch_id, [...(groups.get(c.batch_id) || []), c]);
  return rows.map((c) => ({ ...campDto(c, joined.has(c.id), (c.kind === 'promo' && !!viewer) || viewer === c.gm_qq || joined.has(c.id)), ...(c.batch_id ? { slots: groups.get(c.batch_id).map((slot) => slotDto(slot, joined)).sort((a, b) => a.timeSchedule.localeCompare(b.timeSchedule)) } : {}), ...(viewer === c.gm_qq && batchMasters.has(c.batch_id) ? { batchMaster: batchMasterDto(batchMasters.get(c.batch_id)) } : {}) }));
}
const memberDto = (u, role) => ({ id: u.qq, name: u.name, avatar: assetUrl(u.avatar_key), role, receivedPraises: role === 'gm' ? u.received_gm : u.received_player, nameplate: parseJsonSafe(u.nameplate), stickers: parseTags(u.stickers).map((key) => assetUrl(key)).filter(Boolean), isMember: isMember(u), ...(role === 'gm' ? { bio: u.bio, preferences: parseTags(u.preferences), taboos: parseTags(u.taboos) } : {}) });
async function body(request) { try { return await request.json(); } catch { throw new Error('无效的 JSON 请求'); } }
function sessionCookie(token, age) { return `zgb_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
function adminCookie(token, age) { return `zgb_admin=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${age}`; }
// 后台只认 QQ 登录 + 角色（owner/admin）；旧的密码应急通道已下线。
const adminAuth = async (request, db) => isSiteAdmin(await auth(request, db));
async function auth(request, db) {
  const token = /(?:^|;\s*)zgb_session=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (!token) return null;
  const user = await db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.qq=s.qq WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token), now()).first();
  return user;
}
async function sendCode(env, qq, code) {
  if (!env.RESEND_API_KEY) return { ok: false, reason: 'missing_key' };
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM || '诸告板 <login@mail.dhvault.top>', to: `${qq}@qq.com`, subject: '诸告板登录验证码', text: `验证码：${code}\n十分钟内有效。如非本人操作，请忽略此邮件。` }) });
  if (response.ok) return { ok: true };
  const error = await response.json().catch(() => ({}));
  return { ok: false, status: response.status, reason: typeof error.name === 'string' ? error.name.slice(0, 80) : 'unknown' };
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
  const presetTags = [];
  if (!Array.isArray(b.customTags ?? [])) throw new Error('自定义标签格式无效');
  const customTags = [...new Set((b.customTags || []).map((tag) => typeof tag === 'string' ? tag.trim() : '').filter(Boolean))];
  if (customTags.length > 6 || customTags.some((tag) => Array.from(tag).length > 6)) throw new Error('最多 6 个自定义标签，每个最多 6 字');
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
      await db.prepare('UPDATE campaigns SET closed_at=? WHERE deleted_at IS NULL AND closed_at IS NULL AND finished_at IS NULL AND scheduled_date<?').bind(new Date().toISOString(), dateHK()).run();
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
        const [users, campaigns, engagement, submissions, campaignKinds, topRules, dailyUsers, dailyCampaigns] = await db.batch([
          db.prepare(`SELECT COUNT(*) total,
            SUM(CASE WHEN substr(created_at,1,10)=? THEN 1 ELSE 0 END) today,
            SUM(CASE WHEN substr(created_at,1,10)>=? THEN 1 ELSE 0 END) last7,
            SUM(CASE WHEN substr(created_at,1,10)>=? THEN 1 ELSE 0 END) last30
            FROM users`).bind(today, asDate(sevenDaysAgo), asDate(thirtyDaysAgo)),
          db.prepare(`SELECT COUNT(*) total,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NULL AND closed_at IS NULL AND scheduled_date>=? AND (kind='promo' OR (SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)<max_players) THEN 1 ELSE 0 END) recruiting,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NOT NULL THEN 1 ELSE 0 END) finished,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NULL AND closed_at IS NOT NULL THEN 1 ELSE 0 END) closed,
            SUM(CASE WHEN deleted_at IS NOT NULL THEN 1 ELSE 0 END) deleted,
            COALESCE(SUM((SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)),0) members,
            COALESCE(ROUND(AVG(CASE WHEN deleted_at IS NULL AND kind<>'promo' THEN 100.0*(SELECT COUNT(*) FROM campaign_memberships m WHERE m.campaign_id=campaigns.id)/max_players END),1),0) avg_fill_rate
            FROM campaigns`).bind(today),
          db.prepare(`SELECT
            (SELECT COUNT(*) FROM campaign_memberships) memberships,
            (SELECT COUNT(*) FROM praises) praises,
            (SELECT COUNT(*) FROM praises WHERE type='gm') gm_praises,
            (SELECT COUNT(*) FROM praises WHERE type='player') player_praises,
            (SELECT COUNT(*) FROM sessions WHERE expires_at>?) active_sessions`).bind(now()),
          db.prepare(`SELECT COUNT(*) total,
            SUM(CASE WHEN type='feedback' THEN 1 ELSE 0 END) feedback,
            SUM(CASE WHEN type='report' THEN 1 ELSE 0 END) reports,
            SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) pending,
            SUM(CASE WHEN status='processing' THEN 1 ELSE 0 END) processing,
            SUM(CASE WHEN status='resolved' THEN 1 ELSE 0 END) resolved,
            SUM(CASE WHEN status='rejected' THEN 1 ELSE 0 END) rejected
            FROM submissions`),
          db.prepare(`SELECT kind,COUNT(*) total,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NULL AND closed_at IS NULL AND scheduled_date>=? THEN 1 ELSE 0 END) active,
            SUM(CASE WHEN deleted_at IS NULL AND finished_at IS NOT NULL THEN 1 ELSE 0 END) finished
            FROM campaigns GROUP BY kind ORDER BY total DESC`).bind(today),
          db.prepare(`SELECT rule,COUNT(*) total FROM campaigns WHERE deleted_at IS NULL GROUP BY rule ORDER BY total DESC,rule LIMIT 8`),
          db.prepare(`SELECT substr(created_at,1,10) day,COUNT(*) count FROM users WHERE substr(created_at,1,10)>=? GROUP BY day ORDER BY day`).bind(asDate(thirtyDaysAgo)),
          db.prepare(`SELECT substr(created_at,1,10) day,COUNT(*) count FROM campaigns WHERE substr(created_at,1,10)>=? GROUP BY day ORDER BY day`).bind(asDate(thirtyDaysAgo))
        ]);
        return json({
          users: users.results[0], campaigns: campaigns.results[0], engagement: engagement.results[0], submissions: submissions.results[0],
          campaignKinds: campaignKinds.results, topRules: topRules.results, dailyUsers: dailyUsers.results, dailyCampaigns: dailyCampaigns.results,
          generatedAt: new Date().toISOString()
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
        const [count, users] = await db.batch([
          db.prepare(`SELECT COUNT(*) n FROM users u ${where}`).bind(pattern, pattern),
          db.prepare(`SELECT u.qq,u.name,u.role,u.created_at,u.gm_hearts,u.player_hearts,u.received_gm,u.received_player,u.membership_expires_at,` +
            `(SELECT COUNT(*) FROM praises p WHERE p.from_qq=u.qq) sent_count,` +
            `(SELECT COUNT(*) FROM praises p WHERE p.to_qq=u.qq) received_count,` +
            `(SELECT COUNT(*) FROM submissions s WHERE s.type='report' AND s.reported_qq=u.qq) report_count,` +
            `b.expires_at blacklist_expires_at,b.banned_at blacklist_banned_at,` +
            `CASE WHEN b.qq IS NOT NULL AND b.lifted_at IS NULL AND (b.expires_at IS NULL OR b.expires_at>?) THEN 1 ELSE 0 END blacklisted ` +
            `FROM users u LEFT JOIN user_blacklist b ON b.qq=u.qq ${where} ORDER BY u.created_at DESC LIMIT 50 OFFSET ?`).bind(now(), pattern, pattern, offset)
        ]);
        return json({ users: users.results.map((account) => { const role = roleOf(account); const permanent = role === 'owner' || account.membership_expires_at === PERMANENT_MEMBERSHIP; return { ...account, role, isAdmin: !!role, isOwner: role === 'owner', membershipPermanent: permanent, membership_expires_at: permanent ? PERMANENT_MEMBERSHIP : account.membership_expires_at }; }), total: count.results[0].n });
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
        const status = ['pending','processing','resolved','rejected'].includes(url.searchParams.get('status')) ? url.searchParams.get('status') : '';
        const offset = Math.max(0, Math.min(100000, Math.floor(Number(url.searchParams.get('offset')) || 0)));
        const where = `WHERE (?='' OR s.type=?) AND (?='' OR s.status=?)`;
        const [count, rows] = await db.batch([
          db.prepare(`SELECT COUNT(*) n FROM submissions s ${where}`).bind(type, type, status, status),
          db.prepare(`SELECT s.*,u.name user_name,r.name reported_name FROM submissions s JOIN users u ON u.qq=s.user_qq LEFT JOIN users r ON r.qq=s.reported_qq ${where} ORDER BY CASE s.status WHEN 'pending' THEN 0 WHEN 'processing' THEN 1 ELSE 2 END,s.created_at DESC LIMIT 30 OFFSET ?`).bind(type, type, status, status, offset)
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
          const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
          const key = `submissions/${submissionId}/${index + 1}-${id()}.${ext}`;
          await env.COVERS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
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
      const b = await body(request), name = clean(b.name, 40), bio = clean(b.bio, 1000);
      const tags = (v) => Array.isArray(v) ? [...new Set(v.map((x) => clean(x, 40)).filter(Boolean))].slice(0, 20) : [];
      if (!name) return fail('昵称不能为空');
      if (nicknameLength(name) > 20) return fail('昵称最多 10 个中文字符或 20 个英文字符，中文及全角字符按 2 个计算');
      const duplicate = await db.prepare('SELECT 1 FROM users WHERE name=? COLLATE NOCASE AND qq!=?').bind(name, user.qq).first();
      if (duplicate) return fail('该昵称已被使用，请换一个昵称', 409);
      await db.prepare('UPDATE users SET name=?,bio=?,preferences=?,taboos=? WHERE qq=?').bind(name, bio, JSON.stringify(tags(b.preferences)), JSON.stringify(tags(b.taboos)), user.qq).run();
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
        if (!allowedStyles.includes(styleId) && !isReferenceStyle) return fail('无效的铭牌样式');
        const text = clean(b.nameplate.text, 20);
        if (!text) return fail('铭牌文字不能为空');
        let zh = 0, en = 0;
        for (const ch of text) {
          if (/[\u4e00-\u9fa5]/.test(ch)) zh++;
          else en++;
        }
        if (zh > 4 || (zh * 2 + en) > 8) return fail('铭牌最多 4 个汉字或 8 个英文字符');
        await db.prepare('UPDATE users SET nameplate=? WHERE qq=?').bind(JSON.stringify({ styleId, text }), user.qq).run();
      }
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
      if (!(file instanceof File) || !['image/png','image/jpeg','image/gif','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) return fail('仅支持小于 2MB 的 PNG、JPG、GIF、WebP 图片');
      const ext = file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1];
      const key = `avatars/${id()}.${ext}`;
      await env.COVERS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      await db.prepare('UPDATE users SET avatar_key=? WHERE qq=?').bind(key, user.qq).run();
      return json({ avatar: assetUrl(key) });
    }
    if (path[0] === 'checkin' && method === 'POST') {
      const today = dateHK();
      const yesterday = dateHK(new Date(Date.now() - 86400000));
      const checkedAt = now();
      const memberNow = isMember(user) ? 1 : 0;
      const result = await db.prepare(`UPDATE users SET
        gm_hearts=gm_hearts+CASE
          WHEN ?=1 THEN CASE WHEN (member_checkin_count+1)%7=0 THEN 3 ELSE 0 END
          WHEN last_checkin=? AND (checkin_streak+1)%7=0 THEN 1 ELSE 0 END,
        member_checkin_count=member_checkin_count+CASE WHEN ?=1 THEN 1 ELSE 0 END,
        checkin_streak=CASE WHEN last_checkin=? THEN checkin_streak+1 ELSE 1 END,
        last_checkin=?,player_hearts=player_hearts+1
        WHERE qq=? AND (last_checkin IS NULL OR last_checkin<>?)
        RETURNING checkin_streak,member_checkin_count,membership_expires_at`).bind(memberNow, yesterday, memberNow, yesterday, today, user.qq, today).first();
      if (!result) return fail('今日已签到');
      const streak = result.checkin_streak;
      const memberAfter = !!memberNow;
      const progress = memberAfter ? result.member_checkin_count : streak;
      const gmHeartsAwarded = progress % 7 === 0 ? (memberAfter ? 3 : 1) : 0;
      return json({ ok: true, streak, memberCheckinCount: result.member_checkin_count, isMember: memberAfter,
        daysUntilGmReward: gmHeartsAwarded ? 0 : 7 - progress % 7,
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
      if (!(file instanceof File) || !['image/png','image/jpeg','image/gif','image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) return fail('仅支持小于 2MB 的 PNG、JPG、GIF、WebP 图片');
      const key = `${id()}.${file.type.split('/')[1] === 'jpeg' ? 'jpg' : file.type.split('/')[1]}`;
      await env.COVERS.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
      return json({ imageKey: key, imageUrl: `/api/images/${key}` });
    }
    if (path[0] === 'campaigns' && method === 'POST' && path.length === 1) {
      const b = await body(request), c = validateCampaign(b), imageKey = clean(b.imageKey, 100) || null;
      if (imageKey && !await env.COVERS?.head(imageKey)) return fail('图片不存在');
      // 贴纸只能从个人贴纸库里挑：本团临时选择，不改默认佩戴
      const library = parseTags(user.sticker_library);
      const pickedStickers = Array.isArray(b.stickerKeys) ? [...new Set(b.stickerKeys.map((item) => clean(item, 120)).filter(Boolean))].slice(0, 2) : [];
      if (pickedStickers.some((key) => !library.includes(key))) return fail('只能从贴纸库中选择贴纸');
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
      if (!c) return fail('团不存在', 404);
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
        return result.meta.changes ? json({ ok: true }, 201) : fail('你已经报名或该团已满员', 409);
      }
      if (path[2] === 'signup' && path.length === 3 && method === 'DELETE') {
        if (campaignExpired(c) || c.finished_at) return fail('开团日结束后不能取消报名');
        if (c.closed_at) return fail('本团已锁车，不能取消报名', 409);
        const result = await db.prepare('DELETE FROM campaign_memberships WHERE campaign_id=? AND user_qq=? AND EXISTS(SELECT 1 FROM campaigns WHERE id=? AND closed_at IS NULL AND finished_at IS NULL AND scheduled_date>=?)').bind(cid, user.qq, cid, dateHK()).run();
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
      if (path[2] === 'status' && path.length === 3 && method === 'PATCH') {
        const b = await body(request);
        if (typeof b.closed !== 'boolean') return fail('状态无效');
        if (c.kind === 'promo' && !b.closed) return fail('宣群封车后不能重新开放', 409);
        if (c.finished_at) return fail('已结团，不能重新开放', 409);
        if (!b.closed && campaignExpired(c)) return fail('预定时间已过，请先修改时间', 409);
        await db.prepare('UPDATE campaigns SET closed_at=? WHERE id=?').bind(b.closed ? new Date().toISOString() : null, cid).run();
        return json({ ok: true });
      }
      if (path.length === 2 && method === 'PATCH') {
        const b = await body(request);
        if (c.batch_id) {
          if (!b || typeof b.description !== 'string' || !Array.isArray(b.customTags) || Object.keys(b).some((key) => !['description','presetTags','customTags'].includes(key))) return fail('批量团只允许修改简介和标签');
          const tags = validateCampaign({ ...campDto(c), ...b }, c.kind, false);
          const presetTags = JSON.stringify(tags.presetTags), customTags = JSON.stringify(tags.customTags);
          // 站长/管理员可代为修改任意批量团；主持人只能改自己的。
          const ownerFilter = c.gm_qq === user.qq ? ' AND gm_qq=?' : '';
          const ownerBinds = c.gm_qq === user.qq ? [user.qq] : [];
          await db.batch([
            db.prepare(`UPDATE campaign_batches SET description=?,preset_tags=?,custom_tags=? WHERE id=?${ownerFilter}`).bind(tags.description, presetTags, customTags, c.batch_id, ...ownerBinds),
            db.prepare(`UPDATE campaigns SET description=?,preset_tags=?,custom_tags=? WHERE batch_id=? AND deleted_at IS NULL${ownerFilter}`).bind(tags.description, presetTags, customTags, c.batch_id, ...ownerBinds)
          ]);
          const nowIso = new Date().toISOString();
          for (const tag of tags.customTags) {
            await db.prepare('INSERT INTO custom_tags(name,use_count,last_used_at,created_at) VALUES(?,1,?,?) ON CONFLICT(name) DO UPDATE SET use_count=use_count+1,last_used_at=excluded.last_used_at').bind(tag, nowIso, nowIso).run();
          }
          return json({ ok: true });
        }
        if (c.finished_at) return fail('已结团，不能修改', 409);
        const data = validateCampaign(b, c.kind), imageKey = b.imageKey === null ? null : clean(b.imageKey, 100) || c.image_key;
        if (data.scheduledDate < dateHK()) return fail('开团日期不能早于今天');
        if (imageKey && !await env.COVERS?.head(imageKey)) return fail('图片不存在');
        const contact = data.contact || c.contact || user.qq;
        const nowIso = new Date().toISOString();
        await db.batch([
          db.prepare('UPDATE campaigns SET title=?,rule=?,summary=?,description=?,time_schedule=?,scheduled_date=?,time_period=?,image_key=?,banner_color=?,max_players=?,contact=?,session_type=?,platforms=?,preset_tags=?,custom_tags=?,province=?,city=?,address=? WHERE id=?').bind(data.title, data.rule, data.summary || '', data.description, data.time, data.scheduledDate, data.period, imageKey, data.color, data.players, contact, data.sessionType, JSON.stringify(data.platforms), JSON.stringify(data.presetTags), JSON.stringify(data.customTags), data.province, data.city, data.address, cid)
        ]);
        await touchRule(db, data.rule, nowIso);
        for (const tag of data.customTags) {
          await db.prepare('INSERT INTO custom_tags(name,use_count,last_used_at,created_at) VALUES(?,1,?,?) ON CONFLICT(name) DO UPDATE SET use_count=use_count+1,last_used_at=excluded.last_used_at').bind(tag, nowIso, nowIso).run();
        }
        return json({ ok: true });
      }
      if (path.length === 2 && method === 'DELETE') {
        await db.batch([
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
