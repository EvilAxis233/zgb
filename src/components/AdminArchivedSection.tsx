import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, CalendarDays, ChevronDown, ChevronUp, Clock3, MapPin, Phone, Search, Trash2, UsersRound, X } from 'lucide-react';
import { adminApi, type AdminArchivedCampaign } from '../services/api';
import { Pager, number } from './AdminCommon';

type ArchiveFilter = 'all' | 'closed' | 'finished' | 'abandoned';
const FILTERS: Array<{ key: ArchiveFilter; label: string }> = [
  { key: 'all', label: '全部封存' },
  { key: 'closed', label: '已封车' },
  { key: 'finished', label: '已结团' },
  { key: 'abandoned', label: '弃团' },
];
const hkDate = (value: string | null) => value ? new Date(value).toLocaleDateString('zh-CN', { timeZone: 'Asia/Hong_Kong' }) : '—';

// 弃团记录默认保留 30 天（与后端自动清理规则一致）。
const ABANDON_KEEP_DAYS = 30;
const purgeAt = (closedAt: string | null) => closedAt ? new Date(new Date(closedAt).getTime() + ABANDON_KEEP_DAYS * 86400000) : null;
const daysLeft = (closedAt: string | null) => {
  const p = purgeAt(closedAt);
  return p ? Math.max(0, Math.ceil((p.getTime() - Date.now()) / 86400000)) : 0;
};

/**
 * 后台「封存团务」：已封车 / 已结团 / 弃团的网团与面团。
 * 紧凑网格排布（宽屏 3 列 / 中屏 2 列 / 窄屏 1 列），不展示团介绍等长文本详情，只保留关键信息。
 * 支持按团名 / 规则 / 简介 / GM / 联系方式 / 平台地址 / 报名成员检索，280ms 防抖。
 */
