const json = (data, status = 200, headers = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
const fail = (message, status = 400) => json({ error: message }, status);
const now = () => Math.floor(Date.now() / 1000);
const dateHK = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const id = () => crypto.randomUUID();
const hex = (bytes) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
async function sha256(value) { return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))); }
async function hmac(value, secret) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value))));
}
const qqValid = (v) => typeof v === 'string' && /^[1-9][0-9]{4,11}$/.test(v);
const clean = (v, max) => typeof v === 'string' ? v.trim().slice(0, max) : '';
const parseTags = (s) => { try { return JSON.parse(s || '[]'); } catch { return []; } };
const userDto = (u) => ({ id: u.qq, qq: u.qq, name: u.name, bio: u.bio, preferences: parseTags(u.preferences), taboos: parseTags(u.taboos), receivedGmPraises: u.received_gm, receivedPlayerPraises: u.received_player, inventory: { gmHearts: u.gm_hearts, playerHearts: u.player_hearts }, lastCheckInDate: u.last_checkin || '' });
const publicUserDto = (u) => ({ ...userDto(u), inventory: { gmHearts: 0, playerHearts: 0 }, lastCheckInDate: '' });
const campDto = (c) => ({ id: c.id, title: c.title, rule: c.rule, summary: c.summary, description: c.description, timeSchedule: c.time_schedule, imageUrl: c.image_key ? `/api/images/${c.image_key}` : '', imageKey: c.image_key, bannerColor: c.banner_color, status: c.status, maxPlayers: c.max_players, currentPlayers: 0, gmId: c.gm_qq, gmName: c.gm_name, gmQq: c.gm_qq, createdAt: c.created_at.slice(0, 10), voucherCode: c.voucher_code || undefined, voucherLimit: c.voucher_limit ?? undefined, voucherUsed: c.voucher_used });
const partDto = (p) => ({ id: p.id, userId: p.user_qq, campaignId: p.campaign_id, campaignTitle: p.title, gmName: p.gm_name, rule: p.rule, redeemedAt: p.redeemed_at.slice(0, 10), voucherCode: '' });
async function body(request) { try { return await request.json(); } catch { throw new Error('无效的 JSON 请求'); } }
function sessionCookie(token, age) { return `zgb_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${age}`; }
async function auth(request, db) {
  const token = /(?:^|;\s*)zgb_session=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (!token) return null;
  return db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.qq=s.qq WHERE s.token_hash=? AND s.expires_at>?').bind(await sha256(token), now()).first();
}
async function sendCode(env, qq, code) {
  if (!env.RESEND_API_KEY) return { ok: false, reason: 'missing_key' };
  const response = await fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ from: env.RESEND_FROM || '诸告板 <login@mail.dhvault.top>', to: `${qq}@qq.com`, subject: '诸告板登录验证码', text: `验证码：${code}\n十分钟内有效。如非本人操作，请忽略此邮件。` }) });
  if (response.ok) return { ok: true };
  const error = await response.json().catch(() => ({}));
  return { ok: false, status: response.status, reason: typeof error.name === 'string' ? error.name.slice(0, 80) : 'unknown' };
}
function validateCampaign(b) {
  const title = clean(b.title, 100), rule = clean(b.rule, 100), summary = clean(b.summary, 300), time = clean(b.timeSchedule, 200);
  const players = Number(b.maxPlayers);
  if (!title || !rule || !summary || !time || !Number.isInteger(players) || players < 1 || players > 12) throw new Error('请填写完整团名、规则、简介、时间和 1–12 人的预计人数');
  return { title, rule, summary, time, players, description: clean(b.description, 10000), color: /^#[0-9a-fA-F]{6}$/.test(b.bannerColor) ? b.bannerColor : '#D62828' };
}
const campaignSelect = `SELECT c.*,u.name gm_name FROM campaigns c JOIN users u ON u.qq=c.gm_qq WHERE c.deleted_at IS NULL`;

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').split('/').filter(Boolean);
  const method = request.method;
  const db = env.DB;
  if (!db) return fail('数据库未配置', 503);
  try {
    if (method !== 'GET' && method !== 'HEAD' && request.headers.get('Origin') && request.headers.get('Origin') !== url.origin) return fail('请求来源无效', 403);
    if (path[0] === 'health' && method === 'GET') { await db.prepare('SELECT 1').first(); return json({ ok: true }); }
    if (path[0] === 'images' && method === 'GET' && path[1]) {
      const object = await env.COVERS?.get(path[1]);
      return object ? new Response(object.body, { headers: { 'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' } }) : fail('图片不存在', 404);
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
    const user = await auth(request, db);
    if (path[0] === 'auth' && path[1] === 'me' && method === 'GET') return json({ user: user ? userDto(user) : null });
    if (path[0] === 'auth' && path[1] === 'logout' && method === 'POST') {
      const token = /(?:^|;\s*)zgb_session=([^;]+)/.exec(request.headers.get('Cookie') || '')?.[1];
      if (token) await db.prepare('DELETE FROM sessions WHERE token_hash=?').bind(await sha256(token)).run();
      return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
    }
    if (path[0] === 'campaigns' && path.length === 1 && method === 'GET') {
      const rows = await db.prepare(`${campaignSelect} ORDER BY c.created_at DESC`).all();
      const hosts = await db.prepare('SELECT DISTINCT u.* FROM users u JOIN campaigns c ON c.gm_qq=u.qq WHERE c.deleted_at IS NULL').all();
      return json({ campaigns: rows.results.map((c) => { const dto = campDto(c); delete dto.voucherCode; return dto; }), users: hosts.results.map(publicUserDto) });
    }
    if (!user) return fail('请先登录', 401);
    if (path[0] === 'bootstrap' && method === 'GET') {
      const [cs, ps, hosts] = await db.batch([
        db.prepare(`${campaignSelect} ORDER BY c.created_at DESC`),
        db.prepare('SELECT p.*,c.title,c.rule,u.name gm_name FROM participations p JOIN campaigns c ON c.id=p.campaign_id JOIN users u ON u.qq=c.gm_qq WHERE p.user_qq=? ORDER BY p.redeemed_at DESC').bind(user.qq),
        db.prepare('SELECT DISTINCT u.* FROM users u JOIN campaigns c ON c.gm_qq=u.qq WHERE c.deleted_at IS NULL')
      ]);
      return json({ user: userDto(user), users: hosts.results.map(publicUserDto), campaigns: cs.results.map((c) => c.gm_qq === user.qq ? campDto(c) : (() => { const dto = campDto(c); delete dto.voucherCode; return dto; })()), participations: ps.results.map(partDto) });
    }
    if (path[0] === 'profile' && method === 'PATCH') {
      const b = await body(request), name = clean(b.name, 40), bio = clean(b.bio, 1000);
      const tags = (v) => Array.isArray(v) ? [...new Set(v.map((x) => clean(x, 40)).filter(Boolean))].slice(0, 20) : [];
      if (!name) return fail('昵称不能为空');
      await db.prepare('UPDATE users SET name=?,bio=?,preferences=?,taboos=? WHERE qq=?').bind(name, bio, JSON.stringify(tags(b.preferences)), JSON.stringify(tags(b.taboos)), user.qq).run();
      return json({ ok: true });
    }
    if (path[0] === 'checkin' && method === 'POST') {
      const today = dateHK();
      const result = await db.prepare('UPDATE users SET last_checkin=?,player_hearts=player_hearts+1 WHERE qq=? AND (last_checkin IS NULL OR last_checkin<>?)').bind(today, user.qq, today).run();
      return result.meta.changes ? json({ ok: true }) : fail('今日已签到');
    }
    if (path[0] === 'praise' && method === 'POST') {
      const b = await body(request), target = String(b.toUserId || ''), type = b.type;
      if (!['gm','player'].includes(type) || !qqValid(target) || target === user.qq) return fail('点赞对象无效');
      const column = type === 'gm' ? 'gm_hearts' : 'player_hearts', received = type === 'gm' ? 'received_gm' : 'received_player';
      const result = await db.batch([
        db.prepare(`UPDATE users SET ${column}=${column}-1 WHERE qq=? AND ${column}>0 AND EXISTS(SELECT 1 FROM users WHERE qq=?)`).bind(user.qq, target),
        db.prepare(`UPDATE users SET ${received}=${received}+1 WHERE qq=? AND changes()=1`).bind(target),
        db.prepare('INSERT INTO praises(id,from_qq,to_qq,type,created_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(id(), user.qq, target, type, new Date().toISOString())
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
      const cid = id();
      await db.prepare('INSERT INTO campaigns(id,gm_qq,title,rule,summary,description,time_schedule,image_key,banner_color,max_players,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(cid, user.qq, c.title, c.rule, c.summary, c.description, c.time, imageKey, c.color, c.players, new Date().toISOString()).run();
      return json({ id: cid }, 201);
    }
    if (path[0] === 'campaigns' && path[1]) {
      const cid = path[1], c = await db.prepare(`${campaignSelect} AND c.id=?`).bind(cid).first();
      if (!c) return fail('团不存在', 404);
      if (c.gm_qq !== user.qq) return fail('只有主持人可以操作', 403);
      if (path.length === 2 && method === 'PATCH') {
        const b = await body(request), data = validateCampaign(b), imageKey = b.imageKey === null ? null : clean(b.imageKey, 100) || c.image_key;
        if (imageKey && !await env.COVERS?.head(imageKey)) return fail('图片不存在');
        await db.prepare('UPDATE campaigns SET title=?,rule=?,summary=?,description=?,time_schedule=?,image_key=?,banner_color=?,max_players=? WHERE id=?').bind(data.title, data.rule, data.summary, data.description, data.time, imageKey, data.color, data.players, cid).run();
        return json({ ok: true });
      }
      if (path.length === 2 && method === 'DELETE') { await db.prepare('UPDATE campaigns SET deleted_at=? WHERE id=?').bind(new Date().toISOString(), cid).run(); return json({ ok: true }); }
      if (path[2] === 'status' && method === 'POST') {
        const b = await body(request), status = b.status;
        if (!['recruiting','full','closed','concluded'].includes(status) || (c.status === 'concluded' && status !== 'concluded')) return fail('状态无效');
        await db.prepare('UPDATE campaigns SET status=? WHERE id=?').bind(status, cid).run(); return json({ ok: true });
      }
      if (path[2] === 'voucher' && method === 'POST') {
        if (c.status !== 'concluded') return fail('只有完结的团可以生成凭证');
        if (c.voucher_code) return json({ voucherCode: c.voucher_code, voucherLimit: c.voucher_limit });
        const code = `TRPG-${hex(crypto.getRandomValues(new Uint8Array(6))).toUpperCase()}`;
        await db.prepare('UPDATE campaigns SET voucher_code=?,voucher_limit=max_players WHERE id=? AND voucher_code IS NULL').bind(code, cid).run();
        const updated = await db.prepare('SELECT voucher_code,voucher_limit FROM campaigns WHERE id=?').bind(cid).first();
        return json({ voucherCode: updated.voucher_code, voucherLimit: updated.voucher_limit });
      }
    }
    if (path[0] === 'redeem' && method === 'POST') {
      const b = await body(request), code = clean(b.code, 100).toUpperCase();
      const c = await db.prepare('SELECT * FROM campaigns WHERE voucher_code=? AND deleted_at IS NULL').bind(code).first();
      if (!c || c.status !== 'concluded') return fail('无效凭证');
      if (c.gm_qq === user.qq) return fail('主持人不能领取自己的凭证');
      const pid = id();
      const result = await db.batch([
        db.prepare('UPDATE campaigns SET voucher_used=voucher_used+1 WHERE id=? AND voucher_used<voucher_limit AND NOT EXISTS(SELECT 1 FROM participations WHERE campaign_id=? AND user_qq=?)').bind(c.id, c.id, user.qq),
        db.prepare('INSERT INTO participations(id,campaign_id,user_qq,redeemed_at) SELECT ?,?,?,? WHERE changes()=1').bind(pid, c.id, user.qq, new Date().toISOString()),
        db.prepare('UPDATE users SET gm_hearts=gm_hearts+1 WHERE qq=? AND changes()=1').bind(user.qq)
      ]);
      return result[0].meta.changes ? json({ ok: true }) : fail('凭证已领完或你已经领取');
    }
    return fail('接口不存在', 404);
  } catch (error) {
    console.error('API error', error);
    const validation = error instanceof Error && /无效的 JSON|请填写/.test(error.message);
    return fail(validation ? error.message : '操作失败，请稍后重试', validation ? 400 : 500);
  }
}
