import { useEffect } from 'react';
import { X } from 'lucide-react';

interface Props {
  active: boolean;
  onClose: () => void;
}

export function MembershipModal({ active, onClose }: Props) {
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="membership-title" className="w-full max-w-md border-4 border-[#121212] bg-white shadow-[8px_8px_0px_#121212]">
      <header className="flex items-center justify-between bg-[#121212] px-5 py-3 text-white">
        <h2 id="membership-title" className="font-black">{active ? '续费会员' : '升级会员'}</h2>
        <button type="button" aria-label="关闭弹窗" onClick={onClose} className="cursor-pointer"><X size={19} /></button>
      </header>
      <p className="p-5 text-center font-black">等待爱发电审核中，即将上线...</p>
    </section>
  </div>;
}
