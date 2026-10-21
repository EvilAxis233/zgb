import type { Campaign, CampaignDetail, UserProfile } from '../types';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`/api/${path}`, { credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || '请求失败，请稍后重试');
  return data as T;
}
const post = <T>(path: string, value?: unknown) => request<T>(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value ?? {}) });
const patch = <T>(path: string, value: unknown) => request<T>(path, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) });

export const api = {
  me: () => request<{ user: UserProfile | null }>('auth/me'),
  campaigns: () => request<{ campaigns: Campaign[]; users: UserProfile[]; rules: string[]; presetTags: string[]; popularCustomTags: string[] }>('campaigns'),
  bootstrap: () => request<{ user: UserProfile; users: UserProfile[]; campaigns: Campaign[]; rules: string[]; presetTags: string[]; popularCustomTags: string[] }>('bootstrap'),
  requestCode: (qq: string) => post<{ ok: boolean }>('auth/request-code', { qq }),
  verify: (qq: string, code: string) => post<{ user: UserProfile }>('auth/verify', { qq, code }),
  logout: () => post('auth/logout'),
  profile: (value: Partial<UserProfile>) => patch<{ user: UserProfile }>('profile', value),
  checkin: () => post('checkin'),
  praise: (campaignId: string, toUserId: string, type: 'gm' | 'player') => post('praise', { campaignId, toUserId, type }),
  campaign: (id: string) => request<{ campaign: CampaignDetail }>(`campaigns/${id}`),
  signup: (id: string) => post(`campaigns/${id}/signup`),
  cancelSignup: (id: string) => request(`campaigns/${id}/signup`, { method: 'DELETE' }),
  removeMember: (id: string, qq: string) => request(`campaigns/${id}/members/${encodeURIComponent(qq)}`, { method: 'DELETE' }),
  createCampaign: (value: unknown) => post<{ id: string }>('campaigns', value),
  addBatchSlot: (batchId: string, timeSchedule: string) => post<{ id: string }>(`batches/${batchId}/slots`, { timeSchedule }),
  updateCampaign: (id: string, value: unknown) => patch(`campaigns/${id}`, value),
  setCampaignClosed: (id: string, closed: boolean) => patch(`campaigns/${id}/status`, { closed }),
  finishCampaign: (id: string) => post(`campaigns/${id}/finish`),
  deleteCampaign: (id: string) => request(`campaigns/${id}`, { method: 'DELETE' }),
  uploadAvatar: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return request<{ avatar: string }>('profile/avatar', { method: 'POST', body: form });
  },
  upload: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return request<{ imageKey: string; imageUrl: string }>('upload', { method: 'POST', body: form });
  },
  submitFeedback: async (type: 'feedback' | 'report', content: string, images: File[]) => {
    const form = new FormData();
    form.append('type', type);
    form.append('content', content);
    images.forEach((file) => form.append('images', file));
    return request<{ id: string }>('submissions', { method: 'POST', body: form });
  },
};

export interface AdminUser {
  qq: string;
  name: string;
  created_at: string;
  gm_hearts: number;
  player_hearts: number;
  received_gm: number;
  received_player: number;
  sent_count: number;
  received_count: number;
}

export interface GiftRecord {
  id: string;
  from_qq: string;
  to_qq: string;
  from_name: string;
  to_name: string;
  type: 'gm' | 'player';
  created_at: string;
}

export interface AdminDashboard {
  users: { total: number; today: number; last7: number; last30: number };
  campaigns: { total: number; recruiting: number; finished: number; closed: number; deleted: number; members: number; avg_fill_rate: number };
  engagement: { memberships: number; praises: number; gm_praises: number; player_praises: number; active_sessions: number };
  submissions: { total: number; feedback: number; reports: number; pending: number; processing: number; resolved: number; rejected: number };
  campaignKinds: Array<{ kind: 'online' | 'offline' | 'promo'; total: number; active: number; finished: number }>;
  topRules: Array<{ rule: string; total: number }>;
  dailyUsers: Array<{ day: string; count: number }>;
  dailyCampaigns: Array<{ day: string; count: number }>;
  generatedAt: string;
}

export interface AdminSubmission {
  id: string;
  user_qq: string;
  user_name: string;
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
  me: () => request<{ authenticated: boolean }>('admin/me'),
  login: (password: string) => post<{ ok: boolean }>('admin/login', { password }),
  logout: () => post('admin/logout'),
  dashboard: () => request<AdminDashboard>('admin/dashboard'),
  rules: () => request<{ rules: string[] }>('admin/rules'),
  addRule: (name: string) => post('admin/rules', { name }),
  deleteRule: (name: string) => request('admin/rules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  presetTags: () => request<{ presetTags: string[] }>('admin/preset-tags'),
  addPresetTag: (name: string) => post('admin/preset-tags', { name }),
  deletePresetTag: (name: string) => request('admin/preset-tags', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  users: (search: string, offset: number) => request<{ users: AdminUser[]; total: number }>(`admin/users?search=${encodeURIComponent(search)}&offset=${offset}`),
  gifts: (qq: string, offset: number) => request<{ records: GiftRecord[]; total: number }>(`admin/users/${encodeURIComponent(qq)}/gifts?offset=${offset}`),
  submissions: (type: 'feedback' | 'report', status: string, offset: number) => request<{ submissions: AdminSubmission[]; total: number }>(`admin/submissions?type=${type}&status=${encodeURIComponent(status)}&offset=${offset}`),
  updateSubmission: (id: string, status: AdminSubmission['status'], adminNote: string) => patch(`admin/submissions/${id}`, { status, adminNote }),
};
