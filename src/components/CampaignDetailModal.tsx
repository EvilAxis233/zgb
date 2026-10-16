import { AlertOctagon, CheckCircle2, Clock, Flame, Star, UserPlus, UserRoundX, Users, X, Mic, MessageSquare, ClipboardList } from 'lucide-react';
import type { CampaignDetail, CampaignMember, UserProfile } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { MarkdownView } from './MarkdownView';
import { formatDisplayTime } from '../utils/date';

interface Props {
  campaign: CampaignDetail | null;
  currentUser: UserProfile | null;
  onClose: () => void;
  onLogin: () => void;
  onSignup: (id: string) => void;
  onCancelSignup: (id: string) => void;
  onRemoveMember: (campaignId: string, qq: string) => void;
  onPraise: (campaignId: string, qq: string, type: 'gm' | 'player') => void;
}

function Avatar({ member }: { member: CampaignMember }) {
  return member.avatar ? (
    <img src={member.avatar} alt={`${member.name}的头像`} className="w-11 h-11 object-cover border-2 border-[#121212] bg-white" />
  ) : (
    <div className={`w-11 h-11 border-2 border-[#121212] text-white font-black text-lg flex items-center justify-center ${member.role === 'gm' ? 'bg-[#D62828]' : 'bg-[#004E98]'}`}>
      {member.name.charAt(0)}
    </div>
  );
}

