import { useRef, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { ImageCropper } from './ImageCropper';
import { useDialog } from './BauhausDialog';

interface StickerManagerProps {
  isMember: boolean;
  keys: string[];
  onChange: (keys: string[]) => void | Promise<unknown>;
  size?: 'sm' | 'md';
  hint?: string;
}

const ACCEPTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

/** 会员贴纸：两个等大的方形槽位，静图可裁剪，动图直接上传以保留动画。 */
export function StickerManager({ isMember, keys, onChange, size = 'md', hint }: StickerManagerProps) {
  const { showAlert } = useDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const slotRef = useRef(0);
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const box = size === 'sm' ? 'w-12 h-12' : 'w-16 h-16';

  const pick = (slot: number) => {
    if (!isMember) return;
    slotRef.current = slot;
    inputRef.current?.click();
  };

  const upload = async (file: File, slot: number) => {
    setBusy(true);
    try {
      const result = await api.upload(file);
      const next: string[] = [];
      for (let index = 0; index < 2; index++) {
        const value = index === slot ? result.imageKey : keys[index];
        if (value) next[index] = value;
      }
      await onChange(next.filter(Boolean).slice(0, 2));
    } catch (error) {
      showAlert({ title: '贴纸上传失败', message: error instanceof Error ? error.message : '请稍后重试', type: 'danger' });
    } finally {
      setBusy(false);
      setCropFile(null);
    }
  };

  const accept = (file: File, slot: number) => {
    if (!ACCEPTED.includes(file.type)) {
      showAlert({ title: '格式不支持', message: '请选择 PNG、JPG、GIF 或 WebP 图片', type: 'warning' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showAlert({ title: '图片过大', message: '贴纸请小于 2MB', type: 'warning' });
      return;
    }
    // 动图不裁剪，直接上传以保留动画；静图进入裁剪。
    if (file.type === 'image/gif') upload(file, slot);
    else setCropFile(file);
  };

  const remove = async (slot: number) => {
    setBusy(true);
    try {
      await onChange(keys.filter((_, index) => index !== slot).slice(0, 2));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="flex items-center gap-2">
        {[0, 1].map((slot) => (
          <div key={slot} className={`relative ${box} border-2 border-[#121212] bg-white flex items-center justify-center overflow-hidden ${isMember ? 'cursor-pointer hover:bg-[#F2F0E8]' : 'opacity-60'}`}>
            {keys[slot] ? (
              <>
                <img src={`/api/images/${keys[slot]}`} alt={`贴纸 ${slot + 1}`} className="w-full h-full object-cover" />
                {isMember && <button type="button" onClick={() => remove(slot)} className="absolute top-0 right-0 w-5 h-5 bg-[#D62828] text-white flex items-center justify-center cursor-pointer" aria-label={`移除贴纸 ${slot + 1}`}><Trash2 className="w-3 h-3" /></button>}
              </>
            ) : (
              <button type="button" disabled={!isMember || busy} onClick={() => pick(slot)} className="w-full h-full flex flex-col items-center justify-center text-[#888] gap-0.5 cursor-pointer disabled:cursor-not-allowed" aria-label={`上传贴纸 ${slot + 1}`}>
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span className="text-[10px] font-bold">{slot + 1}</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <p className="mt-1 text-[10px] text-[#666] leading-tight">
        {isMember ? (hint || '会员可佩戴 2 张贴纸，静图可裁剪，GIF 保留动画') : '会员专享：开通后可佩戴 2 张贴纸'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const slot = slotRef.current;
          event.target.value = '';
          if (file) accept(file, slot);
        }}
      />
      {cropFile && <ImageCropper file={cropFile} shape="sticker" onClose={() => setCropFile(null)} onConfirm={(file) => upload(file, slotRef.current)} />}
    </div>
  );
}
