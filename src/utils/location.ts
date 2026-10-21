import type { Campaign } from '../types';

// Older offline campaigns stored province and city separately.
export const locationLabel = (campaign: Pick<Campaign, 'province' | 'city'>) =>
  `${campaign.province || ''}${campaign.city || ''}` || '地点待定';
