import React, { useState, useRef, useEffect } from 'react';
import { Campaign, UserProfile, SessionType } from '../types';
import { CampaignCard } from './CampaignCard';
import { MarkdownView } from './MarkdownView';
import { CalendarPicker } from './CalendarPicker';
import { X, Upload, Trash2, Clock, BookOpen } from 'lucide-react';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  rules: string[];
  presetTags?: string[];
  popularCustomTags?: string[];
  onPublish: (newCampaign: Omit<Campaign, 'id' | 'createdAt'>) => Promise<boolean>;
}

const BAUHAUS_COLORS = [
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
  onClose,
  currentUser,
  rules,
  presetTags = [],
  popularCustomTags = [],
  onPublish,
}) => {
  const [title, setTitle] = useState('');
  const [rule, setRule] = useState('');
  const [sessionType, setSessionType] = useState<SessionType>('语音');
  const [selectedPresetTags, setSelectedPresetTags] = useState<string[]>([]);
  const [selectedCustomTags, setSelectedCustomTags] = useState<string[]>([]);
  const [customTagInput, setCustomTagInput] = useState('');
  const [showRuleDropdown, setShowRuleDropdown] = useState(false);
  const [showCustomTagDropdown, setShowCustomTagDropdown] = useState(false);
  const [contact, setContact] = useState(currentUser?.qq || '');
  const [description, setDescription] = useState('');
  const [timeSchedule, setTimeSchedule] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [imageUrl, setImageUrl] = useState('');
  const [bannerColor, setBannerColor] = useState(BAUHAUS_COLORS[0].hex);
  const [isDragging, setIsDragging] = useState(false);
  const [showMobileCalendar, setShowMobileCalendar] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && !rule && rules.length) {
      setRule(rules[0]);
    }
  }, [isOpen, rules, rule]);

  useEffect(() => {
    if (isOpen && currentUser?.qq && !contact) {
      setContact(currentUser.qq);
    }
  }, [isOpen, currentUser?.qq]);

  const processFile = (file: File) => {
    if (!['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) {
      alert('请选择 PNG、JPG、GIF 或 WebP 图片');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      alert('上传图片请小于 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setImageUrl(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      alert('游客无法发布战役，请先登录');
      return;
    }
    if (!title.trim() || !contact.trim()) {
      alert('请将必填信息补充完整');
      return;
    }
    if (!timeSchedule.trim()) {
      alert('请在日历中选择开团日期及开团时段（早/中/晚）');
      return;
    }

    if (!rule.trim()) { alert('请填写或选择规则系统'); return; }

    const success = await onPublish({
      title: title.trim(),
      rule: rule.trim(),
      sessionType,
      presetTags: selectedPresetTags,
      customTags: selectedCustomTags,
      gmId: currentUser.id,
      gmName: currentUser.name,
      gmPraises: currentUser.receivedGmPraises,
      contact: contact.trim() || currentUser.qq,
      description: description.trim() || '暂无详细简介。',
      timeSchedule: timeSchedule.trim(),
      imageUrl: imageUrl.trim() || undefined,
      bannerColor,
      isFull: false,
      hasEnded: false,
      isSignedUp: false,
      maxPlayers: Number(maxPlayers) || 4,
      currentPlayers: 0,
    });

    if (success) onClose();
  };

  // Live preview campaign object
  const previewRule = rule.trim() || '规则待定';
  const previewCampaign: Campaign = {
    id: 'preview',
    title: title.trim() || '战役标题预览',
    rule: previewRule,
    sessionType,
    presetTags: selectedPresetTags,
    customTags: selectedCustomTags,
    gmId: currentUser?.id || 'current-user',
    gmName: currentUser?.name || '当前主持',
    gmPraises: currentUser?.receivedGmPraises ?? 0,
    contact: contact.trim() || currentUser?.qq,
    summary: '',
    description: description.trim() || '暂无详细简介',
    timeSchedule: timeSchedule.trim() || '时间待定',
    imageUrl: imageUrl.trim() || undefined,
    bannerColor,
    isFull: false,
    hasEnded: false,
    isSignedUp: false,
    maxPlayers: Number(maxPlayers) || 4,
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
              今日起 31 天内
            </span>
          </div>

          {/* Body */}
          <div className="p-4 bg-[#FAF9F5]">
            <CalendarPicker
              value={timeSchedule}
              onChange={(val) => setTimeSchedule(val)}
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
                发布新团
              </h2>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center bg-[#222] hover:bg-[#D62828] text-white font-bold cursor-pointer transition-colors border border-[#444]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body: Left form, Right preview */}
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* 中间主信息栏 (比两侧栏扩大 35%，宽度为 594px) */}
            <form
              onSubmit={handleSubmit}
              className="w-full lg:w-[594px] shrink-0 h-full overflow-y-auto no-scrollbar p-5 sm:p-6 text-sm flex flex-col"
            >
              <div className="space-y-3 flex-1 pb-3">
                {/* Title */}
                <div>
                  <label className="block font-bold text-[#121212] mb-1">
                    团名 <span className="text-[#D62828]">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="例如：狂乱极光：纳斯卡之眼"
                    className="bauhaus-input w-full px-3 py-2 text-sm"
                  />
                </div>

                {/* Row 1: Rule, Players Count, and Session Type (3 columns) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Rule with dynamic input and popup */}
                  <div className="relative">
                    <label className="block font-bold text-[#121212] mb-1">
                      规则系统 <span className="text-[#D62828]">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        required
                        value={rule}
                        onChange={(e) => setRule(e.target.value)}
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
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] p-2.5 z-30 max-h-56 overflow-y-auto">
                        <div className="text-[11px] font-bold text-[#666] mb-1.5 flex items-center justify-between border-b border-[#E5E5E0] pb-1">
                          <span>全部历史规则 ({rules.length})</span>
                          <button
                            type="button"
                            onClick={() => setShowRuleDropdown(false)}
                            className="hover:text-[#D62828] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex flex-wrap gap-1.5 pt-1">
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
                  <div>
                    <label className="block font-bold text-[#121212] mb-1">
                      人数
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={maxPlayers}
                      onChange={(e) => setMaxPlayers(Number(e.target.value))}
                      className="bauhaus-input w-full px-3 py-2 text-sm"
                    />
                  </div>

                  {/* Session Type */}
                  <div>
                    <label className="block font-bold text-[#121212] mb-1">
                      团类型
                    </label>
                    <select
                      value={sessionType}
                      onChange={(e) => setSessionType(e.target.value as SessionType)}
                      className="bauhaus-input w-full px-3 py-2 text-sm cursor-pointer"
                    >
                      <option value="语音">语音</option>
                      <option value="文字">文字</option>
                      <option value="留言板">留言板</option>
                    </select>
                  </div>
                </div>

                {/* Row 2: Tag System (Left: Preset Tags dropdown, Right: Custom Tags input with popover) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* Left: Preset Tags dropdown */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-[#121212]">
                        限选标签 <span className="text-xs font-normal text-[#666]">(最多2个)</span>
                      </label>
                      <span className="text-[11px] text-[#666]">{selectedPresetTags.length}/2</span>
                    </div>
                    <select
                      value=""
                      onChange={(e) => {
                        const val = e.target.value;
                        if (!val) return;
                        if (selectedPresetTags.includes(val)) return;
                        if (selectedPresetTags.length >= 2) {
                          alert('最多选择 2 个限选标签');
                          return;
                        }
                        setSelectedPresetTags([...selectedPresetTags, val]);
                      }}
                      disabled={selectedPresetTags.length >= 2}
                      className="bauhaus-input w-full px-3 py-2 text-sm cursor-pointer disabled:bg-[#F2F0E8] disabled:cursor-not-allowed"
                    >
                      <option value="">{selectedPresetTags.length >= 2 ? '已选满 (2个)' : '点击下拉选择限选标签…'}</option>
                      {presetTags
                        .filter((t) => !selectedPresetTags.includes(t))
                        .map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                    </select>
                    {selectedPresetTags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {selectedPresetTags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#FAF9F5] border border-[#121212] text-xs font-bold text-[#121212]"
                          >
                            <span>{tag}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedPresetTags(selectedPresetTags.filter((t) => t !== tag))}
                              className="hover:text-[#D62828] cursor-pointer"
                              title="删除标签"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Right: Custom Tags input */}
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-bold text-[#121212]">
                        自选标签 <span className="text-xs font-normal text-[#666]">(最多2个，限6字)</span>
                      </label>
                      <span className="text-[11px] text-[#666]">{selectedCustomTags.length}/2</span>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        maxLength={6}
                        value={customTagInput}
                        onChange={(e) => setCustomTagInput(e.target.value.slice(0, 6))}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            const tag = customTagInput.trim();
                            if (!tag) return;
                            if (tag.length > 6) {
                              alert('自选标签最多 6 个字');
                              return;
                            }
                            if (selectedCustomTags.includes(tag)) {
                              setCustomTagInput('');
                              return;
                            }
                            if (selectedCustomTags.length >= 2) {
                              alert('最多添加 2 个自选标签');
                              return;
                            }
                            setSelectedCustomTags([...selectedCustomTags, tag]);
                            setCustomTagInput('');
                          }
                        }}
                        disabled={selectedCustomTags.length >= 2}
                        placeholder={selectedCustomTags.length >= 2 ? '已选满 (2个)' : '输入回车添加 (限6字)'}
                        className="bauhaus-input w-full pl-3 pr-10 py-2 text-sm disabled:bg-[#F2F0E8] disabled:cursor-not-allowed"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCustomTagDropdown(!showCustomTagDropdown)}
                        className="absolute right-0 top-1/2 -translate-y-1/2 w-9 h-9 flex items-center justify-center text-[#004E98] hover:text-[#D62828] cursor-pointer"
                        title="查看常用与最新自选标签"
                      >
                        <BookOpen className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Popover for popular / recent custom tags */}
                    {showCustomTagDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] p-2.5 z-30 max-h-56 overflow-y-auto">
                        <div className="text-[11px] font-bold text-[#666] mb-1.5 flex items-center justify-between border-b border-[#E5E5E0] pb-1">
                          <span>热门与最新自选标签</span>
                          <button
                            type="button"
                            onClick={() => setShowCustomTagDropdown(false)}
                            className="hover:text-[#D62828] cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
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
                                  if (selectedCustomTags.length >= 2) {
                                    alert('最多添加 2 个自选标签');
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
                                #{tag}
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
                            <span>#{tag}</span>
                            <button
                              type="button"
                              onClick={() => setSelectedCustomTags(selectedCustomTags.filter((t) => t !== tag))}
                              className="hover:text-[#121212] cursor-pointer"
                              title="删除标签"
                            >
                              <X className="w-3 h-3" />
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
                    <span className="hidden lg:inline text-xs font-bold text-[#004E98]">
                      ← 请在左侧悬浮日历中选择
                    </span>
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
                        {timeSchedule || '未选择时间（请在左侧日历选定）'}
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

              {/* Detailed Description */}
              <div>
                <label className="block font-bold text-[#121212] mb-1">
                  简介
                </label>
                <textarea
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={MARKDOWN_SUPPORT_HINT}
                  className="bauhaus-input w-full px-3 py-2 text-sm font-mono resize-none leading-relaxed"
                />
              </div>

              {/* Cover Image: Drag & Drop / Click upload big rectangle */}
              <div className="border-2 border-[#121212] p-3 bg-[#FAF9F5]">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-bold text-xs text-[#121212]">
                    留空使用默认图片
                  </span>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="text-xs text-[#D62828] font-bold flex items-center gap-1 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>移除图片</span>
                    </button>
                  )}
                </div>

                {/* Big Rectangular Upload Box */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  className={`w-full h-24 border-2 border-dashed border-[#121212] bg-white flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden select-none ${
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
                        单击上传或拖拽图片至此
                      </span>
                      <span className="text-[10px] text-[#888888]">
                        支持 PNG, JPG, GIF (小于 2MB)
                      </span>
                    </div>
                  )}
                </div>

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
                className="bauhaus-btn bg-[#D62828] text-white px-6 py-2 text-xs font-black shadow-[3px_3px_0px_#121212]"
              >
                确认发布
              </button>
            </div>
          </form>

          {/* RIGHT: Live Preview (与左侧时间弹窗等宽 440px) */}
          <div className="w-full lg:w-[440px] shrink-0 h-full flex flex-col border-t-4 lg:border-t-0 lg:border-l-4 border-[#121212] bg-[#FAF9F5] overflow-hidden">
            {/* Top Half: Card Preview (fits complete card without scrollbar) */}
            <div className="flex-[1.4] min-h-[380px] flex flex-col border-b-4 border-[#121212] overflow-hidden">
              <div className="bg-[#121212] text-white px-4 py-1.5 text-xs font-bold flex items-center justify-between shrink-0">
                <span>卡片预览</span>
              </div>
              <div className="flex-1 p-3.5 flex items-center justify-center bg-[#F2F0E8] overflow-hidden">
                <div className="w-full max-w-[440px] pointer-events-none">
                  <CampaignCard campaign={previewCampaign} onClick={() => {}} />
                </div>
              </div>
            </div>

            {/* Bottom Half: Markdown Description Preview */}
            <div className="flex-1 flex flex-col overflow-hidden bg-white">
              <div className="bg-[#121212] text-white px-4 py-1.5 text-xs font-bold flex items-center justify-between shrink-0">
                <span>简介预览</span>
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                {description.trim() ? (
                  <MarkdownView content={description} />
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[#AAAAAA] italic">
                    输入简介内容即在此处实时渲染
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
);
};
