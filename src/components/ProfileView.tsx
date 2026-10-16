import React, { useState } from 'react';
import { UserProfile, Campaign } from '../types';
import { Flame, Star, Edit3, Check, Upload } from 'lucide-react';
import { useDialog } from './BauhausDialog';

interface ProfileViewProps {
  currentUser: UserProfile;
  myCampaigns: Campaign[];
  myJoinedCampaigns: Campaign[];
  onUpdateProfile: (updates: Partial<UserProfile>) => Promise<boolean>;
  onSelectCampaign: (campaign: Campaign) => void;
  onUploadAvatar: (file: File) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  currentUser,
  myCampaigns,
  myJoinedCampaigns,
  onUpdateProfile,
  onSelectCampaign,
  onUploadAvatar,
}) => {
  const { showAlert } = useDialog();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [name, setName] = useState(currentUser.name);
  const [bio, setBio] = useState(currentUser.bio);
  const [preferences, setPreferences] = useState<string[]>(currentUser.preferences || []);
  const [taboos, setTaboos] = useState<string[]>(currentUser.taboos || []);
  const [newPref, setNewPref] = useState('');
  const [newTaboo, setNewTaboo] = useState('');

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
        message: '名字不能为空',
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
    <div className="space-y-6">
      {/* Top Profile Header Card */}
      <div className="bauhaus-card p-6 bg-white">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-[#121212] pb-6">
          <div className="flex items-center gap-4">
            {/* Bauhaus Avatar Icon */}
            <label className="relative w-16 h-16 bg-[#121212] text-white font-black text-2xl flex items-center justify-center border-2 border-[#121212] shadow-[4px_4px_0px_#D62828] cursor-pointer overflow-hidden group" title="上传头像">
              {currentUser.avatar ? <img src={currentUser.avatar} alt="我的头像" className="w-full h-full object-cover" /> : (name || currentUser.name || '?').charAt(0)}
              <span className="absolute inset-x-0 bottom-0 py-1 bg-black/75 text-[10px] flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"><Upload className="w-3 h-3" />更换</span>
              <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUploadAvatar(file); event.target.value = ''; }} />
            </label>
            <div>
              {isEditing ? (
                <div>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="请输入姓名/昵称"
                    className="bauhaus-input px-3 py-1 text-lg font-black max-w-[220px]"
                    autoFocus
                  />
                </div>
              ) : (
                <h1 className="text-2xl font-black text-[#121212]">{currentUser.name}</h1>
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
                  placeholder="添加喜好回车"
                  className="bauhaus-input flex-1 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={addPreference}
                  className="bauhaus-btn bg-white px-2 py-1 text-xs"
                >
                  +
                </button>
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
                  placeholder="添加禁忌回车"
                  className="bauhaus-input flex-1 px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={addTaboo}
                  className="bauhaus-btn bg-white px-2 py-1 text-xs"
                >
                  +
                </button>
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
            <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-4">
              <h2 className="text-base font-black text-[#121212] flex items-center gap-2">
                <span className="w-3 h-3 bg-[#D62828]" />
                带团履历 (共 {myCampaigns.length} 次)
              </h2>
            </div>

            {myCampaigns.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#888888]">
                暂无带团记录，点击右上角【发布新团】发起首个战役
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
                        <span className="px-1.5 py-0.5 bg-[#121212] text-white text-xs font-bold">
                          {camp.hasEnded ? '已到期' : camp.isFull ? '已满员' : '招募中'}
                        </span>
                      </div>
                      <div className="text-xs text-[#666666] mt-1 flex items-center gap-2">
                        <span>{camp.rule}</span>
                        <span>•</span>
                        <span>{camp.timeSchedule}</span>
                      </div>
                    </div>
                    <span className="text-xs font-bold underline decoration-[#D62828]">查看</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Player Participation History */}
        <div className="bauhaus-card p-5 bg-white flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2 mb-4">
              <h2 className="text-base font-black text-[#121212] flex items-center gap-2">
                <span className="w-3 h-3 bg-[#004E98]" />
                参团记录 (共 {myJoinedCampaigns.length} 次)
              </h2>
            </div>

            {myJoinedCampaigns.length === 0 ? (
              <div className="py-8 text-center text-xs text-[#888888]">
                暂无参团记录。可在主页打开团详情后报名
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

                    <div className="text-right">
                      <span className="text-xs font-bold underline decoration-[#004E98]">查看</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
