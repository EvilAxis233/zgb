import { useEffect, useRef, useState } from 'react';
import { Archive, ChevronDown, Clock3, LockKeyhole, MapPin, UsersRound } from 'lucide-react';
import { adminApi, type AdminArchivedCampaign } from '../services/api';
import { Pager, number } from './AdminCommon';

type ArchiveFilter = 'all' | 'closed' | 'finished';
const FILTERS: Array<{ key: ArchiveFilter; label: string }> = [
  { key: 'all', label: '全部封存' },
  { key: 'closed', label: '已封车' },
  { key: 'finished', label: '已结团' },
];
const hkTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '—';

/** 后台「封存团务」：查看已封车 / 已结团的网团与面团，可展开看完整内容与报名名单。 */
export function AdminArchivedSection({ onError }: { onError: (error: unknown) => void }) {
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  const [offset, setOffset] = useState(0);
  const [items, setItems] = useState<AdminArchivedCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminApi.archivedCampaigns(filter, offset)
      .then((data) => { if (alive) { setItems(data.items); setTotal(data.total); setExpanded(null); } })
      .catch((error) => { if (alive) onErrorRef.current(error); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filter, offset]);

  const changeFilter = (next: ArchiveFilter) => { setFilter(next); setOffset(0); };

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4 border-b-2 border-[#121212] pb-3">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="封存状态">
        {FILTERS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => changeFilter(item.key)}
          className={`bauhaus-btn px-4 py-2 text-sm ${filter === item.key ? 'bg-[#121212] text-white' : 'bg-white'}`}>{item.label}</button>)}
      </div>
      <p className="text-[11px] font-bold text-[#666]">仅网团 / 面团 · 宣群「结束宣发」不在此列 · 共 {number(total)} 条</p>
    </div>
    {loading ? <div className="bauhaus-card bg-white p-12 text-center text-sm font-bold text-[#666]">正在读取封存团务…</div>
      : !items.length ? <div className="bauhaus-card bg-white p-12 text-center text-sm text-[#666]">当前筛选下暂无封存团务。团封车或结团后会自动出现在这里。</div>
        : <div className="space-y-3">{items.map((c) => {
          const isOpen = expanded === c.id;
          return <article key={c.id} className="bauhaus-card bg-white">
            <button type="button" onClick={() => setExpanded(isOpen ? null : c.id)} className="w-full flex flex-wrap items-center gap-3 p-4 text-left cursor-pointer">
              <span className={`shrink-0 px-2 py-1 border-2 border-[#121212] text-[11px] font-black ${c.status === 'finished' ? 'bg-[#FAE7E7] text-[#B51F1F]' : 'bg-[#FFF0D6] text-[#8A5A00]'}`}>
                {c.status === 'finished' ? '已结团' : '已封车'}
              </span>
              <div className="min-w-0 flex-1">
                <strong className="block text-sm break-words">{c.title}</strong>
                <span className="text-[11px] font-bold text-[#666]">{c.rule} · {c.kind === 'offline' ? '面团' : '网团'} · GM {c.gmName}（{c.gmQq}）</span>
              </div>
              <div className="shrink-0 text-[11px] font-bold text-[#666] text-right">
                <span className="block">{c.scheduledDate} {c.timePeriod} · {c.timeSchedule}</span>
                <span className="block">{c.status === 'finished' ? hkTime(c.finishedAt) : hkTime(c.closedAt)} 封存</span>
              </div>
              <ChevronDown size={16} className={`shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="border-t-2 border-dashed border-[#CFCBC0] px-4 py-3 grid gap-3 md:grid-cols-[1.4fr_1fr] text-xs">
              <div className="space-y-2 min-w-0">
                <p><b>详情：</b></p>
                <p className="whitespace-pre-wrap break-words text-[#444] leading-relaxed border border-[#DDD] bg-[#FAF9F5] p-2 max-h-56 overflow-y-auto">{c.description || '（未填写）'}</p>
                <p><b>联系方式：</b><span className="whitespace-pre-wrap break-words">{c.contact || '（未填写）'}</span></p>
                <p className="text-[11px] text-[#777]">团 ID：<span className="font-mono">{c.id}</span> · 发布时间 {hkTime(c.createdAt)}</p>
              </div>
              <div className="space-y-2">
                <p className="flex items-center gap-1.5"><UsersRound size={14} />报名 <b>{c.memberCount}/{c.maxPlayers}</b> 人</p>
                <p className="flex items-center gap-1.5"><Clock3 size={14} />形式：{c.sessionType || '—'} · 平台：{c.platforms.length ? c.platforms.join(' / ') : '—'}</p>
                {c.kind === 'offline' && <p className="flex items-center gap-1.5"><MapPin size={14} />{[c.province, c.city, c.address].filter(Boolean).join(' ') || '—'}</p>}
                <p className="flex items-center gap-1.5"><LockKeyhole size={14} />封车 {hkTime(c.closedAt)} · 结团 {hkTime(c.finishedAt)}</p>
                <div><b>报名名单（{c.members.length}）：</b><div className="mt-1 flex flex-wrap gap-1">{c.members.length ? c.members.map((m) => <span key={m.qq} className="border border-[#121212] bg-[#F2F0E8] px-1.5 py-0.5 text-[10px] font-bold">{m.name}（{m.qq}）</span>) : <span className="text-[#888]">无</span>}</div></div>
              </div>
            </div>}
          </article>;
        })}</div>}
    <Pager offset={offset} total={total} setOffset={setOffset} />
    <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#777]"><Archive size={13} />封存记录只供管理查看，不会重新出现在首页发车看板。</p>
  </section>;
}
