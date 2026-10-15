import type { Campaign, ParticipationRecord, UserProfile } from '../types';

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
  campaigns: () => request<{ campaigns: Campaign[]; users: UserProfile[] }>('campaigns'),
  bootstrap: () => request<{ user: UserProfile; users: UserProfile[]; campaigns: Campaign[]; participations: ParticipationRecord[] }>('bootstrap'),
  requestCode: (qq: string) => post<{ ok: boolean }>('auth/request-code', { qq }),
  verify: (qq: string, code: string) => post<{ user: UserProfile }>('auth/verify', { qq, code }),
  logout: () => post('auth/logout'),
  profile: (value: Partial<UserProfile>) => patch('profile', value),
  checkin: () => post('checkin'),
  praise: (toUserId: string, type: 'gm' | 'player') => post('praise', { toUserId, type }),
  createCampaign: (value: unknown) => post<{ id: string }>('campaigns', value),
  updateCampaign: (id: string, value: unknown) => patch(`campaigns/${id}`, value),
  deleteCampaign: (id: string) => request(`campaigns/${id}`, { method: 'DELETE' }),
  status: (id: string, status: string) => post(`campaigns/${id}/status`, { status }),
  voucher: (id: string) => post<{ voucherCode: string; voucherLimit: number }>(`campaigns/${id}/voucher`),
  redeem: (code: string) => post('redeem', { code }),
  upload: async (file: File) => {
    const form = new FormData(); form.append('file', file);
    return request<{ imageKey: string; imageUrl: string }>('upload', { method: 'POST', body: form });
  },
};
