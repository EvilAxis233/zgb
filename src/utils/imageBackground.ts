// 头像 / 封面最终存成 JPEG，而浏览器把画布上的透明区域编码进 JPEG 时会填成纯黑，
// 于是「上传透明 PNG 头像」就变成了「黑底头像」。这里提供两个处理：
// 1) flattenToWhite：先把画布铺成白底再画图，透明处直接变白（根因修复）。
// 2) whitenEdgeBlack：原图本身就是不透明的纯黑背景（比如从表情包导出的 PNG）时，
//    把「与边缘连通的黑底」刷成白色，主体内部的黑色保持不变。
//    只有边缘几乎全是纯黑、且黑底占比不过分（说明黑的是背景不是主体）时才动手，避免误伤暗色照片。
const NEAR_BLACK = 26; // 判定「这是黑底」的亮度上限
const SOFT_EDGE = 46; // 抗锯齿过渡带：一起刷掉，并按亮度做过渡避免锯齿
const MAX_FILL_RATIO = 0.9; // 黑底占了九成以上 → 认为黑的是主体，放弃处理

const lumaAt = (data: Uint8ClampedArray, p: number) => {
  const i = p * 4;
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
};

export const flattenToWhite = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
  ctx.save();
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
};

/** 把与画布边缘连通的纯黑区域刷白；没有把握时返回 false 且不改动画布。 */
export const whitenEdgeBlack = (ctx: CanvasRenderingContext2D, width: number, height: number): boolean => {
  if (width <= 0 || height <= 0) return false;
  let image: ImageData;
  try {
    image = ctx.getImageData(0, 0, width, height);
  } catch {
    return false; // 跨域图片会抛 SecurityError，直接跳过
  }
  const { data } = image;

  // 1) 四边必须压倒性地是纯黑，否则当正常图片放过
  let edge = 0;
  let edgeBlack = 0;
  const countEdge = (p: number) => { edge++; if (lumaAt(data, p) <= NEAR_BLACK) edgeBlack++; };
  for (let x = 0; x < width; x++) { countEdge(x); countEdge((height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { countEdge(y * width); countEdge(y * width + width - 1); }
  if (!edge || edgeBlack / edge < 0.85) return false;

  // 2) 从边缘向内漫水，只吃与边缘连通的近黑像素
  const total = width * height;
  const seen = new Uint8Array(total);
  const stack: number[] = [];
  const push = (x: number, y: number) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const p = y * width + x;
    if (seen[p] || lumaAt(data, p) > SOFT_EDGE) return;
    seen[p] = 1;
    stack.push(p);
  };
  for (let x = 0; x < width; x++) { push(x, 0); push(x, height - 1); }
  for (let y = 0; y < height; y++) { push(0, y); push(width - 1, y); }
  let filled = 0;
  while (stack.length) {
    const p = stack.pop() as number;
    filled++;
    const x = p % width;
    const y = (p - x) / width;
    push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
  }

  // 3) 几乎整张都被吃掉 → 黑的是主体，还原不动
  if (!filled || filled / total > MAX_FILL_RATIO) return false;

  // 4) 刷白：纯黑直接变白，过渡带按亮度线性过渡，保留柔和边缘
  for (let p = 0; p < total; p++) {
    if (!seen[p]) continue;
    const i = p * 4;
    const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const t = l <= NEAR_BLACK ? 1 : (SOFT_EDGE - l) / (SOFT_EDGE - NEAR_BLACK);
    data[i] = data[i] + (255 - data[i]) * t;
    data[i + 1] = data[i + 1] + (255 - data[i + 1]) * t;
    data[i + 2] = data[i + 2] + (255 - data[i + 2]) * t;
  }
  ctx.putImageData(image, 0, 0);
  return true;
};