export const CampaignDetailModal: React.FC<Props> = ({ campaign, currentUser, onClose, onLogin, onSignup, onCancelSignup, onRemoveMember, onPraise }) => {
  if (!campaign) return null;
  const isGm = currentUser?.id === campaign.gmId;
  const isMember = isGm || campaign.isSignedUp;
  const gm = campaign.members.find((member) => member.role === 'gm');
  const players = campaign.members.filter((member) => member.role === 'player');

  const praiseButton = (member: CampaignMember) => {
    if (!currentUser || !campaign.hasEnded || !isMember || member.id === currentUser.id) return null;
    const type = member.role === 'gm' ? 'gm' : 'player';
    const hasHeart = type === 'gm' ? currentUser.inventory.gmHearts > 0 : currentUser.inventory.playerHearts > 0;
    return (
      <button type="button" onClick={() => onPraise(campaign.id, member.id, type)} disabled={!hasHeart}
        className={`bauhaus-btn px-3 py-1.5 text-xs font-bold inline-flex items-center gap-1.5 ${hasHeart ? (type === 'gm' ? 'bg-[#D62828] text-white' : 'bg-[#004E98] text-white') : 'bg-[#E5E5E0] text-[#777] border-[#888]'}`}
        title={hasHeart ? `消耗 1 枚${type === 'gm' ? 'GM' : '玩家'}点赞` : '点赞道具不足'}>
        {type === 'gm' ? <Flame className="w-3.5 h-3.5 fill-current" /> : <Star className="w-3.5 h-3.5 fill-current" />}点赞
      </button>
    );
  };

  const memberRow = (member: CampaignMember) => (
    <div key={member.id} className="border-b border-[#D8D5CC] last:border-b-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <Avatar member={member} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className="truncate text-sm">{member.name}</strong>
            <span className={`px-1.5 py-0.5 text-[10px] font-black border border-[#121212] ${member.role === 'gm' ? 'bg-[#D62828]' : 'bg-[#004E98]'} text-white`}>{member.role === 'gm' ? 'GM' : '玩家'}</span>
          </div>
          <span className="text-xs text-[#666]">获{member.role === 'gm' ? ' GM' : '玩家'}点赞：<strong className={member.role === 'gm' ? 'text-[#D62828]' : 'text-[#004E98]'}>{member.receivedPraises}</strong></span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {praiseButton(member)}
          {isGm && member.role === 'player' && !campaign.hasEnded && (
            <button type="button" onClick={() => onRemoveMember(campaign.id, member.id)} className="bauhaus-btn p-2 bg-[#FAF0F0] text-[#D62828] border-[#D62828]" title="移出本团"><UserRoundX className="w-4 h-4" /></button>
          )}
        </div>
      </div>
      {member.role === 'gm' && (
        <div className="px-4 pb-4 sm:pl-[4.5rem] space-y-3">
          <p className="text-xs text-[#555] leading-relaxed">{member.bio || '暂无个人简介'}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#F0F5FA] border border-[#004E98] p-3">
              <div className="text-xs font-bold text-[#004E98] flex items-center gap-1 mb-2"><CheckCircle2 className="w-3.5 h-3.5" />喜好偏好</div>
              <div className="flex flex-wrap gap-1.5">{member.preferences?.length ? member.preferences.map((item) => <span key={item} className="px-2 py-0.5 bg-white border border-[#004E98] text-xs">{item}</span>) : <span className="text-xs text-[#777]">未设置喜好</span>}</div>
            </div>
            <div className="bg-[#FAF0F0] border border-[#D62828] p-3">
              <div className="text-xs font-bold text-[#D62828] flex items-center gap-1 mb-2"><AlertOctagon className="w-3.5 h-3.5" />雷区禁忌</div>
              <div className="flex flex-wrap gap-1.5">{member.taboos?.length ? member.taboos.map((item) => <span key={item} className="px-2 py-0.5 bg-white border border-[#D62828] text-xs">{item}</span>) : <span className="text-xs text-[#777]">未设置禁忌</span>}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] my-8 flex flex-col max-h-[90vh]">
        <header className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold tracking-wider flex items-center gap-2"><span className="w-3 h-3 bg-[#D62828]" />模组档案</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#222] hover:bg-[#D62828] border border-[#444]" aria-label="关闭详情"><X className="w-5 h-5" /></button>
        </header>
        <div className="overflow-y-auto p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-5 border-2 border-[#121212] shadow-[4px_4px_0px_#121212]">
              {campaign.imageUrl ? <img src={campaign.imageUrl} alt={campaign.title} className="w-full h-56 object-cover" /> : <BauhausPlaceholder rule={campaign.rule} title={campaign.title} seedColor={campaign.bannerColor || '#D62828'} className="h-56 w-full" />}
            </div>
            <div className="md:col-span-7">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-[#004E98] text-white text-xs font-bold border border-[#121212]">{campaign.rule}</span>
                <span className="px-2.5 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212] flex items-center gap-1">
                  {campaign.sessionType === '文字' ? (
                    <MessageSquare className="w-3.5 h-3.5" />
                  ) : campaign.sessionType === '留言板' ? (
                    <ClipboardList className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  <span>{campaign.sessionType || '语音'}</span>
                </span>
                {campaign.presetTags?.map((tag) => (
                  <span key={`dt-preset-${tag}`} className="px-2 py-0.5 bg-[#FAF9F5] border border-[#121212] text-xs font-bold text-[#121212]">
                    {tag}
                  </span>
                ))}
                {campaign.customTags?.map((tag) => (
                  <span key={`dt-custom-${tag}`} className="px-2 py-0.5 bg-[#FFF9F9] border border-[#121212] text-xs font-bold text-[#D62828]">
                    #{tag}
                  </span>
                ))}
                {!campaign.hasEnded && !campaign.isFull && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">招募中</span>}
                <span className="px-2.5 py-0.5 bg-[#F4A261] text-xs font-bold border border-[#121212] flex items-center gap-1"><Users className="w-3.5 h-3.5" />{campaign.currentPlayers}/{campaign.maxPlayers} 人</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">{campaign.title}</h1>
              <div className="mt-4 pt-3 border-t-2 border-[#121212] text-xs font-bold flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#004E98] shrink-0" />
                  <span>{formatDisplayTime(campaign.timeSchedule)}</span>
                </div>
                <div className="text-xs">
                  {isGm || campaign.isSignedUp ? (
                    <span className="text-[#121212]">
                      联系方式：<span className="font-mono text-[#004E98] select-all font-black">{campaign.contact || campaign.gmQq}</span>
                    </span>
                  ) : (
                    <span className="text-[#777777]">联系方式：报名后可查看</span>
                  )}
                </div>
              </div>
              <div className="mt-4">
                {!currentUser && !campaign.hasEnded && !campaign.isFull && <button onClick={onLogin} className="bauhaus-btn bg-[#D62828] text-white px-5 py-2 text-sm font-bold">登录后报名</button>}
                {currentUser && !isGm && !campaign.isSignedUp && !campaign.hasEnded && !campaign.isFull && <button onClick={() => onSignup(campaign.id)} className="bauhaus-btn bg-[#D62828] text-white px-5 py-2 text-sm font-bold inline-flex items-center gap-2"><UserPlus className="w-4 h-4" />报名</button>}
                {currentUser && campaign.isSignedUp && !campaign.hasEnded && <button onClick={() => onCancelSignup(campaign.id)} className="bauhaus-btn bg-white text-[#D62828] border-[#D62828] px-5 py-2 text-sm font-bold">取消报名</button>}
                {(campaign.hasEnded || campaign.isFull) && <span className="text-xs font-bold text-[#666]">{campaign.hasEnded ? '开团日期已结束' : '报名人数已满'}</span>}
              </div>
            </div>
          </div>
          <section className="border-2 border-[#121212] p-5 bg-[#FAF9F5]">
            <h2 className="text-sm font-black tracking-widest border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2"><span className="w-2.5 h-2.5 bg-[#004E98]" />简介</h2>
            <MarkdownView content={campaign.description} />
          </section>
          <section className="border-2 border-[#121212] bg-white shadow-[4px_4px_0px_#121212]">
            <div className="px-4 py-3 border-b-2 border-[#121212] flex items-center justify-between"><h2 className="text-sm font-black tracking-widest">成员名单</h2><span className="text-xs font-bold text-[#666]">GM 1 人 · 玩家 {players.length} 人</span></div>
            {gm && memberRow(gm)}
            {players.length ? players.map(memberRow) : <div className="px-4 py-6 text-center text-xs text-[#777]">尚无玩家报名</div>}
          </section>
        </div>
        <footer className="bg-[#F6F5F0] border-t-2 border-[#121212] px-6 py-3 flex items-center justify-between"><span className="text-xs text-[#666]">发布时间: {campaign.createdAt}</span><button onClick={onClose} className="bauhaus-btn bg-white px-5 py-1.5 text-xs font-bold">关闭</button></footer>
      </div>
    </div>
  );
};
