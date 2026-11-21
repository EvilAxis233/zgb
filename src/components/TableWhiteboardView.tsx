import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { api, type TableRoom, type TableMessage } from '../services/api';
import type { UserProfile } from '../types';
import {
  ArrowRight, Brush, Circle, Copy, Eraser, Image as ImageIcon, Link2, LoaderCircle,
  Minus, MousePointer2, Plus, RotateCcw, Send, Square, Trash2, Type, Users, Dices, X, ChevronLeft,
} from 'lucide-react';

type Tool = 'select' | 'pen' | 'line' | 'arrow' | 'rect' | 'ellipse' | 'text' | 'image' | 'eraser';
type WbElement = {
  id: string; type: Tool; x: number; y: number;
  points?: number[]; x2?: number; y2?: number; w?: number; h?: number;
  text?: string; src?: string; color: string; size: number;
};

const WORLD_W = 2200, WORLD_H = 1500;
const COLORS = ['#121212', '#D62828', '#004E98', '#176B57', '#F4A261', '#7A2E9E'];
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const seedOf = (s: string) => [...s].reduce((a, c) => a + c.charCodeAt(0), 7);
const rand = (seed: number) => { const x = Math.sin(seed) * 10000; return x - Math.floor(x); };

function drawElement(ctx: CanvasRenderingContext2D, el: WbElement, cache: Map<string, HTMLImageElement>, onImgLoad: () => void) {
  const jitter = (n: number) => (rand(seedOf(el.id) + n) - 0.5) * 1.4;
  ctx.save();
  ctx.strokeStyle = el.color; ctx.fillStyle = el.color;
  ctx.lineWidth = el.size; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (el.type === 'pen' && el.points && el.points.length >= 2) {
    ctx.beginPath(); ctx.moveTo(el.x, el.y);
    for (let i = 0; i < el.points.length; i += 2) ctx.lineTo(el.x + el.points[i] + jitter(i), el.y + el.points[i + 1] + jitter(i + 1));
    ctx.stroke();
    ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(1, el.size * 0.6);
    ctx.beginPath(); ctx.moveTo(el.x + jitter(99), el.y + jitter(100));
    for (let i = 0; i < el.points.length; i += 2) ctx.lineTo(el.x + el.points[i] + jitter(i + 50), el.y + el.points[i + 1] + jitter(i + 51));
    ctx.stroke();
  } else if (el.type === 'line' || el.type === 'arrow') {
    const x2 = el.x2 ?? el.x, y2 = el.y2 ?? el.y;
    ctx.beginPath(); ctx.moveTo(el.x, el.y); ctx.lineTo(x2, y2); ctx.stroke();
    if (el.type === 'arrow') {
      const a = Math.atan2(y2 - el.y, x2 - el.x), len = 10 + el.size;
      ctx.beginPath(); ctx.moveTo(x2, y2);
      ctx.lineTo(x2 - len * Math.cos(a - 0.5), y2 - len * Math.sin(a - 0.5));
      ctx.moveTo(x2, y2); ctx.lineTo(x2 - len * Math.cos(a + 0.5), y2 - len * Math.sin(a + 0.5));
      ctx.stroke();
    }
  } else if (el.type === 'rect') {
    const w = el.w ?? 0, h = el.h ?? 0;
    ctx.strokeRect(el.x + jitter(1), el.y + jitter(2), w, h);
  } else if (el.type === 'ellipse') {
    const w = el.w ?? 0, h = el.h ?? 0;
    ctx.beginPath(); ctx.ellipse(el.x + w / 2, el.y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2); ctx.stroke();
  } else if (el.type === 'text') {
    ctx.font = `bold ${el.size * 5}px "Noto Sans SC", sans-serif`;
    ctx.textBaseline = 'top';
    String(el.text || '').split('\n').forEach((line, i) => ctx.fillText(line, el.x, el.y + i * el.size * 5.5));
  } else if (el.type === 'image' && el.src) {
    let img = cache.get(el.src);
    if (!img) { img = new Image(); img.onload = onImgLoad; img.src = el.src; cache.set(el.src, img); }
    if (img.complete && img.naturalWidth) {
      const w = el.w ?? 200, h = el.h ?? 150;
      ctx.drawImage(img, el.x, el.y, w, h);
    }
  }
  ctx.restore();
}

