import { useEffect, useState, type FormEvent } from 'react';
import { Activity, Archive, BarChart3, FileSliders, Headphones, LayoutDashboard, LogOut, Plus, Shield, ShieldCheck, Trash2, UsersRound } from 'lucide-react';
import { adminApi, type AdminDashboard, type AdminUser, type MembershipGrant } from '../services/api';
import { AdminUsersSection } from './AdminUsersSection';
import { AdminSupportSection } from './AdminSupportSection';
import { AdminArchivedSection } from './AdminArchivedSection';
import { AdminResourcesSection } from './AdminResourcesSection';
import { number } from './AdminCommon';
import { useDialog } from './BauhausDialog';

type AdminSection = 'dashboard' | 'content' | 'users' | 'support' | 'archive' | 'resources';
const sections: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: '数据看板', icon: LayoutDashboard },
  { id: 'content', label: '内容配置', icon: FileSliders },
  { id: 'users', label: '账号', icon: UsersRound },
  { id: 'support', label: '客服系统', icon: Headphones },
  { id: 'archive', label: '封存团务', icon: Archive },
  { id: 'resources', label: '资源审核', icon: ShieldCheck },
];

function MetricCard({ label, value, note, tone = 'blue', live = false }: { label: string; value: unknown; note: string; tone?: 'red' | 'blue' | 'yellow' | 'black'; live?: boolean }) {
  const color = { red: '#D62828', blue: '#004E98', yellow: '#C85C16', black: '#121212' }[tone];
  return <article className="bauhaus-card bg-white px-4 py-2 relative overflow-hidden flex flex-col justify-center"><span className="absolute top-0 left-0 w-full h-1" style={{ backgroundColor: color }} /><p className="text-[11px] font-black text-[#666] leading-tight flex items-center gap-1.5">{live && <span className="w-2 h-2 bg-[#2E7D32] animate-pulse" />}{label}</p><strong className="block text-3xl font-black leading-tight" style={{ color }}>{number(value)}</strong><p className="text-[11px] text-[#777] leading-tight">{note}</p></article>;
}

function StatCell({ label, value, color }: { label: string; value: unknown; color?: string }) {
  return <div><span className="block text-[10px] font-bold text-[#666]">{label}</span><strong className="text-xl font-black" style={color ? { color } : undefined}>{typeof value === 'string' ? value : number(value)}</strong></div>;
}

