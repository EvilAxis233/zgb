import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, ExternalLink, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { adminApi, type AdminResource, type AdminResourceCounts } from '../services/api';
import { useDialog } from './BauhausDialog';
import { Pager, number } from './AdminCommon';
import { safeHref } from './ResourceView';

type ReviewFilter = 'pending' | 'approved' | 'rejected' | 'all';
const CATEGORY_LABEL: Record<string, string> = { rulebook: '规则书', module: '模组或世设', tool: '实用工具', fun: '趣味书籍' };
const TYPE_LABEL: Record<string, string> = { pan: '网盘下载', wiki: '在线查询', other: '其他' };
const FLAG_LABEL: Record<string, string> = { zh: '中文', en: '英文', ja: '日文', other_lang: '其它语言', official: '官方', reprint: '转载', self: '自译', machine: '机翻', collected: '网络搜集' };
const STATUS_LABEL: Record<string, string> = { pending: '待审核', approved: '已通过', rejected: '已驳回' };
const STATUS_STYLE: Record<string, string> = { pending: 'bg-[#FFF4D6] text-[#7A4B00] border-[#7A4B00]', approved: 'bg-[#E7F5F1] text-[#176B57] border-[#176B57]', rejected: 'bg-[#FAF0F0] text-[#B51F1F] border-[#B51F1F]' };
const hkTime = (value: string | null) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '—';

