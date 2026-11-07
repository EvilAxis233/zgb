/**
 * 动态图片识别与上传体积限制。
 *
 * GIF / APNG / 动态 WebP 一旦经过 ImageCropper 的 canvas 导出（JPEG/PNG），
 * 就只剩第一帧，会员上传的「动态头像 / 动态封面」看起来就是静止的。
 * 这类文件必须跳过裁剪、原样上传到 R2。
 *
 * 不能只信 file.type：部分系统（从聊天软件另存、或 MIME 注册表缺失时）
 * 会把 .gif 报成空字符串或 application/octet-stream，因此读文件头兜底，
 * 并把缺失的 MIME 补回来，否则 FileReader 会生成非 image/ 前缀的 dataURL。
 */

// 动态图不做压缩，直传上限；静态图会先进裁剪器压缩到 2MB 内，可以放宽原图。
export const MAX_ANIMATED_BYTES = 8 * 1024 * 1024;
export const MAX_STATIC_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];
const EXT_TYPE: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp',
};

export const acceptedImage = (file: File): boolean =>
  IMAGE_TYPES.includes(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name || '');

/** 从 File 读取可靠的 MIME（file.type 缺失或不可用时按扩展名兜底）。 */
export const reliableImageType = (file: File): string =>
  IMAGE_TYPES.includes(file.type) ? file.type : (EXT_TYPE[String(file.name || '').split('.').pop()?.toLowerCase() || ''] || '');

/** 补齐 MIME：保证 FileReader 生成 data:image/... 前缀、FormData 上传时后端能识别格式。 */
export const normalizeImageFile = (input?: File | null): File | undefined => {
  if (!input) return undefined;
  const type = reliableImageType(input);
  return type && !IMAGE_TYPES.includes(input.type) ? new File([input], input.name || `image.${type.split('/')[1]}`, { type }) : input;
};

const hasBytes = (bytes: Uint8Array, needle: string): boolean => {
  const target = needle.split('').map((character) => character.charCodeAt(0));
  for (let i = 0; i <= bytes.length - target.length; i++) {
    let matched = true;
    for (let j = 0; j < target.length; j++) {
      if (bytes[i + j] !== target[j]) { matched = false; break; }
    }
    if (matched) return true;
  }
  return false;
};

/** 异步：读取文件头，识别 GIF / APNG(acTL) / 动画 WebP(ANIM)。 */
export async function isAnimatedImage(file: File): Promise<boolean> {
  if (file.type === 'image/gif' || /\.gif$/i.test(file.name || '')) return true;
  try {
    // 这几个标记都在文件头部，读 8KB 足够，也避免扫到压缩数据里的巧合字节。
    const head = new Uint8Array(await file.slice(0, 8192).arrayBuffer());
    if (head.length < 12) return false;
    const signature = Array.from(head.slice(0, 6)).map((byte) => String.fromCharCode(byte)).join('');
    if (signature === 'GIF87a' || signature === 'GIF89a') return true;
    if (signature.startsWith('\x89PNG')) return hasBytes(head, 'acTL');
    if (hasBytes(head.slice(0, 12), 'RIFF') && hasBytes(head.slice(0, 16), 'WEBP')) return hasBytes(head, 'ANIM');
    return false;
  } catch {
    return false;
  }
}
