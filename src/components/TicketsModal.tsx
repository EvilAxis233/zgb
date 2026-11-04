import { useEffect, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { api, type UserTicket } from '../services/api';
import { statusClasses, statusLabels } from '../utils/submissions';

export function TicketsModal({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [tickets, setTickets] = useState<UserTicket[]>([]);
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    return () => element.close();
  }, []);

  useEffect(() => {
    let active = true;
    let fetching = false;
    const load = async () => {
      if (fetching) return;
      fetching = true;
      try {
        const data = await api.tickets(offset);
        if (active) { setTickets(data.submissions); setTotal(data.total); setError(''); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : '加载工单失败');
      } finally {
        fetching = false;
        if (active) setLoading(false);
      }
    };
    setLoading(true);
    void load();
    const refresh = () => { if (!document.hidden) void load(); };
    const timer = window.setInterval(refresh, 15000);
    window.addEventListener('focus', refresh);
    return () => { active = false; window.clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [offset, reload]);

  const time = (value: string) => new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false });
  return <dialog ref={dialog} onCancel={onClose} aria-labelledby="tickets-title" className="m-auto w-[calc(100%-2rem)] max-w-2xl max-h-[90vh] border-4 border-[#121212] bg-[#FAF9F5] p-0 text-[#121212] shadow-[8px_8px_0px_#121212] backdrop:bg-black/60">
    <header className="sticky top-0 bg-[#121212] text-white flex items-center justify-between gap-3 px-5 py-3">
      <h2 id="tickets-title" className="font-black">工单 · 我的反馈与举报</h2>
      <button type="button" aria-label="关闭工单" onClick={onClose} className="p-1 cursor-pointer"><X size={20} /></button>
    </header>
    <div className="p-4 sm:p-5 space-y-4">
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-[#666]">受理状态与后台同步，每 15 秒自动刷新。</p><button type="button" disabled={loading} onClick={() => setReload((value) => value + 1)} className="bauhaus-btn bg-white px-3 py-2 text-xs shrink-0 gap-1"><RefreshCw size={14} />刷新</button></div>
      {error && <p role="alert" className="text-sm text-[#B51F1F]">{error}</p>}
      {loading ? <p role="status" className="py-8 text-center text-sm">加载中…</p> : <>
        {!error && !tickets.length && <p className="py-8 text-center text-sm text-[#666]">暂无反馈或举报工单</p>}
        {tickets.map((item) => <article key={item.id} className="border-2 border-[#121212] bg-white p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{item.type === 'report' ? '举报' : '反馈'}</strong><span className={`border px-2 py-1 text-xs font-black ${statusClasses[item.status]}`}>{statusLabels[item.status]}</span></div>
          <p className="text-[11px] text-[#666] break-all">工单号：{item.id}<br />提交：{time(item.created_at)}<br />更新：{time(item.updated_at)}</p>
          {item.type === 'report' && <p className="text-xs font-bold">被举报人：{item.reported_name || '未关联账号'} {item.reported_qq || ''}</p>}
          <p className="whitespace-pre-wrap break-words text-sm leading-6">{item.content}</p>
          {!!item.images.length && <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">{item.images.map((src, index) => <a key={src} href={src} target="_blank" rel="noreferrer" className="border border-[#121212]"><img src={src} alt={`工单附件 ${index + 1}`} className="aspect-square w-full object-cover" /></a>)}</div>}
        </article>)}
        <div className="flex items-center justify-end gap-3 text-xs font-bold"><button type="button" disabled={!offset} onClick={() => setOffset(Math.max(0, offset - 30))} className="bauhaus-btn bg-white px-3 py-2">上一页</button><span>{total ? offset + 1 : 0}–{Math.min(offset + 30, total)} / {total}</span><button type="button" disabled={offset + 30 >= total} onClick={() => setOffset(offset + 30)} className="bauhaus-btn bg-white px-3 py-2">下一页</button></div>
      </>}
    </div>
  </dialog>;
}
