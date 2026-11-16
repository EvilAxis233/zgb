import React, { useState } from 'react';
import { BookOpen, Check, Clock3, FileText, Flag, FolderPlus, LayoutList, Plus, Search, ShieldCheck, Trash2, X } from 'lucide-react';
import { AdminResourcesSection } from './AdminResourcesSection';

/**
 * 后台「内容审核」：资源审核（真实功能）+ 圆桌审核（预览示例数据）。
 * 圆桌审核内部三个分页：主题申请（同意时选规则分页/可新建）、规则页管理、主题管理。
 */

type TopicApply = {
  id: string; name: string; rule: string; tags: string[]; applicant: string; time: string;
};
type RoundTopic = {
  id: string; title: string; channel: string; heat: number; replies: number; time: string;
};

const INITIAL_APPLIES: TopicApply[] = [
  { id: 'a1', name: '魔藤', rule: 'OSE', tags: ['模组探讨', '剧透'], applicant: 'EvilAxia', time: '2026-03-17 10:22' },
  { id: 'a2', name: '追书人', rule: 'COC 7版', tags: ['跑团复盘', 'COC'], applicant: 'YELLOW', time: '2026-03-17 09:15' },
  { id: 'a3', name: '狂野星球规则讨论', rule: 'DND 5e', tags: ['规则', 'DND'], applicant: '串串串', time: '2026-03-16 21:40' },
];
const INITIAL_CHANNELS = ['综合', 'OSE', 'COC', '待定'];
const INITIAL_TOPICS: RoundTopic[] = [
  { id: 't1', title: '《魔藤》模组相关内容讨论贴', channel: 'OSE', heat: 268, replies: 12, time: '2026-03-12' },
  { id: 't2', title: 'Brad Kerr作者系列模组探讨', channel: 'OSE', heat: 190, replies: 5, time: '2026-03-13' },
  { id: 't3', title: 'COC 7版《追书人》跑团记录与复盘', channel: 'COC', heat: 88, replies: 3, time: '2026-03-17' },
  { id: 't4', title: 'OSE规则相关讨论贴', channel: 'OSE', heat: 53, replies: 0, time: '2026-03-12' },
];

type Props = {
  onNotice: (message: string) => void;
  onError: (error: unknown) => void;
  onPendingChange?: (pending: number) => void;
};

export const AdminContentReviewSection: React.FC<Props> = ({ onNotice, onError, onPendingChange }) => {
  const [tab, setTab] = useState<'resource' | 'roundtable'>('resource');

  return (
    <div className="min-w-0">
      {/* 两级分页：资源审核 / 圆桌审核 */}
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
        <RoundtableReview onNotice={onNotice} />
      )}
    </div>
  );
};

