import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MessageSquareText, Send, Trash2, RefreshCw, Search, UsersRound } from 'lucide-react';
import { adminApi, type AdminUser, type AdminUserSort, type ChatConversation, type ChatMessage } from '../services/api';
import { number, SelectPager } from './AdminCommon';

const hkTime = (value: string) => value ? new Date(value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '';
const USER_PAGE_SIZE = 100;
// 三列统一高度：与「账号」页左侧卡片（列表 70vh + 头部/搜索/排序/分页）取同一档，三窗齐平。
const COLUMN_HEIGHT = 'h-[calc(70vh+15rem)] min-h-[520px]';

/**
 * 后台「客服系统」→ 猪猪客服对话：三列布局。
 * 左：全部注册账号（检索 / 排序 / 仅会员 / 页码，排版与「账号」页左侧完全一致），点选后可主动发起对话；
 * 中：已有玩家会话（带未读数，不显示消息预览）；右：对话窗。
 */
export function AdminChatSection({ onNotice, onError }: { onNotice: (message: string) => void; onError: (error: unknown) => void }) {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [accounts, setAccounts] = useState<AdminUser[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountInput, setAccountInput] = useState('');
  const [accountQuery, setAccountQuery] = useState('');
  const [accountOffset, setAccountOffset] = useState(0);
  const [accountSort, setAccountSort] = useState<AdminUserSort>('latest');
  const [accountMemberOnly, setAccountMemberOnly] = useState(false);
  const [accountsLoading, setAccountsLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(true);
  const [threadLoading, setThreadLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const onErrorRef = useRef(onError);
  // 点选账号后立即发消息时，较慢的旧会话请求不能覆盖刚发出的新消息列表。
  const threadVersion = useRef(0);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  const loadList = async () => {
    try { setConversations((await adminApi.chatConversations()).conversations); }
    catch (error) { onErrorRef.current(error); } finally { setLoading(false); }
  };
  const loadAccounts = async (query: string, offset: number, sort: AdminUserSort, memberOnly: boolean) => {
    setAccountsLoading(true);
    try {
      const data = await adminApi.users(query, offset, sort, memberOnly);
      setAccounts(data.users); setAccountTotal(data.total);
    } catch (error) { onErrorRef.current(error); } finally { setAccountsLoading(false); }
  };
  useEffect(() => { void loadList(); }, []);
  useEffect(() => { void loadAccounts(accountQuery, accountOffset, accountSort, accountMemberOnly); }, [accountQuery, accountOffset, accountSort, accountMemberOnly]);

  // 会话列表与账号列表共用同一个打开动作：账号列表让客服能主动联系从未发过消息的玩家。
  const openThread = async (qq: string, name: string) => {
    const version = ++threadVersion.current;
    setSelected(qq); setSelectedName(name); setThreadLoading(true);
    try {
      const data = await adminApi.chatThreadFor(qq);
      if (version === threadVersion.current) setMessages(data.messages);
      await loadList();
    } catch (error) { onErrorRef.current(error); }
    finally { if (version === threadVersion.current) setThreadLoading(false); }
  };

  const reply = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !selected) return;
    const qq = selected, version = ++threadVersion.current;
    setBusy(true);
    try {
      // 后端直接回传新消息：不再写完后立刻 GET 会话，规避 D1 读副本短暂落后导致的空白 / 覆盖。
      const result = await adminApi.chatReply(qq, content);
      setDraft('');
      if (version === threadVersion.current) setMessages((prev) => [...prev, result.message]);
      await loadList();
      // 会话列表的 lastContent 可能还在旧快照，稍后补刷一次。
      window.setTimeout(() => { void loadList(); }, 1200);
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
  const hasThread = !!conversations.find((c) => c.userQq === selected);
  const conversationQqs = new Set(conversations.map((c) => c.userQq));

  // 左侧列表固定 420px（与「账号」页左侧同宽），对话窗吃掉剩余宽度；三列等高。
  return <section className="grid items-stretch gap-4 lg:grid-cols-[420px_200px_minmax(320px,1fr)]">
    {/* 第 1 列：全部注册账号 + 检索 + 排序 + 分页（与「账号」页左侧同一接口、同一套排版） */}
    <div className={`bauhaus-card flex flex-col bg-white p-5 ${COLUMN_HEIGHT}`}>
      <div className="mb-4 flex items-center justify-between border-b-2 border-[#121212] pb-3">
        <h3 className="flex items-center gap-1.5 font-black"><UsersRound size={16} className="text-[#004E98]" />注册账号</h3>
        <span className="bg-[#004E98] px-2 py-1 text-xs font-bold text-white">共 {number(accountTotal)} 个</span>
      </div>
      <form onSubmit={submitSearch} className="mb-3 flex gap-2">
        <input aria-label="检索账号 QQ 号或昵称" value={accountInput} onChange={(e) => setAccountInput(e.target.value)}
          placeholder="QQ 号 / 昵称" className="bauhaus-input min-w-0 flex-1 px-3 py-2 text-sm" />
        <button type="submit" aria-label="检索账号" className="bauhaus-btn bg-[#121212] px-3 text-white"><Search size={16} /></button>
      </form>
      {/* 排序与「仅会员」同一行，选项与「账号」页完全一致 */}
      <div className="mb-3 flex items-center gap-2 text-xs font-bold">
        <span className="shrink-0">排序</span>
        <select aria-label="账号排序方式" value={accountSort} onChange={(event) => { setAccountOffset(0); setAccountSort(event.target.value as AdminUserSort); }} className="bauhaus-input min-w-0 flex-1 px-2 py-1.5 text-xs font-bold">
          <option value="latest">最新注册（默认）</option>
          <option value="gm">GM 点赞次数</option>
          <option value="player">玩家点赞次数</option>
          <option value="host">带团次数</option>
          <option value="joined">参团次数</option>
        </select>
        <label className={`flex shrink-0 cursor-pointer items-center gap-1 whitespace-nowrap border-2 px-2 py-1.5 ${accountMemberOnly ? 'border-[#C85C16] bg-[#FFF4DA] text-[#7A4B00]' : 'border-[#121212] bg-white text-[#444]'}`}>
          <input type="checkbox" aria-label="仅看会员" checked={accountMemberOnly} onChange={(event) => { setAccountOffset(0); setAccountMemberOnly(event.target.checked); }} className="accent-[#C85C16]" />
          仅会员
        </label>
      </div>
      {accountsLoading ? <div className="p-3 text-xs text-[#666]">加载中…</div>
        : !accounts.length ? <div className="p-3 text-xs text-[#666]">没有找到账号，换个关键词试试。</div>
          : <div className="min-h-0 flex-1 space-y-1 overflow-y-auto">{accounts.map((user) => (
            <button key={user.qq} type="button" onClick={() => void openThread(user.qq, user.name)}
              className={`w-full border-2 px-2.5 py-1.5 text-left ${selected === user.qq ? 'border-[#D62828] bg-[#FAF0F0]' : 'border-[#121212] bg-white'}`}>
              {/* 与「账号」页左侧同一套单行排版：昵称 + QQ + 标签靠左，带团 / 参团次数靠右 */}
              <span className="flex items-center gap-1.5 whitespace-nowrap">
                <span className="flex min-w-0 items-center gap-1.5">
                  <strong className="min-w-0 truncate text-xs font-black">{user.name}</strong>
                  <span className="shrink-0 font-mono text-[11px] text-[#666]">{user.qq}</span>
                  {conversationQqs.has(user.qq) && <span className="shrink-0 border border-[#004E98] px-1 text-[10px] font-bold text-[#004E98]">会话</span>}
                </span>
                <span className="ml-auto shrink-0 text-[10px] font-bold text-[#888]"><span>带团 {user.hosted_count ?? 0}</span><span className="ml-2">参团 {user.joined_count ?? 0}</span></span>
              </span>
            </button>
          ))}</div>}
      <SelectPager offset={accountOffset} total={accountTotal} size={USER_PAGE_SIZE} onChange={setAccountOffset} />
    </div>

    {/* 第 2 列：已有玩家会话（只显示昵称 / QQ / 未读，不显示消息预览） */}
    <div className={`bauhaus-card flex flex-col bg-white p-3 ${COLUMN_HEIGHT}`}>
      <div className="mb-2 flex items-center justify-between border-b-2 border-[#121212] pb-2">
        <h3 className="flex items-center gap-1.5 text-sm font-black"><MessageSquareText size={15} className="text-[#004E98]" />玩家会话</h3>
        <button type="button" onClick={() => void loadList()} aria-label="刷新会话" className="flex items-center gap-1 text-xs font-bold text-[#004E98] hover:underline"><RefreshCw size={12} /></button>
      </div>
      {loading ? <div className="p-3 text-xs text-[#666]">加载中…</div>
        : !conversations.length ? <div className="p-3 text-xs text-[#666]">暂无玩家发起的客服对话。</div>
          : <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto">{conversations.map((c) => (
            <li key={c.userQq}>
              <button type="button" onClick={() => void openThread(c.userQq, c.userName)} className={`w-full border-2 px-2 py-1.5 text-left ${selected === c.userQq ? 'border-[#D62828] bg-[#FAF0F0]' : 'border-[#121212] bg-white hover:border-[#004E98]'}`}>
                <span className="flex items-center gap-1.5 whitespace-nowrap">
                  <strong className="min-w-0 truncate text-xs font-black">{c.userName}</strong>
                  {c.unread > 0 && <span className="ml-auto shrink-0 bg-[#D62828] px-1 text-[10px] font-black text-white">{number(c.unread)} 未读</span>}
                </span>
                <span className="block truncate font-mono text-[11px] text-[#666]">{c.userQq}</span>
              </button>
            </li>
          ))}</ul>}
    </div>

    {/* 第 3 列：对话窗（吃掉剩余宽度） */}
    <div className={`bauhaus-card flex flex-col bg-white p-3 ${COLUMN_HEIGHT}`}>
      {!selected ? <div className="flex flex-1 items-center justify-center px-4 text-center text-sm text-[#666]">从左侧点选一个账号主动联系，或选择已有玩家会话查看与回复</div>
        : <>
          <div className="flex items-center justify-between gap-2 border-b-2 border-[#121212] pb-2">
            <h3 className="truncate text-sm font-black">与 {selectedName || '玩家'} 的对话</h3>
            <button type="button" disabled={busy} onClick={() => void clear()} className="flex shrink-0 items-center gap-1 text-xs font-bold text-[#B51F1F] hover:underline"><Trash2 size={13} />清除会话</button>
          </div>
          <p className="mt-1.5 text-[10px] font-bold text-[#777]">QQ {selected} · {hasThread ? '已有对话记录' : '该账号还没有发起过对话，可直接发送第一条消息主动联系'}</p>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-1">
            {threadLoading ? <div className="text-sm text-[#666]">加载中…</div>
              : messages.map((m) => (
                <div key={m.id} className={`flex ${m.fromRole === 'admin' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-3 py-2 text-sm ${m.fromRole === 'admin' ? 'bg-[#121212] text-white' : 'border border-[#DDD] bg-[#F2F0E8] text-[#121212]'}`}>
                    <p className="whitespace-pre-wrap break-words leading-relaxed">{m.content}</p>
                    <time className="mt-1 block text-right text-[10px] opacity-70">{hkTime(m.createdAt)}</time>
                  </div>
                </div>
              ))}
            {!threadLoading && !messages.length && <div className="py-8 text-center text-sm text-[#666]">暂无消息，发送第一条消息主动联系对方吧</div>}
          </div>
          <form onSubmit={reply} className="mt-2 flex gap-2 border-t-2 border-[#121212] pt-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={2000} placeholder="输入消息，玩家将在首页收到提醒…" className="bauhaus-input min-w-0 flex-1 px-3 py-2 text-sm" />
            <button type="submit" disabled={busy || !draft.trim()} className="bauhaus-btn gap-1 bg-[#D62828] px-4 text-sm text-white"><Send size={14} />发送</button>
          </form>
        </>}
    </div>
  </section>;
}
