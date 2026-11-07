export interface UserNameplate {
  styleId: string;
  text: string;
}

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
    gmHearts: number;     // GM点赞道具（普通用户连续七天；会员累计七次）
    playerHearts: number; // 玩家点赞道具 (每日签到获得)
  };
  lastCheckInDate?: string; // 签到日期 YYYY-MM-DD
  isAdmin?: boolean;
  isOwner?: boolean;
  role?: 'owner' | 'admin' | null;
  membershipPermanent?: boolean;
  membershipExpiresAt: number | null; // Unix seconds
  nameplate?: UserNameplate | null;
  stickers?: string[]; // 会员贴纸（最多 2 张图片地址）
  stickerKeys?: string[]; // 贴纸在存储中的 key，用于编辑时回填
}

export type SessionType = '语音' | '文字' | '其他游戏形式';
export type CampaignKind = 'online' | 'offline' | 'promo';
export const GAME_PLATFORMS = ['QQ', 'Kook', 'Oopz', '枭熊', 'Fvtt', '菠萝', 'excalidraw', '其它'] as const;
export type GamePlatform = typeof GAME_PLATFORMS[number];

export interface Campaign {
  id: string;
  kind: CampaignKind;
  province?: string;
  city?: string;
  address?: string;
  batchId?: string | null;
  batchMaster?: CampaignBatchMaster;
  slots?: CampaignSlot[];
  timeSlots?: string[];
  title: string;
  rule: string;
  sessionType?: string;
  platforms?: string[];
  presetTags?: string[];
  customTags?: string[];
  gmId: string;
  gmName: string;
  gmAvatar?: string;
  gmQq?: string;
  gmPraises?: number;
  gmNameplate?: UserNameplate | null;
  gmStickers?: string[];
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
  hasExpired: boolean;
  isSignedUp: boolean;
  createdAt: string;
  imageKey?: string | null;
}

export interface CampaignBatchMaster {
  id: string;
  kind: CampaignKind;
  province?: string;
  city?: string;
  address?: string;
  title: string;
  rule: string;
  sessionType: string;
  platforms: string[];
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
  hasExpired: boolean;
  isSignedUp: boolean;
}

export interface CampaignMember {
  id: string;
  name: string;
  avatar?: string;
  role: 'gm' | 'player';
  receivedPraises: number;
  nameplate?: UserNameplate | null;
  stickers?: string[];
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
