import React, { useState } from 'react';
import { Edit2, X, BookOpen, Sparkles } from 'lucide-react';
import { GAME_PLATFORMS, type Campaign } from '../types';
import { CalendarPicker } from './CalendarPicker';
import { MARKDOWN_SUPPORT_HINT } from './PublishModal';
import { locationLabel } from '../utils/location';

interface Props {
  campaign: Campaign;
  rules: string[];
  popularCustomTags?: string[];
  onSave: (campaign: Campaign) => Promise<boolean>;
  onClose: () => void;
}

// 主界面直接编辑团内容（站长/管理员审核违规团时使用），字段与团务管理里的编辑一致。
export const CampaignEditModal: React.FC<Props> = ({ campaign, rules, popularCustomTags = [], onSave, onClose }) => {
  const [draft, setDraft] = useState<Campaign>(() => ({
    ...campaign,
    sessionType: campaign.sessionType || (campaign.kind === 'promo' ? '群扩招' : '语音'),
    platforms: campaign.platforms || [],
    presetTags: campaign.presetTags || [],
    customTags: campaign.customTags || [],
  }));
  const [showRuleDropdown, setShowRuleDropdown] = useState(false);
  const [showCustomTagDropdown, setShowCustomTagDropdown] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [saving, setSaving] = useState(false);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.title.trim() || !draft.rule.trim() || !draft.timeSchedule.trim()) return;
    setSaving(true);
    try {
      if (await onSave(draft)) onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 p-4 flex items-center justify-center overflow-y-auto">
      <form onSubmit={save} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3"><h2 className="text-lg font-black flex items-center gap-2"><Edit2 className="w-4 h-4 text-[#004E98]" />编辑团内容</h2><button type="button" onClick={onClose} aria-label="关闭"><X className="w-5 h-5" /></button></div>
        {draft.batchId ? <>
          <p className="text-xs font-bold">{draft.title}</p>
          <p className="text-xs text-[#666]">保存后，简介和标签会同步到该主团的所有时段。</p>
          <label className="block text-xs font-bold">详细介绍<textarea className="bauhaus-input mt-1 w-full p-2 min-h-40" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={MARKDOWN_SUPPORT_HINT} /></label>
        </> : <>
        <label className="block text-xs font-bold">团名<input required className="bauhaus-input mt-1 w-full p-2" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>

        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_3.5rem_minmax(0,1fr)_minmax(0,1.1fr)] gap-3">
          <div className="relative">
            <label className="block text-xs font-bold mb-1">规则系统</label>
            <div className="relative">
              <input required className="bauhaus-input w-full p-2 pr-7 text-xs" value={draft.rule} onChange={(e) => setDraft({ ...draft, rule: e.target.value })} placeholder="输入或点击选择" />
              <button type="button" onClick={() => setShowRuleDropdown(!showRuleDropdown)} className="absolute right-1.5 top-2 text-[#004E98] hover:text-[#D62828]"><BookOpen className="w-4 h-4" /></button>
            </div>
            {showRuleDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] p-2 z-30 max-h-48 overflow-y-auto">
                <div className="flex justify-between items-center text-[10px] font-bold text-[#666] mb-1"><span>历史规则</span><button type="button" onClick={() => setShowRuleDropdown(false)}><X className="w-3 h-3" /></button></div>
                <div className="flex flex-wrap gap-1">
                  {rules.map((r) => (
                    <button key={r} type="button" onClick={() => { setDraft({ ...draft, rule: r }); setShowRuleDropdown(false); }} className="text-[11px] px-1.5 py-0.5 border border-[#121212] bg-[#FAF9F5] hover:bg-[#004E98] hover:text-white">
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {draft.kind !== 'promo' && <div>
            <label className="block text-xs font-bold mb-1">人数</label>
            <input type="number" min={1} max={12} required className="bauhaus-input w-full px-1 py-2 text-xs" value={draft.maxPlayers} onChange={(e) => setDraft({ ...draft, maxPlayers: Number(e.target.value) })} />
          </div>}

          {draft.kind === 'offline' ? <label className="block text-xs font-bold sm:col-span-2">省份 / 城市<input required maxLength={8} className="bauhaus-input mt-1 w-full p-2" value={`${draft.province || ''}${draft.city || ''}`} onChange={(e) => setDraft({ ...draft, province: '', city: Array.from(e.target.value).slice(0, 8).join('') })} placeholder="最多八字" /></label> : <>
            <div><label className="block text-xs font-bold mb-1">{draft.kind === 'promo' ? '宣群方式' : '游戏类型'}</label>{draft.kind === 'promo' ? <><select className="bauhaus-input w-full p-2 text-xs" value={['群扩招', '展会', '激励活动', '西征'].includes(draft.sessionType || '') ? draft.sessionType : '自填'} onChange={(e) => setDraft({ ...draft, sessionType: e.target.value === '自填' ? '' : e.target.value })}><option>群扩招</option><option>展会</option><option>激励活动</option><option>西征</option><option>自填</option></select>{!['群扩招', '展会', '激励活动', '西征'].includes(draft.sessionType || '') && <input required maxLength={40} className="bauhaus-input mt-1 w-full p-2 text-xs" value={draft.sessionType || ''} onChange={(e) => setDraft({ ...draft, sessionType: e.target.value })} placeholder="自填方式" />}</> : <select className="bauhaus-input w-full p-2 text-xs" value={draft.sessionType || '语音'} onChange={(e) => setDraft({ ...draft, sessionType: e.target.value })}><option>语音</option><option>文字</option><option>其他游戏形式</option></select>}</div>
            <div><label className="block text-xs font-bold mb-1">{draft.kind === 'promo' ? '平台' : '游戏平台'}</label>{draft.kind === 'promo' ? <input required maxLength={80} className="bauhaus-input w-full p-2 text-xs" value={draft.platforms?.[0] || ''} onChange={(e) => setDraft({ ...draft, platforms: e.target.value ? [e.target.value] : [] })} /> : <details className="relative group"><summary className="bauhaus-input w-full p-2 text-xs cursor-pointer">{draft.platforms?.length ? `已选 ${draft.platforms.length} 个` : '选择平台'}</summary><div className="absolute right-0 top-full mt-1 w-40 bg-[#FAF9F5] border-2 border-[#121212] shadow-[3px_3px_0px_#121212] p-2 z-30 space-y-1">{GAME_PLATFORMS.map((platform) => <label key={platform} className="flex items-center gap-2 px-1 py-1 text-xs font-bold"><input type="checkbox" checked={draft.platforms?.includes(platform) || false} onChange={() => { const current = draft.platforms || []; setDraft({ ...draft, platforms: current.includes(platform) ? current.filter((item) => item !== platform) : current.length >= 3 ? current : [...current, platform] }); }} />{platform}</label>)}{(draft.platforms?.length || 0) >= 3 && <p className="px-1 text-[10px] font-bold text-[#D62828]">最多选择 3 个平台</p>}</div></details>}</div>
          </>}
        </div>
        {draft.kind === 'offline' && <label className="block text-xs font-bold">完整地址<input maxLength={200} className="bauhaus-input mt-1 w-full p-2" value={draft.address || ''} onChange={(e) => setDraft({ ...draft, address: e.target.value })} placeholder="填写活动的详细地址" /></label>}

        <div>
          <div className="relative">
            <div className="flex justify-between text-xs font-bold mb-1"><span>自定义标签 (最多6个，每个最多6字)</span><span className="text-[#666]">{draft.customTags?.length || 0}/6</span></div>
            <div className="relative">
              <input value={customTagInput} onChange={(e) => setCustomTagInput(e.target.value)} onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const t = customTagInput.trim();
                  if (!t) return;
                  if (Array.from(t).length > 6) { alert('自定义标签最多 6 个字'); return; }
                  if ((draft.customTags || []).length >= 6 || (draft.customTags || []).includes(t)) return;
                  setDraft({ ...draft, customTags: [...(draft.customTags || []), t] });
                  setCustomTagInput('');
                }
              }} disabled={(draft.customTags?.length || 0) >= 6} placeholder="输入回车添加 (限6字)" className="bauhaus-input w-full p-2 pr-7 text-xs disabled:bg-[#F2F0E8]" />
              <button type="button" onClick={() => setShowCustomTagDropdown(!showCustomTagDropdown)} className="absolute right-1.5 top-2 text-[#004E98] hover:text-[#D62828]"><Sparkles className="w-4 h-4" /></button>
            </div>
            {showCustomTagDropdown && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] p-2 z-30 max-h-48 overflow-y-auto">
                <div className="flex justify-between items-center text-[10px] font-bold text-[#666] mb-1"><span>热门标签</span><button type="button" onClick={() => setShowCustomTagDropdown(false)}><X className="w-3 h-3" /></button></div>
                <div className="flex flex-wrap gap-1">
                  {popularCustomTags.map((tag) => (
                    <button key={tag} type="button" onClick={() => {
                      const cur = draft.customTags || [];
                      if (cur.includes(tag) || cur.length >= 6) return;
                      setDraft({ ...draft, customTags: [...cur, tag] });
                    }} className="text-[11px] px-1.5 py-0.5 border border-[#121212] bg-[#FAF9F5] text-[#D62828] hover:bg-[#D62828] hover:text-white">
                      #{tag}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1 mt-1.5">
              {draft.customTags?.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 bg-[#FFF9F9] border border-[#121212] text-[#D62828]">
                  #{tag}
                  <button type="button" onClick={() => setDraft({ ...draft, customTags: draft.customTags?.filter(t => t !== tag) })}><X className="w-3 h-3 text-[#121212]" /></button>
                </span>
              ))}
            </div>
          </div>
        </div>

        <CalendarPicker value={draft.timeSchedule} onChange={(value) => setDraft({ ...draft, timeSchedule: value })} maxDaysAhead={draft.kind === 'online' ? 31 : null} />
        <label className="block text-xs font-bold">联系方式<input required className="bauhaus-input mt-1 w-full p-2" value={draft.contact || ''} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder="默认填入你的 QQ 号" /></label>
        <label className="block text-xs font-bold">详细介绍<textarea className="bauhaus-input mt-1 w-full p-2 min-h-32" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={MARKDOWN_SUPPORT_HINT} /></label>
        <p className="text-[11px] text-[#666]">{draft.kind === 'offline' ? `面团 · ${locationLabel(draft)} · ` : ''}开团时间：{draft.timeSchedule}（可在日历中改期）</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="bauhaus-btn bg-white px-4 py-2 text-xs">取消</button><button disabled={saving} className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-xs disabled:opacity-50">{saving ? '保存中…' : '保存修改'}</button></div>
        </>}
      </form>
    </div>
  );
};
