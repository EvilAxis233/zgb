import { useState } from 'react';
import { ChevronDown, ChevronUp, Flame, Star, ThumbsUp } from 'lucide-react';
import { api } from '../services/api';
import type { Campaign, CampaignDetail, CampaignMember, UserProfile } from '../types';
import { campaignYear, campaignYears } from '../utils/campaignYear';

interface Props {
  hosted: Campaign[];
  joined: Campaign[];
  gmHearts: number;
  playerHearts: number;
  /** 仅个人档案传入：有登录用户时成员名单里才出现点赞按钮。 */
  currentUser?: UserProfile;
  onUserUpdate?: (user: UserProfile) => void;
}

// 个人档案与后台账号共用同一套「结团履历」：年份筛选从今年（2026）开始，
// 团记录可展开查看与个人档案完全一致的详情；后台不显示点赞按钮。
export function CampaignHistoryPanel({ hosted, joined, gmHearts, playerHearts, currentUser, onUserUpdate }: Props) {
  const [hostedYear, setHostedYear] = useState(() => new Date().getFullYear());
  const [joinedYear, setJoinedYear] = useState(() => new Date().getFullYear());
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignDetails, setCampaignDetails] = useState<Record<string, CampaignDetail>>({});
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [praiseBusy, setPraiseBusy] = useState<string | null>(null);
  const [praiseNotice, setPraiseNotice] = useState('');

  const toggleCampaign = async (camp: Campaign) => {
    const id = camp.id;
    if (expandedCampaign === id) { setExpandedCampaign(null); return; }
    setExpandedCampaign(id);
    if (campaignDetails[id]) return;
    setDetailLoading(id);
    try {
      const { campaign } = await api.campaign(id);
      setCampaignDetails((prev) => ({ ...prev, [id]: campaign }));
    } catch {
      // 成员名单区域已有「加载失败，收起后重试」的内联提示；不再把后端 raw 错误
      // （如「团不存在」）透传到面板底部，避免出现莫名其妙的字样。
    } finally {
      setDetailLoading(null);
    }
  };

  // 点赞按钮只在个人档案出现；后台账号是查看他人资料，不允许代点赞。
  const miniPraiseButton = (camp: CampaignDetail, member: CampaignMember) => {
    if (!currentUser || !onUserUpdate) return null;
    if (member.id === currentUser.id || member.qq === currentUser.qq || !camp.hasEnded) return null;
    const isGm = member.role === 'gm';
    const heartName = isGm ? 'GM' : '玩家';
    const busy = praiseBusy === member.id;
    if (member.praisedByMe) {
      return (
        <button
          type="button"
          disabled={busy}
          onClick={() => void handlePraise(camp, member)}
          title={`已点赞，再点一次取消并返还 1 枚${heartName}点赞券`}
          className={`inline-flex h-5 w-5 shrink-0 items-center justify-center border border-[#121212] bg-[#F2C94C] text-[#121212] hover:opacity-90 ${busy ? 'opacity-60' : ''}`}
        >
          <ThumbsUp className="h-3 w-3 fill-current" />
        </button>
      );
    }
    const hasHeart = isGm ? (currentUser.inventory?.gmHearts ?? 0) > 0 : (currentUser.inventory?.playerHearts ?? 0) > 0;
    return (
      <button
        type="button"
        disabled={!hasHeart || busy}
        onClick={() => void handlePraise(camp, member)}
        title={hasHeart ? `消耗 1 枚${heartName}点赞券` : '点赞券不足'}
        className={`inline-flex h-5 w-5 shrink-0 items-center justify-center border border-[#121212] ${hasHeart ? (isGm ? 'bg-[#D62828] text-white hover:opacity-90' : 'bg-[#004E98] text-white hover:opacity-90') : 'cursor-not-allowed bg-[#E5E5E0] text-[#999]'} ${busy ? 'opacity-60' : ''}`}
      >
        {isGm ? <Flame className="h-3 w-3 fill-current" /> : <Star className="h-3 w-3 fill-current" />}
      </button>
    );
  };

  const handlePraise = async (camp: CampaignDetail, member: CampaignMember) => {
    if (!currentUser || !onUserUpdate || praiseBusy) return;
    if (member.id === currentUser.id || member.qq === currentUser.qq) {
      setPraiseNotice('不能给自己点赞');
      return;
    }
    const type = member.role === 'gm' ? 'gm' : 'player';
    setPraiseBusy(member.id);
    setPraiseNotice('');
    try {
      const result = await api.praise(camp.id, member.id, type);
      const liked = result.liked !== false;
      setCampaignDetails((prev) => {
        const current = prev[camp.id];
        if (!current) return prev;
        return {
          ...prev,
          [camp.id]: {
            ...current,
            members: current.members.map((m) => m.id === member.id
              ? { ...m, receivedPraises: Math.max(0, m.receivedPraises + (liked ? 1 : -1)), praisedByMe: liked }
              : m),
          },
        };
      });
      const { user } = await api.me();
      if (user) onUserUpdate(user);
      setPraiseNotice(liked ? `已为 ${member.name} 点赞` : `已取消对 ${member.name} 的点赞，券已返还`);
      window.setTimeout(() => setPraiseNotice(''), 2200);
    } catch (error) {
      setPraiseNotice(error instanceof Error ? error.message : '点赞失败');
    } finally {
      setPraiseBusy(null);
    }
  };

  // 单条团记录：折叠态只留团名 / 类型 / 结团日期；展开态与个人档案详情一致。
  const archivedRow = (camp: Campaign) => {
    const open = expandedCampaign === camp.id;
    const detail = campaignDetails[camp.id];
    const date = camp.finishedAt || camp.createdAt;
    const region = camp.province && camp.city && (camp.city.startsWith(camp.province) || camp.province.startsWith(camp.city))
      ? camp.city : [camp.province, camp.city].filter(Boolean).join(' ');
    const place = camp.kind === 'offline'
      ? ([region, camp.address].filter(Boolean).join(' ') || '—')
      : (camp.platforms?.length ? camp.platforms.join('、') : '—');
    return (
      <li key={camp.id} className="border border-[#DDDDD5] bg-[#FAF9F5]">
        <div className="flex items-center gap-2 px-2 py-1.5 text-xs">
          <button type="button" onClick={() => void toggleCampaign(camp)} aria-expanded={open}
            className="flex min-w-0 flex-1 items-center gap-1 text-left font-bold hover:text-[#D62828]">
            {open ? <ChevronUp size={12} className="shrink-0" /> : <ChevronDown size={12} className="shrink-0" />}
            <span className="min-w-0 truncate"><strong>{camp.title}</strong> <span className="text-[#888]">· {camp.kind === 'offline' ? '面团' : '网团'}</span></span>
          </button>
          <span className="shrink-0 font-mono text-[10px] text-[#888]">{(camp.finishedAt || camp.createdAt || '').slice(0, 10)}</span>
        </div>
        {open && <div className="border-t border-dashed border-[#DDDDD5] px-2 pb-2 pt-1.5 text-[11px] leading-snug text-[#444]">
          <p className="truncate font-bold text-[#666]"><span className="text-[#121212]">{camp.rule}</span> · {camp.kind === 'offline' ? '面团' : '网团'}</p>
          <p className="font-bold text-[#666]">GM {camp.gmName}{camp.gmQq && `（${camp.gmQq}）`}</p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-bold">
            <span>{camp.timeSchedule}</span>
            <span>{camp.currentPlayers}/{camp.maxPlayers} 人</span>
            <span>{camp.kind === 'offline' ? '地址' : '平台'} {place}</span>
          </div>
          <div className="mt-1 border-t border-dashed border-[#DDDDD5] pt-1.5">
            <p className="font-black text-[#121212]">团简介</p>
            <p className="mt-0.5 whitespace-pre-wrap break-words text-[#555]">{camp.description || '未填写团简介'}</p>
          </div>
          <div className="mt-1 border-t border-dashed border-[#DDDDD5] pt-1.5">
            <p className="font-black text-[#121212]">成员名单</p>
            {detailLoading === camp.id ? (
              <p className="mt-0.5 text-[#888]">正在读取成员名单…</p>
            ) : detail ? (
              <ul className="mt-1 space-y-1">
                {detail.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2 min-w-0">
                    <span className="min-w-0 truncate">
                      <span className={m.role === 'gm' ? 'font-black text-[#D62828]' : 'font-bold text-[#004E98]'}>{m.role === 'gm' ? 'GM' : '玩家'}</span>
                      {' '}{m.name}
                      {m.qq && <span className="ml-1 font-mono text-[#888]">（{m.qq}）</span>}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <span className="inline-flex items-center gap-0.5 font-black text-[#666]" title={`获赞 ${m.receivedPraises}`}><ThumbsUp className="h-3 w-3 fill-current" />{m.receivedPraises}</span>
                      {miniPraiseButton(detail, m)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-[#888]">成员名单加载失败，点「收起」后再展开重试。</p>
            )}
          </div>
        </div>}
      </li>
    );
  };

  const historyBlock = (title: string, list: Campaign[], year: number, setYear: (value: number) => void) => {
    const visible = list.filter((camp) => campaignYear(camp) === year);
    return (
      <div className="border-2 border-[#121212] p-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h5 className="text-sm font-black">{title}履历 <span className="text-[11px] font-bold text-[#888]">共 {list.length} 次</span></h5>
          <label className="flex items-center gap-1 text-[11px] font-bold">年份筛选
            <select aria-label={`${title}履历年份`} value={year} onChange={(event) => setYear(Number(event.target.value))} className="bauhaus-input px-2 py-1 text-xs font-bold">
              {campaignYears(list).map((value) => <option key={value} value={value}>{value} 年</option>)}
            </select>
          </label>
        </div>
        {visible.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#888]">{year} 年暂无已结团记录</p>
        ) : (
          // 展开详情时放开限高，避免成员名单被滚动条压住
          <ul className={`space-y-1 overflow-y-auto ${visible.some((camp) => expandedCampaign === camp.id) ? '' : 'max-h-52'}`}>{visible.map(archivedRow)}</ul>
        )}
      </div>
    );
  };

  return (
    <section className="border-2 border-[#121212] bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b-2 border-[#121212] pb-2">
        <h4 className="font-black">结团履历</h4>
        {/* 原「不含宣群 · 按结团年份归档」位置改为两枚点赞券数量 */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 border-2 border-[#004E98] bg-[#F0F5FB] px-2 py-0.5 shadow-[2px_2px_0px_#004E98]" title="玩家点赞券：每日签到获得，可给玩家同伴点赞">
            <Star className="h-3.5 w-3.5 fill-[#004E98] text-[#004E98]" />
            <span className="text-[11px] font-bold text-[#121212]">玩家点赞券</span>
            <span className="font-mono text-xs font-black text-[#004E98]">{playerHearts}</span>
          </div>
          <div className="flex items-center gap-1.5 border-2 border-[#D62828] bg-[#FAF0F0] px-2 py-0.5 shadow-[2px_2px_0px_#D62828]" title="GM点赞券：累计签到每满7次，按当次身份得1张（会员3张）；会员期间断签不清零、身份变化不清零，普通用户断签重算。可在团详情给GM点赞">
            <Flame className="h-3.5 w-3.5 fill-[#D62828] text-[#D62828]" />
            <span className="text-[11px] font-bold text-[#121212]">GM点赞券</span>
            <span className="font-mono text-xs font-black text-[#D62828]">{gmHearts}</span>
          </div>
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {historyBlock('带团', hosted, hostedYear, setHostedYear)}
        {historyBlock('参团', joined, joinedYear, setJoinedYear)}
      </div>
      {praiseNotice && <p className="mt-2 text-[11px] font-bold text-[#7A4B00]">{praiseNotice}</p>}
    </section>
  );
}
