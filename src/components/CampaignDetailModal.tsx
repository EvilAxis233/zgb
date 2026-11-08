import { useState } from 'react';
import { Clock, Flame, Star, ThumbsUp, UserPlus, UserRoundX, Users, X, Edit2, Trash2, Copy } from 'lucide-react';
import type { CampaignDetail, CampaignMember, UserProfile } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { MarkdownView } from './MarkdownView';
import { NameplateBadge } from './NameplateBadge';
import { formatDisplayTime } from '../utils/date';
import { useDialog } from './BauhausDialog';
import { locationLabel } from '../utils/location';

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
  onEditCampaign?: (campaign: CampaignDetail) => void;
  onDeleteCampaign?: (campaignId: string) => void;
}

function Avatar({ member }: { member: CampaignMember }) {
  const tint = member.role === 'gm' ? 'bg-[#D62828]' : 'bg-[#004E98]';
  return (
    <span
      className={`w-11 h-11 shrink-0 overflow-hidden flex items-center justify-center text-lg font-black text-white ${member.isMember ? 'gilded-avatar' : `border-2 border-[#121212] ${member.avatar ? 'bg-white' : tint}`}`}
    >
      {member.avatar ? (
        <img src={member.avatar} alt={`${member.name}的头像`} className="h-full w-full object-cover bg-white" />
      ) : (
        <span className={`flex h-full w-full items-center justify-center ${tint}`}>{member.name.charAt(0)}</span>
      )}
    </span>
  );
}

export const CampaignDetailModal: React.FC<Props> = ({ campaign, currentUser, onClose, onSelectSlot, onLogin, onSignup, onCancelSignup, onRemoveMember, onPraise, onEditCampaign, onDeleteCampaign }) => {
  const { showConfirm } = useDialog();
  const [copiedQq, setCopiedQq] = useState<string | null>(null);
  if (!campaign) return null;
  const isGm = currentUser?.id === campaign.gmId;
  // 玩家 QQ 只给该团主持人和站主/管理员看，普通访客与同团其他玩家看不到。
  const canSeePlayerQq = isGm || !!currentUser?.isAdmin;
  const copyQq = (qq: string) => {
    navigator.clipboard?.writeText(qq).then(() => {
      setCopiedQq(qq);
      window.setTimeout(() => setCopiedQq(null), 1600);
    }).catch(() => {});
  };
  const isMember = isGm || campaign.isSignedUp;
  const gm = campaign.members.find((member) => member.role === 'gm');
  const players = campaign.members.filter((member) => member.role === 'player');

  // 站长/管理员在主界面直接处置违规团：编辑内容、删除（需二次确认）。
  const isAdminModerator = !!currentUser?.isAdmin && !!onEditCampaign && !!onDeleteCampaign;
  const handleAdminDelete = async () => {
    if (!campaign) return;
    // 宣群等同于「结束宣发」，一次确认即删除；普通团删除违规内容仍保留双重确认。
    const isPromo = campaign.kind === 'promo';
    const first = await showConfirm({
      title: isPromo ? '结束宣发' : '删除违规团',
      message: isPromo
        ? `确定结束「${campaign.title}」的宣发吗？确认后这条宣群记录将被永久删除，后台不再保留，且无法恢复。`
        : `确定删除《${campaign.title}》吗？团、成员记录和相关点赞将被删除。`,
      confirmText: isPromo ? '确定结束宣发' : '继续删除',
      type: 'danger',
    });
    if (!first) return;
    if (!isPromo) {
      const second = await showConfirm({
        title: '最终确认',
        message: `再次确认：《${campaign.title}》删除后无法恢复，确定执行吗？`,
        confirmText: '确认删除',
        type: 'danger',
      });
      if (!second) return;
    }
    onDeleteCampaign?.(campaign.id);
  };

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
    const receivedPraiseBadge = (
      <span
        className={`inline-flex shrink-0 items-center gap-1 border border-[#121212] bg-white px-1.5 py-0.5 text-[10px] font-black ${member.role === 'gm' ? 'text-[#D62828]' : 'text-[#004E98]'}`}
        title={`${member.role === 'gm' ? 'GM' : '玩家'}获赞 ${member.receivedPraises}`}
        aria-label={`${member.role === 'gm' ? 'GM' : '玩家'}获赞 ${member.receivedPraises}`}
      >
        <ThumbsUp className="h-3 w-3 fill-current" aria-hidden="true" />
        {member.receivedPraises}
      </span>
    );
    return (
    <div key={member.id} className={playerGrid ? `min-w-0 p-4 border-b border-[#D8D5CC] last:border-b-0 ${hasNextRow ? 'md:border-b' : 'md:border-b-0'} ${hasColumnDivider ? 'md:border-r-2 md:border-r-[#121212]' : ''}` : 'border-b border-[#D8D5CC] last:border-b-0'}>
      <div className={`flex items-center gap-3 ${playerGrid ? '' : 'px-4 py-3 justify-center'}`}>
        <Avatar member={member} />
        <div className={`min-w-0 ${playerGrid ? 'flex-1' : 'max-w-[calc(100%-3.5rem)]'}`}>
          {playerGrid ? (
            <>
              <div className="flex min-h-5 flex-wrap items-center gap-2">
                {member.nameplate && <NameplateBadge nameplate={member.nameplate} />}
                {!!member.stickers?.length && <span className="flex items-center gap-1">{member.stickers.slice(0, 2).map((src, index) => <img key={`${src}-${index}`} src={src} alt="贴纸" className="h-4 w-14 rounded-sm border border-[#121212] bg-white object-cover" />)}</span>}
                {receivedPraiseBadge}
              </div>
              <strong className="mt-1.5 block text-sm break-all">{member.name}</strong>
              {canSeePlayerQq && member.role === 'player' && (
                <button
                  type="button"
                  onClick={() => copyQq(member.qq || member.id)}
                  title="点击复制玩家 QQ 号"
                  className="mt-1 inline-flex items-center gap-1 border border-[#BFD3EE] bg-[#F0F5FA] px-1.5 py-0.5 text-[11px] font-mono font-bold text-[#004E98] hover:bg-[#E1ECFA] cursor-pointer"
                >
                  {member.qq || member.id}
                  {copiedQq === (member.qq || member.id) ? <span className="text-[#176B57]">已复制</span> : <Copy className="w-3 h-3" />}
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex min-w-0 flex-nowrap items-center gap-2">
                <strong className="min-w-0 flex-1 truncate text-sm">{member.name}</strong>
                {receivedPraiseBadge}
              </div>
              {(member.nameplate || !!member.stickers?.length) && (
                <div className="mt-1.5 flex items-center gap-1.5">
                  {member.nameplate && <NameplateBadge nameplate={member.nameplate} />}
                  {!!member.stickers?.length && member.stickers.slice(0, 2).map((src, index) => <img key={`${src}-${index}`} src={src} alt="贴纸" className="h-4 w-14 rounded-sm border border-[#121212] bg-white object-cover" />)}
                </div>
              )}
            </>
          )}
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
          <span className="text-sm font-bold tracking-wider flex items-center gap-2"><span className="w-3 h-3 bg-[#D62828]" />{campaign.kind === 'promo' ? '宣群详情' : '模组档案'}</span>
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
                {campaign.kind === 'offline' ? <span className="px-2.5 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212]">{locationLabel(campaign)}</span> : <span className="px-2.5 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212] flex items-center gap-1">
                  <span>{campaign.sessionType || '语音'}</span>
                </span>}
                {campaign.kind !== 'offline' && campaign.platforms?.map((platform) => <span key={platform} className="px-2 py-0.5 bg-[#F0F5FA] text-[#004E98] text-xs font-bold border border-[#121212]">{platform}</span>)}
              </div>
              <div className="flex flex-wrap items-center gap-2 mb-2" aria-label="次级标签">
                {campaign.customTags?.map((tag) => <span key={tag} className="px-2 py-0.5 bg-[#FFF9F9] border border-[#121212] text-xs font-bold text-[#D62828]">#{tag}</span>)}
                {!campaign.hasEnded && !campaign.isClosed && !campaign.isFull && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">{campaign.kind === 'promo' ? '展示中' : '招募中'}</span>}
                {campaign.kind !== 'promo' && campaign.hasEnded && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">已结团</span>}
                {!campaign.hasEnded && campaign.isClosed && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">{campaign.kind === 'promo' ? '已结束宣发' : '已锁车'}</span>}
                {campaign.kind !== 'promo' && <span className="px-2.5 py-0.5 bg-[#F4A261] text-xs font-bold border border-[#121212] flex items-center gap-1"><Users className="w-3.5 h-3.5" />{campaign.currentPlayers}/{campaign.maxPlayers} 人</span>}
              </div>
              {campaign.kind === 'offline' && campaign.address && <p className="mb-2 text-xs font-bold text-[#555] break-all">完整地址：{campaign.address}</p>}
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
                          {`${formatDisplayTime(slot.timeSchedule)}${campaign.kind === 'promo' ? (slot.isClosed ? ' 已结束宣发' : '') : ` · ${slot.currentPlayers}/${slot.maxPlayers}${slot.hasEnded ? ' 已结团' : slot.isClosed ? ' 已锁车' : slot.isFull ? ' 已满' : ''}${slot.isSignedUp ? ' 已报名' : ''}`}`}
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
                  {isGm || campaign.isSignedUp || (campaign.kind === 'promo' && currentUser) ? (
                    <span className="text-[#121212]">
                      联系方式：<span className="font-mono text-[#004E98] select-all font-black">{campaign.contact || campaign.gmQq}</span>
                    </span>
                  ) : (
                    <span className="text-[#777777]">{campaign.kind === 'promo' ? '联系方式：登录后可查看' : '联系方式：报名后可查看'}</span>
                  )}
                </div>
              </div>
            </div>
          <section className="col-span-full border-2 border-[#121212] p-5 bg-[#FAF9F5]">
            <h2 className="text-sm font-black tracking-widest border-b-2 border-[#121212] pb-2 mb-4 flex items-center gap-2"><span className="w-2.5 h-2.5 bg-[#004E98]" />简介</h2>
            <MarkdownView content={campaign.description} />
          </section>
          <section className="col-span-full border-2 border-[#121212] bg-white shadow-[4px_4px_0px_#121212]">
            <div className="px-4 py-3 border-b-2 border-[#121212] flex items-center justify-between"><h2 className="text-sm font-black tracking-widest">{campaign.kind === 'promo' ? '发布者' : '成员名单'}</h2>{campaign.kind !== 'promo' && <span className="text-xs font-bold text-[#666]">GM 1 人 · 玩家 {players.length} 人</span>}</div>
            {gm && memberRow(gm)}
            {campaign.kind !== 'promo' && (players.length ? (
              <div className="grid grid-cols-1 md:grid-cols-3">
                {players.map((member, index) => memberRow(member, index, players.length, true))}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-xs text-[#777]">尚无玩家报名</div>
            ))}
          </section>
          </div>
        </div>
        <footer className="bg-[#F6F5F0] border-t-2 border-[#121212] px-5 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-[#666]">发布时间: {campaign.createdAt}</span>
          <div className="flex flex-wrap items-center justify-end gap-3">
            {campaign.kind !== 'promo' && !currentUser && !campaign.hasEnded && !campaign.isClosed && !campaign.isFull && <button type="button" onClick={onLogin} className="bauhaus-btn bg-[#D62828] text-white px-5 py-1.5 text-xs font-bold">登录后报名</button>}
            {campaign.kind !== 'promo' && currentUser && !isGm && !campaign.isSignedUp && !campaign.hasEnded && !campaign.isClosed && !campaign.isFull && <button type="button" onClick={() => onSignup(campaign.id)} className="bauhaus-btn bg-[#D62828] text-white px-5 py-1.5 text-xs font-bold inline-flex items-center gap-2"><UserPlus className="w-4 h-4" />报名</button>}
            {campaign.kind !== 'promo' && currentUser && campaign.isSignedUp && !campaign.hasExpired && !campaign.hasEnded && !campaign.isClosed && <button type="button" onClick={handleCancelSignup} className="bauhaus-btn bg-white text-[#D62828] border-[#D62828] px-5 py-1.5 text-xs font-bold">取消报名</button>}
            {campaign.kind !== 'promo' && (campaign.hasEnded || campaign.isClosed || campaign.isFull) && <span className="text-xs font-bold text-[#666]">{campaign.hasEnded ? '本团已结团' : campaign.isClosed ? '本团已锁车' : '报名人数已满'}</span>}
            {campaign.kind === 'promo' && !currentUser && <button type="button" onClick={onLogin} className="bauhaus-btn bg-[#004E98] text-white px-5 py-1.5 text-xs font-bold">登录查看联系方式</button>}
            {isAdminModerator && (
              <>
                <button type="button" onClick={() => onEditCampaign?.(campaign)} className="bauhaus-btn bg-[#004E98] text-white px-5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5"><Edit2 className="w-4 h-4" />编辑</button>
                <button type="button" onClick={handleAdminDelete} className="bauhaus-btn bg-[#FAF0F0] text-[#D62828] border-[#D62828] px-5 py-1.5 text-xs font-bold inline-flex items-center gap-1.5"><Trash2 className="w-4 h-4" />{campaign.kind === 'promo' ? '结束宣发' : '删除'}</button>
              </>
            )}
            <button type="button" onClick={onClose} className="bauhaus-btn bg-white px-5 py-1.5 text-xs font-bold">关闭</button>
          </div>
        </footer>
      </div>
    </div>
  );
};
