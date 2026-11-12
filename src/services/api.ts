import type { Campaign, CampaignDetail, UserProfile, UserNameplate, StickerPlazaMember, RuleResource, RuleResourceInput, ChatMessage, ChatConversation } from '../types';
export type { ChatMessage, ChatConversation };

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  // 弱网（如 4G）下 fetch 可能长时间挂起，统一加超时：普通请求 30s，文件上传 90s
  const timeoutMs = options.body instanceof FormData ? 90000 : 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`/api/${path}`, { credentials: 'same-origin', signal: controller.signal, ...options });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试');
    return data as T;
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw new Error('网络响应超时，请检查网络后重试');
    throw e;
  } finally {
    clearTimeout(timer);
  }
}
const post = <T>(path: string, value?: unknown) => request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value ?? {}) });
const patch = <T>(path: string, value: unknown) => request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

export const api = {
  me: () => request<{ user: UserProfile | null }>('auth/me'),
  campaigns: () => request<{ campaigns: Campaign[]; users: UserProfile[]; rules: string[]; popularCustomTags: string[] }>('campaigns'),
  bootstrap: () => request<{ user: UserProfile; users: UserProfile[]; campaigns: Campaign[]; rules: string[]; popularCustomTags: string[] }>('bootstrap'),
  requestCode: (qq: string) => post<{ ok: boolean }>('auth/request-code', { qq }),
  verify: (qq: string, code: string) => post<{ user: UserProfile }>('auth/verify', { qq, code }),
  logout: () => post('auth/logout'),
  profile: (value: Partial<UserProfile>) => patch<{ user: UserProfile }>('profile', value),
  updateNameplate: (nameplate: UserNameplate | null) => patch<{ user: UserProfile }>('profile/nameplate', { nameplate }),
  updateStickers: (stickers: string[]) => patch<{ user: UserProfile }>('profile/stickers', { stickers }),
  updateStickerLibrary: (stickers: string[]) => patch<{ user: UserProfile }>('profile/sticker-library', { stickers }),
  setStickerLibraryPublic: (value: boolean) => patch<{ user: UserProfile }>('profile/sticker-library-public', { public: value }),
  stickerPlaza: () => request<{ members: StickerPlazaMember[]; canModerate: boolean; blocked: string[] }>('sticker-plaza'),
  stickerPlazaCopy: (key: string, replaceKey?: string) => post<{ ok: boolean; already?: boolean; note?: string; user: UserProfile }>('sticker-plaza/copy', { key, replaceKey }),
  stickerPlazaBlock: (key: string) => post<{ ok: boolean }>('sticker-plaza/block', { key }),
  stickerPlazaUnblock: (key: string) => request<{ ok: boolean }>(`sticker-plaza/block/${encodeURIComponent(key)}`, { method: 'DELETE' }),
  resources: (q = '', category = '') => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (category) params.set('cat', category);
    const suffix = params.toString();
    return request<{ items: RuleResource[] }>(`resources${suffix ? `?${suffix}` : ''}`);
  },
  myResources: () => request<{ items: RuleResource[] }>('resources/mine'),
  createResource: (value: RuleResourceInput) => post<{ item: RuleResource }>('resources', value),
  updateResource: (id: string, value: RuleResourceInput) => patch<{ item: RuleResource }>(`resources/${encodeURIComponent(id)}`, value),
  deleteResource: (id: string) => request<{ ok: boolean }>(`resources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  checkin: () => post<{ ok: boolean; streak: number; checkinCount: number; memberCheckinCount: number; isMember: boolean; daysUntilGmReward: number; gmHeartsAwarded: number; gmAwarded: boolean }>('checkin'),
  praise: (campaignId: string, toUserId: string, type: 'gm' | 'player') => post('praise', { campaignId, toUserId, type }),
  campaign: (id: string) => request<{ campaign: CampaignDetail }>(`campaigns/${id}`),
  signup: (id: string) => post(`campaigns/${id}/signup`),
  cancelSignup: (id: string) => request(`campaigns/${id}/signup`, { method: 'DELETE' }),
  removeMember: (id: string, qq: string) => request(`campaigns/${id}/members/${encodeURIComponent(qq)}`, { method: 'DELETE' }),
  createCampaign: (value: unknown) => post<{ id: string }>('campaigns', value),
  addBatchSlot: (batchId: string, timeSchedule: string) => post<{ id: string }>(`batches/${batchId}/slots`, { timeSchedule }),
  updateCampaign: (id: string, value: unknown) => patch(`campaigns/${id}`, value),
  setCampaignClosed: (id: string, closed: boolean) => patch(`campaigns/${id}/status`, { closed }),
  endPromo: (id: string) => post<{ ok: boolean; alreadyEnded?: boolean }>(`campaigns/${id}/end-promo`),
  finishCampaign: (id: string) => post(`campaigns/${id}/finish`),
  deleteCampaign: (id: string) => request(`campaigns/${id}`, { method: 'DELETE' }),
  uploadAvatar: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return request<{ avatar: string }>('profile/avatar', { method: 'POST', body: form });
  },
  upload: async (file: File, saveToLibrary = false, extra: { purpose?: 'sticker'; replaceKey?: string } = {}) => {
    const form = new FormData(); form.append('file', file);
    if (saveToLibrary) form.append('saveToLibrary', '1');
    if (extra.purpose) form.append('purpose', extra.purpose);
    if (extra.replaceKey) form.append('replaceKey', extra.replaceKey);
    return request<{ imageKey: string; imageUrl: string; savedToLibrary?: boolean; libraryNote?: string; user?: UserProfile | null }>('upload', { method: 'POST', body: form });
  },
  tickets: (offset = 0) => request<{ submissions: UserTicket[]; total: number }>(`submissions?offset=${offset}`),
  submitFeedback: async (type: 'feedback' | 'report', content: string, images: File[], reportedUser = '') => {
    const form = new FormData();
    form.append('type', type);
    form.append('content', content);
    if (type === 'report') form.append('reportedUser', reportedUser);
    images.forEach((file) => form.append('images', file));
    return request<{ id: string }>('submissions', { method: 'POST', body: form });
  },
  // 猪猪客服：玩家侧会话
  chatThread: () => request<{ messages: ChatMessage[] }>('chat/thread'),
  sendChat: (content: string) => post<{ ok: boolean; message: ChatMessage }>('chat/send', { content }),
  clearChat: () => request('chat/thread', { method: 'DELETE' }),
};

export interface AdminUser {
  isAdmin: boolean;
  isOwner: boolean;
  role: 'owner' | 'admin' | null;
  membershipPermanent: boolean;
  qq: string;
  name: string;
  created_at: string;
  gm_hearts: number;
  player_hearts: number;
  received_gm: number;
  received_player: number;
  sent_count: number;
  received_count: number;
  report_count: number;
  hosted_count: number;
  joined_count: number;
  blacklisted: number;
  blacklist_expires_at: number | null;
  blacklist_banned_at: string | null;
  membership_expires_at: number | null;
}

export interface MembershipGrant {
  id: string;
  months: number;
  days: number;
  granted_by: string;
  expires_at: number;
  created_at: string;
}

export interface AdminDashboard {
  users: { total: number; today: number; last7: number; last30: number };
  // 全部团次 = online_total + offline_total；宣群与报名/满员率完全分开统计。
  campaigns: {
    total: number; online_total: number; offline_total: number;
    recruiting: number; online_recruiting: number; offline_recruiting: number;
    closed: number; online_closed: number; offline_closed: number;
    finished: number; deleted: number; abandoned: number;
    promo_live: number; promo_history: number; promo_total: number;
    members: number; avg_fill_rate: number;
  };
  resourceReviews: { pending: number };
  engagement: { memberships: number; praises: number; gm_praises: number; player_praises: number; active_sessions: number; online_now: number };
  submissions: { total: number; feedback: number; reports: number; pending: number; processing: number; resolved: number; rejected: number };
  campaignKinds: Array<{ kind: 'online' | 'offline' | 'promo'; total: number; alive: number; active: number; closed: number; finished: number }>;
  topRules: Array<{ rule: string; total: number }>;
  dailyUsers: Array<{ day: string; count: number }>;
  dailyCampaigns: Array<{ day: string; count: number }>;
  onlineWindow: number;
  generatedAt: string;
}

export type UserTicket = Pick<AdminSubmission, 'id' | 'type' | 'content' | 'status' | 'created_at' | 'updated_at' | 'images' | 'reported_name' | 'reported_qq'>;

/** 后台「封存团务」：已封车 / 已结团的团，含主持人、报名名单与完整内容供管理核查。 */
export interface AdminArchivedCampaign {
  id: string;
  title: string;
  rule: string;
  kind: 'online' | 'offline';
  gmQq: string;
  gmName: string;
  timeSchedule: string;
  scheduledDate: string;
  timePeriod: string;
  maxPlayers: number;
  memberCount: number;
  summary: string;
  description: string;
  contact: string;
  sessionType: string;
  platforms: string[];
  province: string;
  city: string;
  address: string;
  imageUrl: string;
  status: 'closed' | 'finished';
  abandoned: boolean;
  kept: boolean;
  closedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
  members: Array<{ qq: string; name: string }>;
}

/** 后台「资源审核」：比公开列表多上传者 QQ 与审核人信息。 */
export interface AdminResource extends RuleResource {
  uploaderQq: string;
  createdAtFull: string;
  updatedAtFull: string;
  reviewedAt: string | null;
  reviewedBy: string | null;
}
export interface AdminResourceCounts { pending: number; approved: number; rejected: number }

export interface AdminSubmission {
  id: string;
  user_qq: string;
  user_name: string;
  reported_qq: string | null;
  reported_name: string | null;
  type: 'feedback' | 'report';
  content: string;
  status: 'pending' | 'processing' | 'resolved' | 'rejected';
  admin_note: string;
  created_at: string;
  updated_at: string;
  resolved_at?: string | null;
  images: string[];
}

export const adminApi = {
  me: () => request<{ authenticated: boolean; role: 'owner' | 'admin' | null; name: string }>('admin/me'),
  logout: () => post('admin/logout'),
  dashboard: () => request<AdminDashboard>('admin/dashboard'),
  rules: () => request<{ rules: string[] }>('admin/rules'),
  addRule: (name: string) => post('admin/rules', { name }),
  deleteRule: (name: string) => request('admin/rules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  users: (search: string, offset: number) => request<{ users: AdminUser[]; total: number; memberTotal: number }>(`admin/users?search=${encodeURIComponent(search)}&offset=${offset}`),
  grantMembership: (qq: string, months: number) => post<{ ok: boolean; months: number; days: number; membershipExpiresAt: number }>(`admin/users/${encodeURIComponent(qq)}/membership`, { months }),
  grants: (qq: string, offset: number) => request<{ records: MembershipGrant[]; total: number }>(`admin/users/${encodeURIComponent(qq)}/grants?offset=${offset}`),
  setRole: (qq: string, role: 'admin' | '') => patch<{ ok: boolean; role: 'admin' | null }>(`admin/users/${encodeURIComponent(qq)}/role`, { role }),
  blacklist: (qq: string, duration: '7d' | '30d' | '6m' | '1y' | 'permanent') => post<{ ok: boolean }>(`admin/users/${encodeURIComponent(qq)}/blacklist`, { duration }),
  unblacklist: (qq: string) => request<{ ok: boolean }>(`admin/users/${encodeURIComponent(qq)}/blacklist`, { method: 'DELETE' }),
  submissions: (type: 'feedback' | 'report', status: string, offset: number) => request<{ submissions: AdminSubmission[]; total: number }>(`admin/submissions?type=${type}&status=${encodeURIComponent(status)}&offset=${offset}`),
  updateSubmission: (id: string, status: AdminSubmission['status'], adminNote: string) => patch(`admin/submissions/${id}`, { status, adminNote }),
  archivedCampaigns: (status: 'all' | 'closed' | 'finished' | 'abandoned', offset: number) => request<{ items: AdminArchivedCampaign[]; total: number }>(`admin/archived-campaigns?status=${status}&offset=${offset}`),
  keepAbandoned: (id: string) => post<{ ok: boolean }>(`campaigns/${encodeURIComponent(id)}/keep`),
  deleteAbandoned: (id: string) => request<{ ok: boolean }>(`campaigns/${encodeURIComponent(id)}/abandoned`, { method: 'DELETE' }),
  resources: (status: 'pending' | 'approved' | 'rejected' | 'all', offset: number) => request<{ items: AdminResource[]; total: number; counts: AdminResourceCounts }>(`admin/resources?status=${status}&offset=${offset}`),
  reviewResource: (id: string, status: 'pending' | 'approved' | 'rejected', note = '') => patch<{ ok: boolean }>(`admin/resources/${encodeURIComponent(id)}`, { status, note }),
  deleteResource: (id: string) => request<{ ok: boolean }>(`admin/resources/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  // 猪猪客服：后台会话管理
  chatConversations: () => request<{ conversations: ChatConversation[] }>('admin/chat'),
  chatThreadFor: (qq: string) => request<{ messages: ChatMessage[] }>(`admin/chat/${encodeURIComponent(qq)}`),
  chatReply: (qq: string, content: string) => post<{ ok: boolean }>(`admin/chat/${encodeURIComponent(qq)}/reply`, { content }),
  clearChatFor: (qq: string) => request<{ ok: boolean }>(`admin/chat/${encodeURIComponent(qq)}`, { method: 'DELETE' }),
};
