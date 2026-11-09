import React, { useState, useRef, useEffect } from 'react';
import { Campaign, CampaignKind, UserProfile, GAME_PLATFORMS } from '../types';
import { CampaignCard } from './CampaignCard';
import { StickerPicker } from './StickerLibrary';
import { CalendarPicker } from './CalendarPicker';
import { X, Upload, Trash2, Clock, BookOpen } from 'lucide-react';
import { useDialog } from './BauhausDialog';
import { ImageCropper } from './ImageCropper';
import { acceptedImage, isAnimatedImage, normalizeImageFile, MAX_ANIMATED_BYTES, MAX_STATIC_BYTES } from '../utils/animatedImage';
import { textWidth, clampByWidth, PROMO_PLATFORM_MAX_WIDTH } from '../utils/textLength';
import { clampTag, tagTooLong, TAG_LIMIT_HINT } from '../utils/tagLength';

interface PublishModalProps {
  isOpen: boolean;
  kind: CampaignKind;
  onClose: () => void;
  currentUser: UserProfile | null;
  rules: string[];
  popularCustomTags?: string[];
  onUserUpdate?: (user: UserProfile) => void;
  isMember?: boolean;
  onPublish: (newCampaign: Omit<Campaign, 'id' | 'createdAt'>) => Promise<boolean>;
}

export const BAUHAUS_COLORS = [
  { name: '包豪斯红', hex: '#D62828' },
  { name: '包豪斯蓝', hex: '#004E98' },
  { name: '包豪斯黄', hex: '#F4A261' },
  { name: '纯粹墨黑', hex: '#121212' },
];

