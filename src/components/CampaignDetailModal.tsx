import React from 'react';
import { Campaign, UserProfile } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { MarkdownView } from './MarkdownView';
import { X, Clock, Users, Flame, AlertOctagon, CheckCircle2 } from 'lucide-react';

interface CampaignDetailModalProps {
  campaign: Campaign | null;
  onClose: () => void;
  gmUser?: UserProfile;
  currentUser: UserProfile | null;
  onSendPraise: (toUserId: string, type: 'gm') => void;
}

export const CampaignDetailModal: React.FC<CampaignDetailModalProps> = ({
  campaign,
  onClose,
  gmUser,
  currentUser,
  onSendPraise,
}) => {
  if (!campaign) return null;

  const isSelf = currentUser?.id === campaign.gmId;
  const hasGmHeart = (currentUser?.inventory.gmHearts ?? 0) > 0;

  const getStatusLabel = (status: Campaign['status']) => {
    switch (status) {
      case 'recruiting':
        return '招募中';
      case 'full':
        return '已满员';
      case 'concluded':
        return '已完结';
      case 'closed':
        return '已封团';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#FFFFFF] border-4 border-[#121212] shadow-[8px_8px_0px_#121212] my-8 flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between border-b-2 border-[#121212]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 bg-[#D62828] inline-block" />
            <span className="text-sm font-bold tracking-wider text-[#E5E5E0]">
              模组档案
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-[#222] hover:bg-[#D62828] text-white font-bold transition-colors cursor-pointer border border-[#444]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Top Visual + Key Metadata */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            {/* Visual Cover */}
            <div className="md:col-span-5">
              {campaign.imageUrl ? (
                <div className="w-full h-56 border-2 border-[#121212] bg-[#EAE8E0] overflow-hidden shadow-[4px_4px_0px_#121212]">
                  <img
                    src={campaign.imageUrl}
                    alt={campaign.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="border-2 border-[#121212] shadow-[4px_4px_0px_#121212]">
                  <BauhausPlaceholder
                    rule={campaign.rule}
                    title={campaign.title}
                    seedColor={campaign.bannerColor || '#D62828'}
                    className="h-56 w-full"
                  />
                </div>
              )}
            </div>

            {/* Core Info */}
            <div className="md:col-span-7 flex flex-col justify-between h-full">
              <div>
                {/* Rule, Recruitment Status, and Number of Players tags */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="px-2.5 py-0.5 bg-[#004E98] text-white text-xs font-bold border border-[#121212]">
                    {campaign.rule}
                  </span>
                  <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">
                    {getStatusLabel(campaign.status)}
                  </span>
                  <span className="px-2.5 py-0.5 bg-[#F4A261] text-[#121212] text-xs font-bold border border-[#121212] flex items-center gap-1 shadow-[1px_1px_0px_#121212]">
                    <Users className="w-3.5 h-3.5 text-[#121212]" />
                    <span>人数: {campaign.maxPlayers} 人</span>
                  </span>
                </div>

                <h1 className="text-2xl font-black text-[#121212] tracking-tight leading-tight">
                  {campaign.title}
                </h1>

                <p className="mt-3 text-sm text-[#444444] leading-relaxed bg-[#F6F5F0] p-3 border-l-4 border-[#D62828]">
                  {campaign.summary}
                </p>
              </div>

              {/* Time specification row */}
              <div className="mt-4 pt-3 border-t-2 border-[#121212] text-xs">
                <span className="text-[#666666] block font-bold mb-1">时间</span>
                <div className="font-bold text-[#121212] flex items-center gap-2 text-xs sm:text-sm bg-[#FAF9F5] p-2.5 border border-[#E5E5E0]">
                  <Clock className="w-4 h-4 text-[#004E98] shrink-0" />
                  <span>{campaign.timeSchedule}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Introduction / Markdown Rendering */}
          <section className="border-2 border-[#121212] p-5 bg-[#FAF9F5]">
            <h3 className="text-sm font-black tracking-widest border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2">
              <span className="w-2.5 h-2.5 bg-[#004E98]" />
              简介
            </h3>
            <MarkdownView content={campaign.description} />
          </section>

          {/* GM Section: Explicit Preferences & Taboos */}
          <section className="border-2 border-[#121212] bg-[#FFFFFF] p-5 shadow-[4px_4px_0px_#121212]">
            <div className="flex flex-wrap items-center justify-between border-b-2 border-[#121212] pb-3 gap-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-[#D62828] text-white font-black flex items-center justify-center border-2 border-[#121212] text-lg">
                  {campaign.gmName.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#666666]">主持:</span>
                    <span className="font-black text-base text-[#121212]">{campaign.gmName}({campaign.gmQq || campaign.gmId})</span>
                  </div>
                  <p className="text-xs text-[#555555] line-clamp-1">
                    {gmUser?.bio || '暂无个人简介'}
                  </p>
                </div>
              </div>

              {/* GM Heart Praise Action */}
              {currentUser && !isSelf && (
                <button
                  onClick={() => onSendPraise(campaign.gmId, 'gm')}
                  disabled={!hasGmHeart}
                  className={`bauhaus-btn px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 ${
                    hasGmHeart
                      ? 'bg-[#D62828] text-white'
                      : 'bg-[#E5E5E0] text-[#777777] border-[#888888]'
                  }`}
                  title={
                    hasGmHeart
                      ? '消耗1枚GM点赞赞赏该GM'
                      : '仓库暂无GM点赞，参团录入凭证可获得'
                  }
                >
                  <Flame className="w-3.5 h-3.5 fill-current" />
                  <span>给GM点赞</span>
                </button>
              )}
            </div>

            {/* GM Preferences & Taboos Display */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Preferences */}
              <div className="bg-[#F0F5FA] border border-[#004E98] p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#004E98] mb-2 tracking-wide">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>喜好偏好</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gmUser?.preferences && gmUser.preferences.length > 0 ? (
                    gmUser.preferences.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-white border border-[#004E98] text-xs font-medium text-[#121212]"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#777777]">未设置喜好</span>
                  )}
                </div>
              </div>

              {/* Taboos */}
              <div className="bg-[#FAF0F0] border border-[#D62828] p-3">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#D62828] mb-2 tracking-wide">
                  <AlertOctagon className="w-3.5 h-3.5" />
                  <span>雷区禁忌</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {gmUser?.taboos && gmUser.taboos.length > 0 ? (
                    gmUser.taboos.map((item, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 bg-white border border-[#D62828] text-xs font-medium text-[#121212]"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-[#777777]">未设置禁忌</span>
                  )}
                </div>
              </div>
            </div>

            {/* GM Received Praises Badge */}
            <div className="mt-3 flex items-center gap-4 text-xs font-mono text-[#666666]">
              <span>获 GM 赞誉: <strong className="text-[#D62828]">{gmUser?.receivedGmPraises ?? 0}</strong></span>
              <span>获 伙伴点赞: <strong className="text-[#004E98]">{gmUser?.receivedPlayerPraises ?? 0}</strong></span>
            </div>
          </section>
        </div>

        {/* Modal Footer */}
        <div className="bg-[#F6F5F0] border-t-2 border-[#121212] px-6 py-3 flex items-center justify-between">
          <span className="text-xs text-[#666666]">
            发布时间: {campaign.createdAt}
          </span>
          <button
            onClick={onClose}
            className="bauhaus-btn bg-white text-[#121212] px-5 py-1.5 text-xs font-bold"
          >
            关闭
          </button>
        </div>
      </div>
    </div>
  );
};
