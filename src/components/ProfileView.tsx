import React, { useState } from 'react';
import { UserProfile, Campaign, UserNameplate } from '../types';
import { Flame, Star, Edit3, Check, Upload, Crown, Tag, Sparkles, Mail, Heart } from 'lucide-react';
import { ImageCropper } from './ImageCropper';
import { useDialog } from './BauhausDialog';
import { AccountSideActions } from './AccountSideActions';
import { MembershipModal } from './MembershipModal';
import { NameplateModal } from './NameplateModal';
import { NameplateBadge } from './NameplateBadge';
import { StickerLibrary } from './StickerLibrary';
import { StickerPlaza } from './StickerPlaza';
import { api } from '../services/api';
import { formatDisplayTime } from '../utils/date';
import { MyResourcesModal } from './ResourceView';
import { acceptedImage, isAnimatedImage, normalizeImageFile, MAX_ANIMATED_BYTES, MAX_STATIC_BYTES } from '../utils/animatedImage';

interface ProfileViewProps {
  currentUser: UserProfile;
  myCampaigns: Campaign[];
  myJoinedCampaigns: Campaign[];
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  onUpdateNameplate: (nameplate: UserNameplate | null) => Promise<boolean>;
  onUpdateStickers: (keys: string[]) => Promise<boolean>;
  onUpdateStickerLibrary: (keys: string[]) => Promise<boolean>;
  onUserUpdate: (user: UserProfile) => void;
  onSelectCampaign: (campaign: Campaign) => void;
  onUploadAvatar: (file: File) => void;
  onOpenManage: () => void;
  onOpenResources?: () => void;
  onFeedback: () => void;
  onReport: () => void;
}

const nicknameLength = (value: string) => Array.from(value).reduce(
  (total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2),
  0,
);

