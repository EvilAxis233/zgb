import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquareText, Send, Trash2, RefreshCw, Search, UsersRound, UserPlus } from 'lucide-react';
import { adminApi, type AdminUser, type ChatConversation, type ChatMessage } from '../services/api';
import { number } from './AdminCommon';

const hkTime = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '';
const PAGE_SIZE = 100;

/**
 * 后台「客服系统」→ 猪猪客服对话：三列布局。
 * 左：全部注册账号（可检索、可翻页），点选后可主动发起对话，不要求对方先来信；
 * 中：已有玩家会话（带未读数）；右：缩窄后的对话窗。
 */
export function AdminChatSection({ onNotice, onError }: { onNotice: (message: string) => void; onError: (error: unknown) => void }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountInput, setAccountInput] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountOffset, setAccountOffset] = useState(0);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
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
  const loadAccounts = async (query: string, offset: number) => {
    setAccountsLoading(true);
    try {
      const data = await adminApi.users(query, offset);
      setAccounts(data.users); setAccountTotal(data.total);
    } catch (error) { onErrorRef.current(error); } finally { setAccountsLoading(false); }
  };
  useEffect(() => { void loadList(); }, []);
  useEffect(() => { void loadAccounts(accountQuery, accountOffset); }, [accountQuery, accountOffset]);

  // 会话列表与账号列表共用同一个打开动作：账号列表让客服能主动联系从未发过消息的玩家。
  const openThread = async (qq: string, name: string) => {
    setSelected(qq); setSelectedName(name); setThreadLoading(true);
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
      onNotice('已发送，玩家会在首页收到新消息提醒');
    } catch (error) { onError(error); } finally { setBusy(false); }
  };

  const clear = async () => {
    if (!selected) return;
    setBusy(true);
    try { await adminApi.clearChatFor(selected); setMessages([]); setSelected(null); setSelectedName(''); await loadList(); onNotice('已清除该用户会话'); }
    catch (error) { onError(error); } finally { setBusy(false); }
  };

  const submitSearch = (event: FormEvent) => {
    event.preventDefault();
    setAccountOffset(0);
    setAccountQuery(accountInput.trim());
  };
  const pages = Math.max(1, Math.ceil(accountTotal / PAGE_SIZE));
  const page = Math.min(pages - 1, Math.floor(accountOffset / PAGE_SIZE));
  const hasThread = !!conversations.find((c) => c.userQq === selected);
  const conversationQqs = new Set(conversations.map((c) => c.userQq));

  return <section className="grid gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,240px)_minmax(0,1fr)]">
    {/* 第 1 列：全部注册账号 + 检索（与「账号」页左侧列表同一接口与样式） */}
    <div className="bauhaus-card bg-white p-3 min-h-[420px] flex flex-col">
      <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-2">
        <h3 className="text-sm font-black flex items-center gap-1.5"><UsersRound size={15} className="text-[#004E98]" />注册账号</h3>
        <span className="text-[11px] font-black bg-[#004E98] text-white px-1.5 py-0.5">共 {number(accountTotal)}</span>
      </div>
      <form onSubmit={submitSearch} className="flex gap-1.5 mb-2">
        <input aria-label="检索账号 QQ 号或昵称" value={accountInput} onChange={(e) => setAccountInput(e.target.value)}
          placeholder="QQ 号 / 昵称" className="bauhaus-input min-w-0 flex-1 px-2 py-1.5 text-xs" />
        <button type="submit" aria-label="检索账号" className="bauhaus-btn bg-[#121212] text-white px-2"><Search size={14} /></button>
      </form>
      <p className="mb-2 text-[10px] font-bold leading-snug text-[#777]">点账号即可主动发消息，对方无需先来信。</p>
      {accountsLoading ? <div className="text-xs text-[#666] p-3">加载中…</div>
        : !accounts.length ? <div className="text-xs text-[#666] p-3">没有找到账号，换个关键词试试。</div>
          : <ul className="space-y-1 overflow-y-auto flex-1 max-h-[52vh]">{accounts.map((user) => (
            <li key={user.qq}>
              <button type="button" onClick={() => void openThread(user.qq, user.name)}
                className={`w-full text-left border-2 px-2 py-1.5 flex items-center gap-1.5 ${selected === user.qq ? 'border-[#D62828] bg-[#FAF0F0]' : 'border-[#121212] bg-white hover:border-[#004E98]'}`}>
                <strong className="text-xs font-black truncate max-w-[6.5rem] shrink-0">{user.name}</strong>
                <span className="min-w-0 flex-1 truncate text-[10px] font-mono text-[#666]">{user.qq}</span>
                {conversationQqs.has(user.qq) && <span className="shrink-0 bg-[#004E98] text-white text-[9px] font-black px-1">会话</span>}
                <UserPlus size={12} className="shrink-0 text-[#888]" aria-hidden="true" />
              </button>
            </li>
          ))}</ul>}
      {pages > 1 && <div className="flex items-center justify-between gap-1 border-t-2 border-dashed border-[#CFCBC0] pt-2 mt-2 text-[11px] font-bold">
        <button type="button" disabled={page === 0} onClick={() => setAccountOffset((page - 1) * PAGE_SIZE)} className="bauhaus-btn bg-white px-2 py-0.5 disabled:opacity-40">上一页</button>
        <span>第 {page + 1} / {pages} 页</span>
        <button type="button" disabled={page >= pages - 1} onClick={() => setAccountOffset((page + 1) * PAGE_SIZE)} className="bauhaus-btn bg-white px-2 py-0.5 disabled:opacity-40">下一页</button>
      </div>}
    </div>

    {/* 第 2 列：已有玩家会话 */}
    <div className="bauhaus-card bg-white p-3 min-h-[420px] flex flex-col">
      <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-2">
        <h3 className="text-sm font-black flex items-center gap-1.5"><MessageSquareText size={15} className="text-[#004E98]" />玩家会话</h3>
        <button type="button" onClick={() => void loadList()} className="text-[#004E98] hover:underline text-xs font-bold flex items-center gap-1"><RefreshCw size={12} />刷新</button>
      </div>
      {loading ? <div className="text-sm text-[#666] p-4">加载中…</div>
        : !conversations.length ? <div className="text-sm text-[#666] p-4">暂无玩家发起的客服对话。</div>
          : <ul className="space-y-2 overflow-y-auto flex-1 max-h-[58vh]">{conversations.map((c) => (
            <li key={c.userQq}>
              <button type="button" onClick={() => void openThread(c.userQq, c.userName)} className={`w-full text-left border-2 p-2.5 flex flex-col gap-0.5 ${selected === c.userQq ? 'bg-[#FDECEC] border-[#D62828]' : 'bg-[#FAF9F5] border-[#DDD] hover:border-[#121212]'}`}>
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

    {/* 第 3 列：缩窄的对话窗（消息区限宽 600px） */}
    <div className="bauhaus-card bg-white p-3 min-h-[420px] flex flex-col">
      {!selected ? <div className="flex-1 flex items-center justify-center text-sm text-[#666] text-center px-4">从左侧点选一个账号主动联系，或选择已有玩家会话查看与回复</div>
        : <>
          <div className="flex items-center justify-between gap-2 border-b-2 border-[#121212] pb-2">
            <h3 className="text-sm font-black truncate">与 {selectedName || '玩家'} 的对话</h3>
            <button type="button" disabled={busy} onClick={() => void clear()} className="text-[#B51F1F] hover:underline text-xs font-bold flex items-center gap-1 shrink-0"><Trash2 size={13} />清除会话</button>
          </div>
          <p className="mt-1.5 text-[10px] font-bold text-[#777]">QQ {selected} · {hasThread ? '已有对话记录' : '该账号还没有发起过对话，可直接发送第一条消息主动联系'}</p>
          <div className="flex-1 overflow-y-auto space-y-2 p-1 min-h-[200px] w-full max-w-[600px] mx-auto">
            {threadLoading ? <div className="text-sm text-[#666]">加载中…</div>
              : messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-sm ${m.fromRole === 'admin' ? 'bg-[#121212] text-white' : 'bg-[#F2F0E8] text-[#121212] border border-[#DDD]'}`}>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <time className="block text-[10px] opacity-70 mt-1 text-right">{hkTime(m.createdAt)}</time>
                  </div>
                </div>
              ))}
            {!threadLoading && !messages.length && <div className="text-sm text-[#666] text-center py-8">暂无消息，发送第一条消息主动联系对方吧</div>}
          </div>
          <form onSubmit={reply} className="flex gap-2 mt-2 border-t-2 border-[#121212] pt-2 w-full max-w-[600px] mx-auto">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="输入消息，玩家将在首页收到提醒…" className="bauhaus-input flex-1 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy || !draft.trim()} className="bauhaus-btn bg-[#D62828] text-white px-4 text-sm gap-1"><Send size={14} />发送</button>
          </form>
        </>}
    </div>
  </section>;
}
