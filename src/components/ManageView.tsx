import React, { useState } from 'react';
import { Edit2, Eye, LogOut, Trash2, X, BookOpen, Sparkles, ChevronDown, Plus } from 'lucide-react';
import { GAME_PLATFORMS, type Campaign } from '../types';
import { CalendarPicker } from './CalendarPicker';
import { formatDisplayTime } from '../utils/date';
import { MARKDOWN_SUPPORT_HINT } from './PublishModal';
import { useDialog } from './BauhausDialog';
import { locationLabel } from '../utils/location';
import { AccountSideActions } from './AccountSideActions';

interface Props {
  hostedCampaigns: Campaign[];
  joinedCampaigns: Campaign[];
  rules: string[];
  popularCustomTags?: string[];
  onDeleteCampaign: (id: string) => void;
  onSetCampaignClosed: (id: string, closed: boolean) => void;
  onFinishCampaign: (id: string) => void;
  onAddBatchSlot: (batchId: string, timeSchedule: string) => Promise<boolean>;
  onCancelSignup: (id: string) => void;
  onSelectCampaign: (campaign: Campaign) => void;
  onUpdateCampaign: (campaign: Campaign) => Promise<boolean>;
  onOpenProfile: () => void;
  onFeedback: () => void;
  onReport: () => void;
}

const stateLabel = (campaign: Campaign) => campaign.kind === 'promo' ? (campaign.isClosed || campaign.hasExpired ? '已封车' : '展示中') : campaign.hasEnded ? '已结团' : campaign.hasExpired ? '已到期锁车' : campaign.isClosed ? '已锁车' : campaign.isFull ? '已满员' : '招募中';

