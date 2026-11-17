import React, { useCallback, useMemo, useState } from 'react';
import { FolderPlus, Link2, Plus, Search, X } from 'lucide-react';
import { api, type RoundtableResourceRef, type RoundtableOrigin } from '../services/api';

/**
 * GM圆桌主题表单：前台「申请主题」与后台「新建主题」共用同一套字段，
 * 保证"申请界面等同于新建界面，同意=新建"。
 * 字段：主题名称 / 原模组所属规则版本 / 模组来源(必填,作为标签) / 规则分页（可选新建）/ tag / 引用站内爱心资源。
 */
export interface TopicFormValue {
  name: string;
  channelId: string;
  newChannelName: string;
  tags: string[];
  resources: RoundtableResourceRef[];
  origin: RoundtableOrigin;
  ruleVersion: string;
}

export const ORIGIN_OPTIONS: RoundtableOrigin[] = ['官方', '第三方授权', '民间创作'];

export const emptyTopicForm = (): TopicFormValue => ({
  name: '', channelId: '', newChannelName: '', tags: [], resources: [], origin: '', ruleVersion: '',
});

const cnLen = (s: string) => Array.from(s.trim()).reduce((n, ch) => {
  const code = ch.charCodeAt(0);
  return n + (code >= 0x4e00 && code <= 0x9fff ? 1 : 0.5);
}, 0);

type Props = {
  channels: Array<{ id: string; label: string }>;
  dark?: boolean;
  submitLabel: string;
  flash: (msg: string) => void;
  onSave: (value: TopicFormValue) => void | Promise<void>;
  onCancel?: () => void;
  /** 编辑模式：预填已有主题的值，且不允许新建规则分页。 */
  initialValue?: TopicFormValue;
};

