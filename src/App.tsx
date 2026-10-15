import React, { useState, useEffect, useMemo } from 'react';
import {
  Campaign,
  UserProfile,
  ParticipationRecord,
  CampaignStatus,
} from './types';
import { api } from './services/api';

import { Navbar } from './components/Navbar';
import { CampaignCard } from './components/CampaignCard';
import { CampaignDetailModal } from './components/CampaignDetailModal';
import { PublishModal } from './components/PublishModal';
import { ProfileView } from './components/ProfileView';
import { ManageView } from './components/ManageView';
import { LoginModal } from './components/LoginModal';

import { Search, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react';

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
  const [participations, setParticipations] = useState<ParticipationRecord[]>([]);
  const [currentUserId, setUserIdState] = useState<string | null>(null);

  // UI States
  const [activeTab, setActiveTab] = useState<'board' | 'profile' | 'manage'>('board');
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [isPublishOpen, setIsPublishOpen] = useState(false);
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastState[]>([]);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CampaignStatus>('all');
  const [ruleFilter, setRuleFilter] = useState<string>('all');

  const refresh = async () => {
    const { user } = await api.me();
    if (user) {
      const data = await api.bootstrap();
      setUsers([...data.users.filter((u) => u.id !== data.user.id), data.user]);
      setCampaigns(data.campaigns);
      setRules(data.rules);
      setParticipations(data.participations);
      setUserIdState(data.user.id);
    } else {
      const data = await api.campaigns();
      setUsers(data.users);
      setCampaigns(data.campaigns);
      setRules(data.rules);
      setParticipations([]);
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
    try { await work(); await refresh(); showToast(message, 'success'); return true; }
    catch (error) { showToast(error instanceof Error ? error.message : '操作失败', 'error'); return false; }
  };
  const handleDailyCheckIn = () => currentUser ? run(() => api.checkin(), '签到成功，获得 1 枚玩家点赞') : setIsLoginOpen(true);

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
    return run(async () => { await api.createCampaign(await prepareCampaign(data)); }, `战役《${data.title}》发布成功`);
  };

  // Status Change (封团, 完结, etc.)
  const handleToggleStatus = (campaignId: string, nextStatus: CampaignStatus) => run(() => api.status(campaignId, nextStatus), '战役状态已更新');

  // Delete Campaign
  const handleDeleteCampaign = (campaignId: string) => run(() => api.deleteCampaign(campaignId), '战役已删除');

  // Generate Voucher for concluded campaign
  const handleGenerateVoucher = (campaignId: string) => {
    const camp = campaigns.find((c) => c.id === campaignId);
    if (!camp || !confirm(`此凭证最多供 ${camp.maxPlayers} 人领取，每个账号限领一次。生成后次数上限固定，是否继续？`)) return;
    run(async () => { const res = await api.voucher(campaignId); showToast(`凭证码：${res.voucherCode}`, 'info'); }, '凭证已生成');
  };

  // Redeem Voucher
  const handleRedeemVoucher = (code: string) => run(() => api.redeem(code), '凭证领取成功，获得 1 枚 GM 点赞');

  // Update existing campaign
  const handleUpdateCampaign = (updated: Campaign) => run(async () => { await api.updateCampaign(updated.id, await prepareCampaign(updated)); }, '战役信息已更新');

  // Update User Profile
  const handleUpdateProfile = (updates: Partial<UserProfile>) => run(() => api.profile({ ...currentUser, ...updates }), '个人档案已保存');

  // Send Praise
  const handleSendPraise = (toUserId: string, type: 'gm' | 'player') => currentUser
    ? run(() => api.praise(toUserId, type), '点赞成功') : setIsLoginOpen(true);

  // Extract all distinct rules for filtering
  const availableRules = useMemo(() => {
    const ruleSet = new Set<string>(rules);
    campaigns.forEach((c) => {
      if (c.rule) ruleSet.add(c.rule.trim());
    });
    return Array.from(ruleSet);
  }, [campaigns, rules]);

  // Filter campaigns
  const filteredCampaigns = useMemo(() => {
    return campaigns.filter((c) => {
      const matchQuery =
        !searchQuery.trim() ||
        c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.gmName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.rule.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.summary.toLowerCase().includes(searchQuery.toLowerCase());

      const matchStatus = statusFilter === 'all' || c.status === statusFilter;
      const matchRule = ruleFilter === 'all' || c.rule === ruleFilter;

      return matchQuery && matchStatus && matchRule;
    });
  }, [campaigns, searchQuery, statusFilter, ruleFilter]);

  // Derived user campaign records
  const myCampaigns = useMemo(() => {
    if (!currentUser) return [];
    return campaigns.filter((c) => c.gmId === currentUser.id);
  }, [campaigns, currentUser]);

  const myParticipations = useMemo(() => {
    if (!currentUser) return [];
    return participations.filter((p) => p.userId === currentUser.id);
  }, [participations, currentUser]);

  return (
    <div className="min-h-screen bg-[#F6F5F0] text-[#121212] flex flex-col font-sans">
      {/* Top Navigation */}
      <Navbar
        currentUser={currentUser}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onOpenPublish={() => currentUser ? setIsPublishOpen(true) : setIsLoginOpen(true)}
        onDailyCheckIn={handleDailyCheckIn}
        onOpenLogin={() => setIsLoginOpen(true)}
        onLogout={() => run(() => api.logout(), '已退出登录').then(() => setActiveTab('board'))}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-[1760px] w-full mx-auto px-4 sm:px-6 py-6">
        {/* VIEW 1: Bulletin Board (查团) */}
        {activeTab === 'board' && (
          <div className="flex flex-col lg:flex-row gap-6 items-start">
            {/* Left Column: 使用说明 */}
            <aside className="w-full lg:w-60 xl:w-64 shrink-0 order-2 lg:order-1 lg:sticky lg:top-20">
              <div className="bauhaus-card p-5 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212]">
                <div className="flex items-center gap-2 border-b-2 border-[#121212] pb-3 mb-4">
                  <span className="w-3.5 h-3.5 bg-[#D62828] inline-block" />
                  <h2 className="text-base font-black text-[#121212] tracking-wider">使用说明</h2>
                </div>

                <div className="space-y-3.5 text-xs text-[#222222]">
                  <div className="p-3 bg-[#FAF9F5] border border-[#121212]">
                    <div className="font-black text-[#121212] flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 bg-[#D62828]" />
                      <span>查团</span>
                    </div>
                    <p className="text-[#555555] leading-relaxed">
                      点击卡片查看简介、时间安排、招募人数及主持人喜好禁忌
                    </p>
                  </div>

                  <div className="p-3 bg-[#FAF9F5] border border-[#121212]">
                    <div className="font-black text-[#121212] flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 bg-[#004E98]" />
                      <span>发布新团</span>
                    </div>
                    <p className="text-[#555555] leading-relaxed">
                      登录后可发布新团，所有访客都能在网页查阅。
                    </p>
                  </div>

                  <div className="p-3 bg-[#FAF9F5] border border-[#121212]">
                    <div className="font-black text-[#121212] flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 bg-[#F4A261]" />
                      <span>团务管理</span>
                    </div>
                    <p className="text-[#555555] leading-relaxed">
                      主持可在管理页切换招募状态、封团、标记完结并为参团玩家生成结算凭证。
                    </p>
                  </div>

                  <div className="p-3 bg-[#FAF9F5] border border-[#121212]">
                    <div className="font-black text-[#121212] flex items-center gap-1.5 mb-1">
                      <span className="w-2 h-2 bg-[#121212]" />
                      <span>凭证与点赞</span>
                    </div>
                    <p className="text-[#555555] leading-relaxed">
                      玩家录入凭证领取「GM点赞」；每日签到领取「玩家点赞」，可用于赞赏他人。
                    </p>
                  </div>
                </div>
              </div>
            </aside>

            {/* Center Column: Dual-Column Card Layout */}
            <section className="flex-1 min-w-0 w-full order-3 lg:order-2">
              {loading ? (
                <div className="bauhaus-card p-12 text-center bg-white">加载中…</div>
              ) : filteredCampaigns.length === 0 ? (
                <div className="bauhaus-card p-12 text-center bg-white border-2 border-[#121212]">
                  <p className="text-base font-bold text-[#222222]">暂无符合条件的战役</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
                  {filteredCampaigns.map((camp) => (
                    <CampaignCard
                      key={camp.id}
                      campaign={camp}
                      onClick={() => setSelectedCampaign(camp)}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Right Column: 筛选检索 */}
            <aside className="w-full lg:w-60 xl:w-64 shrink-0 order-1 lg:order-3 lg:sticky lg:top-20">
              <div className="bauhaus-card p-5 bg-white border-2 border-[#121212] shadow-[4px_4px_0px_#121212] space-y-4">
                <div className="flex items-center justify-between border-b-2 border-[#121212] pb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-3.5 h-3.5 bg-[#004E98] inline-block" />
                    <h2 className="text-base font-black text-[#121212] tracking-wider">筛选检索</h2>
                  </div>
                  <span className="bg-[#121212] text-white text-xs font-bold px-2 py-0.5">
                    共 {filteredCampaigns.length} 个团
                  </span>
                </div>

                {/* Search input */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#121212]">搜索</label>
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
                  <label className="block text-xs font-bold text-[#121212]">规则系统</label>
                  <select
                    value={ruleFilter}
                    onChange={(e) => setRuleFilter(e.target.value)}
                    className="bauhaus-input w-full px-3 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <option value="all">全部规则</option>
                    {availableRules.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Status Filter */}
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-[#121212]">招募状态</label>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="bauhaus-input w-full px-3 py-1.5 text-xs font-bold cursor-pointer"
                  >
                    <option value="all">全部状态</option>
                    <option value="recruiting">招募中</option>
                    <option value="full">已满员</option>
                    <option value="concluded">已完结</option>
                    <option value="closed">已封团</option>
                  </select>
                </div>

                {/* Reset button */}
                {(searchQuery || statusFilter !== 'all' || ruleFilter !== 'all') && (
                  <button
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setRuleFilter('all');
                    }}
                    className="w-full mt-2 bauhaus-btn bg-[#FAF0F0] text-[#D62828] border-[#D62828] py-2 text-xs font-bold hover:bg-[#D62828] hover:text-white transition-colors cursor-pointer"
                  >
                    清空筛选条件
                  </button>
                )}
              </div>
            </aside>
          </div>
        )}

        {/* VIEW 2: Personal Profile */}
        {activeTab === 'profile' && currentUser && (
          <div className="max-w-5xl mx-auto w-full">
            <ProfileView
              currentUser={currentUser}
              myCampaigns={myCampaigns}
              myParticipations={myParticipations}
              onUpdateProfile={handleUpdateProfile}
              onSelectCampaign={(c) => setSelectedCampaign(c)}
              onSendPlayerPraise={(qq) => handleSendPraise(qq, 'player')}
            />
          </div>
        )}
        {activeTab === 'profile' && !currentUser && <div className="bauhaus-card max-w-xl mx-auto p-10 text-center bg-white"><p className="mb-4">登录后查看个人档案</p><button className="bauhaus-btn px-5 py-2 bg-[#004E98] text-white" onClick={() => setIsLoginOpen(true)}>登录</button></div>}

        {/* VIEW 3: Campaign Management */}
        {activeTab === 'manage' && currentUser && (
          <div className="max-w-5xl mx-auto w-full">
            <ManageView
              currentUser={currentUser}
              myCampaigns={myCampaigns}
              rules={rules}
              onToggleStatus={handleToggleStatus}
              onDeleteCampaign={handleDeleteCampaign}
              onGenerateVoucher={handleGenerateVoucher}
              onRedeemVoucher={handleRedeemVoucher}
              onUpdateCampaign={handleUpdateCampaign}
            />
          </div>
        )}
        {activeTab === 'manage' && !currentUser && <div className="bauhaus-card max-w-xl mx-auto p-10 text-center bg-white"><p className="mb-4">登录后管理战役及凭证</p><button className="bauhaus-btn px-5 py-2 bg-[#004E98] text-white" onClick={() => setIsLoginOpen(true)}>登录</button></div>}
      </main>

      {/* Campaign Detail Modal */}
      <CampaignDetailModal
        campaign={selectedCampaign}
        onClose={() => setSelectedCampaign(null)}
        gmUser={users.find((u) => u.id === selectedCampaign?.gmId)}
        currentUser={currentUser}
        onSendPraise={(gmId, type) => handleSendPraise(gmId, type)}
      />

      {/* Publish Modal */}
      <PublishModal
        isOpen={isPublishOpen}
        onClose={() => setIsPublishOpen(false)}
        currentUser={currentUser}
        rules={rules}
        onPublish={handlePublish}
      />
      <LoginModal open={isLoginOpen} onClose={() => setIsLoginOpen(false)} onSuccess={refresh} />

      {/* Toast Notifications */}
      <aside aria-label="系统通知" className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm pointer-events-none">
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

      {/* Footer: Centered "诸告板" */}
      <footer className="mt-16 border-t-4 border-[#121212] bg-[#FFFFFF] py-4 px-4">
        <div className="max-w-7xl mx-auto flex items-center justify-center">
          <span className="font-bold text-sm text-[#121212] tracking-widest">诸告板</span>
        </div>
      </footer>
    </div>
  );
}
export default App;
