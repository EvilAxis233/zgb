import React from 'react';
import { X, BookOpen } from 'lucide-react';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-[#FFFFFF] border-3 border-[#121212] shadow-[8px_8px_0px_#121212] flex flex-col max-h-[90vh] overflow-hidden animate-in zoom-in-95 duration-150"
        role="dialog"
        aria-modal="true"
        aria-labelledby="instructions-modal-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b-2 border-[#121212] bg-[#FAF9F5]">
          <div className="flex items-center gap-2.5">
            <div className="w-4 h-4 bg-[#D62828] border border-[#121212]" />
            <h2 id="instructions-modal-title" className="text-lg font-black text-[#121212] tracking-wide flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[#121212]" />
              使用说明
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center border-2 border-[#121212] bg-white hover:bg-[#D62828] hover:text-white transition-colors cursor-pointer text-[#121212]"
            aria-label="关闭"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="p-5 overflow-y-auto space-y-3.5 text-xs text-[#222222]">
          {/* Card 1: 查团与报名 */}
          <div className="p-3.5 bg-[#FAF9F5] border-2 border-[#121212] shadow-[2px_2px_0px_#121212]">
            <div className="font-black text-sm text-[#121212] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 bg-[#D62828]" />
              <span>查团与报名</span>
            </div>
            <p className="text-[#444444] leading-relaxed">
              在「网团」板块中浏览最新招募战役，点击卡片可查看团规、简介、排期时段与已报名的玩家名单。登录后可报名；满员、锁车或结团后从主页隐藏，预定日期过后自动锁车。
            </p>
          </div>

          {/* Card 2: 发布新团 */}
          <div className="p-3.5 bg-[#FAF9F5] border-2 border-[#121212] shadow-[2px_2px_0px_#121212]">
            <div className="font-black text-sm text-[#121212] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 bg-[#004E98]" />
              <span>发布新团</span>
            </div>
            <p className="text-[#444444] leading-relaxed">
              右上角点击「发布新团」，主持（GM/KP）可自定义封面、开团时段、招募人数、跑团平台（KOOK、FVTT等）以及标签。发布后所有访客均可在网页中直接查阅。
            </p>
          </div>

          {/* Card 3: 团务管理 */}
          <div className="p-3.5 bg-[#FAF9F5] border-2 border-[#121212] shadow-[2px_2px_0px_#121212]">
            <div className="font-black text-sm text-[#121212] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 bg-[#F4A261]" />
              <span>团务管理</span>
            </div>
            <p className="text-[#444444] leading-relaxed">
              主持可在「团务管理」中修改战役、追加开团时段、锁车或重新开放报名，并在开团日前移出不合适的报名玩家。手动结团后，记录会进入成员档案并开放团内点赞。
            </p>
          </div>

          {/* Card 4: 参团与点赞 */}
          <div className="p-3.5 bg-[#FAF9F5] border-2 border-[#121212] shadow-[2px_2px_0px_#121212]">
            <div className="font-black text-sm text-[#121212] flex items-center gap-2 mb-1.5">
              <span className="w-2.5 h-2.5 bg-[#121212]" />
              <span>参团与点赞券</span>
            </div>
            <p className="text-[#444444] leading-relaxed">
              玩家报名的团由主持结团后可获得「GM点赞券」；每日登录点击右上角「签到」可领取「玩家点赞券」。结团后可从个人档案进入团详情，为同团 GM 或玩家点赞。
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t-2 border-[#121212] bg-[#FAF9F5] flex justify-end">
          <button
            onClick={onClose}
            className="bauhaus-btn bg-[#121212] text-white px-5 py-2 text-xs font-bold hover:bg-[#D62828] transition-colors cursor-pointer"
          >
            我明白了
          </button>
        </div>
      </div>
    </div>
  );
};
