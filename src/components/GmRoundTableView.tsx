import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, ChevronDown, Eye, Flame, ImagePlus, Link2, MessageSquare,
  Plus, Search, Send, ThumbsUp, X, Flag, Clock3,
} from 'lucide-react';

/**
 * GM 圆桌（预览版，纯前端示例数据）：
 * - 主题：仅主题 + 发布时间 + 风格 tag；可引用爱心资源
 * - 3 列网格：首排热度最高主题置顶，其余按当前排序（默认最新回复）
 * - 三种排序：热度最高 / 最新回复 / 最新主题；规则检索可输入 + 下拉
 * - 申请开主题：模组名称 / 原版规则 / 风格 tag（最多 6 个，每个 ≤ 6 中文字符）
 * - 回复：拖拽上传图片(≤2M)、图片默认折叠、顶层与嵌套回复均可举报
 */

type Channel = { id: string; label: string };
type ResourceRef = { name: string; type: string; note: string };
type Reply = {
  id: string; author: string; avatar: string; color: string;
  time: string; content: string; likes: number; images?: string[]; children?: Reply[];
};
type Topic = {
  id: string; channelId: string; rule: string;
  time: string; createdTs: number; lastReplyTs: number;
  title: string; body: string; tags: string[];
  views: number; likes: number; resource?: ResourceRef; replies: Reply[];
};

const CHANNELS: Channel[] = [
  { id: 'all', label: '综合' },
  { id: 'ose', label: 'OSE' },
  { id: 'coc', label: 'COC' },
  { id: 'pending', label: '待定' },
];
const RULES = ['全部规则', 'OSE', 'COC 7版', 'DND 5e', 'PODH'];

const TOPICS: Topic[] = [
  {
    id: 't1', channelId: 'ose', rule: 'OSE',
    time: '2026-03-12 上午 10:46', createdTs: 202603121046, lastReplyTs: 202603241158,
    title: '含剧透，非GM勿点进！《魔藤》模组相关内容讨论贴',
    body: '分享带团小疑问、小巧思、小灵感、小笔记还有团内小趣事！\n\n魔藤在 OSE 模组里，风味略有不足，但胜在利好新 GM，有清晰的主线和背景故事。虽是单条主线，但也有不同的处理方法。',
    tags: ['模组探讨', '剧透'], views: 132, likes: 28,
    resource: { name: '《魔藤》模组下载地址', type: '网盘下载', note: '官方发布 · 模组资源' },
    replies: [
      {
        id: 'r1', author: 'EvilAxia', avatar: '恶', color: '#004E98',
        time: '2026-03-12 上午 10:48', likes: 13,
        content: '不适合给老带新跑！！！魔藤在ose模组里，风味略有不足，但胜在利好新GM，有清晰的主线和背景故事。',
        children: [
          { id: 'r1-1', author: 'YELLOW', avatar: '黄', color: '#D62828', time: '2026-03-24 下午 11:58', likes: 2, content: '顶一个' },
        ],
      },
      {
        id: 'r2', author: '串串串', avatar: '串', color: '#C77D3A', time: '2026-03-12 中午 12:16', likes: 6,
        content: '串串团魔藤的一些想法：如果是面团并且都全是纯萌新的话，车卡是一项并不太能体验到乐趣的事情。',
      },
    ],
  },
  {
    id: 't2', channelId: 'ose', rule: 'OSE',
    time: '2026-03-13 凌晨 12:10', createdTs: 202603130010, lastReplyTs: 202603130920,
    title: '含剧透，非GM勿点进！Brad Kerr作者系列模组探讨',
    body: 'Brad Kerr 的系列模组适合串成长期战役，欢迎在回复里交流各自的串联方式。',
    tags: ['模组探讨', '剧透'], views: 98, likes: 19,
    replies: [
      { id: 'r3', author: 'YELLOW', avatar: '黄', color: '#D62828', time: '2026-03-13 上午 09:20', likes: 7, content: '飞龙歌集确实好用，串起来很顺。' },
    ],
  },
  {
    id: 't3', channelId: 'ose', rule: 'OSE',
    time: '2026-03-13 凌晨 12:17', createdTs: 202603130017, lastReplyTs: 202603130017,
    title: '含剧透，非GM勿点进！OSE官模相关探讨',
    body: 'OSE 官方模组讨论集中贴，欢迎分享各模组带团心得。',
    tags: ['模组探讨'], views: 76, likes: 11,
    resource: { name: 'OSE 规则书（在线查询）', type: '在线查询', note: '官方发布 · 规则资料' },
    replies: [],
  },
  {
    id: 't4', channelId: 'ose', rule: 'OSE',
    time: '2026-03-12 上午 11:33', createdTs: 202603121133, lastReplyTs: 202603121133,
    title: 'OSE规则相关讨论贴',
    body: '分享小疑问、实用有趣的魔改模块等。',
    tags: ['规则'], views: 45, likes: 4, replies: [],
  },
  {
    id: 't5', channelId: 'ose', rule: 'PODH',
    time: '2026-03-16 下午 08:05', createdTs: 202603162005, lastReplyTs: 202603162230,
    title: '激光枪地精带团实操',
    body: '昨天带了一下，但感觉问题不少，我最后悔的是没有提前把规则吃透。',
    tags: ['带团实操', '激光枪地精'], views: 210, likes: 35,
    replies: [],
  },
  {
    id: 't6', channelId: 'coc', rule: 'COC 7版',
    time: '2026-03-17 上午 09:40', createdTs: 202603170940, lastReplyTs: 202603171015,
    title: 'COC 7版《追书人》跑团记录与复盘',
    body: '第一次带 COC 7版，记录一下流程和玩家反馈，欢迎交流。',
    tags: ['跑团复盘', 'COC'], views: 64, likes: 9,
    replies: [],
  },
  {
    id: 't7', channelId: 'pending', rule: 'DND 5e',
    time: '2026-03-15 下午 03:00', createdTs: 202603151500, lastReplyTs: 202603151500,
    title: '【申请中】DND 5e 规则讨论分页',
    body: '该分页由玩家申请开通，等待管理员审核。',
    tags: ['开通申请', 'DND'], views: 12, likes: 1, replies: [],
  },
];

