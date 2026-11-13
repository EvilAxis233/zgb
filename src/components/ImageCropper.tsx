import { useEffect, useRef, useState } from 'react';
import { Minus, Move, Plus, RotateCcw, X } from 'lucide-react';

interface Props {
  file: File;
  shape: 'avatar' | 'cover' | 'sticker';
  onClose: () => void;
  onConfirm: (file: File) => void;
}

// 铭牌移到 ID 行后，两张贴纸独占整行；贴纸收短后实测约 166x48 ≈ 3.5:1，按同一比例裁剪才不会
// 让图片被压扁或裁掉（缩略图与发团预览也都用这个比例）。
export const STICKER_ASPECT = 3.5;
const sizes = { avatar: { width: 512, height: 512 }, cover: { width: 1200, height: 675 }, sticker: { width: 720, height: Math.round(720 / STICKER_ASPECT) } };
const titles = { avatar: '裁剪头像', cover: '裁剪团封面', sticker: '裁剪贴纸' };

// 缩放滑块用「相对铺满裁剪框的百分比」表示：0% = 刚好铺满（原来的 100%），
// -100% 缩到四分之一，竖图/长图也能整张完整显示、四周留白；+100% = 放大到 3 倍（原来的上限）。
// 负区间是后来补的：以前滑块只能从「铺满」往放大方向拉，没有缩小档位。
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 3;
const zoomOf = (percent: number) => percent >= 0
  ? 1 + (MAX_ZOOM - 1) * (percent / 100)
  : 1 - (1 - MIN_ZOOM) * (-percent / 100);

