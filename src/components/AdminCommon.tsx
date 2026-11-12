import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const number = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');

export const PAGE_SIZE = 30;

/** 后台各列表共用的分页器。 */
export function Pager({ offset, total, size = PAGE_SIZE, setOffset }: { offset: number; total: number; size?: number; setOffset: (v: number) => void }) {
  return <div className="flex items-center justify-end gap-3 mt-5 text-xs font-bold"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - size))} className="bauhaus-btn bg-white p-1" aria-label="上一页"><ChevronLeft size={17} /></button><span>{total ? offset + 1 : 0}–{Math.min(offset + size, total)} / {total}</span><button disabled={offset + size >= total} onClick={() => setOffset(offset + size)} className="bauhaus-btn bg-white p-1" aria-label="下一页"><ChevronRight size={17} /></button></div>;
}

/** 折叠区：默认收起，展开时才渲染列表。 */
export function CollapsibleList({ title, count, tone = 'default', children }: { title: string; count: number; tone?: 'default' | 'green' | 'red'; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const color = tone === 'green' ? '#176B57' : tone === 'red' ? '#B51F1F' : '#121212';
  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} className="mt-4 border-t-2 border-[#121212] pt-3">
      <summary className="list-none cursor-pointer flex items-center gap-2 text-sm font-black py-1" style={{ color }}>
        <ChevronRight size={16} className={`transition-transform ${open ? 'rotate-90' : ''}`} />
        {title}（{number(count)} 条）· 点击展开
      </summary>
      <div className="mt-4 space-y-4">{children}</div>
    </details>
  );
}
