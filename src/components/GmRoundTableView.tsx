import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, Bold, BookOpen, ChevronDown, ChevronRight, Clock3, Eye, Flame, Heading2, ImagePlus, Italic,
  Link2, List, MessageSquare, Pencil, Plus, Quote, Search, Send, Star, ThumbsUp, X, Flag, Trash2,
} from 'lucide-react';
import { api, adminApi, type RoundtableReply, type RoundtableTopic, type RoundtableResourceRef } from '../services/api';
import { NameplateBadge } from './NameplateBadge';
import { MarkdownView } from './MarkdownView';
import { RoundtableTopicForm, type TopicFormValue } from './RoundtableTopicForm';
import { splitContentAttrs } from '../utils/contentAttr';

/** 基础 markdown 工具栏：在 textarea 光标处插入对应语法。 */
const MdToolbar: React.FC<{ onInsert: (before: string, after?: string) => void }> = ({ onInsert }) => (
  <div className="flex flex-wrap items-center gap-1 border-b-2 border-[#555] bg-[#242426] px-2 py-1.5">
    <button type="button" title="加粗" aria-label="加粗" onClick={() => onInsert('**', '**')} className="flex h-7 w-7 items-center justify-center text-[#C9C9C9] hover:bg-[#343437] hover:text-white"><Bold className="h-4 w-4" /></button>
    <button type="button" title="斜体" aria-label="斜体" onClick={() => onInsert('*', '*')} className="flex h-7 w-7 items-center justify-center text-[#C9C9C9] hover:bg-[#343437] hover:text-white"><Italic className="h-4 w-4" /></button>
    <button type="button" title="标题" aria-label="标题" onClick={() => onInsert('## ')} className="flex h-7 w-7 items-center justify-center text-[#C9C9C9] hover:bg-[#343437] hover:text-white"><Heading2 className="h-4 w-4" /></button>
    <button type="button" title="列表" aria-label="列表" onClick={() => onInsert('- ')} className="flex h-7 w-7 items-center justify-center text-[#C9C9C9] hover:bg-[#343437] hover:text-white"><List className="h-4 w-4" /></button>
    <button type="button" title="引用" aria-label="引用" onClick={() => onInsert('> ')} className="flex h-7 w-7 items-center justify-center text-[#C9C9C9] hover:bg-[#343437] hover:text-white"><Quote className="h-4 w-4" /></button>
    <button type="button" title="链接" aria-label="链接" onClick={() => onInsert('[', '](https://)')} className="flex h-7 w-7 items-center justify-center text-[#C9C9C9] hover:bg-[#343437] hover:text-white"><Link2 className="h-4 w-4" /></button>
    <span className="ml-1 text-[10px] text-[#777]">支持 Markdown：加粗 / 斜体 / 标题 / 列表 / 引用 / 链接</span>
  </div>
);

/**
 * GM 圆桌（真实持久化版）：
 * - 规则页 / 主题 / 回复全部来自后端 D1，刷新不丢、访客可见；后台「内容审核 · 圆桌审核」统一管理。
 * - 主题详情只显示主题（无正文文字段）；回复可点赞、嵌套回复、举报与图片（≤2M，默认折叠）。
 * - 首排热度最高四个主题（对齐 4 列）不再显示「热门」标签，且同样出现在下方「全部主题」里；综合分页固定排第一。
 * - 申请主题与后台新建共用 RoundtableTopicForm；回复显示真实头像/铭牌，可编辑并显示编辑时间。
 */

type SortMode = 'heat' | 'latestReply' | 'latestTopic';
const SORT_LABEL: Record<SortMode, string> = {
  heat: '热度最高', latestReply: '最新回复', latestTopic: '最新主题',
};
const countReplies = (replies: RoundtableReply[]): number =>
  replies.reduce((sum, r) => sum + 1 + countReplies(r.children || []), 0);
const heatOf = (t: RoundtableTopic) => t.views + t.likes * 8 + countReplies(t.replies) * 12;

type Props = {
  currentUserQq?: string | null;
  isAdmin?: boolean;
  /** 举报入口：复用全站举报模板弹窗，传入被举报回复的作者昵称用于预填 */
  onReport?: (author: string) => void;
};