function hitTest(el: WbElement, x: number, y: number): boolean {
  const pad = 12;
  if (el.type === 'text') return x >= el.x - pad && x <= el.x + (el.text?.length || 4) * el.size * 3 && y >= el.y - pad && y <= el.y + el.size * 6;
  if (el.type === 'image' || el.type === 'rect' || el.type === 'ellipse') {
    const w = el.w ?? 0, h = el.h ?? 0;
    return x >= Math.min(el.x, el.x + w) - pad && x <= Math.max(el.x, el.x + w) + pad && y >= Math.min(el.y, el.y + h) - pad && y <= Math.max(el.y, el.y + h) + pad;
  }
  const pts = el.type === 'pen' && el.points ? el.points : [0, 0, (el.x2 ?? el.x) - el.x, (el.y2 ?? el.y) - el.y];
  for (let i = 0; i < pts.length; i += 2) {
    if (Math.hypot(x - (el.x + pts[i]), y - (el.y + pts[i + 1])) < pad + el.size) return true;
  }
  return false;
}

function ToolButton({ active, title, onClick, children }: { active?: boolean; title: string; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" title={title} onClick={onClick}
    className={`h-9 w-9 flex items-center justify-center border-2 border-[#121212] cursor-pointer transition-colors ${active ? 'bg-[#121212] text-white' : 'bg-white text-[#121212] hover:bg-[#FAF9F5]'}`}>
    {children}
  </button>;
}

function DiceRoller({ onRoll, busy }: { onRoll: (sides: number, count: number, note: string) => void; busy: boolean }) {
  const [sides, setSides] = useState(20);
  const [count, setCount] = useState(1);
  const [note, setNote] = useState('');
  return <div className="border-2 border-[#121212] bg-[#FAF9F5] p-2.5">
    <div className="flex items-center gap-1.5 mb-2 text-xs font-black text-[#121212]"><Dices size={15} />掷骰子</div>
    <div className="flex flex-wrap gap-1 mb-2">
      {[4, 6, 8, 10, 12, 20, 100].map((s) => <button key={s} type="button" onClick={() => setSides(s)}
        className={`px-2 py-0.5 text-[11px] font-bold border-2 border-[#121212] cursor-pointer ${sides === s ? 'bg-[#D62828] text-white' : 'bg-white text-[#121212]'}`}>d{s}</button>)}
    </div>
    <div className="flex items-center gap-2 mb-2">
      <span className="text-[11px] font-bold text-[#555]">数量</span>
      <button type="button" onClick={() => setCount((c) => Math.max(1, c - 1))} className="h-6 w-6 flex items-center justify-center border-2 border-[#121212] bg-white cursor-pointer"><Minus size={12} /></button>
      <span className="text-sm font-black w-5 text-center">{count}</span>
      <button type="button" onClick={() => setCount((c) => Math.min(20, c + 1))} className="h-6 w-6 flex items-center justify-center border-2 border-[#121212] bg-white cursor-pointer"><Plus size={12} /></button>
    </div>
    <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="备注（可选，如：侦查）"
      className="bauhaus-input w-full px-2 py-1 text-[11px] mb-2" />
    <button type="button" disabled={busy} onClick={() => onRoll(sides, count, note)}
      className="w-full bauhaus-btn bg-[#F4A261] text-[#121212] py-1.5 text-xs font-black disabled:opacity-50">掷 {count}d{sides}</button>
  </div>;
}

export const TableWhiteboardView: React.FC<{ currentUser: UserProfile | null; onNeedLogin: () => void }> = ({ currentUser, onNeedLogin }) => {
  const [rooms, setRooms] = useState<TableRoom[]>([]);
  const [roomId, setRoomId] = useState<string>(() => new URLSearchParams(window.location.search).get('room') || '');
  const [room, setRoom] = useState<TableRoom | null>(null);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const [tool, setTool] = useState<Tool>('pen');
  const [color, setColor] = useState(COLORS[0]);
  const [size, setSize] = useState(3);
  const [scale, setScale] = useState(1);
  const [elements, setElements] = useState<WbElement[]>([]);
  const [draft, setDraft] = useState<WbElement | null>(null);
  const [version, setVersion] = useState(0);
  const [messages, setMessages] = useState<TableMessage[]>([]);
  const [chatText, setChatText] = useState('');
  const [sending, setSending] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [panel, setPanel] = useState<'chat' | 'dice'>('chat');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [canvasReady, setCanvasReady] = useState(0);
  const bindCanvas = useCallback((node: HTMLCanvasElement | null) => {
    canvasRef.current = node;
    if (node) setCanvasReady((n) => n + 1);
  }, []);
  const imgCache = useRef(new Map<string, HTMLImageElement>());
  const drawing = useRef(false);
  const versionRef = useRef(0);
  const elementsRef = useRef<WbElement[]>([]);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<number | null>(null);
  const lastMsgRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  versionRef.current = version; elementsRef.current = elements;

  const reloadRooms = useCallback(async () => {
    try { const d = await api.tableRooms(); setRooms(d.rooms); } catch (e) { setError((e as Error).message); }
  }, []);

  useEffect(() => { if (!currentUser) return; void reloadRooms(); }, [currentUser, reloadRooms]);
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get('room') || '';
    setRoomId(r);
    if (r) void enterRoom(r);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const enterRoom = async (rid: string) => {
    setLoading(true); setError(''); setRoomId(rid);
    try {
      const snap = await api.tableRoom(rid);
      setRoom(snap.room); setElements(snap.scene.elements as WbElement[]); setVersion(snap.scene.version);
      setMessages(snap.messages); lastMsgRef.current = snap.messages.length ? snap.messages[snap.messages.length - 1].createdAt : '';
      const u = new URL(window.location.href); u.searchParams.set('view', 'table'); u.searchParams.set('room', rid);
      window.history.replaceState({}, '', u.toString());
    } catch (e) { setError((e as Error).message); setRoom(null); }
    finally { setLoading(false); }
  };

  const leaveRoom = () => {
    setRoom(null); setRoomId(''); setElements([]); setMessages([]); setDraft(null);
    const u = new URL(window.location.href); u.searchParams.delete('room'); u.searchParams.set('view', 'table');
    window.history.replaceState({}, '', u.toString());
    void reloadRooms();
  };

  const createRoom = async () => {
    if (!currentUser) return onNeedLogin();
    setLoading(true); setError('');
    try { const d = await api.createTableRoom(newName.trim()); setNewName(''); await enterRoom(d.room.id); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  };

  // 轮询：消息增量 + 场景版本比对（本地有未保存编辑时不覆盖）。
  useEffect(() => {
    if (!roomId || !room) return;
    let alive = true;
    const poll = async () => {
      try {
        const snap = await api.tableRoom(roomId, lastMsgRef.current || undefined);
        if (!alive) return;
        if (snap.messages.length) {
          setMessages((prev) => {
            const known = new Set(prev.map((m) => m.id));
            const add = snap.messages.filter((m) => !known.has(m.id));
            return add.length ? [...prev, ...add].slice(-300) : prev;
          });
          lastMsgRef.current = snap.messages[snap.messages.length - 1].createdAt;
        }
        if (snap.scene.version > versionRef.current && !dirtyRef.current) {
          setElements(snap.scene.elements as WbElement[]); setVersion(snap.scene.version);
        }
      } catch { /* 轮询失败静默，下轮重试 */ }
    };
    const timer = window.setInterval(() => void poll(), 1600);
    return () => { alive = false; window.clearInterval(timer); };
  }, [roomId, room]);

  const scheduleSave = useCallback((els: WbElement[]) => {
    dirtyRef.current = true;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    saveTimer.current = window.setTimeout(async () => {
      try {
        const res = await api.saveTableScene(roomId, els, versionRef.current);
        if (res.conflict) {
          const snap = await api.tableRoom(roomId);
          setElements(snap.scene.elements as WbElement[]); setVersion(snap.scene.version);
        } else setVersion(res.version);
        dirtyRef.current = false;
      } catch { dirtyRef.current = false; }
    }, 700);
  }, [roomId]);

  const redraw = useCallback(() => {
    const canvas = (canvasRef.current || document.getElementById('wb-canvas')) as HTMLCanvasElement | null;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = WORLD_W * scale * dpr; canvas.height = WORLD_H * scale * dpr;
    canvas.style.width = `${WORLD_W * scale}px`; canvas.style.height = `${WORLD_H * scale}px`;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, 0, 0);
    ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, WORLD_W, WORLD_H);
    ctx.fillStyle = '#E9E7E0';
    for (let x = 40; x < WORLD_W; x += 40) for (let y = 40; y < WORLD_H; y += 40) ctx.fillRect(x, y, 1.5, 1.5);
    [...elements, ...(draft ? [draft] : [])].forEach((el) => drawElement(ctx, el, imgCache.current, () => redraw()));
  }, [elements, draft, scale]);
  // canvas 挂载会通过回调 ref 更新 canvasReady，据此触发首次绘制；之后随内容变化重绘。
  useLayoutEffect(() => { if (room && canvasReady) redraw(); }, [redraw, room, canvasReady]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const pointOf = (e: React.PointerEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / scale, y: (e.clientY - rect.top) / scale };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!currentUser || tool === 'select' || tool === 'image') return;
    const p = pointOf(e);
    (e.target as Element).setPointerCapture(e.pointerId);
    if (tool === 'eraser') {
      const next = elements.filter((el) => !hitTest(el, p.x, p.y));
      if (next.length !== elements.length) { setElements(next); scheduleSave(next); }
      return;
    }
    if (tool === 'text') {
      const t = window.prompt('输入文字（支持换行）：', '');
      if (t) { const next = [...elements, { id: uid(), type: 'text' as const, x: p.x, y: p.y, text: t, color, size: 5 }]; setElements(next); scheduleSave(next); }
      return;
    }
    drawing.current = true;
    setDraft({ id: uid(), type: tool, x: p.x, y: p.y, x2: p.x, y2: p.y, w: 0, h: 0, points: tool === 'pen' ? [0, 0] : undefined, color, size });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawing.current || !draft) return;
    const p = pointOf(e);
    setDraft((d) => {
      if (!d) return d;
      if (d.type === 'pen') return { ...d, points: [...(d.points || []), p.x - d.x, p.y - d.y] };
      if (d.type === 'line' || d.type === 'arrow') return { ...d, x2: p.x, y2: p.y };
      return { ...d, w: p.x - d.x, h: p.y - d.y };
    });
  };
  const onPointerUp = () => {
    if (!drawing.current || !draft) return;
    drawing.current = false;
    const done = { ...draft };
    const tooSmall = (done.type === 'line' || done.type === 'arrow') && Math.hypot((done.x2 ?? done.x) - done.x, (done.y2 ?? done.y) - done.y) < 4;
    const tinyShape = (done.type === 'rect' || done.type === 'ellipse') && Math.abs(done.w ?? 0) < 4 && Math.abs(done.h ?? 0) < 4;
    setDraft(null);
    if (tooSmall || tinyShape) return;
    const next = [...elements, done]; setElements(next); scheduleSave(next);
  };

  const addImage = async (file: File, cx?: number, cy?: number) => {
    if (!file.type.startsWith('image/')) { setError('只能上传图片文件'); return; }
    if (file.size > 8 * 1024 * 1024) { setError('图片不能超过 8MB'); return; }
    setImgBusy(true); setError('');
    try {
      const up = await api.upload(file);
      const next = [...elements, { id: uid(), type: 'image' as const, x: cx ?? WORLD_W / 2 - 150, y: cy ?? WORLD_H / 2 - 110, w: 300, h: 220, src: up.imageUrl, color, size }];
      setElements(next); scheduleSave(next);
    } catch (e) { setError((e as Error).message); }
    finally { setImgBusy(false); }
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect(); if (!rect) return;
    const x = (e.clientX - rect.left) / scale, y = (e.clientY - rect.top) / scale;
    Array.from(e.dataTransfer.files).forEach((f) => void addImage(f, x, y));
  };

  const sendChat = async () => {
    const text = chatText.trim(); if (!text || sending) return;
    setSending(true);
    try { const d = await api.sendTableMessage(roomId, 'chat', { text }); setMessages((p) => [...p, d.message]); setChatText(''); }
    catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  };
  const rollDice = async (sides: number, count: number, note: string) => {
    if (sending) return;
    setSending(true);
    const dice = Array.from({ length: count }, () => ({ sides, value: 1 + Math.floor(Math.random() * sides) }));
    try { const d = await api.sendTableMessage(roomId, 'dice', { dice, note }); setMessages((p) => [...p, d.message]); setPanel('chat'); }
    catch (e) { setError((e as Error).message); }
    finally { setSending(false); }
  };
  const copyLink = async () => {
    const link = `${window.location.origin}/?view=table&room=${roomId}`;
    try { await navigator.clipboard.writeText(link); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setError('复制失败，请手动复制地址栏链接'); }
  };
  const clearBoard = () => {
    if (!window.confirm('确定清空整张画布吗？此操作会同步给房间内所有人。')) return;
    const next: WbElement[] = []; setElements(next); scheduleSave(next);
  };
  const disband = async () => {
    if (!window.confirm('确定解散这个房间吗？画布和聊天记录都会删除，不可恢复。')) return;
    try { await api.deleteTableRoom(roomId); leaveRoom(); } catch (e) { setError((e as Error).message); }
  };

  const diceMessages = useMemo(() => messages.filter((m) => m.kind === 'dice'), [messages]);

  if (!currentUser) return <div className="max-w-[1100px] mx-auto px-4 py-16 text-center">
    <h2 className="text-xl font-black text-[#121212]">联机白板需要登录</h2>
    <p className="mt-2 text-sm text-[#666]">登录后即可创建房间、邀请同伴一起画图聊天。</p>
  </div>;

  if (!room) return <div className="max-w-[1100px] mx-auto px-4 py-8">
    <div className="flex items-center justify-between mb-5">
      <div><h2 className="text-2xl font-black text-[#121212]">联机白板</h2><p className="text-xs text-[#666] mt-1">共用画布 · 拖拽上传图片 · 掷骰子 · 实时聊天</p></div>
    </div>
    {error && <div className="mb-4 border-2 border-[#D62828] bg-[#FFF0F0] text-[#D62828] px-3 py-2 text-xs font-bold">{error}</div>}
    <div className="flex gap-2 mb-6">
      <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void createRoom(); }}
        placeholder="输入房间名，例如：周三跑团" className="bauhaus-input flex-1 px-3 py-2 text-sm" />
      <button type="button" disabled={loading} onClick={() => void createRoom()} className="bauhaus-btn bg-[#004E98] text-white px-5 py-2 text-sm font-black disabled:opacity-50">新建房间</button>
    </div>
    <h3 className="text-sm font-black text-[#121212] mb-2 flex items-center gap-1.5"><Users size={15} />我的房间</h3>
    {rooms.length === 0 ? <div className="border-2 border-dashed border-[#CCC] bg-[#FAF9F5] px-4 py-10 text-center text-sm text-[#888]">还没有房间，点上面新建一个吧</div> : (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {rooms.map((r) => <button key={r.id} type="button" onClick={() => void enterRoom(r.id)} className="text-left border-2 border-[#121212] bg-white shadow-[3px_3px_0px_#121212] p-3 hover:bg-[#FAF9F5] cursor-pointer">
          <div className="font-black text-sm text-[#121212] truncate">{r.name}</div>
          <div className="text-[11px] text-[#777] mt-1">活跃：{new Date(r.lastActiveAt).toLocaleString('zh-CN')}</div>
          <div className="text-[11px] text-[#999] mt-0.5">房主：{r.ownerQq === currentUser?.qq ? '我' : '其他成员'}</div>
        </button>)}
      </div>
    )}
    <div className="mt-6 border-2 border-[#121212] bg-[#FAF9F5] p-4">
      <div className="text-xs font-black text-[#121212] mb-2 flex items-center gap-1.5"><Link2 size={14} />加入别人的房间</div>
      <div className="flex gap-2">
        <input value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="粘贴好友分享的房间链接或 ID"
          className="bauhaus-input flex-1 px-3 py-2 text-sm" />
        <button type="button" disabled={loading || !roomId.trim()} onClick={() => void enterRoom(roomId.trim().split('room=').pop() || roomId.trim())} className="bauhaus-btn px-4 py-2 text-sm font-black disabled:opacity-50">加入</button>
      </div>
    </div>
  </div>;

  return <div className="max-w-[1760px] mx-auto px-3 sm:px-5 py-4">
    {error && <div className="mb-3 border-2 border-[#D62828] bg-[#FFF0F0] text-[#D62828] px-3 py-2 text-xs font-bold flex items-center justify-between"><span>{error}</span><button type="button" onClick={() => setError('')}><X size={14} /></button></div>}
    <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
      <div className="flex items-center gap-2">
        <button type="button" onClick={leaveRoom} className="bauhaus-btn h-9 w-9 flex items-center justify-center" title="返回房间列表"><ChevronLeft size={18} /></button>
        <div><h2 className="text-base font-black text-[#121212] leading-tight">{room.name}</h2><div className="text-[11px] text-[#777]">画布 {elements.length} 个元素 · 自动同步</div></div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => void copyLink()} className="bauhaus-btn h-9 px-3 text-xs font-bold flex items-center gap-1.5"><Copy size={14} />{copied ? '已复制' : '邀请同伴'}</button>
        <button type="button" onClick={clearBoard} className="bauhaus-btn h-9 px-3 text-xs font-bold flex items-center gap-1.5"><RotateCcw size={14} />清空画布</button>
        {room.ownerQq === currentUser?.qq && <button type="button" onClick={() => void disband()} className="h-9 px-3 text-xs font-bold border-2 border-[#D62828] text-[#D62828] bg-white cursor-pointer flex items-center gap-1.5"><Trash2 size={14} />解散</button>}
      </div>
    </div>

    <div className="flex gap-3 items-start">
      <div className="flex flex-col gap-1.5 shrink-0">
        <ToolButton active={tool === 'select'} title="选择" onClick={() => setTool('select')}><MousePointer2 size={16} /></ToolButton>
        <ToolButton active={tool === 'pen'} title="画笔" onClick={() => setTool('pen')}><Brush size={16} /></ToolButton>
        <ToolButton active={tool === 'line'} title="直线" onClick={() => setTool('line')}><Minus size={16} /></ToolButton>
        <ToolButton active={tool === 'arrow'} title="箭头" onClick={() => setTool('arrow')}><ArrowRight size={16} /></ToolButton>
        <ToolButton active={tool === 'rect'} title="矩形" onClick={() => setTool('rect')}><Square size={16} /></ToolButton>
        <ToolButton active={tool === 'ellipse'} title="椭圆" onClick={() => setTool('ellipse')}><Circle size={16} /></ToolButton>
        <ToolButton active={tool === 'text'} title="文字" onClick={() => setTool('text')}><Type size={16} /></ToolButton>
        <ToolButton active={tool === 'image'} title="上传图片（也可直接拖进画布）" onClick={() => fileInputRef.current?.click()}><ImageIcon size={16} /></ToolButton>
        <ToolButton active={tool === 'eraser'} title="橡皮擦" onClick={() => setTool('eraser')}><Eraser size={16} /></ToolButton>
        <div className="h-2" />
        <ToolButton title="放大" onClick={() => setScale((s) => Math.min(2, +(s + 0.1).toFixed(2)))}><Plus size={16} /></ToolButton>
        <div className="text-center text-[10px] font-bold text-[#555]">{Math.round(scale * 100)}%</div>
        <ToolButton title="缩小" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.1).toFixed(2)))}><Minus size={16} /></ToolButton>
      </div>

      <div className="flex flex-col gap-2 shrink-0 border-2 border-[#121212] bg-[#FAF9F5] p-2">
        <div className="text-[10px] font-black text-[#555]">颜色</div>
        {COLORS.map((c) => <button key={c} type="button" title={c} onClick={() => setColor(c)} className={`h-6 w-6 border-2 cursor-pointer ${color === c ? 'border-[#121212] shadow-[2px_2px_0px_#121212]' : 'border-[#BBB]'}`} style={{ background: c }} />)}
        <div className="text-[10px] font-black text-[#555] mt-1">粗细</div>
        {[2, 4, 7].map((s) => <button key={s} type="button" onClick={() => setSize(s)} className={`h-6 w-6 flex items-center justify-center border-2 cursor-pointer ${size === s ? 'bg-[#121212]' : 'bg-white'}`}><span className="rounded-full" style={{ width: s + 2, height: s + 2, background: size === s ? '#fff' : '#121212' }} /></button>)}
      </div>

      <div className="flex-1 min-w-0 border-2 border-[#121212] overflow-auto bg-white" style={{ maxHeight: 'calc(100vh - 220px)' }}
        onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
        <canvas id="wb-canvas" ref={bindCanvas} className="block touch-none"
          style={{ cursor: tool === 'eraser' ? 'cell' : tool === 'select' || tool === 'image' ? 'default' : 'crosshair' }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} />
      </div>

      <div className="w-[300px] shrink-0 border-2 border-[#121212] bg-[#FAF9F5] flex flex-col" style={{ height: 'calc(100vh - 220px)', minHeight: 480 }}>
        <div className="flex border-b-2 border-[#121212]">
          <button type="button" onClick={() => setPanel('chat')} className={`flex-1 py-2 text-xs font-black cursor-pointer ${panel === 'chat' ? 'bg-[#121212] text-white' : 'bg-white text-[#121212]'}`}>聊天</button>
          <button type="button" onClick={() => setPanel('dice')} className={`flex-1 py-2 text-xs font-black cursor-pointer ${panel === 'dice' ? 'bg-[#121212] text-white' : 'bg-white text-[#121212]'}`}>骰子</button>
        </div>
        {panel === 'dice' && <div className="p-2.5"><DiceRoller onRoll={rollDice} busy={sending} />
          <div className="mt-3 text-[11px] font-bold text-[#666] mb-1">本房骰子记录（{diceMessages.length}）</div>
          <div className="max-h-40 overflow-auto space-y-1">
            {diceMessages.slice(-20).reverse().map((m) => <div key={m.id} className="text-[11px] bg-white border border-[#DDD] px-2 py-1">
              <b>{m.author}</b> {m.payload.dice?.map((d) => `d${d.sides}=${d.value}`).join(' ')}
              {m.payload.note ? ` · ${m.payload.note}` : ''}
            </div>)}
          </div>
        </div>}
        <div className={`flex-1 overflow-auto p-2.5 space-y-2 ${panel === 'dice' ? 'hidden' : ''}`}>
          {messages.length === 0 && <div className="text-center text-[11px] text-[#999] py-8">还没有消息，来打个招呼吧</div>}
          {messages.map((m) => m.kind === 'dice' ? (
            <div key={m.id} className="border-2 border-[#F4A261] bg-[#FFF7EC] px-2 py-1.5">
              <div className="text-[10px] text-[#8A5A00] font-bold">{m.author} 掷骰 {m.payload.note ? `· ${m.payload.note}` : ''}</div>
              <div className="flex flex-wrap gap-1 mt-1">
                {m.payload.dice?.map((d, i) => <span key={i} className="inline-block border-2 border-[#BA7517] bg-white px-2 py-0.5 text-sm font-black text-[#854F0B]">d{d.sides} {d.value}</span>)}
              </div>
            </div>
          ) : (
            <div key={m.id} className="text-xs">
              <div className="font-bold text-[#004E98] flex items-center gap-1">
                {m.avatar && <img src={m.avatar} alt="" className="h-4 w-4 rounded-full object-cover" />}{m.author}
              </div>
              <div className="whitespace-pre-wrap break-words text-[#222] mt-0.5">{m.payload.text}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        <div className={`border-t-2 border-[#121212] p-2 flex gap-1.5 ${panel === 'dice' ? 'hidden' : ''}`}>
          <input value={chatText} onChange={(e) => setChatText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendChat(); } }}
            placeholder="输入消息…" className="bauhaus-input flex-1 min-w-0 px-2 py-1.5 text-xs" />
          <button type="button" disabled={sending || !chatText.trim()} onClick={() => void sendChat()} className="bauhaus-btn h-8 w-9 flex items-center justify-center disabled:opacity-50"><Send size={14} /></button>
        </div>
      </div>
    </div>
    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void addImage(f); e.target.value = ''; }} />
    {imgBusy && <div className="fixed bottom-5 right-5 bg-[#121212] text-white px-4 py-2 text-xs font-bold flex items-center gap-2 z-50"><LoaderCircle size={14} className="animate-spin" />图片上传中…</div>}
  </div>;
};
