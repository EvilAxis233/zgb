import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Plus, Trash2, Upload } from 'lucide-react';
import type { UserProfile } from '../types';
import { api } from '../services/api';
import { ImageCropper } from './ImageCropper';
import { useDialog } from './BauhausDialog';
import { acceptedImage, isAnimatedImage, normalizeImageFile, MAX_ANIMATED_BYTES, MAX_STATIC_BYTES } from '../utils/animatedImage';
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

  const accept = async (selected: File) => {
    const file = normalizeImageFile(selected);
    if (!file || !acceptedImage(file)) {
      showAlert({ title: '格式不支持', message: '请选择 PNG、JPG、GIF 或 WebP 图片', type: 'warning' });
      return;
    }
    // 动态图不能走 canvas 裁剪，否则只剩第一帧；静态图会裁剪压缩到 2MB 内。
    const animated = await isAnimatedImage(file);
    if (file.size > (animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES)) {
      showAlert({ title: '图片过大', message: animated ? '动态贴纸不会压缩，请小于 8MB' : '原图请小于 20MB', type: 'warning' });
      return;
    }
    if (animated) upload(file);
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
            <div key={key} className={`relative aspect-[7/2] rounded border-2 bg-white overflow-hidden ${order >= 0 ? 'border-[#D62828]' : 'border-[#121212]'}`}>
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
            className="aspect-[7/2] rounded border-2 border-dashed border-[#121212] bg-[#FAF9F5] flex flex-col items-center justify-center gap-0.5 text-[#666] cursor-pointer hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="上传贴纸到贴纸库"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            <span className="text-[10px] font-bold">{library.length}/{STICKER_LIBRARY_LIMIT}</span>
          </button>
        )}
      </div>
      <p className="mt-2 text-[10px] text-[#666] leading-relaxed">
        {isMember
          ? `最多预存 ${STICKER_LIBRARY_LIMIT} 张；点图片设为默认佩戴（最多 ${STICKER_DEFAULT_LIMIT} 张）。发车 / 编辑车现场上传并裁剪的贴纸也会自动存进这里，都不改变默认佩戴。静图按发团卡片的贴纸尺寸（约 166×48、3.5:1）裁剪，GIF 保留动画但不会裁剪，请自行做成 3.5:1 长条。`
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
      {/* 挂到 body：手机端弹窗的 overflow / backdrop-filter 会把 fixed 的裁剪器裁掉 */}
      {cropFile && createPortal(<ImageCropper file={cropFile} shape="sticker" onClose={() => setCropFile(null)} onConfirm={(file) => upload(file)} />, document.body)}
    </div>
  );
}

interface StickerPickerProps {
  library: string[];
  value: string[];
  onChange: (keys: string[]) => void;
  /** 发车 / 编辑车时允许现场上传并裁剪贴纸。 */
  allowUpload?: boolean;
  /** 上传会把贴纸存进个人贴纸库，后端返回最新用户资料，同步回全局状态。 */
  onUserUpdate?: (user: UserProfile) => void;
}

/**
 * 手机相册里常见 HEIC / HEIF，Safari 有时不会转成 JPEG。
 * 先尽力解码成 PNG，再走同一套裁剪流程，避免「选了图却提示格式不支持」。
 */
async function toSupportedStickerFile(input: File): Promise<File | undefined> {
  const file = normalizeImageFile(input);
  if (!file) return undefined;
  if (acceptedImage(file)) return file;
  if (!String(file.type || '').startsWith('image/')) return undefined;
  try {
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d');
    if (!context) { bitmap.close(); return undefined; }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    return blob ? new File([blob], 'sticker.png', { type: 'image/png' }) : undefined;
  } catch {
    return undefined;
  }
}