export const MARKDOWN_SUPPORT_HINT = `支持如下markdown语法：
# 一级标题
## 二级标题
### 三级标题
**粗体**
> 引用
- 列表`;

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  kind,
  onClose,
  currentUser,
  rules,
  popularCustomTags = [],
  onUserUpdate,
  isMember = false,
  onPublish,
}) => {
  const { showAlert } = useDialog();
  const [title, setTitle] = useState('');
  const [rule, setRule] = useState('');
  const [sessionType, setSessionType] = useState('语音');
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [location, setLocation] = useState('');
  const [address, setAddress] = useState('');
  const [showPlatformDropdown, setShowPlatformDropdown] = useState(false);
  const [selectedCustomTags, setSelectedCustomTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showRuleDropdown, setShowRuleDropdown] = useState(false);
  const [showCustomTagDropdown, setShowCustomTagDropdown] = useState(false);
  const [contact, setContact] = useState(currentUser?.qq || '');
  const [description, setDescription] = useState('');
  const [timeSchedule, setTimeSchedule] = useState('');
  const [timeSlots, setTimeSlots] = useState<string[]>([]);
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [imageUrl, setImageUrl] = useState('');
  const [coverSource, setCoverSource] = useState<File | null>(null);
  const [coverToCrop, setCoverToCrop] = useState<File | null>(null);
  const [coverAnimated, setCoverAnimated] = useState(false);
  const [bannerColor, setBannerColor] = useState(BAUHAUS_COLORS[0].hex);
  const [isDragging, setIsDragging] = useState(false);
  const [showMobileCalendar, setShowMobileCalendar] = useState(false);
  const [stickerKeys, setStickerKeys] = useState<string[]>(currentUser?.stickerKeys || []);
  const [submitting, setSubmitting] = useState(false);

  // 规则系统与昵称同一套字数口径：中文/全角算 2，英文数字算 1，上限 20（即 10 个中文字符）。
  const textWeight = (value: string) => Array.from(value).reduce((total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2), 0);
  const ruleLength = textWeight(rule);

  const changeRule = (value: string) => {
    if (textWeight(value) > 20) return;
    setRule(value);
  };

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && currentUser?.qq && !contact) {
      setContact(currentUser.qq);
    }
  }, [isOpen, currentUser?.qq]);
  useEffect(() => {
    if (!isOpen) return;
    setSessionType(kind === 'promo' ? '群扩招' : '语音');
    setPlatforms([]);
    setLocation('');
    setAddress('');
    setTimeSlots([]);
    setTimeSchedule('');
    setStickerKeys(currentUser?.stickerKeys || []);
  }, [isOpen, kind]);

  const processFile = async (selected: File) => {
    const file = normalizeImageFile(selected);
    if (!file) return;
    if (!acceptedImage(file)) {
      showAlert({ title: '图片格式错误', message: '请选择 PNG、JPG、GIF 或 WebP 图片', type: 'warning' });
      return;
    }
    // 动态封面直接原样上传：canvas 裁剪只会导出第一帧，动画会丢失。
    const animated = await isAnimatedImage(file);
    if (file.size > (animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES)) {
      showAlert({ title: '图片过大', message: animated ? '动态封面不会压缩，请小于 8MB' : '原图请小于 20MB，裁剪后将压缩至 2MB 内', type: 'warning' });
      return;
    }
    setCoverSource(file);
    setCoverAnimated(animated);
    if (animated) {
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') setImageUrl(reader.result); };
      reader.readAsDataURL(file);
    } else setCoverToCrop(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  // 宣群只能选一个时间；网团/面团可多时段。
  const applyTimeSlots = (slots: string[]) => {
    const next = kind === 'promo' ? slots.slice(-1) : slots;
    setTimeSlots(next);
    setTimeSchedule(next[0] || '');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!currentUser) {
      showAlert({ title: '提示', message: '请先登录后发布', type: 'warning' });
      return;
    }
    if (!title.trim() || !contact.trim()) {
      showAlert({ title: '提示', message: '请将必填信息补充完整', type: 'warning' });
      return;
    }
    if (!timeSlots.length) {
      showAlert({ title: '提示', message: '请在日历中选择开团日期及开团时段（早/中/晚）', type: 'warning' });
      return;
    }

    if (!rule.trim()) {
      showAlert({ title: '提示', message: '请填写或选择规则系统', type: 'warning' });
      return;
    }
    if (kind === 'offline' && (!location.trim() || Array.from(location.trim()).length > 8)) {
      showAlert({ title: '提示', message: '请填写省份和城市，合计最多八个字', type: 'warning' });
      return;
    }
    if (kind === 'promo' && (!sessionType.trim() || !platforms[0]?.trim())) {
      showAlert({ title: '提示', message: '请填写宣群方式和平台', type: 'warning' });
      return;
    }

    if (kind === 'promo' && timeSlots.length > 1) {
      showAlert({ title: '提示', message: '宣群只能选择一个时间', type: 'warning' });
      return;
    }

    setSubmitting(true);
    let success = false;
    try {
      success = await onPublish({
      kind,
      province: '',
      city: kind === 'offline' ? location.trim() : '',
      address: kind === 'offline' ? address.trim() : '',
      title: title.trim(),
      rule: rule.trim(),
      sessionType,
      platforms,
      presetTags: [],
      customTags: selectedCustomTags,
      gmId: currentUser.id,
      gmName: currentUser.name,
      gmPraises: currentUser.receivedGmPraises,
      contact: contact.trim() || currentUser.qq,
      description: description.trim() || '暂无详细简介。',
      timeSchedule: timeSlots[0],
      timeSlots,
      stickerKeys,
      imageUrl: imageUrl.trim() || undefined,
      bannerColor,
      isFull: false,
      hasEnded: false,
      hasExpired: false,
      isSignedUp: false,
      maxPlayers: kind === 'promo' ? 1 : Number(maxPlayers) || 4,
      currentPlayers: 0,
    });

    } finally { setSubmitting(false); }
    if (success) onClose();
  };

  // Live preview campaign object
  const previewRule = rule.trim() || '规则待定';
  const previewCampaign: Campaign = {
    id: 'preview',
    kind,
    province: '',
    city: location,
    address,
    title: title.trim() || '战役标题预览',
    rule: previewRule,
    sessionType,
    platforms,
    presetTags: [],
    customTags: selectedCustomTags,
    gmId: currentUser?.id || 'current-user',
    gmName: currentUser?.name || '当前主持',
    gmPraises: currentUser?.receivedGmPraises ?? 0,
    gmNameplate: currentUser?.nameplate ?? null,
    gmStickers: stickerKeys.map((key) => `/api/images/${key}`),
    contact: contact.trim() || currentUser?.qq,
    summary: '',
    description: description.trim() || '暂无详细简介',
    timeSchedule: timeSlots[0] || '时间待定',
    slots: timeSlots.map((slot, index) => ({ id: `preview-${index}`, timeSchedule: slot, currentPlayers: 0, maxPlayers: kind === 'promo' ? 1 : Number(maxPlayers) || 4, isFull: false, hasEnded: false, hasExpired: false, isSignedUp: false })),
    imageUrl: imageUrl.trim() || undefined,
    bannerColor,
    isFull: false,
    hasEnded: false,
    hasExpired: false,
    isSignedUp: false,
    maxPlayers: kind === 'promo' ? 1 : Number(maxPlayers) || 4,
    currentPlayers: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative flex flex-col lg:flex-row items-center lg:items-start justify-center gap-4 my-auto w-full max-w-[1540px]">
        {/* 左侧悬浮：开团时间设定面板 (与右侧预览等宽 440px，自适应内容高度) */}
        <div className="hidden lg:flex w-[440px] shrink-0 flex-col bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] overflow-hidden self-start">
          {/* Header */}
          <div className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between border-b-2 border-[#121212] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#D62828] inline-block" />
              <h3 className="text-sm font-black tracking-wider">开团时间</h3>
            </div>
            <span className="text-[10px] text-[#E0E0E0] bg-[#222] px-2 py-0.5 font-bold border border-[#444]">
              {kind === 'online' ? '今日起 31 天内' : '未来日期不限月数'}
            </span>
          </div>

          {/* Body */}
          <div className="p-4 bg-[#FAF9F5]">
            <CalendarPicker
              value={timeSchedule}
              onChange={(val) => setTimeSchedule(val)}
              multiple
              maxDaysAhead={kind === 'online' ? 31 : null}
              selectedSlots={timeSlots}
              onChangeSlots={applyTimeSlots}
              hideHeader={true}
              borderless={true}
            />
          </div>
        </div>

        {/* 右侧主弹窗 (中间主信息栏 594px + 右侧预览栏 440px) */}
        <div className="relative w-full lg:w-[1034px] shrink-0 bg-[#FFFFFF] border-4 border-[#121212] shadow-[8px_8px_0px_#121212] flex flex-col h-[88vh] max-h-[88vh] overflow-hidden">
          {/* Modal Header */}
          <div className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between border-b-2 border-[#121212] shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 bg-[#D62828] inline-block" />
              <h2 className="text-sm font-black tracking-wider">
                {kind === 'online' ? '发布新团' : kind === 'offline' ? '发布面团' : '发布宣群'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-[#222] hover:bg-[#D62828] text-white font-bold cursor-pointer transition-colors border border-[#444]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body: Left form, Right preview（移动端整体纵向滚动，右侧预览固定高度） */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
            {/* 中间主信息栏 (比两侧栏扩大 35%，宽度为 594px) */}
            <form
              onSubmit={handleSubmit}
              className="w-full lg:w-[594px] shrink-0 lg:h-full overflow-y-auto no-scrollbar p-5 sm:p-6 text-sm flex flex-col"
            >
              <div className="space-y-3 flex-1 pb-3">
                {/* Title */}
                <div>
                  <label className="block font-bold text-[#121212] mb-1">
                    {kind === 'promo' ? '宣群标题' : '团名'} <span className="text-[#D62828]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={kind === 'promo' ? '例如：跑团交流群招募' : '例如：狂乱极光：纳斯卡之眼'}
                    className="bauhaus-input w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Rule, player count, game type, and platforms */}
                <div className={`grid grid-cols-1 gap-3 ${kind === 'promo' ? 'sm:grid-cols-[minmax(0,2fr)_7rem_minmax(0,1fr)_minmax(0,1.1fr)]' : 'sm:grid-cols-[minmax(0,2fr)_3.5rem_minmax(0,1fr)_minmax(0,1.1fr)]'}`}>
                  {/* Rule with dynamic input and popup */}
                  <div className="relative">
                    <label className="block font-bold text-[#121212] mb-1 flex items-center justify-between gap-2">
                      <span>规则系统 <span className="text-[#D62828]">*</span></span>
                      <span className={`text-[10px] font-bold ${ruleLength > 20 ? 'text-[#D62828]' : 'text-[#888]'}`}>{ruleLength}/20</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={rule}
                        onChange={(e) => changeRule(e.target.value)}
                        placeholder="输入或点击右侧选择"
                        className="bauhaus-input w-full pl-3 pr-10 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => setShowRuleDropdown(!showRuleDropdown)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#004E98] hover:text-[#D62828] cursor-pointer"
                        title="选择历史规则标签"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </div>

                    {/* All historical rules popover */}
                    {showRuleDropdown && (
                      <div className="absolute left-0 top-full mt-1 w-full sm:w-80 max-w-[calc(100vw-3rem)] bg-[#FAF9F5] border-2 border-[#121212] shadow-[3px_3px_0px_#121212] p-2.5 z-30">
                        <div className="text-xs font-bold text-[#121212] mb-2 flex items-center justify-between border-b border-[#D8D6CC] pb-2">
                          <span>历史规则 ({rules.length})</span>
                          <button
                            type="button"
                            onClick={() => setShowRuleDropdown(false)}
                            className="w-7 h-7 flex items-center justify-center bg-[#121212] text-white hover:bg-[#D62828] cursor-pointer"
                            aria-label="关闭历史规则"
                          >
                            <X className="w-4 h-4" strokeWidth={3} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 max-h-52 overflow-y-auto bauhaus-scrollbar">
                          {rules.length ? (
                            rules.map((r) => (
                              <button
                                key={r}
                                type="button"
                                onClick={() => {
                                  setRule(r);
                                  setShowRuleDropdown(false);
                                }}
                                className="px-2 py-1 text-xs font-bold border border-[#121212] bg-[#FAF9F5] hover:bg-[#004E98] hover:text-white transition-colors cursor-pointer text-left"
                              >
                                {r}
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-[#888]">暂无规则历史</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Players Count */}
                  {kind !== 'promo' && <div>
                    <label className="block font-bold text-[#121212] mb-1">
                      人数
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="bauhaus-input w-full px-2 py-2 text-sm"
                    />
                  </div>}

                  {kind === 'offline' ? <label className="block font-bold text-[#121212] sm:col-span-2">省份 / 城市<input required maxLength={8} value={location} onChange={(e) => setLocation(Array.from(e.target.value).slice(0, 8).join(''))} placeholder="例如：广东省深圳市（最多八字）" className="bauhaus-input mt-1 w-full px-3 py-2 text-sm" /></label> : <>
                    <div>
                      <label className="block font-bold text-[#121212] mb-1">{kind === 'promo' ? '宣群方式' : '游戏类型'}</label>
                      {kind === 'promo' ? <>
                        <select value={['群扩招', '展会', '激励活动', '西征'].includes(sessionType) ? sessionType : '自填'} onChange={(e) => setSessionType(e.target.value === '自填' ? '' : e.target.value)} className="bauhaus-input w-full px-2 py-2 text-sm cursor-pointer">
                          <option value="群扩招">群扩招</option><option value="展会">展会</option><option value="激励活动">激励活动</option><option value="西征">西征</option><option value="自填">自填</option>
                        </select>
                        {!['群扩招', '展会', '激励活动', '西征'].includes(sessionType) && <input required maxLength={40} value={sessionType} onChange={(e) => setSessionType(e.target.value)} placeholder="自填方式" className="bauhaus-input mt-1 w-full px-2 py-2 text-sm" />}
                      </> : <select value={sessionType} onChange={(e) => setSessionType(e.target.value)} className="bauhaus-input w-full px-3 py-2 text-sm cursor-pointer"><option value="语音">语音</option><option value="文字">文字</option><option value="其他游戏形式">其他游戏形式</option></select>}
                    </div>
                    <div className={kind === 'promo' ? 'relative sm:col-span-2' : 'relative'}>
                      <label className="block font-bold text-[#121212] mb-1">{kind === 'promo' ? '平台' : '游戏平台'}</label>
                      {kind === 'promo' ? <div className="flex items-center gap-2"><input required value={platforms[0] || ''} onChange={(e) => { const value = clampByWidth(e.target.value); setPlatforms(value ? [value] : []); }} placeholder="自填平台" className="bauhaus-input flex-1 min-w-0 px-3 py-2 text-sm" /><span className="shrink-0 whitespace-nowrap text-[11px] font-bold text-[#666] tabular-nums">{textWidth(platforms[0] || '')}/{PROMO_PLATFORM_MAX_WIDTH}</span></div> : <>
                        <button type="button" onClick={() => setShowPlatformDropdown(!showPlatformDropdown)} aria-expanded={showPlatformDropdown} className="bauhaus-input w-full px-2 py-2 text-sm text-left cursor-pointer flex items-center justify-between gap-1">
                          <span className="truncate">{platforms.length ? `已选 ${platforms.length} 个平台` : '选择平台'}</span><span aria-hidden="true" className="shrink-0 text-xs">▾</span>
                        </button>
                        {showPlatformDropdown && <div className="absolute right-0 top-full mt-1 w-40 bg-[#FAF9F5] border-2 border-[#121212] shadow-[3px_3px_0px_#121212] p-2 z-30 space-y-1">{GAME_PLATFORMS.map((platform) => <label key={platform} className="flex items-center gap-2 px-1 py-1 text-xs font-bold cursor-pointer hover:bg-white"><input type="checkbox" checked={platforms.includes(platform)} onChange={() => setPlatforms((current) => current.includes(platform) ? current.filter((item) => item !== platform) : current.length >= 3 ? current : [...current, platform])} className="accent-[#004E98]" />{platform}</label>)}{platforms.length >= 3 && <p className="px-1 text-[10px] font-bold text-[#D62828]">最多选择 3 个平台</p>}<button type="button" onClick={() => setShowPlatformDropdown(false)} className="w-full text-xs font-bold border border-[#121212] bg-white py-1">完成</button></div>}
                      </>}
                    </div>
                  </>}
                </div>
                {kind === 'offline' && <label className="block font-bold text-[#121212]">完整地址<input maxLength={200} value={address} onChange={(e) => setAddress(e.target.value)} placeholder="填写活动的详细地址" className="bauhaus-input mt-1 w-full px-3 py-2 text-sm" /></label>}
                {kind === 'online' && platforms.length > 0 && <div className="flex flex-wrap gap-1.5">{platforms.map((platform) => <span key={platform} className="px-2 py-0.5 bg-[#F0F5FA] border border-[#004E98] text-[#004E98] text-xs font-bold">{platform}</span>)}</div>}

                <div>
                  {/* Right: Custom Tags input */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-[#121212]">
                        自定义标签 <span className="text-xs font-normal text-[#666]">({TAG_LIMIT_HINT})</span>
                      </label>
                      <span className="text-[11px] text-[#666]">{selectedCustomTags.length}/6</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(clampTag(e.target.value))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const tag = customTagInput.trim();
                            if (!tag) return;
                            if (tagTooLong(tag)) {
                              showAlert({ title: '提示', message: '自定义标签最多 6 个中文字符或 12 个英文字符', type: 'warning' });
                              return;
                            }
                            if (selectedCustomTags.includes(tag)) {
                              setCustomTagInput('');
                              return;
                            }
                            if (selectedCustomTags.length >= 6) {
                              showAlert({ title: '提示', message: '最多添加 6 个自定义标签', type: 'warning' });
                              return;
                            }
                            setSelectedCustomTags([...selectedCustomTags, tag]);
                            setCustomTagInput('');
                          }
                        }}
                        disabled={selectedCustomTags.length >= 6}
                        placeholder={selectedCustomTags.length >= 6 ? '已选满 (6个)' : '输入回车添加 (6 中文 / 12 英文)'}
                        className="bauhaus-input w-full pl-3 pr-10 py-2 text-sm disabled:bg-[#F2F0E8] disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomTagDropdown(!showCustomTagDropdown)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#004E98] hover:text-[#D62828] cursor-pointer"
                        title="查看常用与最新自定义标签"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Popover for popular / recent custom tags */}
                    {showCustomTagDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] p-2.5 z-30 max-h-56 overflow-y-auto">
                        <div className="text-[11px] font-bold text-[#666] mb-1.5 flex items-center justify-between border-b border-[#E5E5E0] pb-1">
                          <span>热门与最新自定义标签</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomTagDropdown(false)}
                            className="w-7 h-7 flex items-center justify-center bg-[#121212] text-white hover:bg-[#D62828] cursor-pointer"
                            aria-label="关闭自定义标签"
                          >
                            <X className="w-4 h-4" strokeWidth={3} />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {popularCustomTags.length ? (
                            popularCustomTags.map((tag) => (
                              <button
                                key={tag}
                                type="button"
                                onClick={() => {
                                  if (selectedCustomTags.includes(tag)) return;
                                  if (tagTooLong(tag)) { showAlert({ title: '提示', message: '该标签超过 6 个中文字符 / 12 个英文字符', type: 'warning' }); return; }
                                  if (selectedCustomTags.length >= 6) {
                                    showAlert({ title: '提示', message: '最多添加 6 个自定义标签', type: 'warning' });
                                    return;
                                  }
                                  setSelectedCustomTags([...selectedCustomTags, tag]);
                                }}
                                className={`px-2 py-1 text-xs font-bold border border-[#121212] transition-colors cursor-pointer ${
                                  selectedCustomTags.includes(tag)
                                    ? 'bg-[#121212] text-white opacity-50 cursor-not-allowed'
                                    : 'bg-[#FAF9F5] text-[#D62828] hover:bg-[#D62828] hover:text-white'
                                }`}
                              >
                                {tag}
                              </button>
                            ))
                          ) : (
                            <span className="text-xs text-[#888]">暂无其他人创建的标签</span>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedCustomTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedCustomTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FFF9F9] border border-[#121212] text-xs font-bold text-[#D62828]"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomTags(selectedCustomTags.filter((t) => t !== tag))}
                              className="w-5 h-5 flex items-center justify-center bg-[#D62828] text-white hover:bg-[#121212] cursor-pointer"
                              title="删除标签"
                              aria-label={`删除标签 ${tag}`}
                            >
                              <X className="w-3.5 h-3.5" strokeWidth={3} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Time Schedule (表单内状态提示栏) */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-bold text-[#121212]">
                      开团时间 <span className="text-[#D62828]">*</span>
                    </label>
                    {kind === 'promo' ? (
                      <span className="hidden sm:inline text-xs font-bold text-[#D62828]">宣群只能选择 1 个时间</span>
                    ) : (
                      <span className="hidden lg:inline text-xs font-bold text-[#004E98]">
                        ← 请在左侧悬浮日历中选择
                      </span>
                    )}
                  </div>

                  <div
                    className={`w-full p-2.5 border-2 border-[#121212] flex items-center justify-between transition-colors ${
                      timeSchedule ? 'bg-[#FAF9F5]' : 'bg-[#FFF9E6] border-dashed'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <Clock className="w-4 h-4 text-[#004E98] shrink-0" />
                      <span
                        className={`text-xs sm:text-sm font-black truncate ${
                          timeSchedule ? 'text-[#121212]' : 'text-[#888888] font-normal italic'
                        }`}
                      >
                        {timeSlots.length ? `${timeSlots.length} 个时段：${timeSlots.join('、')}` : '未选择时间（请在左侧日历选定）'}
                      </span>
                    </div>
                    {timeSchedule ? (
                      <span className="shrink-0 text-[11px] font-black bg-[#2A9D8F] text-white px-2 py-0.5 border border-[#121212]">
                        已选定
                      </span>
                    ) : (
                      <span className="shrink-0 text-[11px] font-black bg-[#D62828] text-white px-2 py-0.5 border border-[#121212]">
                        待选择
                      </span>
                    )}
                  </div>

                  {/* 仅在窄屏/移动端提供折叠展开 */}
                  <div className="lg:hidden mt-2">
                    <button
                      type="button"
                      onClick={() => setShowMobileCalendar(!showMobileCalendar)}
                      className="w-full py-1.5 px-3 text-xs font-bold bg-[#EAE8E0] hover:bg-[#DEDCD2] text-[#121212] border border-[#121212] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <span>{showMobileCalendar ? '收起开团日历' : '展开选择开团日历与时段'}</span>
                    </button>
                    {showMobileCalendar && (
                      <div className="mt-2 border-2 border-[#121212] p-2 bg-white">
                        <CalendarPicker
                          value={timeSchedule}
                          onChange={(val) => setTimeSchedule(val)}
                          multiple
                          maxDaysAhead={kind === 'online' ? 31 : null}
                          selectedSlots={timeSlots}
                          onChangeSlots={applyTimeSlots}
                        />
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact Information */}
                <div>
                  <label className="block font-bold text-[#121212] mb-1">
                    联系方式 <span className="text-[#D62828]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={contact}
                    onChange={(e) => setContact(e.target.value)}
                    placeholder="默认填入你的 QQ 号"
                    className="bauhaus-input w-full px-3 py-2 text-sm"
                  />
                  <p className="mt-1 text-[11px] text-[#666]">
                    报名成功的玩家才能看到联系方式
                  </p>
                </div>

              {/* 贴纸：可现场上传裁剪，也可从个人贴纸库挑；本团临时生效，不改默认佩戴 */}
              <div>
                <label className="block font-bold text-[#121212] mb-1">
                  贴纸
                  <span className="ml-1 text-[11px] font-normal text-[#666]">上传自动存入贴纸库，或从库里选，本团最多 2 张</span>
                </label>
                <StickerPicker library={currentUser?.stickerLibraryKeys || []} value={stickerKeys} onChange={setStickerKeys} onUserUpdate={onUserUpdate} isMember={isMember} />
              </div>

              {/* Cover Image: Drag & Drop / Click upload big rectangle */}
              <div className="border-2 border-[#121212] p-3 bg-[#FAF9F5]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-[#121212]">
                    留空使用默认图片
                  </span>
                  <div className="flex items-center gap-3">
                    {imageUrl && coverSource && !coverAnimated && (
                      <button type="button" onClick={() => setCoverToCrop(coverSource)} className="text-xs text-[#004E98] font-bold hover:underline cursor-pointer">重新裁剪</button>
                    )}
                    {imageUrl && (
                      <button
                        type="button"
                        onClick={() => { setImageUrl(''); setCoverSource(null); setCoverAnimated(false); }}
                        className="text-xs text-[#D62828] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>移除图片</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Big Rectangular Upload Box */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full h-24 border-2 border-dashed border-[#121212] bg-white flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#004E98] ${
                    isDragging ? 'bg-[#FFF3E0] border-[#004E98]' : 'hover:bg-[#F2F0E8]'
                  }`}
                >
                  {imageUrl ? (
                    <div className="relative w-full h-full">
                      <img
                        src={imageUrl}
                        alt="封面预览"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center text-white text-xs font-bold">
                        点击更换图片
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1 text-center p-2">
                      <Upload className="w-5 h-5 text-[#004E98]" />
                      <span className="text-xs font-bold text-[#121212]">
                        单击上传或拖拽图片至此，随后可裁剪和移动
                      </span>
                      <span className="text-[10px] text-[#888888]">
                        支持 PNG、JPG、GIF、WebP · 动图保留动画、不裁剪（小于 8MB）
                      </span>
                    </div>
                  )}
                </button>

                {/* Main Color Selection */}
                <div className="mt-2.5 flex items-center gap-3">
                  <span className="text-xs font-bold text-[#121212]">主色:</span>
                  <div className="flex items-center gap-2">
                    {BAUHAUS_COLORS.map((c) => (
                      <button
                        key={c.hex}
                        type="button"
                        onClick={() => setBannerColor(c.hex)}
                        className={`w-6 h-6 border-2 border-[#121212] cursor-pointer transition-transform ${
                          bannerColor === c.hex ? 'scale-125 shadow-[2px_2px_0px_#121212]' : ''
                        }`}
                        style={{ backgroundColor: c.hex }}
                        title={c.name}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Submit & Cancel Buttons */}
            <div className="pt-3 pb-1 flex items-center justify-end gap-3 border-t-2 border-[#121212] shrink-0 bg-white">
              <button
                type="button"
                onClick={onClose}
                className="bauhaus-btn bg-white text-[#121212] px-5 py-2 text-xs font-bold"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="bauhaus-btn bg-[#D62828] text-white px-6 py-2 text-xs font-black shadow-[3px_3px_0px_#121212] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {submitting ? '发布中…' : '确认发布'}
              </button>
            </div>
          </form>

          {/* RIGHT: Live Preview (与左侧时间弹窗等宽 440px) */}
          <div className="w-full lg:w-[440px] shrink-0 h-[680px] lg:h-full flex flex-col border-t-4 lg:border-t-0 lg:border-l-4 border-[#121212] bg-[#FAF9F5] overflow-hidden">
            {/* Top Half: Card Preview (fits complete card without scrollbar)；移动端排到最下面 */}
            <div className="order-2 lg:order-1 flex-[1.4] min-h-[380px] flex flex-col border-t-4 lg:border-t-0 lg:border-b-4 border-[#121212] overflow-hidden">
              <div className="bg-[#121212] text-white px-4 py-1.5 text-xs font-bold flex items-center justify-between shrink-0">
                <span>卡片预览</span>
              </div>
              <div className="flex-1 p-3.5 flex items-center justify-center bg-[#F2F0E8] overflow-hidden">
                <div className="w-full max-w-[440px] pointer-events-none">
                  <CampaignCard campaign={previewCampaign} onClick={() => {}} />
                </div>
              </div>
            </div>

            {/* Bottom Half: 简介填写（移动端排在预览上方，桌面端在预览下方） */}
            <div className="order-1 lg:order-2 flex-1 flex flex-col overflow-hidden bg-white">
              <div className="bg-[#121212] text-white px-4 py-1.5 text-xs font-bold flex items-center justify-between shrink-0">
                <span>简介</span>
                <span className="text-[10px] font-normal opacity-80">支持 Markdown</span>
              </div>
              <div className="flex-1 overflow-hidden p-3">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={MARKDOWN_SUPPORT_HINT}
                  className="bauhaus-input w-full h-full px-3 py-2 text-sm font-mono resize-none leading-relaxed"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {coverToCrop && <ImageCropper file={coverToCrop} shape="cover" onClose={() => setCoverToCrop(null)} onConfirm={(file) => {
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') setImageUrl(reader.result); };
      reader.readAsDataURL(file);
      setCoverToCrop(null);
    }} />}
  </div>
);
};
