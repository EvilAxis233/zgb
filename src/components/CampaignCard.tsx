import React from 'react';
import { Campaign } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { NameplateBadge } from './NameplateBadge';
import { BookOpen, ThumbsUp, MapPin } from 'lucide-react';
import { locationLabel } from '../utils/location';

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onClick }) => {
  return (
    <article
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick();
        }
      }}
      role="button"
      tabIndex={0}
      aria-label={`查看战役：${campaign.title}`}
      className="bauhaus-card bauhaus-card-interactive flex min-h-[310px] flex-col cursor-pointer group bg-white focus-visible:outline-4 focus-visible:outline-offset-4 focus-visible:outline-[#004E98]"
    >
      {/* Top Banner / Image Area */}
      <div className="relative h-[154px] shrink-0">
        {campaign.imageUrl ? (
          <div className="relative h-full w-full overflow-hidden border-b-2 border-[#121212] bg-[#EAE8E0]">
            <img
              src={campaign.imageUrl}
              alt=""
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-black/10" />
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <h2 className="max-w-[86%] break-words border-2 border-[#121212] bg-white/95 px-3 py-2 text-center text-xl font-black leading-tight tracking-tight text-[#121212] shadow-[3px_3px_0px_#121212] sm:text-2xl">
                {campaign.title}
              </h2>
            </div>
          </div>
        ) : (
          <BauhausPlaceholder
            rule={campaign.rule}
            title={campaign.title}
            seedColor={campaign.bannerColor || '#D62828'}
            className="h-full w-full"
          />
        )}

        {/* Rule, session type, and platforms share the image/content seam. */}
        <div className="absolute -bottom-3 left-3 right-3 flex items-center gap-1.5 z-10 overflow-hidden py-0.5">
          {/* Rule Tag */}
          <div className="px-3 py-0.5 bg-[#FFFFFF] border-2 border-[#121212] shadow-[2px_2px_0px_#121212] text-[14px] font-bold text-[#121212] flex items-center gap-2 shrink-0 whitespace-nowrap">
            <BookOpen className="w-4 h-4 text-[#004E98]" />
            <span>{campaign.rule}</span>
          </div>

          {/* Section-specific metadata beside the rule. */}
          {campaign.kind === 'offline' ? <div className="px-2.5 py-0.5 bg-[#F0F5FA] border-2 border-[#121212] shadow-[2px_2px_0px_#121212] text-[14px] font-bold text-[#004E98] shrink-0 whitespace-nowrap">{locationLabel(campaign)}</div> : <div className="px-2.5 py-0.5 bg-[#F0F5FA] border-2 border-[#121212] shadow-[2px_2px_0px_#121212] text-[14px] font-bold text-[#004E98] flex items-center gap-1.5 shrink-0 whitespace-nowrap">
            <span>{campaign.sessionType || '语音'}</span>
          </div>}

          {campaign.kind !== 'offline' && campaign.platforms?.map((platform) => (
            <div key={platform} className="px-2.5 py-0.5 bg-[#F0F5FA] border-2 border-[#121212] shadow-[2px_2px_0px_#121212] text-[14px] font-bold text-[#004E98] shrink-0 whitespace-nowrap">
              {platform}
            </div>
          ))}

        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-3.5 pt-8 flex-1 flex flex-col">
        {/* 第一行：头像 + GM 名称，右侧为获赞徽章 */}
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-center gap-2 text-base font-black text-[#121212]">
            <span className={`h-7 w-7 shrink-0 overflow-hidden flex items-center justify-center text-sm text-white ${campaign.gmIsMember ? 'gilded-avatar' : 'border-2 border-[#121212] bg-[#D62828]'}`} aria-hidden="true">{campaign.gmAvatar ? <img src={campaign.gmAvatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center bg-[#D62828]">{campaign.gmName.charAt(0)}</span>}</span>
            <span className="truncate">GM: {campaign.gmName}</span>
          </div>
          <span title={`GM 获赞 ${campaign.gmPraises ?? 0}`} aria-label={`GM 获赞 ${campaign.gmPraises ?? 0}`} className="inline-flex shrink-0 items-center gap-1 border-2 border-[#121212] bg-[#D62828] px-2 py-1 text-[11px] font-black text-white shadow-[2px_2px_0px_#121212]">
            <ThumbsUp className="h-3 w-3" />赞 {campaign.gmPraises ?? 0}
          </span>
        </div>

        {/* 头像与分割线之间的空白区：铭牌 + 等高的长条贴纸，整行从头像右缘撑到赞徽章右缘。
            上下间距都用固定值，避免 flex-1 把剩余空间自动分配、改动一处就挤动另一处。 */}
        <div className="flex h-6 shrink-0 items-center gap-1.5">
          {campaign.gmNameplate && <NameplateBadge nameplate={campaign.gmNameplate} className="shrink-0" />}
          {!!campaign.gmStickers?.length && campaign.gmStickers.slice(0, 2).map((src, index) => (
            <span key={`${src}-${index}`} className="block h-6 min-w-0 flex-1 overflow-hidden">
              <img src={src} alt="GM 贴纸" className="h-full w-full object-cover" />
            </span>
          ))}
        </div>

        <div className="mt-[38px] border-t border-dashed border-[#D8D5CC] pt-2">
          <div className="flex flex-wrap content-start items-start gap-2">
            {campaign.customTags?.map((tag) => (
              <span key={`custom-${tag}`} className="whitespace-nowrap border border-[#121212] bg-[#FFF9F9] px-2 py-0.5 text-sm font-bold text-[#D62828] shadow-[1px_1px_0px_#121212]">#{tag}</span>
            ))}
          </div>
          {campaign.kind === 'offline' && campaign.address && <p className="mt-2 flex items-start gap-1.5 text-xs font-bold text-[#555] break-all"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#004E98]" /><span>地址：{campaign.address}</span></p>}
        </div>
      </div>
    </article>
  );
};
