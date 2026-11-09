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

/** 贴纸右下角的收藏星：空心＝未加入库存，金黄实心＝已在库存。 */
function StarMark({ filled }: { filled: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="h-3.5 w-3.5"
      fill={filled ? '#FFC531' : 'none'}
      stroke="#121212"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2.6 15.1 8.9 22 9.9 17 14.8 18.2 21.5 12 18.2 5.8 21.5 7 14.8 2 9.9 8.9 8.9Z" />
    </svg>
  );
}

/**
 * 贴纸广场：独立页面（由「我的贴纸」右上角按钮弹出）。
 * 只按昵称展示其他会员的昵称与头像，不下发、不显示任何 QQ 号。
 * 图片右下角的星标即「加入库存」：空心可点，加入后变黄心；库存满时先选一张替换。
 * 只复制图片引用到自己的库存，不改原作者库存、不自动默认佩戴、不影响已发团。
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
    const list = members.filter((member) => !q || member.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => sort === 'popular'
      ? (totalCopies(b) - totalCopies(a)) || (b.count - a.count) || a.name.localeCompare(b.name)
      : (b.createdAt || '').localeCompare(a.createdAt || '') || a.name.localeCompare(b.name));
  }, [members, query, sort]);
  const totalStickers = members.reduce((sum, member) => sum + member.stickers.length, 0);

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
    <div className="p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] font-bold leading-relaxed text-[#666]">
          {members.length ? `${members.length} 位会员 · ${totalStickers} 张贴纸 · ` : ''}
          点图片右下角 ☆ 加入我的库存，★ 表示已拥有。
        </p>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#888]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="按昵称搜索"
              className="bauhaus-input w-[150px] py-1.5 pl-7 pr-2 text-xs"
            />
          </div>
          <select
            value={sort}
            onChange={(event) => setSort(event.target.value as 'recent' | 'popular')}
            className="bauhaus-input py-1.5 text-xs"
            aria-label="贴纸广场排序"
          >
            <option value="recent">最新加入</option>
            <option value="popular">最多被收藏</option>
          </select>
        </div>
      </div>

      {!isMember && <p className="border-2 border-dashed border-[#121212] bg-[#FAF9F5] px-3 py-3 text-xs font-bold text-[#666]">贴纸广场为会员专享，开通后即可浏览并加入其他会员的贴纸。</p>}
      {isMember && loading && <p className="flex items-center gap-2 py-4 text-xs font-bold text-[#666]"><Loader2 className="h-4 w-4 animate-spin" />正在加载贴纸广场…</p>}
      {isMember && error && <p className="border-2 border-[#D62828] bg-[#FAF0F0] px-3 py-2 text-xs font-bold text-[#D62828]">{error} <button type="button" onClick={() => { setLoading(true); void load(); }} className="underline cursor-pointer">重试</button></p>}

      {isMember && !loading && !error && (
        <>
          {pendingKey && (
            <div className="mb-4 border-2 border-[#D62828] bg-[#FAF0F0] p-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-black leading-relaxed text-[#D62828]">库存已满 {library.length}/{STICKER_LIBRARY_LIMIT} 张，请选择要替换掉的一张</h4>
                <button type="button" onClick={() => setPendingKey(null)} className="flex shrink-0 items-center gap-0.5 text-[11px] font-bold text-[#D62828] underline cursor-pointer"><X className="h-3 w-3" />取消</button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
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
                    <span className="absolute inset-0 flex items-center justify-center bg-[#121212]/75 text-[11px] font-black text-white">替换这张</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filtered.length === 0 && <p className="border-2 border-dashed border-[#121212] bg-[#FAF9F5] px-3 py-4 text-center text-xs font-bold text-[#666]">{members.length ? '没有匹配的会员，换个昵称试试' : '暂时还没有其他会员公开贴纸'}</p>}

          <div className="space-y-3">
            {filtered.map((member) => (
              <section key={member.id} className="border-2 border-[#121212] bg-white">
                <header className="flex items-center gap-2.5 border-b-2 border-[#121212] bg-[#FAF9F5] px-3 py-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden border-2 border-[#121212] bg-[#004E98] text-xs font-black text-white">
                    {member.avatar ? <img src={member.avatar} alt="" className="h-full w-full object-cover" /> : member.name.slice(0, 1)}
                  </span>
                  <strong className="truncate text-sm">{member.name}</strong>
                  <span className="ml-auto shrink-0 text-[11px] font-bold text-[#004E98]">{member.count} 张库存</span>
                </header>
                <div className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-3 lg:grid-cols-5">
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
                          onClick={() => clickAdd(sticker.key)}
                          className="absolute bottom-1 right-1 z-10 flex h-6 w-6 items-center justify-center border-2 border-[#121212] bg-white cursor-pointer hover:bg-[#FFF7DE]"
                          title={owned ? '已在我的库存' : full ? '库存已满，选择要替换的一张' : '加入我的库存'}
                          aria-label={owned ? '已在我的库存' : full ? '库存已满，选择要替换的一张' : '加入我的库存'}
                          aria-pressed={owned}
                        >
                          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin text-[#004E98]" /> : <StarMark filled={owned} />}
                        </button>
                        {canModerate && (
                          <button
                            type="button"
                            onClick={() => void toggleBlock(sticker.key, false)}
                            className="absolute right-1 top-1 z-10 flex h-6 w-6 items-center justify-center border-2 border-[#121212] bg-white text-[#D62828] cursor-pointer hover:bg-[#D62828] hover:text-white"
                            title="下架这张贴纸（仅站主/管理员）"
                            aria-label="下架这张贴纸"
                          >
                            <ShieldAlert className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {sticker.copies > 0 && <span className="absolute left-1 top-1 bg-[#121212]/75 px-1.5 text-[10px] font-bold text-white">被收藏 {sticker.copies}</span>}
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {canModerate && blocked.length > 0 && (
            <div className="mt-4 border-2 border-dashed border-[#888] bg-[#FAF9F5] p-3">
              <p className="text-[11px] font-bold text-[#666]">已下架 {blocked.length} 张（只在广场隐藏，已发团引用的图片不受影响）</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {blocked.map((key) => (
                  <button key={key} type="button" onClick={() => void toggleBlock(key, true)} className="border border-[#121212] bg-white px-2 py-1 text-[11px] font-bold cursor-pointer hover:bg-[#E1ECFA]">撤销 · {key.slice(-8)}</button>
                ))}
              </div>
            </div>
          )}

          {note && <p className="mt-3 border-2 border-[#004E98] bg-[#F0F5FA] px-2.5 py-1.5 text-[11px] font-bold text-[#004E98]">{note}</p>}
        </>
      )}
    </div>
  );
}
