import React from 'react';
import { ArrowRight, Globe, Users, MessageSquare, Briefcase, Sparkles } from 'lucide-react';

interface HomePortalProps {
  recruitingCount: number;
  onSelectOnline: () => void;
  onSelectOffline: () => void;
  onSelectPromo: () => void;
  onSelectManage: () => void;
}

interface PortalItem {
  id: 'online' | 'offline' | 'promo' | 'manage';
  title: string;
  enTitle: string;
  tag: string;
  tagColor: string;
  seedColor: string;
  secondaryColor: string;
  accentColor: string;
  description: string;
  stats?: string;
  statusBadge: string;
  statusType: 'active' | 'upcoming' | 'manage';
  icon: React.ReactNode;
  action: () => void;
}

export const HomePortal: React.FC<HomePortalProps> = ({
  recruitingCount,
  onSelectOnline,
  onSelectOffline,
  onSelectPromo,
  onSelectManage,
}) => {
  const items: PortalItem[] = [
    {
      id: 'online',
      title: '网团',
      enTitle: 'ONLINE SESSIONS',
      tag: '线上跑团 · 实时招募',
      tagColor: '#D62828',
      seedColor: '#D62828',
      secondaryColor: '#9E1B1B',
      accentColor: '#FF8585',
      description: '浏览在线语音与文字跑团招募，支持 KOOK、OOPZ、FVTT、枭熊等平台，即时报名与车队匹配。',
      stats: `当前共有 ${recruitingCount} 个有效战役正在招募`,
      statusBadge: '招募中',
      statusType: 'active',
      icon: <Globe className="w-5 h-5 text-[#D62828]" />,
      action: onSelectOnline,
    },
    {
      id: 'offline',
      title: '面团',
      enTitle: 'TABLETOP SESSIONS',
      tag: '同城面聚 · 线下实体',
      tagColor: '#F4A261',
      seedColor: '#F4A261',
      secondaryColor: '#E76F51',
      accentColor: '#FFD166',
      description: '寻找身边的同城实体跑团伙伴与线下桌游吧据点，面对面掷骰沉浸开团。',
      stats: '同城面团据点与线下组局专区',
      statusBadge: '筹备中',
      statusType: 'upcoming',
      icon: <Users className="w-5 h-5 text-[#F4A261]" />,
      action: onSelectOffline,
    },
    {
      id: 'promo',
      title: '宣群',
      enTitle: 'COMMUNITY & GUILD',
      tag: '社群宣发 · 公会聚落',
      tagColor: '#004E98',
      seedColor: '#004E98',
      secondaryColor: '#002952',
      accentColor: '#60A5FA',
      description: '展示与检索优质跑团公会、规则交流群及跑团同好圈子，找到志同道合的冒险同盟。',
      stats: '公会展示 / KP与玩家交流群',
      statusBadge: '筹备中',
      statusType: 'upcoming',
      icon: <MessageSquare className="w-5 h-5 text-[#004E98]" />,
      action: onSelectPromo,
    },
    {
      id: 'manage',
      title: '团务管理',
      enTitle: 'CAMPAIGN MANAGEMENT',
      tag: '主持排期 · 成员管理',
      tagColor: '#121212',
      seedColor: '#121212',
      secondaryColor: '#3A3A3A',
      accentColor: '#888888',
      description: '管理由你主持的战役、修改团务简介、增减报名玩家、补充开团时段及结团归档。',
      stats: '我的主持战役与参团名录',
      statusBadge: '控制台',
      statusType: 'manage',
      icon: <Briefcase className="w-5 h-5 text-[#121212]" />,
      action: onSelectManage,
    },
  ];

  return (
    <div className="w-full flex flex-col gap-4 sm:gap-6">
      {items.map((item) => (
        <div
          key={item.id}
          onClick={item.action}
          className="group w-full bg-white border-2 sm:border-3 border-[#121212] shadow-[4px_4px_0px_#121212] hover:shadow-[7px_7px_0px_#121212] hover:-translate-x-0.5 hover:-translate-y-0.5 active:translate-x-0.5 active:translate-y-0.5 transition-all cursor-pointer overflow-hidden flex flex-col md:flex-row items-stretch min-h-[130px] sm:min-h-[140px]"
        >
          {/* Left: Bauhaus Default Graphic Art Block */}
          <div className="w-full md:w-64 lg:w-72 shrink-0 relative overflow-hidden bg-[#F2F0E8] border-b-2 md:border-b-0 md:border-r-2 border-[#121212] flex items-center justify-center p-5 select-none">
            {/* Grid background lines */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-20">
              <div className="border-r border-b border-[#121212]" />
              <div className="border-r border-b border-[#121212]" />
              <div className="border-r border-b border-[#121212]" />
              <div className="border-r border-b border-[#121212]" />
              <div className="border-r border-b border-[#121212]" />
              <div className="border-b border-[#121212]" />
            </div>

            {/* Geometric Primary Shapes */}
            {/* 1. Large bottom-right semicircle */}
            <div
              className="absolute -right-6 -bottom-6 w-32 h-32 rounded-full border-2 border-[#121212] transition-transform duration-300 group-hover:scale-105"
              style={{ backgroundColor: item.seedColor }}
            />
            {/* 2. Top-left square */}
            <div
              className="absolute top-3 left-4 w-12 h-12 border-2 border-[#121212] transition-transform duration-300 group-hover:rotate-6"
              style={{ backgroundColor: item.secondaryColor }}
            />
            {/* 3. Bottom-left circle */}
            <div
              className="absolute bottom-4 left-1/4 w-8 h-8 rounded-full border-2 border-[#121212]"
              style={{ backgroundColor: item.accentColor }}
            />

            {/* Diagonal Bauhaus accent line */}
            <div className="absolute w-48 h-1 bg-[#121212] -rotate-45 transform origin-top-left -top-4 -left-4 opacity-70" />

            {/* Center title badge on graphic block */}
            <div className="relative z-10 bg-white border-2 border-[#121212] px-4 py-2 shadow-[3px_3px_0px_#121212] flex items-center gap-2 max-w-[85%]">
              <span
                className="w-3 h-3 shrink-0"
                style={{ backgroundColor: item.seedColor }}
              />
              <span className="text-xl sm:text-2xl font-black tracking-tight text-[#121212]">
                {item.title}
              </span>
            </div>

            {/* Top right Bauhaus 3-dot stamp */}
            <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
              <div className="w-2.5 h-2.5 rounded-full bg-[#121212]" />
              <div className="w-2.5 h-2.5 bg-[#D62828]" />
              <div className="w-2.5 h-2.5 bg-[#004E98]" />
            </div>
          </div>

          {/* Right: Informational Content Area */}
          <div className="flex-1 p-4 sm:p-5 md:p-6 flex flex-col justify-between bg-white relative">
            <div>
              {/* Top metadata row */}
              <div className="flex items-center justify-between gap-3 mb-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[11px] sm:text-xs font-black tracking-widest text-[#666666] uppercase">
                    {item.enTitle}
                  </span>
                  <span className="text-[#CCCCCC]">/</span>
                  <span className="text-xs font-bold text-[#121212]">
                    {item.tag}
                  </span>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 text-xs font-black border border-[#121212] ${
                      item.statusType === 'active'
                        ? 'bg-[#FAF0F0] text-[#D62828]'
                        : item.statusType === 'manage'
                        ? 'bg-[#121212] text-white'
                        : 'bg-[#FAF9F5] text-[#666666]'
                    }`}
                  >
                    {item.statusBadge}
                  </span>
                </div>
              </div>

              {/* Main Title Row */}
              <div className="flex items-center gap-2 mb-2">
                <h2 className="text-2xl sm:text-3xl font-black text-[#121212] tracking-tight leading-none group-hover:text-[#D62828] transition-colors">
                  {item.title}
                </h2>
                {item.id === 'online' && (
                  <span className="text-xs font-bold text-[#D62828] bg-[#FAF0F0] px-2 py-0.5 border border-[#D62828] ml-2">
                    主页推荐
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs sm:text-sm text-[#444444] leading-relaxed max-w-3xl">
                {item.description}
              </p>
            </div>

            {/* Bottom action row */}
            <div className="pt-3 mt-3 border-t border-[#E5E5E0] flex items-center justify-between">
              <span className="text-xs font-bold text-[#666666] flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 bg-[#121212] inline-block" />
                {item.stats}
              </span>

              <div className="flex items-center gap-1 text-xs font-black text-[#121212] group-hover:text-[#D62828] transition-colors">
                <span>进入板块</span>
                <ArrowRight className="w-4 h-4 transform group-hover:translate-x-1.5 transition-transform" />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
