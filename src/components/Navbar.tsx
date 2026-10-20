import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import {
  CalendarCheck,
  ChevronDown,
  Sun,
  Moon,
  HelpCircle,
  LogOut,
  LogIn,
} from 'lucide-react';

interface NavbarProps {
  currentUser: UserProfile | null;
  activeTab: 'board' | 'profile' | 'manage';
  boardView: 'portal' | 'online' | 'offline' | 'promo';
  setActiveTab: (tab: 'board' | 'profile' | 'manage') => void;
  setBoardView: (view: 'portal' | 'online' | 'offline' | 'promo') => void;
  onDailyCheckIn: () => void;
  onOpenLogin: () => void;
  onLogout: () => void;
  onOpenInstructions: () => void;
  onToggleTheme: () => void;
  isDarkMode: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentUser,
  activeTab,
  boardView,
  setActiveTab,
  setBoardView,
  onDailyCheckIn,
  onOpenLogin,
  onLogout,
  onOpenInstructions,
  onToggleTheme,
  isDarkMode,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

  const alreadyCheckedIn = currentUser?.lastCheckInDate === today;

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleGoHome = () => {
    setActiveTab('board');
    setBoardView('portal');
  };

  const boardTabs = [
    { view: 'online', label: '网团' },
    { view: 'offline', label: '面团' },
    { view: 'promo', label: '宣群' },
  ] as const;

  const logoContent = (
    <button
      type="button"
      className="flex items-center gap-3 cursor-pointer group shrink-0"
      onClick={handleGoHome}
      title="点击返回诸告板主入口"
    >
      {/* 包豪斯纯粹红块 */}
      <div className="w-8 h-8 bg-[#D62828] border-2 border-[#121212] shadow-[2px_2px_0px_#121212] group-hover:shadow-[3px_3px_0px_#121212] transition-all shrink-0" />
      <h1 className="text-2xl font-black tracking-tight leading-none text-[#121212] group-hover:text-[#D62828] transition-colors">
        诸告板
      </h1>
    </button>
  );

  const actionContent = (
    <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
      {/* 签到按钮：在头像左侧，保留签到交互 */}
      <button
        onClick={onDailyCheckIn}
        disabled={alreadyCheckedIn}
        className={`px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm font-bold border-2 border-[#121212] flex items-center gap-1.5 cursor-pointer transition-all ${
          alreadyCheckedIn
            ? 'bg-[#E5E5E0] text-[#888888] cursor-not-allowed border-[#121212]'
            : 'bg-[#F4A261] text-[#121212] shadow-[2px_2px_0px_#121212] hover:bg-[#e7924d] hover:shadow-[3px_3px_0px_#121212] active:translate-y-0.5'
        }`}
        title={
          alreadyCheckedIn
            ? '今日已完成签到'
            : '点击签到获取 1 枚玩家点赞券'
        }
      >
        <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        <span>{alreadyCheckedIn ? '已签' : '签到'}</span>
      </button>

      {/* 下拉框做到名字那里 */}
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setIsDropdownOpen((prev) => !prev)}
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 bg-white border-2 border-[#121212] shadow-[2px_2px_0px_#121212] hover:bg-[#FAF9F5] hover:shadow-[3px_3px_0px_#121212] cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5"
          title="用户设置与操作菜单"
        >
          <span className="font-bold text-xs sm:text-sm text-[#121212] max-w-[85px] sm:max-w-[110px] truncate">
            {currentUser ? currentUser.name : '未登录'}
          </span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-[#121212] transition-transform duration-150 ${
              isDropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {/* 下拉菜单 */}
        {isDropdownOpen && (
          <div className="absolute right-0 mt-1.5 w-48 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] py-1 z-50">
            {/* 调整亮度（白天和夜晚配色） */}
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                onToggleTheme();
              }}
              className="w-full px-4 py-2 text-left text-xs font-bold text-[#121212] hover:bg-[#F4A261] hover:text-[#121212] flex items-center justify-between cursor-pointer transition-colors"
            >
              <div className="flex items-center gap-2.5">
                {isDarkMode ? (
                  <Moon className="w-4 h-4" />
                ) : (
                  <Sun className="w-4 h-4" />
                )}
                <span>调整亮度</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 bg-[#FAF9F5] border border-[#121212] font-mono">
                {isDarkMode ? '夜晚' : '白天'}
              </span>
            </button>

            {/* 使用说明 */}
            <button
              type="button"
              onClick={() => {
                setIsDropdownOpen(false);
                onOpenInstructions();
              }}
              className="w-full px-4 py-2 text-left text-xs font-bold text-[#121212] hover:bg-[#121212] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
            >
              <HelpCircle className="w-4 h-4 text-current" />
              <span>使用说明</span>
            </button>

            {/* 分隔线 */}
            <div className="border-t border-[#121212] my-1" />

            {/* 退出登录 / 登录 */}
            {currentUser ? (
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onLogout();
                }}
                className="w-full px-4 py-2 text-left text-xs font-bold text-[#D62828] hover:bg-[#D62828] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <LogOut className="w-4 h-4 text-current" />
                <span>退出登录</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setIsDropdownOpen(false);
                  onOpenLogin();
                }}
                className="w-full px-4 py-2 text-left text-xs font-bold text-[#004E98] hover:bg-[#004E98] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
              >
                <LogIn className="w-4 h-4 text-current" />
                <span>登录账号</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* 图像单独出来（最右侧独立头像块） */}
      <button
        type="button"
        onClick={() => {
          if (currentUser) {
            setActiveTab('profile');
          } else {
            onOpenLogin();
          }
        }}
        title={currentUser ? `${currentUser.name} 的个人头像（点击进入个人档案）` : '点击登录'}
        className="w-8 h-8 bg-[#121212] text-white font-black text-xs flex items-center justify-center border-2 border-[#121212] shadow-[2px_2px_0px_#121212] hover:shadow-[3px_3px_0px_#121212] hover:-translate-y-0.5 transition-all overflow-hidden shrink-0 cursor-pointer"
      >
        {currentUser?.avatar ? (
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-full h-full object-cover"
          />
        ) : (
          (currentUser?.name || '?').charAt(0)
        )}
      </button>
    </div>
  );

  return (
    <header className="border-b-4 border-[#121212] bg-[#FFFFFF] sticky top-0 z-30 select-none">
      <div className="max-w-[1760px] w-full mx-auto px-4 sm:px-6 py-3 flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
        <nav className="flex items-center gap-2 lg:justify-self-start" aria-label="板块导航">
          {boardTabs.map(({ view, label }) => (
            <button
              key={view}
              type="button"
              onClick={() => { setActiveTab('board'); setBoardView(view); }}
              aria-current={activeTab === 'board' && boardView === view ? 'page' : undefined}
              className={`bauhaus-btn px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-black cursor-pointer ${activeTab === 'board' && boardView === view ? 'bg-[#121212] text-white' : 'bg-white text-[#121212] hover:bg-[#FAF9F5]'}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="self-center lg:justify-self-center">{logoContent}</div>
        <div className="self-end lg:justify-self-end">{actionContent}</div>
      </div>
    </header>
  );
};