function Dashboard({ data, loading }: { data: AdminDashboard | null; loading: boolean }) {
  if (loading || !data) return <div className="bauhaus-card bg-white h-full flex items-center justify-center font-bold text-sm">正在汇总看板数据…</div>;
  // 补齐完整的 30 天时间轴，没有数据的日期也占位，图表不会有大片空洞。
  const hkParts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const hkPart = (type: string) => hkParts.find((part) => part.type === type)?.value || '';
  const endDay = `${hkPart('year')}-${hkPart('month')}-${hkPart('day')}`;
  const end = new Date(endDay + 'T00:00:00Z');
  const trends = Array.from({ length: 30 }, (_, i) => { const d = new Date(end); d.setUTCDate(end.getUTCDate() - (29 - i)); return d.toISOString().slice(0, 10); });
  const userMap = new Map(data.dailyUsers.map((item) => [item.day, Number(item.count)]));
  const campaignMap = new Map(data.dailyCampaigns.map((item) => [item.day, Number(item.count)]));
  const sumUsers = trends.reduce((sum, day) => sum + (userMap.get(day) || 0), 0);
  const sumCampaigns = trends.reduce((sum, day) => sum + (campaignMap.get(day) || 0), 0);
  const maxTrend = Math.max(1, ...trends.flatMap((day) => [userMap.get(day) || 0, campaignMap.get(day) || 0]));
  const peakUsers = Math.max(0, ...trends.map((day) => userMap.get(day) || 0));
  const peakCampaigns = Math.max(0, ...trends.map((day) => campaignMap.get(day) || 0));
  const kindNames = { online: '网团', offline: '面团', promo: '宣群' };
  const c = data.campaigns, e = data.engagement, sub = data.submissions;
  return <div className="flex flex-col gap-2 lg:h-full lg:min-h-0">
    <div className="flex items-center justify-between gap-3 shrink-0"><div className="flex items-baseline gap-2"><h3 className="text-base font-black">平台总览</h3><p className="text-[11px] text-[#666]">宣群不计入团次与报名率 · 每 30 秒自动刷新</p></div><time className="text-[11px] text-[#777] shrink-0">更新于 {new Date(data.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}</time></div>
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
      <MetricCard label="注册用户" value={data.users.total} note={`今日 +${number(data.users.today)} · 近 30 天 +${number(data.users.last30)}`} />
      <MetricCard label="全部团次" value={c.total} note={`网团 ${number(c.online_total)} + 面团 ${number(c.offline_total)} · 不含宣群`} tone="red" />
      <MetricCard label="实时在线人数" value={e.online_now} note={`近 ${number(data.onlineWindow)} 分钟活跃 · 会话 ${number(e.active_sessions)}`} live />
      <MetricCard label="待办工单" value={Number(sub.pending) + Number(sub.processing)} note={`待受理 ${number(sub.pending)} · 处理中 ${number(sub.processing)}`} tone="black" />
    </section>
    <section className="grid grid-cols-2 lg:grid-cols-4 gap-2 shrink-0">
      <MetricCard label="网团" value={c.online_total} note={`招募中 ${number(c.online_recruiting)} · 封车 ${number(c.online_closed)}`} />
      <MetricCard label="面团" value={c.offline_total} note={`招募中 ${number(c.offline_recruiting)} · 封车 ${number(c.offline_closed)}`} tone="red" />
      <MetricCard label="宣群（现存）" value={c.promo_live} note={`历史 ${number(c.promo_history)} · 共计 ${number(c.promo_total)} · 不算开团`} tone="yellow" />
      <MetricCard label="累计点赞" value={e.praises} note={`GM ${number(e.gm_praises)} · 玩家 ${number(e.player_praises)}`} tone="yellow" />
    </section>
    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3 lg:flex-1 lg:min-h-0">
      <section className="bauhaus-card bg-white p-3 min-w-0 flex flex-col min-h-[240px] lg:min-h-0">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-1.5 mb-2 shrink-0"><h3 className="text-base font-black flex items-center gap-1.5"><Activity size={16} className="text-[#004E98]" />近 30 天增长</h3><div className="flex gap-3 text-[11px] font-bold"><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 bg-[#004E98]" />用户 +{number(sumUsers)}</span><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 bg-[#D62828]" />开团 +{number(sumCampaigns)}（不含宣群）</span></div></div>
        <div className="relative flex-1 min-h-0 border-b border-l border-[#AAA] pl-8 pr-1 pt-5" aria-label="近 30 天用户与开团增长柱状图">
          <div className="absolute left-0 top-4 bottom-0 w-7 flex flex-col justify-between text-[10px] font-bold text-[#777] text-right pr-1 pointer-events-none"><span>{maxTrend}</span><span>{Math.round(maxTrend / 2)}</span><span>0</span></div>
          <div className="absolute left-8 right-1 top-5 bottom-0 flex flex-col justify-between pointer-events-none"><span className="block border-t border-dashed border-[#DDD]" /><span className="block border-t border-dashed border-[#DDD]" /><span className="block border-t border-dashed border-[#DDD]" /></div>
          <div className="relative h-full flex items-end gap-px">{trends.map((day) => { const u = userMap.get(day) || 0, n = campaignMap.get(day) || 0; return <div key={day} className="flex-1 min-w-0 h-full flex items-end justify-center gap-px" title={`${day}：新增用户 ${u} · 新开团 ${n}（不含宣群）`}><div className="relative w-1/2 min-h-[2px] bg-[#004E98]" style={{ height: `${Math.max(2, (u / maxTrend) * 100)}%` }}>{u > 0 && <span className="absolute bottom-full left-1/2 -translate-x-1/2 text-[9px] xl:text-[10px] leading-none font-black text-[#004E98]">{u}</span>}</div><div className="relative w-1/2 min-h-[2px] bg-[#D62828]" style={{ height: `${Math.max(2, (n / maxTrend) * 100)}%` }}>{n > 0 && <span className="absolute bottom-full left-1/2 -translate-x-1/2 text-[9px] xl:text-[10px] leading-none font-black text-[#D62828]">{n}</span>}</div></div>; })}</div>
        </div>
        <div className="flex justify-between text-[10px] text-[#777] mt-1 shrink-0"><span>{trends[0]}</span><span className="font-bold">单日峰值 用户 {number(peakUsers)} · 开团 {number(peakCampaigns)}</span><span>{endDay}</span></div>
      </section>
      <section className="bauhaus-card bg-white p-3 min-w-0 flex flex-col min-h-[220px] lg:min-h-0">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-1.5 mb-2 shrink-0"><h3 className="text-base font-black flex items-center gap-1.5"><BarChart3 size={16} className="text-[#D62828]" />板块分布</h3><span className="text-[11px] font-bold">有效与历史</span></div>
        <div className="flex-1 min-h-0 flex flex-col justify-around gap-2">{data.campaignKinds.map((item) => { const ratio = Number(item.alive) ? Math.round(Number(item.active) / Number(item.alive) * 100) : 0; const detail = item.kind === 'promo' ? `共 ${number(item.alive)} · 展示中 ${number(c.promo_live)} · 历史 ${number(c.promo_history)}` : `共 ${number(item.alive)} · 招募中 ${number(item.active)} · 封车 ${number(item.closed)} · 结团 ${number(item.finished)}`; return <div key={item.kind}><div className="flex justify-between text-[11px] font-bold mb-1"><span>{kindNames[item.kind]}</span><span>{detail}</span></div><div className="h-3.5 border border-[#121212] bg-[#EEE]"><div className="h-full bg-[#D62828]" style={{ width: `${ratio}%` }} /></div></div>; })}</div>
        <p className="text-[10px] text-[#777] mt-1 shrink-0">宣群单独统计，不计入全部团次（{number(c.online_total)} + {number(c.offline_total)} = {number(c.total)}）</p>
      </section>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-3 shrink-0">
      <section className="bauhaus-card bg-white px-3 py-2">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-1 mb-2"><h3 className="text-sm font-black">团务状态</h3><span className="text-[10px] font-bold text-[#777]">仅网团 / 面团 · 封车与结团各自独立统计</span></div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-center"><StatCell label="招募中" value={c.recruiting} color="#004E98" /><StatCell label="封车" value={c.closed} color="#C85C16" /><StatCell label="结团" value={c.finished} color="#D62828" /><StatCell label="弃团" value={c.abandoned} color="#5B5646" /><StatCell label="累计报名" value={e.memberships} /><StatCell label="平均满员率" value={`${number(c.avg_fill_rate)}%`} /></div>
        <p className="text-[10px] text-[#777] mt-1">弃团 = 0 人报名即封车的团（自本统计上线起累计）· 报名数与满员率均不含宣群</p>
      </section>
      <section className="bauhaus-card bg-white px-3 py-2">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-1 mb-2"><h3 className="text-sm font-black">反馈与举报</h3><span className="text-[10px] font-bold text-[#777]">受理状态</span></div>
        <div className="grid grid-cols-4 gap-2 text-center"><StatCell label="反馈总数" value={sub.feedback} color="#004E98" /><StatCell label="举报总数" value={sub.reports} color="#D62828" /><StatCell label="已解决" value={sub.resolved} /><StatCell label="已驳回" value={sub.rejected} /></div>
        <p className="text-[10px] text-[#777] mt-1">未处理工单默认展开，已解决与已驳回折叠 · 待审资源 {number(data.resourceReviews?.pending)} 条</p>
      </section>
    </div>
  </div>;
}

export function AdminPage() {
  const { showConfirm } = useDialog();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null), [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null), [dashboardLoading, setDashboardLoading] = useState(false);
  const [rules, setRules] = useState<string[]>([]), [newRule, setNewRule] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]), [userTotal, setUserTotal] = useState(0), [memberTotal, setMemberTotal] = useState(0), [searchInput, setSearchInput] = useState(''), [search, setSearch] = useState(''), [userOffset, setUserOffset] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [grants, setGrants] = useState<MembershipGrant[]>([]), [grantTotal, setGrantTotal] = useState(0), [grantOffset, setGrantOffset] = useState(0);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | null>(null);
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const message = (error: unknown) => setNotice(error instanceof Error ? error.message : '操作失败');
  // 用户列表与「会员数量」一起刷新，避免发放会员后统计滞后。
  const applyUsers = (data: { users: AdminUser[]; total: number; memberTotal?: number }) => {
    setUsers(data.users); setUserTotal(data.total); setMemberTotal(data.memberTotal ?? 0);
    return data;
  };
  const loadDashboard = async () => { setDashboardLoading(true); try { setDashboard(await adminApi.dashboard()); } catch (error) { message(error); } finally { setDashboardLoading(false); } };
  const loadRules = async () => setRules((await adminApi.rules()).rules);

  useEffect(() => { adminApi.me().then((data) => { setAuthenticated(data.authenticated); setMyRole(data.role); }).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => { if (authenticated && activeSection === 'dashboard') loadDashboard(); }, [authenticated, activeSection]);
  // 实时在线：停留在看板时每 30 秒静默拉一次数据，不闪 loading。
  useEffect(() => {
    if (!authenticated || activeSection !== 'dashboard') return;
    const timer = window.setInterval(() => { adminApi.dashboard().then(setDashboard).catch(() => {}); }, 30_000);
    return () => window.clearInterval(timer);
  }, [authenticated, activeSection]);
  // 后台其它页面也要保持在线状态，避免切走后 15 分钟被判离线。
  useEffect(() => {
    if (!authenticated) return;
    const timer = window.setInterval(() => { adminApi.me().catch(() => {}); }, 60_000);
    return () => window.clearInterval(timer);
  }, [authenticated]);
  useEffect(() => { if (authenticated && activeSection === 'content') loadRules().catch(message); }, [authenticated, activeSection]);
  useEffect(() => { if (authenticated && activeSection === 'users') adminApi.users(search, userOffset).then(applyUsers).catch(message); }, [authenticated, activeSection, search, userOffset]);
  useEffect(() => { if (authenticated && activeSection === 'users' && selected) adminApi.grants(selected.qq, grantOffset).then((data) => { setGrants(data.records); setGrantTotal(data.total); }).catch(message); }, [authenticated, activeSection, selected?.qq, grantOffset]);

  const logout = async () => { try { await adminApi.logout(); setAuthenticated(false); setDashboard(null); setSelected(null); } catch (error) { message(error); } };
  const addRule = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await adminApi.addRule(newRule.trim()); setNewRule(''); await loadRules(); setNotice('规则已添加'); } catch (error) { message(error); } finally { setBusy(false); } };
  const deleteRule = async (name: string) => { if (!await showConfirm({ title: '删除规则', message: `确定删除规则「${name}」？已有团的历史规则名称仍会保留。`, confirmText: '确定删除', type: 'danger' })) return; setBusy(true); try { await adminApi.deleteRule(name); await loadRules(); setNotice('规则已删除'); } catch (error) { message(error); } finally { setBusy(false); } };
  const changeBlacklist = async (qq: string, duration: '7d' | '30d' | '6m' | '1y' | 'permanent' | null) => { setBusy(true); try { if (duration) await adminApi.blacklist(qq, duration); else await adminApi.unblacklist(qq); const data = applyUsers(await adminApi.users(search, userOffset)); setSelected(data.users.find((item) => item.qq === qq) || null); setNotice(duration ? '已加入黑名单' : '已移出黑名单'); } catch (error) { message(error); } finally { setBusy(false); } };
  const grantMembership = async (qq: string, months: number) => {
    setBusy(true);
    try {
      const result = await adminApi.grantMembership(qq, months);
      const data = await adminApi.users(search, userOffset);
      setUsers(data.users); setUserTotal(data.total);
      setSelected(data.users.find((item) => item.qq === qq) || null);
      setGrantOffset(0);
      const records = await adminApi.grants(qq, 0);
      setGrants(records.records); setGrantTotal(records.total);
      setNotice(`已发放 ${result.months} 个月会员，到期 ${new Date(result.membershipExpiresAt * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false })}`);
    } catch (error) { message(error); } finally { setBusy(false); }
  };
  const toggleAdmin = async (qq: string, makeAdmin: boolean) => {
    setBusy(true);
    try {
      await adminApi.setRole(qq, makeAdmin ? 'admin' : '');
      const data = await adminApi.users(search, userOffset);
      setUsers(data.users); setUserTotal(data.total);
      setSelected(data.users.find((item) => item.qq === qq) || null);
      setNotice(makeAdmin ? '已任命为管理员' : '已取消管理员权限');
    } catch (error) { message(error); } finally { setBusy(false); }
  };
  const changeSection = (id: AdminSection) => { setActiveSection(id); setNotice(''); };

  const fitDashboard = activeSection === 'dashboard' && authenticated === true;
  return <div className={`min-h-screen bg-[#F6F5F0] text-[#121212] font-sans ${fitDashboard ? 'lg:h-screen lg:flex lg:flex-col lg:overflow-hidden' : ''}`}><header className="bg-white border-b-4 border-[#121212] shrink-0"><div className={`${fitDashboard ? 'w-full max-w-none lg:px-6' : 'max-w-7xl mx-auto'} px-4 py-4 flex items-center justify-between gap-3`}><div className="flex items-center gap-3"><span className="w-7 h-7 bg-[#D62828] border-2 border-[#121212]" /><div><h1 className="text-xl font-black leading-none">诸告板 · 后台</h1><p className="text-xs text-[#666] mt-1">数据、配置与内容受理中心</p></div></div><div className="flex items-center gap-2 text-xs font-bold"><a href="/" className="bauhaus-btn bg-white px-3 py-2">返回首页</a>{authenticated && <button onClick={async () => { if (await showConfirm({ title: '退出后台', message: '确定退出后台登录吗？退出后需要重新登录才能管理站点。', confirmText: '确定退出', type: 'warning' })) logout(); }} className="bauhaus-btn bg-[#121212] text-white px-3 py-2 gap-1"><LogOut size={14} />退出</button>}</div></div></header><main className={fitDashboard ? 'w-full max-w-none px-4 lg:px-6 py-3 lg:flex-1 lg:min-h-0 lg:flex lg:flex-col lg:overflow-hidden' : 'max-w-7xl mx-auto px-4 py-7'}>
    {notice && <div role="status" className="mb-5 bg-white border-2 border-[#121212] border-l-8 border-l-[#D62828] px-4 py-3 text-sm font-bold">{notice}</div>}
    {authenticated === null && <div className="bauhaus-card p-8 text-center">加载中…</div>}
    {authenticated === false && <section className="bauhaus-card max-w-md mx-auto p-7 bg-white">
      <Shield size={26} className="text-[#D62828] mb-3" />
      <h2 className="text-xl font-black">后台需要站长或管理员身份</h2>
      <p className="text-sm text-[#666] mt-1">请先在本站用 QQ 号登录站长 / 管理员账号，然后回到本页。普通账号无法进入后台。</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <a href="/" className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-sm">返回首页登录</a>
        <button type="button" onClick={() => window.location.reload()} className="bauhaus-btn bg-white px-4 py-2 text-sm">我已登录，刷新</button>
      </div>
    </section>}
    {authenticated && <><nav aria-label="后台功能" className={`grid grid-cols-2 sm:flex sm:flex-wrap gap-2 shrink-0 ${activeSection === 'dashboard' ? 'mb-2' : 'mb-6'}`}>{sections.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => changeSection(item.id)} className={`bauhaus-btn px-4 py-2.5 gap-2 text-sm ${activeSection === item.id ? 'bg-[#121212] text-white' : 'bg-white'}`}><Icon size={16} />{item.label}</button>; })}</nav><div className={`${activeSection === 'dashboard' ? 'mb-2' : 'mb-5'} flex items-center gap-2 shrink-0`}><span className="w-3 h-3 bg-[#D62828]" /><h2 className={activeSection === 'dashboard' ? 'text-lg font-black' : 'text-2xl font-black'}>{sections.find((item) => item.id === activeSection)?.label}</h2></div>
      {activeSection === 'dashboard' && <div className={fitDashboard ? 'lg:flex-1 lg:min-h-0' : ''}><Dashboard data={dashboard} loading={dashboardLoading} /></div>}
      {activeSection === 'content' && <ContentSection rules={rules} newRule={newRule} busy={busy} setNewRule={setNewRule} addRule={addRule} deleteRule={deleteRule} />}
      {activeSection === 'users' && <AdminUsersSection users={users} userTotal={userTotal} memberTotal={memberTotal} selected={selected} busy={busy} grants={grants} grantTotal={grantTotal} grantOffset={grantOffset} searchInput={searchInput} userOffset={userOffset} canManageAdmins={myRole === 'owner'} setSearchInput={setSearchInput} searchUsers={(event) => { event.preventDefault(); setSelected(null); setSearch(searchInput.trim()); setUserOffset(0); }} selectUser={(user) => { setSelected(user); setGrantOffset(0); }} setUserOffset={setUserOffset} setGrantOffset={setGrantOffset} onBlacklistChange={changeBlacklist} onGrantMembership={grantMembership} onToggleAdmin={toggleAdmin} />}
      {activeSection === 'support' && <AdminSupportSection onNotice={setNotice} onError={message} />}
      {activeSection === 'archive' && <AdminArchivedSection onError={message} />}
      {activeSection === 'resources' && <AdminResourcesSection onNotice={setNotice} onError={message} />}
    </>}
  </main></div>;
}