export const ManageView: React.FC<Props> = ({
  hostedCampaigns,
  joinedCampaigns,
  rules,
  popularCustomTags = [],
  onDeleteCampaign,
  onSetCampaignClosed,
  onFinishCampaign,
  onAddBatchSlot,
  onCancelSignup,
  onSelectCampaign,
  onUpdateCampaign,
  onOpenProfile,
  onFeedback,
  onReport,
}) => {
  const { showConfirm } = useDialog();
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);
  const [showRuleDropdown, setShowRuleDropdown] = useState(false);
  const [showCustomTagDropdown, setShowCustomTagDropdown] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [addingBatchId, setAddingBatchId] = useState<string | null>(null);
  const [newTimeSchedule, setNewTimeSchedule] = useState('');
  const [addingSlot, setAddingSlot] = useState(false);

  const handleDelete = async (campaign: Campaign) => {
    const ok = await showConfirm({
      title: '弃团',
      message: `确定弃团《${campaign.title}》吗？团、成员记录和相关点赞将被删除，此操作无法撤销。`,
      confirmText: '确定弃团',
      type: 'danger',
    });
    if (ok) onDeleteCampaign(campaign.id);
  };

  const handleCancel = async (campaign: Campaign) => {
    const ok = await showConfirm({
      title: '取消报名',
      message: `确定取消报名战役《${campaign.title}》吗？`,
      confirmText: '确定取消',
      type: 'warning',
    });
    if (ok) onCancelSignup(campaign.id);
  };
  const handleClosure = async (campaign: Campaign) => {
    const closed = !campaign.isClosed;
    if (campaign.kind === 'promo') {
      if (await showConfirm({ title: '封车', message: `确定封车「${campaign.title}」吗？封车后将从公开宣群列表隐藏，不能重新开放。`, confirmText: '确定封车', type: 'warning' })) onSetCampaignClosed(campaign.id, true);
      return;
    }
    const ok = await showConfirm({ title: closed ? '锁车' : '重新开放报名', message: `确定${closed ? '锁车' : '重新开放'}「${campaign.title}」在 ${formatDisplayTime(campaign.timeSchedule)} 的报名吗？${closed ? '锁车后玩家不能取消报名。' : ''}`, confirmText: closed ? '确定锁车' : '重新开放', type: closed ? 'warning' : 'info' });
    if (ok) onSetCampaignClosed(campaign.id, closed);
  };
  const handleFinish = async (campaign: Campaign) => {
    const ok = await showConfirm({ title: '结团', message: `确定将《${campaign.title}》标记为结团吗？结团后进入所有成员的个人档案，可在成员名单点赞，且无法再修改或开放报名。`, confirmText: '确定结团', type: 'warning' });
    if (ok) onFinishCampaign(campaign.id);
  };

  const addSlot = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!addingBatchId || !newTimeSchedule || addingSlot) return;
    setAddingSlot(true);
    try {
      if (await onAddBatchSlot(addingBatchId, newTimeSchedule)) {
        setAddingBatchId(null);
        setNewTimeSchedule('');
      }
    } finally { setAddingSlot(false); }
  };

  const campaignCard = (campaign: Campaign, hosted: boolean) => (
        <article key={campaign.id} className="border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0px_#121212]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <strong className="text-sm truncate">{campaign.title}</strong>
                <span className="text-[10px] font-black px-1.5 py-0.5 border border-[#121212] bg-[#F4A261]">
                  {stateLabel(campaign)}
                </span>
                <span className="text-[10px] font-bold px-1.5 py-0.5 border border-[#121212] bg-[#F0F5FA] text-[#004E98]">
                  {campaign.kind === 'offline' ? locationLabel(campaign) : campaign.sessionType || '语音'}
                </span>
              </div>
              <p className="mt-1 text-xs text-[#666]">{campaign.rule} · {formatDisplayTime(campaign.timeSchedule)}</p>
              {campaign.kind !== 'offline' && !!campaign.platforms?.length && <p className="mt-1 text-xs text-[#004E98] font-bold">{campaign.kind === 'promo' ? '平台' : '游戏平台'}：{campaign.platforms.join('、')}</p>}
              <div className="mt-1 flex flex-wrap gap-1">
                {campaign.customTags?.map((tag) => (
                  <span key={tag} className="text-[10px] font-bold px-1.5 py-0.2 bg-[#FFF9F9] border border-[#E5B5B5] text-[#D62828]">
                    #{tag}
                  </span>
                ))}
              </div>
              {campaign.kind !== 'promo' && <p className="mt-1 text-xs font-bold">玩家 {campaign.currentPlayers}/{campaign.maxPlayers}</p>}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#D8D5CC] flex flex-wrap gap-2">
            <button onClick={() => onSelectCampaign(campaign)} className="bauhaus-btn bg-[#004E98] text-white px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" />查看</button>
            {hosted ? <>
              {!campaign.batchId && !campaign.hasEnded && <button onClick={() => { setEditingCampaign({ ...campaign, sessionType: campaign.sessionType || (campaign.kind === 'promo' ? '群扩招' : '语音'), platforms: campaign.platforms || [], presetTags: campaign.presetTags || [], customTags: campaign.customTags || [] }); setCustomTagInput(''); }} className="bauhaus-btn bg-white px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Edit2 className="w-3.5 h-3.5" />修改</button>}
              {!campaign.hasEnded && !campaign.hasExpired && (campaign.kind !== 'promo' || !campaign.isClosed) && <button onClick={() => handleClosure(campaign)} className="bauhaus-btn bg-white px-3 py-1.5 text-xs font-bold">{campaign.kind === 'promo' ? '封车' : campaign.isClosed ? '重新开放' : '锁车'}</button>}
              {!campaign.hasEnded && campaign.kind !== 'promo' && <button onClick={() => handleFinish(campaign)} className="bauhaus-btn bg-[#004E98] text-white px-3 py-1.5 text-xs font-bold">结团</button>}
              {campaign.kind !== 'promo' && <button onClick={() => handleDelete(campaign)} className="bauhaus-btn bg-[#FAF0F0] text-[#D62828] border-[#D62828] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />弃团</button>}
            </> : campaign.kind !== 'promo' && !campaign.hasExpired && !campaign.hasEnded && !campaign.isClosed && <button onClick={() => handleCancel(campaign)} className="bauhaus-btn bg-white text-[#D62828] border-[#D62828] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><LogOut className="w-3.5 h-3.5" />取消报名</button>}
          </div>
        </article>
  );

  const hostedGroups = new Map<string, Campaign[]>();
  hostedCampaigns.forEach((campaign) => {
    const key = campaign.batchId || campaign.id;
    hostedGroups.set(key, [...(hostedGroups.get(key) || []), campaign]);
  });
  const visibleHostedGroups = [...hostedGroups.entries()].sort((a, b) => ({ online: 0, offline: 1, promo: 2 }[a[1][0].kind] - { online: 0, offline: 1, promo: 2 }[b[1][0].kind]));
  const hostedList = visibleHostedGroups.length ? <div className="space-y-3">{visibleHostedGroups.map(([key, items], index) => <React.Fragment key={key}>
    {(index === 0 || visibleHostedGroups[index - 1][1][0].kind !== items[0].kind) && <h3 className="text-xs font-black border-b border-[#121212] pb-1 pt-2">{items[0].kind === 'online' ? '网团' : items[0].kind === 'offline' ? '面团' : '宣群'}</h3>}
    {(() => {
    if (!items[0].batchId) return campaignCard(items[0], true);
    const master = items[0].batchMaster || items.find((item) => item.id === key) || items[0];
    return <details key={key} className="border-2 border-[#121212] bg-white shadow-[3px_3px_0px_#121212] group">
      <summary className="flex items-center justify-between gap-3 p-4 cursor-pointer list-none font-black">
        <span className="min-w-0 block truncate">{master.title}</span>
        <ChevronDown className="w-5 h-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t-2 border-[#121212] p-4 space-y-3 bg-[#FAF9F5]">
        {master.imageUrl && <img src={master.imageUrl} alt="主团封面" className="w-full max-h-40 object-cover border border-[#121212]" />}
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setAddingBatchId(key); setNewTimeSchedule(''); }} className="bauhaus-btn bg-[#004E98] text-white px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" />添加时间点</button>
          <button type="button" onClick={() => { setEditingCampaign({ ...items[0], description: master.description, presetTags: master.presetTags || [], customTags: master.customTags || [] }); setCustomTagInput(''); }} className="bauhaus-btn bg-white px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Edit2 className="w-3.5 h-3.5" />修改</button>
        </div>
        <div className="space-y-3">{items.sort((a, b) => a.timeSchedule.localeCompare(b.timeSchedule)).map((item) => campaignCard(item, true))}</div>
      </div>
    </details>;
    })()}
  </React.Fragment>)}</div> : <div className="py-10 text-center text-xs text-[#888]">暂无记录</div>;
  const joinedList = joinedCampaigns.length ? <div className="space-y-3">{joinedCampaigns.map((campaign) => campaignCard(campaign, false))}</div> : <div className="py-10 text-center text-xs text-[#888]">暂无记录</div>;

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCampaign?.title.trim() || !editingCampaign?.rule.trim() || !editingCampaign?.timeSchedule.trim()) return;
    if (await onUpdateCampaign(editingCampaign)) setEditingCampaign(null);
  };

  return <div className="flex flex-col lg:flex-row gap-6 items-start">
    <AccountSideActions destination="profile" onNavigate={onOpenProfile} onFeedback={onFeedback} onReport={onReport} />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start min-w-0 w-full">
    <section className="bauhaus-card bg-[#FAF0F0] p-5"><h2 className="text-lg font-black border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2"><span className="w-3 h-3 bg-[#D62828]" />我发布的内容 ({visibleHostedGroups.length})</h2>{hostedList}</section>
    <section className="bauhaus-card bg-[#F0F5FA] p-5"><h2 className="text-lg font-black border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2"><span className="w-3 h-3 bg-[#004E98]" />我报名的团 ({joinedCampaigns.length})</h2>{joinedList}</section>

    {addingBatchId && <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center overflow-y-auto">
      <form onSubmit={addSlot} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3"><h2 className="text-lg font-black">添加团副本</h2><button type="button" onClick={() => setAddingBatchId(null)} aria-label="关闭"><X className="w-5 h-5" /></button></div>
        <p className="text-xs text-[#555]">选择一个尚未使用的时段。新团会复制主团当前的信息；修改主团简介和标签会同步到所有时段。</p>
        <CalendarPicker value={newTimeSchedule} onChange={setNewTimeSchedule} maxDaysAhead={hostedGroups.get(addingBatchId)?.[0]?.kind === 'online' ? 31 : null} />
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setAddingBatchId(null)} className="bauhaus-btn bg-white px-4 py-2 text-xs">取消</button><button type="submit" disabled={!newTimeSchedule || addingSlot} className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-xs disabled:opacity-40">{addingSlot ? '添加中…' : '添加时间点'}</button></div>
      </form>
    </div>}

    {editingCampaign && <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center overflow-y-auto">
      <form onSubmit={save} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3"><h2 className="text-lg font-black">修改战役</h2><button type="button" onClick={() => setEditingCampaign(null)} aria-label="关闭"><X className="w-5 h-5" /></button></div>
        {editingCampaign.batchId ? <>
          <p className="text-xs font-bold">{editingCampaign.title}</p>
          <p className="text-xs text-[#666]">保存后，简介和标签会同步到所有时段，也会用于之后新增的时段。</p>
          <label className="block text-xs font-bold">详细介绍<textarea className="bauhaus-input mt-1 w-full p-2 min-h-40" value={editingCampaign.description} onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })} placeholder={MARKDOWN_SUPPORT_HINT} /></label>
          <label className="block text-xs font-bold">自定义标签（最多 6 个，每个最多 6 字）<input maxLength={6} value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value)} className="bauhaus-input mt-1 w-full p-2" placeholder="输入标签后点击添加" /></label>
          <button type="button" onClick={() => { const tag = customTagInput.trim(); if (tag && (editingCampaign.customTags?.length || 0) < 6 && !editingCampaign.customTags?.includes(tag)) { setEditingCampaign({ ...editingCampaign, customTags: [...(editingCampaign.customTags || []), tag] }); setCustomTagInput(''); } }} className="bauhaus-btn bg-white px-3 py-1 text-xs">添加标签</button>
          <div className="flex flex-wrap gap-1">{editingCampaign.customTags?.map((tag) => <button type="button" key={tag} onClick={() => setEditingCampaign({ ...editingCampaign, customTags: editingCampaign.customTags?.filter((item) => item !== tag) })} className="border px-2 py-1 text-xs">#{tag} ×</button>)}</div>
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingCampaign(null)} className="bauhaus-btn bg-white px-4 py-2 text-xs">取消</button><button className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-xs">保存修改</button></div>
        </> : <>
        <label className="block text-xs font-bold">团名<input required className="bauhaus-input mt-1 w-full p-2" value={editingCampaign.title} onChange={(e) => setEditingCampaign({ ...editingCampaign, title: e.target.value })} /></label>
        
        {/* Rule, players, game type, and platforms */}
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_3.5rem_minmax(0,1fr)_minmax(0,1.1fr)] gap-3">
          <div className="relative">
            <label className="block text-xs font-bold mb-1">规则系统</label>
            <div className="relative">
              <input required className="bauhaus-input w-full p-2 pr-7 text-xs" value={editingCampaign.rule} onChange={(e) => setEditingCampaign({ ...editingCampaign, rule: e.target.value })} placeholder="输入或点击选择" />
              <button type="button" onClick={() => setShowRuleDropdown(!showRuleDropdown)} className="absolute right-1.5 top-2 text-[#004E98] hover:text-[#D62828]"><BookOpen className="w-4 h-4" /></button>
            </div>
            {showRuleDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] p-2 z-30 max-h-48 overflow-y-auto">
                <div className="flex justify-between items-center text-[10px] font-bold text-[#666] mb-1"><span>历史规则</span><button type="button" onClick={() => setShowRuleDropdown(false)}><X className="w-3 h-3" /></button></div>
                <div className="flex flex-wrap gap-1">
                  {rules.map((r) => (
                    <button key={r} type="button" onClick={() => { setEditingCampaign({ ...editingCampaign, rule: r }); setShowRuleDropdown(false); }} className="text-[11px] px-1.5 py-0.5 border border-[#121212] bg-[#FAF9F5] hover:bg-[#004E98] hover:text-white">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {editingCampaign.kind !== 'promo' && <div>
            <label className="block text-xs font-bold mb-1">人数</label>
            <input type="number" min={1} max={12} required className="bauhaus-input w-full px-1 py-2 text-xs" value={editingCampaign.maxPlayers} onChange={(e) => setEditingCampaign({ ...editingCampaign, maxPlayers: Number(e.target.value) })} />
          </div>}

          {editingCampaign.kind === 'offline' ? <label className="block text-xs font-bold sm:col-span-2">省份 / 城市<input required maxLength={8} className="bauhaus-input mt-1 w-full p-2" value={`${editingCampaign.province || ''}${editingCampaign.city || ''}`} onChange={(e) => setEditingCampaign({ ...editingCampaign, province: '', city: Array.from(e.target.value).slice(0, 8).join('') })} placeholder="最多八字" /></label> : <>
            <div><label className="block text-xs font-bold mb-1">{editingCampaign.kind === 'promo' ? '宣群方式' : '游戏类型'}</label>{editingCampaign.kind === 'promo' ? <><select className="bauhaus-input w-full p-2 text-xs" value={['群扩招', '展会', '激励活动', '西征'].includes(editingCampaign.sessionType || '') ? editingCampaign.sessionType : '自填'} onChange={(e) => setEditingCampaign({ ...editingCampaign, sessionType: e.target.value === '自填' ? '' : e.target.value })}><option>群扩招</option><option>展会</option><option>激励活动</option><option>西征</option><option>自填</option></select>{!['群扩招', '展会', '激励活动', '西征'].includes(editingCampaign.sessionType || '') && <input required maxLength={40} className="bauhaus-input mt-1 w-full p-2 text-xs" value={editingCampaign.sessionType || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, sessionType: e.target.value })} placeholder="自填方式" />}</> : <select className="bauhaus-input w-full p-2 text-xs" value={editingCampaign.sessionType || '语音'} onChange={(e) => setEditingCampaign({ ...editingCampaign, sessionType: e.target.value })}><option>语音</option><option>文字</option><option>其他游戏形式</option></select>}</div>
            <div><label className="block text-xs font-bold mb-1">{editingCampaign.kind === 'promo' ? '平台' : '游戏平台'}</label>{editingCampaign.kind === 'promo' ? <input required maxLength={80} className="bauhaus-input w-full p-2 text-xs" value={editingCampaign.platforms?.[0] || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, platforms: e.target.value ? [e.target.value] : [] })} /> : <details className="relative group"><summary className="bauhaus-input w-full p-2 text-xs cursor-pointer">{editingCampaign.platforms?.length ? `已选 ${editingCampaign.platforms.length} 个` : '选择平台'}</summary><div className="absolute right-0 top-full mt-1 w-40 bg-[#FAF9F5] border-2 border-[#121212] shadow-[3px_3px_0px_#121212] p-2 z-30 space-y-1">{GAME_PLATFORMS.map((platform) => <label key={platform} className="flex items-center gap-2 px-1 py-1 text-xs font-bold"><input type="checkbox" checked={editingCampaign.platforms?.includes(platform) || false} onChange={() => { const current = editingCampaign.platforms || []; setEditingCampaign({ ...editingCampaign, platforms: current.includes(platform) ? current.filter((item) => item !== platform) : current.length >= 3 ? current : [...current, platform] }); }} />{platform}</label>)}{(editingCampaign.platforms?.length || 0) >= 3 && <p className="px-1 text-[10px] font-bold text-[#D62828]">最多选择 3 个平台</p>}</div></details>}</div>
          </>}
        </div>
        {editingCampaign.kind === 'offline' && <label className="block text-xs font-bold">完整地址<input maxLength={200} className="bauhaus-input mt-1 w-full p-2" value={editingCampaign.address || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, address: e.target.value })} placeholder="填写活动的详细地址" /></label>}

        <div>
          <div className="relative">
            <div className="flex justify-between text-xs font-bold mb-1"><span>自定义标签 (最多6个，每个最多6字)</span><span className="text-[#666]">{editingCampaign.customTags?.length || 0}/6</span></div>
            <div className="relative">
              <input maxLength={6} value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value.slice(0, 6))} onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = customTagInput.trim();
                  if (!t || (editingCampaign.customTags || []).length >= 6 || (editingCampaign.customTags || []).includes(t)) return;
                  setEditingCampaign({ ...editingCampaign, customTags: [...(editingCampaign.customTags || []), t] });
                  setCustomTagInput('');
                }
              }} disabled={(editingCampaign.customTags?.length || 0) >= 6} placeholder="回车添加标签" className="bauhaus-input w-full p-2 pr-7 text-xs disabled:bg-[#F2F0E8]" />
              <button type="button" onClick={() => setShowCustomTagDropdown(!showCustomTagDropdown)} className="absolute right-1.5 top-2 text-[#004E98] hover:text-[#D62828]"><Sparkles className="w-4 h-4" /></button>
            </div>
            {showCustomTagDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] p-2 z-30 max-h-48 overflow-y-auto">
                <div className="flex justify-between items-center text-[10px] font-bold text-[#666] mb-1"><span>热门标签</span><button type="button" onClick={() => setShowCustomTagDropdown(false)}><X className="w-3 h-3" /></button></div>
                <div className="flex flex-wrap gap-1">
                  {popularCustomTags.map((tag) => (
                    <button key={tag} type="button" onClick={() => {
                      const cur = editingCampaign.customTags || [];
                      if (cur.includes(tag) || cur.length >= 6) return;
                      setEditingCampaign({ ...editingCampaign, customTags: [...cur, tag] });
                    }} className="text-[11px] px-1.5 py-0.5 border border-[#121212] bg-[#FAF9F5] text-[#D62828] hover:bg-[#D62828] hover:text-white">
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {editingCampaign.customTags?.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-[#FFF9F9] border border-[#121212] text-[#D62828]">
                  #{tag}
                  <button type="button" onClick={() => setEditingCampaign({ ...editingCampaign, customTags: editingCampaign.customTags?.filter(t => t !== tag) })}><X className="w-3 h-3 text-[#121212]" /></button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <CalendarPicker value={editingCampaign.timeSchedule} onChange={(value) => setEditingCampaign({ ...editingCampaign, timeSchedule: value })} maxDaysAhead={editingCampaign.kind === 'online' ? 31 : null} />
        <label className="block text-xs font-bold">联系方式<input required className="bauhaus-input mt-1 w-full p-2" value={editingCampaign.contact || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, contact: e.target.value })} placeholder="默认填入你的 QQ 号" /></label>
        <label className="block text-xs font-bold">详细介绍<textarea className="bauhaus-input mt-1 w-full p-2 min-h-32" value={editingCampaign.description} onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })} placeholder={MARKDOWN_SUPPORT_HINT} /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingCampaign(null)} className="bauhaus-btn bg-white px-4 py-2 text-xs">取消</button><button className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-xs">保存修改</button></div>
        </>}
      </form>
    </div>}
    </div>
  </div>;
};
