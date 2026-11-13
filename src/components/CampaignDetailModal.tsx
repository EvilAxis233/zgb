import { useState } from 'react';
import { Clock, Flame, Star, ThumbsUp, UserPlus, UserRoundX, Users, X, Edit2, Trash2, Copy, FileText } from 'lucide-react';
import type { CampaignDetail, CampaignMember, UserProfile } from '../types';
import { BauhausPlaceholder } from './BauhausPlaceholder';
import { MarkdownView } from './MarkdownView';
import { NameplateBadge } from './NameplateBadge';
import { ImageHoverPreview } from './ImageHoverPreview';
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
  onEndPromo?: (campaignId: string) => void;
}

function Avatar({ member, stretch = false, large = false }: { member: CampaignMember; stretch?: boolean; large?: boolean }) {
  const tint = member.role === 'gm' ? 'bg-[#D62828]' : 'bg-[#004E98]';
  // large 用于发布者 / GM 详情区：等比例放大成正方形（约 4 行高），不拉伸成竖条。
  const sizeClass = large ? 'w-[4.5rem] h-[4.5rem] text-3xl' : stretch ? 'w-11 self-stretch text-lg' : 'w-11 h-11 text-lg';
  return (
    <span
      className={`${sizeClass} shrink-0 overflow-hidden flex items-center justify-center font-black text-white ${member.isMember ? 'gilded-avatar' : `border-2 border-[#121212] ${member.avatar ? 'bg-white' : tint}`}`}
    >
      {member.avatar ? (
        <img src={member.avatar} alt={`${member.name}的头像`} className="h-full w-full object-cover bg-white" />
      ) : (
        <span className={`flex h-full w-full items-center justify-center ${tint}`}>{member.name.charAt(0)}</span>
      )}
    </span>
  );
}

export const CampaignDetailModal: React.FC<Props> = ({ campaign, currentUser, onClose, onSelectSlot, onLogin, onSignup, onCancelSignup, onRemoveMember, onPraise, onEditCampaign, onDeleteCampaign, onEndPromo }) => {
  const { showConfirm } = useDialog();
  const [copiedQq, setCopiedQq] = useState<string | null>(null);
  const [profileMember, setProfileMember] = useState<CampaignMember | null>(null);
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

  // 站长/管理员在主界面直接处置违规团：编辑内容、结束宣发、删除（需二次确认）。
  const isAdminModerator = !!currentUser?.isAdmin && !!onEditCampaign && !!onDeleteCampaign;
  // 个人档案弹窗：GM / 发布者 / 报名玩家都用同一个只读弹窗，展示简介 + 喜好 + 雷区。
  const profileRoleLabel = profileMember
    ? (profileMember.role === 'gm' ? (campaign.kind === 'promo' ? '发布者' : 'GM') : '玩家')
    : '';
  // GM / 发布者的喜好雷区已经在详情页的成员行里显示过了，档案弹窗只展示简介；报名玩家的档案才展示完整内容。
  const profileIsPlayer = profileMember?.role === 'player';
  const profilePrefs = profileIsPlayer ? (profileMember?.preferences ?? []) : [];
  const profileTaboos = profileIsPlayer ? (profileMember?.taboos ?? []) : [];
  const handleAdminDelete = async () => {
    if (!campaign) return;
    // 宣群「结束宣发」是归档：记录保留为历史，一次确认即可；普通团删除违规内容仍保留双重确认。
    if (campaign.kind === 'promo' && onEndPromo) {
      const ok = await showConfirm({
        title: '结束宣发',
        message: `确定结束「${campaign.title}」的宣发吗？确认后该宣群不再展示，但记录会保留在团务管理的历史记录中，可随时删除。`,
        confirmText: '确定结束宣发',
        type: 'warning',
      });
      if (ok) onEndPromo(campaign.id);
      return;
    }
    const first = await showConfirm({
      title: '删除违规团',
      message: `确定删除《${campaign.title}》吗？团、成员记录和相关点赞将被删除。`,
      confirmText: '继续删除',
      type: 'danger',
    });
    if (!first) return;
    const second = await showConfirm({
      title: '最终确认',
      message: `再次确认：《${campaign.title}》删除后无法恢复，确定执行吗？`,
      confirmText: '确认删除',
      type: 'danger',
    });
    if (second) onDeleteCampaign?.(campaign.id);
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
    // 发布者 / GM 详情区：两组左右对齐。
    // 左组：等比例放大的正方形头像 + 昵称 / 铭牌 / 获赞数 / 点赞按钮，靠左垂直居中。
    // 右组：喜好、雷区紧靠「个人档案」按钮并整体右对齐；标签多行时自动换行，不挤压左侧昵称。
    if (member.role === 'gm') {
      const prefs = member.preferences ?? [];
      const tabooList = member.taboos ?? [];
      const traitRow = (label: string, list: string[], textCls: string, tagCls: string, keyPrefix: string) => list.length > 0 && (
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-1 text-right text-[11px] font-bold">
          <span className={`shrink-0 ${textCls}`}>{label}</span>
          {list.map((tag, i) => <span key={`${keyPrefix}-${i}-${tag}`} className={`max-w-full break-all border px-1.5 py-0.5 ${tagCls}`}>{tag}</span>)}
        </div>
      );
      return (
        <div key={member.id} className="border-b border-[#D8D5CC] last:border-b-0">
          <div className="flex flex-wrap items-stretch gap-3 px-4 py-3">
            <div className="flex min-w-[13rem] flex-1 items-center gap-3">
              <Avatar member={member} large />
              <div className="flex min-w-0 flex-col items-start gap-1.5">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <strong className="min-w-0 break-all text-sm">{member.name}</strong>
                  {member.nameplate && <NameplateBadge nameplate={member.nameplate} />}
                  {receivedPraiseBadge}
                </div>
                {praiseButton(member)}
              </div>
            </div>
            <div className="flex shrink-0 items-center justify-end gap-2">
              <div className="flex min-w-0 max-w-[22rem] flex-col items-end gap-1">
                {traitRow('喜好', prefs, 'text-[#004E98]', 'border-[#004E98] bg-[#F0F5FA] text-[#004E98]', 'gm-pref')}
                {traitRow('雷区', tabooList, 'text-[#D62828]', 'border-[#D62828] bg-[#FAF0F0] text-[#D62828]', 'gm-taboo')}
              </div>
              <button
                type="button"
                onClick={() => setProfileMember(member)}
                title={`查看${campaign.kind === 'promo' ? '发布者' : 'GM'}的个人档案与简介`}
                aria-label={`查看${campaign.kind === 'promo' ? '发布者' : 'GM'}的个人档案与简介`}
                className="bauhaus-btn inline-flex h-[4.5rem] w-14 shrink-0 cursor-pointer flex-col items-center justify-center gap-0 leading-none border-[#004E98] bg-white px-0 py-0 text-[10px] font-black text-[#004E98] hover:bg-[#F0F5FA]"
              >
                <span>个人</span>
                <span className="mt-0.5">档案</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return (
    <div key={member.id} className={playerGrid ? `min-w-0 p-4 border-b border-[#D8D5CC] last:border-b-0 ${hasNextRow ? 'md:border-b' : 'md:border-b-0'} ${hasColumnDivider ? 'md:border-r-2 md:border-r-[#121212]' : ''}` : 'border-b border-[#D8D5CC] last:border-b-0'}>
      <div className={`flex items-start gap-3 ${playerGrid ? '' : 'px-4 py-3 justify-center'}`}>
        {/* 两列对齐：左列头像(跨 ID+铭牌两行) → 获赞点赞在头像正下方；右列 ID → 铭牌 → QQ 数字。第三行的点赞与 QQ 数字齐平。贴纸只在发团卡片（简易主界面）展示，团详情不展示。 */}
        <div className={`grid min-w-0 grid-cols-[2.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 ${playerGrid ? 'flex-1' : 'max-w-[calc(100%-3.5rem)]'}`}>
          <div className="row-span-2 flex justify-center self-center"><Avatar member={member} /></div>
          <div className="flex min-w-0 items-center gap-1.5">
            <strong className="min-w-0 break-all text-sm">{member.name}</strong>
            <button
              type="button"
              onClick={() => setProfileMember(member)}
              title={`查看 ${member.name} 的个人简介`}
              aria-label={`查看 ${member.name} 的个人简介`}
              className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center border border-[#121212] bg-[#F0F5FA] text-[#004E98] hover:bg-[#E1ECFA]"
            >
              <FileText className="h-3 w-3" />
            </button>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
            {member.nameplate && <NameplateBadge nameplate={member.nameplate} />}
          </div>
          <div className="flex justify-center">{receivedPraiseBadge}</div>
          <div className="flex min-w-0 items-center">
            {canSeePlayerQq && member.role === 'player' && (
              <button
                type="button"
                onClick={() => copyQq(member.qq || member.id)}
                title="点击复制玩家 QQ 号"
                className="inline-flex items-center gap-1 border border-[#BFD3EE] bg-[#F0F5FA] px-1.5 py-0.5 text-[11px] font-mono font-bold text-[#004E98] hover:bg-[#E1ECFA] cursor-pointer"
              >
                {member.qq || member.id}
                {copiedQq === (member.qq || member.id) ? <span className="text-[#176B57]">已复制</span> : <Copy className="w-3 h-3" />}
              </button>
            )}
          </div>
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
              {campaign.imageUrl ? <ImageHoverPreview src={campaign.imageUrl} label="团封面原图" className="block w-full"><img src={campaign.imageUrl} alt={`${campaign.title}封面`} className="block aspect-video h-auto w-full object-contain" /></ImageHoverPreview> : <BauhausPlaceholder rule={campaign.rule} title={campaign.title} seedColor={campaign.bannerColor || '#D62828'} className="aspect-video h-auto w-full" />}
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
                {campaign.customTags?.map((tag) => <span key={tag} className="px-2 py-0.5 bg-[#FFF9F9] border border-[#121212] text-xs font-bold text-[#D62828]">{tag}</span>)}
                {!campaign.hasEnded && !campaign.isClosed && !campaign.isFull && !campaign.hasExpired && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">{campaign.kind === 'promo' ? '展示中' : '招募中'}</span>}
                {campaign.kind !== 'promo' && campaign.hasEnded && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">已结团</span>}
                {!campaign.hasEnded && campaign.isClosed && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">{campaign.kind === 'promo' ? '已结束宣发' : '已锁车'}</span>}
                {campaign.kind !== 'promo' && !campaign.hasEnded && !campaign.isClosed && campaign.hasExpired && <span className="px-2.5 py-0.5 bg-[#121212] text-white text-xs font-bold">已封车</span>}
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
            {campaign.kind !== 'promo' && !currentUser && !campaign.hasEnded && !campaign.isClosed && !campaign.isFull && !campaign.hasExpired && <button type="button" onClick={onLogin} className="bauhaus-btn bg-[#D62828] text-white px-5 py-1.5 text-xs font-bold">登录后报名</button>}
            {campaign.kind !== 'promo' && currentUser && !isGm && !campaign.isSignedUp && !campaign.hasEnded && !campaign.isClosed && !campaign.isFull && !campaign.hasExpired && <button type="button" onClick={() => onSignup(campaign.id)} className="bauhaus-btn bg-[#D62828] text-white px-5 py-1.5 text-xs font-bold inline-flex items-center gap-2"><UserPlus className="w-4 h-4" />报名</button>}
            {campaign.kind !== 'promo' && currentUser && campaign.isSignedUp && !campaign.hasExpired && !campaign.hasEnded && !campaign.isClosed && <button type="button" onClick={handleCancelSignup} className="bauhaus-btn bg-white text-[#D62828] border-[#D62828] px-5 py-1.5 text-xs font-bold">取消报名</button>}
            {campaign.kind !== 'promo' && (campaign.hasEnded || campaign.isClosed || campaign.isFull || campaign.hasExpired) && <span className="text-xs font-bold text-[#666]">{campaign.hasEnded ? '本团已结团' : campaign.isClosed || campaign.hasExpired ? '本团已封车' : '报名人数已满'}</span>}
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

      {/* 个人档案（只读）：GM / 发布者从方形文字按钮打开，报名玩家从头像旁的图标按钮打开。 */}
      {profileMember && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          onMouseDown={(event) => { if (event.target === event.currentTarget) setProfileMember(null); }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${profileRoleLabel}个人档案`}
            className="flex max-h-[85vh] w-full max-w-md flex-col border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]"
          >
            <header className="flex shrink-0 items-center justify-between bg-[#121212] px-4 py-2.5 text-white">
              <span className="flex items-center gap-2 text-sm font-black tracking-wider">
                <span className="h-3 w-3 bg-[#F4A261]" />
                {profileRoleLabel}个人档案
              </span>
              <button type="button" onClick={() => setProfileMember(null)} aria-label="关闭个人档案" className="cursor-pointer text-white/80 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </header>
            <div className="overflow-y-auto p-4">
              <div className="flex items-center gap-3 border-b-2 border-[#121212] pb-3">
                <Avatar member={profileMember} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <strong className="min-w-0 break-all text-sm font-black">{profileMember.name}</strong>
                    {profileMember.nameplate && <NameplateBadge nameplate={profileMember.nameplate} />}
                  </div>
                  <p className="mt-1 text-[11px] font-bold text-[#777]">本团{profileRoleLabel} · 个人档案</p>
                </div>
              </div>
              <div className="mt-3 border-2 border-[#121212] bg-[#FAF9F5] p-3">
                <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-black tracking-wider text-[#121212]">
                  <span className="h-2.5 w-2.5 bg-[#D62828]" />个人简介
                </h4>
                {profileMember.bio
                  ? <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[#333]">{profileMember.bio}</p>
                  : <p className="text-xs font-bold text-[#888]">这位{profileRoleLabel}还没有填写个人简介。</p>}
              </div>
              {profileIsPlayer && (
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="border-2 border-[#121212] bg-white p-3">
                    <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-black tracking-wider text-[#004E98]">
                      <span className="h-2.5 w-2.5 bg-[#004E98]" />喜好
                    </h4>
                    {profilePrefs.length
                      ? <div className="flex flex-wrap gap-1">{profilePrefs.map((tag, i) => <span key={`pf-pref-${i}-${tag}`} className="max-w-full break-all border border-[#004E98] bg-[#F0F5FA] px-1.5 py-0.5 text-[11px] font-bold text-[#004E98]">{tag}</span>)}</div>
                      : <p className="text-[11px] font-bold text-[#888]">未填写</p>}
                  </div>
                  <div className="border-2 border-[#121212] bg-white p-3">
                    <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-black tracking-wider text-[#D62828]">
                      <span className="h-2.5 w-2.5 bg-[#D62828]" />雷区
                    </h4>
                    {profileTaboos.length
                      ? <div className="flex flex-wrap gap-1">{profileTaboos.map((tag, i) => <span key={`pf-taboo-${i}-${tag}`} className="max-w-full break-all border border-[#D62828] bg-[#FAF0F0] px-1.5 py-0.5 text-[11px] font-bold text-[#D62828]">{tag}</span>)}</div>
                      : <p className="text-[11px] font-bold text-[#888]">未填写</p>}
                  </div>
                </div>
              )}
            </div>
            <footer className="flex shrink-0 justify-end border-t-2 border-[#121212] bg-[#F6F5F0] px-4 py-2.5">
              <button type="button" onClick={() => setProfileMember(null)} className="bauhaus-btn bg-white px-4 py-1.5 text-xs font-black">关闭</button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
};
