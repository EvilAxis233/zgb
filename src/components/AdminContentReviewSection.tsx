import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Check, FileText, FolderPlus, LayoutList, Pencil, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { adminApi, type RoundtableApply, type RoundtableSnapshot, type RoundtableTopic } from '../services/api';
import { AdminResourcesSection } from './AdminResourcesSection';

/**
 * 后台「内容审核」：资源审核（真实功能）+ 圆桌审核（真实持久化数据）。
 * 圆桌审核三分页：
 *  - 主题申请：同意（选规则分页 / 可新建）/ 驳回，处理后不留记录
 *  - 规则页管理：新建、编辑名称（不再显示主题数）、删除
 *  - 主题管理：按规则页分类筛选与分组、编辑名称、移动分页、删除、手动新建
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
  const [newTopicChannel, setNewTopicChannel] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicRule, setNewTopicRule] = useState('');

  const load = useCallback(async () => {
    try {
      const snap = await adminApi.roundtable();
      setData({ channels: snap.channels || [], topics: snap.topics || [], applies: snap.applies || [] });
      setNewTopicChannel((prev) => prev || (snap.channels?.[0]?.id || ''));
    } catch (e) { onError(e); }
    finally { setLoading(false); }
  }, [onError]);
  useEffect(() => { void load(); }, [load]);

  const channels = data.channels, topics = data.topics, applies = data.applies || [];

  // 同意申请弹窗
  const [approveTarget, setApproveTarget] = useState<RoundtableApply | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [newRuleChannel, setNewRuleChannel] = useState('');
  const openApprove = (a: RoundtableApply) => {
    setApproveTarget(a); setSelectedChannel(channels[0]?.id || ''); setCreateNew(false); setNewRuleChannel('');
  };
  const confirmApprove = async () => {
    if (!approveTarget) return;
    if (createNew && !newRuleChannel.trim()) { onNotice('请填写新规则页名称'); return; }
    try {
      await adminApi.approveRoundtableApply(approveTarget.id, {
        channelId: createNew ? '' : selectedChannel,
        createNew, newChannelName: newRuleChannel.trim(),
      });
      onNotice(`已同意「${approveTarget.name}」并建立主题`);
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

  const addTopic = async () => {
    if (!newTopicChannel) { onNotice('请先新建或选择规则页'); return; }
    if (!newTopicTitle.trim()) { onNotice('请填写主题名称'); return; }
    try {
      await adminApi.addRoundtableTopic({ channelId: newTopicChannel, title: newTopicTitle.trim(), rule: newTopicRule.trim() });
      setNewTopicTitle(''); setNewTopicRule('');
      onNotice('主题已新建'); await load();
    } catch (e) { onError(e); }
  };
  const saveTopic = async (t: RoundtableTopic, patch: { title?: string; channelId?: string }) => {
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

  const groupedTopics = useMemo(() => {
    const map = new Map<string, RoundtableTopic[]>();
    for (const c of channels) map.set(c.id, []);
    for (const t of filteredTopics) {
      if (!map.has(t.channelId)) map.set(t.channelId, []);
      map.get(t.channelId)!.push(t);
    }
    return channels.filter((c) => topicChannelFilter === 'all' || c.id === topicChannelFilter).map((c) => ({ channel: c, items: map.get(c.id) || [] }));
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
                  <p className="mt-1 text-xs text-[#666]">原版规则：{a.rule} · 申请人：{a.applicant} · {a.time}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{a.tags.map((t) => <span key={t} className="border border-[#999] px-1.5 py-0.5 text-[11px] font-bold text-[#555]">{t}</span>)}</div>
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

      {/* 规则页管理：编辑名称（不显示主题数） */}
      {!loading && sub === 'channels' && (
        <div>
          <div className="bauhaus-card mb-3 flex flex-wrap items-center gap-2 bg-white p-3">
            <input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void addChannel(); }} placeholder="输入新规则页名称"
              className="min-w-[200px] flex-1 border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
            <button type="button" onClick={() => void addChannel()} className="bauhaus-btn bg-[#004E98] px-4 py-2 text-sm text-white"><FolderPlus size={15} />新建规则页</button>
          </div>
          {channels.length === 0 && <div className="bauhaus-card bg-white p-8 text-center text-sm text-[#777]">还没有规则页，先新建一个吧</div>}
          <div className="bauhaus-card divide-y-2 divide-[#121212] bg-white">
            {channels.map((c) => <ChannelRow key={c.id} id={c.id} label={c.label}
              onSave={(name) => void saveChannelName(c.id, name)} onDelete={() => void deleteChannel(c.id, c.label)} />)}
          </div>
        </div>
      )}

      {/* 主题管理：按规则页分类、编辑名称、移动、删除、新建 */}
      {!loading && sub === 'topics' && (
        <div>
          <div className="bauhaus-card mb-3 flex flex-wrap items-end gap-2 bg-white p-3">
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-bold text-[#666]">新建主题 · 规则页</label>
              <select value={newTopicChannel} onChange={(e) => setNewTopicChannel(e.target.value)}
                className="w-full border-2 border-[#121212] bg-white px-2 py-2 text-sm outline-none">
                <option value="">选择规则页</option>
                {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
            <div className="min-w-[180px] flex-1">
              <label className="mb-1 block text-[11px] font-bold text-[#666]">主题名称</label>
              <input value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} placeholder="输入主题名称"
                className="w-full border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
            </div>
            <div className="w-28">
              <label className="mb-1 block text-[11px] font-bold text-[#666]">规则（可选）</label>
              <input value={newTopicRule} onChange={(e) => setNewTopicRule(e.target.value)} placeholder="如 OSE"
                className="w-full border-2 border-[#121212] px-2 py-2 text-sm outline-none" />
            </div>
            <button type="button" onClick={() => void addTopic()} className="bauhaus-btn bg-[#176B57] px-4 py-2 text-sm text-white"><Plus size={15} />新建主题</button>
          </div>
          <div className="bauhaus-card mb-3 flex flex-wrap items-center gap-2 bg-white p-3">
            <select value={topicChannelFilter} onChange={(e) => setTopicChannelFilter(e.target.value)}
              className="border-2 border-[#121212] bg-white px-2 py-2 text-sm font-bold outline-none">
              <option value="all">全部规则页</option>
              {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </select>
            <div className="flex flex-1 items-center gap-2">
              <Search size={16} className="text-[#777]" />
              <input value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} placeholder="按主题标题或 tag 检索"
                className="w-full border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          {groupedTopics.map(({ channel, items }) => (
            <div key={channel.id} className="mb-4">
              <div className="mb-1.5 flex items-center gap-2 border-l-4 border-[#176B57] pl-2">
                <h4 className="text-sm font-black text-[#121212]">{channel.label}</h4>
                <span className="text-xs text-[#777]">{items.length} 个主题</span>
              </div>
              <div className="bauhaus-card divide-y-2 divide-[#121212] bg-white">
                {items.length === 0 && <div className="p-5 text-center text-xs text-[#999]">该规则页暂无主题</div>}
                {items.map((t) => <TopicRow key={t.id} topic={t} channels={channels}
                  onSave={(patch) => void saveTopic(t, patch)} onDelete={() => void deleteTopic(t)} />)}
              </div>
            </div>
          ))}
          {channels.length === 0 && <div className="bauhaus-card bg-white p-8 text-center text-sm text-[#777]">请先到「规则页管理」新建规则页</div>}
        </div>
      )}

      {/* 同意申请弹窗 */}
      {approveTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setApproveTarget(null)}>
          <div className="bauhaus-card w-full max-w-md bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-[#121212]">同意申请 · 选择规则分页</h3>
              <button type="button" onClick={() => setApproveTarget(null)} className="text-[#777] hover:text-[#121212]"><X size={20} /></button>
            </div>
            <p className="mb-3 text-sm text-[#555]">主题《{approveTarget.name}》将放入以下规则分页：</p>
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
              <button type="button" onClick={() => void confirmApprove()} className="bauhaus-btn bg-[#176B57] px-4 py-2 text-sm text-white"><Check size={15} />确认同意</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/** 单行规则页：名称可直接编辑并保存 */
