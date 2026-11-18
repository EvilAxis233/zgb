import type { Campaign } from '../types';

type CampaignDate = Pick<Campaign, 'finishedAt' | 'createdAt'>;

// 履历按结团年份归档；未结团的老数据退回创建年份。
export const campaignYear = (campaign: CampaignDate): number => {
  const year = Number((campaign.finishedAt || campaign.createdAt || '').slice(0, 4));
  return Number.isInteger(year) && year >= 2000 ? year : new Date().getFullYear();
};

// 年份筛选清单：只从今年（当前为 2026）开始逐年往前，直到最早一条团记录，不含未来年份。
export const campaignYears = (campaigns: CampaignDate[]): number[] => {
  const current = new Date().getFullYear();
  const oldest = campaigns.reduce((min, campaign) => Math.min(min, campaignYear(campaign)), current);
  const years: number[] = [];
  for (let year = current; year >= Math.min(oldest, current); year--) years.push(year);
  return years;
};
