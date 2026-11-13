import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageCircle, X, Trash2, Send } from 'lucide-react';
import { api, type ChatMessage } from '../services/api';

const hkTime = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '';
const SEEN_KEY = 'zgb_chat_lastseen';

export interface ChatInbox {
  messages: ChatMessage[];
  unread: number;
  loading: boolean;
  busy: boolean;
  draft: string;
  setDraft: (value: string) => void;
  send: (event: FormEvent) => void;
  clear: () => void;
}

/**
 * 客服收件箱状态提升到 App 顶层：无论用户在首页、个人档案还是爱心资源页，
 * 都会持续轮询站务回复，顶栏铃铛与首页提示条共享同一份未读数。
 * 打开对话窗即把最新站务消息标记为已读（本地记录时间），未读随之清零。
 */
export function useChatInbox(userQq: string | null, open: boolean): ChatInbox {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastSeen, setLastSeen] = useState<string>(() => localStorage.getItem(SEEN_KEY) || '');
  const openRef = useRef(open); openRef.current = open;
  const seenRef = useRef(lastSeen); seenRef.current = lastSeen;

  const load = useCallback(async () => {
    if (!userQq) return;
    try {
      const data = await api.chatThread();
      setMessages(data.messages);
      if (openRef.current) {
        const latest = data.messages.reduce((max, m) => m.fromRole === 'admin' && m.createdAt > max ? m.createdAt : max, seenRef.current);
        if (latest && latest > seenRef.current) {
          seenRef.current = latest;
          setLastSeen(latest);
          localStorage.setItem(SEEN_KEY, latest);
        }
      }
    } catch { /* 网络错误时静默，轮询会重试 */ }
  }, [userQq]);

  useEffect(() => {
    if (!userQq) { setMessages([]); return; }
    setLoading(true);
    void load().finally(() => setLoading(false));
    // 打开时 8 秒刷新一次，收起时 30 秒检查一次新消息。
    const timer = window.setInterval(() => { void load(); }, open ? 8000 : 30000);
    return () => window.clearInterval(timer);
  }, [userQq, open, load]);

  const unread = userQq ? messages.filter((m) => m.fromRole === 'admin' && m.createdAt > lastSeen).length : 0;

  const send = (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !userQq || busy) return;
    setBusy(true);
    api.sendChat(content).then((res) => {
      setMessages((prev) => [...prev, res.message]);
      setDraft('');
    }).catch(() => { /* 忽略，等待轮询 */ }).finally(() => setBusy(false));
  };

  const clear = () => {
    if (!userQq || busy) return;
    if (!window.confirm('确定清除你与站务的全部对话记录吗？后台的对话也会一并删除。')) return;
    setBusy(true);
    api.clearChat().then(() => {
      setMessages([]); setLastSeen(''); seenRef.current = ''; localStorage.removeItem(SEEN_KEY);
    }).catch(() => { /* 忽略 */ }).finally(() => setBusy(false));
  };

  return { messages, unread, loading, busy, draft, setDraft, send, clear };
}

/** 首页「筛选检索」下方的客服入口：纯展示，点击后由 App 打开全局对话窗。 */
export function CustomerServiceEntry({ userQq, unread, onOpen }: { userQq: string | null; unread: number; onOpen: () => void }) {
  return (
    <div className="flex flex-col items-center text-center px-1 py-1">
      {/* 1. 标题（纯文字） */}
      <div className="flex items-center gap-2">
        <h3 className="text-base font-black leading-none">猪猪客服</h3>
        {unread > 0 && <span className="bg-[#D62828] text-white text-[10px] font-black px-1.5 py-0.5">{unread} 条未读</span>}
      </div>

      {/* 2. 居中放大的站点 LOGO */}
      <img src="/zgb-logo.png" alt="" aria-hidden="true" className="my-2 h-24 w-24 object-contain [image-rendering:pixelated]" />

      {/* 3. 开始对话 */}
      {userQq ? (
        <button type="button" onClick={onOpen} className="bauhaus-btn bg-[#D62828] text-white px-4 py-2 text-sm gap-1.5">
          <MessageCircle size={15} />{unread > 0 ? `开始对话（${unread} 未读）` : '开始对话'}
        </button>
      ) : (
        <a href="/" className="bauhaus-btn bg-[#121212] text-white px-4 py-2 text-sm">登录后使用客服</a>
      )}
    </div>
  );
}

/** 右下角对话窗：全站常驻，顶栏铃铛与首页提示条都可直接唤起。 */
export function CustomerServiceDialog({ open, onClose, inbox }: { open: boolean; onClose: () => void; inbox: ChatInbox }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open && listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; }, [inbox.messages, open]);
  if (!open) return null;

  return (
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
          <button type="button" onClick={inbox.clear} title="清除历史记录" className="p-1.5 hover:bg-white/15 rounded"><Trash2 size={15} /></button>
          <button type="button" onClick={onClose} title="收起" className="p-1.5 hover:bg-white/15 rounded"><X size={16} /></button>
        </div>
      </div>

      <div ref={listRef} className="flex-1 overflow-y-auto space-y-2 p-3 bg-[#FAF9F5]">
        {inbox.loading && inbox.messages.length === 0 ? <p className="text-xs text-[#666] text-center py-6">加载中…</p>
          : inbox.messages.length === 0 ? <p className="text-xs text-[#666] text-center py-6 leading-relaxed px-2">请问有什么问题，猪主人看见后会立刻回复！如果问题解决，点击右上角删除标记可以删除本次对话。</p>
            : inbox.messages.map((m) => (
              <div key={m.id} className={`flex ${m.fromRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[82%] px-3 py-2 text-sm ${m.fromRole === 'admin' ? 'bg-[#121212] text-white' : 'bg-white text-[#121212] border-2 border-[#121212]'}`}>
                  <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                  <time className="block text-[10px] opacity-70 mt-1 text-right">{hkTime(m.createdAt)}</time>
                </div>
              </div>
            ))}
      </div>

      <form onSubmit={inbox.send} className="flex gap-2 p-2 border-t-2 border-[#121212] bg-white shrink-0">
        <input value={inbox.draft} onChange={(e) => inbox.setDraft(e.target.value)} maxLength={2000} placeholder="输入消息，回车发送…" className="bauhaus-input flex-1 px-2.5 py-2 text-sm" />
        <button type="submit" disabled={inbox.busy || !inbox.draft.trim()} className="bauhaus-btn bg-[#D62828] text-white px-3"><Send size={16} /></button>
      </form>
    </div>
  );
}
