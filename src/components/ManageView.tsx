import React, { useState } from 'react';
import { Campaign, UserProfile, CampaignStatus } from '../types';
import { CalendarPicker } from './CalendarPicker';
import { formatDisplayTime } from '../utils/date';
import { MARKDOWN_SUPPORT_HINT } from './PublishModal';
import {
  Lock,
  Unlock,
  CheckCircle,
  Trash2,
  Edit2,
  KeyRound,
  Copy,
  Flame,
  Check,
} from 'lucide-react';

interface ManageViewProps {
  currentUser: UserProfile;
  myCampaigns: Campaign[];
  rules: string[];
  onToggleStatus: (campaignId: string, nextStatus: CampaignStatus) => void;
  onDeleteCampaign: (campaignId: string) => void;
  onGenerateVoucher: (campaignId: string) => void;
  onRedeemVoucher: (code: string) => void;
  onUpdateCampaign: (campaign: Campaign) => void;
}

export const ManageView: React.FC<ManageViewProps> = ({
  currentUser,
  myCampaigns,
  rules,
  onToggleStatus,
  onDeleteCampaign,
  onGenerateVoucher,
  onRedeemVoucher,
  onUpdateCampaign,
}) => {
  const [voucherInput, setVoucherInput] = useState('');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Edit Campaign State
  const [editingCampaign, setEditingCampaign] = useState<Campaign | null>(null);

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleRedeemSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!voucherInput.trim()) return;
    onRedeemVoucher(voucherInput.trim());
    setVoucherInput('');
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCampaign) return;
    if (!editingCampaign.timeSchedule?.trim()) {
      alert('请选择开团日期及开团时段（早/中/晚）');
      return;
    }
    onUpdateCampaign(editingCampaign);
    setEditingCampaign(null);
  };

  return (
    <div className="space-y-8">
      {/* SECTION 1: Voucher Redemption */}
      <section className="bauhaus-card p-6 bg-white border-2 border-[#121212]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-[#121212] pb-3 mb-4 gap-2">
          <div>
            <h2 className="text-lg font-black text-[#121212] flex items-center gap-2">
              <span className="w-3 h-3 bg-[#D62828]" />
              参团凭证兑现
            </h2>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 bg-[#FAF0F0] border border-[#D62828] text-xs font-bold text-[#D62828]">
            <Flame className="w-4 h-4 fill-[#D62828]" />
            <span>输入凭证领取 1 枚 GM点赞</span>
          </div>
        </div>

        <form onSubmit={handleRedeemSubmit} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <KeyRound className="w-4 h-4 text-[#888888] absolute left-3 top-3.5" />
            <input
              type="text"
              value={voucherInput}
              onChange={(e) => setVoucherInput(e.target.value)}
              placeholder="请输入参团凭证代码 (例如：TRPG-BLACK-SHEEP-2026)"
              className="bauhaus-input w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-wider"
            />
          </div>
          <button
            type="submit"
            className="bauhaus-btn bg-[#004E98] text-white px-6 py-2.5 text-xs font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0px_#121212]"
          >
            <span>录入凭证</span>
          </button>
        </form>
      </section>

      {/* SECTION 2: Manage My Published Campaigns */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b-4 border-[#121212] pb-2">
          <h2 className="text-xl font-black text-[#121212] tracking-tight">
            我主持的战役 ({myCampaigns.length})
          </h2>
        </div>

        {myCampaigns.length === 0 ? (
          <div className="bauhaus-card p-10 text-center bg-white">
            <p className="text-sm font-bold text-[#444444]">暂无主持的战役</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">
            {myCampaigns.map((camp) => (
              <div
                key={camp.id}
                className="bauhaus-card p-5 bg-white border-2 border-[#121212] flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                {/* Left Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 bg-[#121212] text-white font-bold">
                      {camp.rule}
                    </span>
                    <h3 className="text-lg font-black text-[#121212]">{camp.title}</h3>

                    {/* Status badge */}
                    <span
                      className={`text-xs px-2 py-0.5 font-bold border border-[#121212] ${
                        camp.status === 'recruiting'
                          ? 'bg-[#004E98] text-white'
                          : camp.status === 'full'
                          ? 'bg-[#F4A261] text-[#121212]'
                          : camp.status === 'concluded'
                          ? 'bg-[#2A9D8F] text-white'
                          : 'bg-[#888888] text-white'
                      }`}
                    >
                      {camp.status === 'recruiting'
                        ? '招募中'
                        : camp.status === 'full'
                        ? '已满员'
                        : camp.status === 'concluded'
                        ? '已完结'
                        : '已封团'}
                    </span>
                  </div>

                  <p className="text-xs text-[#555555] mt-1.5 line-clamp-1">{camp.summary}</p>

                  <div className="mt-2 text-xs text-[#777777] flex items-center gap-4">
                    <span>时间: {formatDisplayTime(camp.timeSchedule)}</span>
                    <span>人数: {camp.maxPlayers} 人</span>
                  </div>

                  {/* Voucher display if concluded */}
                  {camp.status === 'concluded' && (
                    <div className="mt-3 inline-flex items-center gap-2 flex-wrap">
                      {camp.voucherCode ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopy(camp.voucherCode!)}
                            title="点击复制凭证码"
                            className="inline-flex items-center bg-[#FAF9F5] hover:bg-[#EAE8E0] border-2 border-[#121212] px-3 py-1.5 cursor-pointer shadow-[2px_2px_0px_#121212] hover:shadow-[3px_3px_0px_#121212] hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all text-left"
                          >
                            <span className="text-xs font-mono font-bold text-[#121212]">
                              凭证码: {camp.voucherCode}
                            </span>
                          </button>
                          {copiedCode === camp.voucherCode && (
                            <span className="text-xs font-bold text-[#004E98] bg-[#E8F1F5] px-2 py-1 border border-[#004E98] shadow-[1px_1px_0px_#004E98] animate-in fade-in duration-200">
                              复制成功
                            </span>
                          )}
                        </>
                      ) : (
                        <div className="inline-flex items-center gap-2 bg-[#FAF9F5] border-2 border-[#121212] px-3 py-1.5">
                          <span className="text-xs font-mono font-bold text-[#888888]">
                            凭证码: 尚未生成
                          </span>
                          <button
                            type="button"
                            onClick={() => onGenerateVoucher(camp.id)}
                            className="text-xs font-bold bg-[#D62828] text-white px-2 py-0.5 border border-[#121212] cursor-pointer hover:bg-[#b01e1e]"
                          >
                            生成凭证
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Operations Buttons */}
                <div className="flex flex-wrap items-center gap-2 md:self-center border-t md:border-t-0 pt-3 md:pt-0 border-[#E5E5E0]">
                  {/* Status Toggle: 封团 / 解封 */}
                  {camp.status !== 'concluded' && (
                    <button
                      onClick={() =>
                        onToggleStatus(
                          camp.id,
                          camp.status === 'closed' ? 'recruiting' : 'closed'
                        )
                      }
                      className="bauhaus-btn bg-white text-[#121212] px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                      title={camp.status === 'closed' ? '恢复招募' : '封团锁定'}
                    >
                      {camp.status === 'closed' ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-green-700" />
                          <span>解封招募</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-[#D62828]" />
                          <span>封团</span>
                        </>
                      )}
                    </button>
                  )}

                  {/* Conclude Action: 完结 */}
                  {camp.status !== 'concluded' && (
                    <button
                      onClick={() => onToggleStatus(camp.id, 'concluded')}
                      className="bauhaus-btn bg-[#2A9D8F] text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                      title="标记此战役已圆满完结"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>标记完结</span>
                    </button>
                  )}

                  {/* If concluded: Generate voucher button */}
                  {camp.status === 'concluded' && !camp.voucherCode && (
                    <button
                      onClick={() => onGenerateVoucher(camp.id)}
                      className="bauhaus-btn bg-[#F4A261] text-[#121212] px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>生成凭证</span>
                    </button>
                  )}

                  {/* Edit: 修改 */}
                  <button
                    onClick={() => setEditingCampaign({ ...camp })}
                    className="bauhaus-btn bg-white text-[#121212] px-3 py-1.5 text-xs font-bold flex items-center gap-1"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>修改</span>
                  </button>

                  {/* Delete: 删除 */}
                  <button
                    onClick={() => {
                      if (confirm(`确定要彻底删除战役《${camp.title}》吗？`)) {
                        onDeleteCampaign(camp.id);
                      }
                    }}
                    className="bauhaus-btn bg-[#FAF0F0] text-[#D62828] border-[#D62828] px-3 py-1.5 text-xs font-bold flex items-center gap-1 hover:bg-[#D62828] hover:text-white"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>删除</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Edit Modal Dialog */}
      {editingCampaign && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-xl bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212] p-6 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-black text-[#121212] border-b-2 border-[#121212] pb-2 mb-4">
              修改战役信息
            </h3>

            <form onSubmit={handleSaveEdit} className="space-y-4 text-sm">
              <div>
                <label className="block font-bold mb-1">战役标题</label>
                <input
                  type="text"
                  required
                  value={editingCampaign.title}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, title: e.target.value })
                  }
                  className="bauhaus-input w-full p-2 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">规则系统</label>
                <select
                  required
                  value={editingCampaign.rule}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, rule: e.target.value })
                  }
                  className="bauhaus-input w-full p-2 text-sm"
                >
                  {!rules.includes(editingCampaign.rule) && <option value={editingCampaign.rule}>{editingCampaign.rule}（已从规则列表移除）</option>}
                  {rules.map((rule) => <option key={rule} value={rule}>{rule}</option>)}
                </select>
              </div>

              <div>
                <label className="block font-bold mb-1">
                  开团时间 <span className="text-[#D62828]">*</span>
                </label>
                <CalendarPicker
                  value={editingCampaign.timeSchedule}
                  onChange={(val) =>
                    setEditingCampaign({ ...editingCampaign, timeSchedule: val })
                  }
                />
              </div>
              <div>
                <label className="block font-bold mb-1">预计人数</label>
                <input type="number" min={1} max={12} required value={editingCampaign.maxPlayers} onChange={(e) => setEditingCampaign({ ...editingCampaign, maxPlayers: Number(e.target.value) })} className="bauhaus-input w-full p-2 text-sm" />
              </div>

              <div>
                <label className="block font-bold mb-1">一句话概括</label>
                <input
                  type="text"
                  required
                  value={editingCampaign.summary}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, summary: e.target.value })
                  }
                  className="bauhaus-input w-full p-2 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold mb-1">简介</label>
                <textarea
                  rows={6}
                  value={editingCampaign.description}
                  onChange={(e) =>
                    setEditingCampaign({ ...editingCampaign, description: e.target.value })
                  }
                  placeholder={MARKDOWN_SUPPORT_HINT}
                  className="bauhaus-input w-full p-2 text-sm font-mono resize-none leading-relaxed"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-[#121212]">
                <button
                  type="button"
                  onClick={() => setEditingCampaign(null)}
                  className="bauhaus-btn bg-white px-4 py-1.5 text-xs font-bold"
                >
                  取消
                </button>
                <button
                  type="submit"
                  className="bauhaus-btn bg-[#121212] text-white px-5 py-1.5 text-xs font-bold"
                >
                  保存修改
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