export function AdminArchivedSection({ onError }: { onError: (error: unknown) => void }) {
  const [filter, setFilter] = useState<ArchiveFilter>('all');
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<AdminArchivedCampaign[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  // 折叠详情：同一时间只展开一张卡，避免网格被拉得高低不齐。
  const [expanded, setExpanded] = useState<string | null>(null);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setOffset(0); }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  const load = useCallback(() => {
    setLoading(true);
    adminApi.archivedCampaigns(filter, offset, search)
      .then((data) => { setItems(data.items); setTotal(data.total); })
      .catch((error) => onErrorRef.current(error))
      .finally(() => setLoading(false));
  }, [filter, offset, search]);
  useEffect(() => { load(); }, [load]);

  const changeFilter = (next: ArchiveFilter) => { setFilter(next); setOffset(0); };

  const keep = async (id: string) => {
    setBusy(id);
    try {
      await adminApi.keepAbandoned(id);
      load();
    } catch (error) { onErrorRef.current(error); } finally { setBusy(null); }
  };
  const remove = async (id: string) => {
    if (!window.confirm('确定直接删除这条弃团记录吗？删除后仅后台封存不可见，数据仍可恢复。')) return;
    setBusy(id);
    try {
      await adminApi.deleteAbandoned(id);
      load();
    } catch (error) { onErrorRef.current(error); } finally { setBusy(null); }
  };

  return <section>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4 border-b-2 border-[#121212] pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="封存状态">
          {FILTERS.map((item) => <button key={item.key} type="button" role="tab" aria-selected={filter === item.key} onClick={() => changeFilter(item.key)}
            className={`bauhaus-btn px-4 py-2 text-sm ${filter === item.key ? 'bg-[#121212] text-white' : 'bg-white'}`}>{item.label}</button>)}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666]" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="检索团名 / GM / 规则 / 成员"
            className="bauhaus-input w-full pl-7 pr-7 py-1.5 text-xs" aria-label="检索封存团务" />
          {query && <button type="button" onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#666] cursor-pointer" aria-label="清空检索"><X size={13} /></button>}
        </div>
      </div>
      <p className="text-[11px] font-bold text-[#666]">仅网团 / 面团 · 宣群「结束宣发」不在此列 · {search ? `检索「${search}」命中 ${number(total)} 条` : `共 ${number(total)} 条`}</p>
    </div>

    {loading ? <div className="bauhaus-card bg-white p-12 text-center text-sm font-bold text-[#666]">正在读取封存团务…</div>
      : !items.length ? <div className="bauhaus-card bg-white p-12 text-center text-sm text-[#666]">{search ? `没有匹配「${search}」的封存团务，换个关键词试试。` : '当前筛选下暂无封存团务。团封车或结团后会自动出现在这里。'}</div>
        : <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 items-start">
          {items.map((c) => {
            const tag = c.status === 'finished'
              ? { text: '已结团', cls: 'bg-[#FAE7E7] text-[#B51F1F]' }
              : c.abandoned ? { text: '弃团', cls: 'bg-[#E8E4DA] text-[#5B5646]' } : { text: '已封车', cls: 'bg-[#FFF0D6] text-[#8A5A00]' };
            const open = expanded === c.id;
            // 平台/地址：网团看平台，面团看省市地址（直辖市/地址已含城市时不重复拼接）。
            const region = c.province && c.city && (c.city.startsWith(c.province) || c.province.startsWith(c.city))
              ? c.city : [c.province, c.city].filter(Boolean).join(' ');
            const place = c.kind === 'offline'
              ? (c.address && region && c.address.startsWith(region) ? c.address : [region, c.address].filter(Boolean).join(' ')) || '—'
              : (c.platforms?.length ? c.platforms.join('、') : '—');
            return <article key={c.id} className="bauhaus-card bg-white p-3 flex flex-col gap-2 min-w-0">
              {/* 折叠态只留：状态标签 + 封存日期 + 团名，其余全部进「详情」 */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 px-2 py-0.5 border-2 border-[#121212] text-[11px] font-black ${tag.cls}`}>{tag.text}</span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-[#888]">{hkDate(c.status === 'finished' ? c.finishedAt : c.closedAt)}</span>
                <button type="button" onClick={() => setExpanded(open ? null : c.id)} aria-expanded={open}
                  className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-black text-[#004E98] hover:text-[#D62828] cursor-pointer">
                  {open ? <>收起<ChevronUp size={12} /></> : <>详情<ChevronDown size={12} /></>}
                </button>
              </div>

              <strong className={`block text-sm leading-snug break-words line-clamp-2 ${open ? '' : 'min-h-[2.75em]'}`} title={c.title}>{c.title}</strong>

              {open && <div className="flex flex-col gap-1.5 border-t border-dashed border-[#DDDDD5] pt-2 text-[11px] leading-snug text-[#444]">
                <div className="font-bold text-[#666] min-w-0">
                  <p className="truncate"><span className="text-[#121212]">{c.rule}</span> · {c.kind === 'offline' ? '面团' : '网团'}</p>
                  <p className="truncate">GM {c.gmName}（{c.gmQq}）</p>
                </div>

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold text-[#444]">
                  <span className="inline-flex items-center gap-1" title={`开团日期 ${c.scheduledDate}`}><CalendarDays size={12} />{c.scheduledDate.slice(5)}</span>
                  <span className="inline-flex items-center gap-1" title={`时段 ${c.timePeriod}（${c.timeSchedule}）`}><Clock3 size={12} />{c.timePeriod}</span>
                  <span className="inline-flex items-center gap-1" title="报名人数 / 满员人数"><UsersRound size={12} />{c.memberCount}/{c.maxPlayers}</span>
                </div>

                <div className="flex items-start gap-1.5 min-w-0">
                  <Phone size={12} className="mt-0.5 shrink-0" />
                  <p className="min-w-0 break-all"><span className="font-black text-[#121212]">联系方式 </span>{c.contact || '—'}</p>
                </div>
                <div className="flex items-start gap-1.5 min-w-0">
                  <MapPin size={12} className="mt-0.5 shrink-0" />
                  <p className="min-w-0 break-words"><span className="font-black text-[#121212]">{c.kind === 'offline' ? '地址 ' : '平台 '}</span>{place}</p>
                </div>
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5"><UsersRound size={12} /><span className="font-black text-[#121212]">报名名单 {c.memberCount}/{c.maxPlayers}</span></p>
                  {c.members.length
                    ? <ul className="mt-1 pl-4 space-y-0.5">{c.members.map((m) => <li key={m.qq} className="truncate text-[#666]" title={`${m.name}（${m.qq}）`}>{m.name}（{m.qq}）</li>)}</ul>
                    : <p className="mt-0.5 pl-4 text-[#888]">暂无报名成员</p>}
                </div>

                {c.abandoned && <div className="flex flex-wrap items-center gap-1.5 border-t border-dashed border-[#DDDDD5] pt-2">
                  {c.kept
                    ? <span className="text-[10px] font-bold text-[#5B7A4B]">已保留（不自动清理）</span>
                    : <span className="text-[10px] font-bold text-[#8A5A00]">剩 {daysLeft(c.closedAt)} 天自动清理</span>}
                  <span className="flex-1" />
                  {!c.kept && <button type="button" onClick={() => keep(c.id)} disabled={busy === c.id}
                    className="bauhaus-btn px-2 py-0.5 text-[10px] bg-white disabled:opacity-50">保留记录</button>}
                  <button type="button" onClick={() => remove(c.id)} disabled={busy === c.id}
                    className="bauhaus-btn px-2 py-0.5 text-[10px] bg-[#B51F1F] text-white disabled:opacity-50 flex items-center gap-1"><Trash2 size={11} />直接删除</button>
                </div>}
              </div>}
            </article>;
          })}
        </div>}

    <Pager offset={offset} total={total} setOffset={setOffset} />
    <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#777]"><Archive size={13} />封存记录只供管理查看，不会重新出现在首页发车看板。卡片默认只显示团名与封存日期，点右上「详情」展开规则、GM、开团时间、联系方式、平台/地址与报名名单（团介绍不展示）。检索支持团名、规则、简介、GM 昵称或 QQ、联系方式、平台地址与报名成员，可与状态筛选组合。弃团记录默认保留 30 天，到期自动清理，可点「保留记录」永久留存或「直接删除」立即移除。</p>
  </section>;
}