/** 后台「资源审核」：通过后才会展示在首页爱心资源；改过链接的资源会自动回到待审核。 */
export function AdminResourcesSection({ onNotice, onError, onPendingChange }: { onNotice: (message: string) => void; onError: (error: unknown) => void; onPendingChange?: (pending: number) => void }) {
  const { showConfirm } = useDialog();
  const [filter, setFilter] = useState<ReviewFilter>('pending');
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  // 折叠详情：同一时间只展开一张卡，默认只保留标题行。
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<AdminResource[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<AdminResourceCounts>({ pending: 0, approved: 0, rejected: 0 });
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [reload, setReload] = useState(0);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  // 待审条数同步给父级，导航按钮上的红点能即时消长。
  const onPendingChangeRef = useRef(onPendingChange);
  useEffect(() => { onPendingChangeRef.current = onPendingChange; }, [onPendingChange]);

  // 检索防抖 280ms，输入后自动回到第一页。
  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setOffset(0); }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminApi.resources(filter, offset, search)
      .then((data) => { if (alive) { setItems(data.items); setTotal(data.total); setCounts(data.counts); onPendingChangeRef.current?.(data.counts.pending); } })
      .catch((error) => { if (alive) onErrorRef.current(error); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [filter, offset, search, reload]);

  const changeFilter = (next: ReviewFilter) => { setFilter(next); setOffset(0); };
  const act = async (item: AdminResource, status: 'pending' | 'approved' | 'rejected') => {
    setBusy(item.id);
    try {
      await adminApi.reviewResource(item.id, status, notes[item.id] || '');
      setReload((value) => value + 1);
      onNotice(status === 'approved' ? `「${item.name}」已通过，现已在爱心资源页展示` : status === 'rejected' ? `「${item.name}」已驳回` : `「${item.name}」已退回待审核`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(''); }
  };
  const remove = async (item: AdminResource) => {
    if (!await showConfirm({ title: '删除资源', message: `确定彻底删除「${item.name}」吗？此操作不可恢复。`, confirmText: '确认删除', type: 'danger' })) return;
    setBusy(item.id);
    try {
      await adminApi.deleteResource(item.id);
      setReload((value) => value + 1);
      onNotice(`「${item.name}」已删除`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(''); }
  };

  const tabs: Array<{ key: ReviewFilter; label: string; count: number }> = [
    { key: 'pending', label: '待审核', count: counts.pending },
    { key: 'approved', label: '已通过', count: counts.approved },
    { key: 'rejected', label: '已驳回', count: counts.rejected },
    { key: 'all', label: '全部', count: counts.pending + counts.approved + counts.rejected },
  ];
  return <section>
    <div className="flex flex-wrap items-end justify-between gap-3 mb-4 border-b-2 border-[#121212] pb-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="审核状态">
          {tabs.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={filter === tab.key} onClick={() => changeFilter(tab.key)}
            className={`bauhaus-btn relative px-4 py-2 text-sm gap-1.5 ${filter === tab.key ? 'bg-[#121212] text-white' : 'bg-white'}`}>
            {tab.label}<span className="text-[11px]">({number(tab.count)})</span>
            {tab.key === 'pending' && tab.count > 0 && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#D62828] border-2 border-white rounded-full" title={`${number(tab.count)} 条资源待审核`} aria-label={`${number(tab.count)} 条资源待审核`} />}
          </button>)}
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666]" aria-hidden="true" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="检索资源名 / 链接 / 分享者"
            className="bauhaus-input w-full pl-7 pr-7 py-1.5 text-xs" aria-label="检索资源审核" />
          {query && <button type="button" onClick={() => setQuery('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#666] cursor-pointer" aria-label="清空检索"><X size={13} /></button>}
        </div>
      </div>
      <p className="text-[11px] font-bold text-[#666]">新分享与「改过链接」的分享需审核 · {search ? `检索「${search}」命中 ${number(total)} 条` : '只改标题 / 备注 / 标签不重新审核'}</p>
    </div>
    {loading ? <div className="bauhaus-card bg-white p-12 text-center text-sm font-bold text-[#666]">正在读取资源…</div>
      : !items.length ? <div className="bauhaus-card bg-white p-12 text-center text-sm text-[#666]">{search ? `没有匹配「${search}」的资源，换个关键词试试。` : filter === 'pending' ? '太好了，当前没有待审核的资源。' : '当前筛选下暂无资源。'}</div>
        : <div className="space-y-3">{items.map((item) => {
          const href = safeHref(item.url);
          const open = expanded === item.id;
          return <article key={item.id} className="bauhaus-card bg-white p-4">
            {/* 折叠态只保留标题行：状态 + 资源名 + 分类/类型 + 详情开关 */}
            <div className={`flex flex-wrap items-center gap-2 min-w-0 ${open ? 'border-b border-[#CCC] pb-2' : ''}`}>
              <span className={`px-2 py-0.5 border-2 text-[11px] font-black ${STATUS_STYLE[item.reviewStatus] || STATUS_STYLE.pending}`}>{STATUS_LABEL[item.reviewStatus] || '待审核'}</span>
              <h3 className={`min-w-0 flex-1 text-sm font-black ${open ? 'break-words' : 'truncate'}`} title={item.name}>{item.name}</h3>
              <span className="border border-[#121212] bg-[#F2F0E8] px-1.5 py-0.5 text-[10px] font-black">{CATEGORY_LABEL[item.category] || '规则书'}</span>
              <span className="border border-[#121212] bg-[#F2F0E8] px-1.5 py-0.5 text-[10px] font-black">{TYPE_LABEL[item.type] || '其他'}</span>
              <button type="button" onClick={() => setExpanded(open ? null : item.id)} aria-expanded={open}
                className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-black text-[#004E98] hover:text-[#D62828] cursor-pointer">
                {open ? <>收起<ChevronUp size={12} /></> : <>详情<ChevronDown size={12} /></>}
              </button>
            </div>
            {open && <>
              <div className="mt-2 grid gap-2 md:grid-cols-[1.4fr_1fr] text-xs">
                <div className="min-w-0 space-y-1">
                  <p className="break-all"><b>链接：</b>{href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-[#004E98] underline">{item.url}<ExternalLink size={11} className="inline ml-0.5" /></a> : <span className="text-[#B51F1F]">{item.url}（无效链接）</span>}</p>
                  <p className="break-words"><b>备注：</b>{item.note || '（未填写）'}</p>
                  <p className="flex flex-wrap gap-1 items-center"><b>标签：</b>{item.flags.length ? item.flags.map((flag) => <span key={flag} className="border border-[#121212] px-1 py-0.5 text-[10px] font-bold">{FLAG_LABEL[flag] || flag}</span>) : <span className="text-[#888]">无</span>}</p>
                  {item.reviewNote && <p className="font-bold text-[#B51F1F]">审核备注：{item.reviewNote}</p>}
                </div>
                <div className="space-y-1 text-[11px] text-[#666]">
                  <p><b className="text-[#121212]">分享者：</b>{item.uploaderName}（{item.uploaderQq}）</p>
                  <p>发布 {hkTime(item.createdAtFull)} · 更新 {hkTime(item.updatedAtFull)}</p>
                  <p>审核 {item.reviewedBy ? `${item.reviewedBy} · ${hkTime(item.reviewedAt)}` : '—'}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-[#CFCBC0] pt-2">
                <input aria-label={`审核备注 ${item.name}`} value={notes[item.id] ?? item.reviewNote ?? ''} onChange={(e) => setNotes((current) => ({ ...current, [item.id]: e.target.value }))}
                  maxLength={200} placeholder="审核备注 / 驳回原因（选填）" className="bauhaus-input min-w-[180px] flex-1 px-2 py-1.5 text-xs" />
                <button disabled={busy === item.id} onClick={() => act(item, 'approved')} className="bauhaus-btn gap-1 bg-[#176B57] px-3 py-1.5 text-xs font-black text-white"><Check size={14} />通过</button>
                <button disabled={busy === item.id} onClick={() => act(item, 'rejected')} className="bauhaus-btn gap-1 bg-white px-3 py-1.5 text-xs font-black text-[#B51F1F]"><X size={14} />驳回</button>
                {item.reviewStatus !== 'pending' && <button disabled={busy === item.id} onClick={() => act(item, 'pending')} className="bauhaus-btn bg-white px-3 py-1.5 text-xs font-black">退回待审</button>}
                <button disabled={busy === item.id} onClick={() => remove(item)} className="bauhaus-btn gap-1 bg-[#FAF0F0] px-2 py-1.5 text-xs font-black text-[#B51F1F]" aria-label="删除资源"><Trash2 size={14} /></button>
              </div>
            </>}
          </article>;
        })}</div>}
    <Pager offset={offset} total={total} setOffset={setOffset} />
    <p className="mt-4 flex items-center gap-1.5 text-[11px] text-[#777]"><ShieldCheck size={13} />只有「已通过」的资源会出现在首页爱心资源页；驳回原因会显示给分享者。卡片默认只显示标题行，点「详情」展开链接、备注与审核操作；检索支持资源名、链接、备注、标签、分享者昵称或 QQ、审核备注与审核人，可与状态筛选组合。</p>
  </section>;
}
