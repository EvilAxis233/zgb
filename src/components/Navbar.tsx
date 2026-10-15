import React from 'react';
import { UserProfile } from '../types';
import { Flame, Star, Plus, CalendarCheck } from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile | null;
  activeTab: 'board' | 'profile' | 'manage';
  setActiveTab: (tab: 'board' | 'profile' | 'manage') => void;
  onOpenPublish: () => void;
  onDailyCheckIn: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  setActiveTab,
  onOpenPublish,
  onDailyCheckIn,
  onOpenLogin,
  onLogout,
}) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const alreadyCheckedIn = currentUser?.lastCheckInDate === today;

  return (
    <header className="border-b-4 border-[#121212] bg-[#FFFFFF] sticky top-0 z-30">
      {/* Main Bar */}
      <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 py-3 flex flex-wrap lg:flex-nowrap items-center gap-4 lg:gap-6">
        {/* Brand / Logo: Right-aligned to Line 1 (Right border of Left column) */}
        <div
          className="w-auto lg:w-60 xl:w-64 shrink-0 flex items-center lg:justify-end gap-3 cursor-pointer"
          onClick={() => setActiveTab('board')}
        >
          {/* Pure Bauhaus Red Square without text */}
          <div className="w-8 h-8 bg-[#D62828] border-2 border-[#121212] shadow-[2px_2px_0px_#121212] shrink-0" />
          <h1 className="text-2xl font-black tracking-tight leading-none text-[#121212]">
            诸告板
          </h1>
        </div>

        {/* Center Container: Spans from Line 2 (cards left edge) to Line 3 (cards right edge) */}
        <div className="flex-1 min-w-0 flex flex-wrap lg:flex-nowrap items-center justify-between gap-4">
          {/* Tab Navigation: Starts at Line 2 */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => setActiveTab('board')}
              className={`px-4 py-2 font-bold text-sm border-2 border-[#121212] transition-all cursor-pointer ${
                activeTab === 'board'
                  ? 'bg-[#121212] text-white shadow-[2px_2px_0px_#D62828]'
                  : 'bg-white text-[#121212] hover:bg-[#F2F0E8]'
              }`}
            >
              查团
            </button>

            <button
              onClick={() => setActiveTab('profile')}
              className={`px-4 py-2 font-bold text-sm border-2 border-[#121212] transition-all cursor-pointer ${
                activeTab === 'profile'
                  ? 'bg-[#121212] text-white shadow-[2px_2px_0px_#004E98]'
                  : 'bg-white text-[#121212] hover:bg-[#F2F0E8]'
              }`}
            >
              个人档案
            </button>

            <button
              onClick={() => setActiveTab('manage')}
              className={`px-4 py-2 font-bold text-sm border-2 border-[#121212] transition-all cursor-pointer ${
                activeTab === 'manage'
                  ? 'bg-[#121212] text-white shadow-[2px_2px_0px_#F4A261]'
                  : 'bg-white text-[#121212] hover:bg-[#F2F0E8]'
              }`}
            >
              团务管理
            </button>
          </nav>

          {/* Hearts/Praises Inventory Display & Action Area: Ends at Line 3 */}
          <div className="flex items-center gap-3">
            <button onClick={currentUser ? onLogout : onOpenLogin} className="bauhaus-btn bg-white px-3 py-2 text-xs font-bold">{currentUser ? `${currentUser.name} · 退出` : '登录'}</button>
            {/* Praise inventory counters */}
            <div className="flex items-center gap-2 bg-[#F6F5F0] border-2 border-[#121212] p-1.5 shadow-[2px_2px_0px_#121212]">
              {/* GM Praise */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#121212]"
                title="GM点赞：参团核销凭证获得，可给GM点赞"
              >
                <Flame className="w-4 h-4 text-[#D62828] fill-[#D62828]" />
                <span className="font-bold text-xs">GM点赞:</span>
                <span className="font-black text-sm text-[#D62828]">
                  {currentUser?.inventory.gmHearts ?? 0}
                </span>
              </div>

              {/* Player Praise */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 bg-white border border-[#121212]"
                title="玩家点赞：每日签到获得，可给玩家同伴点赞"
              >
                <Star className="w-4 h-4 text-[#004E98] fill-[#004E98]" />
                <span className="font-bold text-xs">玩家点赞:</span>
                <span className="font-black text-sm text-[#004E98]">
                  {currentUser?.inventory.playerHearts ?? 0}
                </span>
              </div>

              {/* Daily Check-in Button */}
              <button
                onClick={onDailyCheckIn}
                disabled={alreadyCheckedIn}
                className={`px-2 py-1 text-xs font-bold border border-[#121212] flex items-center gap-1 cursor-pointer transition-all ${
                  alreadyCheckedIn
                    ? 'bg-[#E5E5E0] text-[#888888] cursor-not-allowed'
                    : 'bg-[#F4A261] text-[#121212] hover:bg-[#e7924d] active:translate-y-0.5'
                }`}
                title={alreadyCheckedIn ? '今日已签到' : '点击签到获取1枚玩家点赞'}
              >
                <CalendarCheck className="w-3.5 h-3.5" />
                <span>{alreadyCheckedIn ? '已签' : '签到'}</span>
              </button>
            </div>

            {/* Publish Button: Right edge aligns with Line 3 */}
            <button
              onClick={onOpenPublish}
              className="bauhaus-btn bg-[#D62828] text-white px-4 py-2 text-sm font-bold flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>发布新团</span>
            </button>
          </div>
        </div>

        {/* Right Column Spacer: Matches the right '筛选检索' column width */}
        <div className="hidden lg:block lg:w-60 xl:w-64 shrink-0" />
      </div>
    </header>
  );
};
