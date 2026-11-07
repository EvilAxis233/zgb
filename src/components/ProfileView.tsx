import React, { useState } from 'react';
import { UserProfile, Campaign, UserNameplate } from '../types';
import { Flame, Star, Edit3, Check, Upload, Crown, Tag, Sparkles } from 'lucide-react';
import { ImageCropper } from './ImageCropper';
import { useDialog } from './BauhausDialog';
import { AccountSideActions } from './AccountSideActions';
import { MembershipModal } from './MembershipModal';
import { NameplateModal } from './NameplateModal';
import { NameplateBadge } from './NameplateBadge';
import { StickerLibrary } from './StickerLibrary';

interface ProfileViewProps {
  currentUser: UserProfile;
  myCampaigns: Campaign[];
  myJoinedCampaigns: Campaign[];
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  onUpdateNameplate: (nameplate: UserNameplate | null) => Promise<boolean>;
  onUpdateStickers: (keys: string[]) => Promise<boolean>;
  onUpdateStickerLibrary: (keys: string[]) => Promise<boolean>;
  onSelectCampaign: (campaign: Campaign) => void;
  onUploadAvatar: (file: File) => void;
  onOpenManage: () => void;
  onFeedback: () => void;
  onReport: () => void;
}

const nicknameLength = (value: string) => Array.from(value).reduce(
  (total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2),
  0,
);

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  myCampaigns,
  myJoinedCampaigns,
  onUpdateProfile,
  onSelectCampaign,
  onUploadAvatar,
  onOpenManage,
  onFeedback,
  onReport,
  onUpdateNameplate,
  onUpdateStickers,
  onUpdateStickerLibrary,
}) => {
  const { showAlert } = useDialog();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarToCrop, setAvatarToCrop] = useState<File | null>(null);
  const [membershipOpen, setMembershipOpen] = useState(false);
  const [nameplateOpen, setNameplateOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [membershipNow, setMembershipNow] = useState(() => Date.now());
  const membershipActive = !!currentUser.membershipExpiresAt && currentUser.membershipExpiresAt * 1000 > membershipNow;
  React.useEffect(() => {
    const timer = window.setInterval(() => setMembershipNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio);
  const [preferences, setPreferences] = useState<string[]>(currentUser.preferences || []);
  const [taboos, setTaboos] = useState<string[]>(currentUser.taboos || []);
  const [newPref, setNewPref] = useState('');
  const [newTaboo, setNewTaboo] = useState('');
  const nameLength = nicknameLength(name.trim());

  React.useEffect(() => {
    setName(currentUser.name);
    setBio(currentUser.bio);
    setPreferences(currentUser.preferences || []);
    setTaboos(currentUser.taboos || []);
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
    setIsSaving(true);
    try {
      const success = await onUpdateProfile({
        name: name.trim(),
        bio,
        preferences,
        taboos,
      });
      if (success) setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const addPreference = () => {
    if (newPref.trim() && !preferences.includes(newPref.trim())) {
      setPreferences([...preferences, newPref.trim()]);
      setNewPref('');
    }
  };

  const removePreference = (tag: string) => {
    setPreferences(preferences.filter((p) => p !== tag));
  };

  const addTaboo = () => {
    if (newTaboo.trim() && !taboos.includes(newTaboo.trim())) {
      setTaboos([...taboos, newTaboo.trim()]);
      setNewTaboo('');
    }
  };

  const removeTaboo = (tag: string) => {
    setTaboos(taboos.filter((t) => t !== tag));
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 items-start">
      <div className="w-full lg:w-60 xl:w-64 shrink-0 lg:sticky lg:top-20 space-y-3">
        <AccountSideActions destination="manage" onNavigate={onOpenManage} onFeedback={onFeedback} onReport={onReport} />
        <button type="button" disabled={currentUser.membershipPermanent} onClick={() => setMembershipOpen(true)} className="bauhaus-btn w-full bg-[#FFF4DA] px-4 py-3 text-sm font-black gap-2"><Crown size={17} />{currentUser.membershipPermanent ? '永久会员' : membershipActive ? '续费会员' : '升级会员'}</button>
        {membershipActive && (
          <div className="space-y-3">
            <p className="text-xs font-bold text-[#5C4300]">
              {currentUser.membershipPermanent ? '永久会员 · 长期有效' : `到期：${new Date(currentUser.membershipExpiresAt! * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false })}`}
            </p>
            <div className="border-t-2 border-[#121212] pt-3 space-y-2">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setNameplateOpen(true)}
                  className="bauhaus-btn flex-1 bg-white px-3 py-2 text-xs font-black gap-1.5 hover:bg-[#FAF9F5] shadow-[2px_2px_0px_#121212] cursor-pointer"
                  title="设置我的自定义铭牌"
                >
                  <Tag size={14} className="text-[#004E98]" />
                  铭牌
                </button>
                <button
                  type="button"
                  onClick={() => setStickerOpen(true)}
                  className="bauhaus-btn flex-1 bg-white px-3 py-2 text-xs font-black gap-1.5 hover:bg-[#FAF9F5] shadow-[2px_2px_0px_#121212] cursor-pointer"
                  title="管理我的贴纸"
                >
                  <Sparkles size={14} className="text-[#D62828]" />
                  贴纸
                </button>
              </div>
              {currentUser.nameplate && (
                <div className="flex items-center justify-between p-2 bg-[#FAF9F5] border border-[#121212]">
                  <span className="text-[11px] font-bold text-[#666]">当前佩戴：</span>
                  <NameplateBadge nameplate={currentUser.nameplate} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      <div className="space-y-6 min-w-0 w-full">
      {/* Top Profile Header Card */}
      <div className="bauhaus-card p-6 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#121212] pb-6">
          <div className="flex items-center gap-4">
            {/* Bauhaus Avatar Icon */}
            <label className="relative w-16 h-16 bg-[#121212] text-white font-black text-2xl flex items-center justify-center border-2 border-[#121212] shadow-[4px_4px_0px_#D62828] cursor-pointer overflow-hidden group" title="上传头像">
              {currentUser.avatar ? <img src={currentUser.avatar} alt="我的头像" className="w-full h-full object-cover" /> : (name || currentUser.name || '?').charAt(0)}
              <span className="absolute inset-x-0 bottom-0 py-1 bg-black/75 text-[10px] flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><Upload className="w-3 h-3" />更换</span>
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file && !['image/png', 'image/jpeg', 'image/gif', 'image/webp'].includes(file.type)) showAlert({ title: '图片格式错误', message: '请选择 PNG、JPG、GIF 或 WebP 图片', type: 'warning' });
                else if (file && file.size > 20 * 1024 * 1024) showAlert({ title: '图片过大', message: '原图请小于 20MB', type: 'warning' });
                else if (file && file.type === 'image/gif') onUploadAvatar(file);
                else if (file) setAvatarToCrop(file);
                event.target.value = '';
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
                  {!!currentUser.stickers?.length && (
                    <span className="flex items-center gap-1">
                      {currentUser.stickers.slice(0, 2).map((src, index) => <img key={`${src}-${index}`} src={src} alt="我的贴纸" className="h-7 w-7 border-2 border-[#121212] bg-white object-cover" />)}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Praise & Inventory Counter Badges */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Received GM Praise */}
            <div className="bg-[#FAF0F0] border-2 border-[#D62828] px-3.5 py-2 shadow-[2px_2px_0px_#D62828] text-center">
              <span className="block text-xs font-bold text-[#666666]">获 GM点赞</span>
              <span className="text-lg font-black text-[#D62828] flex items-center justify-center gap-1">
                <Flame className="w-4 h-4 fill-[#D62828]" />
                {currentUser.receivedGmPraises}
              </span>
            </div>

            {/* Received Player Praise */}
            <div className="bg-[#F0F5FA] border-2 border-[#004E98] px-3.5 py-2 shadow-[2px_2px_0px_#004E98] text-center">
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
              className="bauhaus-btn bg-[#121212] text-white px-4 py-2 text-xs font-bold flex items-center gap-1.5"
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
          {/* Bio */}
          <div className="md:col-span-5">
            <h3 className="text-xs font-black tracking-wider text-[#121212] mb-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#D62828]" />
              个人简介
            </h3>
            {isEditing ? (
              <textarea
                rows={4}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className="bauhaus-input w-full p-2.5 text-xs resize-none"
                placeholder="介绍你的跑团风格、主持理念或经历..."
              />
            ) : (
              <p className="text-sm text-[#333333] leading-relaxed bg-[#F6F5F0] p-3 border-l-4 border-[#121212]">
                {currentUser.bio || '尚未填写个人简介'}
              </p>
            )}
          </div>

          {/* Preferences (喜好) */}
          <div className="md:col-span-3">
            <h3 className="text-xs font-black tracking-wider text-[#004E98] mb-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#004E98]" />
              喜好偏好
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
              <div className="mt-2 flex gap-1">
                <input
                  type="text"
                  value={newPref}
                  onChange={(e) => setNewPref(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPreference())}
                  placeholder="输入后回车"
                  className="bauhaus-input flex-1 px-2 py-1 text-xs"
                />
              </div>
            )}
          </div>

          {/* Taboos (禁忌) */}
          <div className="md:col-span-4">
            <h3 className="text-xs font-black tracking-wider text-[#D62828] mb-2 flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 bg-[#D62828]" />
              雷区禁忌
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
              <div className="mt-2 flex gap-1">
                <input
                  type="text"
                  value={newTaboo}
                  onChange={(e) => setNewTaboo(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTaboo())}
                  placeholder="输入后回车"
                  className="bauhaus-input flex-1 px-2 py-1 text-xs"
                />
              </div>
            )}
          </div>
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
                title="GM点赞券：普通用户连续签到每满七天得1张；会员累计签到每满七次得3张，可在团详情给GM点赞"
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
                        <span>{camp.timeSchedule}</span>
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
                        <span>{camp.timeSchedule}</span>
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
      {stickerOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setStickerOpen(false); }}>
          <section role="dialog" aria-modal="true" aria-label="管理贴纸" className="w-full max-w-md border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]">
            <header className="flex items-center justify-between bg-[#121212] px-4 py-2.5 text-white">
              <h2 className="font-black text-sm">我的贴纸库</h2>
              <button type="button" onClick={() => setStickerOpen(false)} className="text-xs font-bold cursor-pointer">关闭</button>
            </header>
            <div className="p-4">
              <StickerLibrary
                isMember={membershipActive || !!currentUser.membershipPermanent}
                library={currentUser.stickerLibraryKeys || []}
                defaults={currentUser.stickerKeys || []}
                onChangeLibrary={onUpdateStickerLibrary}
                onChangeDefaults={onUpdateStickers}
              />
            </div>
          </section>
        </div>
      )}
      {membershipOpen && <MembershipModal active={membershipActive} onClose={() => setMembershipOpen(false)} />}
      {nameplateOpen && (
        <NameplateModal
          isOpen={nameplateOpen}
          onClose={() => setNameplateOpen(false)}
          currentNameplate={currentUser.nameplate}
          onSave={onUpdateNameplate}
        />
      )}
      </div>
    </div>
  );
};
