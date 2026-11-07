import { useEffect, useState, type FormEvent } from 'react';
import { Activity, BarChart3, CheckCircle2, ChevronLeft, ChevronRight, Clock3, FileSliders, Flag, LayoutDashboard, LogOut, MessageSquareText, Plus, Shield, Trash2, UsersRound } from 'lucide-react';
import { adminApi, type AdminDashboard, type AdminSubmission, type AdminUser, type MembershipGrant } from '../services/api';
import { AdminUsersSection } from './AdminUsersSection';
import { statusLabels, statusClasses } from '../utils/submissions';
import { useDialog } from './BauhausDialog';

const SUBMISSION_PAGE_SIZE = 30;
type AdminSection = 'dashboard' | 'content' | 'users' | 'feedback' | 'report';
const sections: Array<{ id: AdminSection; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: '数据看板', icon: LayoutDashboard },
  { id: 'content', label: '内容配置', icon: FileSliders },
  { id: 'users', label: '账号', icon: UsersRound },
  { id: 'feedback', label: '反馈受理', icon: MessageSquareText },
  { id: 'report', label: '举报受理', icon: Flag },
];
const number = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');

function MetricCard({ label, value, note, tone = 'blue' }: { label: string; value: unknown; note: string; tone?: 'red' | 'blue' | 'yellow' | 'black' }) {
  const color = { red: '#D62828', blue: '#004E98', yellow: '#C85C16', black: '#121212' }[tone];
  return <article className="bauhaus-card bg-white p-4 relative overflow-hidden"><span className="absolute top-0 left-0 w-full h-1.5" style={{ backgroundColor: color }} /><p className="text-xs font-black text-[#666] mt-1">{label}</p><strong className="block text-3xl font-black mt-2" style={{ color }}>{number(value)}</strong><p className="text-[11px] text-[#777] mt-1">{note}</p></article>;
}

