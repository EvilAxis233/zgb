import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Clock3, Flag, MessageSquareText } from 'lucide-react';
import { adminApi, type AdminSubmission } from '../services/api';
import { statusLabels, statusClasses } from '../utils/submissions';
import { CollapsibleList, Pager, number } from './AdminCommon';

type TicketKind = 'feedback' | 'report';
type ListKey = 'open' | 'resolved' | 'rejected';
type TicketLists = Record<ListKey, { items: AdminSubmission[]; total: number }>;
const EMPTY: TicketLists = { open: { items: [], total: 0 }, resolved: { items: [], total: 0 }, rejected: { items: [], total: 0 } };
const KIND_NAME: Record<TicketKind, string> = { feedback: '反馈', report: '举报' };

/**
 * 后台「反馈与举报」：一个分页里再分「反馈 / 举报」两页；
 * 未处理工单直接展示，已解决与已驳回分别折叠，点开才加载内容。
 */
export function AdminTicketsSection({ onNotice, onError }: { onNotice: (message: string) => void; onError: (error: unknown) => void }) {
  const [kind, setKind] = useState<TicketKind>('feedback');
  const [offsets, setOffsets] = useState<Record<ListKey, number>>({ open: 0, resolved: 0, rejected: 0 });
  const [lists, setLists] = useState<TicketLists>(EMPTY);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  // 回调来自父组件，放进 ref 避免每次渲染都触发重新拉数据。
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    Promise.all([
      adminApi.submissions(kind, 'open', offsets.open),
      adminApi.submissions(kind, 'resolved', offsets.resolved),
      adminApi.submissions(kind, 'rejected', offsets.rejected),
    ]).then(([open, resolved, rejected]) => {
      if (!alive) return;
      setLists({
        open: { items: open.submissions, total: open.total },
        resolved: { items: resolved.submissions, total: resolved.total },
        rejected: { items: rejected.submissions, total: rejected.total },
      });
      setNotes(Object.fromEntries([...open.submissions, ...resolved.submissions, ...rejected.submissions].map((item) => [item.id, item.admin_note || ''])));
    }).catch((error) => { if (alive) onErrorRef.current(error); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [kind, offsets, reload]);

  const changeKind = (next: TicketKind) => {
    if (next === kind) return;
    setKind(next);
    setOffsets({ open: 0, resolved: 0, rejected: 0 });
  };
  const setOffset = (key: ListKey, value: number) => setOffsets((current) => ({ ...current, [key]: value }));

  const update = async (item: AdminSubmission, status: AdminSubmission['status']) => {
    setBusy(true);
    try {
      await adminApi.updateSubmission(item.id, status, notes[item.id] || '');
      setReload((value) => value + 1);
      onNotice(`${KIND_NAME[item.type]}状态已更新`);
    } catch (error) { onError(error); } finally { setBusy(false); }
  };

  const renderItem = (item: AdminSubmission) => <article key={item.id} className="bauhaus-card bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#CCC] pb-3"><div className="flex items-center gap-3"><span className={`px-2 py-1 border text-xs font-black ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span><div><strong className="block text-sm">{item.user_name} <span className="font-mono text-[#666]">({item.user_qq})</span></strong><time className="text-[11px] text-[#777]">{new Date(item.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}</time></div></div><span className="font-mono text-[10px] text-[#888]">{item.id}</span></div>{item.type === 'report' && <p className="mt-4 text-sm font-bold text-[#B51F1F]">被举报人：{item.reported_name || '未关联账号'} {item.reported_qq ? `(${item.reported_qq})` : ''}</p>}<p className="whitespace-pre-wrap text-sm leading-6 py-4">{item.content}</p>{item.images.length > 0 && <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-9 gap-2 mb-4">{item.images.map((src, index) => <a key={src} href={src} target="_blank" rel="noreferrer" className="aspect-square border-2 border-[#121212] overflow-hidden bg-[#EEE]"><img src={src} alt={`提交图片 ${index + 1}`} className="w-full h-full object-cover" /></a>)}</div>}<div className="grid md:grid-cols-[1fr_auto] gap-3 items-end border-t border-[#CCC] pt-4"><div><label htmlFor={`note-${item.id}`} className="block text-xs font-black mb-1">管理员受理备注</label><textarea id={`note-${item.id}`} rows={2} maxLength={2000} value={notes[item.id] || ''} onChange={(e) => setNotes((current) => ({ ...current, [item.id]: e.target.value }))} placeholder="填写核查结果、处理方式或内部备注…" className="bauhaus-input w-full px-3 py-2 text-sm" /></div><div className="flex flex-wrap gap-2"><button disabled={busy} onClick={() => update(item, item.status)} className="bauhaus-btn bg-white px-3 py-2 text-xs">保存备注</button>{item.status !== 'processing' && <button disabled={busy} onClick={() => update(item, 'processing')} className="bauhaus-btn bg-[#004E98] text-white px-3 py-2 text-xs"><Clock3 size={14} />处理中</button>}<button disabled={busy} onClick={() => update(item, 'resolved')} className="bauhaus-btn bg-[#176B57] text-white px-3 py-2 text-xs"><CheckCircle2 size={14} />已解决</button><button disabled={busy} onClick={() => update(item, 'rejected')} className="bauhaus-btn bg-white text-[#B51F1F] px-3 py-2 text-xs">驳回</button></div></div></article>;

  const empty = (text: string) => <div className="bauhaus-card bg-white p-10 text-center text-sm text-[#666]">{text}</div>;
  return <section>
    <div className="flex flex-wrap gap-2 mb-4 border-b-2 border-[#121212] pb-3" role="tablist" aria-label="工单类型">
      {([['feedback', MessageSquareText, '反馈'], ['report', Flag, '举报']] as const).map(([key, Icon, label]) => (
        <button key={key} type="button" role="tab" aria-selected={kind === key} onClick={() => changeKind(key)}
          className={`bauhaus-btn px-5 py-2.5 gap-2 text-sm ${kind === key ? 'bg-[#121212] text-white' : 'bg-white'}`}>
          <Icon size={16} />{label}
        </button>
      ))}
      <p className="ml-auto self-center text-[11px] font-bold text-[#666]">默认只显示未处理；已解决 / 已驳回折叠在下方 · 图片可点击查看原图</p>
    </div>
    {loading ? <div className="bauhaus-card bg-white p-12 text-center text-sm font-bold text-[#666]">正在加载{KIND_NAME[kind]}工单…</div> : <>
      <div className="space-y-4">
        {lists.open.items.map(renderItem)}
        {!lists.open.items.length && empty(`暂无未处理的${KIND_NAME[kind]}，已解决 / 已驳回见下方折叠区`)}
      </div>
      <Pager offset={offsets.open} total={lists.open.total} setOffset={(v) => setOffset('open', v)} />
      <CollapsibleList title="已解决" count={lists.resolved.total} tone="green">
        {lists.resolved.items.map(renderItem)}
        {!lists.resolved.items.length && empty('暂无已解决记录')}
        <Pager offset={offsets.resolved} total={lists.resolved.total} setOffset={(v) => setOffset('resolved', v)} />
      </CollapsibleList>
      <CollapsibleList title="已驳回" count={lists.rejected.total} tone="red">
        {lists.rejected.items.map(renderItem)}
        {!lists.rejected.items.length && empty('暂无已驳回记录')}
        <Pager offset={offsets.rejected} total={lists.rejected.total} setOffset={(v) => setOffset('rejected', v)} />
      </CollapsibleList>
    </>}
    <p className="mt-4 text-[11px] text-[#777]">共 {number(lists.open.total + lists.resolved.total + lists.rejected.total)} 条{KIND_NAME[kind]}记录</p>
  </section>;
}