export const GmRoundTableView: React.FC<Props> = ({ currentUserQq, isAdmin = false, onReport }) => {
  const [loading, setLoading] = useState(true);
  const [channels, setChannels] = useState<Array<{ id: string; label: string }>>([]);
  const [topics, setTopics] = useState<RoundtableTopic[]>([]);
  const [channel, setChannel] = useState('all');
  const [sort, setSort] = useState<SortMode>('latestReply');
  const [replySort, setReplySort] = useState<'likes' | 'latest'>('likes');
  const [openTopic, setOpenTopic] = useState<RoundtableTopic | null>(null);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [channelBump, setChannelBump] = useState<Record<string, number>>({});
  const [likedTopics, setLikedTopics] = useState<Record<string, boolean>>({});
  // 规则页签：单行展示，超出折叠到「更多」下拉
  const [visibleTabCount, setVisibleTabCount] = useState(99);
  const [moreOpen, setMoreOpen] = useState(false);
  const tabsAreaRef = useRef<HTMLDivElement>(null);
  const tabsMeasureRef = useRef<HTMLDivElement>(null);

  // 我的圆桌：收藏、我参与过讨论的主题（我的回复）、未读数
  const [favorites, setFavorites] = useState<Record<string, boolean>>({});
  const [followIds, setFollowIds] = useState<Record<string, boolean>>({});
  const [unreadFav, setUnreadFav] = useState<Record<string, number>>({});
  const [unreadReply, setUnreadReply] = useState<Record<string, number>>({});
  const [mineView, setMineView] = useState<'reply' | 'fav' | null>(null);

  // 申请主题表单（与后台新建共用组件）
  const [applyOpen, setApplyOpen] = useState(false);

  // 回复：拖拽上传 + 折叠
  const [replyText, setReplyText] = useState('');
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [imagesOpen, setImagesOpen] = useState<Record<string, boolean>>({});
  // 二次（楼中楼）回复默认折叠，点「查看回复(n)」展开。
  const [childrenOpen, setChildrenOpen] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const replyTextRef = useRef<HTMLTextAreaElement>(null);

  // 回复编辑
  const [editReplyId, setEditReplyId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editImages, setEditImages] = useState<string[]>([]);
  const editFileRef = useRef<HTMLInputElement>(null);
  const editTextRef = useRef<HTMLTextAreaElement>(null);

  // 嵌套回复（楼中楼）：记录正在回复的父回复 id 与草稿。
  const [nestedTo, setNestedTo] = useState<string | null>(null);
  const [nestedText, setNestedText] = useState('');
  const [nestedImages, setNestedImages] = useState<string[]>([]);
  const nestedFileRef = useRef<HTMLInputElement>(null);
  const nestedTextRef = useRef<HTMLTextAreaElement>(null);
  const resetNested = () => { setNestedTo(null); setNestedText(''); setNestedImages([]); };

  // 在指定 textarea 光标处插入 markdown 语法
  const insertMd = (ref: React.RefObject<HTMLTextAreaElement>, val: string, setter: (v: string) => void) =>
    (before: string, after: string = '') => {
      const el = ref.current;
      if (!el) return;
      const start = el.selectionStart, end = el.selectionEnd;
      const selected = val.slice(start, end);
      const next = val.slice(0, start) + before + selected + after + val.slice(end);
      setter(next);
      window.requestAnimationFrame(() => {
        el.focus();
        const pos = start + before.length + selected.length;
        el.setSelectionRange(pos, pos);
      });
    };

  // 提示条：固定浮在视口顶部，避免弹窗打开时提示被渲染在页面顶端而看不到。
  const noticeTimer = useRef<number | null>(null);
  const flash = useCallback((msg: string) => {
    setNotice(msg);
    if (noticeTimer.current) window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(''), 3200);
  }, []);
  useEffect(() => () => { if (noticeTimer.current) window.clearTimeout(noticeTimer.current); }, []);

  const load = useCallback(async (keepTopicId?: string) => {
    try {
      const data = await api.roundtable();
      setChannels(data.channels || []);
      setTopics(data.topics || []);
      setChannel((prev) => prev === 'all' || (data.channels || []).some((c) => c.id === prev) ? prev : 'all');
      if (keepTopicId) {
        const fresh = (data.topics || []).find((t) => t.id === keepTopicId);
        if (fresh) setOpenTopic(fresh);
      }
    } catch (e) {
      flash(e instanceof Error ? e.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, [flash]);

  useEffect(() => { void load(); }, [load]);

  // 拉取「我的收藏 / 我的回复 / 未读数」：仅登录用户；未登录时保持空态。
  const loadMine = useCallback(async () => {
    if (!currentUserQq) { setFavorites({}); setFollowIds({}); setUnreadFav({}); setUnreadReply({}); return; }
    try {
      const data = await api.roundtableMine();
      setFavorites(Object.fromEntries((data.favorites || []).map((id) => [id, true])));
      setFollowIds(Object.fromEntries((data.follows || []).map((id) => [id, true])));
      setUnreadFav(data.unreadFav || {});
      setUnreadReply(data.unreadReply || {});
    } catch { /* 忽略：不影响主题浏览 */ }
  }, [currentUserQq]);
  useEffect(() => { void loadMine(); }, [loadMine]);

  const filtered = useMemo(() => topics.filter((t) => {
    if (channel !== 'all' && t.channelId !== channel) return false;
    const q = query.trim().toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !t.tags.some((tag) => tag.toLowerCase().includes(q)) && !(t.contentAttr || '').toLowerCase().includes(q)) return false;
    return true;
  }), [topics, channel, query]);

  // 规则页签：综合永远固定第一，其余按该分类主题热度降序；有新回复的分类置顶。
  const orderedChannels = useMemo(() => {
    const baseHeat = (cid: string) => topics.filter((t) => t.channelId === cid).reduce((s, t) => s + heatOf(t), 0);
    const rest = channels.slice().sort((a, b) => {
      const ba = channelBump[a.id] || 0, bb = channelBump[b.id] || 0;
      if (ba !== bb) return bb - ba;
      return baseHeat(b.id) - baseHeat(a.id);
    });
    return [{ id: 'all', label: '综合' }, ...rest];
  }, [channels, topics, channelBump]);

  // 测量规则页签实际宽度，决定一行能放下几个；多余的收进「更多」。
  useLayoutEffect(() => {
    const area = tabsAreaRef.current;
    const measure = tabsMeasureRef.current;
    if (!area || !measure) return;
    const recalc = () => {
      const avail = area.clientWidth;
      const chips = Array.from(measure.children) as HTMLElement[];
      const widths = chips.map((c) => c.getBoundingClientRect().width);
      if (!widths.length) { setVisibleTabCount(0); return; }
      const moreW = 42; // 「更多」按钮预留宽度
      const total = widths.reduce((s, w) => s + w, 0);
      if (total <= avail) { setVisibleTabCount(widths.length); return; }
      let used = 0, count = 0;
      for (let i = 0; i < widths.length; i += 1) {
        if (used + widths[i] + moreW <= avail) { used += widths[i]; count += 1; } else break;
      }
      setVisibleTabCount(Math.max(1, count));
    };
    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(area);
    return () => ro.disconnect();
  }, [orderedChannels]);

  // 置顶的规则讨论贴固定在各规则分页最前；「综合」里不收纳置顶贴。
  // 同样不参与热度/时间排序，也不进热度首排。
  const pinnedTopics = useMemo(
    () => channel === 'all' ? [] : filtered.filter((t) => t.isPinned),
    [filtered, channel],
  );
  const sorted = useMemo(() => filtered.filter((t) => !t.isPinned).sort((a, b) => {
    if (sort === 'heat') return heatOf(b) - heatOf(a);
    if (sort === 'latestTopic') return b.createdTs - a.createdTs;
    return b.lastReplyTs - a.lastReplyTs;
  }), [filtered, sort]);

  // 热度最高 4 个（对齐 4 列），只在首排额外展示；下方「全部主题」仍完整包含它们，不再剔除。
  const featured = useMemo(
    () => filtered.filter((t) => !t.isPinned).slice().sort((a, b) => heatOf(b) - heatOf(a)).slice(0, 4),
    [filtered],
  );
  const rest = [...pinnedTopics, ...sorted];

  const sortedReplies = useMemo(() => {
    if (!openTopic) return [];
    return openTopic.replies.slice().sort((a, b) => replySort === 'likes'
      ? b.likes - a.likes : b.time.localeCompare(a.time));
  }, [openTopic, replySort]);

  const applyChannel = (cid: string) => { setChannel(cid); setOpenTopic(null); setMineView(null); };
  const openMine = (kind: 'reply' | 'fav') => { setMineView(kind); setOpenTopic(null); };

  const submitApply = async (v: TopicFormValue) => {
    try {
      await api.roundtableApply({
        name: v.name, tags: v.tags, resources: v.resources,
        origin: v.origin, ruleVersion: v.ruleVersion, contentAttr: v.contentAttr,
        channelId: v.channelId === '__new__' ? '' : v.channelId,
        createNew: v.channelId === '__new__',
        newChannelName: v.channelId === '__new__' ? v.newChannelName : '',
      });
      setApplyOpen(false);
      flash('主题申请已提交，等待管理员审核');
      void load();
    } catch (e) { flash(e instanceof Error ? e.message : '提交失败'); }
  };

  const addImageFiles = (files: File[], target: 'reply' | 'edit' | 'nested') => {
    let added = 0;
    const current = target === 'reply' ? replyImages.length : target === 'edit' ? editImages.length : nestedImages.length;
    files.filter((f) => f.type.startsWith('image/')).forEach((f) => {
      if (f.size > 2 * 1024 * 1024) { flash(`图片「${f.name}」超过 2M，已跳过`); return; }
      if (current + added >= 4) { flash('最多上传 4 张图片'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const data = String(reader.result);
        if (target === 'reply') setReplyImages((prev) => [...prev, data].slice(0, 4));
        else if (target === 'edit') setEditImages((prev) => [...prev, data].slice(0, 4));
        else setNestedImages((prev) => [...prev, data].slice(0, 4));
      };
      reader.readAsDataURL(f);
      added += 1;
    });
  };
  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImageFiles(Array.from(e.target.files || []), 'reply');
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addImageFiles(Array.from(e.dataTransfer.files || []), 'reply');
  };

  const sendReply = async (parentId?: string) => {
    const content = parentId ? nestedText.trim() : replyText.trim();
    const images = parentId ? nestedImages : replyImages;
    if (!content && images.length === 0) { flash('请输入讨论内容或上传图片'); return; }
    if (!openTopic) return;
    try {
      const tid = openTopic.id;
      await api.roundtableReply(tid, { content, images, parentId });
      if (parentId) { resetNested(); }
      else { setReplyText(''); setReplyImages([]); }
      setChannelBump((prev) => ({ ...prev, [openTopic.channelId]: Date.now() }));
      flash('回复已发布');
      await load(tid);
      // 发过回复即进入「我的回复」，立即刷新侧栏数据
      void loadMine();
    } catch (e) { flash(e instanceof Error ? e.message : '回复失败'); }
  };

  const startEdit = (r: RoundtableReply) => {
    setEditReplyId(r.id);
    setEditText(r.content || '');
    setEditImages(r.images || []);
  };
  const cancelEdit = () => { setEditReplyId(null); setEditText(''); setEditImages([]); };
  const saveEdit = async () => {
    if (!openTopic || !editReplyId) return;
    if (!editText.trim() && editImages.length === 0) { flash('请输入讨论内容或上传图片'); return; }
    try {
      await api.roundtableEditReply(openTopic.id, editReplyId, { content: editText.trim(), images: editImages });
      flash('回复已编辑');
      cancelEdit();
      await load(openTopic.id);
    } catch (e) { flash(e instanceof Error ? e.message : '编辑失败'); }
  };
  const canEdit = (r: RoundtableReply) => isAdmin || (!!currentUserQq && !!r.userQq && String(r.userQq) === String(currentUserQq));
  const deleteReply = async (r: RoundtableReply) => {
    if (!openTopic) return;
    const childCount = countReplies(r.children || []);
    const tip = childCount > 0 ? `确定删除这条回复？其下 ${childCount} 条楼中楼回复也会一并删除，且无法恢复。` : '确定删除这条回复？删除后无法恢复。';
    if (!window.confirm(tip)) return;
    try {
      const result = await api.roundtableDeleteReply(openTopic.id, r.id);
      if (editReplyId === r.id) cancelEdit();
      if (nestedTo === r.id) resetNested();
      flash(result.deleted > 1 ? `回复已删除（含 ${result.deleted - 1} 条子回复）` : '回复已删除');
      await load(openTopic.id);
    } catch (e) { flash(e instanceof Error ? e.message : '删除失败'); }
  };

  // 浏览数同步：列表卡片与详情页共用同一份数字，避免两边不一致。
  const patchViews = (topicId: string, views: number) => {
    const n = Math.max(0, Number(views) || 0);
    setTopics((prev) => prev.map((x) => x.id === topicId ? { ...x, views: n } : x));
    setOpenTopic((prev) => prev && prev.id === topicId ? { ...prev, views: n } : prev);
  };

  const openDetail = (t: RoundtableTopic) => {
    setOpenTopic(t);
    setReplyText(''); setReplyImages([]);
    resetNested(); cancelEdit();
    // 打开即视为已读：清掉「我的回复 / 我的收藏」里这个主题的新动态提醒
    setUnreadFav((prev) => { const n = { ...prev }; delete n[t.id]; return n; });
    setUnreadReply((prev) => { const n = { ...prev }; delete n[t.id]; return n; });
    if (currentUserQq) api.roundtableSeen(t.id).catch(() => {});
    // 记一次浏览（卡片/详情左下角那个「眼睛」就是浏览次数）：
    // 同一标签页内同一主题只计一次，避免反复开关把数字刷高；本地先 +1 让数字立刻变，再用服务端返回值校正。
    const viewKey = `rt-view:${t.id}`;
    let viewed = false;
    try { viewed = sessionStorage.getItem(viewKey) === '1'; } catch { /* 隐私模式取不到就按未看过处理 */ }
    if (!viewed) {
      try { sessionStorage.setItem(viewKey, '1'); } catch { /* 忽略 */ }
      patchViews(t.id, (t.views || 0) + 1);
      api.roundtableView(t.id).then((r) => patchViews(t.id, r.views)).catch(() => { /* 计数失败不影响浏览 */ });
    }
  };
  const backToList = () => { setOpenTopic(null); resetNested(); cancelEdit(); void load(); };

  // 点赞：列表卡片与详情标题旁的点赞共用此入口，状态实时同步。
  // 计数直接维护在 topics / openTopic 上，展示时不再额外 +1，避免重复计数。
  const toggleLike = async (t: RoundtableTopic) => {
    const next = !likedTopics[t.id];
    const delta = next ? 1 : -1;
    setLikedTopics((prev) => ({ ...prev, [t.id]: next }));
    setTopics((prev) => prev.map((x) => x.id === t.id ? { ...x, likes: Math.max(0, x.likes + delta) } : x));
    setOpenTopic((prev) => prev && prev.id === t.id ? { ...prev, likes: Math.max(0, prev.likes + delta) } : prev);
    try { await api.roundtableLike(t.id, delta as 1 | -1); } catch { /* 忽略 */ }
  };

  // 收藏 / 取消收藏：卡片与详情共用，计数同步。
  const toggleFav = async (t: RoundtableTopic) => {
    if (!currentUserQq) { flash('登录后才能收藏主题'); return; }
    const next = !favorites[t.id];
    const bump = (n?: number) => Math.max(0, Number(n || 0) + (next ? 1 : -1));
    setFavorites((prev) => ({ ...prev, [t.id]: next }));
    setTopics((prev) => prev.map((x) => x.id === t.id ? { ...x, favCount: bump(x.favCount) } : x));
    setOpenTopic((prev) => prev && prev.id === t.id ? { ...prev, favCount: bump(prev.favCount) } : prev);
    try {
      const r = await api.roundtableFav(t.id, next);
      setTopics((prev) => prev.map((x) => x.id === t.id ? { ...x, favCount: r.favCount } : x));
      setOpenTopic((prev) => prev && prev.id === t.id ? { ...prev, favCount: r.favCount } : prev);
      flash(next ? '已收藏主题' : '已取消收藏');
      void loadMine();
    } catch (e) {
      setFavorites((prev) => ({ ...prev, [t.id]: !next }));
      flash(e instanceof Error ? e.message : '操作失败');
    }
  };

  // 我在该主题下的最后一条回复（用于「我的回复」列表摘要）
  const myLastReply = (t: RoundtableTopic): RoundtableReply | null => {
    if (!currentUserQq) return null;
    const flat: RoundtableReply[] = [];
    const walk = (list: RoundtableReply[]) => list.forEach((r) => { flat.push(r); walk(r.children || []); });
    walk(t.replies);
    const mine = flat.filter((r) => r.userQq && String(r.userQq) === String(currentUserQq)).sort((a, b) => b.time.localeCompare(a.time));
    return mine[0] || null;
  };
  const plainText = (s: string) => (s || '').replace(/[#*`>_~]/g, '').replace(/\s+/g, ' ').trim();
  const fmtTs = (ts: number) => {
    if (!ts) return '';
    const d = new Date(ts);
    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const totalUnreadReply = Object.values(unreadReply).reduce((a, b) => a + b, 0);
  const totalUnreadFav = Object.values(unreadFav).reduce((a, b) => a + b, 0);
  const myReplyTopics = useMemo(
    () => topics.filter((t) => followIds[t.id]).sort((a, b) => (unreadReply[b.id] || 0) - (unreadReply[a.id] || 0) || b.lastReplyTs - a.lastReplyTs),
    [topics, followIds, unreadReply],
  );
  const myFavTopics = useMemo(
    () => topics.filter((t) => favorites[t.id]).sort((a, b) => b.lastReplyTs - a.lastReplyTs),
    [topics, favorites],
  );

  // 举报：与首页/个人档案的「举报」共用同一套模板弹窗，作者昵称自动填入，提交后直接进后台工单。
  const reportBtn = (author: string) => (
    <button type="button" onClick={() => { if (onReport) onReport(author); else flash(`已举报 ${author}`); }} className="flex items-center gap-1 text-[11px] text-[#8A8A8A] hover:text-[#D62828]">
      <Flag className="h-3 w-3" />举报
    </button>
  );

  const renderImages = (images: string[], key: string) => {
    const opened = !!imagesOpen[key];
    return (
      <div className="mt-2">
        <button type="button" onClick={() => setImagesOpen((prev) => ({ ...prev, [key]: !opened }))} className="flex items-center gap-1 text-xs font-bold text-[#7FC7FF] hover:underline">
          <ImagePlus className="h-3.5 w-3.5" />{opened ? '收起图片' : `查看图片（${images.length} 张）`}
        </button>
        {opened && (
          <div className="mt-2 flex flex-wrap gap-2">
            {images.map((src, i) => <img key={i} src={src} alt="回复图片" className="h-24 w-24 cursor-zoom-in border border-[#555] object-cover" onClick={() => window.open(src, '_blank')} />)}
          </div>
        )}
      </div>
    );
  };

  const renderReply = (r: RoundtableReply, nested = false) => (
    <div key={r.id} className={nested ? 'bg-[#343437] px-3 py-2.5' : 'border-b border-[#3A3A3A] py-4'}>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className={`shrink-0 overflow-hidden flex items-center justify-center border border-[#555] font-black text-white ${nested ? 'h-6 w-6 text-[10px]' : 'h-8 w-8 text-[11px]'}`} style={{ backgroundColor: r.avatarUrl ? undefined : r.color }}>
          {r.avatarUrl ? <img src={r.avatarUrl} alt="" className="h-full w-full object-cover bg-white" /> : r.avatar}
        </span>
        <span className="font-bold" style={{ color: r.color }}>{r.author}</span>
        {r.nameplate && <NameplateBadge nameplate={r.nameplate} />}
        <span className="text-[#8A8A8A]">{r.time}</span>
        {r.editedAt && <span className="text-[10px] text-[#8A8A8A]">（最新编辑：{r.editedAt}）</span>}
        <button type="button" onClick={() => flash('已点赞（仅前端演示）')} className="ml-auto flex items-center gap-1 text-[#9A9A9A] hover:text-[#8BC34A]"><ThumbsUp className="h-3.5 w-3.5" />{r.likes}</button>
      </div>
      {editReplyId === r.id ? (
        <div className="mt-2">
          {editImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {editImages.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="编辑图片" className="h-16 w-16 border border-[#555] object-cover" />
                  <button type="button" aria-label="移除图片" onClick={() => setEditImages(editImages.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#121212] bg-[#D62828] text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="border-2 border-[#555] bg-[#2B2B2D] focus-within:border-[#8BC34A]">
            <MdToolbar onInsert={insertMd(editTextRef, editText, setEditText)} />
            <textarea ref={editTextRef} value={editText} onChange={(e) => setEditText(e.target.value)} rows={6}
              className="min-h-[150px] w-full resize-y bg-transparent p-3 text-sm leading-relaxed text-white outline-none placeholder:text-[#777]" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input ref={editFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImageFiles(Array.from(e.target.files || []), 'edit'); e.target.value = ''; }} />
              <button type="button" aria-label="上传图片" title="点击上传图片（单张 ≤ 2M，最多 4 张）" onClick={() => editFileRef.current?.click()}
                className="flex items-center gap-1 border-2 border-[#555] px-2 py-1 text-xs font-bold text-[#9A9A9A] hover:border-[#8BC34A] hover:text-[#8BC34A]"><ImagePlus className="h-4 w-4" />图片</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={cancelEdit} className="border border-[#555] px-3 py-1 text-xs font-bold text-[#C9C9C9] hover:border-[#999]">取消</button>
              <button type="button" onClick={() => void saveEdit()} className="bg-[#8BC34A] px-3 py-1 text-xs font-black text-[#1B2B0B] hover:bg-[#9CD455]">保存编辑</button>
            </div>
          </div>
        </div>
      ) : (
        <>
          {r.content && <div className={nested ? 'mt-1.5 text-sm' : 'mt-2 text-sm'}><MarkdownView content={r.content} dark /></div>}
          {!!r.images?.length && renderImages(r.images, r.id)}
        </>
      )}
      {!!r.children?.length && (
        <div className="mt-2">
          <button type="button" onClick={() => setChildrenOpen((prev) => ({ ...prev, [r.id]: !prev[r.id] }))}
            className="flex items-center gap-1 text-xs font-bold text-[#7FC7FF] hover:underline">
            {childrenOpen[r.id] ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            {childrenOpen[r.id] ? '收起回复' : `查看回复（${countReplies(r.children || [])}）`}
          </button>
          {childrenOpen[r.id] && (
            <div className="mt-2 space-y-2 border-l-2 border-[#555] pl-3">
              {r.children.map((c) => renderReply(c, true))}
            </div>
          )}
        </div>
      )}
      {editReplyId !== r.id && (
        <div className="mt-2 flex gap-3">
          <button type="button" onClick={() => { setNestedTo((prev) => prev === r.id ? null : r.id); setNestedText(''); setNestedImages([]); }}
            className="flex items-center gap-1 text-xs font-bold text-[#7FC7FF] hover:underline"><MessageSquare className="h-3.5 w-3.5" />{nestedTo === r.id ? '收起回复' : '回复'}</button>
          {canEdit(r) && <button type="button" onClick={() => { resetNested(); startEdit(r); }} className="flex items-center gap-1 text-xs font-bold text-[#F4A261] hover:underline"><Pencil className="h-3 w-3" />编辑</button>}
          {canEdit(r) && <button type="button" onClick={() => void deleteReply(r)} className="flex items-center gap-1 text-xs font-bold text-[#E57373] hover:underline"><Trash2 className="h-3 w-3" />删除</button>}
          {reportBtn(r.author)}
        </div>
      )}
      {/* 楼中楼回复窗口：真实提交，parentId 指向当前回复。 */}
      {nestedTo === r.id && editReplyId !== r.id && (
        <div className="mt-3 border-2 border-[#555] bg-[#2B2B2D] p-2.5">
          <div className="mb-2 text-[11px] font-bold text-[#9A9A9A]">回复 @{r.author}</div>
          {nestedImages.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2">
              {nestedImages.map((src, i) => (
                <div key={i} className="relative">
                  <img src={src} alt="回复图片" className="h-16 w-16 border border-[#555] object-cover" />
                  <button type="button" aria-label="移除图片" onClick={() => setNestedImages(nestedImages.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#121212] bg-[#D62828] text-white"><X className="h-3 w-3" /></button>
                </div>
              ))}
            </div>
          )}
          <div className="border-2 border-[#555] bg-[#242426] focus-within:border-[#8BC34A]">
            <MdToolbar onInsert={insertMd(nestedTextRef, nestedText, setNestedText)} />
            <textarea ref={nestedTextRef} value={nestedText} onChange={(e) => setNestedText(e.target.value)}
              placeholder="写下你的回复，支持 Markdown…" rows={4}
              className="min-h-[100px] w-full resize-y bg-transparent p-2.5 text-sm leading-relaxed text-white outline-none placeholder:text-[#777]" />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <input ref={nestedFileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImageFiles(Array.from(e.target.files || []), 'nested'); e.target.value = ''; }} />
              <button type="button" aria-label="上传图片" title="点击上传图片（单张 ≤ 2M，最多 4 张）" onClick={() => nestedFileRef.current?.click()}
                className="flex items-center gap-1 border-2 border-[#555] px-2 py-1 text-xs font-bold text-[#9A9A9A] hover:border-[#8BC34A] hover:text-[#8BC34A]"><ImagePlus className="h-4 w-4" />图片</button>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={resetNested} className="border border-[#555] px-3 py-1 text-xs font-bold text-[#C9C9C9] hover:border-[#999]">取消</button>
              <button type="button" onClick={() => void sendReply(r.id)} className="flex items-center gap-1 bg-[#8BC34A] px-3 py-1 text-xs font-black text-[#1B2B0B] hover:bg-[#9CD455]"><Send className="h-3.5 w-3.5" />发送回复</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const TopicCard = ({ t, newCount = 0 }: { t: RoundtableTopic; newCount?: number }) => {
    const liked = !!likedTopics[t.id];
    const favorited = !!favorites[t.id];
    return (
      <div className="relative flex h-full flex-col border border-[#3A3A3A] bg-[#2E2E30] p-4 transition-colors hover:border-[#8BC34A] hover:bg-[#343437]">
        <button type="button" onClick={() => void openDetail(t)} className="flex flex-1 flex-col text-left">
          {t.isPinned && <span className="mb-1.5 inline-block w-fit bg-[#D62828] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">置顶</span>}
          {newCount > 0 && <span className="mb-1.5 inline-block w-fit bg-[#D62828] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">新 {newCount}</span>}
          <h3 className="line-clamp-2 text-sm font-black leading-snug text-white">{t.title}</h3>
          <div className="mt-1.5 text-[11px] text-[#8A8A8A]">发布时间：{t.time}</div>
          {!!t.ruleVersion && <div className="mt-1 text-[10px] text-[#8A8A8A]">规则版本：{t.ruleVersion}</div>}
          {!!t.resources?.length && <div className="mt-1.5 flex items-center gap-1 text-[10px] text-[#7FC7FF]"><Link2 className="h-3 w-3" />引用 {t.resources.length} 个爱心资源</div>}
          {(!!t.origin || !!t.contentAttr || t.tags.length > 0) && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {!!t.origin && <span className="border border-[#F4A261] bg-[#F4A261]/15 px-1.5 py-0.5 text-[10px] font-black text-[#F4A261]">{t.origin}</span>}
              {!!t.contentAttr && splitContentAttrs(t.contentAttr).map((attr) => <span key={attr} className="border border-[#176B57] bg-[#176B57]/15 px-1.5 py-0.5 text-[10px] font-black text-[#7FC7A6]">{attr}</span>)}
              {t.tags.map((tag) => <span key={tag} className="border border-[#555] px-1.5 py-0.5 text-[10px] font-bold text-[#BDBDBD]">{tag}</span>)}
            </div>
          )}
        </button>
        <div className="mt-auto flex items-center gap-3 pt-3 text-[11px] text-[#9A9A9A]">
          <span className="flex items-center gap-1" title="浏览次数"><Eye className="h-3 w-3" />{t.views}</span>
          <span className="flex items-center gap-1" title="回复数"><MessageSquare className="h-3 w-3" />{countReplies(t.replies)}</span>
          <div className="ml-auto flex items-center gap-2.5">
            <button type="button" aria-label={`${favorited ? '取消收藏' : '收藏'} ${t.title}`} title={favorited ? '取消收藏' : '收藏主题'} onClick={() => void toggleFav(t)}
              className={`flex items-center gap-1 font-black transition-colors ${favorited ? 'text-[#E9C46A]' : 'hover:text-[#E9C46A]'}`}>
              <Star className="h-3 w-3" fill={favorited ? 'currentColor' : 'none'} />{t.favCount || 0}
            </button>
            <button type="button" aria-label={`点赞 ${t.title}`} onClick={() => void toggleLike(t)}
              className={`flex items-center gap-1 font-black transition-colors ${liked ? 'text-[#8BC34A]' : 'hover:text-[#8BC34A]'}`}>
              <ThumbsUp className="h-3 w-3" />{t.likes}
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 去掉热门标签：不在 featured 上透传 hot。
  return (
    <div className="gm-roundtable w-full">
      {notice && createPortal(
        <div className="pointer-events-none fixed inset-x-0 top-3 z-[90] flex justify-center px-3" role="alert" aria-live="assertive">
          <div className="pointer-events-auto max-w-md cursor-pointer border-2 border-[#121212] bg-[#F4A261] px-4 py-2.5 text-center text-sm font-black leading-relaxed text-[#121212] shadow-[4px_4px_0px_#121212]" onClick={() => setNotice('')}>{notice}</div>
        </div>,
        document.body,
      )}

      <div className="overflow-hidden border-2 border-[#3A3A3A] bg-[#2B2B2D] text-[#E8E8E8] shadow-[6px_6px_0px_#121212]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#3A3A3A] bg-[#242426] px-4 py-3">
          <BookOpen className="h-5 w-5 shrink-0 text-[#8BC34A]" />
          <h2 className="text-lg font-black tracking-wide sm:text-xl">
            {openTopic ? (
              <button type="button" onClick={backToList} title="回到 GM 圆桌主页" className="cursor-pointer text-left text-lg font-black tracking-wide transition-colors hover:text-[#8BC34A] sm:text-xl">GM圆桌</button>
            ) : 'GM圆桌'}
          </h2>
          <span className="border-l-2 border-[#8BC34A] pl-3 text-xs font-black leading-relaxed text-[#F4A261] sm:text-sm">仅限于GM的严肃会谈，玩家请谨慎踏入！诸诸研讨规则与模组相关内容，分享带团经验和灵感，回复请遵守公序良俗。</span>
        </div>

        {loading ? (
          <div className="px-4 py-16 text-center text-sm text-[#9A9A9A]">正在加载圆桌…</div>
        ) : !openTopic ? (
          <>
            {/* 规则检索（输入 + 下拉）+ 分类分页（综合固定第一，单行超出折叠） */}
            <div className="border-b border-[#3A3A3A] px-3 py-3 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 border border-[#555] bg-[#242426] px-2 py-1.5 focus-within:border-[#8BC34A]">
                  <Search className="h-3.5 w-3.5 shrink-0 text-[#9A9A9A]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="规则检索"
                    className="w-24 bg-transparent text-xs text-white outline-none placeholder:text-[#777] sm:w-32" />
                  <select value={channel} onChange={(e) => applyChannel(e.target.value)}
                    className="border-l border-[#555] bg-transparent pl-1.5 text-xs text-[#C9C9C9] outline-none">
                    {orderedChannels.map((c) => <option key={c.id} value={c.id} className="bg-[#242426]">{c.label}</option>)}
                  </select>
                </div>
                {/* 规则页签容器：单行、隐藏溢出，「更多」下拉收纳剩余 */}
                <div ref={tabsAreaRef} className="relative flex min-w-0 flex-1 items-center gap-0.5">
                  {orderedChannels.slice(0, visibleTabCount).map((c) => (
                    <button key={c.id} type="button" onClick={() => applyChannel(c.id)}
                      className={`shrink-0 whitespace-nowrap border-b-2 px-2.5 py-1.5 text-sm font-black transition-colors ${channel === c.id && !mineView ? 'border-[#8BC34A] text-white' : 'border-transparent text-[#9A9A9A] hover:text-white'}`}>
                      {c.label}
                    </button>
                  ))}
                  {visibleTabCount < orderedChannels.length && (
                    <div className="relative shrink-0">
                      <button type="button" onClick={() => setMoreOpen((v) => !v)}
                        className={`flex items-center gap-0.5 whitespace-nowrap border-b-2 px-2 py-1.5 text-sm font-black transition-colors ${moreOpen ? 'border-[#8BC34A] text-white' : 'border-transparent text-[#9A9A9A] hover:text-white'}`}>
                        更多<ChevronDown className="h-3.5 w-3.5" />
                      </button>
                      {moreOpen && (
                        <>
                          <div className="fixed inset-0 z-30" onClick={() => setMoreOpen(false)} />
                          <div className="absolute left-0 top-full z-40 mt-1 min-w-[8rem] border border-[#555] bg-[#242426] py-1 shadow-xl">
                            {orderedChannels.slice(visibleTabCount).map((c) => (
                              <button key={c.id} type="button" onClick={() => { applyChannel(c.id); setMoreOpen(false); }}
                                className={`block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm font-bold transition-colors hover:bg-[#343437] ${channel === c.id && !mineView ? 'text-[#8BC34A]' : 'text-[#C9C9C9] hover:text-white'}`}>
                                {c.label}
                              </button>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                  {/* 隐藏测量层：与页签同款样式，用于量出每个标签实际宽度 */}
                  <div ref={tabsMeasureRef} aria-hidden className="pointer-events-none invisible absolute left-0 top-0 flex gap-0.5 whitespace-nowrap">
                    {orderedChannels.map((c) => (
                      <span key={c.id} className="shrink-0 border-b-2 px-2.5 py-1.5 text-sm font-black">{c.label}</span>
                    ))}
                  </div>
                </div>
                <span className="mx-0.5 h-4 w-px shrink-0 bg-[#3A3A3A]" />
                <button type="button" onClick={() => openMine('reply')}
                  className={`flex items-center gap-1 border-b-2 px-2.5 py-1.5 text-sm font-black transition-colors ${mineView === 'reply' ? 'border-[#8BC34A] text-white' : 'border-transparent text-[#9A9A9A] hover:text-white'}`}>
                  <MessageSquare className="h-3.5 w-3.5" />我的回复
                  {totalUnreadReply > 0 && <span className="ml-0.5 bg-[#D62828] px-1 py-0.5 text-[10px] font-black leading-none text-white">{totalUnreadReply}</span>}
                </button>
                <button type="button" onClick={() => openMine('fav')}
                  className={`flex items-center gap-1 border-b-2 px-2.5 py-1.5 text-sm font-black transition-colors ${mineView === 'fav' ? 'border-[#8BC34A] text-white' : 'border-transparent text-[#9A9A9A] hover:text-white'}`}>
                  <Star className="h-3.5 w-3.5" fill={mineView === 'fav' ? 'currentColor' : 'none'} />我的收藏
                  {totalUnreadFav > 0 && <span className="ml-0.5 bg-[#D62828] px-1 py-0.5 text-[10px] font-black leading-none text-white">{totalUnreadFav}</span>}
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} title="主题排序"
                    className="border border-[#555] bg-[#242426] px-2 py-1.5 text-xs font-bold text-[#C9C9C9] outline-none focus:border-[#8BC34A]">
                    {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => <option key={k} value={k} className="bg-[#242426]">{SORT_LABEL[k]}</option>)}
                  </select>
                  <button type="button" onClick={() => setApplyOpen(true)}
                    className="flex items-center gap-1.5 bg-[#8BC34A] px-3 py-1.5 text-xs font-black text-[#1B2B0B] hover:bg-[#9CD455]">
                    <Plus className="h-4 w-4" />申请主题
                  </button>
                </div>
              </div>
            </div>

            {mineView ? (
              <div className="px-3 py-3 sm:px-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-[#F4A261]">
                  {mineView === 'reply' ? <MessageSquare className="h-3.5 w-3.5" /> : <Star className="h-3.5 w-3.5" />}
                  {mineView === 'reply' ? `我的回复（${myReplyTopics.length}）` : `我的收藏（${myFavTopics.length}）`}
                  <span className="ml-1 font-bold text-[#8A8A8A]">{mineView === 'reply' ? '有人回复了你时，这里会标「新」' : '收藏的主题有新回复时，这里会标「新」'}</span>
                </div>
                {(mineView === 'reply' ? myReplyTopics : myFavTopics).length === 0 ? (
                  <div className="px-4 py-10 text-center text-sm text-[#9A9A9A]">
                    {!currentUserQq ? '登录后可以看到自己的回复与收藏'
                      : mineView === 'reply' ? '还没有参与过讨论，去主题里回复一条就会出现在这里'
                        : '还没有收藏主题，点主题卡片上的星标即可收藏'}
                  </div>
                ) : mineView === 'fav' ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {myFavTopics.map((t) => <TopicCard key={t.id} t={t} newCount={unreadFav[t.id] || 0} />)}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {(mineView === 'reply' ? myReplyTopics : myFavTopics).map((t) => {
                      const unread = mineView === 'reply' ? (unreadReply[t.id] || 0) : (unreadFav[t.id] || 0);
                      const mine = mineView === 'reply' ? myLastReply(t) : null;
                      return (
                        <button key={t.id} type="button" onClick={() => openDetail(t)}
                          className="flex w-full items-start gap-2 border border-[#3A3A3A] bg-[#2E2E30] px-3 py-2.5 text-left transition-colors hover:border-[#8BC34A] hover:bg-[#343437]">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="truncate text-sm font-black text-white">{t.title}</span>
                              {unread > 0 && <span className="bg-[#D62828] px-1.5 py-0.5 text-[10px] font-black leading-none text-white">新 {unread}</span>}
                              {t.isPinned && <span className="border border-[#555] px-1 py-0.5 text-[10px] font-bold text-[#9A9A9A]">置顶</span>}
                            </div>
                            {mine && <p className="mt-1 line-clamp-1 text-[11px] text-[#BDBDBD]">我的回复：{plainText(mine.content) || '（图片回复）'}</p>}
                            <div className="mt-1 flex flex-wrap items-center gap-3 text-[10px] text-[#8A8A8A]">
                              <span className="border border-[#555] px-1.5 py-0.5 font-bold text-[#C9C9C9]">{t.rule || '综合'}</span>
                              <span className="flex items-center gap-1" title="回复数"><MessageSquare className="h-3 w-3" />{countReplies(t.replies)}</span>
                              <span className="flex items-center gap-1" title="收藏数"><Star className="h-3 w-3" />{t.favCount || 0}</span>
                              <span>{mineView === 'reply' && mine ? `我回复于 ${mine.time.slice(5)}` : t.lastReplyTs ? `最近回复 ${fmtTs(t.lastReplyTs)}` : '暂无回复'}</span>
                              {unread > 0 && <span className="font-black text-[#F4A261]">有新回复，点开查看</span>}
                            </div>
                          </div>
                          <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#555]" />
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
            <>
            {/* 新动态提示条：有未读回复 / 收藏更新时置顶显示，点「查看」直接进对应列表 */}
            {(totalUnreadReply > 0 || totalUnreadFav > 0) && (
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#3A3A3A] bg-[#F4A261]/12 px-4 py-2 text-xs font-bold text-[#F4A261]">
                <Star className="h-3.5 w-3.5" fill="currentColor" />
                <span>
                  {totalUnreadReply > 0 && `有 ${totalUnreadReply} 条新回复`}
                  {totalUnreadReply > 0 && totalUnreadFav > 0 && ' · '}
                  {totalUnreadFav > 0 && `${totalUnreadFav} 个收藏主题有新动态`}
                </span>
                <button type="button" onClick={() => openMine(totalUnreadReply > 0 ? 'reply' : 'fav')} className="underline hover:no-underline">查看</button>
              </div>
            )}

            {/* 首排：热度最高主题（无热门标签） */}
            {featured.length > 0 && (
              <div className="border-b border-[#3A3A3A] px-3 py-3 sm:px-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-[#F4A261]"><Flame className="h-3.5 w-3.5" />热度最高</div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  {featured.map((t) => <TopicCard key={t.id} t={t} />)}
                </div>
              </div>
            )}

            {/* 其余主题：按当前排序 */}
            <div className="px-3 py-3 sm:px-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-[#9A9A9A]"><Clock3 className="h-3.5 w-3.5" />全部主题 · {SORT_LABEL[sort]}</div>
              {rest.length === 0 && <div className="px-4 py-10 text-center text-sm text-[#9A9A9A]">还没有主题，点「申请主题」来发起第一个讨论吧</div>}
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {rest.map((t) => <TopicCard key={t.id} t={t} />)}
              </div>
            </div>
            </>
            )}
          </>
        ) : (
          <>
            {/* 主题详情：只有主题标题，无正文文字段 */}
            <div className="border-b border-[#3A3A3A] px-4 py-3">
              {/* 返回列表：放大成带边框的按钮，避免在详情里找不到退出入口 */}
              <button type="button" onClick={backToList} className="mb-3 inline-flex cursor-pointer items-center gap-1.5 border-2 border-[#555] bg-[#242426] px-3.5 py-1.5 text-sm font-black text-[#E8E8E8] transition-colors hover:border-[#8BC34A] hover:bg-[#2F3324] hover:text-white">
                <ArrowLeft className="h-4 w-4" />返回列表
              </button>
              <div className="flex flex-wrap items-center gap-2">
                {openTopic.isPinned && <span className="bg-[#D62828] px-2 py-0.5 text-[11px] font-black text-white">置顶</span>}
                <span className="bg-[#8BC34A] px-2 py-0.5 text-[11px] font-black text-[#1B2B0B]">{openTopic.rule || '综合'}</span>
                <h3 className="text-lg font-black leading-snug text-white">{openTopic.title}</h3>
                <button type="button" aria-label={`${favorites[openTopic.id] ? '取消收藏' : '收藏'} ${openTopic.title}`} title={favorites[openTopic.id] ? '取消收藏' : '收藏主题'} onClick={() => void toggleFav(openTopic)}
                  className={`ml-1 flex items-center gap-1 border-2 px-2 py-0.5 text-xs font-black transition-colors ${favorites[openTopic.id] ? 'border-[#E9C46A] bg-[#E9C46A] text-[#2A2205]' : 'border-[#555] text-[#C9C9C9] hover:border-[#E9C46A] hover:text-[#E9C46A]'}`}>
                  <Star className="h-3.5 w-3.5" fill={favorites[openTopic.id] ? 'currentColor' : 'none'} />{openTopic.favCount || 0}
                </button>
                <button type="button" aria-label={`点赞 ${openTopic.title}`} onClick={() => void toggleLike(openTopic)}
                  className={`ml-1 flex items-center gap-1 border-2 px-2 py-0.5 text-xs font-black transition-colors ${likedTopics[openTopic.id] ? 'border-[#8BC34A] bg-[#8BC34A] text-[#1B2B0B]' : 'border-[#555] text-[#C9C9C9] hover:border-[#8BC34A] hover:text-[#8BC34A]'}`}>
                  <ThumbsUp className="h-3.5 w-3.5" />{openTopic.likes}
                </button>
              </div>
              <div className="mt-2 text-xs text-[#8A8A8A]">发布时间：{openTopic.time} · {openTopic.views} 浏览{openTopic.ruleVersion ? ` · 规则版本：${openTopic.ruleVersion}` : ''}</div>
            </div>

            <div className="px-4 py-3">
              {(!!openTopic.origin || !!openTopic.contentAttr || openTopic.tags.length > 0) && (
                <div className="flex flex-wrap gap-2">
                  {!!openTopic.origin && <span className="border border-[#F4A261] bg-[#F4A261]/15 px-2 py-0.5 text-[11px] font-black text-[#F4A261]">{openTopic.origin}</span>}
                  {!!openTopic.contentAttr && splitContentAttrs(openTopic.contentAttr).map((attr) => <span key={attr} className="border border-[#176B57] bg-[#176B57]/15 px-2 py-0.5 text-[11px] font-black text-[#7FC7A6]">{attr}</span>)}
                  {openTopic.tags.map((tag) => <span key={tag} className="border border-[#555] px-2 py-0.5 text-[11px] font-bold text-[#BDBDBD]">{tag}</span>)}
                </div>
              )}
              {!!openTopic.resources?.length && (
                <div className="mt-3 border-t border-[#3A3A3A] pt-3">
                  <div className="mb-1.5 flex items-center gap-1 text-xs font-bold text-[#7FC7FF]"><Link2 className="h-3.5 w-3.5" />引用的站内爱心资源</div>
                  <div className="flex flex-wrap gap-2">
                    {openTopic.resources.map((r: RoundtableResourceRef) => (
                      <a key={r.id} href={r.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 border border-[#555] bg-[#242426] px-2 py-1 text-[11px] font-bold text-[#DCE8CF] hover:border-[#8BC34A]">
                        <Link2 className="h-3 w-3" />{r.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 全部回复 + 排序 */}
            <div className="flex items-center justify-between border-y border-[#3A3A3A] bg-[#262628] px-4 py-2.5">
              <span className="text-sm font-black text-white">全部回复（{countReplies(openTopic.replies)}）</span>
              <button type="button" onClick={() => setReplySort(replySort === 'likes' ? 'latest' : 'likes')}
                className="flex items-center gap-1 border border-[#555] px-2.5 py-1 text-[11px] font-bold text-[#C9C9C9] hover:border-[#8BC34A]">
                {replySort === 'likes' ? '最多点赞' : '最新发言'}<ChevronDown className="h-3 w-3" />
              </button>
            </div>

            <div className="px-4">
              {sortedReplies.length === 0 && <div className="py-10 text-center text-sm text-[#8A8A8A]">还没有回复，来抢沙发吧</div>}
              {sortedReplies.map((r) => renderReply(r))}
            </div>

            {/* 讨论回复窗口：拖拽上传 + 折叠 */}
            <div className={`border-t-2 border-[#3A3A3A] px-4 py-4 transition-colors ${dragging ? 'bg-[#34402A]' : 'bg-[#262628]'}`}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <div className="mb-2 flex items-center gap-1.5 text-xs font-bold text-[#9A9A9A]">
                参与讨论{dragging && <span className="text-[#8BC34A]">· 松开鼠标上传图片（单张 ≤ 2M）</span>}
              </div>
              {replyImages.length > 0 && (
                <div className="mb-2 flex flex-wrap gap-2">
                  {replyImages.map((src, i) => (
                    <div key={i} className="relative">
                      <img src={src} alt="待发送图片" className="h-16 w-16 border border-[#555] object-cover" />
                      <button type="button" aria-label="移除图片" onClick={() => setReplyImages(replyImages.filter((_, j) => j !== i))} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-[#121212] bg-[#D62828] text-white"><X className="h-3 w-3" /></button>
                    </div>
                  ))}
                </div>
              )}
              <div className="border-2 border-[#555] bg-[#2B2B2D] focus-within:border-[#8BC34A]">
                <MdToolbar onInsert={insertMd(replyTextRef, replyText, setReplyText)} />
                <textarea ref={replyTextRef} value={replyText} onChange={(e) => setReplyText(e.target.value)}
                  placeholder="写下你的讨论或回复，支持 Markdown，可拖拽图片到此处…" rows={6}
                  className="min-h-[160px] w-full resize-y bg-transparent p-3 text-sm leading-relaxed text-white outline-none placeholder:text-[#777]" />
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
                  <button type="button" aria-label="上传图片" title="点击或拖拽上传图片（单张 ≤ 2M，最多 4 张）" onClick={() => fileRef.current?.click()}
                    className="flex items-center gap-1 border-2 border-[#555] px-2 py-1.5 text-xs font-bold text-[#9A9A9A] hover:border-[#8BC34A] hover:text-[#8BC34A]"><ImagePlus className="h-4 w-4" />图片</button>
                </div>
                <button type="button" onClick={() => void sendReply()} className="flex items-center justify-center gap-1 bg-[#8BC34A] px-5 py-2 text-xs font-black text-[#1B2B0B] hover:bg-[#9CD455]"><Send className="h-4 w-4" />发送</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 申请主题弹窗：与后台新建共用同一表单 */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 p-4">
          <div className="mx-auto flex min-h-full items-center justify-center">
            <div className="my-2 w-full max-w-lg border-2 border-[#3A3A3A] bg-[#2B2B2D] p-5 text-[#E8E8E8] shadow-[6px_6px_0px_#121212]" onClick={(e) => e.stopPropagation()}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-black text-white">申请主题</h3>
                <button type="button" aria-label="关闭" onClick={() => setApplyOpen(false)} className="text-[#9A9A9A] hover:text-white"><X className="h-5 w-5" /></button>
              </div>
              <RoundtableTopicForm channels={channels} dark submitLabel="提交申请" flash={flash} onSave={submitApply} onCancel={() => setApplyOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
