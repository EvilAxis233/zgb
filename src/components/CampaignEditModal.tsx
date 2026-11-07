import React, { useRef, useState } from 'react';
import { Edit2, X, BookOpen, Sparkles, Upload, ImagePlus } from 'lucide-react';
import { GAME_PLATFORMS, type Campaign } from '../types';
import { CalendarPicker } from './CalendarPicker';
import { MARKDOWN_SUPPORT_HINT, BAUHAUS_COLORS } from './PublishModal';
import { buildTimeSchedule, parseTimeSchedule, TIME_PERIODS, type TimePeriod } from '../utils/date';
import { locationLabel } from '../utils/location';
import { ImageCropper } from './ImageCropper';
import { StickerPicker } from './StickerLibrary';
import { acceptedImage, isAnimatedImage, normalizeImageFile, MAX_ANIMATED_BYTES, MAX_STATIC_BYTES } from '../utils/animatedImage';
import { textWidth, clampByWidth, PROMO_PLATFORM_MAX_WIDTH } from '../utils/textLength';

interface Props {
  campaign: Campaign;
  rules: string[];
  popularCustomTags?: string[];
  stickerLibrary?: string[];
  onSave: (campaign: Campaign) => Promise<boolean>;
  onClose: () => void;
}

// 主界面直接编辑团内容（站长/管理员审核违规团时使用），字段与团务管理里的编辑一致。
export const CampaignEditModal: React.FC<Props> = ({ campaign, rules, popularCustomTags = [], stickerLibrary = [], onSave, onClose }) => {
  const [draft, setDraft] = useState<Campaign>(() => ({
    ...campaign,
    sessionType: campaign.sessionType || (campaign.kind === 'promo' ? '群扩招' : '语音'),
    platforms: campaign.platforms || [],
    presetTags: campaign.presetTags || [],
    customTags: campaign.customTags || [],
    stickerKeys: campaign.stickerKeys || [],
    summary: campaign.summary || '',
    bannerColor: campaign.bannerColor || BAUHAUS_COLORS[0].hex,
  }));
  const [showRuleDropdown, setShowRuleDropdown] = useState(false);
  const [showCustomTagDropdown, setShowCustomTagDropdown] = useState(false);
  const [customTagInput, setCustomTagInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [coverToCrop, setCoverToCrop] = useState<File | null>(null);
  const [stickerTouched, setStickerTouched] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const pickCover = async (selected: File | undefined) => {
    const file = normalizeImageFile(selected);
    if (!file) return;
    if (!acceptedImage(file)) { alert('请选择 PNG、JPG、GIF 或 WebP 图片'); return; }
    const animated = await isAnimatedImage(file);
    if (file.size > (animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES)) { alert(animated ? '动态封面不会压缩，请小于 8MB' : '原图请小于 20MB'); return; }
    if (animated) {
      // 动图原样上传，跳过 canvas 裁剪，否则只剩第一帧。
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') setDraft((previous) => ({ ...previous, imageUrl: reader.result as string })); };
      reader.readAsDataURL(file);
    } else setCoverToCrop(file);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;
    if (!draft.title.trim() || !draft.rule.trim() || !draft.timeSchedule.trim()) return;
    setSaving(true);
    try {
      // 没动贴纸就不提交这个字段，避免把「默认佩戴」固化成每个团的独立配置。
      const payload: Campaign = { ...draft };
      if (!stickerTouched) delete payload.stickerKeys;
      if (draft.batchId && draft.slots?.length) {
        payload.slotTimes = draft.slots.map((slot) => ({ id: slot.id, timeSchedule: slot.timeSchedule }));
      }
      if (await onSave(payload)) onClose();
    } finally {
      setSaving(false);
    }
  };

  // 封面：编辑时可重新上传（裁剪成 16:9）或删除，保存时统一上传到图床。
  const coverBlock = (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold">封面图</span>
        {draft.imageUrl && <button type="button" onClick={() => setDraft({ ...draft, imageUrl: '', imageKey: null })} className="text-[11px] font-bold text-[#D62828]">删除封面</button>}
      </div>
      <button type="button" onClick={() => coverInputRef.current?.click()} className="relative w-full h-24 overflow-hidden border-2 border-dashed border-[#121212] bg-white flex items-center justify-center">
        {draft.imageUrl ? (
          <>
            <img src={draft.imageUrl} alt="封面预览" className="h-full w-full object-cover" />
            <span className="absolute inset-0 flex items-center justify-center bg-black/40 text-xs font-bold text-white opacity-0 hover:opacity-100"><ImagePlus className="mr-1 h-3.5 w-3.5" />点击更换封面</span>
          </>
        ) : (
          <span className="flex flex-col items-center gap-1 text-center text-[11px] font-bold text-[#121212]">
            <Upload className="h-4 w-4 text-[#004E98]" />上传封面（自动裁剪为 16:9）
            <span className="text-[10px] font-normal text-[#888]">PNG / JPG / GIF / WebP · 动图保留动画（小于 8MB）</span>
          </span>
        )}
      </button>
      <input ref={coverInputRef} type="file" accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp" className="hidden" onChange={(event) => { pickCover(event.target.files?.[0]); event.target.value = ''; }} />
    </div>
  );

  // 贴纸：从自己的贴纸库补选，最多 2 张（不能现场上传）；全部取消等于用 GM 默认佩戴。
  // 已挂在团上、但不在当前编辑者库里的贴纸也要显示出来，避免误以为被清空。
  const pickerLibrary = [...new Set([...stickerLibrary, ...(draft.stickerKeys || [])])];
  const stickerBlock = (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-bold">本团贴纸</span>
        <span className="text-[11px] font-bold text-[#666]">{(draft.stickerKeys?.length || 0)}/2</span>
      </div>
      <StickerPicker
        library={pickerLibrary}
        value={draft.stickerKeys || []}
        onChange={(keys) => { setStickerTouched(true); setDraft({ ...draft, stickerKeys: keys }); }}
      />
      <p className="mt-1 text-[10px] font-bold text-[#666]">从贴纸库补选，最多 2 张；全部取消则沿用 GM 默认佩戴。</p>
    </div>
  );

  // 批量团：站主可逐个时段改期，新增 / 删除时段仍走团务管理的既有入口。
  const updateSlot = (slotId: string, dateStr: string, period: TimePeriod) => {
    if (!dateStr) return;
    const timeSchedule = buildTimeSchedule(dateStr, period);
    setDraft((previous) => ({
      ...previous,
      slots: (previous.slots || []).map((slot) => slot.id === slotId ? { ...slot, timeSchedule } : slot),
      ...(previous.slots?.[0]?.id === slotId ? { timeSchedule } : {}),
    }));
  };
  const slotTimesBlock = (
    <details className="border-2 border-[#121212] p-3 bg-[#FAF9F5]">
      <summary className="cursor-pointer text-xs font-bold">各时段开团时间（{draft.slots?.length || 0} 个，点开逐个改期）</summary>
      <div className="mt-3 space-y-2">
        {(draft.slots || []).map((slot, index) => {
          const parsed = parseTimeSchedule(slot.timeSchedule);
          return (
            <div key={slot.id} className="flex flex-wrap items-center gap-2">
              <span className="w-8 shrink-0 text-[11px] font-bold">#{index + 1}</span>
              <input type="date" value={parsed.dateStr || ''} aria-label={`第 ${index + 1} 个时段日期`} onChange={(e) => updateSlot(slot.id, e.target.value, parsed.period || '晚')} className="bauhaus-input px-2 py-1 text-xs" />
              <select value={parsed.period || '晚'} aria-label={`第 ${index + 1} 个时段`} onChange={(e) => updateSlot(slot.id, parsed.dateStr || '', e.target.value as TimePeriod)} className="bauhaus-input px-2 py-1 text-xs">
                {TIME_PERIODS.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}
              </select>
              <span className="text-[10px] font-bold text-[#666]">{slot.timeSchedule}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] font-bold text-[#666]">改期后保存即同步到对应时段；新增 / 删除时段仍用团务管理里的「增加时段」「弃团」。</p>
    </details>
  );

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 p-4 flex items-center justify-center overflow-y-auto">
      <form onSubmit={save} className="w-full max-w-xl max-h-[90vh] overflow-y-auto bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] p-6 space-y-4">
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3"><h2 className="text-lg font-black flex items-center gap-2"><Edit2 className="w-4 h-4 text-[#004E98]" />站主全量编辑</h2><button type="button" onClick={onClose} aria-label="关闭"><X className="w-5 h-5" /></button></div>
        {draft.batchId && <p className="border-l-4 border-[#004E98] pl-2 text-[11px] font-bold text-[#004E98]">这是批量团：标题、规则、人数、平台、封面、贴纸、联系方式等会同步到全部时段（含之后新增的时段）；各时段可单独改期。</p>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block text-xs font-bold">团类型
            <select value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Campaign['kind'] })} className="bauhaus-input mt-1 w-full p-2">
              <option value="online">网团</option><option value="offline">面团</option><option value="promo">宣群</option>
            </select>
          </label>
          <label className="block text-xs font-bold">封面颜色
            <div className="flex gap-2 mt-2">
              {BAUHAUS_COLORS.map((color) => <button key={color.hex} type="button" title={color.name} aria-label={color.name} onClick={() => setDraft({ ...draft, bannerColor: color.hex })} className={`w-8 h-8 border-2 border-[#121212] ${draft.bannerColor === color.hex ? 'ring-2 ring-offset-2 ring-[#004E98]' : ''}`} style={{ backgroundColor: color.hex }} />)}
            </div>
          </label>
        </div>
        <label className="block text-xs font-bold">团名<input required className="bauhaus-input mt-1 w-full p-2" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="block text-xs font-bold">一句话简介<input maxLength={300} className="bauhaus-input mt-1 w-full p-2" value={draft.summary || ''} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} placeholder="卡片上的简短说明，可留空" /></label>
        {coverBlock}

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
            <div className={draft.kind === 'promo' ? 'sm:col-span-2' : ''}><label className="block text-xs font-bold mb-1">{draft.kind === 'promo' ? '平台' : '游戏平台'}</label>{draft.kind === 'promo' ? <div className="flex items-center gap-2"><input required className="bauhaus-input flex-1 min-w-0 p-2 text-xs" value={draft.platforms?.[0] || ''} onChange={(e) => { const value = clampByWidth(e.target.value); setDraft({ ...draft, platforms: value ? [value] : [] }); }} /><span className="shrink-0 whitespace-nowrap text-[10px] font-bold text-[#666] tabular-nums">{textWidth(draft.platforms?.[0] || '')}/{PROMO_PLATFORM_MAX_WIDTH}</span></div> : <details className="relative group"><summary className="bauhaus-input w-full p-2 text-xs cursor-pointer">{draft.platforms?.length ? `已选 ${draft.platforms.length} 个` : '选择平台'}</summary><div className="absolute right-0 top-full mt-1 w-40 bg-[#FAF9F5] border-2 border-[#121212] shadow-[3px_3px_0px_#121212] p-2 z-30 space-y-1">{GAME_PLATFORMS.map((platform) => <label key={platform} className="flex items-center gap-2 px-1 py-1 text-xs font-bold"><input type="checkbox" checked={draft.platforms?.includes(platform) || false} onChange={() => { const current = draft.platforms || []; setDraft({ ...draft, platforms: current.includes(platform) ? current.filter((item) => item !== platform) : current.length >= 3 ? current : [...current, platform] }); }} />{platform}</label>)}{(draft.platforms?.length || 0) >= 3 && <p className="px-1 text-[10px] font-bold text-[#D62828]">最多选择 3 个平台</p>}</div></details>}</div>
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

        {stickerBlock}
        {draft.batchId ? slotTimesBlock : <CalendarPicker value={draft.timeSchedule} onChange={(value) => setDraft({ ...draft, timeSchedule: value })} maxDaysAhead={draft.kind === 'online' ? 31 : null} />}
        <label className="block text-xs font-bold">联系方式<input className="bauhaus-input mt-1 w-full p-2" value={draft.contact || ''} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} placeholder="留空则保持原联系方式" /></label>
        <p className="-mt-2 text-[10px] font-bold text-[#666]">代编辑他人团时若看不到原联系方式，留空即可保留，不会被覆盖。</p>
        <label className="block text-xs font-bold">详细介绍<textarea className="bauhaus-input mt-1 w-full p-2 min-h-32" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} placeholder={MARKDOWN_SUPPORT_HINT} /></label>
        <p className="text-[11px] text-[#666]">{draft.kind === 'offline' ? `面团 · ${locationLabel(draft)} · ` : ''}开团时间：{draft.timeSchedule}{draft.batchId ? '（各时段可在上方逐个改期）' : '（可在日历中改期）'}</p>
        <div className="flex justify-end gap-2"><button type="button" onClick={onClose} className="bauhaus-btn bg-white px-4 py-2 text-xs">取消</button><button disabled={saving} className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-xs disabled:opacity-50">{saving ? '保存中…' : '保存修改'}</button></div>
      </form>
      {coverToCrop && <ImageCropper file={coverToCrop} shape="cover" onClose={() => setCoverToCrop(null)} onConfirm={(file) => {
        const reader = new FileReader();
        reader.onload = () => { if (typeof reader.result === 'string') setDraft((previous) => ({ ...previous, imageUrl: reader.result as string })); };
        reader.readAsDataURL(file);
        setCoverToCrop(null);
      }} />}
    </div>
  );
};
