import { useEffect, useRef, useState } from 'react';
import { Minus, Move, Plus, RotateCcw, X } from 'lucide-react';

interface Props {
  file: File;
  shape: 'avatar' | 'cover' | 'sticker';
  onClose: () => void;
  onConfirm: (file: File) => void;
}

const sizes = { avatar: { width: 512, height: 512 }, cover: { width: 1200, height: 675 }, sticker: { width: 256, height: 256 } };
const titles = { avatar: '裁剪头像', cover: '裁剪团封面', sticker: '裁剪贴纸' };

export function ImageCropper({ file, shape, onClose, onConfirm }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
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
    return {
      x: Math.max(0, (image.naturalWidth * scale - width) / 2),
      y: Math.max(0, (image.naturalHeight * scale - height) / 2),
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
    context.drawImage(image, (width - drawnWidth) / 2 + position.x, (height - drawnHeight) / 2 + position.y, drawnWidth, drawnHeight);
  }, [image, zoom, offset, width, height]);

  const changeZoom = (nextZoom: number) => {
    const value = Math.max(1, Math.min(3, nextZoom));
    setZoom(value);
    setOffset((current) => clampOffset(current, value));
  };

  const reset = () => {
    setZoom(1);
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4" role="dialog" aria-modal="true" aria-label={titles[shape]}>
      <div className="w-full max-w-xl max-h-[95vh] overflow-y-auto bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212]">
        <div className="bg-[#121212] text-white px-4 py-3 flex items-center justify-between">
          <strong>{titles[shape]}</strong>
          <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#222] hover:bg-[#D62828]" aria-label="取消裁剪"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 sm:p-5 space-y-4">
          <p className="flex items-center gap-2 text-xs text-[#555]"><Move className="h-4 w-4 shrink-0 text-[#004E98]" />拖动图片调整取景位置，使用下方滑块缩放；也可聚焦图片后用方向键微调。</p>
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            tabIndex={0}
            role="img"
            aria-label="图片裁剪区域，可拖动或使用方向键调整位置"
            className={`block mx-auto max-w-full bg-[#EAE8E0] border-2 border-[#121212] cursor-grab active:cursor-grabbing select-none focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#004E98] ${shape === 'cover' ? 'w-full' : shape === 'sticker' ? 'w-56' : 'w-72'}`}
            style={{ touchAction: 'none' }}
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
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => changeZoom(zoom - 0.1)} className="bauhaus-btn w-8 h-8 bg-white" aria-label="缩小"><Minus className="w-4 h-4" /></button>
            <input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => changeZoom(Number(event.target.value))} className="flex-1 accent-[#004E98]" aria-label="缩放图片" />
            <button type="button" onClick={() => changeZoom(zoom + 0.1)} className="bauhaus-btn w-8 h-8 bg-white" aria-label="放大"><Plus className="w-4 h-4" /></button>
            <span className="text-xs font-bold w-10 text-right">{Math.round(zoom * 100)}%</span>
          </div>
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