function ContentSection(props: { rules: string[]; newRule: string; busy: boolean; setNewRule: (v: string) => void; addRule: (e: FormEvent) => void; deleteRule: (v: string) => void; }) {
  const weight = (value: string) => Array.from(value).reduce((total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2), 0);
  const length = weight(props.newRule);
  return <div className="grid gap-6 items-start">
    <section className="bauhaus-card p-5 bg-white">
      <div className="flex justify-between border-b-2 border-[#121212] pb-3 mb-2"><h3 className="font-black">规则系统</h3><span className="text-xs font-bold bg-[#121212] text-white px-2 py-1">最近 {props.rules.length} / 10 个</span></div>
      <p className="text-[11px] text-[#666] mb-3">只保留最近使用的 10 个标签，与发车下拉选项保持一致；更早的会自动清理。每个标签最多 10 个中文字符或 20 个英文字符。</p>
      <form onSubmit={props.addRule} className="flex gap-2 mb-4">
        <input aria-label="新规则名" required value={props.newRule} onChange={(event) => { if (weight(event.target.value) <= 20) props.setNewRule(event.target.value); }} placeholder="输入新规则名" className="bauhaus-input min-w-0 flex-1 px-2 py-2 text-sm" />
        <button disabled={props.busy} className="bauhaus-btn bg-[#D62828] text-white px-3"><Plus size={18} /></button>
      </form>
      <p className={`mb-3 text-right text-[11px] font-bold ${length > 20 ? 'text-[#D62828]' : 'text-[#888]'}`}>{length}/20</p>
      <ItemList items={props.rules} onDelete={props.deleteRule} busy={props.busy} />
    </section>
  </div>;
}
function ItemList({ items, onDelete, busy }: { items: string[]; onDelete: (v: string) => void; busy: boolean }) { return <ul className="space-y-2 max-h-[520px] overflow-y-auto pr-1">{items.map((item) => <li key={item} className="flex items-center justify-between gap-2 border border-[#121212] bg-[#FAF9F5] px-3 py-2 text-sm"><span className="font-bold break-all">{item}</span><button disabled={busy} onClick={() => onDelete(item)} aria-label={`删除 ${item}`} className="text-[#D62828] cursor-pointer"><Trash2 size={16} /></button></li>)}</ul>; }
