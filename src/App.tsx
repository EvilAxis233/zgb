import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Campaign,
  CampaignDetail,
  UserProfile,
  UserNameplate,
} from './types';
import { api } from './services/api';

import { Navbar } from './components/Navbar';
import { CampaignCard } from './components/CampaignCard';
import { CampaignDetailModal } from './components/CampaignDetailModal';
import { PublishModal } from './components/PublishModal';
import { ProfileView } from './components/ProfileView';
import { ManageView } from './components/ManageView';
import { LoginModal } from './components/LoginModal';
import { HomePortal } from './components/HomePortal';
import { HomeCarousel } from './components/HomeCarousel';
import { GmRoundTableView } from './components/GmRoundTableView';
import { CampaignEditModal } from './components/CampaignEditModal';
import { ResourceView } from './components/ResourceView';
import { CalendarFilter } from './components/CalendarFilter';
import { useChatInbox, CustomerServiceEntry, CustomerServiceDialog } from './components/CustomerServiceWidget';
import { InstructionsModal } from './components/InstructionsModal';
import { TicketsModal } from './components/TicketsModal';
import { SubmissionModal } from './components/SubmissionModal';
import { parseTimeSchedule, formatPeriod, TimePeriod } from './utils/date';

import { Search, AlertCircle, CheckCircle2, Sparkles, Clock, LoaderCircle, Plus, Briefcase, UserRound, MessageSquareText, Flag } from 'lucide-react';

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

// 首页形态③轮播预览开关：true=横向卡片轮播，false=旧版通栏按钮。
const PORTAL_CAROUSEL = true;

type AppTab = 'board' | 'profile' | 'manage' | 'resources' | 'roundtable';
type BoardView = 'portal' | 'online' | 'offline' | 'promo';

// 地址栏 ?view= 与页面状态一一对应：刷新、复制链接、报名通知邮件里的按钮都落在同一页。
// 首页（board + portal）不带参数，保持干净的 pigbee.fun/。
const VIEW_STATE: Record<string, { tab: AppTab; board: BoardView }> = {
  board: { tab: 'board', board: 'portal' },
  online: { tab: 'board', board: 'online' },
  offline: { tab: 'board', board: 'offline' },
  promo: { tab: 'board', board: 'promo' },
  profile: { tab: 'profile', board: 'portal' },
  manage: { tab: 'manage', board: 'portal' },
  resources: { tab: 'resources', board: 'portal' },
  roundtable: { tab: 'roundtable', board: 'portal' },
};

const readUrlView = () => VIEW_STATE[new URLSearchParams(window.location.search).get('view') || 'board'] || VIEW_STATE.board;

const viewKeyOf = (tab: AppTab, board: BoardView) => (tab === 'board' ? (board === 'portal' ? 'board' : board) : tab);

// 刷新前的滚动位置按板块分别记在 sessionStorage 里，回到同一页时还原。
const scrollKeyOf = (key: string) => `zgb:scroll:${key}`;

// 宣群每日随机的日期种子键，统一用香港时区（与站点受众一致）的当天日期。
const hkDayKey = () => new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

