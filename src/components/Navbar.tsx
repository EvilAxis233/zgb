import React, { useState, useRef, useEffect } from 'react';
import { UserProfile } from '../types';
import { NameplateBadge } from './NameplateBadge';
import { useDialog } from './BauhausDialog';
import {
  CalendarCheck,
  ChevronDown,
  HelpCircle,
  Ticket,
  Shield,
  LogOut,
  LogIn,
  Sun,
  Moon,
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
  onOpenTickets: () => void;
  onOpenInstructions: () => void;
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
  onOpenTickets,
  onOpenInstructions,
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const { showConfirm } = useDialog();
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  // 单击切换日间/夜间；<html data-theme> 由 index.html 里的脚本提前恢复，避免刷新白闪
  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    const root = document.documentElement;
    root.classList.add('zgb-theme-anim');
    window.setTimeout(() => root.classList.remove('zgb-theme-anim'), 320);
    if (next === 'dark') root.setAttribute('data-theme', 'dark');
    else root.removeAttribute('data-theme');
    try { localStorage.setItem('zgb-theme', next); } catch { /* 隐私模式下忽略 */ }
    setTheme(next);
  };
  // 会员的头像用动态鎏金环，非会员保持纯黑描边。
  const selfIsMember = !!currentUser && (!!currentUser.membershipPermanent || (currentUser.membershipExpiresAt ?? 0) * 1000 > Date.now());

  const hongKongDate = () => new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
  const [today, setToday] = useState(hongKongDate);

  useEffect(() => {
    const dayMs = 24 * 60 * 60 * 1000;
    const hkOffsetMs = 8 * 60 * 60 * 1000;
    const nextMidnight = Math.floor((Date.now() + hkOffsetMs) / dayMs + 1) * dayMs - hkOffsetMs;
    const timer = window.setTimeout(() => setToday(hongKongDate()), nextMidnight - Date.now() + 50);
    const refreshDate = () => setToday(hongKongDate());
    document.addEventListener('visibilitychange', refreshDate);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', refreshDate);
    };
  }, [today]);

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
      <img
        src="/zgb-logo.png"
        alt=""
        aria-hidden="true"
        className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 object-contain [image-rendering:pixelated] transition-transform group-hover:-translate-y-0.5"
      />
      <h1 className="text-3xl sm:text-4xl font-black tracking-tight leading-none text-[#121212] group-hover:text-[#D62828] transition-colors">
        诸告板
      </h1>
    </button>
  );

  const actionContent = (
    <div className="flex max-w-full flex-wrap items-center justify-end gap-2 sm:gap-2.5">
      {currentUser?.isAdmin && <a href="/admin" className="bauhaus-btn bg-[#004E98] text-white px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm gap-1.5"><Shield size={15} />后台</a>}
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
            : currentUser?.membershipExpiresAt && currentUser.membershipExpiresAt > Date.now() / 1000
              ? '签到获得 1 张玩家点赞券；会员累计签到每满 7 次获得 3 张 GM 点赞券'
              : '签到获得 1 张玩家点赞券；连续签到每满 7 天获得 1 张 GM 点赞券'
        }
      >
        <CalendarCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
        <span>{alreadyCheckedIn ? '已签' : '签到'}</span>
      </button>

      {/* 会员自定义铭牌：点赞与名字中间 */}
      {currentUser?.nameplate && (
        <NameplateBadge nameplate={currentUser.nameplate} />
      )}

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

            <button type="button" onClick={() => { setIsDropdownOpen(false); onOpenTickets(); }} className="w-full px-4 py-2 text-left text-xs font-bold hover:bg-[#121212] hover:text-white flex items-center gap-2.5 cursor-pointer"><Ticket size={16} />工单</button>
            {/* 分隔线 */}
            <div className="border-t border-[#121212] my-1" />

            {/* 日间 / 夜间：单击直接切换 */}
            <button
              type="button"
              onClick={() => { setIsDropdownOpen(false); toggleTheme(); }}
              title={theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}
              className="w-full px-4 py-2 text-left text-xs font-bold text-[#121212] hover:bg-[#121212] hover:text-white flex items-center gap-2.5 cursor-pointer transition-colors"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-current" /> : <Moon className="w-4 h-4 text-current" />}
              <span>{theme === 'dark' ? '切换到日间模式' : '切换到夜间模式'}</span>
            </button>
            <div className="border-t border-[#121212] my-1" />

            {/* 退出登录 / 登录 */}
            {currentUser ? (
              <button
                type="button"
                onClick={async () => {
                  setIsDropdownOpen(false);
                  const confirmed = await showConfirm({
                    title: '退出登录',
                    message: '确定要退出当前账号吗？退出后需要重新用 QQ 邮箱验证码登录。',
                    confirmText: '确定退出',
                    cancelText: '取消',
                    type: 'warning',
                  });
                  if (confirmed) onLogout();
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
        onClick={() => { if (!currentUser) onOpenLogin(); }}
        title={currentUser ? `${currentUser.name} 的个人头像` : '点击登录'}
        className={`w-8 h-8 text-white font-black text-xs flex items-center justify-center overflow-hidden shrink-0 ${selfIsMember ? 'gilded-avatar' : 'bg-[#121212] border-2 border-[#121212] shadow-[2px_2px_0px_#121212]'} ${currentUser ? '' : 'cursor-pointer'}`}
      >
        {currentUser?.avatar ? (
          <img
            src={currentUser.avatar}
            alt={currentUser.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <span className="relative z-[1]">{(currentUser?.name || '?').charAt(0)}</span>
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
        <div className="min-w-0 max-w-full self-end lg:justify-self-end">{actionContent}</div>
      </div>
    </header>
  );
};
