import { useState, type FormEvent } from 'react';
import { Check, Search, Shield, ShieldBan, UserCog } from 'lucide-react';
import { type AdminUser, type MembershipGrant } from '../services/api';
import { useDialog } from './BauhausDialog';

const USER_PAGE_SIZE = 100;
const GRANT_PAGE_SIZE = 50;
const durations = [
  ['7d', '7 天'], ['30d', '30 天'], ['6m', '半年'], ['1y', '一年'], ['permanent', '永久'],
] as const;

interface Props {
  users: AdminUser[];
  userTotal: number;
  memberTotal: number;
  selected: AdminUser | null;
  grants: MembershipGrant[];
  grantTotal: number;
  grantOffset: number;
  searchInput: string;
  userOffset: number;
  busy: boolean;
  canManageAdmins: boolean;
  setSearchInput: (value: string) => void;
  searchUsers: (event: FormEvent) => void;
  selectUser: (user: AdminUser) => void;
  setUserOffset: (offset: number) => void;
  setGrantOffset: (offset: number) => void;
  onBlacklistChange: (qq: string, duration: typeof durations[number][0] | null) => Promise<void>;
  onGrantMembership: (qq: string, months: number) => Promise<void>;
  onToggleAdmin: (qq: string, makeAdmin: boolean) => Promise<void>;
}

// 页码用下拉直接择页，不再显示「1-50/182」这种范围数字。
function Pager({ offset, total, size = USER_PAGE_SIZE, onChange }: { offset: number; total: number; size?: number; onChange: (offset: number) => void }) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  const current = Math.min(pages - 1, Math.floor(offset / size));
  return <div className="flex justify-between items-center mt-4 text-xs font-bold"><button disabled={current === 0} onClick={() => onChange((current - 1) * size)} className="bauhaus-btn bg-white px-3 py-1 disabled:opacity-40">上一页</button><label className="flex items-center gap-1.5">第
    <select aria-label="选择页码" value={current} onChange={(event) => onChange(Number(event.target.value) * size)} className="bauhaus-input px-2 py-1 text-xs font-bold">
      {Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}
    </select>
    页 / 共 {pages} 页</label><button disabled={current >= pages - 1} onClick={() => onChange((current + 1) * size)} className="bauhaus-btn bg-white px-3 py-1 disabled:opacity-40">下一页</button></div>;
}

const roleLabel = (user: AdminUser) => user.role === 'owner' ? '站长' : user.role === 'admin' ? '管理员' : '';
const isMember = (user: AdminUser) => user.membershipPermanent || Number(user.membership_expires_at ?? 0) > Date.now() / 1000;
const formatTime = (seconds: number) => new Date(seconds * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false });

