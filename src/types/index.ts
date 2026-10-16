export interface UserProfile {
  id: string;
  qq: string;
  name: string;
  avatar?: string;
  bio: string;
  preferences: string[]; // 喜好
  taboos: string[];     // 禁忌
  receivedGmPraises: number;     // 收到GM赞 (来自参团者)
  receivedPlayerPraises: number; // 收到玩家赞 (来自日常伙伴)
  inventory: {
    gmHearts: number;     // GM点赞道具 (参团完结获得)
    playerHearts: number; // 玩家点赞道具 (每日签到获得)
  };
  lastCheckInDate?: string; // 签到日期 YYYY-MM-DD
}

export type SessionType = '语音' | '文字' | '其他游戏形式';
export const GAME_PLATFORMS = ['Kook', 'Oopz', '枭熊', 'Fvtt', '菠萝', 'excalidraw', '其它'] as const;
export type GamePlatform = typeof GAME_PLATFORMS[number];

export interface Campaign {
  id: string;
  batchId?: string | null;
  batchMaster?: CampaignBatchMaster;
  slots?: CampaignSlot[];
  timeSlots?: string[];
  title: string;
  rule: string;
  sessionType?: SessionType;
  platforms?: GamePlatform[];
  presetTags?: string[];
  customTags?: string[];
  gmId: string;
  gmName: string;
  gmQq?: string;
  gmPraises?: number;
  contact?: string;
  summary?: string;
  description: string;
  timeSchedule: string;
  imageUrl?: string;
  bannerColor?: string; // For Bauhaus geometric identity
  maxPlayers: number;
  currentPlayers: number;
  isFull: boolean;
  isClosed?: boolean;
  hasEnded: boolean;
  isSignedUp: boolean;
  createdAt: string;
  imageKey?: string | null;
}

export interface CampaignBatchMaster {
  id: string;
  title: string;
  rule: string;
  sessionType: SessionType;
  platforms: GamePlatform[];
  presetTags: string[];
  customTags: string[];
  maxPlayers: number;
  contact: string;
  description: string;
  imageUrl?: string;
  bannerColor: string;
}

export interface CampaignSlot {
  id: string;
  timeSchedule: string;
  currentPlayers: number;
  maxPlayers: number;
  isFull: boolean;
  isClosed?: boolean;
  hasEnded: boolean;
  isSignedUp: boolean;
}

export interface CampaignMember {
  id: string;
  name: string;
  avatar?: string;
  role: 'gm' | 'player';
  receivedPraises: number;
  bio?: string;
  preferences?: string[];
  taboos?: string[];
}

export interface CampaignDetail extends Campaign { members: CampaignMember[]; }

export interface PraiseRecord {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId: string;
  toUserName: string;
  type: 'gm' | 'player';
  campaignId?: string;
  note?: string;
  createdAt: string;
}