export const RoundtableTopicForm: React.FC<Props> = ({ channels, dark = false, submitLabel, flash, onSave, onCancel, initialValue }) => {
  const [value, setValue] = useState<TopicFormValue>(() => initialValue ? { ...emptyTopicForm(), ...initialValue } : emptyTopicForm());
  const [tagDraft, setTagDraft] = useState('');
  const [resQuery, setResQuery] = useState('');
  const [resResults, setResResults] = useState<Array<{ id: string; name: string; url: string; type: string; category: string }>>([]);
  const [resSearched, setResSearched] = useState(false);

  // 主题表单样式 token：dark=前台 GM 圆桌（深色面板）/ light=后台（浅色面板）。
  // 注意：夜间模式是全局反色规则，light 分支必须只用会被夜间映射的色值（bg-white / text-[#121212] /
  // border-[#DDD] 等），否则会出现"浅底浅字"看不清。资源检索区单独给 resBox/resRow/resName 等令牌。
  const T = useMemo(() => dark ? {
    input: 'border-[#6B6B6B] bg-[#242426] text-[#F1EEE6] placeholder:text-[#8E8E8E] focus:border-[#8BC34A]',
    label: 'text-[#C9C9C9]', sub: 'text-[#A8ADB5]', chip: 'border-[#8BC34A] bg-[#343437] text-[#DCE8CF]',
    primary: 'bg-[#8BC34A] text-[#1B2B0B] hover:bg-[#9CD455]',
    secondary: 'border-[#6B6B6B] bg-[#343437] text-[#E8E8E8] hover:border-[#8BC34A] hover:text-[#9CD455]',
    resBox: 'border-[#6B6B6B] bg-[#1B1B1D]',
    resRow: 'border-[#3F3F41]',
    resName: 'text-[#F1EEE6]',
    resMeta: 'text-[#B0B4BB]',
    resAdd: 'text-[#9CD455] hover:bg-[#343437] hover:underline',
    resAdded: 'text-[#8A8A8A]',
  } : {
    input: 'border-[#121212] bg-white text-[#121212] placeholder:text-[#999] focus:border-[#004E98]',
    label: 'text-[#444]', sub: 'text-[#777]', chip: 'border-[#176B57] bg-[#EAF5F1] text-[#176B57]',
    primary: 'bg-[#176B57] text-white hover:opacity-90',
    secondary: 'border-[#121212] bg-white text-[#121212] hover:bg-[#FAF9F5]',
    resBox: 'border-[#121212] bg-white',
    resRow: 'border-[#DDD]',
    resName: 'text-[#121212]',
    resMeta: 'text-[#666]',
    resAdd: 'text-[#004E98] hover:bg-[#EAF3FB] hover:underline',
    resAdded: 'text-[#888]',
  }, [dark]);

  const addTag = useCallback(() => {
    const t = tagDraft.trim();
    if (!t) return;
    if (value.tags.length >= 6) { flash('模组风格 tag 最多 6 个'); return; }
    if (cnLen(t) > 6) { flash('每个 tag 最多 6 个中文字符'); return; }
    if (value.tags.includes(t)) { flash('该 tag 已添加'); return; }
    setValue((v) => ({ ...v, tags: [...v.tags, t] }));
    setTagDraft('');
  }, [tagDraft, value.tags, flash]);

  const searchResources = useCallback(async () => {
    const q = resQuery.trim();
    try {
      const data = await api.resources(q);
      setResResults((data.items || []).slice(0, 8).map((r) => ({ id: r.id, name: r.name, url: r.url, type: r.type, category: r.category })));
      setResSearched(true);
    } catch { flash('资源检索失败'); }
  }, [resQuery, flash]);

  const addResource = (r: { id: string; name: string; url: string }) => {
    if (value.resources.some((x) => x.id === r.id)) { flash('该资源已引用'); return; }
    if (value.resources.length >= 8) { flash('最多引用 8 个资源'); return; }
    setValue((v) => ({ ...v, resources: [...v.resources, { id: r.id, name: r.name, url: r.url }] }));
  };

  const submit = () => {
    if (!value.name.trim()) { flash('请填写主题名称'); return; }
    if (!value.channelId) { flash('请选择主题放置的规则分页'); return; }
    if (value.channelId === '__new__' && !value.newChannelName.trim()) { flash('请填写新建规则分页名称'); return; }
    // tag 非必填：允许留空，编辑时可把已有 tag 全部删掉
    if (!value.origin) { flash('请选择模组来源（官方 / 第三方授权 / 民间创作）'); return; }
    onSave({
      ...value,
      name: value.name.trim(),
      newChannelName: value.newChannelName.trim(),
      ruleVersion: value.ruleVersion.trim(),
    });
  };

  const inputCls = `w-full border-2 px-3 py-2 text-sm outline-none ${T.input}`;

  return (
    <div className="space-y-3">
      <div>
        <label className={`mb-1 block text-xs font-bold ${T.label}`}>主题名称</label>
        <input value={value.name} onChange={(e) => setValue((v) => ({ ...v, name: e.target.value }))} placeholder="例如：魔藤"
          className={inputCls} />
      </div>

      <div>
        <label className={`mb-1 block text-xs font-bold ${T.label}`}>原模组所属规则版本</label>
        <input value={value.ruleVersion} onChange={(e) => setValue((v) => ({ ...v, ruleVersion: e.target.value }))}
          placeholder="例：ADND、COC6th等，如无特殊便不填" className={inputCls} />
      </div>

      <div>
        <label className={`mb-1 block text-xs font-bold ${T.label}`}>模组来源 <span className="text-[#D62828]">*</span></label>
        <div className="flex flex-wrap gap-2">
          {ORIGIN_OPTIONS.map((opt) => (
            <button key={opt} type="button" onClick={() => setValue((v) => ({ ...v, origin: opt }))}
              className={`border-2 px-3 py-1.5 text-xs font-bold transition-colors ${value.origin === opt ? T.chip : (dark ? 'border-[#555] bg-[#242426] text-[#C9C9C9] hover:border-[#8BC34A]' : 'border-[#CCC] bg-white text-[#555] hover:border-[#176B57]')}`}>
              {value.origin === opt ? '✓ ' : ''}{opt}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className={`mb-1 block text-xs font-bold ${T.label}`}>主题放在哪个规则下</label>
        <select value={value.channelId} onChange={(e) => setValue((v) => ({ ...v, channelId: e.target.value }))}
          className={inputCls}>
          <option value="">请选择规则分页</option>
          {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          {!initialValue && <option value="__new__">申请新建规则分页…</option>}
        </select>
        {value.channelId === '__new__' && (
          <div className="mt-2 flex items-center gap-1.5">
            <FolderPlus size={14} className={T.sub} />
            <input value={value.newChannelName} onChange={(e) => setValue((v) => ({ ...v, newChannelName: e.target.value }))} placeholder="输入新建规则分页名称"
              className={inputCls} />
          </div>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between">
          <label className={`text-xs font-bold ${T.label}`}>模组风格 tag（可选，最多 6 个，每个 ≤ 6 中文字符）</label>
          <span className={`text-[11px] ${T.sub}`}>{value.tags.length}/6</span>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {value.tags.map((tag) => (
            <span key={tag} className={`flex items-center gap-1 border px-2 py-0.5 text-[11px] font-bold ${T.chip}`}>
              {tag}
              <button type="button" aria-label={`删除 ${tag}`} onClick={() => setValue((v) => ({ ...v, tags: v.tags.filter((t) => t !== tag) }))}><X size={12} /></button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="输入 tag 后回车添加" className={`flex-1 border-2 px-3 py-2 text-sm outline-none ${T.input}`} />
          <button type="button" onClick={addTag} className={`border-2 px-3 text-sm font-black ${T.secondary}`}>添加</button>
        </div>
      </div>

      <div className={`border-t pt-3 ${dark ? 'border-[#3A3A3A]' : 'border-[#DDD]'}`}>
        <label className={`mb-1 block text-xs font-bold ${T.label}`}>引用站内爱心资源（可选，可检索）</label>
        <p className={`mb-2 text-[11px] ${T.sub}`}>若站内已有该主题相关的规则书 / 模组资源，可检索后引用到主题里。</p>
        <div className="flex gap-2">
          <input value={resQuery} onChange={(e) => setResQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); void searchResources(); } }}
            placeholder="输入资源名称检索站内爱心资源" className={`flex-1 border-2 px-3 py-2 text-sm outline-none ${T.input}`} />
          <button type="button" onClick={() => void searchResources()} className={`flex items-center gap-1 border-2 px-3 text-sm font-bold ${T.secondary}`}><Search size={14} />检索</button>
        </div>
        {resSearched && (
          <div className={`mt-2 max-h-32 overflow-auto border-2 ${T.resBox}`}>
            {resResults.length === 0 && <div className={`px-3 py-2 text-xs font-bold ${T.resMeta}`}>没有匹配的站内资源</div>}
            {resResults.map((r) => {
              const added = value.resources.some((x) => x.id === r.id);
              return (
                <div key={r.id} className={`flex items-center gap-2 border-b px-2 py-1.5 last:border-b-0 ${T.resRow}`}>
                  <Link2 size={13} className={T.resMeta} />
                  <span className={`min-w-0 flex-1 truncate text-xs font-bold ${T.resName}`}>{r.name}</span>
                  <span className={`shrink-0 text-[10px] font-bold ${T.resMeta}`}>{r.category}</span>
                  <button type="button" disabled={added} onClick={() => addResource(r)}
                    className={`flex shrink-0 items-center gap-1 px-1.5 py-0.5 text-[11px] font-bold ${added ? T.resAdded : T.resAdd}`}>
                    {added ? '已引用' : <><Plus size={12} />引用</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {value.resources.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {value.resources.map((r) => (
              <span key={r.id} className={`flex max-w-full items-center gap-1 border px-2 py-0.5 text-[11px] font-bold ${T.chip}`}>
                <span className="truncate">{r.name}</span>
                <button type="button" aria-label={`移除 ${r.name}`} onClick={() => setValue((v) => ({ ...v, resources: v.resources.filter((x) => x.id !== r.id) }))}><X size={12} /></button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 pt-2">
        {onCancel && <button type="button" onClick={onCancel} className={`border-2 px-4 py-2 text-xs font-black ${T.secondary}`}>取消</button>}
        <button type="button" onClick={submit} className={`px-4 py-2 text-xs font-black ${T.primary}`}>{submitLabel}</button>
      </div>
    </div>
  );
};
