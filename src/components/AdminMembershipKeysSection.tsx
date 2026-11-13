import { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Copy, ExternalLink, KeyRound, Search, Trash2, X } from 'lucide-react';
import { adminApi, type MembershipKeyCounts, type MembershipKeyRecord } from '../services/api';
import { Pager, number } from './AdminCommon';
import { useDialog } from './BauhausDialog';

type KeyStatus = 'unused' | 'used' | 'revoked' | 'all';
const AFDIAN_PLAN_URL = 'https://afdian.com/setting/plan';
const hkTime = (value: string | number | null) => value ? new Date(typeof value === 'number' ? value * 1000 : value).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false }) : '—';

/** 后台「会员激活」：批量生成 / 导入 Key、导出给爱发电自动发货、检索并查看激活记录。 */
export function AdminMembershipKeysSection({ onNotice, onError }: { onNotice: (message: string) => void; onError: (error: unknown) => void }) {
  const { showConfirm } = useDialog();
  const [status, setStatus] = useState<KeyStatus>('unused');
  const [offset, setOffset] = useState(0);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [guideOpen, setGuideOpen] = useState(false);
  // 折叠详情：同一时间只展开一张卡，默认只显示 Key 行，避免长列表被激活记录撑得过长。
  const [expanded, setExpanded] = useState<string | null>(null);
  const [items, setItems] = useState<MembershipKeyRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<MembershipKeyCounts>({ unused: 0, used: 0, revoked: 0 });
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [count, setCount] = useState(20);
  const [months, setMonths] = useState(1);
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [importText, setImportText] = useState('');
  const [importMonths, setImportMonths] = useState(1);
  const onErrorRef = useRef(onError);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);

  useEffect(() => {
    const timer = window.setTimeout(() => { setSearch(query.trim()); setOffset(0); }, 280);
    return () => window.clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    adminApi.membershipKeys(status, offset, search)
      .then((data) => { if (alive) { setItems(data.items); setTotal(data.total); setCounts(data.counts); } })
      .catch((error) => { if (alive) onErrorRef.current(error); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [status, offset, search, reload]);

  const refresh = () => setReload((value) => value + 1);
  const changeStatus = (next: KeyStatus) => { setStatus(next); setOffset(0); };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      onNotice(`${label}已复制到剪贴板`);
    } catch { onNotice('复制失败，请手动选中文本框内容复制'); }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const data = await adminApi.generateMembershipKeys(count, months);
      setGenerated(data.codes);
      refresh();
      onNotice(`已生成 ${data.codes.length} 个 ${data.months} 个月会员 Key（批次 ${data.batch}），请复制到爱发电`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(false); }
  };

  const importKeys = async () => {
    setBusy(true);
    try {
      const data = await adminApi.importMembershipKeys(importText, importMonths);
      setImportText('');
      setGenerated([]);
      refresh();
      onNotice(`导入完成：新增 ${data.imported} 个，跳过重复 ${data.skipped} 个（批次 ${data.batch}）`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(false); }
  };

  const exportUnused = async () => {
    setBusy(true);
    try {
      const data = await adminApi.exportMembershipKeys('unused');
      if (!data.codes.length) { onNotice('当前没有未使用的 Key，请先批量生成'); return; }
      setGenerated(data.codes);
      await copyText(data.codes.join('\n'), `${data.codes.length} 个未使用 Key`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(false); }
  };

  const revoke = async (item: MembershipKeyRecord) => {
    if (!await showConfirm({ title: '作废会员 Key', message: `确定作废「${item.code}」吗？作废后该 Key 无法再激活，此操作不可恢复。`, confirmText: '确认作废', type: 'danger' })) return;
    setBusy(true);
    try {
      await adminApi.revokeMembershipKey(item.key_norm);
      setGenerated((list) => list.filter((code) => code !== item.code));
      refresh();
      onNotice(`「${item.code}」已作废`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(false); }
  };

  const purge = async (item: MembershipKeyRecord) => {
    if (!await showConfirm({ title: '彻底删除会员 Key', message: `「${item.code}」将被永久删除，后台不再保留这条记录，且无法恢复。`, confirmText: '彻底删除', type: 'danger' })) return;
    setBusy(true);
    try {
      await adminApi.purgeMembershipKey(item.key_norm);
      refresh();
      onNotice(`「${item.code}」已彻底删除`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(false); }
  };

  const purgeAllRevoked = async () => {
    if (!await showConfirm({ title: '清空全部已作废 Key', message: `将永久删除全部已作废且未激活的 Key（当前 ${counts.revoked} 条），记录不可恢复。已激活的记录不会受影响。`, confirmText: '全部彻底删除', type: 'danger' })) return;
    setBusy(true);
    try {
      const data = await adminApi.purgeRevokedMembershipKeys();
      refresh();
      onNotice(`已彻底删除 ${data.deleted} 条作废 Key`);
    } catch (error) { onErrorRef.current(error); } finally { setBusy(false); }
  };

  const tabs: Array<{ key: KeyStatus; label: string; count: number }> = [
    { key: 'unused', label: '未使用', count: counts.unused },
    { key: 'used', label: '激活记录', count: counts.used },
    { key: 'revoked', label: '已作废', count: counts.revoked },
    { key: 'all', label: '全部', count: counts.unused + counts.used + counts.revoked },
  ];

  return <section className="space-y-3">
    <div className="bauhaus-card bg-[#EAF1FA] px-3 py-2">
      <button type="button" onClick={() => setGuideOpen((v) => !v)} className="w-full flex items-center gap-1.5 text-xs font-black cursor-pointer">
        <KeyRound size={14} className="text-[#004E98]" />Key 怎么发到粉丝手上
        {guideOpen ? <ChevronUp size={14} className="ml-auto" /> : <ChevronDown size={14} className="ml-auto" />}
      </button>
      {guideOpen && <>
        <ol className="mt-2 space-y-1 text-[11px] font-bold text-[#33475B] list-decimal pl-5">
          <li>在下方批量生成（或导入已有）会员 Key，一行一个复制。</li>
          <li>到爱发电「个人页 → 设置 → 赞助方案 → 高级选项 → 添加自动随机回复」，把 Key 粘进文本框保存。<a href={AFDIAN_PLAN_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 ml-1 text-[#004E98] underline">打开方案设置<ExternalLink size={11} /></a></li>
          <li>粉丝发电后，爱发电会随机私信发送一行 Key，不会重复发放；右上角显示剩余数量，发完会提醒你补货。</li>
          <li>粉丝在「升级会员 / 续费会员」弹窗里粘贴 Key 激活，激活记录自动留在本页「激活记录」里。</li>
        </ol>
        <p className="mt-2 text-[11px] font-bold text-[#7A4B00]">注意：爱发电发的是本页生成的 Key，两边必须一致；不要把爱发电自己的「兑换码」填进自动随机回复，那会导致无限领取。</p>
      </>}
    </div>

    <div className="grid gap-3 lg:grid-cols-3">
      <div className="bauhaus-card bg-white p-3">
        <h3 className="text-xs font-black border-b-2 border-[#121212] pb-1.5 mb-2">批量生成 Key</h3>
        <div className="flex flex-wrap items-end gap-1.5">
          <label className="text-[11px] font-bold">数量
            <input type="number" min={1} max={100} value={count} onChange={(e) => setCount(Math.max(1, Math.min(100, Number(e.target.value) || 1)))} className="bauhaus-input mt-1 block w-20 px-2 py-1 text-xs" />
          </label>
          <label className="text-[11px] font-bold">每张时长
            <select value={months} onChange={(e) => setMonths(Number(e.target.value))} className="bauhaus-input mt-1 block w-24 px-2 py-1 text-xs">
              {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} 个月</option>)}
            </select>
          </label>
          <button type="button" disabled={busy} onClick={generate} className="bauhaus-btn bg-[#D62828] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50">生成</button>
        </div>
        <button type="button" disabled={busy} onClick={exportUnused} className="mt-2 bauhaus-btn bg-white px-2.5 py-1 text-[11px] font-black">导出并复制未使用</button>
        <p className="mt-2 text-[10px] leading-snug text-[#666]">12 个月按 365 天，其余每月 30 天；激活时叠加到当前到期日。</p>
      </div>

      <div className="bauhaus-card bg-white p-3">
        <h3 className="text-xs font-black border-b-2 border-[#121212] pb-1.5 mb-2">导入已有 Key</h3>
        <textarea value={importText} onChange={(e) => setImportText(e.target.value)} rows={3} placeholder="一行一个 Key，或用逗号分隔；至少 8 位字母数字" className="bauhaus-input w-full px-2 py-1 text-[11px] font-mono" />
        <div className="mt-1.5 flex items-center gap-1.5">
          <select value={importMonths} onChange={(e) => setImportMonths(Number(e.target.value))} className="bauhaus-input px-2 py-1 text-[11px]">
            {[1, 2, 3, 6, 12].map((m) => <option key={m} value={m}>{m} 个月</option>)}
          </select>
          <button type="button" disabled={busy || !importText.trim()} onClick={importKeys} className="bauhaus-btn bg-[#004E98] px-3 py-1 text-[11px] font-black text-white disabled:opacity-50">导入</button>
          <span className="text-[10px] text-[#666]">重复自动跳过</span>
        </div>
        <p className="mt-1.5 text-[10px] leading-snug text-[#666]">单次最多 5000 个；导入后保留原始大小写，可直接粘到爱发电。</p>
      </div>

      <div className="bauhaus-card bg-white p-3">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-1.5 mb-2">
          <h3 className="text-xs font-black">最近生成 / 导出</h3>
          {generated.length > 0 && <button type="button" onClick={() => copyText(generated.join('\n'), `${generated.length} 个 Key`)} className="bauhaus-btn bg-[#004E98] px-2 py-1 text-[11px] font-black text-white inline-flex items-center gap-1 cursor-pointer">{copied ? <><Check size={11} />已复制</> : <><Copy size={11} />复制全部</>}</button>}
        </div>
        {generated.length
          ? <><textarea readOnly value={generated.join('\n')} rows={4} className="bauhaus-input w-full px-2 py-1 text-[11px] font-mono" aria-label="生成的会员 Key 列表" /><p className="mt-1.5 text-[10px] font-bold leading-snug text-[#B51F1F]">复制后粘贴到爱发电「自动随机回复」，每行一个，发完记得补货。</p></>
          : <p className="text-[11px] text-[#666] leading-relaxed">还没有生成 Key。生成或导出后，这里会出现可一键复制的纯文本。</p>}
      </div>
    </div>

    <div className="bauhaus-card bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-1.5 border-b-2 border-[#121212] pb-2 mb-2">
        <h3 className="text-xs font-black">密钥与激活记录</h3>
        <span className="text-[10px] font-bold text-[#666]">未使用 {number(counts.unused)} · 已激活 {number(counts.used)} · 已作废 {number(counts.revoked)}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mb-2">
        <div className="relative flex-1 min-w-[190px]">
          <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-[#666]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="检索 Key / 激活人 QQ / 昵称 / 批次" className="bauhaus-input w-full pl-7 pr-7 py-1.5 text-xs" aria-label="检索会员 Key" />
          {query && <button type="button" onClick={() => setQuery('')} className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[#666] cursor-pointer" aria-label="清空检索"><X size={13} /></button>}
        </div>
        {status === 'revoked' && counts.revoked > 0 && <button type="button" disabled={busy} onClick={purgeAllRevoked} className="bauhaus-btn bg-white px-2 py-1.5 text-[11px] font-black text-[#B51F1F] inline-flex items-center gap-1"><Trash2 size={12} />清空已作废</button>}
      </div>
      <div className="flex flex-wrap gap-1.5 mb-2" role="tablist" aria-label="密钥状态">
        {tabs.map((tab) => <button key={tab.key} type="button" role="tab" aria-selected={status === tab.key} onClick={() => changeStatus(tab.key)}
          className={`bauhaus-btn px-2.5 py-1 text-[11px] gap-1 ${status === tab.key ? 'bg-[#121212] text-white' : 'bg-white'}`}>
          {tab.label}<span className="text-[10px]">({number(tab.count)})</span>
        </button>)}
        {search
          ? <span className="self-center text-[10px] font-bold text-[#004E98]">检索「{search}」：{number(total)} 条</span>
          : <span className="self-center text-[10px] font-bold text-[#888]">卡片默认只显示 Key，点「详情」展开激活记录与操作</span>}
      </div>
      {loading ? <p className="py-6 text-center text-xs font-bold text-[#666]">正在读取…</p>
        : !items.length ? <p className="py-6 text-center text-xs text-[#666]">{search ? `没有匹配「${search}」的 Key，换个关键词试试。` : '当前筛选下暂无 Key。'}</p>
        : <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3 items-start">{items.map((item) => {
          const revoked = !!item.revoked_at, used = !!item.redeemed_by;
          const state = revoked ? '已作废' : used ? '已激活' : '未使用';
          const stateStyle = revoked ? 'bg-[#FAF0F0] text-[#B51F1F] border-[#B51F1F]' : used ? 'bg-[#E7F5F1] text-[#176B57] border-[#176B57]' : 'bg-[#FFF4D6] text-[#7A4B00] border-[#7A4B00]';
          const open = expanded === item.key_norm;
          return <article key={item.key_norm} className="border-2 border-[#121212] bg-[#FAF9F5] p-2 flex flex-col gap-1 min-w-0">
            {/* 折叠态只保留 Key 行：状态 + Key + 复制 + 详情开关 */}
            <div className="flex items-center gap-1 min-w-0">
              <span className={`shrink-0 px-1 py-0.5 border text-[10px] font-black leading-tight ${stateStyle}`}>{state}</span>
              <code className="min-w-0 flex-1 truncate text-[11px] font-black" title={item.code}>{item.code}</code>
              <button type="button" onClick={() => copyText(item.code, 'Key')} className="shrink-0 text-[#004E98] cursor-pointer" title="复制完整 Key" aria-label="复制完整 Key"><Copy size={12} /></button>
              <button type="button" onClick={() => setExpanded(open ? null : item.key_norm)} aria-expanded={open}
                className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-black text-[#004E98] hover:text-[#D62828] cursor-pointer">
                {open ? <>收起<ChevronUp size={12} /></> : <>详情<ChevronDown size={12} /></>}
              </button>
            </div>
            {open && <div className="border-t border-dashed border-[#DDDDD5] pt-1.5 flex flex-col gap-1">
              <div className="text-[10px] leading-tight text-[#666] space-y-0.5">
                <p>{item.months} 个月 · 批次 {item.batch}</p>
                <p>生成 {hkTime(item.created_at)} · {item.created_by}</p>
                {used
                  ? <p className="font-bold text-[#176B57]">{item.redeemed_name || '—'}（{item.redeemed_by}）· {hkTime(item.redeemed_at)} · 到期 {item.expires_at ? hkTime(item.expires_at) : '—'}</p>
                  : <p>{revoked ? `作废于 ${hkTime(item.revoked_at)}` : '尚未激活'}</p>}
              </div>
              {!used && <div className="pt-0.5 flex justify-end">
                {revoked
                  ? <button type="button" disabled={busy} onClick={() => purge(item)} className="bauhaus-btn bg-white px-2 py-0.5 text-[10px] font-black text-[#B51F1F] inline-flex items-center gap-1 cursor-pointer"><Trash2 size={11} />彻底删除</button>
                  : <button type="button" disabled={busy} onClick={() => revoke(item)} className="bauhaus-btn bg-white px-2 py-0.5 text-[10px] font-black text-[#B51F1F] inline-flex items-center gap-1 cursor-pointer"><Trash2 size={11} />作废</button>}
              </div>}
            </div>}
          </article>;
        })}</div>}
      <Pager offset={offset} total={total} setOffset={setOffset} />
    </div>
  </section>;
}
