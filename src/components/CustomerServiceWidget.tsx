import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, X, Trash2, Send } from 'lucide-react';
import { api, type ChatMessage } from '../services/api';

const hkTime = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '';
const SEEN_KEY = 'zgb_chat_lastseen';

/**
 * 猪猪客服：放在首页「按日期筛团」下方的站务对话入口。
 * 点击「开始对话」弹出右下角对话窗，直接进入站务后台（客服系统 → 猪猪客服对话）。
 * 不展示常见问题；用户可发消息、查看站务回复、清除自己的历史记录（同时清空后台对话）。
 */
export function CustomerServiceWidget({ userQq }: { userQq: string | null }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => localStorage.getItem(SEEN_KEY) || '');
  const listRef = useRef<HTMLDivElement>(null);

  const load = async () => {
    if (!userQq) return;
    try {
      const data = await api.chatThread();
      setMessages(data.messages);
      if (open) {
        const latest = data.messages.reduce((max, m) => (m.fromRole === 'admin' && m.createdAt > max ? m.createdAt : max), lastSeen);
        setLastSeen(latest);
        if (latest) localStorage.setItem(SEEN_KEY, latest);
      }
    } catch { /* 网络错误时静默，轮询会重试 */ }
  };

  useEffect(() => { if (open && userQq) { setLoading(true); load().finally(() => setLoading(false)); } }, [open, userQq]);
  // 打开时每 8 秒轮询新回复；关闭时每 30 秒刷新未读角标。
  useEffect(() => {
    if (!userQq) return;
    const timer = window.setInterval(() => { load(); }, open ? 8000 : 30000);
    return () => window.clearInterval(timer);
  }, [open, userQq, lastSeen]);
  useEffect(() => { if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [messages, open]);

  const unread = userQq ? messages.filter((m) => m.fromRole === 'admin' && m.createdAt > lastSeen).length : 0;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !userQq) return;
    setBusy(true);
    try {
      const res = await api.sendChat(content);
      setMessages((prev) => [...prev, res.message]);
      setDraft('');
    } catch { /* 忽略，等待轮询 */ } finally { setBusy(false); }
  };

  const clear = async () => {
    if (!userQq || !window.confirm('确定清除你与站务的全部对话记录吗？后台的对话也会一并删除。')) return;
    setBusy(true);
    try { await api.clearChat(); setMessages([]); setLastSeen(''); localStorage.removeItem(SEEN_KEY); }
    catch { /* 忽略 */ } finally { setBusy(false); }
  };

  return (
    <div className="bauhaus-card bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] flex flex-col">
      <div className="p-3">
        <div className="flex items-center gap-3">
          <img src="/zgb-logo.png" alt="" aria-hidden="true" className="h-14 w-14 object-contain [image-rendering:pixelated] shrink-0" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-black leading-none">猪猪客服</h3>
              {unread > 0 && !open && <span className="bg-[#D62828] text-white text-[10px] font-black px-1.5 py-0.5">{unread} 条未读</span>}
            </div>
          </div>
        </div>

        {userQq ? (
          <button type="button" onClick={() => setOpen(true)} className="mt-3 w-full bauhaus-btn bg-[#D62828] text-white py-2 text-sm gap-1.5">
            <MessageCircle size={15} />{unread > 0 ? `开始对话（${unread} 未读）` : '开始对话'}
          </button>
        ) : (
          <a href="/" className="mt-3 block text-center bauhaus-btn bg-[#121212] text-white py-2 text-sm">登录后使用客服</a>
        )}
      </div>

      {/* 右下角放大版站点 LOGO，底边贴住卡片底部分割线 */}
      <div className="mt-auto flex justify-end px-3 pb-0">
        <img src="/zgb-logo.png" alt="" aria-hidden="true" className="h-20 w-20 object-contain [image-rendering:pixelated]" />
      </div>

      {open && userQq && (
        <div className="fixed bottom-4 right-4 z-[120] w-[min(92vw,380px)] h-[min(78vh,560px)] bg-white border-4 border-[#121212] shadow-[6px_6px_0px_#D62828] flex flex-col">
          <div className="flex items-center justify-between gap-2 bg-[#121212] text-white px-3 py-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <img src="/zgb-logo.png" alt="" aria-hidden="true" className="h-7 w-7 object-contain [image-rendering:pixelated]" />
              <div className="min-w-0">
                <strong className="block text-sm leading-none">猪猪客服</strong>
                <span className="text-[10px] opacity-70">站务会尽快回复</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={clear} title="清除历史记录" className="p-1.5 hover:bg-white/15 rounded"><Trash2 size={15} /></button>
              <button type="button" onClick={() => setOpen(false)} title="收起" className="p-1.5 hover:bg-white/15 rounded"><X size={16} /></button>
            </div>
          </div>

          <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 p-3 bg-[#FAF9F5]">
            {loading && messages.length === 0 ? <p className="text-xs text-[#666] text-center py-6">加载中…</p>
              : messages.length === 0 ? <p className="text-xs text-[#666] text-center py-6 leading-relaxed px-2">请问有什么问题，猪主人看见后会立刻回复！如果问题解决，点击右上角删除标记可以删除本次对话。</p>
                : messages.map((m) => (
                  <div key={m.id} className={`flex ${m.fromRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[82%] px-3 py-2 text-sm ${m.fromRole === 'admin' ? 'bg-[#121212] text-white' : 'bg-white text-[#121212] border-2 border-[#121212]'}`}>
                      <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                      <time className="block text-[10px] opacity-70 mt-1 text-right">{hkTime(m.createdAt)}</time>
                    </div>
                  </div>
                ))}
          </div>

          <form onSubmit={send} className="flex gap-2 p-2 border-t-2 border-[#121212] bg-white shrink-0">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="输入消息，回车发送…" className="bauhaus-input flex-1 px-2.5 py-2 text-sm" />
            <button type="submit" disabled={busy || !draft.trim()} className="bauhaus-btn bg-[#D62828] text-white px-3"><Send size={16} /></button>
          </form>
        </div>
      )}
    </div>
  );
}
