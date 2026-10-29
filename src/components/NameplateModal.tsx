import React, { useState, useEffect, useId } from 'react';
import { X, Check } from 'lucide-react';
import { UserNameplate } from '../types';
import { NameplateBadge } from './NameplateBadge';
import { REFERENCE_NAMEPLATE_STYLES } from '../nameplateGallery';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  currentNameplate?: UserNameplate | null;
  onSave: (nameplate: UserNameplate | null) => Promise<boolean>;
}

export const NAMEPLATE_STYLES = [
  // 静态 8 款
  { id: 'nb-s01', code: 'S01', name: '包豪斯原典', type: 'static' as const },
  { id: 'nb-s02', code: 'S02', name: '典雅黑金', type: 'static' as const },
  { id: 'nb-s03', code: 'S03', name: '像素街机', type: 'static' as const },
  { id: 'nb-s06', code: 'S06', name: '赛博警示装甲', type: 'static' as const },
  { id: 'nb-s10', code: 'S10', name: '漫画波普', type: 'static' as const },
  { id: 'nb-s12', code: 'S12', name: '蒸汽波落日', type: 'static' as const },
  { id: 'nb-s16', code: 'S16', name: '霓虹双轨', type: 'static' as const },
  { id: 'nb-s18', code: 'S18', name: '打孔票根', type: 'static' as const },

  // 动态 6 款
  { id: 'nb-d01', code: 'D01', name: '彩虹流光', type: 'dynamic' as const },
  { id: 'nb-d02', code: 'D02', name: '赛博脉冲', type: 'dynamic' as const },
  { id: 'nb-d04', code: 'D04', name: '烈焰熔岩', type: 'dynamic' as const },
  { id: 'nb-d09', code: 'D09', name: '雷霆电弧', type: 'dynamic' as const },
  { id: 'nb-d12', code: 'D12', name: '雷达扫描', type: 'dynamic' as const },
  { id: 'nb-d16', code: 'D16', name: '潮汐涌浪', type: 'dynamic' as const },
  ...REFERENCE_NAMEPLATE_STYLES,
];

const nameCollator = new Intl.Collator('zh-CN-u-co-pinyin', { numeric: true });
const sortedNameplateStyles = [...NAMEPLATE_STYLES].sort((a, b) =>
  a.type === b.type
    ? nameCollator.compare(a.name, b.name) || a.code.localeCompare(b.code)
    : a.type === 'dynamic' ? -1 : 1
);

export const validateNameplateText = (text: string) => {
  let zh = 0;
  let en = 0;
  for (const ch of text) {
    if (/[\u4e00-\u9fa5]/.test(ch)) zh++;
    else en++;
  }
  const total = zh * 2 + en;
  const isValid = total > 0 && total <= 8 && zh <= 4;
  let label = '';
  if (zh > 0 && en === 0) label = `${zh}/4 字`;
  else if (zh === 0) label = `${en}/8 字母`;
  else label = `${zh}字+${en}英`;

  return { isValid, label, zh, en, total };
};