export function ImageCropper({ file, shape, onClose, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoomPercent, setZoomPercent] = useState(0);
  const zoom = zoomOf(zoomPercent);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [stickerPreview, setStickerPreview] = useState('');
  const { width, height } = sizes[shape];

  useEffect(() => {
    let active = true;
    const url = URL.createObjectURL(file);
    const nextImage = new Image();
    nextImage.onload = () => { if (active) setImage(nextImage); };
    nextImage.onerror = () => { if (active) setError('无法读取图片，请重新选择'); };
    nextImage.src = url;
    return () => { active = false; nextImage.onload = null; nextImage.onerror = null; URL.revokeObjectURL(url); };
  }, [file]);

  const bounds = (nextZoom: number) => {
    if (!image) return { x: 0, y: 0 };
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * nextZoom;
    // 缩小时图片比裁剪框小，取绝对值让用户仍能在留白范围内挪动图片（贴边），
    // 放大时与原逻辑一致：最多拖到图片边缘刚好贴住裁剪框。
    return {
      x: Math.abs((image.naturalWidth * scale - width) / 2),
      y: Math.abs((image.naturalHeight * scale - height) / 2),
    };
  };

  const clampOffset = (next: { x: number; y: number }, nextZoom: number) => {
    const limit = bounds(nextZoom);
    return {
      x: Math.max(-limit.x, Math.min(limit.x, next.x)),
      y: Math.max(-limit.y, Math.min(limit.y, next.y)),
    };
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const context = canvas.getContext('2d');
    if (!context) return;
    const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight) * zoom;
    const drawnWidth = image.naturalWidth * scale;
    const drawnHeight = image.naturalHeight * scale;
    const position = clampOffset(offset, zoom);
    context.clearRect(0, 0, width, height);
    // 缩小时图片四周会露出空白；先铺白底，否则导出 JPEG 时透明区域会变成黑块。
    // 预览画布的背景同步变白，做到所见即所得；不缩小时保持原有行为（含透明 PNG）。
    if (zoom < 1) {
      context.fillStyle = '#FFFFFF';
      context.fillRect(0, 0, width, height);
    }
    context.drawImage(image, (width - drawnWidth) / 2 + position.x, (height - drawnHeight) / 2 + position.y, drawnWidth, drawnHeight);
    if (shape === 'sticker') setStickerPreview(canvas.toDataURL('image/png'));
  }, [image, zoom, offset, width, height, shape]);

  const changeZoom = (nextPercent: number) => {
    const value = Math.max(-100, Math.min(100, Math.round(nextPercent)));
    setZoomPercent(value);
    setOffset((current) => clampOffset(current, zoomOf(value)));
  };

  const reset = () => {
    setZoomPercent(0);
    setOffset({ x: 0, y: 0 });
  };

  const moveImage = (dx: number, dy: number) => {
    setOffset((current) => clampOffset({ x: current.x + dx, y: current.y + dy }, zoom));
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    setSaving(true);
    setError('');
    try {
      let blob: Blob | null = null;
      const outputType = shape === 'sticker' ? 'image/png' : 'image/jpeg';
      for (const quality of [0.85, 0.7, 0.55]) {
        blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((result) => result ? resolve(result) : reject(new Error('图片处理失败')), outputType, quality);
        });
        if (blob.size <= 2 * 1024 * 1024) break;
      }
      if (!blob || blob.size > 2 * 1024 * 1024) throw new Error('裁剪后的图片超过 2MB，请换一张图片');
      onConfirm(new File([blob], `${shape}-${Date.now()}.${shape === 'sticker' ? 'png' : 'jpg'}`, { type: outputType }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '图片处理失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={titles[shape]}>
      <div className="w-full max-w-xl max-h-[95vh] overflow-y-auto bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212]">
        <div className="bg-[#121212] text-white px-4 py-3 flex items-center justify-between">
          <strong>{titles[shape]}</strong>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#222] hover:bg-[#D62828]" aria-label="取消裁剪"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <p className="flex items-start gap-2 text-xs text-[#555]"><Move className="mt-0.5 h-4 w-4 shrink-0 text-[#004E98]" /><span>{shape === 'sticker' ? '贴纸在发团卡片上独占整行、约 166×48（宽:高 3.5:1），这里按同样比例裁剪。' : ''}拖动图片调整取景位置；下方滑块 0% 为刚好铺满，往左到 -100% 可把整张图缩小完整显示（四周补白底），往右到 +100% 放大。{shape === 'sticker' ? '下面可预览发团后的实际效果。' : '也可聚焦图片后用方向键微调。'}</span></p>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            tabIndex={0}
            role="img"
            aria-label="图片裁剪区域，可拖动或使用方向键调整位置"
            className={`block mx-auto max-w-full bg-[#EAE8E0] border-2 border-[#121212] cursor-grab active:cursor-grabbing select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#004E98] ${shape === 'cover' ? 'w-full' : shape === 'sticker' ? 'w-full h-auto' : 'w-72'}`}
            style={{ touchAction: 'none', ...(zoom < 1 ? { backgroundColor: '#FFFFFF' } : {}) }}
            onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); dragRef.current = { x: event.clientX, y: event.clientY }; }}
            onPointerMove={(event) => {
              if (!dragRef.current) return;
              const factor = width / event.currentTarget.getBoundingClientRect().width;
              const dx = (event.clientX - dragRef.current.x) * factor;
              const dy = (event.clientY - dragRef.current.y) * factor;
              dragRef.current = { x: event.clientX, y: event.clientY };
              setOffset((current) => clampOffset({ x: current.x + dx, y: current.y + dy }, zoom));
            }}
            onPointerUp={() => { dragRef.current = null; }}
            onPointerCancel={() => { dragRef.current = null; }}
            onKeyDown={(event) => {
              const step = event.shiftKey ? 20 : 5;
              if (event.key === 'ArrowLeft') moveImage(-step, 0);
              else if (event.key === 'ArrowRight') moveImage(step, 0);
              else if (event.key === 'ArrowUp') moveImage(0, -step);
              else if (event.key === 'ArrowDown') moveImage(0, step);
              else return;
              event.preventDefault();
            }}
          />
          {shape === 'sticker' && (
            <div className="border-2 border-dashed border-[#121212] bg-[#FAF9F5] p-2">
              <p className="mb-2 text-[10px] font-black text-[#666]">发团卡片上的实际效果（贴纸独占整行，约 166×48，圆角无边框）</p>
              {[1, 2].map((count) => (
                <div key={count} className="mb-1.5 flex items-center gap-2 last:mb-0">
                  <span className="w-7 shrink-0 text-[10px] font-bold text-[#666]">{count} 张</span>
                  <div className="flex h-14 w-[338px] max-w-full items-center gap-1.5">
                    {Array.from({ length: count }, (_, index) => (
                      <span key={index} className="block h-12 min-w-0 flex-1 overflow-hidden rounded-lg">
                        {stickerPreview && <img src={stickerPreview} alt="" className="h-full w-full object-cover" />}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <p className="mt-1.5 text-[10px] text-[#666]">贴纸在卡片上按 3.5:1 铺满、四角带圆角；只贴 1 张时会更扁、两侧略被裁掉，主要内容请放在中间。想保留整张图不裁切，可把缩放拉到 0% 以下（四周补白底）。</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => changeZoom(zoomPercent - 10)} disabled={zoomPercent <= -100} className="bauhaus-btn w-8 h-8 bg-white disabled:opacity-40" aria-label="缩小"><Minus className="w-4 h-4" /></button>
            <input type="range" min="-100" max="100" step="1" value={zoomPercent} onChange={(event) => changeZoom(Number(event.target.value))} className="flex-1 accent-[#004E98]" aria-label="缩放图片" />
            <button type="button" onClick={() => changeZoom(zoomPercent + 10)} disabled={zoomPercent >= 100} className="bauhaus-btn w-8 h-8 bg-white disabled:opacity-40" aria-label="放大"><Plus className="w-4 h-4" /></button>
            <span className="w-14 text-right text-xs font-bold">{zoomPercent > 0 ? '+' : ''}{zoomPercent}%</span>
          </div>
          <p className="-mt-2 flex justify-between px-11 text-[10px] font-bold text-[#666]"><span>-100% 缩小</span><span>0% 铺满</span><span>+100% 放大</span></p>
          <div className="flex justify-center">
            <button type="button" onClick={reset} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#004E98] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#004E98]"><RotateCcw className="h-3.5 w-3.5" />恢复居中</button>
          </div>
          {error && <p role="alert" className="text-xs font-bold text-[#D62828]">{error}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className="bauhaus-btn bg-white px-4 py-2 text-xs">取消</button>
            <button type="button" onClick={save} disabled={!image || saving} className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-xs disabled:opacity-50">{saving ? '处理中…' : '使用这张图片'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