/** 发车 / 编辑车的贴纸选择：现场上传裁剪并自动存进贴纸库，或从库里挑，最多 2 张。 */
export function StickerPicker({ library, value, onChange, allowUpload = true, onUserUpdate }: StickerPickerProps) {
  const { showAlert } = useDialog();
  const inputRef = useRef<HTMLInputElement>(null);
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploaded, setUploaded] = useState<string[]>([]);
  const [uploadNote, setUploadNote] = useState('');
  // 贴纸库 + 本次现场上传 + 团上已挂的贴纸，都能在这里看见和取消。
  const keys = [...new Set([...library, ...uploaded, ...value])];

  const toggle = (key: string) => {
    if (value.includes(key)) { onChange(value.filter((item) => item !== key)); return; }
    if (value.length >= STICKER_DEFAULT_LIMIT) {
      showAlert({ title: '最多 2 张', message: '本团最多使用 2 张贴纸，请先取消一张再选', type: 'warning' });
      return;
    }
    onChange([...value, key]);
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      // saveToLibrary：后端一次完成上传 + 写入个人贴纸库（10 张上限），返回最新用户资料。
      const result = await api.upload(file, true);
      if (result.user) onUserUpdate?.(result.user);
      setUploadNote(result.libraryNote || '');
      setUploaded((previous) => [...previous, result.imageKey]);
      if (value.length < STICKER_DEFAULT_LIMIT) onChange([...value, result.imageKey]);
      else showAlert({ title: '上传成功', message: `本团已选满 ${STICKER_DEFAULT_LIMIT} 张，新贴纸已存入贴纸库并在下方列表，取消一张后即可选用`, type: 'warning' });
    } catch (error) {
      showAlert({ title: '贴纸上传失败', message: error instanceof Error ? error.message : '请稍后重试', type: 'danger' });
    } finally {
      setBusy(false);
      setCropFile(null);
    }
  };

  const accept = async (selected?: File | null) => {
    if (!selected) return;
    const file = await toSupportedStickerFile(selected);
    if (!file || !acceptedImage(file)) {
      showAlert({ title: '格式不支持', message: '请选择 PNG、JPG、GIF、WebP 图片，手机相册照片也可以直接选', type: 'warning' });
      return;
    }
    // 动图原样上传（canvas 裁剪只会保留第一帧）；静图进 3.5:1 裁剪器。
    const animated = await isAnimatedImage(file);
    if (file.size > (animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES)) {
      showAlert({ title: '图片过大', message: animated ? '动态贴纸不会压缩，请小于 8MB' : '原图请小于 20MB', type: 'warning' });
      return;
    }
    if (animated) await upload(file);
    else setCropFile(file);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#666]">已选 {value.length}/{STICKER_DEFAULT_LIMIT} 张{library.length ? ` · 贴纸库 ${library.length} 张` : ''}</span>
        {value.length > 0 && (
          <button type="button" onClick={() => onChange([])} className="min-h-[32px] border border-[#D62828] bg-[#FAF0F0] px-2.5 text-[11px] font-bold text-[#D62828] cursor-pointer hover:bg-[#FBE0E0]">清空</button>
        )}
      </div>
      {keys.length > 0 && (
        <div className="grid grid-cols-2 gap-2">
          {keys.map((key) => {
            const selected = value.includes(key);
            return (
              <button
                key={key}
                type="button"
                onClick={() => toggle(key)}
                className={`relative aspect-[7/2] min-h-[52px] w-full overflow-hidden rounded border-2 bg-white cursor-pointer ${selected ? 'border-[#D62828] shadow-[2px_2px_0px_#D62828]' : 'border-[#121212] hover:border-[#004E98]'}`}
                aria-pressed={selected}
                aria-label={selected ? '取消本团使用' : '本团使用这张贴纸'}
                title={selected ? '点击取消' : '点击使用'}
              >
                <img src={`/api/images/${key}`} alt="贴纸" className="absolute inset-0 h-full w-full object-cover" />
                <span className={`absolute bottom-0 right-0 flex min-h-[20px] items-center px-1.5 text-[10px] font-black ${selected ? 'bg-[#D62828] text-white' : 'bg-[#121212]/70 text-white'}`}>
                  {selected ? '已选用' : '点击选用'}
                </span>
              </button>
            );
          })}
        </div>
      )}
      {allowUpload && (
        <button
          type="button"
          disabled={busy}
          onClick={() => inputRef.current?.click()}
          className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2 border-2 border-dashed border-[#004E98] bg-[#F0F5FA] px-3 text-center text-xs font-black text-[#004E98] cursor-pointer active:bg-[#E1ECFA] disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {busy ? '上传中…' : '上传并裁剪新贴纸（自动存入贴纸库）'}
        </button>
      )}
      <p className="mt-1.5 text-[10px] leading-relaxed text-[#666]">
        {keys.length
          ? '点图片选用 / 取消，本团最多 2 张；上传的贴纸按 3.5:1 裁剪并自动存入贴纸库（最多 10 张），不改变默认佩戴。手机可直接从相册选图。'
          : '贴纸库是空的：直接上传并裁剪即可自动存入贴纸库，或到「个人资料 → 贴纸」预存。'}
        {uploadNote && <span className="mt-1 block font-bold text-[#004E98]">{uploadNote}</span>}
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void accept(file); }}
      />
      {/* 裁剪器挂到 body，绕开手机端弹窗的滚动容器与 backdrop-filter 裁剪 */}
      {cropFile && createPortal(
        <ImageCropper file={cropFile} shape="sticker" onClose={() => setCropFile(null)} onConfirm={(file) => { void upload(file); }} />,
        document.body
      )}
    </div>
  );
}
