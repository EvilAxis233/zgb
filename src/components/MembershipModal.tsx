import { useEffect, useState, type FormEvent } from 'react';
import { X } from 'lucide-react';

interface Props {
  active: boolean;
  onClose: () => void;
  onRedeem: (key: string) => Promise<void>;
}

export function MembershipModal({ active, onClose, onRedeem }: Props) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !busy) onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [busy, onClose]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await onRedeem(key.trim());
      onClose();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '兑换失败，请稍后重试');
    } finally {
      setBusy(false);
    }
  };

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="membership-title" className="w-full max-w-md border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]">
      <header className="flex items-center justify-between bg-[#121212] px-5 py-3 text-white">
        <h2 id="membership-title" className="font-black">{active ? '续费会员' : '升级会员'}</h2>
        <button type="button" aria-label="关闭弹窗" disabled={busy} onClick={onClose} className="cursor-pointer disabled:opacity-50"><X size={19} /></button>
      </header>
      <div className="space-y-5 p-5">
        <div className="border-2 border-[#004E98] bg-[#EAF3FB] p-4 text-sm">
          <h3 className="mb-2 font-black text-[#004E98]">会员权益</h3>
          <ul className="list-disc space-y-1 pl-5 text-[#333]">
            <li>开通会员身份，有效期 30 天。</li>
            <li>使用不同密钥可续费，时长自动叠加。</li>
            <li>更多会员功能将陆续开放。</li>
          </ul>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <label htmlFor="membership-key" className="block text-sm font-black">输入会员密钥</label>
          <input id="membership-key" autoFocus required maxLength={120} autoComplete="off" spellCheck={false} value={key} onChange={(event) => setKey(event.target.value)} placeholder="VIP1.···" className="bauhaus-input w-full px-3 py-2 font-mono text-sm" />
          {error && <p role="alert" className="text-sm font-bold text-[#B51F1F]">{error}</p>}
          <button type="submit" disabled={busy || !key.trim()} className="bauhaus-btn w-full bg-[#D62828] py-2.5 font-black text-white disabled:opacity-50">{busy ? '兑换中…' : '兑换 30 天会员'}</button>
        </form>
      </div>
    </section>
  </div>;
}
