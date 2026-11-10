import type { ReactNode } from 'react';
import { Briefcase, Flag, MessageSquareText, UserRound } from 'lucide-react';

interface Props {
  destination: 'profile' | 'manage';
  onNavigate: () => void;
  onFeedback: () => void;
  onReport: () => void;
  // 插在「团务管理 / 个人档案」按钮与下方分割线之间，只有需要额外入口的页面传入。
  extraActions?: ReactNode;
}

export function AccountSideActions({ destination, onNavigate, onFeedback, onReport, extraActions }: Props) {
  const DestinationIcon = destination === 'profile' ? UserRound : Briefcase;
  return <aside className="w-full lg:w-60 xl:w-64 shrink-0 lg:sticky lg:top-20 flex flex-col gap-3" aria-label="账号操作">
    <button type="button" onClick={onNavigate} className="bauhaus-btn w-full bg-white px-4 py-3 text-sm font-black gap-2 hover:bg-[#FAF9F5]"><DestinationIcon className="w-4 h-4" />{destination === 'profile' ? '个人档案' : '团务管理'}</button>
    {extraActions}
    <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 pt-1 lg:pt-3 lg:border-t-2 lg:border-[#121212]">
      <button type="button" onClick={onReport} className="bauhaus-btn w-full bg-[#FAF0F0] text-[#B51F1F] px-3 py-3 text-sm font-black gap-2 hover:bg-[#F7DDDD]"><Flag className="w-4 h-4" />举报</button>
      <button type="button" onClick={onFeedback} className="bauhaus-btn w-full bg-[#EAF3FB] text-[#004E98] px-3 py-3 text-sm font-black gap-2 hover:bg-[#D9EAF8]"><MessageSquareText className="w-4 h-4" />反馈</button>
    </div>
  </aside>;
}
