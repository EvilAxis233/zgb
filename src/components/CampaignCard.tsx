import React from 'react';
import { Campaign } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { formatDisplayTime } from '../utils/date';
import { Clock, User, BookOpen, Users } from 'lucide-react';

interface CampaignCardProps {
  campaign: Campaign;
  onClick: () => void;
}

export const CampaignCard: React.FC<CampaignCardProps> = ({ campaign, onClick }) => {
  return (
    <article
      onClick={onClick}
      className="bauhaus-card bauhaus-card-interactive flex flex-col justify-between cursor-pointer group bg-white"
    >
      {/* Top Banner / Image Area */}
      <div className="relative">
        {campaign.imageUrl ? (
          <div className="h-44 w-full overflow-hidden border-b-2 border-[#121212] bg-[#EAE8E0]">
            <img
              src={campaign.imageUrl}
              alt={campaign.title}
              className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          </div>
        ) : (
          <BauhausPlaceholder
            rule={campaign.rule}
            title={campaign.title}
            seedColor={campaign.bannerColor || '#D62828'}
            className="h-44 w-full"
          />
        )}

        {/* Rule Tag - Bottom Left Overlap */}
        <div className="absolute -bottom-3.5 left-4 px-2.5 py-0.5 bg-[#FFFFFF] border-2 border-[#121212] shadow-[2px_2px_0px_#121212] text-xs font-bold text-[#121212] flex items-center gap-1.5 z-10">
          <BookOpen className="w-3.5 h-3.5 text-[#004E98]" />
          <span>{campaign.rule}</span>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="p-5 pt-6 flex-1 flex flex-col justify-between">
        <div>
          {/* Title & Status Badge Row */}
          <div className="flex items-start justify-between gap-3">
            <h2 className="text-xl font-black text-[#121212] tracking-tight group-hover:text-[#D62828] transition-colors leading-snug line-clamp-1 flex-1">
              {campaign.title}
            </h2>
            <span className="px-2.5 py-1 text-xs font-black border-2 border-[#121212] tracking-wider shadow-[2px_2px_0px_#121212] shrink-0 bg-[#004E98] text-white">招募中</span>
          </div>

          {/* GM & Player Ratio */}
          <div className="mt-2.5 flex items-center justify-between text-xs font-medium text-[#444444] border-b border-[#E5E5E0] pb-2.5">
            <div className="flex items-center gap-1.5 font-bold text-[#121212]">
              <User className="w-3.5 h-3.5 text-[#D62828]" />
              <span>主持: {campaign.gmName}</span>
            </div>
            <div className="flex items-center gap-1 font-bold text-[#121212]">
              <Users className="w-3.5 h-3.5 text-[#004E98]" />
              <span>
                人数: {campaign.currentPlayers}/{campaign.maxPlayers} 人
              </span>
            </div>
          </div>

          {/* Brief Summary */}
          <p className="mt-3 text-sm text-[#444444] leading-relaxed line-clamp-2">
            {campaign.summary}
          </p>
        </div>

        {/* Footer: Dedicated full line for time */}
        <div className="mt-4 pt-3 border-t-2 border-[#121212] flex items-center text-xs text-[#121212] font-semibold bg-[#FAF9F5] px-2.5 py-2 border border-[#E5E5E0]">
          <Clock className="w-4 h-4 text-[#004E98] shrink-0 mr-1.5" />
          <span className="font-bold mr-1 shrink-0">时间:</span>
          <span className="leading-normal break-words">{formatDisplayTime(campaign.timeSchedule)}</span>
        </div>
      </div>
    </article>
  );
};
