import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, FileText, FolderPlus, LayoutList, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { adminApi, type RoundtableApply, type RoundtableSnapshot, type RoundtableTopic, type RoundtableResourceRef } from '../services/api';
import { AdminResourcesSection } from './AdminResourcesSection';
import { RoundtableTopicForm, emptyTopicForm, type TopicFormValue } from './RoundtableTopicForm';

/**
 * 后台「内容审核」：资源审核（真实功能）+ 圆桌审核（真实持久化数据）。
 * 圆桌审核三分页：
 *  - 主题申请：同意（等同新建，带申请填写的全部字段）/ 驳回，处理后不留记录
 *  - 规则页管理：新建、编辑名称（不显示主题数）、删除；4 列分布
 *  - 主题管理：综合固定第一、按规则页分类分组、编辑名称/标签、移动分页、删除、弹窗新建
 */

type Props = {
  onNotice: (message: string) => void;
  onError: (error: unknown) => void;
  onPendingChange?: (pending: number) => void;
};

export const AdminContentReviewSection: React.FC<Props> = ({ onNotice, onError, onPendingChange }) => {
  const [tab, setTab] = useState<'resource' | 'roundtable'>('resource');
  return (
    <div className="min-w-0">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => setTab('resource')}
          className={`bauhaus-btn px-5 py-2.5 text-sm ${tab === 'resource' ? 'bg-[#121212] text-white' : 'bg-white'}`}>
          <ShieldCheck size={16} />资源审核
        </button>
        <button type="button" onClick={() => setTab('roundtable')}
          className={`bauhaus-btn px-5 py-2.5 text-sm ${tab === 'roundtable' ? 'bg-[#121212] text-white' : 'bg-white'}`}>
          <BookOpen size={16} />圆桌审核
        </button>
      </div>
      {tab === 'resource' ? (
        <AdminResourcesSection onNotice={onNotice} onError={onError} onPendingChange={onPendingChange} />
      ) : (
        <RoundtableReview onNotice={onNotice} onError={onError} />
      )}
    </div>
  );
};