export function AdminUsersSection(props: Props) {
  const { showConfirm } = useDialog();
  const [duration, setDuration] = useState<typeof durations[number][0]>('7d');
  const [months, setMonths] = useState(1);
  const selected = props.selected;
  // 会员状态直接贴在「会员」标题右侧，不再单独占一行。
  const membershipStatus = (() => {
    if (!selected) return null;
    if (selected.membershipPermanent) return { text: '长期有效', cls: 'border-[#C85C16] bg-[#FFF4DA] text-[#7A4B00]' };
    const expiresAt = selected.membership_expires_at;
    if (!expiresAt) return { text: '未开通', cls: 'border-[#121212] bg-white text-[#666]' };
    const valid = expiresAt > Date.now() / 1000;
    return { text: `${valid ? '有效' : '已到期'} · 到期 ${formatTime(expiresAt)}`, cls: valid ? 'border-[#2F7A44] bg-[#EDF7EF] text-[#2F7A44]' : 'border-[#B51F1F] bg-[#FAF0F0] text-[#B51F1F]' };
  })();

  const changeBlacklist = async () => {
    if (!selected) return;
    if (!await showConfirm({ title: selected.blacklisted ? '移出黑名单' : '加入黑名单', message: selected.blacklisted ? `确定将 ${selected.name} 移出黑名单吗？` : `确定将 ${selected.name} 加入黑名单吗？期间无法报名。`, confirmText: '确定', type: selected.blacklisted ? 'info' : 'warning' })) return;
    await props.onBlacklistChange(selected.qq, selected.blacklisted ? null : duration);
  };

  const grant = async () => {
    if (!selected) return;
    const days = months === 12 ? 365 : months * 30;
    if (!await showConfirm({ title: '发放会员', message: `确定为 ${selected.name}（${selected.qq}）发放 ${months} 个月会员？按 ${days} 天计算，到期时间会从当前有效期顺延。`, confirmText: '确定发放', type: 'info' })) return;
    await props.onGrantMembership(selected.qq, months);
  };

  const toggleAdmin = async () => {
    if (!selected) return;
    const makeAdmin = selected.role !== 'admin';
    if (!await showConfirm({ title: makeAdmin ? '任命管理员' : '取消管理员', message: makeAdmin ? `确定让 ${selected.name} 进入后台？管理员可访问后台全部页面，但不附带会员权益。` : `确定取消 ${selected.name} 的后台权限？已发放的会员不受影响。`, confirmText: makeAdmin ? '确定任命' : '取消权限', type: makeAdmin ? 'info' : 'warning' })) return;
    await props.onToggleAdmin(selected.qq, makeAdmin);
  };

  return <div className="grid lg:grid-cols-[420px_1fr] gap-6">
    <section className="bauhaus-card p-5 bg-white">
      <div className="flex justify-between items-center border-b-2 border-[#121212] pb-3 mb-4"><h3 className="font-black">注册用户</h3><div className="flex items-center gap-1.5"><span className="text-xs font-bold bg-[#004E98] text-white px-2 py-1">共 {props.userTotal} 个</span><span className="text-xs font-bold bg-[#C85C16] text-white px-2 py-1">会员 {props.memberTotal} 个</span></div></div>
      <form onSubmit={props.searchUsers} className="flex gap-2 mb-4"><input aria-label="搜索 QQ 号或昵称" value={props.searchInput} onChange={(e) => props.setSearchInput(e.target.value)} placeholder="输入 QQ 号后点搜索" className="bauhaus-input min-w-0 flex-1 px-3 py-2 text-sm" /><button className="bauhaus-btn bg-[#121212] text-white px-3" aria-label="搜索"><Search size={17} /></button></form>
      <div className="space-y-1 max-h-[70vh] overflow-y-auto">{props.users.map((user) => <button key={user.qq} onClick={() => props.selectUser(user)} className={`w-full text-left border-2 px-2.5 py-1.5 flex items-center gap-2 ${selected?.qq === user.qq ? 'border-[#D62828] bg-[#FAF0F0]' : 'border-[#121212] bg-white'}`}>
        <strong className="text-xs font-black truncate max-w-[6.5rem] shrink-0">{user.name}</strong>
        <span className="font-mono text-[11px] text-[#666] shrink-0">{user.qq}</span>
        {!!roleLabel(user) && <span className="text-[10px] font-bold text-[#004E98] border border-[#004E98] px-1 shrink-0">{roleLabel(user)}</span>}
        {!!user.blacklisted && <span className="text-[10px] font-bold text-[#B51F1F] border border-[#B51F1F] px-1 shrink-0">黑名单</span>}
        {isMember(user) && <span className="text-[10px] font-bold text-[#7A4B00] border border-[#C85C16] px-1 shrink-0">会员</span>}
        <span className="ml-auto text-[11px] font-bold shrink-0">被举报 {user.report_count}</span>
      </button>)}</div>
      <Pager offset={props.userOffset} total={props.userTotal} onChange={props.setUserOffset} />
    </section>

    <section className="bauhaus-card p-5 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#121212] pb-3 mb-4"><h3 className="font-black flex items-center gap-2"><UserCog size={18} className="text-[#D62828]" />{selected ? <>{selected.name} <span className="font-mono text-sm font-bold text-[#666]">{selected.qq}</span></> : '请选择左侧账号'}</h3>{selected && <div className="flex items-center gap-2">
        <ShieldBan size={17} className="text-[#B51F1F]" />
        {!selected.blacklisted && <select aria-label="黑名单期限" value={duration} onChange={(event) => setDuration(event.target.value as typeof duration)} className="bauhaus-input px-2 py-1 text-xs font-bold">{durations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}
        <button disabled={props.busy} onClick={changeBlacklist} className={`bauhaus-btn px-3 py-1.5 text-xs font-bold ${selected.blacklisted ? 'bg-white' : 'bg-[#B51F1F] text-white'}`}>{selected.blacklisted ? '移出黑名单' : '加入黑名单'}</button>
        {props.canManageAdmins && selected.role !== 'owner' && <button disabled={props.busy} onClick={toggleAdmin} className={`bauhaus-btn px-3 py-1.5 text-xs font-bold ${selected.role === 'admin' ? 'bg-white' : 'bg-[#004E98] text-white'}`}>{selected.role === 'admin' ? '取消管理员' : '任命为管理员'}</button>}
      </div>}</div>
      {!selected ? <div className="h-64 flex items-center justify-center text-sm text-[#666]">选择左侧账号查看数据</div> : <>
        {/* 四项数据统一成一行：点赞用红/蓝，带团/参团用中性色，被举报只在左侧列表显示 */}
        <div className="grid grid-cols-4 gap-2 mb-1.5">
          <div className="border-2 border-[#D62828] bg-[#FAF0F0] px-1.5 py-2 text-center shadow-[2px_2px_0px_#D62828]"><span className="block text-[11px] font-bold text-[#666]">GM 点赞</span><strong className="block text-lg font-black text-[#D62828]">{selected.received_gm}</strong></div>
          <div className="border-2 border-[#004E98] bg-[#F0F5FA] px-1.5 py-2 text-center shadow-[2px_2px_0px_#004E98]"><span className="block text-[11px] font-bold text-[#666]">玩家点赞</span><strong className="block text-lg font-black text-[#004E98]">{selected.received_player}</strong></div>
          <div className="border-2 border-[#121212] bg-[#FAF9F5] px-1.5 py-2 text-center"><span className="block text-[11px] font-bold text-[#666]">带团次数</span><strong className="block text-lg font-black text-[#121212]">{selected.hosted_count ?? 0}</strong></div>
          <div className="border-2 border-[#121212] bg-[#FAF9F5] px-1.5 py-2 text-center"><span className="block text-[11px] font-bold text-[#666]">参团次数</span><strong className="block text-lg font-black text-[#121212]">{selected.joined_count ?? 0}</strong></div>
        </div>
        <p className="mb-3 text-right text-[10px] font-bold text-[#888]">带团 / 参团不含宣群</p>
        {selected.blacklisted ? <p className="mb-3 text-xs font-bold text-[#B51F1F]">黑名单生效中 · {selected.blacklist_expires_at ? `截至 ${formatTime(selected.blacklist_expires_at)}` : '永久'}</p> : null}

        <section className="mb-5 border-2 border-[#121212] bg-[#FFF9E9] p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2"><h4 className="font-black shrink-0">会员</h4>{membershipStatus && <span className={`inline-flex items-center whitespace-nowrap border px-2 py-0.5 text-[11px] font-bold ${membershipStatus.cls}`}>{membershipStatus.text}</span>}{!!roleLabel(selected) && <span className="inline-flex items-center gap-1 border border-[#004E98] bg-white px-2 py-0.5 text-[11px] font-bold text-[#004E98]"><Shield size={12} />{roleLabel(selected)}</span>}</div>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold flex items-center gap-1">发放
                <input type="number" min={1} max={12} value={months} onChange={(event) => setMonths(Math.max(1, Math.min(12, Number(event.target.value) || 1)))} className="bauhaus-input w-14 px-1.5 py-1 text-xs" aria-label="发放月数" />
                个月
              </label>
              <button disabled={props.busy || selected.role === 'owner'} onClick={grant} className="bauhaus-btn bg-[#D62828] text-white px-3 py-1.5 text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1"><Check size={13} />确认发放</button>
            </div>
          </div>
          <div className="border-t border-[#D8D6CC] mt-3 pt-3">
            <p className="text-xs font-black mb-2">发放记录</p>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">{props.grants.map((record) => <div key={record.id} className="border border-[#121212] bg-white p-2 text-xs flex justify-between gap-2"><span><strong>{record.months} 个月</strong>（{record.days} 天） · 操作人 <span className="font-mono">{record.granted_by}</span></span><span className="text-[#666] shrink-0">{new Date(record.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false })}</span></div>)}{!props.grants.length && <p className="text-xs text-[#666]">暂无发放记录</p>}</div>
            <Pager offset={props.grantOffset} total={props.grantTotal} size={GRANT_PAGE_SIZE} onChange={props.setGrantOffset} />
          </div>
        </section>
      </>}
    </section>
  </div>;
}