/** 圆桌审核：主题申请 / 规则页管理 / 主题管理（纯前端预览） */
const RoundtableReview: React.FC<{ onNotice: (message: string) => void }> = ({ onNotice }) => {
  const [sub, setSub] = useState<'apply' | 'channels' | 'topics'>('apply');
  const [applies, setApplies] = useState(INITIAL_APPLIES);
  const [channels, setChannels] = useState(INITIAL_CHANNELS);
  const [topics, setTopics] = useState(INITIAL_TOPICS);
  const [newChannel, setNewChannel] = useState('');
  const [topicSearch, setTopicSearch] = useState('');

  // 同意申请时：选规则分页（可新建）
  const [approveTarget, setApproveTarget] = useState<TopicApply | null>(null);
  const [selectedChannel, setSelectedChannel] = useState('');
  const [createNew, setCreateNew] = useState(false);
  const [newRuleChannel, setNewRuleChannel] = useState('');

  const openApprove = (a: TopicApply) => {
    setApproveTarget(a);
    setSelectedChannel(channels[0] || '');
    setCreateNew(false);
    setNewRuleChannel('');
  };
  const confirmApprove = () => {
    if (!approveTarget) return;
    const target = createNew ? newRuleChannel.trim() : selectedChannel;
    if (!target) { onNotice('请选择或填写规则分页'); return; }
    if (createNew) {
      if (channels.includes(target)) { onNotice('该规则分页已存在'); return; }
      setChannels((prev) => [...prev, target]);
    }
    setTopics((prev) => [{
      id: `t-${Date.now()}`, title: `《${approveTarget.name}》主题讨论`, channel: target,
      heat: 0, replies: 0, time: new Date().toISOString().slice(0, 10),
    }, ...prev]);
    setApplies((prev) => prev.filter((a) => a.id !== approveTarget.id));
    onNotice(`已同意「${approveTarget.name}」并放入「${target}」分页（预览：仅前端演示）`);
    setApproveTarget(null);
  };
  const rejectApply = (a: TopicApply) => {
    setApplies((prev) => prev.filter((x) => x.id !== a.id));
    onNotice(`已驳回「${a.name}」申请（预览：仅前端演示）`);
  };

  const addChannel = () => {
    const name = newChannel.trim();
    if (!name) return;
    if (channels.includes(name)) { onNotice('该规则分页已存在'); return; }
    setChannels((prev) => [...prev, name]);
    setNewChannel('');
    onNotice(`已新建规则分页「${name}」（预览：仅前端演示）`);
  };
  const deleteChannel = (name: string) => {
    if (name === '综合') { onNotice('综合分页不可删除'); return; }
    setChannels((prev) => prev.filter((c) => c !== name));
    onNotice(`已删除规则分页「${name}」（预览：仅前端演示）`);
  };

  const filteredTopics = topics.filter((t) =>
    !topicSearch.trim() || t.title.toLowerCase().includes(topicSearch.trim().toLowerCase()) || t.channel.includes(topicSearch.trim()));

  const subTabs: Array<{ id: typeof sub; label: string; icon: typeof FileText; count?: number }> = [
    { id: 'apply', label: '主题申请', icon: FileText, count: applies.length },
    { id: 'channels', label: '规则页管理', icon: LayoutList, count: channels.length },
    { id: 'topics', label: '主题管理', icon: BookOpen, count: topics.length },
  ];

  return (
    <div>
      {/* 圆桌审核三分页 */}
      <div className="mb-4 flex flex-wrap items-center gap-2 border-b-2 border-[#121212] pb-2">
        {subTabs.map((s) => { const Icon = s.icon; return (
          <button key={s.id} type="button" onClick={() => setSub(s.id)}
            className={`bauhaus-btn px-4 py-2 text-sm ${sub === s.id ? 'bg-[#176B57] text-white' : 'bg-white'}`}>
            <Icon size={15} />{s.label}{s.count !== undefined && <span className="ml-1 text-xs opacity-70">({s.count})</span>}
          </button>
        ); })}
      </div>
      <p className="mb-3 text-xs text-[#777]">圆桌审核 · 预览版（示例数据，交互仅前端演示，数据未接入后台）</p>

      {/* 主题申请 */}
      {sub === 'apply' && (
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
                  <button type="button" onClick={() => rejectApply(a)} className="bauhaus-btn bg-white px-3 py-1.5 text-xs"><X size={14} />驳回</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 规则页管理 */}
      {sub === 'channels' && (
        <div>
          <div className="bauhaus-card mb-3 flex flex-wrap items-center gap-2 bg-white p-3">
            <input value={newChannel} onChange={(e) => setNewChannel(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addChannel(); }} placeholder="输入新规则分页名称"
              className="min-w-[200px] flex-1 border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
            <button type="button" onClick={addChannel} className="bauhaus-btn bg-[#004E98] px-4 py-2 text-sm text-white"><FolderPlus size={15} />新建规则分页</button>
          </div>
          <div className="bauhaus-card divide-y-2 divide-[#121212] bg-white">
            {channels.map((c) => {
              const count = topics.filter((t) => t.channel === c).length;
              return <div key={c} className="flex items-center justify-between gap-2 px-4 py-3">
                <div className="flex items-center gap-2"><BookOpen size={16} className="text-[#176B57]" /><strong className="text-sm text-[#121212]">{c}</strong><span className="text-xs text-[#777]">{count} 个主题</span></div>
                <button type="button" onClick={() => deleteChannel(c)} title={c === '综合' ? '综合分页不可删除' : '删除分页'} className="text-[#999] hover:text-[#D62828] disabled:opacity-40" disabled={c === '综合'}><Trash2 size={16} /></button>
              </div>;
            })}
          </div>
        </div>
      )}

      {/* 主题管理 */}
      {sub === 'topics' && (
        <div>
          <div className="bauhaus-card mb-3 flex items-center gap-2 bg-white p-3">
            <Search size={16} className="text-[#777]" />
            <input value={topicSearch} onChange={(e) => setTopicSearch(e.target.value)} placeholder="按主题标题或分页检索"
              className="w-full border-2 border-[#121212] px-3 py-2 text-sm outline-none" />
          </div>
          <div className="bauhaus-card divide-y-2 divide-[#121212] bg-white">
            {filteredTopics.length === 0 && <div className="p-8 text-center text-sm text-[#777]">没有匹配的主题</div>}
            {filteredTopics.map((t) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <div className="min-w-0">
                  <h4 className="truncate text-sm font-black text-[#121212]">{t.title}</h4>
                  <p className="mt-1 flex items-center gap-2 text-xs text-[#777]"><span className="bg-[#176B57] px-1.5 py-0.5 font-bold text-white">{t.channel}</span>热度 {t.heat} · {t.replies} 回复 · {t.time}</p>
                </div>
                <div className="flex gap-2">
                  <select value={t.channel} onChange={(e) => { const v = e.target.value; setTopics((prev) => prev.map((x) => x.id === t.id ? { ...x, channel: v } : x)); onNotice(`已将主题移至「${v}」分页（预览）`); }}
                    className="border-2 border-[#121212] bg-white px-2 py-1 text-xs outline-none">
                    {channels.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <button type="button" onClick={() => { setTopics((prev) => prev.filter((x) => x.id !== t.id)); onNotice('已删除主题（预览：仅前端演示）'); }} className="text-[#999] hover:text-[#D62828]" title="删除主题"><Trash2 size={16} /></button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 同意申请：选择规则分页弹窗 */}
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
              <div className="mb-4 grid grid-cols-2 gap-2">
                {channels.map((c) => <button key={c} type="button" onClick={() => setSelectedChannel(c)}
                  className={`border-2 border-[#121212] px-3 py-2 text-sm font-bold ${selectedChannel === c ? 'bg-[#176B57] text-white' : 'bg-white'}`}>{c}</button>)}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApproveTarget(null)} className="bauhaus-btn bg-white px-4 py-2 text-sm">取消</button>
              <button type="button" onClick={confirmApprove} className="bauhaus-btn bg-[#176B57] px-4 py-2 text-sm text-white"><Check size={15} />确认同意</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