const RoundtableReview: React.FC<{ onNotice: (m: string) => void; onError: (e: unknown) => void }> = ({ onNotice, onError }) => {
  const [sub, setSub] = useState<'apply' | 'channels' | 'topics'>('apply');
  const [data, setData] = useState<RoundtableSnapshot>({ channels: [], topics: [], applies: [] });
  const [loading, setLoading] = useState(true);
  const [newChannel, setNewChannel] = useState('');
  const [topicSearch, setTopicSearch] = useState('');
  const [topicChannelFilter, setTopicChannelFilter] = useState('all');

  const load = useCallback(async () => {
    try {
      const snap = await adminApi.roundtable();
      setData({ channels: snap.channels || [], topics: snap.topics || [], applies: snap.applies || [] });
    } catch (e) { onError(e); }
    finally { setLoading(false); }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const channels = data.channels, topics = data.topics, applies = data.applies || [];
  const flash = (m: string) => onNotice(m);

  // 同意申请弹窗：展示申请的全部字段，选择规则分页后「同意=新建」。
  const [approveTarget, setApproveTarget] = useState<RoundtableApply | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [newRuleChannel, setNewRuleChannel] = useState('');
  const openApprove = (a: RoundtableApply) => {
    setApproveTarget(a);
    setSelectedChannel(a.channelId && channels.some((c) => c.id === a.channelId) ? a.channelId : (channels[0]?.id || ''));
    setCreateNew(false); setNewRuleChannel('');
  };
  const confirmApprove = async () => {
    if (!approveTarget) return;
    if (!selectedChannel && !createNew) { onNotice('请选择规则分页'); return; }
    if (createNew && !newRuleChannel.trim()) { onNotice('请填写新规则页名称'); return; }
    try {
      await adminApi.approveRoundtableApply(approveTarget.id, {
        channelId: createNew ? '' : selectedChannel,
        createNew, newChannelName: newRuleChannel.trim(),
      });
      onNotice(`已同意「${approveTarget.name}」并按申请内容建立主题`);
      setApproveTarget(null);
      await load();
    } catch (e) { onError(e); }
  };
  const rejectApply = async (a: RoundtableApply) => {
    try { await adminApi.rejectRoundtableApply(a.id); onNotice(`已驳回「${a.name}」申请`); await load(); }
    catch (e) { onError(e); }
  };

  const addChannel = async () => {
    const name = newChannel.trim();
    if (!name) return;
    try { await adminApi.addRoundtableChannel(name); setNewChannel(''); onNotice(`已新建规则页「${name}」`); await load(); }
    catch (e) { onError(e); }
  };
  const saveChannelName = async (cid: string, name: string) => {
    const v = name.trim();
    if (!v) { onNotice('规则页名称不能为空'); return; }
    try { await adminApi.renameRoundtableChannel(cid, v); onNotice('规则页名称已更新'); await load(); }
    catch (e) { onError(e); }
  };
  const deleteChannel = async (cid: string, label: string) => {
    if (!window.confirm(`确定删除规则页「${label}」？该页下的主题与回复也会一并删除。`)) return;
    try {
      const r = await adminApi.deleteRoundtableChannel(cid);
      onNotice(`已删除规则页「${label}」及其 ${r.deletedTopics} 个主题`);
      if (topicChannelFilter === cid) setTopicChannelFilter('all');
      await load();
    } catch (e) { onError(e); }
  };

  // 后台新建主题弹窗：与前台申请共用同一表单。
  const [newTopicOpen, setNewTopicOpen] = useState(false);
  const saveNewTopic = async (v: TopicFormValue) => {
    try {
      await adminApi.addRoundtableTopic({
        channelId: v.channelId, title: v.name, tags: v.tags, resources: v.resources,
      });
      onNotice('主题已新建');
      setNewTopicOpen(false);
      await load();
    } catch (e) { onError(e); }
  };
  const saveTopic = async (t: RoundtableTopic, patch: { title?: string; channelId?: string; tags?: string[]; resources?: RoundtableResourceRef[] }) => {
    try { await adminApi.updateRoundtableTopic(t.id, patch); onNotice('主题已更新'); await load(); }
    catch (e) { onError(e); }
  };
  const deleteTopic = async (t: RoundtableTopic) => {
    if (!window.confirm(`确定删除主题「${t.title}」？其下回复也会一并删除。`)) return;
    try { await adminApi.deleteRoundtableTopic(t.id); onNotice('主题已删除'); await load(); }
    catch (e) { onError(e); }
  };

  const filteredTopics = useMemo(() => topics.filter((t) => {
    if (topicChannelFilter !== 'all' && t.channelId !== topicChannelFilter) return false;
    const q = topicSearch.trim().toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !t.tags.some((tag) => tag.toLowerCase().includes(q))) return false;
    return true;
  }), [topics, topicChannelFilter, topicSearch]);

  // 综合固定第一：分组顺序为「综合（全部）」+ 按 channels 原顺序的规则页。
  const groups = useMemo(() => {
    const list = topicChannelFilter === 'all'
      ? [{ id: 'all', label: '综合' }, ...channels]
      : channels.filter((c) => c.id === topicChannelFilter);
    return list.map((c) => ({
      channel: c,
      items: c.id === 'all' ? filteredTopics : filteredTopics.filter((t) => t.channelId === c.id),
    }));
  }, [channels, filteredTopics, topicChannelFilter]);

  const subTabs: Array<{ id: typeof sub; label: string; icon: typeof FileText; count?: number }> = [
    { id: 'apply', label: '主题申请', icon: FileText, count: applies.length },
    { id: 'channels', label: '规则页管理', icon: LayoutList, count: channels.length },
    { id: 'topics', label: '主题管理', icon: BookOpen, count: topics.length },
  ];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b-2 border-[#121212] pb-2">
        {subTabs.map((s) => { const Icon = s.icon; return (
          <button key={s.id} type="button" onClick={() => setSub(s.id)}
            className={`bauhaus-btn px-4 py-2 text-sm ${sub === s.id ? 'bg-[#176B57] text-white' : 'bg-white'}`}>
            <Icon size={15} />{s.label}{s.count !== undefined && <span className="ml-1 text-xs opacity-70">({s.count})</span>}
          </button>
        ); })}
      </div>

      {loading && <div className="py-10 text-center text-sm text-[#777]">加载中…</div>}

      {/* 主题申请 */}
      {!loading && sub === 'apply' && (
        <div className="flex flex-col gap-3">
          {applies.length === 0 && <div className="bauhaus-card bg-white p-8 text-center text-sm text-[#777]">暂无待处理申请</div>}
          {applies.map((a) => (
            <div key={a.id} className="bauhaus-card bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h4 className="text-base font-black text-[#121212]">《{a.name}》主题申请</h4>
                  <p className="mt-1 text-xs text-[#666]">申请人：{a.applicant} · {a.time}{a.rule ? ` · 原版规则：${a.rule}` : ''}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{a.tags.map((t) => <span key={t} className="border border-[#999] px-1.5 py-0.5 text-[11px] font-bold text-[#555]">{t}</span>)}</div>
                  {!!a.resources?.length && (
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-[#004E98]">
                      {a.resources.map((r) => <span key={r.id} className="flex items-center gap-1 border border-[#004E98] px-1.5 py-0.5 font-bold"><BookOpen size={11} />{r.name}</span>)}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button type="button" onClick={() => openApprove(a)} className="bauhaus-btn bg-[#176B57] px-3 py-1.5 text-xs text-white"><Check size={14} />同意</button>
                  <button type="button" onClick={() => void rejectApply(a)} className="bauhaus-btn bg-white px-3 py-1.5 text-xs"><X size={14} />驳回</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 规则页管理：编辑名称、4 列分布 */}
      {!loading && sub === 'channels' && (
        <div>
          <div className="bauhaus-card mb-3 flex flex-wrap items-center gap-2 bg-white p-3">
            <input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addChannel(); }} placeholder="输入新规则页名称"
              className="min-w-[200px] flex-1 border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
            <button type="button" onClick={() => void addChannel()} className="bauhaus-btn bg-[#004E98] px-4 py-2 text-sm text-white"><FolderPlus size={15} />新建规则页</button>
          </div>
          {channels.length === 0 && <div className="bauhaus-card bg-white p-8 text-center text-sm text-[#777]">还没有规则页，先新建一个吧</div>}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {channels.map((c) => <ChannelCard key={c.id} id={c.id} label={c.label}
              onSave={(name) => void saveChannelName(c.id, name)} onDelete={() => void deleteChannel(c.id, c.label)} />)}
          </div>
        </div>
      )}

      {/* 主题管理：综合第一、按规则页分组（4 列分布）、编辑名称/标签、移动、删除、弹窗新建 */}
      {!loading && sub === 'topics' && (
        <div>
          <div className="bauhaus-card mb-3 flex flex-wrap items-center gap-2 bg-white p-3">
            <select value={topicChannelFilter} onChange={(e) => setTopicChannelFilter(e.target.value)}
              className="border-2 border-[#121212] bg-white px-2 py-2 text-sm font-bold outline-none">
              <option value="all">综合（全部规则页）</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="flex flex-1 items-center gap-2">
              <Search size={16} className="text-[#777]" />
              <input value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} placeholder="按主题标题或 tag 检索"
                className="w-full border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
            </div>
            <button type="button" onClick={() => setNewTopicOpen(true)} className="bauhaus-btn bg-[#176B57] px-4 py-2 text-sm text-white"><Plus size={15} />新建主题</button>
          </div>

          {groups.map(({ channel, items }) => (
            <div key={channel.id} className="mb-4">
              <div className="mb-1.5 flex items-center gap-2 border-l-4 border-[#176B57] pl-2">
                <h4 className="text-sm font-black text-[#121212]">{channel.label}</h4>
                <span className="text-xs text-[#777]">{items.length} 个主题</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {items.length === 0 && <div className="col-span-full bauhaus-card bg-white p-5 text-center text-xs text-[#999]">该规则页暂无主题</div>}
                {items.map((t) => <TopicCard key={t.id} topic={t} channels={channels}
                  onSave={(patch) => void saveTopic(t, patch)} onDelete={() => void deleteTopic(t)} />)}
              </div>
            </div>
          ))}
          {channels.length === 0 && <div className="bauhaus-card bg-white p-8 text-center text-sm text-[#777]">请先到「规则页管理」新建规则页</div>}
        </div>
      )}

      {/* 同意申请弹窗：展示申请字段 + 选择规则分页，同意=新建 */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setApproveTarget(null)}>
          <div className="bauhaus-card w-full max-w-md bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#121212]">同意申请 · 同意即新建</h3>
              <button type="button" onClick={() => setApproveTarget(null)} className="text-[#777] hover:text-[#121212]"><X size={20} /></button>
            </div>
            <div className="mb-3 border-2 border-[#121212] bg-[#FAF9F5] p-3">
              <p className="mb-1 text-sm font-black text-[#121212]">《{approveTarget.name}》</p>
              <p className="text-xs text-[#666]">申请人：{approveTarget.applicant} · {approveTarget.time}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">{approveTarget.tags.map((t) => <span key={t} className="border border-[#999] px-1.5 py-0.5 text-[11px] font-bold text-[#555]">{t}</span>)}</div>
              {!!approveTarget.resources?.length && <p className="mt-2 text-[11px] text-[#004E98]">引用资源：{approveTarget.resources.map((r) => r.name).join('、')}</p>}
            </div>
            <label className="mb-2 block text-xs font-bold text-[#444]">主题放在哪个规则下</label>
            <label className="mb-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} />新建规则分页</label>
            {createNew ? (
              <input value={newRuleChannel} onChange={(e) => setNewRuleChannel(e.target.value)} placeholder="输入新规则分页名称"
                className="mb-4 w-full border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
            ) : (
              <div className="mb-4 grid max-h-52 grid-cols-2 gap-2 overflow-auto">
                {channels.map((c) => <button key={c.id} type="button" onClick={() => setSelectedChannel(c.id)}
                  className={`border-2 border-[#121212] px-3 py-2 text-sm font-bold ${selectedChannel === c.id ? 'bg-[#176B57] text-white' : 'bg-white'}`}>{c.label}</button>)}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApproveTarget(null)} className="bauhaus-btn bg-white px-4 py-2 text-sm">取消</button>
              <button type="button" onClick={() => void confirmApprove()} className="bauhaus-btn bg-[#176B57] px-4 py-2 text-sm text-white"><Check size={15} />确认同意并新建</button>
            </div>
          </div>
        </div>
      )}

      {/* 后台新建主题弹窗：与前台申请共用同一表单 */}
      {newTopicOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setNewTopicOpen(false)}>
          <div className="bauhaus-card w-full max-w-lg bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#121212]">新建主题</h3>
              <button type="button" onClick={() => setNewTopicOpen(false)} className="text-[#777] hover:text-[#121212]"><X size={20} /></button>
            </div>
            <RoundtableTopicForm channels={channels} submitLabel="新建主题" flash={flash} onSave={saveNewTopic} onCancel={() => setNewTopicOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

/** 单个规则页卡片：名称可直接编辑并保存（4 列分布） */
const ChannelCard: React.FC<{ id: string; label: string; onSave: (name: string) => void; onDelete: () => void }> = ({ label, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  useEffect(() => setValue(label), [label]);
  return (
    <div className="bauhaus-card flex min-w-0 flex-col justify-between bg-white p-3">
      {editing ? (
        <div className="flex flex-col gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') { onSave(value); setEditing(false); } if (e.key === 'Escape') { setValue(label); setEditing(false); } }}
            className="w-full border-2 border-[#121212] px-2 py-1 text-sm outline-none" />
          <div className="flex gap-2">
            <button type="button" onClick={() => { onSave(value); setEditing(false); }} className="bauhaus-btn bg-[#176B57] px-2.5 py-1 text-xs text-white"><Check size={14} />保存</button>
            <button type="button" onClick={() => { setValue(label); setEditing(false); }} className="text-[#999] hover:text-[#121212]"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <div className="flex min-w-0 items-start gap-2">
          <BookOpen size={16} className="mt-0.5 shrink-0 text-[#176B57]" />
          <strong className="min-w-0 flex-1 break-words text-sm text-[#121212]">{label}</strong>
          <button type="button" onClick={() => setEditing(true)} title="编辑名称" className="shrink-0 text-[#999] hover:text-[#004E98]"><Pencil size={15} /></button>
        </div>
      )}
      <div className="mt-3 flex justify-end">
        <button type="button" onClick={onDelete} title="删除规则页" className="text-[#999] hover:text-[#D62828]"><Trash2 size={16} /></button>
      </div>
    </div>
  );
};

/** 单个主题卡片：编辑名称/标签、切换规则页、删除（4 列分布） */
const TopicCard: React.FC<{
  topic: RoundtableTopic;
  channels: Array<{ id: string; label: string }>;
  onSave: (patch: { title?: string; channelId?: string; tags?: string[]; resources?: RoundtableResourceRef[] }) => void;
  onDelete: () => void;
}> = ({ topic, channels, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(topic.title);
  const [tagsDraft, setTagsDraft] = useState((topic.tags || []).join(', '));
  useEffect(() => { setTitle(topic.title); setTagsDraft((topic.tags || []).join(', ')); }, [topic.title, topic.tags]);
  const save = () => {
    const tags = tagsDraft.split(/[,，]/).map((s) => s.trim()).filter(Boolean).slice(0, 6);
    onSave({ title: title.trim(), tags });
    setEditing(false);
  };
  return (
    <div className="bauhaus-card flex min-w-0 flex-col bg-white p-3">
      {editing ? (
        <div className="flex flex-col gap-2">
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            className="w-full border-2 border-[#121212] px-2 py-1 text-sm outline-none" />
          <input value={tagsDraft} onChange={(e) => setTagsDraft(e.target.value)} placeholder="标签（英文逗号分隔，最多 6 个）"
            className="w-full border-2 border-[#121212] px-2 py-1 text-[11px] outline-none" />
          <div className="flex gap-2">
            <button type="button" onClick={save} className="bauhaus-btn bg-[#176B57] px-2.5 py-1 text-xs text-white"><Check size={14} />保存</button>
            <button type="button" onClick={() => setEditing(false)} className="text-[#999] hover:text-[#121212]"><X size={16} /></button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex min-w-0 items-start gap-2">
            <h4 className="min-w-0 flex-1 break-words text-sm font-black text-[#121212]">{topic.title}</h4>
            <button type="button" onClick={() => setEditing(true)} title="编辑主题名称/标签" className="shrink-0 text-[#999] hover:text-[#004E98]"><Pencil size={15} /></button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {topic.tags.map((tag) => <span key={tag} className="border border-[#999] px-1.5 py-0.5 text-[10px] font-bold text-[#555]">{tag}</span>)}
            {topic.tags.length === 0 && <span className="text-[10px] text-[#AAA]">无标签</span>}
          </div>
          {!!topic.resources?.length && <div className="mt-1.5 text-[10px] text-[#004E98]">引用 {topic.resources.length} 个爱心资源</div>}
        </>
      )}
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#EEE] pt-2">
        <select value={topic.channelId} onChange={(e) => onSave({ channelId: e.target.value })}
          className="min-w-0 flex-1 border-2 border-[#121212] bg-white px-2 py-1 text-xs outline-none">
          {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="button" onClick={onDelete} title="删除主题" className="shrink-0 text-[#999] hover:text-[#D62828]"><Trash2 size={16} /></button>
      </div>
    </div>
  );
};
