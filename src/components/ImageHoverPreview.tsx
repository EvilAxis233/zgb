import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  /** 原图地址（与卡片里被 object-cover 裁过的是同一张图）。 */
  src: string;
  /** 包裹层的样式，必须自己给出尺寸，避免改变原有排版。 */
  className?: string;
  label?: string;
  children: ReactNode;
  /** 悬停多久后弹出，默认 1000ms。 */
  delay?: number;
}

/**
 * 鼠标悬停 1 秒查看原图：卡片里的封面和贴纸都是被裁剪过的缩略图，
 * 这里把同一张图用 object-contain 完整展示，GIF 等动图仍会正常播放。
 * 浮层挂到 body 且 pointer-events-none：不会被弹窗 overflow 裁掉，也不挡点击。
 * 移动端没有 hover，touch 时只做清理，不干扰滚动与点击。
 */
export function ImageHoverPreview({ src, className = 'block h-full w-full', label = '原图', children, delay = 1000 }: Props) {
  const [visible, setVisible] = useState(false);
  const timer = useRef<number | null>(null);

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    setVisible(false);
  };

  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  if (!src) return <span className={className}>{children}</span>;

  return (
    <>
      <span
        className={className}
        onMouseEnter={() => {
          if (timer.current !== null) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => setVisible(true), delay);
        }}
        onMouseLeave={clear}
        onMouseDown={clear}
        onTouchStart={clear}
      >
        {children}
      </span>
      {visible && createPortal(
        <div className="pointer-events-none fixed inset-0 z-[200] flex items-center justify-center bg-black/70 p-4 sm:p-8">
          <div className="max-w-full border-4 border-white bg-white shadow-[8px_8px_0px_#121212]">
            <img src={src} alt={label} className="block max-h-[76vh] max-w-[88vw] object-contain" />
            <div className="bg-[#121212] px-3 py-1.5 text-center text-[11px] font-bold text-white">{label} · 移开鼠标关闭</div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
