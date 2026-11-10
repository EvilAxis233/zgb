import React from 'react';

interface HomePortalProps {
  onSelectOnline: () => void;
  onSelectOffline: () => void;
  onSelectPromo: () => void;
  onSelectManage: () => void;
  onSelectResources: () => void;
}

export const HomePortal: React.FC<HomePortalProps> = ({ onSelectOnline, onSelectOffline, onSelectPromo, onSelectManage, onSelectResources }) => {
  const items = [
    { id: 'online', title: '网团', heart: false, seedColor: '#D62828', secondaryColor: '#9E1B1B', accentColor: '#FF8585', action: onSelectOnline },
    { id: 'offline', title: '面团', heart: false, seedColor: '#F4A261', secondaryColor: '#E76F51', accentColor: '#FFD166', action: onSelectOffline },
    { id: 'promo', title: '宣群', heart: false, seedColor: '#004E98', secondaryColor: '#002952', accentColor: '#60A5FA', action: onSelectPromo },
    { id: 'manage', title: '团务管理', heart: false, seedColor: '#121212', secondaryColor: '#3A3A3A', accentColor: '#888888', action: onSelectManage },
    { id: 'resources', title: '爱心资源', heart: true, seedColor: '#D62828', secondaryColor: '#B51F5C', accentColor: '#FFB3C9', action: onSelectResources },
  ];

  return <div className="w-full flex flex-col gap-4 sm:gap-6 h-[calc(100dvh-270px)] min-h-[728px] sm:min-h-[792px]">
    {items.map((item) => <button
      key={item.id}
      type="button"
      onClick={item.action}
      className="group w-full flex-1 relative overflow-hidden min-h-[128px] sm:min-h-[136px] bg-[#F2F0E8] border-2 sm:border-3 border-[#121212] shadow-[4px_4px_0px_#121212] hover:shadow-[7px_7px_0px_#121212] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer flex items-center justify-center select-none"
    >
      <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-20" aria-hidden="true">
        {Array.from({ length: 6 }, (_, index) => <div key={index} className="border-r border-b border-[#121212]" />)}
      </div>
      <div className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border-2 border-[#121212] transition-transform duration-300 group-hover:scale-105" style={{ backgroundColor: item.seedColor }} aria-hidden="true" />
      <div className="absolute top-3 left-4 w-12 h-12 border-2 border-[#121212] transition-transform duration-300 group-hover:rotate-6" style={{ backgroundColor: item.secondaryColor }} aria-hidden="true" />
      <div className="absolute bottom-4 left-1/4 w-8 h-8 rounded-full border-2 border-[#121212]" style={{ backgroundColor: item.accentColor }} aria-hidden="true" />
      <div className="absolute w-48 h-1 bg-[#121212] -rotate-45 origin-top-left -top-4 -left-4 opacity-70" aria-hidden="true" />
      <div className="absolute top-2 right-2 flex items-center gap-1" aria-hidden="true">
        <span className="w-2.5 h-2.5 rounded-full bg-[#121212]" />
        <span className="w-2.5 h-2.5 bg-[#D62828]" />
        <span className="w-2.5 h-2.5 bg-[#004E98]" />
      </div>
      <span className="relative z-10 flex items-center gap-3 bg-[#F2F0E8] px-3 py-1 text-4xl sm:text-5xl font-bold leading-normal tracking-wider text-[#121212]" style={{ fontFamily: '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif' }}>
        {item.heart && <svg width="30" height="30" viewBox="0 0 24 24" fill="#D62828" aria-hidden="true" className="shrink-0"><path d="M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6-8 11-8 11z" /></svg>}
        {item.title}
      </span>
    </button>)}
  </div>;
};
