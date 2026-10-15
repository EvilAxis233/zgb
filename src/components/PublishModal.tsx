import React, { useState, useRef, useEffect } from 'react';
import { Campaign, UserProfile } from '../types';
import { CampaignCard } from './CampaignCard';
import { MarkdownView } from './MarkdownView';
import { X, Upload, Trash2 } from 'lucide-react';

interface PublishModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  rules: string[];
  onPublish: (newCampaign: Omit<Campaign, 'id' | 'createdAt'>) => Promise<boolean>;
}

const BAUHAUS_COLORS = [
  { name: '包豪斯红', hex: '#D62828' },
  { name: '包豪斯蓝', hex: '#004E98' },
  { name: '包豪斯黄', hex: '#F4A261' },
  { name: '纯粹墨黑', hex: '#121212' },
];

export const PublishModal: React.FC<PublishModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  rules,
  onPublish,
}) => {
  const [title, setTitle] = useState('');
  const [rule, setRule] = useState('');
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');
  const [timeSchedule, setTimeSchedule] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [imageUrl, setImageUrl] = useState('');
  const [bannerColor, setBannerColor] = useState(BAUHAUS_COLORS[0].hex);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!rules.includes(rule)) setRule(rules[0] || '');
  }, [rules, rule]);

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
    if (!title.trim() || !summary.trim() || !timeSchedule.trim()) {
      alert('请将必填信息补充完整');
      return;
    }

    if (!rule || !rules.includes(rule)) { alert('请先选择规则系统'); return; }

    const success = await onPublish({
      title: title.trim(),
      rule,
      gmId: currentUser.id,
      gmName: currentUser.name,
      summary: summary.trim(),
      description: description.trim() || '暂无详细简介。',
      timeSchedule: timeSchedule.trim(),
      imageUrl: imageUrl.trim() || undefined,
      bannerColor,
      status: 'recruiting',
      maxPlayers: Number(maxPlayers) || 4,
      currentPlayers: 0,
    });

    if (success) onClose();
  };

  // Live preview campaign object
  const previewRule = rule || '规则待定';
  const previewCampaign: Campaign = {
    id: 'preview',
    title: title.trim() || '战役标题预览',
    rule: previewRule,
    gmId: currentUser?.id || 'current-user',
    gmName: currentUser?.name || '当前主持',
    summary: summary.trim() || '这里是一句话概括预览...',
    description: description.trim() || '暂无详细简介',
    timeSchedule: timeSchedule.trim() || '时间待定',
    imageUrl: imageUrl.trim() || undefined,
    bannerColor,
    status: 'recruiting',
    maxPlayers: Number(maxPlayers) || 4,
    currentPlayers: 0,
    createdAt: new Date().toISOString().slice(0, 10),
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-[#FFFFFF] border-4 border-[#121212] shadow-[8px_8px_0px_#121212] my-4 flex flex-col h-[88vh] max-h-[88vh] overflow-hidden">
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

        {/* Modal Body: Left form, Right preview (same height) */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          {/* LEFT: Form Inputs (Scrollable) */}
          <form
            onSubmit={handleSubmit}
            className="w-full md:w-1/2 h-full overflow-y-auto p-5 sm:p-6 text-sm flex flex-col"
          >
            <div className="space-y-3.5 flex-1 pb-4">
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

              {/* Rule and Players Count */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-[#121212] mb-1">
                    规则系统 <span className="text-[#D62828]">*</span>
                  </label>
                  <select
                    value={rule}
                    onChange={(e) => setRule(e.target.value)}
                    className="bauhaus-input w-full px-3 py-2 text-sm cursor-pointer"
                  >
                    {!rules.length && <option value="">暂无规则</option>}
                    {rules.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

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
              </div>

              {/* Time Schedule */}
              <div>
                <label className="block font-bold text-[#121212] mb-1">
                  时间 <span className="text-[#D62828]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={timeSchedule}
                  onChange={(e) => setTimeSchedule(e.target.value)}
                  placeholder="例如：每周六晚 20:00 - 23:30 (线上语音)"
                  className="bauhaus-input w-full px-3 py-2 text-sm"
                />
              </div>

              {/* Short Summary */}
              <div>
                <label className="block font-bold text-[#121212] mb-1">
                  一句话概括 <span className="text-[#D62828]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="展示在卡片上的一句话概括..."
                  className="bauhaus-input w-full px-3 py-2 text-sm"
                />
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
                  placeholder=""
                  className="bauhaus-input w-full px-3 py-2 text-sm font-mono resize-none"
                />
              </div>

              {/* Cover Image: Drag & Drop / Click upload big rectangle */}
              <div className="border-2 border-[#121212] p-3.5 bg-[#FAF9F5]">
                <div className="flex items-center justify-between mb-2">
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
                  className={`w-full h-28 border-2 border-dashed border-[#121212] bg-white flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden select-none ${
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

          {/* RIGHT: Live Preview (Top half: Card Preview, Bottom half: Markdown Preview) */}
          <div className="w-full md:w-1/2 h-full flex flex-col border-t-4 md:border-t-0 md:border-l-4 border-[#121212] bg-[#FAF9F5] overflow-hidden">
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
  );
};