const countReplies = (replies: Reply[]): number =>
  replies.reduce((sum, r) => sum + 1 + countReplies(r.children || []), 0);
const heatOf = (t: Topic) => t.views + t.likes * 8 + countReplies(t.replies) * 12;
const colorOf = (hex: string) => hex;
const cnLen = (s: string) => Array.from(s.trim()).reduce((n, ch) => {
  const code = ch.charCodeAt(0);
  return n + (code >= 0x4e00 && code <= 0x9fff ? 1 : 0.5);
}, 0);

type SortMode = 'heat' | 'latestReply' | 'latestTopic';
const SORT_LABEL: Record<SortMode, string> = {
  heat: '热度最高', latestReply: '最新回复', latestTopic: '最新主题',
};

export const GmRoundTableView: React.FC = () => {
  const [channel, setChannel] = useState('ose');
  const [sort, setSort] = useState<SortMode>('latestReply');
  const [replySort, setReplySort] = useState<'likes' | 'latest'>('likes');
  const [openTopic, setOpenTopic] = useState<Topic | null>(null);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [ruleFilter, setRuleFilter] = useState('全部规则');
  // 规则页签按热度从左到右排列；某分类有新回复时置顶（bump 为毫秒时间戳）
  const [channelBump, setChannelBump] = useState<Record<string, number>>({});
  // 卡片点赞（本地演示）
  const [likedTopics, setLikedTopics] = useState<Record<string, boolean>>({});

  // 申请开主题表单
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyName, setApplyName] = useState('');
  const [applyRule, setApplyRule] = useState('');
  const [applyTargetChannel, setApplyTargetChannel] = useState('');
  const [applyNewChannel, setApplyNewChannel] = useState('');
  const [applyTags, setApplyTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState('');

  // 回复：拖拽上传 + 折叠 + 举报
  const [replyText, setReplyText] = useState('');
  const [replyImages, setReplyImages] = useState<string[]>([]);
  const [extraReplies, setExtraReplies] = useState<Reply[]>([]);
  const [imagesOpen, setImagesOpen] = useState<Record<string, boolean>>({});
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(''), 2600);
  };

  const filtered = useMemo(() => TOPICS.filter((t) => {
    if (channel !== 'all' && t.channelId !== channel) return false;
    if (ruleFilter !== '全部规则' && t.rule !== ruleFilter) return false;
    const q = query.trim().toLowerCase();
    if (q && !t.title.toLowerCase().includes(q) && !t.tags.some((tag) => tag.toLowerCase().includes(q))) return false;
    return true;
  }), [channel, ruleFilter, query]);

  // 规则页签按热度从左到右：综合固定最左，其余按该分类主题热度降序；有新回复的分类置顶。
  const orderedChannels = useMemo(() => {
    const baseHeat = (id: string) => TOPICS.filter((t) => t.channelId === id).reduce((s, t) => s + heatOf(t), 0);
    const rest = CHANNELS.filter((c) => c.id !== 'all').slice().sort((a, b) => {
      const ba = channelBump[a.id] || 0, bb = channelBump[b.id] || 0;
      if (ba !== bb) return bb - ba;
      return baseHeat(b.id) - baseHeat(a.id);
    });
    const all = CHANNELS.find((c) => c.id === 'all');
    return all ? [all, ...rest] : rest;
  }, [channelBump]);

  const sorted = useMemo(() => filtered.slice().sort((a, b) => {
    if (sort === 'heat') return heatOf(b) - heatOf(a);
    if (sort === 'latestTopic') return b.createdTs - a.createdTs;
    return b.lastReplyTs - a.lastReplyTs; // 默认：最新回复
  }), [filtered, sort]);

  // 首排热度最高的 3 个（在当前过滤结果里取），其余走排序
  const featured = useMemo(
    () => filtered.slice().sort((a, b) => heatOf(b) - heatOf(a)).slice(0, 3),
    [filtered],
  );
  const featuredIds = new Set(featured.map((t) => t.id));
  const rest = sorted.filter((t) => !featuredIds.has(t.id));

  const sortedReplies = useMemo(() => {
    if (!openTopic) return [];
    return openTopic.replies.slice().sort((a, b) => replySort === 'likes'
      ? b.likes - a.likes : b.time.localeCompare(a.time));
  }, [openTopic, replySort]);

  const applyChannel = (id: string) => { setChannel(id); setOpenTopic(null); };

  const addTag = () => {
    const t = tagDraft.trim();
    if (!t) return;
    if (applyTags.length >= 6) { flash('模组风格 tag 最多 6 个'); return; }
    if (cnLen(t) > 6) { flash('每个 tag 最多 6 个中文字符'); return; }
    if (applyTags.includes(t)) { flash('该 tag 已添加'); return; }
    setApplyTags([...applyTags, t]);
    setTagDraft('');
  };

  const submitApply = () => {
    if (!applyName.trim()) { flash('请填写模组名称'); return; }
    if (!applyRule.trim()) { flash('请填写模组原版规则'); return; }
    if (!applyTargetChannel) { flash('请选择主题放置的规则分页'); return; }
    if (applyTargetChannel === '__new__' && !applyNewChannel.trim()) { flash('请填写新建规则分页名称'); return; }
    if (applyTags.length === 0) { flash('请至少填写 1 个模组风格 tag'); return; }
    setApplyOpen(false);
    setApplyName(''); setApplyRule(''); setApplyTargetChannel(''); setApplyNewChannel(''); setApplyTags([]); setTagDraft('');
    flash('开主题申请已提交（预览：仅前端演示，等待管理员审核）');
  };

  const addImageFiles = (files: File[]) => {
    let added = 0;
    files.filter((f) => f.type.startsWith('image/')).forEach((f) => {
      if (f.size > 2 * 1024 * 1024) { flash(`图片「${f.name}」超过 2M，已跳过`); return; }
      if (replyImages.length + added >= 4) { flash('最多上传 4 张图片'); return; }
      const reader = new FileReader();
      reader.onload = () => setReplyImages((prev) => [...prev, String(reader.result)].slice(0, 4));
      reader.readAsDataURL(f);
      added += 1;
    });
  };
  const onPickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    addImageFiles(Array.from(e.target.files || []));
    e.target.value = '';
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    addImageFiles(Array.from(e.dataTransfer.files || []));
  };

  const sendReply = () => {
    if (!replyText.trim() && replyImages.length === 0) { flash('请输入讨论内容或上传图片'); return; }
    const now = new Intl.DateTimeFormat('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
    setExtraReplies((prev) => [{
      id: `local-${Date.now()}`, author: '我', avatar: '我', color: '#8BC34A',
      time: now, content: replyText.trim() || '（图片）', likes: 0, images: replyImages.slice(),
    }, ...prev]);
    // 有新回复：该分类规则页签刷新为第 1 顺序
    if (openTopic) setChannelBump((prev) => ({ ...prev, [openTopic.channelId]: Date.now() }));
    setReplyText(''); setReplyImages([]);
    flash('回复已发布（预览：仅前端演示）');
  };

  const reportBtn = (label: string) => (
    <button type="button" onClick={() => flash(`已举报${label}（预览：仅前端演示）`)} className="flex items-center gap-1 text-[11px] text-[#8A8A8A] hover:text-[#D62828]">
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

  const TopicCard = ({ t, hot }: { t: Topic; hot?: boolean }) => {
    const liked = !!likedTopics[t.id];
    return (
      <div className="relative flex h-full flex-col border border-[#3A3A3A] bg-[#2E2E30] p-4 transition-colors hover:border-[#8BC34A] hover:bg-[#343437]">
        <button type="button" onClick={() => setOpenTopic(t)} className="flex flex-1 flex-col text-left">
          <div className="flex items-center gap-2">
            {hot && <span className="flex items-center gap-1 bg-[#D62828] px-1.5 py-0.5 text-[10px] font-black text-white"><Flame className="h-3 w-3" />热门</span>}
          </div>
          <h3 className="mt-2 line-clamp-2 text-sm font-black leading-snug text-white">{t.title}</h3>
          <div className="mt-1.5 text-[11px] text-[#8A8A8A]">发布时间：{t.time}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {t.tags.map((tag) => <span key={tag} className="border border-[#555] px-1.5 py-0.5 text-[10px] font-bold text-[#BDBDBD]">{tag}</span>)}
          </div>
          <div className="mt-auto flex items-center gap-3 pt-3 text-[11px] text-[#9A9A9A]">
            <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{t.views}</span>
            <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{countReplies(t.replies)}</span>
          </div>
        </button>
        {/* 规则分页下的主题：不显示规则标签，改为点赞按钮（显示数量） */}
        <button type="button" aria-label={`点赞 ${t.title}`} onClick={() => setLikedTopics((prev) => ({ ...prev, [t.id]: !prev[t.id] }))}
          className={`mt-2 flex w-full items-center justify-center gap-1.5 border-2 py-1.5 text-xs font-black transition-colors ${liked ? 'border-[#8BC34A] bg-[#8BC34A] text-[#1B2B0B]' : 'border-[#555] bg-[#242426] text-[#C9C9C9] hover:border-[#8BC34A] hover:text-[#8BC34A]'}`}>
          <ThumbsUp className="h-3.5 w-3.5" />{t.likes + (liked ? 1 : 0)}
        </button>
      </div>
    );
  };

  return (
    <div className="mx-auto w-full max-w-6xl">
      {notice && (
        <div className="mb-3 border-2 border-[#121212] bg-[#F4A261] px-4 py-2 text-center text-sm font-black text-[#121212] shadow-[3px_3px_0px_#121212]">{notice}</div>
      )}

      <div className="overflow-hidden rounded-lg border-2 border-[#3A3A3A] bg-[#2B2B2D] text-[#E8E8E8] shadow-[6px_6px_0px_#121212]">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[#3A3A3A] bg-[#242426] px-4 py-3">
          <BookOpen className="h-5 w-5 shrink-0 text-[#8BC34A]" />
          <h2 className="text-lg font-black tracking-wide sm:text-xl">GM圆桌</h2>
          <span className="shrink-0 border-l-2 border-[#8BC34A] pl-3 text-xs font-black text-[#F4A261] sm:text-sm">仅限于GM的严肃会谈，玩家请谨慎踏入！</span>
        </div>

        {!openTopic ? (
          <>
            {/* 规则检索（输入 + 下拉）+ 分类分页 */}
            <div className="border-b border-[#3A3A3A] px-3 py-3 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 border border-[#555] bg-[#242426] px-2 py-1.5 focus-within:border-[#8BC34A]">
                  <Search className="h-3.5 w-3.5 shrink-0 text-[#9A9A9A]" />
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="规则检索"
                    className="w-24 bg-transparent text-xs text-white outline-none placeholder:text-[#777] sm:w-32" />
                  <select value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)}
                    className="border-l border-[#555] bg-transparent pl-1.5 text-xs text-[#C9C9C9] outline-none">
                    {RULES.map((r) => <option key={r} value={r} className="bg-[#242426]">{r}</option>)}
                  </select>
                </div>
                {orderedChannels.map((c) => (
                  <button key={c.id} type="button" onClick={() => applyChannel(c.id)}
                    className={`border-b-2 px-2.5 py-1.5 text-sm font-black transition-colors ${channel === c.id ? 'border-[#8BC34A] text-white' : 'border-transparent text-[#9A9A9A] hover:text-white'}`}>
                    {c.label}
                  </button>
                ))}
                <button type="button" onClick={() => flash('已提交开通分页申请（预览：仅前端演示）')}
                  className="flex h-7 w-7 items-center justify-center border border-[#555] text-[#9A9A9A] hover:border-[#8BC34A] hover:text-[#8BC34A]" title="申请开通新分页">
                  <Plus className="h-4 w-4" />
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} title="主题排序"
                    className="border border-[#555] bg-[#242426] px-2 py-1.5 text-xs font-bold text-[#C9C9C9] outline-none focus:border-[#8BC34A]">
                    {(Object.keys(SORT_LABEL) as SortMode[]).map((k) => <option key={k} value={k} className="bg-[#242426]">{SORT_LABEL[k]}</option>)}
                  </select>
                  <button type="button" onClick={() => setApplyOpen(true)}
                    className="flex items-center gap-1.5 bg-[#8BC34A] px-3 py-1.5 text-xs font-black text-[#1B2B0B] hover:bg-[#9CD455]">
                    <Plus className="h-4 w-4" />申请开主题
                  </button>
                </div>
              </div>
            </div>

            {/* 首排：热度最高主题 */}
            {featured.length > 0 && (
              <div className="border-b border-[#3A3A3A] px-3 py-3 sm:px-4">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-[#F4A261]"><Flame className="h-3.5 w-3.5" />热度最高</div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {featured.map((t) => <TopicCard key={t.id} t={t} hot />)}
                </div>
              </div>
            )}

            {/* 其余主题：按当前排序 */}
            <div className="px-3 py-3 sm:px-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-black text-[#9A9A9A]"><Clock3 className="h-3.5 w-3.5" />全部主题 · {SORT_LABEL[sort]}</div>
              {rest.length === 0 && <div className="px-4 py-10 text-center text-sm text-[#9A9A9A]">没有匹配的主题</div>}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((t) => <TopicCard key={t.id} t={t} />)}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* 主题详情：主题 + 发布时间（无发布人） */}
            <div className="border-b border-[#3A3A3A] px-4 py-3">
              <button type="button" onClick={() => { setOpenTopic(null); setExtraReplies([]); }} className="mb-3 flex items-center gap-1 text-xs font-bold text-[#9A9A9A] hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />返回列表</button>
              <div className="flex flex-wrap items-center gap-2">
                <span className="bg-[#8BC34A] px-2 py-0.5 text-[11px] font-black text-[#1B2B0B]">{openTopic.rule}</span>
                <h3 className="text-lg font-black leading-snug text-white">{openTopic.title}</h3>
              </div>
              <div className="mt-2 text-xs text-[#8A8A8A]">发布时间：{openTopic.time} · {openTopic.views} 浏览</div>
            </div>

            <div className="px-4 py-4">
              <p className="whitespace-pre-line text-sm leading-7 text-[#DCDCDC]">{openTopic.body}</p>
              {openTopic.resource && (
                <div className="mt-4 border-l-4 border-[#8BC34A] bg-[#343437] px-4 py-3">
                  <div className="flex items-center gap-1.5 text-xs font-black text-[#8BC34A]"><BookOpen className="h-4 w-4" />引用爱心资源</div>
                  <div className="mt-1.5 font-bold text-white">{openTopic.resource.name}</div>
                  <div className="mt-0.5 text-xs text-[#9A9A9A]">{openTopic.resource.type} · {openTopic.resource.note}</div>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-2">
                {openTopic.tags.map((tag) => <span key={tag} className="border border-[#555] px-2 py-0.5 text-[11px] font-bold text-[#BDBDBD]">{tag}</span>)}
              </div>
            </div>

            {/* 全部回复 + 排序 */}
            <div className="flex items-center justify-between border-y border-[#3A3A3A] bg-[#262628] px-4 py-2.5">
              <span className="text-sm font-black text-white">全部回复（{countReplies(openTopic.replies) + extraReplies.length}）</span>
              <button type="button" onClick={() => setReplySort(replySort === 'likes' ? 'latest' : 'likes')}
                className="flex items-center gap-1 border border-[#555] px-2.5 py-1 text-[11px] font-bold text-[#C9C9C9] hover:border-[#8BC34A]">
                {replySort === 'likes' ? '最多点赞' : '最新发言'}<ChevronDown className="h-3 w-3" />
              </button>
            </div>

            <div className="px-4">
              {extraReplies.length === 0 && sortedReplies.length === 0 && <div className="py-10 text-center text-sm text-[#8A8A8A]">还没有回复，来抢沙发吧</div>}
              {extraReplies.map((r) => (
                <div key={r.id} className="border-b border-[#3A3A3A] py-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex h-8 w-8 items-center justify-center border border-[#555] text-[11px] font-black text-white" style={{ backgroundColor: colorOf(r.color) }}>{r.avatar}</span>
                    <span className="font-bold" style={{ color: r.color }}>{r.author}</span>
                    <span className="text-[#8A8A8A]">{r.time}</span>
                    <button type="button" onClick={() => flash('已点赞（预览：仅前端演示）')} className="ml-auto flex items-center gap-1 text-[#9A9A9A] hover:text-[#8BC34A]"><ThumbsUp className="h-3.5 w-3.5" />{r.likes}</button>
                  </div>
                  {r.content && <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#DCDCDC]">{r.content}</p>}
                  {!!r.images?.length && renderImages(r.images, r.id)}
                  <div className="mt-2 flex gap-3">{reportBtn('该回复')}</div>
                </div>
              ))}
              {sortedReplies.map((r) => (
                <div key={r.id} className="border-b border-[#3A3A3A] py-4">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="flex h-8 w-8 items-center justify-center border border-[#555] text-[11px] font-black text-white" style={{ backgroundColor: colorOf(r.color) }}>{r.avatar}</span>
                    <span className="font-bold" style={{ color: r.color }}>{r.author}</span>
                    <span className="text-[#8A8A8A]">{r.time}</span>
                    <button type="button" onClick={() => flash('已点赞（预览：仅前端演示）')} className="ml-auto flex items-center gap-1 text-[#9A9A9A] hover:text-[#8BC34A]"><ThumbsUp className="h-3.5 w-3.5" />{r.likes}</button>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-7 text-[#DCDCDC]">{r.content}</p>
                  {!!r.children?.length && (
                    <div className="mt-3 space-y-3 border-l-2 border-[#555] pl-3">
                      {r.children.map((c) => (
                        <div key={c.id} className="bg-[#343437] px-3 py-2.5">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="flex h-6 w-6 items-center justify-center border border-[#555] text-[10px] font-black text-white" style={{ backgroundColor: colorOf(c.color) }}>{c.avatar}</span>
                            <span className="font-bold" style={{ color: c.color }}>{c.author}</span>
                            <span className="text-[#8A8A8A]">{c.time}</span>
                            <button type="button" onClick={() => flash('已点赞（预览：仅前端演示）')} className="ml-auto flex items-center gap-1 text-[#9A9A9A] hover:text-[#8BC34A]"><ThumbsUp className="h-3.5 w-3.5" />{c.likes}</button>
                          </div>
                          <p className="mt-1.5 text-sm leading-6 text-[#DCDCDC]">{c.content}</p>
                          <div className="mt-1.5 flex gap-3">{reportBtn('该回复')}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 flex gap-3">
                    <button type="button" onClick={() => flash('回复窗口已打开（预览：仅前端演示）')} className="flex items-center gap-1 text-xs font-bold text-[#7FC7FF] hover:underline"><MessageSquare className="h-3.5 w-3.5" />回复</button>
                    {reportBtn('该回复')}
                  </div>
                </div>
              ))}
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
              <div className="flex gap-2">
                <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={onPickImages} />
                <button type="button" aria-label="上传图片" title="点击或拖拽上传图片（单张 ≤ 2M，最多 4 张）" onClick={() => fileRef.current?.click()}
                  className="flex w-11 shrink-0 items-center justify-center border-2 border-[#555] text-[#9A9A9A] hover:border-[#8BC34A] hover:text-[#8BC34A]"><ImagePlus className="h-5 w-5" /></button>
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} placeholder="写下你的讨论或回复，可拖拽图片到此处…" rows={2} className="min-h-[56px] flex-1 resize-none border-2 border-[#555] bg-[#2B2B2D] p-2 text-sm text-white outline-none placeholder:text-[#777] focus:border-[#8BC34A]" />
                <button type="button" onClick={sendReply} className="flex w-20 items-center justify-center gap-1 bg-[#8BC34A] text-xs font-black text-[#1B2B0B] hover:bg-[#9CD455]"><Send className="h-4 w-4" />发送</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 申请开主题弹窗 */}
      {applyOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setApplyOpen(false)}>
          <div className="w-full max-w-lg border-2 border-[#3A3A3A] bg-[#2B2B2D] p-5 text-[#E8E8E8] shadow-[6px_6px_0px_#121212]" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black text-white">申请开主题</h3>
              <button type="button" aria-label="关闭" onClick={() => setApplyOpen(false)} className="text-[#9A9A9A] hover:text-white"><X className="h-5 w-5" /></button>
            </div>
            <label className="mb-1 block text-xs font-bold text-[#BDBDBD]">模组名称</label>
            <input value={applyName} onChange={(e) => setApplyName(e.target.value)} placeholder="例如：魔藤"
              className="mb-4 w-full border-2 border-[#555] bg-[#242426] px-3 py-2 text-sm text-white outline-none placeholder:text-[#777] focus:border-[#8BC34A]" />
            <label className="mb-1 block text-xs font-bold text-[#BDBDBD]">模组原版规则</label>
            <input value={applyRule} onChange={(e) => setApplyRule(e.target.value)} placeholder="例如：OSE / COC 7版 / DND 5e"
              className="mb-4 w-full border-2 border-[#555] bg-[#242426] px-3 py-2 text-sm text-white outline-none placeholder:text-[#777] focus:border-[#8BC34A]" />
            <label className="mb-1 block text-xs font-bold text-[#BDBDBD]">主题放在哪个规则下</label>
            <select value={applyTargetChannel} onChange={(e) => setApplyTargetChannel(e.target.value)}
              className="mb-2 w-full border-2 border-[#555] bg-[#242426] px-3 py-2 text-sm text-white outline-none focus:border-[#8BC34A]">
              <option value="" className="bg-[#242426]">请选择规则分页</option>
              {CHANNELS.filter((c) => c.id !== 'all').map((c) => <option key={c.id} value={c.id} className="bg-[#242426]">{c.label}</option>)}
              <option value="__new__" className="bg-[#242426]">申请新建规则分页…</option>
            </select>
            {applyTargetChannel === '__new__' && (
              <input value={applyNewChannel} onChange={(e) => setApplyNewChannel(e.target.value)} placeholder="输入新建规则分页名称"
                className="mb-3 w-full border-2 border-[#555] bg-[#242426] px-3 py-2 text-sm text-white outline-none placeholder:text-[#777] focus:border-[#8BC34A]" />
            )}
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-bold text-[#BDBDBD]">模组风格 tag（最多 6 个，每个 ≤ 6 中文字符）</label>
              <span className="text-[11px] text-[#9A9A9A]">{applyTags.length}/6</span>
            </div>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {applyTags.map((tag) => (
                <span key={tag} className="flex items-center gap-1 border border-[#8BC34A] bg-[#343437] px-2 py-0.5 text-[11px] font-bold text-[#DCE8CF]">
                  {tag}
                  <button type="button" aria-label={`删除 ${tag}`} onClick={() => setApplyTags(applyTags.filter((t) => t !== tag))} className="text-[#9A9A9A] hover:text-white"><X className="h-3 w-3" /></button>
                </span>
              ))}
            </div>
            <div className="mb-4 flex gap-2">
              <input value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                placeholder="输入 tag 后回车添加" className="flex-1 border-2 border-[#555] bg-[#242426] px-3 py-2 text-sm text-white outline-none placeholder:text-[#777] focus:border-[#8BC34A]" />
              <button type="button" onClick={addTag} className="border-2 border-[#8BC34A] px-3 text-sm font-black text-[#8BC34A] hover:bg-[#343437]">添加</button>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setApplyOpen(false)} className="border-2 border-[#555] px-4 py-2 text-xs font-black text-[#C9C9C9] hover:border-[#999]">取消</button>
              <button type="button" onClick={submitApply} className="bg-[#8BC34A] px-4 py-2 text-xs font-black text-[#1B2B0B] hover:bg-[#9CD455]">提交申请</button>
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 text-center text-xs text-[#999]">GM圆桌 · 预览版（示例数据，交互仅前端演示，数据未接入后台）</p>
    </div>
  );
};
