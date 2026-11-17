import React, { useEffect, useRef, useState } from 'react';
import { ThumbsUp } from 'lucide-react';
import { Campaign } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { NameplateBadge } from './NameplateBadge';
import { locationLabel } from '../utils/location';

interface HomeCarouselProps {
  online: Campaign[];
  offline: Campaign[];
  promo: Campaign[];
  onOpenCampaign: (campaign: Campaign) => void;
  onSelectManage: () => void;
  onSelectResources: () => void;
  onSelectRoundtable: () => void;
}

type Kind = 'online' | 'offline' | 'promo';

const KIND_META: Record<Kind, { label: string; color: string; badge: string }> = {
  online: { label: '网团', color: '#D62828', badge: '#D62828' },
  offline: { label: '面团', color: '#F4A261', badge: '#E76F51' },
  promo: { label: '宣群', color: '#004E98', badge: '#004E98' },
};

const deadlineOf = (campaign: Campaign): string => {
  const raw = `${campaign.finishedAt || ''} ${campaign.timeSchedule || ''}`;
  const full = raw.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
  if (full) return `${Number(full[2])}/${Number(full[3])}`;
  const cn = raw.match(/(\d{1,2})月(\d{1,2})/);
  if (cn) return `${Number(cn[1])}/${Number(cn[2])}`;
  return '';
};