const ChannelRow: React.FC<{ id: string; label: string; onSave: (name: string) => void; onDelete: () => void }> = ({ label, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(label);
  useEffect(() => setValue(label), [label]);
  return (
    <div className="flex items-center justify-between gap-2 px-4 py-3">
      {editing ? (
        <div className="flex flex-1 items-center gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)} autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') { onSave(value); setEditing(false); } if (e.key === 'Escape') { setValue(label); setEditing(false); } }}
            className="min-w-0 flex-1 border-2 border-[#121212] px-2 py-1 text-sm outline-none" />
          <button type="button" onClick={() => { onSave(value); setEditing(false); }} className="bauhaus-btn bg-[#176B57] px-2.5 py-1 text-xs text-white"><Check size={14} />保存</button>
          <button type="button" onClick={() => { setValue(label); setEditing(false); }} className="text-[#999] hover:text-[#121212]"><X size={16} /></button>
        </div>
      ) : (
        <div className="flex min-w-0 items-center gap-2">
          <BookOpen size={16} className="shrink-0 text-[#176B57]" />
          <strong className="truncate text-sm text-[#121212]">{label}</strong>
          <button type="button" onClick={() => setEditing(true)} title="编辑名称" className="text-[#999] hover:text-[#004E98]"><Pencil size={15} /></button>
        </div>
      )}
      <button type="button" onClick={onDelete} title="删除规则页" className="shrink-0 text-[#999] hover:text-[#D62828]"><Trash2 size={16} /></button>
    </div>
  );
};

/** 单行主题：名称可直接编辑、切换规则页、删除 */
const TopicRow: React.FC<{
  topic: RoundtableTopic;
  channels: Array<{ id: string; label: string }>;
  onSave: (patch: { title?: string; channelId?: string }) => void;
  onDelete: () => void;
}> = ({ topic, channels, onSave, onDelete }) => {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(topic.title);
  useEffect(() => setTitle(topic.title), [topic.title]);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {editing ? (
          <>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus
              onKeyDown={(e) => { if (e.key === 'Enter') { onSave({ title }); setEditing(false); } if (e.key === 'Escape') { setTitle(topic.title); setEditing(false); } }}
              className="min-w-0 flex-1 border-2 border-[#121212] px-2 py-1 text-sm outline-none" />
            <button type="button" onClick={() => { onSave({ title }); setEditing(false); }} className="bauhaus-btn bg-[#176B57] px-2.5 py-1 text-xs text-white"><Check size={14} />保存</button>
            <button type="button" onClick={() => { setTitle(topic.title); setEditing(false); }} className="text-[#999] hover:text-[#121212]"><X size={16} /></button>
          </>
        ) : (
          <>
            <h4 className="truncate text-sm font-black text-[#121212]">{topic.title}</h4>
            <button type="button" onClick={() => setEditing(true)} title="编辑主题名称" className="shrink-0 text-[#999] hover:text-[#004E98]"><Pencil size={15} /></button>
          </>
        )}
      </div>
      <div className="flex items-center gap-2">
        <select value={topic.channelId} onChange={(e) => onSave({ channelId: e.target.value })}
          className="border-2 border-[#121212] bg-white px-2 py-1 text-xs outline-none">
          {channels.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button type="button" onClick={onDelete} title="删除主题" className="text-[#999] hover:text-[#D62828]"><Trash2 size={16} /></button>
      </div>
    </div>
  );
};
