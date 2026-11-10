import React, { useEffect, useState } from 'react';
import { Heart, Search, Plus, Pencil, Trash2, X, Loader2, ExternalLink } from 'lucide-react';
import type { RuleResource, RuleResourceInput, UserProfile } from '../types';
import { api } from '../services/api';
import { useDialog } from './BauhausDialog';

const TYPE_LABEL: Record<RuleResource['type'], string> = { pan: '网盘下载', wiki: 'Wiki 查询', other: '其他' };
const TYPE_STYLE: Record<RuleResource['type'], string> = {
  pan: 'bg-[#FFF0D6] text-[#8A5A00]',
  wiki: 'bg-[#E6F0FA] text-[#004E98]',
  other: 'bg-[#EEEAE0] text-[#555]',
};

function HeartIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#D62828" aria-hidden="true" className="shrink-0">
      <path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" />
    </svg>
  );
}

/** 一条资源卡片。上传者本人（或管理员）会看到「编辑」「删除」。 */
export function ResourceCard({ item, onEdit, onDelete }: {
  item: RuleResource;
  onEdit?: (item: RuleResource) => void;
  onDelete?: (item: RuleResource) => void;
}) {
  return (
    <article className="bauhaus-card flex min-h-[196px] flex-col p-4">
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 break-words text-base font-black leading-snug text-[#121212]">{item.name}</h3>
        <span className={`shrink-0 border-2 border-[#121212] px-1.5 py-0.5 text-[10px] font-black ${TYPE_STYLE[item.type]}`}>{TYPE_LABEL[item.type]}</span>
      </div>
      <p className="mt-2 min-h-[18px] break-words text-xs leading-relaxed text-[#666]">{item.note || '（未填写备注）'}</p>
      <div className="mt-3 flex items-center gap-2 border-2 border-[#121212] bg-[#FAF9F5] px-2 py-1.5">
        <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-[#004E98] underline" title={item.url}>{item.url}</span>
        <a href={item.url} target="_blank" rel="noopener noreferrer" className="bauhaus-btn shrink-0 gap-1 bg-white px-2 py-1 text-[10px] font-black shadow-none">
          打开链接 <ExternalLink className="h-3 w-3" />
        </a>
      </div>
      <div className="mt-auto flex items-center gap-2 border-t-2 border-dashed border-[#CFCBC0] pt-3 text-[11px] font-bold text-[#666]">
        {item.uploaderAvatar
          ? <img src={item.uploaderAvatar} alt="" className="h-5 w-5 border-2 border-[#121212] object-cover" />
          : <span className="flex h-5 w-5 items-center justify-center border-2 border-[#121212] bg-[#F4A261] text-[9px] font-black text-[#121212]">{item.uploaderName.slice(0, 1)}</span>}
        <span>分享者：<strong className="text-[#121212]">{item.uploaderName}</strong></span>
        <span className="ml-auto shrink-0">{item.updatedAt !== item.createdAt ? `${item.updatedAt} 更新` : item.createdAt}</span>
      </div>
      {item.canManage && (onEdit || onDelete) && (
        <div className="mt-2 flex gap-2">
          {onEdit && <button type="button" onClick={() => onEdit(item)} className="bauhaus-btn flex-1 gap-1 bg-white px-2 py-1 text-[11px] font-black shadow-[2px_2px_0px_#121212] hover:bg-[#F0F5FA]"><Pencil className="h-3 w-3" />编辑</button>}
          {onDelete && <button type="button" onClick={() => onDelete(item)} className="bauhaus-btn flex-1 gap-1 bg-[#FAF0F0] px-2 py-1 text-[11px] font-black text-[#B51F1F] shadow-[2px_2px_0px_#D62828] hover:bg-[#F7DDDD]"><Trash2 className="h-3 w-3" />删除</button>}
        </div>
      )}
    </article>
  );
}

/** 分享 / 编辑弹窗。上传者昵称由后端按登录账号记录，前端不允许手改。 */
export function ResourceEditor({ initial, onClose, onSaved }: {
  initial?: RuleResource | null;
  onClose: () => void;
  onSaved: (item: RuleResource) => void;
}) {
  const { showAlert } = useDialog();
  const [name, setName] = useState(initial?.name || '');
  const [url, setUrl] = useState(initial?.url || '');
  const [type, setType] = useState<RuleResource['type']>(initial?.type || 'pan');
  const [note, setNote] = useState(initial?.note || '');
  const [saving, setSaving] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload: RuleResourceInput = { name: name.trim(), url: url.trim(), type, note: note.trim() };
    if (!payload.name) { await showAlert({ title: '提示', message: '请填写规则名字', type: 'warning' }); return; }
    if (!/^https?:\/\/\S+$/i.test(payload.url)) { await showAlert({ title: '提示', message: '链接地址需以 http:// 或 https:// 开头', type: 'warning' }); return; }
    setSaving(true);
    try {
      const result = initial
        ? await api.updateResource(initial.id, payload)
        : await api.createResource(payload);
      onSaved(result.item);
      onClose();
    } catch (e) {
      await showAlert({ title: '保存失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'warning' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-label={initial ? '更新分享' : '分享规则'} className="w-full max-w-md border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]">
        <header className="flex items-center justify-between bg-[#121212] px-4 py-2.5 text-white">
          <span className="flex items-center gap-2 text-sm font-black tracking-wider"><HeartIcon size={15} />{initial ? '更新我的分享' : '分享一条规则资源'}</span>
          <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer text-white/80 hover:text-white"><X className="h-4 w-4" /></button>
        </header>
        <div className="space-y-3 p-4">
          <label className="block text-xs font-black">规则名字 <span className="text-[#D62828]">*</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="例如：祸不单行 / Mausritter 中文规则" className="bauhaus-input mt-1 w-full p-2 text-sm font-bold" />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block text-xs font-black">地址类型
              <select value={type} onChange={(e) => setType(e.target.value as RuleResource['type'])} className="bauhaus-input mt-1 w-full p-2 text-sm font-bold">
                <option value="pan">网盘下载</option>
                <option value="wiki">Wiki / 在线查询</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label className="block text-xs font-black">分享者
              <div className="bauhaus-input mt-1 flex items-center gap-1.5 p-2 text-sm font-bold text-[#666]"><HeartIcon size={14} />登录账号昵称</div>
            </label>
          </div>
          <label className="block text-xs font-black">链接地址 <span className="text-[#D62828]">*</span>
            <input value={url} onChange={(e) => setUrl(e.target.value)} maxLength={500} placeholder="https://…（网盘链接或 Wiki 页面地址）" className="bauhaus-input mt-1 w-full p-2 text-sm font-bold" />
            <span className="mt-1 block text-[11px] font-bold text-[#777]">只接受 http/https 链接；提取码可写在备注里，站点不托管文件。</span>
          </label>
          <label className="block text-xs font-black">备注（选填）
            <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} rows={2} placeholder="例如：提取码 1234 / 含中文译本" className="bauhaus-input mt-1 w-full p-2 text-sm font-bold" />
          </label>
        </div>
        <footer className="flex justify-end gap-2 border-t-2 border-[#121212] bg-[#F6F5F0] px-4 py-2.5">
          <button type="button" onClick={onClose} className="bauhaus-btn bg-white px-4 py-1.5 text-xs font-black">取消</button>
          <button type="submit" disabled={saving} className="bauhaus-btn gap-1 bg-[#004E98] px-4 py-1.5 text-xs font-black text-white disabled:opacity-60">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{initial ? '保存修改' : '发布分享'}
          </button>
        </footer>
      </form>
    </div>
  );
}

/** 爱心资源页：所有人可浏览、按规则名字检索；登录后可分享，自己的条目可改可删。 */
export function ResourceView({ currentUser, onOpenLogin }: { currentUser: UserProfile | null; onOpenLogin: () => void }) {
  const { showAlert, showConfirm } = useDialog();
  const [items, setItems] = useState<RuleResource[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<RuleResource | 'new' | null>(null);

  const load = async (q: string) => {
    try {
      const data = await api.resources(q);
      setItems(data.items || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 服务端按规则名字检索，输入停顿 300ms 后再查，避免每敲一个字都请求。
  useEffect(() => {
    const timer = window.setTimeout(() => { setLoading(true); void load(query.trim()); }, 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const remove = async (item: RuleResource) => {
    const ok = await showConfirm({ title: '删除分享', message: `确定删除「${item.name}」这条分享吗？删除后不可恢复。`, confirmText: '确认删除', type: 'danger' });
    if (!ok) return;
    try {
      await api.deleteResource(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      await showAlert({ title: '删除失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'warning' });
    }
  };

  const saved = (item: RuleResource) => {
    // 检索状态下新增/改名可能不再匹配当前关键词，直接按当前关键词重载最稳妥。
    if (query.trim()) void load(query.trim());
    else setItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)]);
  };

  return (
    <section className="w-full">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3 border-b-4 border-[#121212] pb-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-black tracking-wider text-[#121212] sm:text-3xl"><HeartIcon size={26} />爱心资源</h2>
          <p className="mt-1 text-xs font-bold text-[#666]">玩家互助 · 分享小众规则的下载地址或在线查询地址（网盘 / Wiki 均可）</p>
        </div>
        <button
          type="button"
          onClick={() => currentUser ? setEditor('new') : onOpenLogin()}
          className="bauhaus-btn gap-1.5 bg-[#004E98] px-4 py-2 text-sm font-black text-white hover:bg-[#003C76]"
        ><Plus className="h-4 w-4" />分享规则</button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#777]" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="按规则名字检索，例如：祸不单行" aria-label="按规则名字检索" className="bauhaus-input w-full py-2.5 pl-9 pr-3 text-sm font-bold" />
        </div>
        <span className="border-2 border-[#121212] bg-[#F2F0E8] px-3 py-2.5 text-xs font-black">共 {items.length} 条</span>
      </div>
      <p className="mb-4 text-[11px] font-bold text-[#777]">只按「规则名字」检索；链接由玩家自行填写，站点不托管文件。分享者昵称自动取当前登录账号。</p>

      {error && <div className="bauhaus-card mb-4 bg-[#FAF0F0] p-4 text-sm font-bold text-[#B51F1F]">{error}<button type="button" onClick={() => void load(query.trim())} className="ml-3 underline">重试</button></div>}
      {loading && !error && <div className="bauhaus-card p-10 text-center text-sm font-bold text-[#666]">加载中…</div>}
      {!loading && !error && items.length === 0 && (
        <div className="bauhaus-card border-dashed p-12 text-center text-sm font-bold text-[#666]">
          {query.trim() ? `没有找到名字含「${query.trim()}」的规则，换个关键词试试～` : '还没有人分享资源，来发第一条吧！'}
        </div>
      )}
      {!loading && !error && items.length > 0 && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => <ResourceCard key={item.id} item={item} onEdit={setEditor} onDelete={remove} />)}
        </div>
      )}

      {editor && (
        <ResourceEditor
          initial={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={saved}
        />
      )}
    </section>
  );
}

/** 个人档案里的「我的分享」界面：只看自己的条目，可新增、更新、删除。 */
export function MyResourcesModal({ onClose, onGoResources }: { onClose: () => void; onGoResources?: () => void }) {
  const { showAlert, showConfirm } = useDialog();
  const [items, setItems] = useState<RuleResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editor, setEditor] = useState<RuleResource | 'new' | null>(null);

  const load = async () => {
    try {
      const data = await api.myResources();
      setItems(data.items || []);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, []);

  const remove = async (item: RuleResource) => {
    const ok = await showConfirm({ title: '删除分享', message: `确定删除「${item.name}」这条分享吗？删除后不可恢复。`, confirmText: '确认删除', type: 'danger' });
    if (!ok) return;
    try {
      await api.deleteResource(item.id);
      setItems((prev) => prev.filter((x) => x.id !== item.id));
    } catch (e) {
      await showAlert({ title: '删除失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'warning' });
    }
  };

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-3 sm:p-5" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-label="我的分享" className="flex max-h-[90vh] w-full max-w-4xl flex-col border-4 border-[#121212] bg-white shadow-[10px_10px_0px_#121212]">
        <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 bg-[#121212] px-4 py-2.5 text-white">
          <h2 className="flex items-center gap-2 text-sm font-black tracking-wider"><HeartIcon size={15} />我的分享（{items.length}）</h2>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setEditor('new')} className="bauhaus-btn gap-1 border-white bg-[#004E98] px-2.5 py-1 text-xs font-black text-white shadow-none"><Plus className="h-3.5 w-3.5" />分享新规则</button>
            {onGoResources && <button type="button" onClick={onGoResources} className="border-2 border-white px-2.5 py-1 text-xs font-black hover:bg-white hover:text-[#121212]">去爱心资源页 →</button>}
            <button type="button" onClick={onClose} aria-label="关闭" className="cursor-pointer px-1 text-white/80 hover:text-white"><X className="h-4 w-4" /></button>
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto bg-[#F6F5F0] p-4">
          {loading && <p className="p-10 text-center text-sm font-bold text-[#666]">加载中…</p>}
          {error && <p className="bauhaus-card bg-[#FAF0F0] p-4 text-sm font-bold text-[#B51F1F]">{error}<button type="button" onClick={() => void load()} className="ml-3 underline">重试</button></p>}
          {!loading && !error && items.length === 0 && <p className="bauhaus-card border-dashed p-12 text-center text-sm font-bold text-[#666]">你还没有分享过规则资源，点右上角「分享新规则」发第一条吧。</p>}
          {!loading && !error && items.length > 0 && (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((item) => <ResourceCard key={item.id} item={item} onEdit={setEditor} onDelete={remove} />)}
            </div>
          )}
        </div>
        <footer className="flex shrink-0 justify-end border-t-2 border-[#121212] bg-[#F6F5F0] px-4 py-2.5">
          <button type="button" onClick={onClose} className="bauhaus-btn bg-white px-4 py-1.5 text-xs font-black">关闭</button>
        </footer>
      </section>
      {editor && (
        <ResourceEditor
          initial={editor === 'new' ? null : editor}
          onClose={() => setEditor(null)}
          onSaved={(item) => setItems((prev) => [item, ...prev.filter((x) => x.id !== item.id)])}
        />
      )}
    </div>
  );
}
