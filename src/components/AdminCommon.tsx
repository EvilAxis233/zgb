import { useState, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export const number = (value: unknown) => Number(value || 0).toLocaleString('zh-CN');

export const PAGE_SIZE = 30;

/** 后台各列表共用的分页器。 */
export function Pager({ offset, total, size = PAGE_SIZE, setOffset }: { offset: number; total: number; size?: number; setOffset: (v: number) => void }) {
  return <div className="flex items-center justify-end gap-3 mt-5 text-xs font-bold"><button disabled={!offset} onClick={() => setOffset(Math.max(0, offset - size))} className="bauhaus-btn bg-white p-1" aria-label="上一页"><ChevronLeft size={17} /></button><span>{total ? offset + 1 : 0}–{Math.min(offset + size, total)} / {total}</span><button disabled={offset + size >= total} onClick={() => setOffset(offset + size)} className="bauhaus-btn bg-white p-1" aria-label="下一页"><ChevronRight size={17} /></button></div>;
}

/** 账号列表专用分页器：页码用下拉直接择页（与「账号」页左侧完全一致）。 */
export function SelectPager({ offset, total, size = 100, onChange }: { offset: number; total: number; size?: number; onChange: (offset: number) => void }) {
  const pages = Math.ceil(total / size);
  if (pages <= 1) return null;
  const current = Math.min(pages - 1, Math.floor(offset / size));
  return <div className="flex justify-between items-center mt-4 text-xs font-bold"><button disabled={current === 0} onClick={() => onChange((current - 1) * size)} className="bauhaus-btn bg-white px-3 py-1 disabled:opacity-40">上一页</button><label className="flex items-center gap-1.5">第
    <select aria-label="选择页码" value={current} onChange={(event) => onChange(Number(event.target.value) * size)} className="bauhaus-input px-2 py-1 text-xs font-bold">
      {Array.from({ length: pages }, (_, index) => <option key={index} value={index}>{index + 1}</option>)}
    </select>
    页 / 共 {pages} 页</label><button disabled={current >= pages - 1} onClick={() => onChange((current + 1) * size)} className="bauhaus-btn bg-white px-3 py-1 disabled:opacity-40">下一页</button></div>;
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