export function App() {
  // Application Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [popularCustomTags, setPopularCustomTags] = useState<string[]>([]);
  const [currentUserId, setUserIdState] = useState<string | null>(null);
  const currentUserQq = users.find((u) => u.id === currentUserId)?.qq ?? null;

  // UI States
  // 报名通知邮件里的按钮带 ?view=manage，点开直接落在团务管理；其它板块同理，刷新也不会跳回首页。
  const [activeTab, setActiveTab] = useState<AppTab>(() => readUrlView().tab);
  const [boardView, setBoardView] = useState<BoardView>(() => readUrlView().board);
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  // 详情秒开：先用列表缓存渲染弹窗主体，成员名单等详情到齐再补齐；此标记用于成员区显示加载态。
  const [detailLoading, setDetailLoading] = useState(false);
  const openCampaignIdRef = useRef<string | null>(null);
  const [adminEditingCampaign, setAdminEditingCampaign] = useState<Campaign | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  // 客服收件箱放在 App 顶层：全站轮询站务回复，顶栏铃铛 / 首页提示条 / 对话窗共享状态。
  const [chatOpen, setChatOpen] = useState(false);
  const chatInbox = useChatInbox(currentUserQq, chatOpen);
  const openChat = () => { if (!currentUserQq) setIsLoginOpen(true); else setChatOpen(true); };
  const [submissionType, setSubmissionType] = useState<'feedback' | 'report' | null>(null);
  // 举报弹窗预填的被举报人：GM 圆桌回复等具体内容处发起举报时带入作者昵称
  const [submissionReportedUser, setSubmissionReportedUser] = useState('');
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState(0);
  const [loadingCampaignId, setLoadingCampaignId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  // 本次会话里已删除的团：即使后续某次刷新拿到删除前的旧快照，也不会让记录「复活」。
  const removedIdsRef = useRef<Set<string>>(new Set());
  // 正在删除中的团：防止确认框被连点或重复触发。
  const deletingIdsRef = useRef<Set<string>>(new Set());
  // 正在结束宣发中的宣群：归档操作同样防连点。
  const endingPromoIdsRef = useRef<Set<string>>(new Set());
  // 浏览统计：记录上次上报时间，整页加载与切换主板块各记一次，30 秒内不重复。
  const viewTrackedAtRef = useRef(0);
  // 宣群每日随机用：当前香港日期。跨过零点（含页面长时间不刷新）自动更新，触发重新抽取。
  const [promoDayKey, setPromoDayKey] = useState(hkDayKey);
  useEffect(() => {
    const check = () => setPromoDayKey((prev) => (prev === hkDayKey() ? prev : hkDayKey()));
    const timer = window.setInterval(check, 60_000);
    // 从后台切回前台时也立即核对一次，避免浏览器冻结计时器导致跨天没更新。
    document.addEventListener('visibilitychange', check);
    window.addEventListener('focus', check);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', check);
      window.removeEventListener('focus', check);
    };
  }, []);

  // 团详情深链：?campaign=<团 id> 与弹窗一一对应，邀请同伴的链接就靠它落到同一条团。
  const setCampaignParam = (id: string | null) => {
    const url = new URL(window.location.href);
    if (id) url.searchParams.set('campaign', id);
    else url.searchParams.delete('campaign');
    if (url.toString() !== window.location.href) window.history.replaceState({}, '', url.toString());
  };
  const closeCampaign = () => { openCampaignIdRef.current = null; setDetailLoading(false); setSelectedCampaign(null); setCampaignParam(null); };

  // 状态 → 地址栏：切换板块 / 大厅时同步 ?view=。用 replaceState 不污染历史记录，
  // 刷新、复制链接、重新打开都能回到当前这一页。
  const viewKey = viewKeyOf(activeTab, boardView);
  useEffect(() => {
    const url = new URL(window.location.href);
    if (viewKey === 'board') url.searchParams.delete('view');
    else url.searchParams.set('view', viewKey);
    const next = url.toString();
    if (next !== window.location.href) window.history.replaceState({ view: viewKey }, '', next);
  }, [viewKey]);

  // 地址栏 → 状态：浏览器前进 / 后退时跟着切页（只在参数真的变化时触发，避免和上一条互相打架）。
  useEffect(() => {
    const onPop = () => {
      const v = readUrlView();
      setActiveTab(v.tab);
      setBoardView(v.board);
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // 离开页面（刷新 / 关标签）前记下当前滚动位置，按板块分开存，互不干扰。
  const viewKeyRef = useRef(viewKey);
  viewKeyRef.current = viewKey;
  useEffect(() => {
    const save = () => {
      try { window.sessionStorage.setItem(scrollKeyOf(viewKeyRef.current), String(Math.round(window.scrollY))); } catch { /* 隐私模式下忽略 */ }
    };
    window.addEventListener('pagehide', save);
    window.addEventListener('beforeunload', save);
    const onHide = () => { if (document.visibilityState === 'hidden') save(); };
    document.addEventListener('visibilitychange', onHide);
    return () => {
      window.removeEventListener('pagehide', save);
      window.removeEventListener('beforeunload', save);
      document.removeEventListener('visibilitychange', onHide);
    };
  }, []);

  // 数据到齐后再还原滚动位置：提前还原会因内容高度不够被浏览器夹回顶部。
  const initialViewKeyRef = useRef(viewKey);
  const scrollRestoredRef = useRef(false);
  useEffect(() => {
    if (loading || scrollRestoredRef.current) return;
    scrollRestoredRef.current = true;
    let y = 0;
    try { y = Number(window.sessionStorage.getItem(scrollKeyOf(initialViewKeyRef.current)) || 0); } catch { /* ignore */ }
    if (!Number.isFinite(y) || y < 60) return;
    const jump = () => window.scrollTo(0, y);
    requestAnimationFrame(jump);
    const t1 = window.setTimeout(jump, 200);
    const t2 = window.setTimeout(jump, 520);
    return () => { window.clearTimeout(t1); window.clearTimeout(t2); };
  }, [loading]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [ruleFilter, setRuleFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<'all' | TimePeriod>('all');
  const [dateFilter, setDateFilter] = useState<string | null>(null);
  useEffect(() => {
    setSearchQuery('');
    setRuleFilter('all');
    setPeriodFilter('all');
    setDateFilter(null);
  }, [boardView]);

  const refresh = async () => {
    // 弱网下降级：auth/me 失败时按未登录渲染公开内容，不阻塞首屏
    let user: UserProfile | null = null;
    try { user = (await api.me()).user; } catch { /* 登录状态获取失败，继续加载公开数据 */ }
    if (user) {
      const data = await api.bootstrap();
      setUsers([...data.users.filter((u) => u.id !== data.user.id), data.user]);
      setCampaigns(data.campaigns.filter((c) => !removedIdsRef.current.has(c.id)));
      setRules(data.rules);
      setPopularCustomTags(data.popularCustomTags || []);
      setUserIdState(data.user.id);
    } else {
      const data = await api.campaigns();
      setUsers(data.users);
      setCampaigns(data.campaigns.filter((c) => !removedIdsRef.current.has(c.id)));
      setRules(data.rules);
      setPopularCustomTags(data.popularCustomTags || []);
      setUserIdState(null);
    }
  };

  useEffect(() => {
    refresh().catch((error) => showToast(error.message, 'error')).finally(() => setLoading(false));
  }, []);

  // 浏览统计：整页加载与切换主板块（团大厅 / 个人档案 / 团务 / 爱心资源 / GM圆桌）各记一次。
  // 注册 / 游客由后端按登录 cookie 判定；30 秒内不重复上报，避免连点或严格模式重复调用把数字刷高。
  useEffect(() => {
    const stamp = Date.now();
    if (stamp - viewTrackedAtRef.current < 30_000) return;
    viewTrackedAtRef.current = stamp;
    api.trackView(activeTab === 'board' ? `/board/${boardView}` : `/${activeTab}`).catch(() => {});
  }, [activeTab, boardView]);

  // 在线状态心跳：登录用户每 60 秒轻打一次，供后台统计「实时在线人数」，不刷新页面数据。
  useEffect(() => {
    if (!currentUserId) return;
    const timer = window.setInterval(() => { api.me().catch(() => {}); }, 60_000);
    return () => window.clearInterval(timer);
  }, [currentUserId]);

  // Toast Helper
  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3200);
  };

  // Current logged in user object
  const currentUser = useMemo(() => {
    if (!currentUserId) return null;
    return users.find((u) => u.id === currentUserId) || null;
  }, [users, currentUserId]);

  // Daily Check-in
  const run = async (work: () => Promise<unknown>, message: string) => {
    setPendingActions((count) => count + 1);
    try {
      await work();
      // 操作已经成功；全量刷新只是同步数据，弱网下失败不应把它误报成「操作失败」。
      try { await refresh(); } catch { /* 下次操作或刷新会自行同步 */ }
      showToast(message, 'success');
      return true;
    }
    catch (error) { showToast(error instanceof Error ? error.message : '操作失败', 'error'); return false; }
    finally { setPendingActions((count) => count - 1); }
  };
  const handleDailyCheckIn = async () => {
    if (!currentUser) { setIsLoginOpen(true); return; }
    setPendingActions((count) => count + 1);
    try {
      const result = await api.checkin();
      await refresh();
      const progress = `累计签到${result.checkinCount}次`;
      const reward = result.gmHeartsAwarded
        ? `已获得${result.gmHeartsAwarded}张GM点赞券！`
        : `距离下次领取GM点赞券还需签到${result.daysUntilGmReward}次。`;
      showToast(`${progress}，获得1张玩家点赞券。${reward}`, 'success');
    } catch (error) {
      showToast(error instanceof Error ? error.message : '签到失败', 'error');
    } finally {
      setPendingActions((count) => count - 1);
    }
  };

  // Publish New Campaign
  const prepareCampaign = async (data: Campaign | Omit<Campaign, 'id' | 'createdAt'>) => {
    let imageKey = data.imageKey ?? null;
    if (data.imageUrl?.startsWith('data:image/')) {
      const blob = await fetch(data.imageUrl).then((r) => r.blob());
      const ext = blob.type === 'image/jpeg' ? 'jpg' : (blob.type.split('/')[1] || 'png');
      const uploaded = await api.upload(new File([blob], `cover.${ext}`, { type: blob.type }));
      imageKey = uploaded.imageKey;
    }
    return { ...data, imageKey };
  };
  const handlePublish = async (data: Omit<Campaign, 'id' | 'createdAt'>) => {
    return run(async () => { await api.createCampaign(await prepareCampaign(data)); }, `${data.kind === 'online' ? '网团' : data.kind === 'offline' ? '面团' : '宣群'}《${data.title}》发布成功`);
  };

  // 删除团 / 删除宣群历史记录：第一次确认后立即删除并立即从界面移除。
  // 不再等全量刷新，避免弱网下刷新慢或失败时旧卡片仍挂在列表里，被误认为「没删掉」而再点一次。
  const handleDeleteCampaign = async (campaignId: string, successMessage?: string) => {
    if (deletingIdsRef.current.has(campaignId)) return true;
    const target = campaigns.find((campaign) => campaign.id === campaignId);
    const message = successMessage || (target?.kind === 'promo' ? '宣群历史记录已删除' : '战役已弃团');
    deletingIdsRef.current.add(campaignId);
    setPendingActions((count) => count + 1);
    try {
      await api.deleteCampaign(campaignId);
    } catch (error) {
      const reason = error instanceof Error ? error.message : '操作失败';
      // 服务端已经没有这个团（例如上一次点击其实删除成功了），按成功收敛，不再让用户重试。
      if (!/团不存在|404/.test(reason)) {
        showToast(reason, 'error');
        return false;
      }
    } finally {
      deletingIdsRef.current.delete(campaignId);
      setPendingActions((count) => count - 1);
    }
    removedIdsRef.current.add(campaignId);
    setCampaigns((previous) => previous.filter((campaign) => campaign.id !== campaignId));
    setSelectedCampaign((previous) => (previous?.id === campaignId ? null : previous));
    if (selectedCampaign?.id === campaignId) setCampaignParam(null);
    setAdminEditingCampaign((previous) => (previous?.id === campaignId ? null : previous));
    showToast(message, 'success');
    // 本地状态已精确移除，不再整页刷新：弱网下那次刷新失败会把登录态降级或读到旧快照，
    // 反而制造「又回来了」的错觉。规则、点赞数等在下一次操作或重新进入页面时自然同步。
    return true;
  };
  // 结束宣发：只归档不删除。本地立刻把卡片标成「已结束宣发」，宣群板块随即不再展示，
  // 但团务管理里仍保留这条历史记录，可再用「删除记录」物理删除。
  const handleEndPromo = async (campaignId: string) => {
    if (endingPromoIdsRef.current.has(campaignId)) return true;
    endingPromoIdsRef.current.add(campaignId);
    setPendingActions((count) => count + 1);
    try {
      await api.endPromo(campaignId);
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error');
      return false;
    } finally {
      endingPromoIdsRef.current.delete(campaignId);
      setPendingActions((count) => count - 1);
    }
    setCampaigns((previous) => previous.map((campaign) => campaign.id === campaignId ? { ...campaign, isClosed: true } : campaign));
    // 主界面详情弹窗若正打开这条宣群，归档后直接关掉，避免停留在已下架的内容上。
    setSelectedCampaign((previous) => previous?.id === campaignId ? null : previous);
    if (selectedCampaign?.id === campaignId) setCampaignParam(null);
    showToast('宣发已结束，记录保留在团务管理的历史记录中', 'success');
    return true;
  };
  // 站长/管理员在主界面详情弹窗中直接编辑或删除任意团
  const handleAdminEditCampaign = (campaign: CampaignDetail) => setAdminEditingCampaign(campaign);
  const handleAdminEditSave = async (updated: Campaign) => {
    const ok = await handleUpdateCampaign(updated, true);
    if (ok) {
      setAdminEditingCampaign(null);
      try { const data = await api.campaign(updated.id); setSelectedCampaign(data.campaign); setCampaignParam(data.campaign.id); }
      catch { closeCampaign(); }
    }
    return ok;
  };
  const handleAdminDeleteCampaign = (campaignId: string) => {
    void handleDeleteCampaign(campaignId, '该团已被删除');
  };
  const handleSetCampaignClosed = (campaignId: string, closed: boolean) => run(() => api.setCampaignClosed(campaignId, closed), closed ? '本团已锁车' : '本团已重新开放报名');
  const handleFinishCampaign = (campaignId: string) => run(() => api.finishCampaign(campaignId), '本团已结团');
  const handleAddBatchSlot = (batchId: string, timeSchedule: string) => run(() => api.addBatchSlot(batchId, timeSchedule), '新时段已加入主团');

  // Update existing campaign
  const handleUpdateCampaign = (updated: Campaign, fullEdit = false) => run(async () => {
    if (updated.batchId && !fullEdit) {
      // 团务管理里普通 GM 改批量团：只同步简介、标签、封面和贴纸。
      const prepared = await prepareCampaign(updated);
      await api.updateCampaign(updated.id, {
        description: prepared.description,
        presetTags: prepared.presetTags,
        customTags: prepared.customTags,
        imageKey: prepared.imageKey ?? null,
        ...(prepared.stickerKeys ? { stickerKeys: prepared.stickerKeys } : {}),
      });
      return;
    }
    // 站主在主页的全量编辑：所有字段（含团类型、简介、封面颜色、各时段时间）一次提交。
    await api.updateCampaign(updated.id, await prepareCampaign(updated));
  }, updated.batchId ? '所有时段的信息已更新' : '战役信息已更新');

  // Update User Profile
  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    setPendingActions((count) => count + 1);
    try {
      const { user } = await api.profile(updates);
      setUsers((previous) => previous.map((item) => item.id === user.id ? user : item));
      setCampaigns((previous) => previous.map((campaign) => campaign.gmId === user.id
        ? { ...campaign, gmName: user.name }
        : campaign));
      setSelectedCampaign((previous) => previous ? {
        ...previous,
        gmName: previous.gmId === user.id ? user.name : previous.gmName,
        members: previous.members.map((member) => member.id === user.id ? { ...member, name: user.name } : member),
      } : null);
      showToast('个人档案已保存', 'success');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error');
      return false;
    } finally {
      setPendingActions((count) => count - 1);
    }
  };
  const handleUpdateNameplate = async (nameplate: UserNameplate | null) => {
    setPendingActions((count) => count + 1);
    try {
      const { user } = await api.updateNameplate(nameplate);
      setUsers((previous) => previous.map((item) => item.id === user.id ? user : item));
      setCampaigns((previous) => previous.map((campaign) => campaign.gmId === user.id
        ? { ...campaign, gmNameplate: user.nameplate }
        : campaign));
      setSelectedCampaign((previous) => previous ? {
        ...previous,
        gmNameplate: previous.gmId === user.id ? user.nameplate : previous.gmNameplate,
        members: previous.members.map((member) => member.id === user.id ? { ...member, nameplate: user.nameplate } : member),
      } : null);
      showToast(nameplate ? '铭牌已佩戴' : '铭牌已卸下', 'success');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error');
      return false;
    } finally {
      setPendingActions((count) => count - 1);
    }
  };

  const handleUpdateStickers = async (keys: string[]) => {
    setPendingActions((count) => count + 1);
    try {
      const { user } = await api.updateStickers(keys);
      setUsers((previous) => previous.map((item) => item.id === user.id ? user : item));
      // 卡片上的贴纸可能来自各团的临时选择，改默认后统一拉一次最新数据
      await refresh();
      showToast(keys.length ? '默认贴纸已更新' : '默认贴纸已清空', 'success');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error');
      return false;
    } finally {
      setPendingActions((count) => count - 1);
    }
  };

  // 贴纸 / 铭牌是会员权益：到期后按钮置灰，后端上传接口也会拒绝（已发布的团不受影响）。
  const stickerMember = !!currentUser && (
    !!currentUser.membershipPermanent || currentUser.isOwner === true || currentUser.role === 'owner' ||
    (currentUser.membershipExpiresAt ?? 0) * 1000 > Date.now()
  );

  // 发车 / 编辑车现场上传的贴纸由后端直接写入贴纸库；同步最新用户资料，
  // 让贴纸库、个人档案与卡片立刻看到新贴纸，不必刷新整页。
  const handleStickerUserUpdate = (user: UserProfile) => {
    setUsers((previous) => previous.map((item) => item.id === user.id ? user : item));
  };

  const handleUpdateStickerLibrary = async (keys: string[]) => {
    setPendingActions((count) => count + 1);
    try {
      const { user } = await api.updateStickerLibrary(keys);
      setUsers((previous) => previous.map((item) => item.id === user.id ? user : item));
      showToast(keys.length ? '贴纸库已更新' : '贴纸库已清空', 'success');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : '操作失败', 'error');
      return false;
    } finally {
      setPendingActions((count) => count - 1);
    }
  };

  // Send Praise
  const openCampaign = async (campaign: Pick<Campaign, 'id'>) => {
    // 标记本次请求为最新：快速连续点开不同团时，只让最后一次请求覆盖弹窗。
    openCampaignIdRef.current = campaign.id;
    setLoadingCampaignId(campaign.id);
    // 秒开：列表已加载过该团时，先用缓存数据立即渲染弹窗主体（成员名单暂空，稍后由详情补齐），
    // 避免等待详情接口的网络往返；地址栏同步写入，深链刷新仍能落到该团。
    const cached = campaigns.find((c) => c.id === campaign.id);
    if (cached) {
      setSelectedCampaign({ ...cached, members: [] });
      setCampaignParam(campaign.id);
      setDetailLoading(true);
    }
    try {
      const data = await api.campaign(campaign.id);
      if (openCampaignIdRef.current !== campaign.id) return; // 已有更新的打开请求，丢弃本次结果
      setSelectedCampaign(data.campaign);
      setCampaignParam(data.campaign.id);
    }
    catch (error) {
      if (openCampaignIdRef.current !== campaign.id) return;
      // 秒开失败时保留缓存弹窗只是没有成员，不关闭，避免闪退。
      if (!cached) setCampaignParam(null);
      showToast(error instanceof Error ? error.message : '详情加载失败', 'error');
    }
    finally {
      if (openCampaignIdRef.current === campaign.id) { setDetailLoading(false); setLoadingCampaignId(null); }
    }
  };
  // 打开带 ?campaign= 的链接（邀请同伴 / 分享详情）：数据到齐前直接按 id 拉详情。
  useEffect(() => {
    const campaignId = new URLSearchParams(window.location.search).get('campaign');
    if (campaignId) void openCampaign({ id: campaignId });
    // 只在首次挂载时还原一次，后续由点击与地址栏监听接管。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 浏览器前进 / 后退：地址栏里的团 id 决定详情弹窗开还是关。
  useEffect(() => {
    const syncCampaign = () => {
      const campaignId = new URLSearchParams(window.location.search).get('campaign');
      if (campaignId) void openCampaign({ id: campaignId });
      else setSelectedCampaign(null);
    };
    window.addEventListener('popstate', syncCampaign);
    return () => window.removeEventListener('popstate', syncCampaign);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const mutateCampaign = async (work: () => Promise<unknown>, message: string, campaignId: string) => {
    const ok = await run(work, message);
    if (!ok) return;
    try { const data = await api.campaign(campaignId); setSelectedCampaign(data.campaign); }
    catch { closeCampaign(); }
  };
  // 结团点赞为切换：后端返回 liked=false 表示已取消并退回点赞券，提示语随之变化。
  const handleSendPraise = async (campaignId: string, toUserId: string, type: 'gm' | 'player') => {
    if (!currentUser) { setIsLoginOpen(true); return; }
    setPendingActions((count) => count + 1);
    try {
      const result = await api.praise(campaignId, toUserId, type);
      try { await refresh(); } catch { /* 全量同步失败不影响本次点赞结果 */ }
      try { const data = await api.campaign(campaignId); setSelectedCampaign(data.campaign); }
      catch { closeCampaign(); }
      showToast(result.liked === false ? '已取消点赞，点赞券已返还' : '点赞成功', 'success');
    } catch (error) { showToast(error instanceof Error ? error.message : '操作失败', 'error'); }
    finally { setPendingActions((count) => count - 1); }
  };
  const handleSignup = (campaignId: string) => currentUser ? mutateCampaign(() => api.signup(campaignId), '报名成功', campaignId) : setIsLoginOpen(true);
  const handleCancelSignup = (campaignId: string) => mutateCampaign(() => api.cancelSignup(campaignId), '已取消报名', campaignId);
  const handleRemoveMember = (campaignId: string, qq: string) => mutateCampaign(() => api.removeMember(campaignId, qq), '玩家已移出本团', campaignId);
  const handleUploadAvatar = (file: File) => run(() => api.uploadAvatar(file), '头像已更新');
  const openSubmission = (type: 'feedback' | 'report', reportedUser = '') => {
    if (!currentUser) { setIsLoginOpen(true); return; }
    setSubmissionReportedUser(type === 'report' ? reportedUser : '');
    setSubmissionType(type);
  };
  const handleSubmit = async (type: 'feedback' | 'report', content: string, images: File[], reportedUser: string) => {
    setPendingActions((count) => count + 1);
    try {
      await api.submitFeedback(type, content, images, reportedUser);
      showToast(type === 'report' ? '举报已提交，管理员会尽快受理' : '感谢反馈，我们已经收到', 'success');
      return true;
    } catch (error) {
      showToast(error instanceof Error ? error.message : '提交失败', 'error');
      return false;
    } finally {
      setPendingActions((count) => count - 1);
    }
  };

  // Extract recruiting rules ordered by recruiting campaign count descending
  const recruitingRules = useMemo(() => {
    const countMap = new Map<string, number>();
    const seen = new Set<string>();
    campaigns.forEach((c) => {
      if (c.kind === boardView && !c.hasEnded && !c.isClosed && !c.isFull && c.rule?.trim()) {
        const key = `${c.batchId || c.id}:${c.rule.trim()}`;
        if (seen.has(key)) return;
        seen.add(key);
        const r = c.rule.trim();
        countMap.set(r, (countMap.get(r) || 0) + 1);
      }
    });
    return Array.from(countMap.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([rule, count]) => ({ rule, count }));
  }, [campaigns, boardView]);

  const enrichedCampaigns = useMemo(() => {
    return campaigns.map((c) => ({
      ...c,
      gmPraises: c.gmPraises ?? users.find((u) => u.id === c.gmId)?.receivedGmPraises ?? 0,
    }));
  }, [campaigns, users]);

  // Active dates with recruiting campaigns (for calendar indicators)
  const activeDatesWithCampaigns = useMemo(() => {
    const dates = new Set<string>();
    enrichedCampaigns.forEach((c) => {
      if (c.kind === boardView && !c.hasEnded && !c.isClosed && !c.isFull) {
        if (c.slots?.length) {
          c.slots.forEach((s) => {
            if (!s.hasEnded && !s.isClosed && !s.isFull) {
              const parsed = parseTimeSchedule(s.timeSchedule);
              if (parsed.dateStr) dates.add(parsed.dateStr);
            }
          });
        } else {
          const parsed = parseTimeSchedule(c.timeSchedule);
          if (parsed.dateStr) dates.add(parsed.dateStr);
        }
      }
    });
    return dates;
  }, [enrichedCampaigns, boardView]);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    const matching = enrichedCampaigns.filter((c) => {
      const matchQuery =
        !searchQuery.trim() ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.gmName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.rule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.province || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.city || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.sessionType || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c.platforms || []).some((platform) => platform.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchRule = ruleFilter === 'all' || c.rule === ruleFilter;
      const matchPeriod = periodFilter === 'all' || (c.slots?.length ? c.slots.some((slot) => !slot.hasEnded && !slot.isClosed && !slot.isFull && parseTimeSchedule(slot.timeSchedule).period === periodFilter) : parseTimeSchedule(c.timeSchedule).period === periodFilter);
      const matchDate = !dateFilter || (c.slots?.length ? c.slots.some((slot) => !slot.hasEnded && !slot.isClosed && !slot.isFull && parseTimeSchedule(slot.timeSchedule).dateStr === dateFilter) : parseTimeSchedule(c.timeSchedule).dateStr === dateFilter);

      return c.kind === boardView && !c.hasEnded && !c.isClosed && !c.isFull && matchQuery && matchRule && matchPeriod && matchDate;
    });
    const seen = new Set<string>();
    return matching.filter((c) => {
      const key = c.batchId || c.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [enrichedCampaigns, boardView, searchQuery, ruleFilter, periodFilter, dateFilter]);

  // 首页三栏独立轮播：网团/面团/宣群各 5 个团、各自翻页。
  // 网团/面团：前 2 个按最新发布(createdAt)，后 3 个按截止时间最近(timeSchedule/finishedAt)。
  // 宣群：按当天日期(Asia/Hong_Kong)做种子从全部活跃宣群随机抽 5，当日固定、隔天换。
  const portalCampaigns = useMemo(() => {
    const active = enrichedCampaigns.filter((c) => !c.hasEnded && !c.isClosed && !c.isFull);
    const pool = (kind: 'online' | 'offline' | 'promo') => {
      const seen = new Set<string>();
      return active.filter((c) => {
        if (c.kind !== kind) return false;
        const key = c.batchId || c.id;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    };

    // 解析截止时间戳：优先 finishedAt，其次 timeSchedule；解析不到排最后
    const deadlineTs = (c: Campaign) => {
      const raw = `${c.finishedAt || ''} ${c.timeSchedule || ''}`;
      const m = raw.match(/(20\d{2})[-/](\d{1,2})[-/](\d{1,2})/);
      if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])).getTime();
      return Number.POSITIVE_INFINITY;
    };

    // 前 2 最新发布 + 后 3 截止最近（互不重复）
    const pickRanked = (kind: 'online' | 'offline') => {
      const all = pool(kind);
      const newest = all.slice().sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')).slice(0, 2);
      const used = new Set(newest.map((c) => c.id));
      const soonest = all.filter((c) => !used.has(c.id)).sort((a, b) => deadlineTs(a) - deadlineTs(b)).slice(0, 3);
      return [...newest, ...soonest];
    };

    // 以当天日期为稳定种子，保证"每日随机、当日内固定"。
    // 种子来自 promoDayKey state：跨零点会自动更新，因此页面不刷新也能在 0 点换一批。
    const todayKey = promoDayKey;
    let seed = 2166136261;
    for (let i = 0; i < todayKey.length; i += 1) {
      seed ^= todayKey.charCodeAt(i);
      seed = Math.imul(seed, 16777619);
    }
    const nextRandom = () => {
      seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const promoShuffled = pool('promo').slice();
    for (let i = promoShuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(nextRandom() * (i + 1));
      [promoShuffled[i], promoShuffled[j]] = [promoShuffled[j], promoShuffled[i]];
    }

    return {
      online: pickRanked('online'),
      offline: pickRanked('offline'),
      promo: promoShuffled.slice(0, 5),
    };
  }, [enrichedCampaigns, promoDayKey]);

  // Derived user campaign records
  const myCampaigns = useMemo(() => {
    if (!currentUser) return [];
    return enrichedCampaigns.filter((c) => c.gmId === currentUser.id);
  }, [enrichedCampaigns, currentUser]);

  const myJoinedCampaigns = useMemo(() => {
    if (!currentUser) return [];
    return enrichedCampaigns.filter((campaign) => campaign.isSignedUp);
  }, [enrichedCampaigns, currentUser]);

  const isSectionView = (activeTab === 'board' && boardView !== 'portal') || activeTab === 'resources' || activeTab === 'roundtable';
  const isCarouselPortal = PORTAL_CAROUSEL && activeTab === 'board' && boardView === 'portal';
  const mainContainerMaxWidth = isSectionView
    ? 'max-w-[1760px]'
    : isCarouselPortal
      ? 'max-w-[1760px]'
      : 'max-w-5xl';

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#121212] flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        boardView={boardView}
        setActiveTab={setActiveTab}
        setBoardView={setBoardView}
        onDailyCheckIn={handleDailyCheckIn}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={() => run(() => api.logout(), '已退出登录').then(() => { setActiveTab('board'); setBoardView('portal'); })}
        onOpenTickets={() => currentUser ? setIsTicketsOpen(true) : setIsLoginOpen(true)}
        onOpenInstructions={() => setIsInstructionsOpen(true)}
      />

      {/* Main Container: 网团保持原先宽裕宽度(max-w-[1760px])，主页四个矩形大厅保持 60%(max-w-[864px]) */}
      <main className={`flex-1 ${mainContainerMaxWidth} w-full mx-auto px-4 sm:px-6 py-6 transition-all duration-150`}>
        {/* 客服新消息首页提醒：未读时置顶显示，点击查看后自动消失 */}
        {chatInbox.unread > 0 && (
          <button type="button" onClick={openChat} className="mb-4 flex w-full items-center justify-between gap-3 border-2 border-[#D62828] bg-[#FAF0F0] px-4 py-3 text-left shadow-[4px_4px_0px_#D62828] hover:bg-[#F7DDDD]">
            <span className="flex items-center gap-2 text-sm font-black text-[#B51F1F]">
              <MessageSquareText size={17} />猪猪客服有{chatInbox.unread}条新消息请查收
            </span>
            <span className="shrink-0 text-xs font-black text-[#B51F1F] underline">点击查看 →</span>
          </button>
        )}
        {/* VIEW 1-A: Home Portal —— 形态③横向卡片轮播预览（PORTAL_CAROUSEL 可切回旧版通栏） */}
        {activeTab === 'board' && boardView === 'portal' && (
          <div className="w-full">
            {PORTAL_CAROUSEL ? (
              <HomeCarousel
                online={portalCampaigns.online}
                offline={portalCampaigns.offline}
                promo={portalCampaigns.promo}
                onOpenCampaign={(camp) => { void openCampaign(camp); }}
                onSelectManage={() => {
                  if (currentUser) {
                    setActiveTab('manage');
                  } else {
                    setIsLoginOpen(true);
                  }
                }}
                onSelectResources={() => setActiveTab('resources')}
                onSelectRoundtable={() => setActiveTab('roundtable')}
              />
            ) : (
              <HomePortal
                onSelectOnline={() => setBoardView('online')}
                onSelectOffline={() => setBoardView('offline')}
                onSelectPromo={() => setBoardView('promo')}
                onSelectManage={() => {
                  if (currentUser) {
                    setActiveTab('manage');
                  } else {
                    setIsLoginOpen(true);
                  }
                }}
                onSelectResources={() => setActiveTab('resources')}
              />
            )}
          </div>
        )}

        {/* VIEW 1-B: Online Sessions (点开“网团”后展示排布：卡片列表 + 右侧筛选框，宽度与原来一样) */}
        {activeTab === 'board' && boardView !== 'portal' && (
          <div className="w-full">
            {/* 卡片展示与右侧筛选栏 (图2原返回栏已按要求彻底去除) */}
            <div className="flex flex-col lg:flex-row gap-6 items-start">
              <aside className="w-full lg:w-60 xl:w-64 shrink-0 order-1 lg:sticky lg:top-20 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => currentUser ? setIsPublishOpen(true) : setIsLoginOpen(true)}
                  className="bauhaus-btn w-full bg-[#D62828] text-white px-4 py-3 text-sm font-black flex items-center justify-center gap-2 hover:bg-[#b52020] cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  {boardView === 'online' ? '发布新团' : boardView === 'offline' ? '发布面团' : '发布宣群'}
                </button>
                <button
                  type="button"
                  onClick={() => currentUser ? setActiveTab('manage') : setIsLoginOpen(true)}
                  className="bauhaus-btn w-full bg-white text-[#121212] px-4 py-3 text-sm font-black flex items-center justify-center gap-2 hover:bg-[#FAF9F5] cursor-pointer"
                >
                  <Briefcase className="w-4 h-4" />
                  团务管理
                </button>
                <button type="button" onClick={() => currentUser ? setActiveTab('profile') : setIsLoginOpen(true)} className="bauhaus-btn w-full bg-white text-[#121212] px-4 py-3 text-sm font-black flex items-center justify-center gap-2 hover:bg-[#FAF9F5] cursor-pointer"><UserRound className="w-4 h-4" />个人档案</button>
                <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 pt-1 lg:pt-3 lg:border-t-2 lg:border-[#121212]">
                  <button type="button" onClick={() => openSubmission('feedback')} className="bauhaus-btn w-full bg-[#EAF3FB] text-[#004E98] px-3 py-3 text-sm font-black gap-2 hover:bg-[#D9EAF8]"><MessageSquareText className="w-4 h-4" />反馈</button>
                  <button type="button" onClick={() => openSubmission('report')} className="bauhaus-btn w-full bg-[#FAF0F0] text-[#B51F1F] px-3 py-3 text-sm font-black gap-2 hover:bg-[#F7DDDD]"><Flag className="w-4 h-4" />举报</button>
                </div>
              </aside>

              {/* Center Column: Responsive cards layout */}
              <section className="flex-1 min-w-0 w-full order-2">
                {loading ? (
                  <div className="bauhaus-card p-12 text-center bg-white border-2 border-[#121212]">
                    加载中…
                  </div>
                ) : filteredCampaigns.length === 0 ? (
                  <div className="bauhaus-card p-12 text-center bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212]">
                    <p className="text-base font-bold text-[#222222]">暂无符合条件的{boardView === 'online' ? '网团' : boardView === 'offline' ? '面团' : '宣群'}</p>
                    {(searchQuery || ruleFilter !== 'all' || periodFilter !== 'all' || dateFilter) && (
                      <button
                        onClick={() => {
                          setSearchQuery('');
                          setRuleFilter('all');
                          setPeriodFilter('all');
                          setDateFilter(null);
                        }}
                        className="mt-3 bauhaus-btn bg-[#FAF0F0] text-[#D62828] border-[#D62828] px-4 py-1.5 text-xs font-bold hover:bg-[#D62828] hover:text-white cursor-pointer"
                      >
                        清空所有筛选条件
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
                    {filteredCampaigns.map((camp) => (
                      <CampaignCard
                        key={camp.id}
                        campaign={camp}
                        onClick={() => openCampaign(camp)}
                      />
                    ))}
                  </div>
                )}
              </section>

              {/* Right Column: 筛选检索（保持原先宽度与日历组件） */}
              <aside className="w-full lg:w-60 xl:w-64 shrink-0 order-1 lg:order-3 lg:sticky lg:top-20 space-y-3">
                <div className="bauhaus-card p-4 sm:p-5 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] space-y-4">
                  <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-3.5 h-3.5 bg-[#004E98] inline-block" />
                      <h3 className="text-base font-black text-[#121212] tracking-wider">筛选检索</h3>
                    </div>
                    <span className="bg-[#121212] text-white text-[11px] font-bold px-2 py-0.5">
                      {filteredCampaigns.length} 个结果
                    </span>
                  </div>

                  {/* Search input */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#121212]">搜索战役</label>
                    <div className="relative">
                      <Search className="w-4 h-4 text-[#888888] absolute left-3 top-2.5" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索团名、主持、简介..."
                        className="bauhaus-input w-full pl-9 pr-3 py-1.5 text-xs font-medium"
                      />
                    </div>
                  </div>

                  {/* Rule Filter */}
                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-[#121212]">按规则筛选</label>
                    <select
                      value={ruleFilter}
                      onChange={(e) => setRuleFilter(e.target.value)}
                      className="bauhaus-input w-full px-3 py-1.5 text-xs font-bold cursor-pointer"
                    >
                      <option value="all">全部规则</option>
                      {recruitingRules.map(({ rule, count }) => (
                        <option key={rule} value={rule}>
                          {rule} ({count})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Time Filter: 开团时段筛选 */}
                  <div className="space-y-1.5 pt-2 border-t border-[#E5E5E0]">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-[#121212] flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-[#004E98]" />
                        <span>{boardView === 'promo' ? '截止时段' : '开团时段'}</span>
                      </label>
                      {periodFilter !== 'all' && (
                        <span className="text-[10px] text-[#D62828] font-bold">已筛选</span>
                      )}
                    </div>

                    {/* Period Filter (全部 / 早 / 中 / 晚) */}
                    <div className="grid grid-cols-4 gap-1 pt-0.5">
                      {(['all', '早', '中', '晚'] as const).map((p) => {
                        const active = periodFilter === p;
                        return (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setPeriodFilter(p)}
                            className={`py-1.5 text-xs font-bold border transition-all cursor-pointer text-center ${
                              active
                                ? 'bg-[#004E98] text-white border-[#121212] shadow-[1px_1px_0px_#121212]'
                                : 'bg-white text-[#121212] border-[#CCCCCC] hover:border-[#121212] hover:bg-[#FAF9F5]'
                            }`}
                          >
                            {p === 'all' ? '全部' : formatPeriod(p)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Calendar: 开团时段下方增加一个日历，从当前日期往后一个月，可以按日期筛团 */}
                  <CalendarFilter
                    maxDaysAhead={boardView === 'online' ? 30 : null}
                    selectedDate={dateFilter}
                    onSelectDate={setDateFilter}
                    activeDatesWithCampaigns={activeDatesWithCampaigns}
                    deadline={boardView === 'promo'}
                  />

                  {/* Reset button */}
                  {(searchQuery ||
                    ruleFilter !== 'all' ||
                    periodFilter !== 'all' ||
                    dateFilter) && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setRuleFilter('all');
                        setPeriodFilter('all');
                        setDateFilter(null);
                      }}
                      className="w-full mt-2 bauhaus-btn bg-[#FAF0F0] text-[#D62828] border-[#D62828] py-2 text-xs font-bold hover:bg-[#D62828] hover:text-white transition-colors cursor-pointer"
                    >
                      清空全部筛选条件
                    </button>
                  )}
                </div>

                {/* 猪猪客服：独立放在「筛选检索」（含日期检索）整块结束后的下方，不占检索框 */}
                <CustomerServiceEntry userQq={currentUserQq} unread={chatInbox.unread} onOpen={openChat} />
              </aside>
            </div>
          </div>
        )}

        {/* VIEW 2: Personal Profile */}
        {activeTab === 'profile' && currentUser && (
          <div className="w-full">
            <ProfileView
              currentUser={currentUser}
              myCampaigns={myCampaigns.filter((campaign) => campaign.hasEnded && !campaign.isAbandoned)}
              myJoinedCampaigns={myJoinedCampaigns.filter((campaign) => campaign.hasEnded && !campaign.isAbandoned)}
              onUpdateProfile={handleUpdateProfile}
              onSelectCampaign={openCampaign}
              onUploadAvatar={handleUploadAvatar}
              onOpenManage={() => setActiveTab('manage')}
              onOpenResources={() => setActiveTab('resources')}
              onFeedback={() => openSubmission('feedback')}
              onReport={() => openSubmission('report')}
              onUpdateNameplate={handleUpdateNameplate}
              onUpdateStickers={handleUpdateStickers}
              onUpdateStickerLibrary={handleUpdateStickerLibrary}
              onUserUpdate={handleStickerUserUpdate}
            />
          </div>
        )}
        {activeTab === 'profile' && !currentUser && <div className="bauhaus-card max-w-xl mx-auto p-10 text-center bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212]"><p className="mb-4 font-bold">登录后查看个人档案</p><button className="bauhaus-btn px-5 py-2 bg-[#004E98] text-white" onClick={() => setIsLoginOpen(true)}>登录</button></div>}

        {/* VIEW 3: Campaign Management */}
        {activeTab === 'manage' && currentUser && (
          <div className="w-full">
            <ManageView
              // 团务界面只留未结团：招募中 / 封车（锁车或到期）/ 弃团都保留；已结团的信息已在结团履历里展示。
              hostedCampaigns={myCampaigns.filter((campaign) => !campaign.hasEnded)}
              joinedCampaigns={myJoinedCampaigns.filter((campaign) => !campaign.hasEnded)}
              rules={rules}
              popularCustomTags={popularCustomTags}
              stickerLibrary={currentUser?.stickerLibraryKeys || []}
              onUserUpdate={handleStickerUserUpdate}
              isMember={stickerMember}
              onDeleteCampaign={handleDeleteCampaign}
              onEndPromo={handleEndPromo}
              onSetCampaignClosed={handleSetCampaignClosed}
              onFinishCampaign={handleFinishCampaign}
              onAddBatchSlot={handleAddBatchSlot}
              onCancelSignup={handleCancelSignup}
              onSelectCampaign={openCampaign}
              onUpdateCampaign={handleUpdateCampaign}
              onOpenProfile={() => setActiveTab('profile')}
              onRemoveMember={handleRemoveMember}
              onFeedback={() => openSubmission('feedback')}
              onReport={() => openSubmission('report')}
            />
          </div>
        )}
        {activeTab === 'manage' && !currentUser && <div className="bauhaus-card max-w-xl mx-auto p-10 text-center bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212]"><p className="mb-4 font-bold">登录后管理主持和报名的战役</p><button className="bauhaus-btn px-5 py-2 bg-[#004E98] text-white" onClick={() => setIsLoginOpen(true)}>登录</button></div>}

        {/* VIEW 4: 爱心资源（游客可浏览，登录后可分享 / 编辑 / 删除自己的条目） */}
        {activeTab === 'resources' && (
          <ResourceView currentUser={currentUser} onOpenLogin={() => setIsLoginOpen(true)} />
        )}

        {/* VIEW 5: GM圆桌（主题讨论频道，可引用爱心资源，支持讨论回复与举报） */}
        {activeTab === 'roundtable' && <GmRoundTableView currentUserQq={currentUserQq} isAdmin={!!currentUser?.role} onReport={(author) => openSubmission('report', author)} />}
      </main>

      {/* 猪猪客服对话窗：全局常驻，顶栏铃铛 / 首页提示条 / 首页客服块都能唤起 */}
      <CustomerServiceDialog open={chatOpen && !!currentUserQq} onClose={() => setChatOpen(false)} inbox={chatInbox} />

      {/* Campaign Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaign}
        detailLoading={detailLoading}
        onSelectSlot={(id) => openCampaign({ id })}
        onClose={closeCampaign}
        currentUser={currentUser}
        onLogin={() => setIsLoginOpen(true)}
        onSignup={handleSignup}
        onCancelSignup={handleCancelSignup}
        onRemoveMember={handleRemoveMember}
        onPraise={handleSendPraise}
        onEditCampaign={currentUser?.isAdmin ? handleAdminEditCampaign : undefined}
        onDeleteCampaign={currentUser?.isAdmin ? handleAdminDeleteCampaign : undefined}
        onEndPromo={currentUser?.isAdmin ? handleEndPromo : undefined}
      />

      {/* 站长/管理员：主界面直接编辑团内容 */}
      {adminEditingCampaign && (
        <CampaignEditModal
          campaign={adminEditingCampaign}
          rules={rules}
          popularCustomTags={popularCustomTags}
          stickerLibrary={currentUser?.stickerLibraryKeys || []}
          onUserUpdate={handleStickerUserUpdate}
          isMember={stickerMember}
          onSave={handleAdminEditSave}
          onClose={() => setAdminEditingCampaign(null)}
        />
      )}

      {/* Publish Modal */}
      <PublishModal
        isOpen={isPublishOpen}
        kind={boardView === 'portal' ? 'online' : boardView}
        onClose={() => setIsPublishOpen(false)}
        currentUser={currentUser}
        rules={rules}
        popularCustomTags={popularCustomTags}
        onUserUpdate={handleStickerUserUpdate}
        isMember={stickerMember}
        onPublish={handlePublish}
      />
      <LoginModal open={isLoginOpen} onClose={() => setIsLoginOpen(false)} onSuccess={refresh} />
      {isTicketsOpen && currentUser && <TicketsModal onClose={() => setIsTicketsOpen(false)} />}
      <InstructionsModal isOpen={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)} />
      <SubmissionModal type={submissionType} defaultReportedUser={submissionReportedUser} onClose={() => setSubmissionType(null)} onSubmit={handleSubmit} />

      {/* Toast Notifications */}
      <aside aria-label="系统通知" className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-[calc(100vw-2.5rem)] sm:max-w-sm pointer-events-none">
        {(pendingActions > 0 || (loadingCampaignId && !selectedCampaign)) && (
          <div role="status" className="p-3.5 border-2 border-[#121212] border-l-8 border-l-[#004E98] bg-white shadow-[4px_4px_0px_#121212] text-xs font-bold flex items-center gap-2.5">
            <LoaderCircle className="w-4 h-4 text-[#004E98] animate-spin shrink-0" />
            <span>{loadingCampaignId ? '正在加载团详情…' : '正在处理中…'}</span>
          </div>
        )}
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto p-3.5 border-2 border-[#121212] shadow-[4px_4px_0px_#121212] text-xs font-bold flex items-center gap-2.5 transition-all transform translate-y-0 ${
              t.type === 'success'
                ? 'bg-[#FFFFFF] text-[#121212] border-l-8 border-l-[#2A9D8F]'
                : t.type === 'error'
                ? 'bg-[#FAF0F0] text-[#D62828] border-l-8 border-l-[#D62828]'
                : 'bg-[#FFFFFF] text-[#121212] border-l-8 border-l-[#004E98]'
            }`}
          >
            {t.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-[#2A9D8F] shrink-0" />
            ) : t.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-[#D62828] shrink-0" />
            ) : (
              <Sparkles className="w-4 h-4 text-[#004E98] shrink-0" />
            )}
            <span className="leading-snug">{t.message}</span>
          </div>
        ))}
      </aside>

      {/* Footer */}
      <footer className="mt-16 border-t-4 border-[#121212] bg-[#FFFFFF] py-4 px-4 sm:px-6">
        <div className="max-w-[1760px] mx-auto w-full min-h-12 flex flex-col items-center justify-center gap-2 sm:grid sm:grid-cols-[1fr_auto_1fr] sm:items-center transition-all duration-150">
          <span className="font-black text-xl sm:text-2xl text-[#121212] tracking-widest text-center sm:col-start-2 sm:row-start-1">诸告板</span>
          <span className="self-end text-sm text-[#666666] text-right font-medium sm:col-start-3 sm:row-start-1 sm:justify-self-end sm:self-center">交流群（917744498）</span>
        </div>
      </footer>
    </div>
  );
}
export default App;