export const NameplateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  currentNameplate,
  onSave,
}) => {
  const [selectedStyle, setSelectedStyle] = useState<string>('nb-s01');
  const [inputText, setInputText] = useState<string>('跑团狂魔');
  const [styleFilter, setStyleFilter] = useState<'all' | 'static' | 'dynamic'>('all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const inputId = useId();

  useEffect(() => {
    if (isOpen) {
      if (currentNameplate?.styleId) {
        setSelectedStyle(currentNameplate.styleId);
      } else {
        setSelectedStyle('nb-s01');
      }
      if (currentNameplate?.text) {
        setInputText(currentNameplate.text);
      } else {
        setInputText('跑团狂魔');
      }
      setError('');
      setStyleFilter('all');
    }
  }, [isOpen, currentNameplate]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscape);
      return () => window.removeEventListener('keydown', handleEscape);
    }
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  const { isValid, label } = validateNameplateText(inputText.trim());
  const visibleStyles = sortedNameplateStyles.filter((style) => styleFilter === 'all' || style.type === styleFilter);

  const handleEquip = async () => {
    const cleanText = inputText.trim();
    if (!cleanText) {
      setError('请输入铭牌文字');
      return;
    }
    if (!isValid) {
      setError('铭牌文字上限为四个汉字或8个英文字符');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const ok = await onSave({ styleId: selectedStyle, text: cleanText });
      if (ok) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const handleUnequip = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = await onSave(null);
      if (ok) onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : '卸下失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  const previewNameplate: UserNameplate = {
    styleId: selectedStyle,
    text: inputText.trim() || '预览文字',
  };

  return (
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="nameplate-modal-title"
        className="w-full max-w-5xl border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212] flex flex-col max-h-[90vh]"
      >
        {/* 弹窗头部 */}
        <header className="flex items-center justify-between bg-[#121212] px-5 py-3.5 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-3.5 h-3.5 bg-[#F4A261] border border-white" />
            <h2 id="nameplate-modal-title" className="font-black text-base tracking-tight">
              会员专属 · 自定义铭牌样式库
            </h2>
          </div>
          <button
            type="button"
            aria-label="关闭弹窗"
            disabled={busy}
            onClick={onClose}
            className="cursor-pointer text-white/80 hover:text-white disabled:opacity-50 transition-colors"
          >
            <X size={20} />
          </button>
        </header>

        {/* 弹窗主体 */}
        <div className="p-5 overflow-y-auto space-y-5 bauhaus-scrollbar flex-1">
          {/* 铭牌文字输入 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor={inputId} className="text-xs font-black text-[#121212]">
                铭牌文字内容（限制四个汉字 / 8 个英文）
              </label>
              <span
                className={`text-[11px] font-mono font-bold px-1.5 py-0.5 border border-[#121212] ${
                  isValid ? 'bg-[#E8F5E9] text-[#2E7D32]' : 'bg-[#FFEBEE] text-[#C62828]'
                }`}
              >
                {label || '0/4 字'}
              </span>
            </div>
            <div className="flex gap-2">
              <input
                id={inputId}
                type="text"
                autoFocus
                maxLength={16}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="例如：跑团狂魔"
                className="bauhaus-input flex-1 px-3 py-2 text-sm font-black shadow-[2px_2px_0px_#121212]"
              />
            </div>

          </div>

          {/* 实时效果预览展示板 */}
          <div className="border-2 border-[#121212] bg-[#FAF9F5] p-3.5 shadow-[3px_3px_0px_#121212]">
            <div className="grid grid-cols-2 gap-3">
              <div className="border border-[#121212] bg-white p-3 flex flex-col items-center justify-center gap-1.5 min-h-[64px]">
                <span className="text-[10px] font-bold text-[#888]">日间底色</span>
                <NameplateBadge nameplate={previewNameplate} />
              </div>
              <div className="border border-[#121212] bg-[#121316] p-3 flex flex-col items-center justify-center gap-1.5 min-h-[64px]">
                <span className="text-[10px] font-bold text-[#555]">夜间底色</span>
                <NameplateBadge nameplate={previewNameplate} />
              </div>
            </div>
          </div>

          {/* 样式库选择区 */}
          <div>
            <div className="flex flex-wrap gap-2 mb-3" aria-label="铭牌类型筛选">
              {(['all', 'dynamic', 'static'] as const).map((filter) => (
                <button
                  key={filter}
                  type="button"
                  aria-pressed={styleFilter === filter}
                  onClick={() => setStyleFilter(filter)}
                  className={`px-2.5 py-1 text-xs font-bold border-2 border-[#121212] cursor-pointer ${styleFilter === filter ? 'bg-[#121212] text-white' : 'bg-white text-[#121212]'}`}
                >
                  {filter === 'all' ? '全部' : filter === 'static' ? '静态' : '动态'}（{filter === 'all' ? NAMEPLATE_STYLES.length : NAMEPLATE_STYLES.filter((style) => style.type === filter).length}）
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {visibleStyles.map((style, index) => {
                const isSelected = selectedStyle === style.id;
                return (
                  <React.Fragment key={style.id}>
                    {styleFilter === 'all' && (index === 0 || visibleStyles[index - 1].type !== style.type) && (
                      <h3 className="col-span-full mt-2 border-b-2 border-[#121212] pb-1 text-sm font-black text-[#121212]">
                        {style.type === 'dynamic' ? '动态铭牌' : '静态铭牌'}（{NAMEPLATE_STYLES.filter((item) => item.type === style.type).length}）
                      </h3>
                    )}
                    <button
                    type="button"
                    onClick={() => setSelectedStyle(style.id)}
                    className={`flex min-w-0 flex-col justify-between gap-3 p-2.5 border-2 transition-all cursor-pointer text-left ${
                      isSelected
                        ? 'border-[#D62828] bg-[#FFF4DA] shadow-[3px_3px_0px_#D62828] translate-x-0.5'
                        : 'border-[#121212] bg-white hover:bg-[#FAF9F5] shadow-[2px_2px_0px_#121212]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="font-mono text-[10px] font-bold px-1 bg-[#121212] text-white">
                          {style.code}
                        </span>
                        <strong className="text-xs font-black text-[#121212]">{style.name}</strong>
                        <span
                          className={`text-[9px] font-bold px-1 ${
                            style.type === 'static'
                              ? 'bg-[#E3F2FD] text-[#0D47A1]'
                              : 'bg-[#FCE4EC] text-[#880E4F]'
                          }`}
                        >
                          {style.type === 'static' ? '静态' : '动态'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 min-h-7">
                      <NameplateBadge nameplate={{ styleId: style.id, text: inputText.trim() || '样标' }} />
                      {isSelected && (
                        <div className="w-4 h-4 bg-[#D62828] text-white flex items-center justify-center shrink-0">
                          <Check size={12} strokeWidth={3} />
                        </div>
                      )}
                    </div>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-xs font-bold text-[#D62828] bg-[#FFF0F0] p-2 border border-[#D62828]">
              {error}
            </p>
          )}
        </div>

        {/* 弹窗底部操作栏 */}
        <footer className="p-4 bg-[#FAF9F5] border-t-2 border-[#121212] flex items-center justify-between gap-3 shrink-0">
          <div>
            {currentNameplate && (
              <button
                type="button"
                disabled={busy}
                onClick={handleUnequip}
                className="bauhaus-btn bg-white text-[#D62828] border-[#D62828] px-3 py-2 text-xs font-black hover:bg-[#FFF0F0]"
              >
                卸下铭牌
              </button>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={onClose}
              className="bauhaus-btn bg-white px-4 py-2 text-xs font-black hover:bg-[#F0EFEA]"
            >
              取消
            </button>
            <button
              type="button"
              disabled={busy || !isValid}
              onClick={handleEquip}
              className="bauhaus-btn bg-[#D62828] text-white px-5 py-2 text-xs font-black shadow-[3px_3px_0px_#121212] hover:bg-[#b81d1d] disabled:opacity-50"
            >
              {busy ? '保存中…' : '保存并佩戴'}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
};
