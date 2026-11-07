import { useRef, useState } from 'react';
import { Check, Loader2, Plus, Trash2 } from 'lucide-react';
import { api } from '../services/api';
import { ImageCropper } from './ImageCropper';
import { useDialog } from './BauhausDialog';

const ACCEPTED = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
export const STICKER_LIBRARY_LIMIT = 10;
export const STICKER_DEFAULT_LIMIT = 2;

interface StickerLibraryProps {
  isMember: boolean;
  library: string[];
  defaults: string[];
  onChangeLibrary: (keys: string[]) => void | Promise<unknown>;
  onChangeDefaults: (keys: string[]) => void | Promise<unknown>;
}

/** 个人资料里的贴纸库：最多预存 10 张，其中最多 2 张设为默认佩戴。 */
export function StickerLibrary({ isMember, library, defaults, onChangeLibrary, onChangeDefaults }: StickerLibraryProps) {
  const { showAlert } = useDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [cropFile, setCropFile] = useState<File | null>(null);

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const result = await api.upload(file);
      await onChangeLibrary([...library, result.imageKey].slice(0, STICKER_LIBRARY_LIMIT));
    } catch (error) {
      showAlert({ title: '贴纸上传失败', message: error instanceof Error ? error.message : '请稍后重试', type: 'danger' });
    } finally {
      setBusy(false);
      setCropFile(null);
    }
  };

  const accept = (file: File) => {
    if (!ACCEPTED.includes(file.type)) {
      showAlert({ title: '格式不支持', message: '请选择 PNG、JPG、GIF 或 WebP 图片', type: 'warning' });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showAlert({ title: '图片过大', message: '贴纸请小于 2MB', type: 'warning' });
      return;
    }
    if (file.type === 'image/gif') upload(file);
    else setCropFile(file);
  };

  const toggleDefault = async (key: string) => {
    if (!isMember) return;
    if (defaults.includes(key)) {
      await onChangeDefaults(defaults.filter((item) => item !== key));
      return;
    }
    if (defaults.length >= STICKER_DEFAULT_LIMIT) {
      showAlert({ title: '默认贴纸已满', message: `默认佩戴最多 ${STICKER_DEFAULT_LIMIT} 张，请先取消一张`, type: 'warning' });
      return;
    }
    await onChangeDefaults([...defaults, key]);
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {library.map((key) => {
          const order = defaults.indexOf(key);
          return (
            <div key={key} className={`relative aspect-[5/1] border-2 bg-white overflow-hidden ${order >= 0 ? 'border-[#D62828]' : 'border-[#121212]'}`}>
              <button
                type="button"
                onClick={() => toggleDefault(key)}
                disabled={!isMember}
                className="block w-full h-full cursor-pointer disabled:cursor-not-allowed"
                title={order >= 0 ? '点击取消默认佩戴' : '点击设为默认佩戴'}
                aria-label={order >= 0 ? '取消默认佩戴' : '设为默认佩戴'}
              >
                <img src={`/api/images/${key}`} alt="贴纸" className="w-full h-full object-cover" />
                {order >= 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-[#D62828] text-white text-[10px] font-black text-center leading-4">
                    默认 {defaults.length > 1 ? order + 1 : ''}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onChangeLibrary(library.filter((item) => item !== key))}
                className="absolute top-0 right-0 w-5 h-5 bg-[#121212] text-white flex items-center justify-center cursor-pointer hover:bg-[#D62828]"
                aria-label="从贴纸库删除"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
        {library.length < STICKER_LIBRARY_LIMIT && (
          <button
            type="button"
            disabled={!isMember || busy}
            onClick={() => inputRef.current?.click()}
            className="aspect-[5/1] border-2 border-dashed border-[#121212] bg-[#FAF9F5] flex flex-col items-center justify-center gap-0.5 text-[#666] cursor-pointer hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="上传贴纸到贴纸库"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="text-[10px] font-bold">{library.length}/{STICKER_LIBRARY_LIMIT}</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-[10px] text-[#666] leading-relaxed">
        {isMember
          ? `最多预存 ${STICKER_LIBRARY_LIMIT} 张；点图片设为默认佩戴（最多 ${STICKER_DEFAULT_LIMIT} 张），发团时可以从库里临时改选，不影响默认。静图按发团长条比例（5:1）裁剪，GIF 保留动画但不会裁剪，请自行做成 5:1 长条。`
          : '会员专享：开通后可预存 10 张贴纸，并选 2 张默认佩戴'}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) accept(file);
        }}
      />
      {cropFile && <ImageCropper file={cropFile} shape="sticker" onClose={() => setCropFile(null)} onConfirm={(file) => upload(file)} />}
    </div>
  );
}

interface StickerPickerProps {
  library: string[];
  value: string[];
  onChange: (keys: string[]) => void;
}

/** 发团页里的贴纸选择：只能从贴纸库挑，最多 2 张，不能现场上传。 */
export function StickerPicker({ library, value, onChange }: StickerPickerProps) {
  const toggle = (key: string) => {
    if (value.includes(key)) return onChange(value.filter((item) => item !== key));
    if (value.length >= STICKER_DEFAULT_LIMIT) return;
    onChange([...value, key]);
  };

  if (!library.length) {
    return <p className="border-2 border-dashed border-[#121212] bg-[#FAF9F5] px-3 py-2 text-[11px] font-bold text-[#666]">贴纸库还是空的，先去「个人资料 → 贴纸」上传，发团时只能从库里选。</p>;
  }

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        {library.map((key) => {
          const order = value.indexOf(key);
          return (
            <button
              key={key}
              type="button"
              onClick={() => toggle(key)}
              className={`relative aspect-[5/1] border-2 bg-white overflow-hidden cursor-pointer ${order >= 0 ? 'border-[#D62828]' : 'border-[#121212] hover:border-[#004E98]'}`}
              aria-pressed={order >= 0}
              aria-label={order >= 0 ? '取消本团使用' : '本团使用这张贴纸'}
              title={order >= 0 ? '点击取消' : '点击使用'}
            >
              <img src={`/api/images/${key}`} alt="贴纸" className="w-full h-full object-cover" />
              {order >= 0 && (
                <span className="absolute top-0 right-0 w-4 h-4 bg-[#D62828] text-white flex items-center justify-center"><Check className="w-3 h-3" /></span>
              )}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[10px] text-[#666]">
        {value.length ? `本团使用 ${value.length} 张（不改默认佩戴）` : '不选则使用默认佩戴的贴纸'}
      </p>
    </div>
  );
}
