import React, { useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

interface Props { open: boolean; onClose: () => void; onSuccess: () => Promise<void>; }
export const LoginModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [qq, setQq] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  if (!open) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessage(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="w-full max-w-md bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212]">
      <div className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between">
        <strong>登录诸告板</strong><button onClick={onClose} aria-label="关闭"><X size={20}/></button>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-[#555]">输入 QQ 号，验证码将发送至对应的 QQ 邮箱。</p>
        <label className="block text-sm font-bold">QQ 号
          <input className="bauhaus-input mt-1 w-full p-2" inputMode="numeric" autoComplete="username" value={qq} onChange={(e) => setQq(e.target.value.replace(/\D/g, ''))} placeholder="QQ 号" />
        </label>
        <button disabled={busy || !/^[1-9][0-9]{4,11}$/.test(qq)} onClick={() => run(async () => { await api.requestCode(qq); setSent(true); setMessage('验证码已发送，十分钟内有效。'); })} className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-sm font-bold disabled:opacity-50">发送验证码</button>
        {sent && <><label className="block text-sm font-bold">验证码
          <input className="bauhaus-input mt-1 w-full p-2" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="六位验证码" />
        </label><button disabled={busy || code.length !== 6} onClick={() => run(async () => { await api.verify(qq, code); await onSuccess(); setCode(''); onClose(); })} className="bauhaus-btn bg-[#D62828] text-white px-5 py-2 text-sm font-bold disabled:opacity-50">登录</button></>}
        {message && <p role="status" className="text-sm text-[#D62828]">{message}</p>}
      </div>
    </div>
  </div>;
};
