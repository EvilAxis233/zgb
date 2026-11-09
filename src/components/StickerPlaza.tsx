import { useEffect, useMemo, useState } from 'react';
import { Loader2, Search, ShieldAlert, X } from 'lucide-react';
import type { StickerPlazaMember, UserProfile } from '../types';
import { api } from '../services/api';
import { ImageHoverPreview } from './ImageHoverPreview';
import { useDialog } from './BauhausDialog';
import { STICKER_LIBRARY_LIMIT } from './StickerLibrary';

interface Props {
  isMember: boolean;
  library: string[];
  onUserUpdate: (user: UserProfile) => void;
}

/**
 * 贴纸广场：在「我的贴纸库」弹窗里展示其他会员公开的贴纸，点「加入我的库存」
 * 只复制图片引用到自己的库存，不改原作者库存、不自动默认佩戴、不影响已发团。
 * 库存满 10 张时先选一张自己的贴纸来替换；站主/管理员可下架违规贴纸。
 */
export function StickerPlaza({ isMember, library, onUserUpdate }: Props) {
  const { showAlert } = useDialog();
  const [members, setMembers] = useState<StickerPlazaMember[]>([]);
  const [blocked, setBlocked] = useState<string[]>([]);
  const [canModerate, setCanModerate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<'recent' | 'popular'>('recent');
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState('');
  const [note, setNote] = useState('');
  const full = library.length >= STICKER_LIBRARY_LIMIT;

  const load = async () => {
    try {
      const data = await api.stickerPlaza();
      setMembers(data.members || []);
      setBlocked(data.blocked || []);
      setCanModerate(!!data.canModerate);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isMember) void load();
    else setLoading(false);
    // 只在会员身份变化时重新拉取；加入/下架后会显式调用 load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMember]);

  const totalCopies = (member: StickerPlazaMember) => member.stickers.reduce((sum, item) => sum + item.copies, 0);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = members.filter((member) => !q || member.name.toLowerCase().includes(q) || member.qq.includes(q));
    return [...list].sort((a, b) => sort === 'popular'
      ? (totalCopies(b) - totalCopies(a)) || (b.count - a.count) || a.name.localeCompare(b.name)
      : (b.createdAt || '').localeCompare(a.createdAt || '') || a.name.localeCompare(b.name));
  }, [members, query, sort]);

  const add = async (key: string, replaceKey?: string) => {
    if (busyKey) return;
    setBusyKey(key);
    setNote('');
    try {
      const result = await api.stickerPlazaCopy(key, replaceKey);
      onUserUpdate(result.user);
      setNote(result.note || '已加入我的库存');
      setPendingKey(null);
      await load();
    } catch (e) {
      const message = e instanceof Error ? e.message : '请稍后重试';
      if (message.includes('已满')) setPendingKey(key);
      showAlert({ title: '加入失败', message, type: 'danger' });
    } finally {
      setBusyKey('');
    }
  };

  const clickAdd = (key: string) => {
    if (library.includes(key) || busyKey) return;
    if (full) { setPendingKey(key); setNote(''); return; }
    void add(key);
  };

  const toggleBlock = async (key: string, undo: boolean) => {
    try {
      if (undo) await api.stickerPlazaUnblock(key);
      else await api.stickerPlazaBlock(key);
      setNote(undo ? '已撤销下架' : '已下架该贴纸，广场不再展示（已发团不受影响）');
      await load();
    } catch (e) {
      showAlert({ title: '操作失败', message: e instanceof Error ? e.message : '请稍后重试', type: 'danger' });
    }
  };

  return (
    <section className="mt-4 border-t-2 border-dashed border-[#D8D5CC] pt-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-black text-[#121212]">贴纸广场 · 其他会员的库存</h3>
        <div className="flex items-center gap-1.5">
          <div className="relative">
            <Search className="pointer-events-none absolute left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#888]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="按昵称 / QQ 搜索"
              className="bauhaus-input w-[132px] py-1 pl-6 pr-1.5 text-[11px]"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as 'recent' | 'popular')}
            className="bauhaus-input py-1 text-[11px]"
            aria-label="贴纸广场排序"
          >
            <option value="recent">最新加入</option>
            <option value="popular">最多被收藏</option>
          </select>
        </div>
      </div>

      {!isMember && <p className="border-2 border-dashed border-[#121212] bg-[#FAF9F5] px-3 py-2 text-[11px] font-bold text-[#666]">贴纸广场为会员专享，开通后即可浏览并加入其他会员的贴纸。</p>}
      {isMember && loading && <p className="flex items-center gap-2 py-3 text-[11px] font-bold text-[#666]"><Loader2 className="h-3.5 w-3.5 animate-spin" />正在加载贴纸广场…</p>}
      {isMember && error && <p className="border-2 border-[#D62828] bg-[#FAF0F0] px-2.5 py-2 text-[11px] font-bold text-[#D62828]">{error} <button type="button" onClick={() => { setLoading(true); void load(); }} className="underline cursor-pointer">重试</button></p>}

      {isMember && !loading && !error && (
        <>
          {pendingKey && (
            <div className="mb-3 border-2 border-[#D62828] bg-[#FAF0F0] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-[11px] font-black leading-relaxed text-[#D62828]">库存已满 {library.length}/{STICKER_LIBRARY_LIMIT} 张，请选择要替换掉的一张</h4>
                <button type="button" onClick={() => setPendingKey(null)} className="flex shrink-0 items-center gap-0.5 text-[10px] font-bold text-[#D62828] underline cursor-pointer"><X className="h-3 w-3" />取消</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {library.map((key) => (
                  <button
                    key={key}
                    type="button"
                    disabled={!!busyKey}
                    onClick={() => void add(pendingKey, key)}
                    className="relative aspect-[7/2] overflow-hidden rounded border-2 border-[#D62828] bg-white cursor-pointer disabled:opacity-60"
                    title="用这张替换"
                  >
                    <img src={`/api/images/${key}`} alt="我的贴纸" className="absolute inset-0 h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-[#121212]/75 text-[10px] font-black text-white">替换这张</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && <p className="border-2 border-dashed border-[#121212] bg-[#FAF9F5] px-3 py-3 text-center text-[11px] font-bold text-[#666]">{members.length ? '没有匹配的会员，换个关键词试试' : '暂时还没有其他会员公开贴纸'}</p>}

          <div className="space-y-2.5">
            {filtered.map((member) => (
              <section key={`${member.qq}-${member.name}`} className="border-2 border-[#121212] bg-white">
                <header className="flex items-center gap-2 border-b-2 border-[#121212] bg-[#FAF9F5] px-2.5 py-1.5">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden border border-[#121212] bg-[#004E98] text-[11px] font-black text-white">
                    {member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : member.name.slice(0, 1)}
                  </span>
                  <strong className="truncate text-xs">{member.name}</strong>
                  <span className="shrink-0 text-[10px] font-bold text-[#888]">QQ {member.qq}</span>
                  <span className="ml-auto shrink-0 text-[10px] font-bold text-[#004E98]">{member.count} 张库存</span>
                </header>
                <div className="grid grid-cols-2 gap-2 p-2 sm:grid-cols-3">
                  {member.stickers.map((sticker) => {
                    const owned = library.includes(sticker.key);
                    const busy = busyKey === sticker.key;
                    return (
                      <div key={sticker.key} className="relative min-w-0">
                        <ImageHoverPreview src={`/api/images/${sticker.key}`} label="贴纸原图" className="relative block aspect-[7/2] w-full overflow-hidden rounded border-2 border-[#121212] bg-white">
                          <img src={`/api/images/${sticker.key}`} alt="贴纸" className="absolute inset-0 h-full w-full object-cover" />
                        </ImageHoverPreview>
                        <button
                          type="button"
                          disabled={owned || !!busyKey}
                          onClick={() => clickAdd(sticker.key)}
                          className={`mt-1 flex min-h-[32px] w-full items-center justify-center gap-1 px-1 text-center text-[10px] font-black cursor-pointer disabled:cursor-not-allowed ${owned ? 'border border-[#BBB] bg-[#F2F0E8] text-[#888]' : full ? 'border border-[#D62828] bg-[#FAF0F0] text-[#D62828] hover:bg-[#FBE0E0]' : 'border border-[#004E98] bg-[#F0F5FA] text-[#004E98] hover:bg-[#E1ECFA]'}`}
                        >
                          {busy ? <><Loader2 className="h-3 w-3 animate-spin" />加入中…</> : owned ? '已在库中' : full ? '库存已满 · 选替换' : '加入我的库存'}
                        </button>
                        {canModerate && (
                          <button
                            type="button"
                            onClick={() => void toggleBlock(sticker.key, false)}
                            className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center border border-[#121212] bg-white text-[#D62828] cursor-pointer hover:bg-[#D62828] hover:text-white"
                            title="下架这张贴纸（仅站主/管理员）"
                            aria-label="下架这张贴纸"
                          >
                            <ShieldAlert className="h-3 w-3" />
                          </button>
                        )}
                        {sticker.copies > 0 && <span className="absolute left-0 top-0 bg-[#121212]/75 px-1 text-[9px] font-bold text-white">被收藏 {sticker.copies}</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {canModerate && blocked.length > 0 && (
            <div className="mt-3 border-2 border-dashed border-[#888] bg-[#FAF9F5] p-2">
              <p className="text-[10px] font-bold text-[#666]">已下架 {blocked.length} 张（只在广场隐藏，已发团引用的图片不受影响）</p>
              <div className="mt-1 flex flex-wrap gap-1">
                {blocked.map((key) => (
                  <button key={key} type="button" onClick={() => void toggleBlock(key, true)} className="border border-[#121212] bg-white px-1.5 py-0.5 text-[10px] font-bold cursor-pointer hover:bg-[#E1ECFA]">撤销 · {key.slice(-8)}</button>
                ))}
              </div>
            </div>
          )}

          <p className="mt-2 text-[10px] leading-relaxed text-[#666]">
            展示其他会员公开的长条贴纸；点击「加入我的库存」只复制一份引用到自己的库存，不会改动对方库存，也不会自动默认佩戴。库存最多 {STICKER_LIBRARY_LIMIT} 张，满了需自己选一张替换；已发布的团不受影响。鼠标停在贴纸上 1 秒可看原图。
          </p>
          {note && <p className="mt-1.5 border border-[#004E98] bg-[#F0F5FA] px-2 py-1 text-[10px] font-bold text-[#004E98]">{note}</p>}
        </>
      )}
    </section>
  );
}
