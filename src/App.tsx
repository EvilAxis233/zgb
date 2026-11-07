import React, { useState, useEffect, useMemo } from 'react';
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
import { CampaignEditModal } from './components/CampaignEditModal';
import { CalendarFilter } from './components/CalendarFilter';
import { InstructionsModal } from './components/InstructionsModal';
import { TicketsModal } from './components/TicketsModal';
import { SubmissionModal } from './components/SubmissionModal';
import { parseTimeSchedule, TimePeriod } from './utils/date';

import { Search, AlertCircle, CheckCircle2, Sparkles, Clock, LoaderCircle, Plus, Briefcase, UserRound, MessageSquareText, Flag } from 'lucide-react';

interface ToastState {
  id: number;
  message: string;
  type: 'success' | 'error' | 'info';
}

export function App() {
  // Application Data States
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [rules, setRules] = useState<string[]>([]);
  const [popularCustomTags, setPopularCustomTags] = useState<string[]>([]);
  const [currentUserId, setUserIdState] = useState<string | null>(null);

  // UI States
  const [activeTab, setActiveTab] = useState<'board' | 'profile' | 'manage'>('board');
  const [boardView, setBoardView] = useState<'portal' | 'online' | 'offline' | 'promo'>('portal');
  const [isTicketsOpen, setIsTicketsOpen] = useState(false);
  const [isInstructionsOpen, setIsInstructionsOpen] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignDetail | null>(null);
  const [adminEditingCampaign, setAdminEditingCampaign] = useState<Campaign | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [submissionType, setSubmissionType] = useState<'feedback' | 'report' | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingActions, setPendingActions] = useState(0);
  const [loadingCampaignId, setLoadingCampaignId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);

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
    const { user } = await api.me();
    if (user) {
      const data = await api.bootstrap();
      setUsers([...data.users.filter((u) => u.id !== data.user.id), data.user]);
      setCampaigns(data.campaigns);
      setRules(data.rules);
      setPopularCustomTags(data.popularCustomTags || []);
      setUserIdState(data.user.id);
    } else {
      const data = await api.campaigns();
      setUsers(data.users);
      setCampaigns(data.campaigns);
      setRules(data.rules);
      setPopularCustomTags(data.popularCustomTags || []);
      setUserIdState(null);
    }
  };

  useEffect(() => {
    refresh().catch((error) => showToast(error.message, 'error')).finally(() => setLoading(false));
  }, []);

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
    try { await work(); await refresh(); showToast(message, 'success'); return true; }
    catch (error) { showToast(error instanceof Error ? error.message : '操作失败', 'error'); return false; }
    finally { setPendingActions((count) => count - 1); }
  };
  const handleDailyCheckIn = async () => {
    if (!currentUser) { setIsLoginOpen(true); return; }
    setPendingActions((count) => count + 1);
    try {
      const result = await api.checkin();
      await refresh();
      const progress = result.isMember ? `会员累计签到${result.memberCheckinCount}次` : `连续签到${result.streak}天`;
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
      const uploaded = await api.upload(new File([blob], 'cover', { type: blob.type }));
      imageKey = uploaded.imageKey;
    }
    return { ...data, imageKey };
  };
  const handlePublish = async (data: Omit<Campaign, 'id' | 'createdAt'>) => {
    return run(async () => { await api.createCampaign(await prepareCampaign(data)); }, `${data.kind === 'online' ? '网团' : data.kind === 'offline' ? '面团' : '宣群'}《${data.title}》发布成功`);
  };

  // Delete Campaign
  const handleDeleteCampaign = (campaignId: string) => run(() => api.deleteCampaign(campaignId), '战役已弃团');
  // 站长/管理员在主界面详情弹窗中直接编辑或删除任意团
  const handleAdminEditCampaign = (campaign: CampaignDetail) => setAdminEditingCampaign(campaign);
  const handleAdminEditSave = async (updated: Campaign) => {
    const ok = await handleUpdateCampaign(updated);
    if (ok) {
      setAdminEditingCampaign(null);
      try { const data = await api.campaign(updated.id); setSelectedCampaign(data.campaign); }
      catch { setSelectedCampaign(null); }
    }
    return ok;
  };
  const handleAdminDeleteCampaign = async (campaignId: string) => {
    const ok = await run(() => api.deleteCampaign(campaignId), '该团已被删除');
    if (ok) setSelectedCampaign(null);
  };
  const handleSetCampaignClosed = (campaignId: string, closed: boolean) => run(() => api.setCampaignClosed(campaignId, closed), campaigns.find((campaign) => campaign.id === campaignId)?.kind === 'promo' ? '宣群已封车' : closed ? '本团已锁车' : '本团已重新开放报名');
  const handleFinishCampaign = (campaignId: string) => run(() => api.finishCampaign(campaignId), '本团已结团');
  const handleAddBatchSlot = (batchId: string, timeSchedule: string) => run(() => api.addBatchSlot(batchId, timeSchedule), '新时段已加入主团');

  // Update existing campaign
  const handleUpdateCampaign = (updated: Campaign) => run(async () => { await api.updateCampaign(updated.id, updated.batchId ? { description: updated.description, presetTags: updated.presetTags, customTags: updated.customTags } : await prepareCampaign(updated)); }, updated.batchId ? '所有时段的简介和标签已更新' : '战役信息已更新');

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
    setLoadingCampaignId(campaign.id);
    try { const data = await api.campaign(campaign.id); setSelectedCampaign(data.campaign); }
    catch (error) { showToast(error instanceof Error ? error.message : '详情加载失败', 'error'); }
    finally { setLoadingCampaignId(null); }
  };
  const mutateCampaign = async (work: () => Promise<unknown>, message: string, campaignId: string) => {
    const ok = await run(work, message);
    if (!ok) return;
    try { const data = await api.campaign(campaignId); setSelectedCampaign(data.campaign); }
    catch { setSelectedCampaign(null); }
  };
  const handleSendPraise = (campaignId: string, toUserId: string, type: 'gm' | 'player') => currentUser
    ? mutateCampaign(() => api.praise(campaignId, toUserId, type), '点赞成功', campaignId) : setIsLoginOpen(true);
  const handleSignup = (campaignId: string) => currentUser ? mutateCampaign(() => api.signup(campaignId), '报名成功', campaignId) : setIsLoginOpen(true);
  const handleCancelSignup = (campaignId: string) => mutateCampaign(() => api.cancelSignup(campaignId), '已取消报名', campaignId);
  const handleRemoveMember = (campaignId: string, qq: string) => mutateCampaign(() => api.removeMember(campaignId, qq), '玩家已移出本团', campaignId);
  const handleUploadAvatar = (file: File) => run(() => api.uploadAvatar(file), '头像已更新');
  const openSubmission = (type: 'feedback' | 'report') => currentUser ? setSubmissionType(type) : setIsLoginOpen(true);
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

  // Derived user campaign records
  const myCampaigns = useMemo(() => {
    if (!currentUser) return [];
    return enrichedCampaigns.filter((c) => c.gmId === currentUser.id);
  }, [enrichedCampaigns, currentUser]);

  const myJoinedCampaigns = useMemo(() => {
    if (!currentUser) return [];
    return enrichedCampaigns.filter((campaign) => campaign.isSignedUp);
  }, [enrichedCampaigns, currentUser]);

  const isSectionView = activeTab === 'board' && boardView !== 'portal';
  const mainContainerMaxWidth = isSectionView
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
        {/* VIEW 1-A: Home Portal (主页：四个长矩形纵向排列) */}
        {activeTab === 'board' && boardView === 'portal' && (
          <div className="w-full">
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
            />
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
              <aside className="w-full lg:w-60 xl:w-64 shrink-0 order-1 lg:order-3 lg:sticky lg:top-20">
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
                        <span>开团时段</span>
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
                            {p === 'all' ? '全部' : p}
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
              </aside>
            </div>
          </div>
        )}

        {/* VIEW 2: Personal Profile */}
        {activeTab === 'profile' && currentUser && (
          <div className="w-full">
            <ProfileView
              currentUser={currentUser}
              myCampaigns={myCampaigns.filter((campaign) => campaign.hasEnded)}
              myJoinedCampaigns={myJoinedCampaigns.filter((campaign) => campaign.hasEnded)}
              onUpdateProfile={handleUpdateProfile}
              onSelectCampaign={openCampaign}
              onUploadAvatar={handleUploadAvatar}
              onOpenManage={() => setActiveTab('manage')}
              onFeedback={() => openSubmission('feedback')}
              onReport={() => openSubmission('report')}
              onUpdateNameplate={handleUpdateNameplate}
              onUpdateStickers={handleUpdateStickers}
              onUpdateStickerLibrary={handleUpdateStickerLibrary}
            />
          </div>
        )}
        {activeTab === 'profile' && !currentUser && <div className="bauhaus-card max-w-xl mx-auto p-10 text-center bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212]"><p className="mb-4 font-bold">登录后查看个人档案</p><button className="bauhaus-btn px-5 py-2 bg-[#004E98] text-white" onClick={() => setIsLoginOpen(true)}>登录</button></div>}

        {/* VIEW 3: Campaign Management */}
        {activeTab === 'manage' && currentUser && (
          <div className="w-full">
            <ManageView
              hostedCampaigns={myCampaigns}
              joinedCampaigns={myJoinedCampaigns}
              rules={rules}
              popularCustomTags={popularCustomTags}
              onDeleteCampaign={handleDeleteCampaign}
              onSetCampaignClosed={handleSetCampaignClosed}
              onFinishCampaign={handleFinishCampaign}
              onAddBatchSlot={handleAddBatchSlot}
              onCancelSignup={handleCancelSignup}
              onSelectCampaign={openCampaign}
              onUpdateCampaign={handleUpdateCampaign}
              onOpenProfile={() => setActiveTab('profile')}
              onFeedback={() => openSubmission('feedback')}
              onReport={() => openSubmission('report')}
            />
          </div>
        )}
        {activeTab === 'manage' && !currentUser && <div className="bauhaus-card max-w-xl mx-auto p-10 text-center bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212]"><p className="mb-4 font-bold">登录后管理主持和报名的战役</p><button className="bauhaus-btn px-5 py-2 bg-[#004E98] text-white" onClick={() => setIsLoginOpen(true)}>登录</button></div>}
      </main>

      {/* Campaign Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaign}
        onSelectSlot={(id) => openCampaign({ id })}
        onClose={() => setSelectedCampaign(null)}
        currentUser={currentUser}
        onLogin={() => setIsLoginOpen(true)}
        onSignup={handleSignup}
        onCancelSignup={handleCancelSignup}
        onRemoveMember={handleRemoveMember}
        onPraise={handleSendPraise}
        onEditCampaign={currentUser?.isAdmin ? handleAdminEditCampaign : undefined}
        onDeleteCampaign={currentUser?.isAdmin ? handleAdminDeleteCampaign : undefined}
      />

      {/* 站长/管理员：主界面直接编辑团内容 */}
      {adminEditingCampaign && (
        <CampaignEditModal
          campaign={adminEditingCampaign}
          rules={rules}
          popularCustomTags={popularCustomTags}
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
        onPublish={handlePublish}
      />
      <LoginModal open={isLoginOpen} onClose={() => setIsLoginOpen(false)} onSuccess={refresh} />
      {isTicketsOpen && currentUser && <TicketsModal onClose={() => setIsTicketsOpen(false)} />}
      <InstructionsModal isOpen={isInstructionsOpen} onClose={() => setIsInstructionsOpen(false)} />
      <SubmissionModal type={submissionType} onClose={() => setSubmissionType(null)} onSubmit={handleSubmit} />

      {/* Toast Notifications */}
      <aside aria-label="系统通知" className="fixed top-5 right-5 z-50 flex flex-col gap-2 max-w-[calc(100vw-2.5rem)] sm:max-w-sm pointer-events-none">
        {(pendingActions > 0 || loadingCampaignId) && (
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
