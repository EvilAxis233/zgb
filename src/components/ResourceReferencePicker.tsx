import { useState } from 'react';
import { Link2, Plus, Search, X } from 'lucide-react';
import { api } from '../services/api';

export interface ResourceRef {
  id: string;
  name: string;
  url: string;
}

/**
 * 引用站内爱心资源：与 GM 圆桌主题表单同一套检索 / 引用 / 移除交互。
 * 发布网团 / 面团 / 宣群时复用，引用结果随团一起落库，详情弹窗「简介」行右侧展示。
 */
export function ResourceReferencePicker({ value, onChange, flash }: {
  value: ResourceRef[];
  onChange: (next: ResourceRef[]) => void;
  flash: (message: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ResourceRef[]>([]);
  const [searched, setSearched] = useState(false);
  const [busy, setBusy] = useState(false);

  const search = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const data = await api.resources(query.trim());
      setResults((data.items || []).slice(0, 8).map((r) => ({ id: r.id, name: r.name, url: r.url })));
      setSearched(true);
    } catch { flash('资源检索失败'); }
    finally { setBusy(false); }
  };

  const add = (r: ResourceRef) => {
    if (value.some((x) => x.id === r.id)) { flash('该资源已引用'); return; }
    if (value.length >= 8) { flash('最多引用 8 个资源'); return; }
    onChange([...value, r]);
  };

  return <div>
    <label className="mb-1 block font-bold text-[#121212]">引用站内爱心资源（可选，可检索）</label>
    <p className="mb-2 text-[11px] text-[#666]">若站内已有该团相关的规则书 / 模组资源，可检索后引用到团里。</p>
    <div className="flex gap-2">
      <input value={query} onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void search(); } }}
        placeholder="输入资源名称检索站内爱心资源"
        className="bauhaus-input min-w-0 flex-1 px-3 py-2 text-sm" />
      <button type="button" onClick={() => void search()} disabled={busy}
        className="bauhaus-btn flex shrink-0 items-center gap-1 px-3 py-2 text-sm font-bold disabled:opacity-50">
        <Search size={14} />{busy ? '检索中' : '检索'}
      </button>
    </div>
    {searched && <div className="mt-2 max-h-32 overflow-y-auto border-2 border-[#121212] bg-white">
      {results.length === 0 && <div className="px-3 py-2 text-xs font-bold text-[#666]">没有匹配的站内资源</div>}
      {results.map((r) => {
        const added = value.some((x) => x.id === r.id);
        return <div key={r.id} className="flex items-center gap-2 border-b border-[#DDD] px-2 py-1.5 last:border-b-0">
          <Link2 size={13} className="shrink-0 text-[#666]" />
          <span className="min-w-0 flex-1 truncate text-xs font-bold text-[#121212]" title={r.name}>{r.name}</span>
          <button type="button" disabled={added} onClick={() => add(r)}
            className={`shrink-0 px-1.5 py-0.5 text-[11px] font-bold ${added ? 'text-[#888]' : 'text-[#004E98] hover:bg-[#EAF3FB] hover:underline'}`}>
            {added ? '已引用' : <span className="inline-flex items-center gap-0.5"><Plus size={12} />引用</span>}
          </button>
        </div>;
      })}
    </div>}
    {value.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">
      {value.map((r) => <span key={r.id} className="flex max-w-full items-center gap-1 border-2 border-[#176B57] bg-[#EAF5F1] px-2 py-0.5 text-[11px] font-bold text-[#176B57]">
        <span className="truncate" title={r.name}>{r.name}</span>
        <button type="button" aria-label={`移除 ${r.name}`} onClick={() => onChange(value.filter((x) => x.id !== r.id))}><X size={12} /></button>
      </span>)}
    </div>}
  </div>;
}
