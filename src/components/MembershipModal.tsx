import { useEffect, useState, type FormEvent } from 'react';
import { Check, Copy, ExternalLink, KeyRound, X } from 'lucide-react';
import { api } from '../services/api';
import type { UserProfile } from '../types';

interface Props {
  active: boolean;
  currentUser?: UserProfile;
  onUserUpdate?: (user: UserProfile) => void;
  onClose: () => void;
}

const DEFAULT_GROUP_QQ = '917744498';

const benefits = [
  '会员专属动态鎏金头像框，主界面、团详情与个人资料同步显示',
  '累计签到每满 7 次得 3 张 GM 点赞券（普通用户 1 张），会员期间断签不清零、身份变化不清零',
  '自定义展示铭牌：多种样式 + 自定义文字（6 汉字 / 12 英文）',
  '贴纸库预存 10 张、默认佩戴 2 张，发车时可临时改选',
];

const hkTime = (seconds: number) => new Date(seconds * 1000).toLocaleString('zh-CN', { timeZone: 'Asia/Hong_Kong', hour12: false });

export function MembershipModal({ active, currentUser, onUserUpdate, onClose }: Props) {
  const [copied, setCopied] = useState(false);
  const [afdianUrl, setAfdianUrl] = useState('');
  const [groupQq, setGroupQq] = useState(DEFAULT_GROUP_QQ);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    api.siteSettings().then((data) => { setAfdianUrl(data.afdianUrl || ''); setGroupQq(data.groupQq || DEFAULT_GROUP_QQ); }).catch(() => {});
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(groupQq);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  const redeem = async (event: FormEvent) => {
    event.preventDefault();
    if (busy || !code.trim()) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const result = await api.redeemMembershipKey(code.trim());
      if (currentUser && onUserUpdate) onUserUpdate({ ...currentUser, membershipExpiresAt: result.membershipExpiresAt });
      setSuccess(`激活成功，已增加 ${result.months} 个月会员，有效期至 ${hkTime(result.membershipExpiresAt)}`);
      setCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '激活失败，请稍后重试');
    } finally { setBusy(false); }
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="membership-title" className="w-full max-w-md max-h-[90vh] overflow-y-auto border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]">
      <header className="flex items-center justify-between bg-[#121212] px-5 py-3 text-white sticky top-0 z-10">
        <h2 id="membership-title" className="font-black">{active ? '续费会员' : '升级会员'}</h2>
        <button type="button" aria-label="关闭弹窗" onClick={onClose} className="cursor-pointer"><X size={19} /></button>
      </header>

      <div className="p-5 space-y-4">
        <div>
          <p className="text-xs font-black text-[#666] mb-2">会员权益</p>
          <ul className="space-y-1.5">
            {benefits.map((item) => <li key={item} className="flex items-start gap-2 text-sm font-bold text-[#121212]"><Check size={15} className="mt-0.5 shrink-0 text-[#004E98]" />{item}</li>)}
          </ul>
        </div>

        <div className="border-2 border-[#121212] bg-[#EAF1FA] p-3">
          <p className="text-sm font-black text-[#121212]">① 在爱发电赞助，自动收到会员 Key</p>
          <p className="mt-1 text-xs font-bold text-[#33475B]">赞助后爱发电会通过私信自动发给你一个会员 Key，把它填到下方「Key 激活」即可立即开通，无需等站长手动处理。</p>
          {afdianUrl && <a href={afdianUrl} target="_blank" rel="noopener noreferrer" className="bauhaus-btn mt-2.5 bg-[#004E98] px-3 py-1.5 text-xs font-black text-white inline-flex items-center gap-1.5">前往爱发电赞助<ExternalLink size={13} /></a>}
          {!afdianUrl && <p className="mt-2 text-xs font-bold text-[#7A4B00]">赞助通道正在配置中，可先通过下方交流群联系站长。</p>}
        </div>

        <form onSubmit={redeem} className="border-2 border-[#121212] bg-[#FFF4DA] p-3">
          <p className="text-sm font-black text-[#121212] flex items-center gap-1.5"><KeyRound size={15} />② 已有会员 Key，在这里激活</p>
          <p className="mt-1 text-xs font-bold text-[#5C4300]">Key 只能使用一次，激活后会员时长自动叠加到当前有效期上。</p>
          <div className="mt-2 flex gap-2">
            <input aria-label="会员 Key" value={code} onChange={(event) => { setCode(event.target.value); setError(''); }} placeholder="粘贴会员 Key，例如 PB-XXXX-XXXX-XXXX" className="bauhaus-input min-w-0 flex-1 px-2 py-1.5 text-sm font-mono" />
            <button type="submit" disabled={busy || !code.trim()} className="bauhaus-btn bg-[#D62828] px-3 py-1.5 text-xs font-black text-white disabled:opacity-50">{busy ? '激活中…' : '激活'}</button>
          </div>
          {error && <p role="alert" className="mt-2 text-xs font-black text-[#B51F1F]">{error}</p>}
          {success && <p role="status" className="mt-2 text-xs font-black text-[#176B57]">{success}</p>}
        </form>

        <div className="border-2 border-[#121212] bg-white p-3">
          <p className="text-sm font-black text-[#121212]">③ 交流群（备用通道，长期保留）</p>
          <p className="mt-1 text-xs font-bold text-[#666]">如果无法使用爱发电，依然可以进交流群联系站长开通或续费；开通或激活前请先在本站用 QQ 号登录，方便核对身份。</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 border border-[#121212] bg-[#FAF9F5] px-2 py-1.5 text-sm font-black tracking-wider">{groupQq}</code>
            <button type="button" onClick={copy} className="bauhaus-btn bg-[#004E98] px-3 py-1.5 text-xs font-bold text-white inline-flex items-center gap-1.5 cursor-pointer">
              {copied ? <><Check size={13} />已复制</> : <><Copy size={13} />复制群号</>}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-[#666] leading-relaxed">动态头像与动态封面（GIF / APNG / 动态 WebP 保留动画）是全站基础功能，所有登录用户都可使用。</p>
      </div>
    </section>
  </div>;
}
