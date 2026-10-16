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
  campaigns: () => request<{ campaigns: Campaign[]; users: UserProfile[]; rules: string[] }>('campaigns'),
  bootstrap: () => request<{ user: UserProfile; users: UserProfile[]; campaigns: Campaign[]; rules: string[] }>('bootstrap'),
  requestCode: (qq: string) => post<{ ok: boolean }>('auth/request-code', { qq }),
  verify: (qq: string, code: string) => post<{ user: UserProfile }>('auth/verify', { qq, code }),
  logout: () => post('auth/logout'),
  profile: (value: Partial<UserProfile>) => patch('profile', value),
  checkin: () => post('checkin'),
  praise: (campaignId: string, toUserId: string, type: 'gm' | 'player') => post('praise', { campaignId, toUserId, type }),
  campaign: (id: string) => request<{ campaign: CampaignDetail }>(`campaigns/${id}`),
  signup: (id: string) => post(`campaigns/${id}/signup`),
  cancelSignup: (id: string) => request(`campaigns/${id}/signup`, { method: 'DELETE' }),
  removeMember: (id: string, qq: string) => request(`campaigns/${id}/members/${encodeURIComponent(qq)}`, { method: 'DELETE' }),
  createCampaign: (value: unknown) => post<{ id: string }>('campaigns', value),
  updateCampaign: (id: string, value: unknown) => patch(`campaigns/${id}`, value),
  deleteCampaign: (id: string) => request(`campaigns/${id}`, { method: 'DELETE' }),
  uploadAvatar: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return request<{ avatar: string }>('profile/avatar', { method: 'POST', body: form });
  },
  upload: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return request<{ imageKey: string; imageUrl: string }>('upload', { method: 'POST', body: form });
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

export const adminApi = {
  me: () => request<{ authenticated: boolean }>('admin/me'),
  login: (password: string) => post<{ ok: boolean }>('admin/login', { password }),
  logout: () => post('admin/logout'),
  rules: () => request<{ rules: string[] }>('admin/rules'),
  addRule: (name: string) => post('admin/rules', { name }),
  deleteRule: (name: string) => request('admin/rules', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) }),
  users: (search: string, offset: number) => request<{ users: AdminUser[]; total: number }>(`admin/users?search=${encodeURIComponent(search)}&offset=${offset}`),
  gifts: (qq: string, offset: number) => request<{ records: GiftRecord[]; total: number }>(`admin/users/${encodeURIComponent(qq)}/gifts?offset=${offset}`),
};
