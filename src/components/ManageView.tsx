import React, { useState } from 'react';
import { Edit2, Eye, LogOut, Trash2, X } from 'lucide-react';
import type { Campaign } from '../types';
import { CalendarPicker } from './CalendarPicker';
import { formatDisplayTime } from '../utils/date';
import { MARKDOWN_SUPPORT_HINT } from './PublishModal';

interface Props {
  hostedCampaigns: Campaign[];
  joinedCampaigns: Campaign[];
  rules: string[];
  onDeleteCampaign: (id: string) => void;
  onCancelSignup: (id: string) => void;
  onSelectCampaign: (campaign: Campaign) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
}

const stateLabel = (campaign: Campaign) => campaign.hasEnded ? '已到期' : campaign.isFull ? '已满员' : '招募中';

export const ManageView: React.FC<Props> = ({ hostedCampaigns, joinedCampaigns, rules, onDeleteCampaign, onCancelSignup, onSelectCampaign, onUpdateCampaign }) => {
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const list = (campaigns: Campaign[], hosted: boolean) => campaigns.length ? (
    <div className="space-y-3">
      {campaigns.map((campaign) => (
        <article key={campaign.id} className="border-2 border-[#121212] bg-white p-4 shadow-[3px_3px_0px_#121212]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><strong className="text-sm truncate">{campaign.title}</strong><span className="text-[10px] font-black px-1.5 py-0.5 border border-[#121212] bg-[#F4A261]">{stateLabel(campaign)}</span></div>
              <p className="mt-1 text-xs text-[#666]">{campaign.rule} · {formatDisplayTime(campaign.timeSchedule)}</p>
              <p className="mt-1 text-xs font-bold">玩家 {campaign.currentPlayers}/{campaign.maxPlayers}</p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-[#D8D5CC] flex flex-wrap gap-2">
            <button onClick={() => onSelectCampaign(campaign)} className="bauhaus-btn bg-[#004E98] text-white px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" />查看</button>
            {hosted ? <>
              <button onClick={() => setEditingCampaign({ ...campaign })} className="bauhaus-btn bg-white px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Edit2 className="w-3.5 h-3.5" />修改</button>
              <button onClick={() => confirm(`确定删除战役《${campaign.title}》吗？`) && onDeleteCampaign(campaign.id)} className="bauhaus-btn bg-[#FAF0F0] text-[#D62828] border-[#D62828] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><Trash2 className="w-3.5 h-3.5" />删除</button>
            </> : !campaign.hasEnded && <button onClick={() => onCancelSignup(campaign.id)} className="bauhaus-btn bg-white text-[#D62828] border-[#D62828] px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1"><LogOut className="w-3.5 h-3.5" />取消报名</button>}
          </div>
        </article>
      ))}
    </div>
  ) : <div className="py-10 text-center text-xs text-[#888]">暂无记录</div>;

  const save = (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingCampaign?.timeSchedule.trim()) return;
    onUpdateCampaign(editingCampaign);
    setEditingCampaign(null);
  };

  return <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
    <section className="bauhaus-card bg-[#FAF0F0] p-5"><h2 className="text-lg font-black border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2"><span className="w-3 h-3 bg-[#D62828]" />我主持的团 ({hostedCampaigns.length})</h2>{list(hostedCampaigns, true)}</section>
    <section className="bauhaus-card bg-[#F0F5FA] p-5"><h2 className="text-lg font-black border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2"><span className="w-3 h-3 bg-[#004E98]" />我报名的团 ({joinedCampaigns.length})</h2>{list(joinedCampaigns, false)}</section>

    {editingCampaign && <div className="fixed inset-0 z-50 bg-black/60 p-4 flex items-center justify-center overflow-y-auto">
      <form onSubmit={save} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3"><h2 className="text-lg font-black">修改战役</h2><button type="button" onClick={() => setEditingCampaign(null)} aria-label="关闭"><X className="w-5 h-5" /></button></div>
        <label className="block text-xs font-bold">团名<input required className="bauhaus-input mt-1 w-full p-2" value={editingCampaign.title} onChange={(e) => setEditingCampaign({ ...editingCampaign, title: e.target.value })} /></label>
        <label className="block text-xs font-bold">规则<select className="bauhaus-input mt-1 w-full p-2" value={editingCampaign.rule} onChange={(e) => setEditingCampaign({ ...editingCampaign, rule: e.target.value })}>{rules.map((rule) => <option key={rule}>{rule}</option>)}</select></label>
        <CalendarPicker value={editingCampaign.timeSchedule} onChange={(value) => setEditingCampaign({ ...editingCampaign, timeSchedule: value })} />
        <label className="block text-xs font-bold">预计玩家人数<input type="number" min={1} max={12} required className="bauhaus-input mt-1 w-full p-2" value={editingCampaign.maxPlayers} onChange={(e) => setEditingCampaign({ ...editingCampaign, maxPlayers: Number(e.target.value) })} /></label>
        <label className="block text-xs font-bold">联系方式<input required className="bauhaus-input mt-1 w-full p-2" value={editingCampaign.contact || ''} onChange={(e) => setEditingCampaign({ ...editingCampaign, contact: e.target.value })} placeholder="默认填入你的 QQ 号" /></label>
        <label className="block text-xs font-bold">详细介绍<textarea className="bauhaus-input mt-1 w-full p-2 min-h-32" value={editingCampaign.description} onChange={(e) => setEditingCampaign({ ...editingCampaign, description: e.target.value })} placeholder={MARKDOWN_SUPPORT_HINT} /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={() => setEditingCampaign(null)} className="bauhaus-btn bg-white px-4 py-2 text-xs">取消</button><button className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-xs">保存修改</button></div>
      </form>
    </div>}
  </div>;
};
