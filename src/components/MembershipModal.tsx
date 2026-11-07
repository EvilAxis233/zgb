import { useEffect, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

interface Props {
  active: boolean;
  onClose: () => void;
}

const GROUP_QQ = '917744498';

const benefits = [
  '会员专属动态鎏金头像框，主界面、团详情与个人资料同步显示',
  '累计签到每满 7 次得 3 张 GM 点赞券（普通用户 1 张），中断不清零',
  '自定义展示铭牌：多种样式 + 自定义文字（4 汉字 / 8 英文）',
  '贴纸库预存 10 张、默认佩戴 2 张，发车时可临时改选',
];

export function MembershipModal({ active, onClose }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(GROUP_QQ);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="membership-title" className="w-full max-w-md border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]">
      <header className="flex items-center justify-between bg-[#121212] px-5 py-3 text-white">
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

        <div className="border-2 border-[#121212] bg-[#FFF4DA] p-3">
          <p className="text-sm font-black text-[#121212]">赞助会员需要加入交流群</p>
          <p className="mt-1 text-xs font-bold text-[#5C4300]">加入交流群后联系站长开通或续费，开通前请先在站内用 QQ 号登录，方便核对身份。</p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 border border-[#121212] bg-white px-2 py-1.5 text-sm font-black tracking-wider">{GROUP_QQ}</code>
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