function Dashboard({ data, loading }: { data: AdminDashboard | null; loading: boolean }) {
  if (loading || !data) return <div className="bauhaus-card bg-white p-12 text-center font-bold">正在汇总看板数据…</div>;
  const trends = Array.from(new Set([...data.dailyUsers.map((item) => item.day), ...data.dailyCampaigns.map((item) => item.day)])).sort();
  const userMap = new Map(data.dailyUsers.map((item) => [item.day, Number(item.count)]));
  const campaignMap = new Map(data.dailyCampaigns.map((item) => [item.day, Number(item.count)]));
  const maxTrend = Math.max(1, ...trends.flatMap((day) => [userMap.get(day) || 0, campaignMap.get(day) || 0]));
  const kindNames = { online: '网团', offline: '面团', promo: '宣群' };
  return <div className="space-y-6">
    <section><div className="flex items-end justify-between gap-3 mb-3"><div><h2 className="text-xl font-black">平台总览</h2><p className="text-xs text-[#666] mt-1">用户、团务、互动与受理队列实时汇总</p></div><time className="text-[11px] text-[#777]">更新于 {new Date(data.generatedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}</time></div><div className="grid grid-cols-2 lg:grid-cols-4 gap-3"><MetricCard label="注册用户" value={data.users.total} note={`今日 +${number(data.users.today)} · 近 30 天 +${number(data.users.last30)}`} /><MetricCard label="全部团次" value={data.campaigns.total} note={`正在招募 ${number(data.campaigns.recruiting)} 个`} tone="red" /><MetricCard label="累计报名" value={data.engagement.memberships} note={`平均满员率 ${number(data.campaigns.avg_fill_rate)}%`} tone="yellow" /><MetricCard label="待办工单" value={Number(data.submissions.pending) + Number(data.submissions.processing)} note={`待受理 ${number(data.submissions.pending)} · 处理中 ${number(data.submissions.processing)}`} tone="black" /></div></section>
    <section className="grid md:grid-cols-2 xl:grid-cols-4 gap-3"><MetricCard label="近 7 天新增用户" value={data.users.last7} note="含今日" /><MetricCard label="已结团" value={data.campaigns.finished} note={`锁车 ${number(data.campaigns.closed)} · 删除 ${number(data.campaigns.deleted)}`} tone="red" /><MetricCard label="累计点赞" value={data.engagement.praises} note={`GM ${number(data.engagement.gm_praises)} · 玩家 ${number(data.engagement.player_praises)}`} tone="yellow" /><MetricCard label="当前登录会话" value={data.engagement.active_sessions} note="尚未过期的登录设备" tone="black" /></section>
    <div className="grid xl:grid-cols-[1.35fr_1fr] gap-6">
      <section className="bauhaus-card bg-white p-5 min-w-0"><div className="flex items-center justify-between border-b-2 border-[#121212] pb-3 mb-4"><h3 className="font-black flex items-center gap-2"><Activity size={18} className="text-[#004E98]" />近 30 天增长</h3><div className="flex gap-3 text-[11px] font-bold"><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 bg-[#004E98]" />用户</span><span className="flex items-center gap-1"><i className="w-2.5 h-2.5 bg-[#D62828]" />团次</span></div></div>{trends.length ? <div className="h-48 flex items-end gap-1 sm:gap-2 border-b border-l border-[#AAA] px-2 pt-4" aria-label="近 30 天用户与团次增长柱状图">{trends.map((day) => <div key={day} className="flex-1 min-w-0 h-full flex items-end justify-center gap-px"><div title={`${day} 新增用户 ${userMap.get(day) || 0}`} className="w-1/2 min-h-[2px] bg-[#004E98]" style={{ height: `${Math.max(2, ((userMap.get(day) || 0) / maxTrend) * 100)}%` }} /><div title={`${day} 新增团次 ${campaignMap.get(day) || 0}`} className="w-1/2 min-h-[2px] bg-[#D62828]" style={{ height: `${Math.max(2, ((campaignMap.get(day) || 0) / maxTrend) * 100)}%` }} /></div>)}</div> : <p className="h-48 flex items-center justify-center text-sm text-[#666]">近 30 天暂无新增数据</p>}{trends.length > 0 && <div className="flex justify-between text-[10px] text-[#777] mt-2"><span>{trends[0]}</span><span>{trends[trends.length - 1]}</span></div>}</section>
      <section className="bauhaus-card bg-white p-5"><div className="flex items-center justify-between border-b-2 border-[#121212] pb-3 mb-4"><h3 className="font-black flex items-center gap-2"><BarChart3 size={18} className="text-[#D62828]" />板块分布</h3><span className="text-xs font-bold">有效与历史</span></div><div className="space-y-4">{data.campaignKinds.map((item) => { const ratio = Number(item.total) ? Math.round(Number(item.active) / Number(item.total) * 100) : 0; return <div key={item.kind}><div className="flex justify-between text-xs font-bold mb-1"><span>{kindNames[item.kind]}</span><span>共 {number(item.total)} · 活跃 {number(item.active)} · 结团 {number(item.finished)}</span></div><div className="h-3 border border-[#121212] bg-[#EEE]"><div className="h-full bg-[#D62828]" style={{ width: `${ratio}%` }} /></div></div>; })}</div></section>
    </div>
    <div className="grid md:grid-cols-2 gap-6"><section className="bauhaus-card bg-white p-5"><h3 className="font-black border-b-2 border-[#121212] pb-3 mb-3">热门规则</h3><ol className="space-y-2">{data.topRules.map((item, index) => <li key={item.rule} className="flex items-center gap-3 text-sm"><span className="w-6 h-6 bg-[#121212] text-white flex items-center justify-center text-xs font-black">{index + 1}</span><span className="font-bold flex-1 truncate">{item.rule}</span><strong>{number(item.total)} 团</strong></li>)}{!data.topRules.length && <li className="text-sm text-[#666]">暂无规则数据</li>}</ol></section><section className="bauhaus-card bg-white p-5"><h3 className="font-black border-b-2 border-[#121212] pb-3 mb-3">反馈与举报</h3><div className="grid grid-cols-2 gap-3 text-sm"><div className="border-2 border-[#004E98] bg-[#EAF3FB] p-3"><span className="block font-bold">反馈总数</span><strong className="text-2xl">{number(data.submissions.feedback)}</strong></div><div className="border-2 border-[#D62828] bg-[#FAF0F0] p-3"><span className="block font-bold">举报总数</span><strong className="text-2xl">{number(data.submissions.reports)}</strong></div><div className="border border-[#121212] p-3"><span className="block font-bold">已解决</span><strong className="text-xl">{number(data.submissions.resolved)}</strong></div><div className="border border-[#121212] p-3"><span className="block font-bold">已驳回</span><strong className="text-xl">{number(data.submissions.rejected)}</strong></div></div></section></div>
  </div>;
}

export function AdminPage() {
  const { showConfirm } = useDialog();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null), [activeSection, setActiveSection] = useState<AdminSection>('dashboard');
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null), [dashboardLoading, setDashboardLoading] = useState(false);
  const [rules, setRules] = useState<string[]>([]), [newRule, setNewRule] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]), [userTotal, setUserTotal] = useState(0), [searchInput, setSearchInput] = useState(''), [search, setSearch] = useState(''), [userOffset, setUserOffset] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [grants, setGrants] = useState<MembershipGrant[]>([]), [grantTotal, setGrantTotal] = useState(0), [grantOffset, setGrantOffset] = useState(0);
  const [myRole, setMyRole] = useState<'owner' | 'admin' | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]), [submissionTotal, setSubmissionTotal] = useState(0), [submissionOffset, setSubmissionOffset] = useState(0), [submissionStatus, setSubmissionStatus] = useState(''), [draftNotes, setDraftNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const submissionType = activeSection === 'report' ? 'report' : 'feedback';
  const message = (error: unknown) => setNotice(error instanceof Error ? error.message : '操作失败');
  const loadDashboard = async () => { setDashboardLoading(true); try { setDashboard(await adminApi.dashboard()); } catch (error) { message(error); } finally { setDashboardLoading(false); } };
  const loadRules = async () => setRules((await adminApi.rules()).rules);
  const loadSubmissions = async () => { const data = await adminApi.submissions(submissionType, submissionStatus, submissionOffset); setSubmissions(data.submissions); setSubmissionTotal(data.total); setDraftNotes(Object.fromEntries(data.submissions.map((item) => [item.id, item.admin_note]))); };

  useEffect(() => { adminApi.me().then((data) => { setAuthenticated(data.authenticated); setMyRole(data.role); }).catch(() => setAuthenticated(false)); }, []);
  useEffect(() => { if (authenticated && activeSection === 'dashboard') loadDashboard(); }, [authenticated, activeSection]);
  useEffect(() => { if (authenticated && activeSection === 'content') loadRules().catch(message); }, [authenticated, activeSection]);
  useEffect(() => { if (authenticated && activeSection === 'users') adminApi.users(search, userOffset).then((data) => { setUsers(data.users); setUserTotal(data.total); }).catch(message); }, [authenticated, activeSection, search, userOffset]);
  useEffect(() => { if (authenticated && activeSection === 'users' && selected) adminApi.grants(selected.qq, grantOffset).then((data) => { setGrants(data.records); setGrantTotal(data.total); }).catch(message); }, [authenticated, activeSection, selected?.qq, grantOffset]);
  useEffect(() => { if (authenticated && (activeSection === 'feedback' || activeSection === 'report')) loadSubmissions().catch(message); }, [authenticated, activeSection, submissionStatus, submissionOffset]);

  const logout = async () => { try { await adminApi.logout(); setAuthenticated(false); setDashboard(null); setSelected(null); } catch (error) { message(error); } };
  const addRule = async (event: FormEvent) => { event.preventDefault(); setBusy(true); try { await adminApi.addRule(newRule.trim()); setNewRule(''); await loadRules(); setNotice('规则已添加'); } catch (error) { message(error); } finally { setBusy(false); } };
  const deleteRule = async (name: string) => { if (!await showConfirm({ title: '删除规则', message: `确定删除规则「${name}」？已有团的历史规则名称仍会保留。`, confirmText: '确定删除', type: 'danger' })) return; setBusy(true); try { await adminApi.deleteRule(name); await loadRules(); setNotice('规则已删除'); } catch (error) { message(error); } finally { setBusy(false); } };
  const changeBlacklist = async (qq: string, duration: '7d' | '30d' | '6m' | '1y' | 'permanent' | null) => { setBusy(true); try { if (duration) await adminApi.blacklist(qq, duration); else await adminApi.unblacklist(qq); const data = await adminApi.users(search, userOffset); setUsers(data.users); setUserTotal(data.total); setSelected(data.users.find((item) => item.qq === qq) || null); setNotice(duration ? '已加入黑名单' : '已移出黑名单'); } catch (error) { message(error); } finally { setBusy(false); } };
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
  const updateSubmission = async (item: AdminSubmission, status: AdminSubmission['status']) => { setBusy(true); try { await adminApi.updateSubmission(item.id, status, draftNotes[item.id] || ''); await loadSubmissions(); setNotice(`${item.type === 'report' ? '举报' : '反馈'}状态已更新`); } catch (error) { message(error); } finally { setBusy(false); } };
  const changeSection = (id: AdminSection) => { setActiveSection(id); setNotice(''); if (id === 'feedback' || id === 'report') { setSubmissionOffset(0); setSubmissionStatus(''); } };

  return <div className="min-h-screen bg-[#F6F5F0] text-[#121212] font-sans"><header className="bg-white border-b-4 border-[#121212]"><div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between gap-3"><div className="flex items-center gap-3"><span className="w-7 h-7 bg-[#D62828] border-2 border-[#121212]" /><div><h1 className="text-xl font-black leading-none">诸告板 · 后台</h1><p className="text-xs text-[#666] mt-1">数据、配置与内容受理中心</p></div></div><div className="flex items-center gap-2 text-xs font-bold"><a href="/" className="bauhaus-btn bg-white px-3 py-2">返回首页</a>{authenticated && <button onClick={async () => { if (await showConfirm({ title: '退出后台', message: '确定退出后台登录吗？退出后需要重新登录才能管理站点。', confirmText: '确定退出', type: 'warning' })) logout(); }} className="bauhaus-btn bg-[#121212] text-white px-3 py-2 gap-1"><LogOut size={14} />退出</button>}</div></div></header><main className="max-w-7xl mx-auto px-4 py-7">
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
    {authenticated && <><nav aria-label="后台功能" className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mb-6">{sections.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => changeSection(item.id)} className={`bauhaus-btn px-4 py-2.5 gap-2 text-sm ${activeSection === item.id ? 'bg-[#121212] text-white' : 'bg-white'}`}><Icon size={16} />{item.label}</button>; })}</nav><div className="mb-5 flex items-center gap-2"><span className="w-3 h-3 bg-[#D62828]" /><h2 className="text-2xl font-black">{sections.find((item) => item.id === activeSection)?.label}</h2></div>
      {activeSection === 'dashboard' && <Dashboard data={dashboard} loading={dashboardLoading} />}
      {activeSection === 'content' && <ContentSection rules={rules} newRule={newRule} busy={busy} setNewRule={setNewRule} addRule={addRule} deleteRule={deleteRule} />}
      {activeSection === 'users' && <AdminUsersSection users={users} userTotal={userTotal} selected={selected} busy={busy} grants={grants} grantTotal={grantTotal} grantOffset={grantOffset} searchInput={searchInput} userOffset={userOffset} canManageAdmins={myRole === 'owner'} setSearchInput={setSearchInput} searchUsers={(event) => { event.preventDefault(); setSelected(null); setSearch(searchInput.trim()); setUserOffset(0); }} selectUser={(user) => { setSelected(user); setGrantOffset(0); }} setUserOffset={setUserOffset} setGrantOffset={setGrantOffset} onBlacklistChange={changeBlacklist} onGrantMembership={grantMembership} onToggleAdmin={toggleAdmin} />}
      {(activeSection === 'feedback' || activeSection === 'report') && <SubmissionsSection kind={submissionType} submissions={submissions} total={submissionTotal} offset={submissionOffset} status={submissionStatus} busy={busy} notes={draftNotes} setStatus={(value) => { setSubmissionStatus(value); setSubmissionOffset(0); }} setOffset={setSubmissionOffset} setNote={(id, value) => setDraftNotes((current) => ({ ...current, [id]: value }))} update={updateSubmission} />}
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

function SubmissionsSection(props: { kind: 'feedback' | 'report'; submissions: AdminSubmission[]; total: number; offset: number; status: string; busy: boolean; notes: Record<string, string>; setStatus: (v: string) => void; setOffset: (v: number) => void; setNote: (id: string, v: string) => void; update: (item: AdminSubmission, status: AdminSubmission['status']) => void }) {
  return <section><div className="flex flex-wrap items-center justify-between gap-3 mb-4"><p className="text-sm text-[#666]">按队列状态筛选并记录受理意见，图片可点击查看原图。</p><select aria-label="筛选受理状态" value={props.status} onChange={(e) => props.setStatus(e.target.value)} className="bauhaus-input px-3 py-2 text-sm font-bold"><option value="">全部状态</option>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><div className="space-y-4">{props.submissions.map((item) => <article key={item.id} className="bauhaus-card bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#CCC] pb-3"><div className="flex items-center gap-3"><span className={`px-2 py-1 border text-xs font-black ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span><div><strong className="block text-sm">{item.user_name} <span className="font-mono text-[#666]">({item.user_qq})</span></strong><time className="text-[11px] text-[#777]">{new Date(item.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}</time></div></div><span className="font-mono text-[10px] text-[#888]">{item.id}</span></div>{item.type === 'report' && <p className="mt-4 text-sm font-bold text-[#B51F1F]">被举报人：{item.reported_name || '未关联账号'} {item.reported_qq ? `(${item.reported_qq})` : ''}</p>}<p className="whitespace-pre-wrap text-sm leading-6 py-4">{item.content}</p>{item.images.length > 0 && <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-2 mb-4">{item.images.map((src, index) => <a key={src} href={src} target="_blank" rel="noreferrer" className="aspect-square border-2 border-[#121212] overflow-hidden bg-[#EEE]"><img src={src} alt={`提交图片 ${index + 1}`} className="w-full h-full object-cover" /></a>)}</div>}<div className="grid md:grid-cols-[1fr_auto] gap-3 items-end border-t border-[#CCC] pt-4"><div><label htmlFor={`note-${item.id}`} className="block text-xs font-black mb-1">管理员受理备注</label><textarea id={`note-${item.id}`} rows={2} maxLength={2000} value={props.notes[item.id] || ''} onChange={(e) => props.setNote(item.id, e.target.value)} placeholder="填写核查结果、处理方式或内部备注…" className="bauhaus-input w-full px-3 py-2 text-sm" /></div><div className="flex flex-wrap gap-2"><button disabled={props.busy} onClick={() => props.update(item, item.status)} className="bauhaus-btn bg-white px-3 py-2 text-xs">保存备注</button>{item.status !== 'processing' && <button disabled={props.busy} onClick={() => props.update(item, 'processing')} className="bauhaus-btn bg-[#004E98] text-white px-3 py-2 text-xs"><Clock3 size={14} />处理中</button>}<button disabled={props.busy} onClick={() => props.update(item, 'resolved')} className="bauhaus-btn bg-[#176B57] text-white px-3 py-2 text-xs"><CheckCircle2 size={14} />已解决</button><button disabled={props.busy} onClick={() => props.update(item, 'rejected')} className="bauhaus-btn bg-white text-[#B51F1F] px-3 py-2 text-xs">驳回</button></div></div></article>)}{!props.submissions.length && <div className="bauhaus-card bg-white p-12 text-center text-sm text-[#666]">当前筛选条件下没有{props.kind === 'report' ? '举报' : '反馈'}记录</div>}</div><Pager offset={props.offset} total={props.total} size={SUBMISSION_PAGE_SIZE} setOffset={props.setOffset} /></section>;
}
function Pager({ offset, total, size, setOffset }: { offset: number; total: number; size: number; setOffset: (v: number) => void }) { return <div className="flex items-center justify-end gap-3 mt-5 text-xs font-bold"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - size))} className="bauhaus-btn bg-white p-1" aria-label="上一页"><ChevronLeft size={17} /></button><span>{total ? offset + 1 : 0}–{Math.min(offset + size, total)} / {total}</span><button disabled={offset + size >= total} onClick={() => setOffset(offset + size)} className="bauhaus-btn bg-white p-1" aria-label="下一页"><ChevronRight size={17} /></button></div>; }
