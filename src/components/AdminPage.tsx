import { useEffect, useState, type FormEvent } from 'react';
import { ArrowDownLeft, ArrowUpRight, ChevronLeft, ChevronRight, Gift, LogOut, Plus, Search, Shield, Trash2 } from 'lucide-react';
import { adminApi, type AdminUser, type GiftRecord } from '../services/api';

const PAGE_SIZE = 50;

export function AdminPage() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [userTotal, setUserTotal] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [userOffset, setUserOffset] = useState(0);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [giftTotal, setGiftTotal] = useState(0);
  const [giftOffset, setGiftOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const message = (error: unknown) => setNotice(error instanceof Error ? error.message : '操作失败');
  const loadRules = async () => setRules((await adminApi.rules()).rules);

  useEffect(() => {
    adminApi.me().then(({ authenticated: ok }) => setAuthenticated(ok)).catch(() => setAuthenticated(false));
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    loadRules().catch(message);
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated) return;
    adminApi.users(search, userOffset).then((data) => {
      setUsers(data.users);
      setUserTotal(data.total);
    }).catch(message);
  }, [authenticated, search, userOffset]);

  useEffect(() => {
    if (!authenticated || !selected) return;
    adminApi.gifts(selected.qq, giftOffset).then((data) => {
      setGifts(data.records);
      setGiftTotal(data.total);
    }).catch(message);
  }, [authenticated, selected?.qq, giftOffset]);

  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setNotice('');
    try { await adminApi.login(password); setPassword(''); setAuthenticated(true); }
    catch (error) { message(error); }
    finally { setBusy(false); }
  };

  const logout = async () => {
    try { await adminApi.logout(); setAuthenticated(false); setSelected(null); setRules([]); setUsers([]); }
    catch (error) { message(error); }
  };

  const addRule = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true); setNotice('');
    try { await adminApi.addRule(newRule.trim()); setNewRule(''); await loadRules(); setNotice('规则已添加'); }
    catch (error) { message(error); }
    finally { setBusy(false); }
  };

  const deleteRule = async (name: string) => {
    if (!confirm(`删除规则「${name}」？已有团的历史规则名称仍会保留。`)) return;
    setBusy(true); setNotice('');
    try { await adminApi.deleteRule(name); await loadRules(); setNotice('规则已删除'); }
    catch (error) { message(error); }
    finally { setBusy(false); }
  };

  const searchUsers = (event: FormEvent) => {
    event.preventDefault();
    setSelected(null); setGifts([]); setSearch(searchInput.trim()); setUserOffset(0);
  };

  const selectUser = (user: AdminUser) => {
    setSelected(user); setGiftOffset(0); setGifts([]); setGiftTotal(0);
  };

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#121212] font-sans">
      <header className="bg-white border-b-4 border-[#121212]">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="w-7 h-7 bg-[#D62828] border-2 border-[#121212]" />
            <div>
              <h1 className="text-xl font-black leading-none">诸告板 · 后台</h1>
              <p className="text-xs text-[#666] mt-1">规则与礼物记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold">
            <a href="/" className="bauhaus-btn bg-white px-3 py-2">返回首页</a>
            {authenticated && <button onClick={logout} className="bauhaus-btn bg-[#121212] text-white px-3 py-2 gap-1"><LogOut size={14} />退出</button>}
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {notice && <div role="status" className="mb-5 bg-white border-2 border-[#121212] border-l-8 border-l-[#D62828] px-4 py-3 text-sm font-bold">{notice}</div>}
        {authenticated === null && <div className="bauhaus-card p-8 text-center">加载中…</div>}
        {authenticated === false && (
          <section className="bauhaus-card max-w-md mx-auto p-7 bg-white">
            <Shield size={26} className="text-[#D62828] mb-3" />
            <h2 className="text-xl font-black">后台登录</h2>
            <p className="text-sm text-[#666] mt-1 mb-6">输入管理员密码后查看账号与礼物记录。</p>
            <form onSubmit={login} className="space-y-4">
              <label className="block text-sm font-bold" htmlFor="admin-password">管理员密码</label>
              <input id="admin-password" autoComplete="current-password" type="password" required value={password} onChange={(event) => setPassword(event.target.value)} className="bauhaus-input w-full px-3 py-2" />
              <button disabled={busy} className="bauhaus-btn w-full bg-[#D62828] text-white py-2.5">进入后台</button>
            </form>
          </section>
        )}

        {authenticated && (
          <div className="space-y-7">
            <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
              <section className="bauhaus-card p-5 bg-white">
                <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3 mb-4">
                  <h2 className="font-black">规则系统</h2><span className="text-xs font-bold bg-[#121212] text-white px-2 py-1">{rules.length} 个</span>
                </div>
                <form onSubmit={addRule} className="flex gap-2 mb-4">
                  <input aria-label="新规则名" maxLength={100} required value={newRule} onChange={(event) => setNewRule(event.target.value)} placeholder="输入新规则名" className="bauhaus-input min-w-0 flex-1 px-2 py-2 text-sm" />
                  <button disabled={busy} title="添加规则" className="bauhaus-btn bg-[#D62828] text-white px-3"><Plus size={18} /></button>
                </form>
                <ul className="space-y-2 max-h-[520px] overflow-y-auto">
                  {rules.map((rule) => <li key={rule} className="flex items-center justify-between gap-2 border border-[#121212] bg-[#FAF9F5] px-3 py-2 text-sm">
                    <span className="font-bold break-all">{rule}</span>
                    <button disabled={busy} onClick={() => deleteRule(rule)} aria-label={`删除 ${rule}`} title="删除规则" className="text-[#D62828] shrink-0 cursor-pointer"><Trash2 size={16} /></button>
                  </li>)}
                  {!rules.length && <li className="text-sm text-[#666]">还没有规则名</li>}
                </ul>
              </section>

              <section className="bauhaus-card p-5 bg-white min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-[#121212] pb-3 mb-4">
                  <h2 className="font-black">QQ 账号</h2><span className="text-xs font-bold bg-[#004E98] text-white px-2 py-1">共 {userTotal} 个</span>
                </div>
                <form onSubmit={searchUsers} className="flex gap-2 mb-4">
                  <input aria-label="搜索 QQ 号或昵称" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="搜索 QQ 号或昵称" className="bauhaus-input min-w-0 flex-1 px-3 py-2 text-sm" />
                  <button title="搜索" className="bauhaus-btn bg-[#121212] text-white px-3"><Search size={17} /></button>
                </form>
                <div className="space-y-2">
                  {users.map((user) => <button key={user.qq} onClick={() => selectUser(user)} className={`w-full text-left border-2 px-3 py-3 flex flex-wrap items-center justify-between gap-2 cursor-pointer ${selected?.qq === user.qq ? 'border-[#D62828] bg-[#FAF0F0]' : 'border-[#121212] bg-white hover:bg-[#FAF9F5]'}`}>
                    <span><strong className="block text-sm">{user.name}</strong><span className="font-mono text-xs text-[#666]">{user.qq}</span></span>
                    <span className="text-xs font-bold text-[#555]">送出 {user.sent_count} · 收到 {user.received_count}</span>
                  </button>)}
                  {!users.length && <p className="py-7 text-center text-sm text-[#666]">没有匹配的账号</p>}
                </div>
                <div className="flex items-center justify-end gap-3 mt-4 text-xs font-bold">
                  <button disabled={userOffset === 0} onClick={() => setUserOffset(Math.max(0, userOffset - PAGE_SIZE))} className="bauhaus-btn bg-white p-1 disabled:opacity-40" aria-label="上一页"><ChevronLeft size={17} /></button>
                  <span>{userTotal ? userOffset + 1 : 0}–{Math.min(userOffset + PAGE_SIZE, userTotal)} / {userTotal}</span>
                  <button disabled={userOffset + PAGE_SIZE >= userTotal} onClick={() => setUserOffset(userOffset + PAGE_SIZE)} className="bauhaus-btn bg-white p-1 disabled:opacity-40" aria-label="下一页"><ChevronRight size={17} /></button>
                </div>
              </section>
            </div>

            <section className="bauhaus-card p-5 bg-white">
              <div className="flex items-center gap-2 border-b-2 border-[#121212] pb-3 mb-4"><Gift size={19} className="text-[#D62828]" /><h2 className="font-black">礼物记录</h2></div>
              {!selected ? <p className="text-sm text-[#666] py-6 text-center">选择一个 QQ 账号查看收礼与送礼记录</p> : <>
                <div className="flex flex-wrap justify-between gap-2 mb-4 text-sm"><strong>{selected.name} <span className="font-mono text-[#666]">({selected.qq})</span></strong><span>GM 点赞 {selected.received_gm} · 玩家点赞 {selected.received_player}</span></div>
                <div className="space-y-2">
                  {gifts.map((gift) => {
                    const sent = gift.from_qq === selected.qq;
                    return <div key={gift.id} className="border border-[#121212] bg-[#FAF9F5] p-3 flex items-start gap-3 text-sm">
                      {sent ? <ArrowUpRight size={18} className="text-[#D62828] shrink-0" /> : <ArrowDownLeft size={18} className="text-[#004E98] shrink-0" />}
                      <div className="flex-1 min-w-0"><strong>{sent ? '送出' : '收到'}{gift.type === 'gm' ? ' GM 点赞' : '玩家点赞'}</strong><p className="text-[#555] mt-1">{sent ? '收礼：' : '送礼：'}{sent ? gift.to_name : gift.from_name} ({sent ? gift.to_qq : gift.from_qq})</p></div>
                      <time className="text-xs text-[#777] shrink-0">{new Date(gift.created_at).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong' })}</time>
                    </div>;
                  })}
                  {!gifts.length && <p className="text-sm text-[#666] py-6 text-center">暂无礼物记录</p>}
                </div>
                <div className="flex items-center justify-end gap-3 mt-4 text-xs font-bold">
                  <button disabled={giftOffset === 0} onClick={() => setGiftOffset(Math.max(0, giftOffset - PAGE_SIZE))} className="bauhaus-btn bg-white p-1 disabled:opacity-40" aria-label="上一页礼物记录"><ChevronLeft size={17} /></button>
                  <span>{giftTotal ? giftOffset + 1 : 0}–{Math.min(giftOffset + PAGE_SIZE, giftTotal)} / {giftTotal}</span>
                  <button disabled={giftOffset + PAGE_SIZE >= giftTotal} onClick={() => setGiftOffset(giftOffset + PAGE_SIZE)} className="bauhaus-btn bg-white p-1 disabled:opacity-40" aria-label="下一页礼物记录"><ChevronRight size={17} /></button>
                </div>
              </>}
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
