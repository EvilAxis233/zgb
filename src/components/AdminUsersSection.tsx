import { useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, Gift, Search, ShieldBan } from 'lucide-react';
import { adminApi, type AdminUser, type GiftRecord } from '../services/api';
import { useDialog } from './BauhausDialog';

const PAGE_SIZE = 50;
const durations = [
  ['7d', '7 天'], ['30d', '30 天'], ['6m', '半年'], ['1y', '一年'], ['permanent', '永久'],
] as const;

interface Props {
  users: AdminUser[];
  userTotal: number;
  selected: AdminUser | null;
  gifts: GiftRecord[];
  giftTotal: number;
  searchInput: string;
  userOffset: number;
  giftOffset: number;
  busy: boolean;
  setSearchInput: (value: string) => void;
  searchUsers: (event: FormEvent) => void;
  selectUser: (user: AdminUser) => void;
  setUserOffset: (offset: number) => void;
  setGiftOffset: (offset: number) => void;
  onBlacklistChange: (qq: string, duration: typeof durations[number][0] | null) => Promise<void>;
}

function Pager({ offset, total, onChange }: { offset: number; total: number; onChange: (offset: number) => void }) {
  if (total <= PAGE_SIZE) return null;
  return <div className="flex justify-between items-center mt-4 text-xs font-bold"><button disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - PAGE_SIZE))} className="bauhaus-btn bg-white px-3 py-1 disabled:opacity-40">上一页</button><span>{offset + 1}–{Math.min(offset + PAGE_SIZE, total)} / {total}</span><button disabled={offset + PAGE_SIZE >= total} onClick={() => onChange(offset + PAGE_SIZE)} className="bauhaus-btn bg-white px-3 py-1 disabled:opacity-40">下一页</button></div>;
}

export function AdminUsersSection(props: Props) {
  const { showConfirm } = useDialog();
  const [duration, setDuration] = useState<typeof durations[number][0]>('7d');
  const selected = props.selected;
  const changeBlacklist = async () => {
    if (!selected) return;
    if (!await showConfirm({ title: selected.blacklisted ? '移出黑名单' : '加入黑名单', message: selected.blacklisted ? `确定将 ${selected.name} 移出黑名单吗？` : `确定将 ${selected.name} 加入黑名单吗？期间无法报名。`, confirmText: '确定', type: selected.blacklisted ? 'info' : 'warning' })) return;
    await props.onBlacklistChange(selected.qq, selected.blacklisted ? null : duration);
  };

  return <div className="grid lg:grid-cols-[420px_1fr] gap-6">
    <section className="bauhaus-card p-5 bg-white">
      <div className="flex justify-between border-b-2 border-[#121212] pb-3 mb-4"><h3 className="font-black">QQ 账号</h3><span className="text-xs font-bold bg-[#004E98] text-white px-2 py-1">共 {props.userTotal} 个</span></div>
      <form onSubmit={props.searchUsers} className="flex gap-2 mb-4"><input aria-label="搜索 QQ 号或昵称" value={props.searchInput} onChange={(e) => props.setSearchInput(e.target.value)} placeholder="搜索 QQ 号或昵称" className="bauhaus-input min-w-0 flex-1 px-3 py-2 text-sm" /><button className="bauhaus-btn bg-[#121212] text-white px-3" aria-label="搜索"><Search size={17} /></button></form>
      <div className="space-y-2 max-h-[520px] overflow-y-auto">{props.users.map((user) => <button key={user.qq} onClick={() => props.selectUser(user)} className={`w-full text-left border-2 px-3 py-3 flex justify-between gap-2 ${selected?.qq === user.qq ? 'border-[#D62828] bg-[#FAF0F0]' : 'border-[#121212] bg-white'}`}><span><strong className="block text-sm">{user.name}</strong><span className="font-mono text-xs text-[#666]">{user.qq}</span>{!!user.blacklisted && <span className="block text-[11px] font-bold text-[#B51F1F]">黑名单中</span>}</span><span className="text-xs font-bold text-right">送 {user.sent_count} · 收 {user.received_count}<br />被举报 {user.report_count}</span></button>)}</div>
      <Pager offset={props.userOffset} total={props.userTotal} onChange={props.setUserOffset} />
    </section>
    <section className="bauhaus-card p-5 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#121212] pb-3 mb-4"><h3 className="font-black flex items-center gap-2"><Gift size={18} className="text-[#D62828]" />个人数据与礼物记录</h3>{selected && <div className="flex items-center gap-2"><ShieldBan size={17} className="text-[#B51F1F]" />{!selected.blacklisted && <select aria-label="黑名单期限" value={duration} onChange={(event) => setDuration(event.target.value as typeof duration)} className="bauhaus-input px-2 py-1 text-xs font-bold">{durations.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>}<button disabled={props.busy} onClick={changeBlacklist} className={`bauhaus-btn px-3 py-1.5 text-xs font-bold ${selected.blacklisted ? 'bg-white' : 'bg-[#B51F1F] text-white'}`}>{selected.blacklisted ? '移出黑名单' : '加入黑名单'}</button></div>}</div>
      {!selected ? <div className="h-64 flex items-center justify-center text-sm text-[#666]">选择左侧账号查看个人数据</div> : <>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-4">{[['GM 点赞', selected.received_gm], ['玩家点赞', selected.received_player], ['送出礼物', selected.sent_count], ['收到礼物', selected.received_count], ['被举报', selected.report_count]].map(([label, value]) => <div key={String(label)} className="border border-[#121212] bg-[#FAF9F5] p-3"><span className="text-xs font-bold block">{label}</span><strong className="text-xl">{value}</strong></div>)}</div>
        {selected.blacklisted ? <p className="mb-4 text-xs font-bold text-[#B51F1F]">黑名单生效中 · {selected.blacklist_expires_at ? `截至 ${new Date(selected.blacklist_expires_at * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}` : '永久'}</p> : null}
        <div className="space-y-2 max-h-[430px] overflow-y-auto">{props.gifts.map((gift) => { const sent = gift.from_qq === selected.qq; return <div key={gift.id} className="border border-[#121212] bg-[#FAF9F5] p-3 flex gap-3 text-sm">{sent ? <ArrowUpRight size={18} className="text-[#D62828]" /> : <ArrowDownLeft size={18} className="text-[#004E98]" />}<div className="flex-1"><strong>{sent ? '送出' : '收到'}{gift.type === 'gm' ? ' GM 点赞' : '玩家点赞'}</strong><p className="text-[#555] mt-1">{sent ? gift.to_name : gift.from_name}</p></div><time className="text-xs text-[#777]">{new Date(gift.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}</time></div>; })}</div>
        <Pager offset={props.giftOffset} total={props.giftTotal} onChange={props.setGiftOffset} />
      </>}
    </section>
  </div>;
}
