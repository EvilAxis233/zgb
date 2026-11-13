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
  stickers?: string[]; // 会员默认佩戴的贴纸（最多 2 张图片地址）
  stickerKeys?: string[]; // 贴纸在存储中的 key，用于编辑时回填
  stickerLibrary?: string[]; // 贴纸库（最多 10 张图片地址）
  stickerLibraryKeys?: string[]; // 贴纸库的存储 key
  stickerLibraryPublic?: boolean; // 是否把贴纸库存公开到贴纸广场（默认公开）
  notifyEmail?: string; // 报名通知收件邮箱，留空表示用登录的 QQ 邮箱
  signupNotifyEnabled?: boolean; // 是否接收玩家报名 / 取消报名邮件
}

export interface StickerPlazaSticker {
  key: string;   // 图片在 R2 里的 key
  copies: number; // 被其他会员加入库存的次数
}
export interface StickerPlazaMember {
  id: string;    // 匿名的会员分组标识，不含任何 QQ 信息
  name: string;
  avatar: string;
  createdAt: string;
  count: number;
  stickers: StickerPlazaSticker[];
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
  gmIsMember?: boolean; // GM 是否为会员（会员头像显示动态鎏金环）
  stickerKeys?: string[]; // 发布时本团临时选用的贴纸 key（不改默认佩戴）
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
  // 站主全量编辑：批量团各时段可单独改期（只在提交编辑时携带）。
  slotTimes?: Array<{ id: string; timeSchedule: string }>;
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
  qq?: string; // 报名玩家的 QQ 号，仅该团 GM 与站主/管理员在成员名单里可见
  name: string;
  avatar?: string;
  role: 'gm' | 'player';
  receivedPraises: number;
  nameplate?: UserNameplate | null;
  stickers?: string[];
  isMember?: boolean;
  bio?: string;
  preferences?: string[];
  taboos?: string[];
}

export interface CampaignDetail extends Campaign { members: CampaignMember[]; }

// 爱心资源：玩家分享的规则下载地址 / 在线查询地址。
export type ResourceCategory = 'rulebook' | 'module' | 'tool' | 'fun';
export type ResourceReviewStatus = 'pending' | 'approved' | 'rejected';
export interface RuleResource {
  id: string;
  name: string;
  url: string;
  type: 'pan' | 'wiki' | 'other';
  category: ResourceCategory;
  note: string;
  flags: string[];
  uploaderName: string;
  uploaderAvatar?: string;
  // 新分享 / 改过链接的分享为 pending，管理员通过后才会出现在爱心资源页。
  reviewStatus: ResourceReviewStatus;
  reviewNote: string;
  createdAt: string;
  updatedAt: string;
  mine: boolean;
  canManage: boolean;
  // 爱心资源点赞：卡片左上角显示数量，当前登录用户是否已点过。
  likesCount: number;
  likedByMe: boolean;
}

export interface RuleResourceInput {
  name: string;
  url: string;
  type: RuleResource['type'];
  category: ResourceCategory;
  note: string;
  flags: string[];
}

// 猪猪客服：玩家与站务的私信对话
export type ChatFromRole = 'user' | 'admin';
export interface ChatMessage {
  id: string;
  fromRole: ChatFromRole;
  content: string;
  createdAt: string;
}
export interface ChatConversation {
  userQq: string;
  userName: string;
  lastContent: string;
  lastAt: string;
  unread: number;
}

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
