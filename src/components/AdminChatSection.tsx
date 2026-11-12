import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquareText, Send, Trash2, RefreshCw } from 'lucide-react';
import { adminApi, type ChatConversation, type ChatMessage } from '../services/api';
import { number } from './AdminCommon';

const hkTime = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '';

/** 后台「客服系统」→ 猪猪客服对话：查看玩家来信、回复、清除会话。 */
export function AdminChatSection({ onNotice, onError }: { onNotice: (message: string) => void; onError: (error: unknown) => void }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const loadList = async () => {
    try { setConversations((await adminApi.chatConversations()).conversations); }
    catch (error) { onErrorRef.current(error); } finally { setLoading(false); }
  };
  useEffect(() => { loadList(); }, []);

  const openThread = async (qq: string) => {
    setSelected(qq); setThreadLoading(true);
    try { const data = await adminApi.chatThreadFor(qq); setMessages(data.messages); await loadList(); }
    catch (error) { onErrorRef.current(error); } finally { setThreadLoading(false); }
  };

  const reply = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selected) return;
    setBusy(true);
    try {
      await adminApi.chatReply(selected, content);
      setDraft('');
      const data = await adminApi.chatThreadFor(selected);
      setMessages(data.messages);
      await loadList();
      onNotice('已回复，玩家将在猪猪客服中看到');
    } catch (error) { onError(error); } finally { setBusy(false); }
  };

  const clear = async () => {
    if (!selected) return;
    setBusy(true);
    try { await adminApi.clearChatFor(selected); setMessages([]); setSelected(null); await loadList(); onNotice('已清除该用户会话'); }
    catch (error) { onError(error); } finally { setBusy(false); }
  };

  return <section className="grid gap-4 lg:grid-cols-[320px_1fr]">
    <div className="bauhaus-card bg-white p-3 min-h-[420px] flex flex-col">
      <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-2">
        <h3 className="text-sm font-black flex items-center gap-1.5"><MessageSquareText size={15} className="text-[#004E98]" />玩家会话</h3>
        <button type="button" onClick={loadList} className="text-[#004E98] hover:underline text-xs font-bold flex items-center gap-1"><RefreshCw size={12} />刷新</button>
      </div>
      {loading ? <div className="text-sm text-[#666] p-4">加载中…</div>
        : !conversations.length ? <div className="text-sm text-[#666] p-4">暂无玩家发起的客服对话。</div>
          : <ul className="space-y-2 overflow-y-auto flex-1">{conversations.map((c) => (
            <li key={c.userQq}>
              <button type="button" onClick={() => openThread(c.userQq)} className={`w-full text-left border-2 p-2.5 flex flex-col gap-0.5 ${selected === c.userQq ? 'bg-[#FDECEC] border-[#D62828]' : 'bg-[#FAF9F5] border-[#DDD] hover:border-[#121212]'}`}>
                <div className="flex items-center justify-between gap-2">
                  <strong className="text-sm truncate">{c.userName}</strong>
                  {c.unread > 0 && <span className="shrink-0 bg-[#D62828] text-white text-[10px] font-black px-1.5 py-0.5">{number(c.unread)} 未读</span>}
                </div>
                <span className="text-[11px] text-[#666] font-mono truncate">{c.userQq}</span>
                <span className="text-[11px] text-[#888] truncate">{c.lastContent || '（空）'}</span>
              </button>
            </li>
          ))}</ul>}
    </div>

    <div className="bauhaus-card bg-white p-3 min-h-[420px] flex flex-col">
      {!selected ? <div className="flex-1 flex items-center justify-center text-sm text-[#666]">从左侧选择一个玩家会话查看与回复</div>
        : <>
          <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-2">
            <h3 className="text-sm font-black">与 {selected} 的对话</h3>
            <button type="button" disabled={busy} onClick={clear} className="text-[#B51F1F] hover:underline text-xs font-bold flex items-center gap-1"><Trash2 size={13} />清除会话</button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 p-1 min-h-[200px]">
            {threadLoading ? <div className="text-sm text-[#666]">加载中…</div>
              : messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-sm ${m.fromRole === 'admin' ? 'bg-[#121212] text-white' : 'bg-[#F2F0E8] text-[#121212] border border-[#DDD]'}`}>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <time className="block text-[10px] opacity-70 mt-1 text-right">{hkTime(m.createdAt)}</time>
                  </div>
                </div>
              ))}
            {!messages.length && <div className="text-sm text-[#666] text-center py-8">暂无消息</div>}
          </div>
          <form onSubmit={reply} className="flex gap-2 mt-2 border-t-2 border-[#121212] pt-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="输入回复内容，玩家将在猪猪客服中看到…" className="bauhaus-input flex-1 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy || !draft.trim()} className="bauhaus-btn bg-[#D62828] text-white px-4 text-sm gap-1"><Send size={14} />发送</button>
          </form>
        </>}
    </div>
  </section>;
}
