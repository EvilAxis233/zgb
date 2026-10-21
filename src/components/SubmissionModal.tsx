import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { Flag, ImagePlus, MessageSquareText, X } from 'lucide-react';

interface SubmissionModalProps {
  type: 'feedback' | 'report' | null;
  onClose: () => void;
  onSubmit: (type: 'feedback' | 'report', content: string, images: File[]) => Promise<boolean>;
}

const MAX_FILES = 9;
const MAX_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export function SubmissionModal({ type, onClose, onSubmit }: SubmissionModalProps) {
  const [content, setContent] = useState('');
  const [images, setImages] = useState<File[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const previews = useMemo(() => images.map((file) => ({ file, url: URL.createObjectURL(file) })), [images]);

  useEffect(() => () => previews.forEach(({ url }) => URL.revokeObjectURL(url)), [previews]);
  useEffect(() => { setContent(''); setImages([]); setError(''); setBusy(false); }, [type]);
  useEffect(() => {
    if (!type) return;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [type, busy, onClose]);

  if (!type) return null;
  const isReport = type === 'report';
  const title = isReport ? '举报不当内容' : '提交反馈';

  const selectImages = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []);
    event.target.value = '';
    if (images.length + selected.length > MAX_FILES) return setError(`最多上传 ${MAX_FILES} 张图片`);
    if (selected.some((file) => !ACCEPTED_TYPES.includes(file.type))) return setError('仅支持 PNG、JPG、GIF、WebP 图片');
    if (selected.some((file) => file.size > MAX_SIZE)) return setError('每张图片不能超过 5MB');
    setError('');
    setImages((current) => [...current, ...selected]);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!content.trim()) return setError(isReport ? '请填写举报说明' : '请填写反馈内容');
    if (isReport && !images.length) return setError('举报至少需要上传 1 张图片');
    setBusy(true); setError('');
    try {
      if (await onSubmit(type, content.trim(), images)) onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/55 p-4 flex items-center justify-center" role="dialog" aria-modal="true" aria-labelledby="submission-title" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <section className="bauhaus-card bg-white w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 sm:p-7">
        <header className="flex items-start justify-between gap-4 border-b-2 border-[#121212] pb-4">
          <div className="flex items-center gap-3">
            <span className={`w-10 h-10 border-2 border-[#121212] flex items-center justify-center ${isReport ? 'bg-[#D62828] text-white' : 'bg-[#004E98] text-white'}`}>
              {isReport ? <Flag size={20} /> : <MessageSquareText size={20} />}
            </span>
            <div><h2 id="submission-title" className="text-xl font-black">{title}</h2><p className="text-xs text-[#666] mt-1">提交后可由管理员在后台受理</p></div>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="关闭" className="p-1 cursor-pointer hover:bg-[#EEE]"><X /></button>
        </header>

        <form onSubmit={submit} className="mt-5 space-y-5">
          <div>
            <label htmlFor="submission-content" className="block text-sm font-black mb-2">{isReport ? '举报说明' : '反馈内容'} <span className="text-[#D62828]">*</span></label>
            <textarea id="submission-content" required maxLength={5000} rows={6} value={content} onChange={(event) => setContent(event.target.value)} placeholder={isReport ? '请描述被举报的内容、所在页面及具体原因…' : '请描述你的建议、遇到的问题或希望改进的地方…'} className="bauhaus-input w-full px-3 py-2.5 text-sm resize-y" />
            <div className="mt-1 flex justify-between text-[11px] text-[#777]"><span>请勿在内容中填写密码等敏感信息</span><span>{content.length} / 5000</span></div>
          </div>

          <div>
            <div className="flex items-end justify-between gap-3 mb-2">
              <div><span className="block text-sm font-black">上传图片 {isReport && <span className="text-[#D62828]">*</span>}</span><span className="text-[11px] text-[#666]">最多 9 张，每张不超过 5MB</span></div>
              <span className="text-xs font-bold">{images.length} / {MAX_FILES}</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
              {previews.map(({ file, url }, index) => (
                <div key={`${file.name}-${file.lastModified}-${index}`} className="relative aspect-square border-2 border-[#121212] bg-[#F2F0E8] overflow-hidden">
                  <img src={url} alt={`已选图片 ${index + 1}`} className="w-full h-full object-cover" />
                  <button type="button" aria-label={`移除图片 ${index + 1}`} onClick={() => setImages((current) => current.filter((_, itemIndex) => itemIndex !== index))} className="absolute top-1 right-1 w-6 h-6 border border-[#121212] bg-white flex items-center justify-center cursor-pointer"><X size={14} /></button>
                </div>
              ))}
              {images.length < MAX_FILES && (
                <label className="aspect-square border-2 border-dashed border-[#777] bg-[#FAF9F5] hover:border-[#004E98] flex flex-col items-center justify-center gap-1 text-xs font-bold cursor-pointer">
                  <ImagePlus size={22} /><span>选择图片</span>
                  <input className="sr-only" type="file" accept="image/png,image/jpeg,image/gif,image/webp" multiple onChange={selectImages} />
                </label>
              )}
            </div>
          </div>

          {error && <p role="alert" className="border-2 border-[#D62828] bg-[#FAF0F0] text-[#B51F1F] px-3 py-2 text-sm font-bold">{error}</p>}
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-2 border-t border-[#DDD]">
            <button type="button" onClick={onClose} disabled={busy} className="bauhaus-btn bg-white px-5 py-2.5">取消</button>
            <button type="submit" disabled={busy} className={`bauhaus-btn text-white px-6 py-2.5 ${isReport ? 'bg-[#D62828]' : 'bg-[#004E98]'}`}>{busy ? '正在提交…' : isReport ? '提交举报' : '提交反馈'}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
