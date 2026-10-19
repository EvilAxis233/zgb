import { Clock, Flame, Star, UserPlus, UserRoundX, Users, X, Mic, MessageSquare, ClipboardList } from 'lucide-react';
import type { CampaignDetail, CampaignMember, UserProfile } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { MarkdownView } from './MarkdownView';
import { formatDisplayTime } from '../utils/date';
import { useDialog } from './BauhausDialog';

interface Props {
  campaign: CampaignDetail | null;
  currentUser: UserProfile | null;
  onClose: () => void;
  onSelectSlot: (id: string) => void;
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

export const CampaignDetailModal: React.FC<Props> = ({ campaign, currentUser, onClose, onSelectSlot, onLogin, onSignup, onCancelSignup, onRemoveMember, onPraise }) => {
  const { showConfirm } = useDialog();
  if (!campaign) return null;
  const isGm = currentUser?.id === campaign.gmId;
  const isMember = isGm || campaign.isSignedUp;
  const gm = campaign.members.find((member) => member.role === 'gm');
  const players = campaign.members.filter((member) => member.role === 'player');

  const handleRemoveMember = async (member: CampaignMember) => {
    const ok = await showConfirm({
      title: '移出成员',
      message: `确定将玩家「${member.name}」移出本团吗？`,
      confirmText: '确定移出',
      type: 'danger',
    });
    if (ok) onRemoveMember(campaign.id, member.id);
  };

  const handleCancelSignup = async () => {
    const ok = await showConfirm({
      title: '取消报名',
      message: `确定取消报名战役《${campaign.title}》吗？`,
      confirmText: '确定取消',
      type: 'warning',
    });
    if (ok) onCancelSignup(campaign.id);
  };

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

  const memberRow = (member: CampaignMember, index = 0, total = 1, playerGrid = false) => {
    const hasColumnDivider = playerGrid && index % 3 !== 2;
    const hasNextRow = playerGrid && Math.floor(index / 3) * 3 + 3 < total;
    return (
    <div key={member.id} className={playerGrid ? `min-w-0 p-4 border-b border-[#D8D5CC] last:border-b-0 ${hasNextRow ? 'md:border-b' : 'md:border-b-0'} ${hasColumnDivider ? 'md:border-r-2 md:border-r-[#121212]' : ''}` : 'border-b border-[#D8D5CC] last:border-b-0'}>
      <div className={`flex items-center gap-3 ${playerGrid ? '' : 'px-4 py-3'}`}>
        <Avatar member={member} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <strong className={playerGrid ? 'text-sm break-all' : 'truncate text-sm'}>{member.name}</strong>
            <span className={`px-1.5 py-0.5 text-[10px] font-black border border-[#121212] ${member.role === 'gm' ? 'bg-[#D62828]' : 'bg-[#004E98]'} text-white`}>{member.role === 'gm' ? 'GM' : '玩家'}</span>
          </div>
          <span className="text-xs text-[#666]">获{member.role === 'gm' ? ' GM' : '玩家'}点赞：<strong className={member.role === 'gm' ? 'text-[#D62828]' : 'text-[#004E98]'}>{member.receivedPraises}</strong></span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {praiseButton(member)}
          {isGm && member.role === 'player' && !campaign.hasEnded && (
            <button type="button" onClick={() => handleRemoveMember(member)} className="bauhaus-btn p-2 bg-[#FAF0F0] text-[#D62828] border-[#D62828]" title="移出本团"><UserRoundX className="w-4 h-4" /></button>
          )}
        </div>
      </div>
    </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] my-8 flex flex-col max-h-[90vh]">
        <header className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between">
          <span className="text-sm font-bold tracking-wider flex items-center gap-2"><span className="w-3 h-3 bg-[#D62828]" />模组档案</span>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-[#222] hover:bg-[#D62828] border border-[#444]" aria-label="关闭详情"><X className="w-5 h-5" /></button>
        </header>
        <div className="overflow-y-auto p-5 sm:p-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-x-6 gap-y-4 items-start">
            <div className="md:col-span-5 overflow-hidden border-2 border-[#121212] bg-[#EAE8E0] shadow-[4px_4px_0px_#121212]">
              {campaign.imageUrl ? <img src={campaign.imageUrl} alt={`${campaign.title}封面`} className="block aspect-video h-auto w-full object-contain" /> : <BauhausPlaceholder rule={campaign.rule} title={campaign.title} seedColor={campaign.bannerColor || '#D62828'} className="aspect-video h-auto w-full" />}
            </div>
            <div className="md:col-span-7">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2.5 py-0.5 bg-[#004E98] text-white text-xs font-bold border border-[#121212]">{campaign.rule}</span>
                <span className="px-2.5 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212] flex items-center gap-1">
                  {campaign.sessionType === '文字' ? (
                    <MessageSquare className="w-3.5 h-3.5" />
                  ) : campaign.sessionType === '其他游戏形式' ? (
                    <ClipboardList className="w-3.5 h-3.5" />
                  ) : (
                    <Mic className="w-3.5 h-3.5" />
                  )}
                  <span>{campaign.sessionType || '语音'}</span>
                </span>
                {campaign.platforms?.map((platform) => <span key={platform} className="px-2 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212]">{platform}</span>)}
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
                {campaign.isClosed && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">已封团</span>}
                <span className="px-2.5 py-0.5 bg-[#F4A261] text-xs font-bold border border-[#121212] flex items-center gap-1"><Users className="w-3.5 h-3.5" />{campaign.currentPlayers}/{campaign.maxPlayers} 人</span>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <h1 className="min-w-0 text-2xl font-black tracking-tight break-words">{campaign.title}</h1>
                {campaign.slots && campaign.slots.length > 1 && (
                  <label className="shrink-0 sm:w-56">
                    <span className="sr-only">选择开团时段</span>
                    <select
                      value={campaign.id}
                      onChange={(event) => event.target.value !== campaign.id && onSelectSlot(event.target.value)}
                      className="bauhaus-input w-full px-2.5 py-1.5 text-xs font-bold"
                      aria-label="选择开团时段"
                    >
                      {campaign.slots.map((slot) => (
                        <option key={slot.id} value={slot.id}>
                          {formatDisplayTime(slot.timeSchedule)} · {slot.currentPlayers}/{slot.maxPlayers}{slot.hasEnded ? ' 已结束' : slot.isFull ? ' 已满' : ''}{slot.isSignedUp ? ' 已报名' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>
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
            </div>
          <section className="col-span-full border-2 border-[#121212] p-5 bg-[#FAF9F5]">
            <h2 className="text-sm font-black tracking-widest border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2"><span className="w-2.5 h-2.5 bg-[#004E98]" />简介</h2>
            <MarkdownView content={campaign.description} />
          </section>
          <section className="col-span-full border-2 border-[#121212] bg-white shadow-[4px_4px_0px_#121212]">
            <div className="px-4 py-3 border-b-2 border-[#121212] flex items-center justify-between"><h2 className="text-sm font-black tracking-widest">成员名单</h2><span className="text-xs font-bold text-[#666]">GM 1 人 · 玩家 {players.length} 人</span></div>
            {gm && memberRow(gm)}
            {players.length ? (
              <div className="grid grid-cols-1 md:grid-cols-3">
                {players.map((member, index) => memberRow(member, index, players.length, true))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-xs text-[#777]">尚无玩家报名</div>
            )}
          </section>
          </div>
        </div>
        <footer className="bg-[#F6F5F0] border-t-2 border-[#121212] px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#666]">发布时间: {campaign.createdAt}</span>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {!currentUser && !campaign.hasEnded && !campaign.isFull && <button type="button" onClick={onLogin} className="bauhaus-btn bg-[#D62828] text-white px-5 py-1.5 text-xs font-bold">登录后报名</button>}
            {currentUser && !isGm && !campaign.isSignedUp && !campaign.hasEnded && !campaign.isFull && <button type="button" onClick={() => onSignup(campaign.id)} className="bauhaus-btn bg-[#D62828] text-white px-5 py-1.5 text-xs font-bold inline-flex items-center gap-2"><UserPlus className="w-4 h-4" />报名</button>}
            {currentUser && campaign.isSignedUp && !campaign.hasEnded && <button type="button" onClick={handleCancelSignup} className="bauhaus-btn bg-white text-[#D62828] border-[#D62828] px-5 py-1.5 text-xs font-bold">取消报名</button>}
            {(campaign.hasEnded || campaign.isFull) && <span className="text-xs font-bold text-[#666]">{campaign.hasEnded ? '开团日期已结束' : campaign.isClosed ? '本团已封团' : '报名人数已满'}</span>}
            <button type="button" onClick={onClose} className="bauhaus-btn bg-white px-5 py-1.5 text-xs font-bold">关闭</button>
          </div>
        </footer>
      </div>
    </div>
  );
};
