import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../services/api';

interface Props { open: boolean; onClose: () => void; onSuccess: () => Promise<void>; }
export const LoginModal: React.FC<Props> = ({ open, onClose, onSuccess }) => {
  const [qq, setQq] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'error' | 'info'>('error');
  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);
  if (!open) return null;
  const run = async (action: () => Promise<void>) => {
    setBusy(true); setMessage('');
    try { await action(); } catch (e) { setMessageType('error'); setMessage(e instanceof Error ? e.message : '操作失败'); }
    finally { setBusy(false); }
  };
  const qqReady = /^[1-9][0-9]{4,11}$/.test(qq);
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
    <div className="w-full max-w-md bg-white border-4 border-[#121212] shadow-[8px_8px_0px_#121212]">
      <div className="bg-[#121212] text-white px-5 py-3 flex items-center justify-between">
        <strong>登录诸告板</strong><button onClick={onClose} aria-label="关闭"><X size={20}/></button>
      </div>
      <div className="p-6 space-y-4">
        <p className="text-sm text-[#555]">输入 QQ 号，验证码将发送至对应的 QQ 邮箱。弱网下若发送较慢，可先在下方填好验证码等待。</p>
        <label className="block text-sm font-bold">QQ 号
          <input className="bauhaus-input mt-1 w-full p-2" inputMode="numeric" autoComplete="username" value={qq} onChange={(e) => setQq(e.target.value.replace(/\D/g, ''))} placeholder="QQ 号" />
        </label>
        <div className="flex items-center gap-2">
          <button disabled={busy || !qqReady || countdown > 0} onClick={() => run(async () => { await api.requestCode(qq); setSent(true); setCountdown(60); setMessageType('info'); setMessage('验证码已发送，请到该 QQ 号的邮箱查收（十分钟内有效），若未收到可稍后重发。'); })} className="bauhaus-btn bg-[#004E98] text-white px-4 py-2 text-sm font-bold disabled:opacity-50 whitespace-nowrap">
            {busy ? '发送中…' : countdown > 0 ? `${countdown}s 后可重发` : sent ? '重新发送验证码' : '发送验证码'}
          </button>
          {countdown > 0 && <span className="text-xs text-[#555]">发送间隔 60 秒</span>}
        </div>
        <label className="block text-sm font-bold">验证码
          <input className="bauhaus-input mt-1 w-full p-2" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} placeholder="六位验证码" />
        </label>
        {!sent && <p className="text-xs text-[#888]">还没收到验证码？先点击上方「发送验证码」，邮件通常 1 分钟内送达。</p>}
        <button disabled={busy || code.length !== 6} onClick={() => run(async () => { await api.verify(qq, code); await onSuccess(); setCode(''); onClose(); })} className="bauhaus-btn bg-[#D62828] text-white px-5 py-2 text-sm font-bold disabled:opacity-50">登录</button>
        {message && <p role="status" className={`text-sm ${messageType === 'error' ? 'text-[#D62828]' : 'text-[#004E98]'}`}>{message}</p>}
      </div>
    </div>
  </div>;
};