const stripMarkdown = (text: string): string =>
  (text || '').replace(/[#*`>`_\[\]()!]/g, '').replace(/^\s*[-•]\s*/gm, '').replace(/\s+/g, ' ').trim();

/** 单张完整卡片（沿用团详情弹窗的版式） */
const CampaignSlide: React.FC<{
  campaign: Campaign;
  meta: { label: string; color: string; badge: string };
  onOpen: (campaign: Campaign) => void;
}> = ({ campaign, meta, onOpen }) => {
  const remain = Math.max(0, (campaign.maxPlayers || 0) - (campaign.currentPlayers || 0));
  const deadline = deadlineOf(campaign);
  const isPromo = campaign.kind === 'promo';
  const [imgError, setImgError] = useState(false);
  const showImage = !!campaign.imageUrl && !imgError;
  return (
    <button
      type="button"
      onClick={() => onOpen(campaign)}
      className="hc-slide w-full text-center bg-white border-2 border-[#121212] shadow-[5px_5px_0px_#121212] hover:shadow-[8px_8px_0px_#121212] hover:-translate-y-0.5 active:translate-y-0.5 transition-all cursor-pointer overflow-hidden flex flex-col items-stretch"
    >
      {/* 封面大图：固定比例区域，图片正常比例居中裁切铺满；加载失败回退几何占位图 */}
      <div className="relative w-full h-[230px] sm:h-[270px] lg:h-[300px] shrink-0 overflow-hidden border-b-2 border-[#121212] bg-[#F2F0E8]">
        {showImage ? (
          <img src={campaign.imageUrl} alt="" onError={() => setImgError(true)} className="absolute inset-0 h-full w-full object-cover object-center" />
        ) : (
          <BauhausPlaceholder rule={campaign.rule} seedColor={meta.color} className="absolute inset-0 h-full w-full" showLabel={false} />
        )}
      </div>

      {/* 标题：图下居中（mx-auto + w-fit，保证任何宽度/浏览器下都居中） */}
      <div className="w-full px-4 pt-4 pb-2 text-center">
        <h3 className="mx-auto w-fit max-w-full break-words text-xl font-black leading-tight text-[#121212] sm:text-2xl">{campaign.title}</h3>
      </div>

      {/* 标签行：规则 / 时段或地点 / 平台（居中） */}
      <div className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1.5 px-4 pb-3">
        <span className="px-2.5 py-0.5 bg-[#004E98] text-white text-xs font-bold border border-[#121212]">{campaign.rule}</span>
        <span className="px-2.5 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212]">
          {campaign.kind === 'offline' ? locationLabel(campaign) : (campaign.sessionType || '语音')}
        </span>
        {campaign.kind !== 'offline' && campaign.platforms?.map((platform) => (
          <span key={platform} className="px-2 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212]">{platform}</span>
        ))}
      </div>

      {/* 发布者行：头像 + 昵称 + 铭牌 + 赞，整体作为一组水平居中 */}
      <div className="flex w-full justify-center border-y-2 border-[#121212] bg-[#FAF9F5] px-4 py-2.5">
        <div className="mx-auto flex w-fit min-w-0 max-w-full items-center justify-center gap-2">
          <span className={`h-9 w-9 shrink-0 overflow-hidden flex items-center justify-center text-sm text-white border-2 border-[#121212] ${campaign.gmIsMember ? 'gilded-avatar' : ''}`} style={{ backgroundColor: campaign.gmIsMember ? undefined : '#D62828' }}>
            {campaign.gmAvatar ? <img src={campaign.gmAvatar} alt="" className="h-full w-full object-cover" /> : <span>{campaign.gmName?.charAt(0)}</span>}
          </span>
          <span className="truncate text-sm font-black text-[#121212]">{campaign.gmName}</span>
          {campaign.gmNameplate && <NameplateBadge nameplate={campaign.gmNameplate} className="shrink-0" />}
          <span className="inline-flex shrink-0 items-center gap-1 border-2 border-[#121212] bg-[#D62828] px-2 py-1 text-xs font-black text-white shadow-[2px_2px_0px_#121212]">
            <ThumbsUp className="h-3.5 w-3.5" />赞 {campaign.gmPraises ?? 0}
          </span>
        </div>
      </div>

      {/* 简介摘要（唯一保留左对齐的内容）：容器高度严格等于 3 行（14px×22px=66px），
          由 line-clamp-3 在第三行末尾打省略号，overflow-hidden 兜底，避免露出第四行半截 */}
      <div className="w-full flex-1 px-5 py-3 text-left">
        <p className="line-clamp-3 h-[66px] overflow-hidden text-sm leading-[22px] text-[#444]">
          {stripMarkdown(campaign.description) || '暂无简介'}
        </p>
      </div>

      {/* 自定义标签 */}
      {!!campaign.customTags?.length && (
        <div className="mx-auto flex w-fit max-w-full flex-wrap items-center justify-center gap-1.5 px-4 pb-3">
          {campaign.customTags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-[#FFF9F9] border border-[#121212] text-xs font-bold text-[#D62828]">{tag}</span>
          ))}
        </div>
      )}

      {/* 状态条：网团/面团显示剩余空位 + 截止时间；宣群不显示截止时间。整行居中 */}
      <div className="mt-auto w-full px-4 pb-4 text-center">
        <div className="mx-auto mb-2.5 flex w-fit max-w-full flex-wrap items-center justify-center gap-2">
          {isPromo ? (
            <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">展示中</span>
          ) : (
            <>
              <span className="px-2.5 py-0.5 bg-[#F4A261] text-[#121212] text-xs font-bold border border-[#121212]">剩 {remain} 位</span>
              {deadline && <span className="px-2.5 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212]">截止 {deadline}</span>}
            </>
          )}
        </div>
        <div className="mx-auto block w-fit text-base font-black text-white px-5 py-2.5 border-2 border-[#121212] shadow-[2px_2px_0px_#121212]" style={{ backgroundColor: meta.badge }}>
          进入{meta.label}
        </div>
      </div>
    </button>
  );
};

/** 轮播占位卡：不足 5 个时补齐，保持每栏固定 5 页 */
const PlaceholderSlide: React.FC<{ meta: { label: string; color: string; badge: string } }> = ({ meta }) => (
  <div className="hc-slide w-full bg-white border-2 border-dashed border-[#121212] shadow-[5px_5px_0px_#121212] flex flex-col items-center justify-center overflow-hidden">
    <div className="h-[230px] w-full shrink-0 border-b-2 border-dashed border-[#CCC] sm:h-[270px] lg:h-[300px]" style={{ backgroundColor: `${meta.color}12` }} />
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-8 text-center">
      <span className="text-3xl font-black text-[#D3D1C7]">+</span>
      <span className="text-sm font-bold text-[#999]">暂无更多{meta.label}</span>
    </div>
  </div>
);

/** 单个分类的轮播栏：手动只翻自己这一栏，自动翻页由顶层统一驱动 */
const CarouselLane: React.FC<{
  kind: Kind;
  campaigns: Campaign[];
  onOpen: (campaign: Campaign) => void;
}> = ({ kind, campaigns, onOpen }) => {
  const meta = KIND_META[kind];
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  // 每栏固定 5 个轮播位：真实团务不足时用占位卡补齐，保证始终 5 页。
  const slots = Array.from({ length: 5 }, (_, i) => campaigns[i] || null);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const onScroll = () => setPage(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  // 单页宽度：优先取首张卡片的实际宽度（含 translate 也不影响宽度），退化时用容器宽。
  const pageWidth = () => {
    const el = trackRef.current;
    if (!el) return 0;
    const first = el.firstElementChild as HTMLElement | null;
    const w = first ? first.getBoundingClientRect().width : el.clientWidth;
    return w > 0 ? w : el.clientWidth;
  };

  // 手动翻页：支持首尾循环（与自动轮播一致），末页点「下一页」回第 1 页，首页点「上一页」到末页。
  const step = (direction: number) => {
    const el = trackRef.current;
    if (!el) return;
    const w = pageWidth();
    if (!w) return;
    const total = slots.length;
    const current = Math.round(el.scrollLeft / w);
    const next = ((current + direction) % total + total) % total;
    el.scrollTo({ left: next * w, behavior: 'smooth' });
  };

  const goTo = (index: number) => {
    const el = trackRef.current;
    if (!el) return;
    const w = pageWidth();
    if (w) el.scrollTo({ left: index * w, behavior: 'smooth' });
  };

  return (
    <section className="hc-lane group flex min-w-0 flex-col gap-2">
      {/* 分类标题 */}
      <div className="flex items-center gap-2 px-1">
        <span className="inline-block h-6 w-2 border-2 border-[#121212]" style={{ backgroundColor: meta.color }} />
        <h3 className="text-xl font-black tracking-wider text-[#121212] sm:text-2xl">{meta.label}</h3>
      </div>

      {/* 该栏自己的轮播轨道 */}
      <div className="relative min-w-0 flex-1">
        <div ref={trackRef} className="hc-lane-track">
          {slots.map((campaign, index) => campaign ? (
            <CampaignSlide key={`${campaign.kind}-${campaign.id}`} campaign={campaign} meta={meta} onOpen={onOpen} />
          ) : (
            <PlaceholderSlide key={`placeholder-${index}`} meta={meta} />
          ))}
        </div>
        {slots.length > 1 && (
          <>
            <button type="button" aria-label={`${meta.label}上一页`} onClick={() => step(-1)}
              className="hc-nav absolute left-2 top-[115px] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/90 bg-[#121212]/70 text-white shadow-[2px_2px_0px_#121212] opacity-0 backdrop-blur-sm transition-all hover:bg-[#D62828] group-hover:opacity-100 sm:top-[135px] lg:top-[150px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6" /></svg>
            </button>
            <button type="button" aria-label={`${meta.label}下一页`} onClick={() => step(1)}
              className="hc-nav absolute right-2 top-[115px] z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white/90 bg-[#121212]/70 text-white shadow-[2px_2px_0px_#121212] opacity-0 backdrop-blur-sm transition-all hover:bg-[#D62828] group-hover:opacity-100 sm:top-[135px] lg:top-[150px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          </>
        )}
      </div>

      {/* 该栏自己的圆点：固定 5 个 */}
      {slots.length > 1 && (
        <div className="flex justify-center gap-1.5 pt-1">
          {slots.map((_, index) => (
            <button
              key={index}
              type="button"
              aria-label={`${meta.label}第 ${index + 1} 页`}
              onClick={() => goTo(index)}
              className="h-2.5 w-2.5 rounded-full border-2 border-[#121212]"
              style={{ backgroundColor: index === page ? meta.color : '#D3D1C7' }}
            />
          ))}
        </div>
      )}
    </section>
  );
};

export const HomeCarousel: React.FC<HomeCarouselProps> = ({
  online, offline, promo, onOpenCampaign, onSelectManage, onSelectResources,
  onSelectRoundtable,
}) => {
  const areaRef = useRef<HTMLDivElement>(null);
  const [paused, setPaused] = useState(false);

  // 三栏自动轮播由顶层统一驱动：同一时刻、同方向（向右）各翻一页，到末页回到第一页循环。
  // 鼠标进入整块轮播区域即全部暂停；手动只翻当前栏，移开后恢复同步。
  useEffect(() => {
    if (paused) return;
    const timer = window.setInterval(() => {
      const tracks = areaRef.current?.querySelectorAll<HTMLDivElement>('.hc-lane-track');
      if (!tracks || tracks.length === 0) return;
      tracks.forEach((el) => {
        const width = el.clientWidth;
        const max = el.scrollWidth - el.clientWidth;
        if (max <= 0) return;
        let next = el.scrollLeft + width;
        if (next >= max - 4) next = 0;
        el.scrollTo({ left: next, behavior: 'smooth' });
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [paused]);

  return (
    <div className="flex w-full flex-col gap-6">
      <style>{`
        /* padding-top 给卡片 hover 上浮留出余量，避免 2px 边框被 overflow 裁掉；底部留白放投影 */
        .hc-lane-track { display:flex; gap:0; overflow-x:auto; overflow-y:hidden; scroll-snap-type:x mandatory; scrollbar-width:none; padding:4px 0 10px; align-items:stretch; height:100%; }
        .hc-lane-track::-webkit-scrollbar { display:none; }
        .hc-slide { flex:0 0 100%; scroll-snap-align:start; min-width:0; min-height:520px; }
      `}</style>

      {/* 三栏同步轮播：悬停任一处全部暂停 */}
      <div ref={areaRef} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <div className="grid grid-cols-1 gap-7 lg:grid-cols-3 sm:gap-5">
          <CarouselLane kind="online" campaigns={online} onOpen={onOpenCampaign} />
          <CarouselLane kind="offline" campaigns={offline} onOpen={onOpenCampaign} />
          <CarouselLane kind="promo" campaigns={promo} onOpen={onOpenCampaign} />
        </div>
      </div>

      {/* 功能入口：团务管理 / 爱心资源 / GM圆桌 */}
      <div className="grid grid-cols-1 gap-4 pt-1 sm:grid-cols-3 sm:gap-5">
        <button type="button" onClick={onSelectManage} className="bg-[#121212] py-4 text-center text-lg font-black tracking-wider text-white shadow-[5px_5px_0px_#121212] hover:shadow-[8px_8px_0px_#121212] sm:py-5 sm:text-xl">团务管理</button>
        <button type="button" onClick={onSelectResources} className="bg-[#B51F5C] py-4 text-center text-lg font-black tracking-wider text-white shadow-[5px_5px_0px_#121212] hover:shadow-[8px_8px_0px_#121212] sm:py-5 sm:text-xl">爱心资源</button>
        <button type="button" onClick={onSelectRoundtable} className="bg-[#004E98] py-4 text-center text-lg font-black tracking-wider text-white shadow-[5px_5px_0px_#121212] hover:shadow-[8px_8px_0px_#121212] sm:py-5 sm:text-xl">GM圆桌</button>
      </div>
    </div>
  );
};