// 喜好 / 雷区：各最多 6 个，每个最多 6 个中文字（中文及全角按 2、英文数字按 1，上限 12）。
const TRAIT_LIMIT = 6;
const TRAIT_WIDTH = 12;
const limitTrait = (value: string) => {
  let out = '', width = 0;
  for (const character of Array.from(value)) {
    const size = /^[\x00-\x7F]$/.test(character) ? 1 : 2;
    if (width + size > TRAIT_WIDTH) break;
    out += character;
    width += size;
  }
  return out;
};
const normalizeTraits = (list?: string[]) =>
  [...new Set((list || []).map((tag) => limitTrait(String(tag).trim())).filter(Boolean))].slice(0, TRAIT_LIMIT);

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  myCampaigns,
  myJoinedCampaigns,
  onUpdateProfile,
  onSelectCampaign,
  onUploadAvatar,
  onOpenManage,
  onOpenResources,
  onFeedback,
  onReport,
  onUpdateNameplate,
  onUpdateStickers,
  onUpdateStickerLibrary,
  onUserUpdate,
}) => {
  const { showAlert } = useDialog();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarToCrop, setAvatarToCrop] = useState<File | null>(null);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [nameplateOpen, setNameplateOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [plazaOpen, setPlazaOpen] = useState(false);
  const [myResourcesOpen, setMyResourcesOpen] = useState(false);
  const [publicBusy, setPublicBusy] = useState(false);
  const [membershipNow, setMembershipNow] = useState(() => Date.now());
  const membershipActive = !!currentUser.membershipExpiresAt && currentUser.membershipExpiresAt * 1000 > membershipNow;
  const stickerMember = membershipActive || !!currentUser.membershipPermanent;

  // 「我的贴纸」标题右侧的打勾：控制自己的贴纸库存是否出现在别人的贴纸广场。
  const toggleLibraryPublic = async (value: boolean) => {
    if (publicBusy) return;
    setPublicBusy(true);
    try {
      const { user } = await api.setStickerLibraryPublic(value);
      onUserUpdate(user);
    } catch (error) {
      showAlert({ title: '设置失败', message: error instanceof Error ? error.message : '请稍后重试', type: 'danger' });
    } finally {
      setPublicBusy(false);
    }
  };
  React.useEffect(() => {
    const timer = window.setInterval(() => setMembershipNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio);
  const [preferences, setPreferences] = useState<string[]>(normalizeTraits(currentUser.preferences));
  const [taboos, setTaboos] = useState<string[]>(normalizeTraits(currentUser.taboos));
  const [newPref, setNewPref] = useState('');
  const [newTaboo, setNewTaboo] = useState('');
  const [notifyEmail, setNotifyEmail] = useState(currentUser.notifyEmail || '');
  const [signupNotifyEnabled, setSignupNotifyEnabled] = useState(currentUser.signupNotifyEnabled !== false);
  const nameLength = nicknameLength(name.trim());
  // 老档案里可能有超出新规则的标签：编辑时先规范化展示，并提示保存后会收敛到新上限。
  const originalTraits = [...(currentUser.preferences || []), ...(currentUser.taboos || [])];
  const traitsOverLimit = (currentUser.preferences || []).length > TRAIT_LIMIT
    || (currentUser.taboos || []).length > TRAIT_LIMIT
    || originalTraits.some((tag) => nicknameLength(String(tag)) > TRAIT_WIDTH || String(tag) !== String(tag).trim());

  React.useEffect(() => {
    setName(currentUser.name);
    setBio(currentUser.bio);
    setPreferences(normalizeTraits(currentUser.preferences));
    setTaboos(normalizeTraits(currentUser.taboos));
    setNotifyEmail(currentUser.notifyEmail || '');
    setSignupNotifyEnabled(currentUser.signupNotifyEnabled !== false);
  }, [currentUser]);

  const handleSave = async () => {
    if (!name.trim()) {
      await showAlert({
        title: '提示',
        message: '昵称不能为空',
        type: 'warning',
      });
      return;
    }
    if (nameLength > 20) {
      await showAlert({
        title: '昵称过长',
        message: '昵称最多 10 个中文字符或 20 个英文字符，中文及全角字符按 2 个计算。',
        type: 'warning',
      });
      return;
    }
    if (notifyEmail.trim() && !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(notifyEmail.trim())) {
      await showAlert({ title: '邮箱格式不正确', message: '请填写完整的邮箱地址，或留空使用登录的 QQ 邮箱。', type: 'warning' });
      return;
    }
    setIsSaving(true);
    try {
      const success = await onUpdateProfile({
        name: name.trim(),
        bio,
        preferences: normalizeTraits(preferences),
        taboos: normalizeTraits(taboos),
        notifyEmail: notifyEmail.trim(),
        signupNotifyEnabled,
      });
      if (success) setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const addPreference = () => {
    const value = limitTrait(newPref.trim());
    if (!value) return;
    if (preferences.length >= TRAIT_LIMIT) {
      void showAlert({ title: '已达上限', message: '喜好最多填写 6 个，请先删除一个再添加。', type: 'warning' });
      return;
    }
    if (preferences.includes(value)) {
      void showAlert({ title: '提示', message: '这个喜好已经添加过了。', type: 'warning' });
      return;
    }
    setPreferences([...preferences, value]);
    setNewPref('');
  };

  const removePreference = (tag: string) => {
    setPreferences(preferences.filter((p) => p !== tag));
  };

  const addTaboo = () => {
    const value = limitTrait(newTaboo.trim());
    if (!value) return;
    if (taboos.length >= TRAIT_LIMIT) {
      void showAlert({ title: '已达上限', message: '雷区最多填写 6 个，请先删除一个再添加。', type: 'warning' });
      return;
    }
    if (taboos.includes(value)) {
      void showAlert({ title: '提示', message: '这个雷区已经添加过了。', type: 'warning' });
      return;
    }
    setTaboos([...taboos, value]);
    setNewTaboo('');
  };

  const removeTaboo = (tag: string) => {
    setTaboos(taboos.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="w-full lg:w-60 xl:w-64 shrink-0 lg:sticky lg:top-20 space-y-3">
        <AccountSideActions
          destination="manage"
          onNavigate={onOpenManage}
          onFeedback={onFeedback}
          onReport={onReport}
          extraActions={
            <button
              type="button"
              onClick={() => setMyResourcesOpen(true)}
              title="查看、更新或删除我分享的规则资源"
              className="bauhaus-btn w-full cursor-pointer gap-2 bg-white px-4 py-3 text-sm font-black hover:bg-[#FAF9F5]"
            >
              <Heart className="h-4 w-4 fill-[#D62828] text-[#D62828]" />
              我的分享
            </button>
          }
        />
        <button type="button" disabled={currentUser.membershipPermanent} onClick={() => setMembershipOpen(true)} className="bauhaus-btn w-full bg-[#FFF4DA] px-4 py-3 text-sm font-black gap-2"><Crown size={17} />{currentUser.membershipPermanent ? '永久会员' : membershipActive ? '续费会员' : '升级会员'}</button>
        <div className="space-y-3">
          {membershipActive && (
            <p className="text-xs font-bold text-[#5C4300]">
              {currentUser.membershipPermanent ? '永久会员 · 长期有效' : `到期：${new Date(currentUser.membershipExpiresAt! * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false })}`}
            </p>
          )}
          {/* 会员权益到期后按钮保留但置灰，已发布的团上的铭牌 / 贴纸不受影响。 */}
          <div className="border-t-2 border-[#121212] pt-3 space-y-2">
            <div className="flex gap-2">
              <button
                type="button"
                disabled={!membershipActive}
                onClick={() => setNameplateOpen(true)}
                className={`bauhaus-btn flex-1 px-3 py-2 text-xs font-black gap-1.5 shadow-[2px_2px_0px_#121212] ${membershipActive ? 'bg-white hover:bg-[#FAF9F5] cursor-pointer' : 'cursor-not-allowed border-[#999] bg-[#EDEDE7] text-[#999] opacity-70'}`}
                title={membershipActive ? '设置我的自定义铭牌' : '会员权益已到期，续费后可继续编辑'}
              >
                <Tag size={14} className={membershipActive ? 'text-[#004E98]' : 'text-[#999]'} />
                铭牌
              </button>
              <button
                type="button"
                disabled={!membershipActive}
                onClick={() => setStickerOpen(true)}
                className={`bauhaus-btn flex-1 px-3 py-2 text-xs font-black gap-1.5 shadow-[2px_2px_0px_#121212] ${membershipActive ? 'bg-white hover:bg-[#FAF9F5] cursor-pointer' : 'cursor-not-allowed border-[#999] bg-[#EDEDE7] text-[#999] opacity-70'}`}
                title={membershipActive ? '管理我的贴纸' : '会员权益已到期，续费后可继续编辑'}
              >
                <Sparkles size={14} className={membershipActive ? 'text-[#D62828]' : 'text-[#999]'} />
                贴纸
              </button>
            </div>
            {currentUser.nameplate && (
              <div className="flex items-center justify-between p-2 bg-[#FAF9F5] border border-[#121212]">
                <span className="text-[11px] font-bold text-[#666]">当前佩戴：</span>
                <NameplateBadge nameplate={currentUser.nameplate} />
              </div>
            )}
            {!membershipActive && <p className="text-[11px] font-bold leading-relaxed text-[#888]">会员权益已到期，铭牌与贴纸暂不可编辑；已发布的团不受影响。</p>}
          </div>
        </div>
      </div>
      <div className="space-y-6 min-w-0 w-full">
      {/* Top Profile Header Card */}
      <div className="bauhaus-card p-6 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#121212] pb-6">
          <div className="flex items-center gap-4">
            {/* Bauhaus Avatar Icon */}
            <label className={`relative w-16 h-16 bg-[#121212] text-white font-black text-2xl flex items-center justify-center cursor-pointer overflow-hidden group ${membershipActive || currentUser.membershipPermanent ? 'gilded-avatar' : 'border-2 border-[#121212] shadow-[4px_4px_0px_#D62828]'}`} title="上传头像">
              <span className="flex h-full w-full items-center justify-center overflow-hidden">
                {currentUser.avatar ? <img src={currentUser.avatar} alt="我的头像" className="h-full w-full object-cover" /> : <span className="relative z-[1]">{(name || currentUser.name || '?').charAt(0)}</span>}
              </span>
              <span className="absolute inset-x-0 bottom-0 z-[3] py-1 bg-black/75 text-[10px] flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><Upload className="w-3 h-3" />更换</span>
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp,.gif,.png,.jpg,.jpeg,.webp" className="sr-only" onChange={async (event) => {
                const file = normalizeImageFile(event.target.files?.[0]);
                event.target.value = '';
                if (!file) return;
                if (!acceptedImage(file)) {
                  showAlert({ title: '图片格式错误', message: '请选择 PNG、JPG、GIF 或 WebP 图片', type: 'warning' });
                  return;
                }
                // 动态头像必须原样上传：一进 canvas 裁剪就只剩第一帧。
                const animated = await isAnimatedImage(file);
                if (file.size > (animated ? MAX_ANIMATED_BYTES : MAX_STATIC_BYTES)) {
                  showAlert({ title: '图片过大', message: animated ? '动态头像不会压缩，请小于 8MB' : '原图请小于 20MB', type: 'warning' });
                } else if (animated) onUploadAvatar(file);
                else setAvatarToCrop(file);
              }} />
            </label>
            <div>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入姓名/昵称"
                    aria-describedby="nickname-length-hint"
                    aria-invalid={nameLength > 20}
                    className={`bauhaus-input px-3 py-1 text-lg font-black max-w-[220px] ${nameLength > 20 ? 'border-[#D62828]' : ''}`}
                    autoFocus
                  />
                  <p id="nickname-length-hint" className={`mt-1 text-[11px] font-bold ${nameLength > 20 ? 'text-[#D62828]' : 'text-[#666]'}`}>
                    {nameLength}/20
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-black text-[#121212]">{currentUser.name}</h1>
                  {currentUser.nameplate && <NameplateBadge nameplate={currentUser.nameplate} />}
                </div>
              )}
            </div>
          </div>

          {/* 点赞框与编辑资料按钮排成不换行的一行，高度与左侧头像一致 */}
          <div className="flex flex-nowrap items-center gap-2 md:gap-3 shrink-0">
            {/* Received GM Praise */}
            <div className="bg-[#FAF0F0] border-2 border-[#D62828] h-16 min-w-[80px] md:min-w-[92px] px-2 md:px-3.5 shadow-[2px_2px_0px_#D62828] flex flex-col items-center justify-center text-center">
              <span className="block text-xs font-bold text-[#666666]">获 GM点赞</span>
              <span className="text-lg font-black text-[#D62828] flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-[#D62828]" />
                {currentUser.receivedGmPraises}
              </span>
            </div>

            {/* Received Player Praise */}
            <div className="bg-[#F0F5FA] border-2 border-[#004E98] h-16 min-w-[80px] md:min-w-[92px] px-2 md:px-3.5 shadow-[2px_2px_0px_#004E98] flex flex-col items-center justify-center text-center">
              <span className="block text-xs font-bold text-[#666666]">获 玩家点赞</span>
              <span className="text-lg font-black text-[#004E98] flex items-center justify-center gap-1">
                <Star className="w-4 h-4 fill-[#004E98]" />
                {currentUser.receivedPlayerPraises}
              </span>
            </div>

            {/* Edit button */}
            <button
              disabled={isSaving}
              onClick={() => {
                if (isEditing) {
                  handleSave();
                } else {
                  setIsEditing(true);
                }
              }}
              className="bauhaus-btn bg-[#121212] text-white h-16 px-3 md:px-4 text-xs font-bold flex items-center justify-center gap-1.5 shrink-0"
            >
              {isEditing ? (
                <>
                  <Check className="w-4 h-4 text-[#F4A261]" />
                  <span>{isSaving ? '保存中…' : '保存档案'}</span>
                </>
              ) : (
                <>
                  <Edit3 className="w-4 h-4" />
                  <span>编辑资料</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Bio & Habits Block */}
        <div className="pt-6 grid grid-cols-1 md:grid-cols-12 gap-6">
          {isEditing && traitsOverLimit && (
            <p className="md:col-span-12 -mb-2 px-2.5 py-1.5 border border-[#C85C16] bg-[#FFF4D6] text-[11px] font-bold leading-snug text-[#7A4B00]">
              原有标签超出新上限，已保留前 6 个并把过长标签裁到 6 个中文字；保存档案后正式生效。
            </p>
          )}
          {/* Bio */}
          <div className="md:col-span-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-xs font-black tracking-wider text-[#121212] flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 bg-[#D62828]" />
                个人简介
              </h3>
              {isEditing && (
                <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 border border-[#121212] ${bio.length >= 100 ? 'bg-[#FFEBEE] text-[#C62828]' : 'bg-[#F0F5FA] text-[#004E98]'}`}>
                  {bio.length}/100
                </span>
              )}
            </div>
            {isEditing ? (
              <textarea
                rows={4}
                maxLength={100}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="bauhaus-input w-full p-2.5 text-xs resize-none"
                placeholder="介绍你的跑团风格、主持理念或经历...（最多 100 字）"
              />
            ) : (
              <p className="text-sm text-[#333333] leading-relaxed bg-[#F6F5F0] p-3 border-l-4 border-[#121212]">
                {currentUser.bio || '尚未填写个人简介'}
              </p>
            )}
          </div>

          {/* Preferences (喜好) */}
          <div className="md:col-span-4">
            <h3 className="text-xs font-black tracking-wider text-[#004E98] mb-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#004E98]" />
              喜好偏好
              <span className="ml-auto text-[10px] font-bold text-[#666]">{preferences.length}/{TRAIT_LIMIT}</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {preferences.map((p) => (
                <span
                  key={p}
                  className="px-2.5 py-1 bg-[#F0F5FA] border border-[#004E98] text-xs font-medium text-[#121212] flex items-center gap-1"
                >
                  {p}
                  {isEditing && (
                    <button
                      onClick={() => removePreference(p)}
                      className="text-[#D62828] hover:font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isEditing && (
              <div className="mt-2">
                <input
                  type="text"
                  value={newPref}
                  onChange={(e) => setNewPref(limitTrait(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPreference())}
                  disabled={preferences.length >= TRAIT_LIMIT}
                  placeholder={preferences.length >= TRAIT_LIMIT ? '已达 6 个上限，删除后可再添加' : '输入后回车添加'}
                  className="bauhaus-input w-full px-2 py-1 text-xs disabled:opacity-60"
                  aria-label="添加喜好"
                />
                <p className="mt-1 text-[10px] text-[#666]">最多 6 个，每个最多 6 个中文字（或 12 个英文字母）</p>
              </div>
            )}
          </div>

          {/* Taboos (禁忌) */}
          <div className="md:col-span-4">
            <h3 className="text-xs font-black tracking-wider text-[#D62828] mb-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#D62828]" />
              雷区禁忌
              <span className="ml-auto text-[10px] font-bold text-[#666]">{taboos.length}/{TRAIT_LIMIT}</span>
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {taboos.map((t) => (
                <span
                  key={t}
                  className="px-2.5 py-1 bg-[#FAF0F0] border border-[#D62828] text-xs font-medium text-[#121212] flex items-center gap-1"
                >
                  {t}
                  {isEditing && (
                    <button
                      onClick={() => removeTaboo(t)}
                      className="text-[#D62828] hover:font-bold cursor-pointer"
                    >
                      ×
                    </button>
                  )}
                </span>
              ))}
            </div>
            {isEditing && (
              <div className="mt-2">
                <input
                  type="text"
                  value={newTaboo}
                  onChange={(e) => setNewTaboo(limitTrait(e.target.value))}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTaboo())}
                  disabled={taboos.length >= TRAIT_LIMIT}
                  placeholder={taboos.length >= TRAIT_LIMIT ? '已达 6 个上限，删除后可再添加' : '输入后回车添加'}
                  className="bauhaus-input w-full px-2 py-1 text-xs disabled:opacity-60"
                  aria-label="添加雷区"
                />
                <p className="mt-1 text-[10px] text-[#666]">最多 6 个，每个最多 6 个中文字（或 12 个英文字母）</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 报名邮件通知设置：默认发到登录用的 QQ 邮箱，可改地址或关闭 */}
      <div className="bauhaus-card p-5 bg-white mt-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1">
          <h3 className="text-xs font-black tracking-wider text-[#004E98] mb-2 flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 bg-[#004E98]" />
            <Mail className="w-3.5 h-3.5" />
            报名邮件通知
          </h3>
          <p className="text-[11px] leading-relaxed text-[#666666]">
            有玩家报名你发布的团时，系统会自动给你的邮箱发一封提醒，包含玩家 QQ、团次信息和当前人数。逐次发送，每有一位玩家报名发一封；取消报名不通知。默认发到登录用的 QQ 邮箱。
          </p>
        </div>
        <div className="md:w-[290px] shrink-0 flex flex-col gap-2">
          {isEditing ? (
            <input
              type="email"
              value={notifyEmail}
              onChange={(e) => setNotifyEmail(e.target.value)}
              placeholder={`留空则用 ${currentUser.qq}@qq.com`}
              className="bauhaus-input w-full px-3 py-2 text-xs"
            />
          ) : (
            <div className="text-xs font-bold text-[#121212] bg-[#F6F5F0] border-l-4 border-[#004E98] px-3 py-2 break-all">
              收件邮箱：{currentUser.notifyEmail || `${currentUser.qq}@qq.com`}
            </div>
          )}
          <label className="flex items-center gap-2 text-[11px] font-bold text-[#333333] cursor-pointer select-none">
            <input
              type="checkbox"
              className="accent-[#004E98] w-3.5 h-3.5"
              checked={signupNotifyEnabled}
              disabled={!isEditing}
              onChange={(e) => setSignupNotifyEnabled(e.target.checked)}
            />
            接收新玩家报名提醒
          </label>
          <p className="text-[10px] text-[#888888]">
            {isEditing ? '留空邮箱＝恢复默认 QQ 邮箱，保存后生效' : '点右上角「编辑资料」可修改邮箱或关闭通知'}
          </p>
        </div>
      </div>

      {/* Dual Column Records: GM History & Player History */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* GM History */}
        <div className="bauhaus-card p-5 bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-4 gap-2 flex-wrap sm:flex-nowrap">
              <h2 className="text-base font-black text-[#121212] flex items-center gap-2">
                <span className="w-3 h-3 bg-[#D62828]" />
                带团履历 (共 {myCampaigns.length} 次)
              </h2>
              {/* 红框处：GM点赞券数量 */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF0F0] border-2 border-[#D62828] shadow-[2px_2px_0px_#D62828]"
                title="GM点赞券：累计签到每满7次，按当次身份得1张（会员3张）；会员期间断签不清零、身份变化不清零，普通用户断签重算。可在团详情给GM点赞"
              >
                <Flame className="w-4 h-4 text-[#D62828] fill-[#D62828]" />
                <span className="font-bold text-xs text-[#121212]">GM点赞券:</span>
                <span className="font-black text-sm text-[#D62828] font-mono">
                  {currentUser.inventory?.gmHearts ?? 0}
                </span>
              </div>
            </div>

            {myCampaigns.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#888888]">
                暂无已结团的带团记录
              </div>
            ) : (
              <div className="space-y-3">
                {myCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    onClick={() => onSelectCampaign(camp)}
                    className="p-3 border-2 border-[#121212] hover:bg-[#F6F5F0] cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#121212]">{camp.title}</span>
                      </div>
                      <div className="text-xs text-[#666666] mt-1 flex items-center gap-2">
                        <span>{camp.rule}</span>
                        <span>•</span>
                        <span>{formatDisplayTime(camp.timeSchedule)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Player Participation History */}
        <div className="bauhaus-card p-5 bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-4 gap-2 flex-wrap sm:flex-nowrap">
              <h2 className="text-base font-black text-[#121212] flex items-center gap-2">
                <span className="w-3 h-3 bg-[#004E98]" />
                参团记录 (共 {myJoinedCampaigns.length} 次)
              </h2>
              {/* 红框处：玩家点赞券数量 */}
              <div
                className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF0F0] border-2 border-[#D62828] shadow-[2px_2px_0px_#D62828]"
                title="玩家点赞券：每日签到获得，可给玩家同伴点赞"
              >
                <Star className="w-4 h-4 text-[#004E98] fill-[#004E98]" />
                <span className="font-bold text-xs text-[#121212]">玩家点赞券:</span>
                <span className="font-black text-sm text-[#004E98] font-mono">
                  {currentUser.inventory?.playerHearts ?? 0}
                </span>
              </div>
            </div>

            {myJoinedCampaigns.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#888888]">
                暂无已结团的参团记录
              </div>
            ) : (
              <div className="space-y-3">
                {myJoinedCampaigns.map((camp) => (
                  <div
                    key={camp.id}
                    onClick={() => onSelectCampaign(camp)}
                    className="p-3 border-2 border-[#121212] bg-[#FAF9F5] hover:bg-white cursor-pointer transition-colors flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#121212]">{camp.title}</span>
                        <span className="px-1.5 py-0.5 bg-[#004E98] text-white text-xs font-bold">
                          主持: {camp.gmName}
                        </span>
                      </div>
                      <div className="text-xs text-[#666666] mt-1">
                        <span>规则: {camp.rule}</span>
                        <span className="mx-2">|</span>
                        <span>{formatDisplayTime(camp.timeSchedule)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {avatarToCrop && <ImageCropper file={avatarToCrop} shape="avatar" onClose={() => setAvatarToCrop(null)} onConfirm={(file) => { setAvatarToCrop(null); onUploadAvatar(file); }} />}
      {/* 页面一：我的贴纸。右上角按钮弹出独立的贴纸广场页面。 */}
      {stickerOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setStickerOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="我的贴纸" className="max-h-[90vh] w-full max-w-2xl overflow-y-auto border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]">
            <header className="flex flex-wrap items-center justify-between gap-2 bg-[#121212] px-4 py-2.5 text-white">
              <div className="flex items-center gap-3">
                <h2 className="shrink-0 font-black text-sm">我的贴纸</h2>
                <label
                  className={`flex items-center gap-1.5 whitespace-nowrap text-[11px] font-bold ${stickerMember && !publicBusy ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  title="勾选后，其他会员可在贴纸广场看到你的贴纸库存；取消勾选则不再展示"
                >
                  <input
                    type="checkbox"
                    checked={currentUser.stickerLibraryPublic !== false}
                    disabled={!stickerMember || publicBusy}
                    onChange={(event) => void toggleLibraryPublic(event.target.checked)}
                    className="h-4 w-4 shrink-0 cursor-pointer accent-[#004E98] disabled:cursor-not-allowed"
                    aria-label="公开贴纸库存"
                  />
                  公开贴纸库存
                </label>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setStickerOpen(false); setPlazaOpen(true); }}
                  className="border-2 border-white px-2.5 py-1 text-xs font-black cursor-pointer hover:bg-white hover:text-[#121212]"
                >
                  贴纸广场 →
                </button>
                <button type="button" onClick={() => setStickerOpen(false)} className="px-1 text-xs font-bold cursor-pointer">关闭</button>
              </div>
            </header>
            <div className="p-4">
              <StickerLibrary
                isMember={stickerMember}
                library={currentUser.stickerLibraryKeys || []}
                defaults={currentUser.stickerKeys || []}
                onChangeLibrary={onUpdateStickerLibrary}
                onChangeDefaults={onUpdateStickers}
              />
            </div>
          </section>
        </div>
      )}
      {/* 页面二：贴纸广场。PC 端加宽到 1240px，一排 5 张贴纸。 */}
      {plazaOpen && (
        <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/60 p-3 sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setPlazaOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="贴纸广场" className="max-h-[92vh] w-full max-w-[1240px] overflow-y-auto border-4 border-[#121212] bg-white shadow-[10px_10px_0px_#121212]">
            <header className="flex items-center justify-between gap-2 bg-[#121212] px-4 py-3 text-white">
              <h2 className="font-black text-base">贴纸广场</h2>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => { setPlazaOpen(false); setStickerOpen(true); }}
                  className="border-2 border-white px-2.5 py-1 text-xs font-black cursor-pointer hover:bg-white hover:text-[#121212]"
                >
                  ← 我的贴纸
                </button>
                <button type="button" onClick={() => setPlazaOpen(false)} className="px-1 text-xs font-bold cursor-pointer">关闭</button>
              </div>
            </header>
            <StickerPlaza
              isMember={stickerMember}
              library={currentUser.stickerLibraryKeys || []}
              onUserUpdate={onUserUpdate}
            />
          </section>
        </div>
      )}
      {membershipOpen && <MembershipModal active={membershipActive} currentUser={currentUser} onUserUpdate={onUserUpdate} onClose={() => setMembershipOpen(false)} />}
      {nameplateOpen && (
        <NameplateModal
          isOpen={nameplateOpen}
          onClose={() => setNameplateOpen(false)}
          currentNameplate={currentUser.nameplate}
          onSave={onUpdateNameplate}
        />
      )}
      {myResourcesOpen && (
        <MyResourcesModal
          onClose={() => setMyResourcesOpen(false)}
          onGoResources={onOpenResources ? () => { setMyResourcesOpen(false); onOpenResources(); } : undefined}
        />
      )}
      </div>
    </div>
  );
};
