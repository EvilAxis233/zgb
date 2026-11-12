import { useEffect, useState } from 'react';
import { Flag, MessageSquareText, Headphones } from 'lucide-react';
import { adminApi, type AdminNotices } from '../services/api';
import { AdminTicketsSection } from './AdminTicketsSection';
import { AdminChatSection } from './AdminChatSection';

type SupportTab = 'feedback' | 'report' | 'chat';
const TABS: Array<{ id: SupportTab; label: string; icon: typeof MessageSquareText }> = [
  { id: 'feedback', label: '反馈', icon: MessageSquareText },
  { id: 'report', label: '举报', icon: Flag },
  { id: 'chat', label: '猪猪客服对话', icon: Headphones },
];

/** 后台「客服系统」：把反馈、举报与猪猪客服对话整合在一个分页下，用子页签切换。 */
export function AdminSupportSection({ notices, onSeen, onNotice, onError }: {
  notices: AdminNotices;
  onSeen: (section: SupportTab) => void;
  onNotice: (message: string) => void;
  onError: (error: unknown) => void;
}) {
  const [tab, setTab] = useState<SupportTab>('feedback');
  // 打开子页签即视为「看过了」：清掉后端未读标记，红点随之消失。
  useEffect(() => {
    if (!notices[tab]) return;
    let alive = true;
    adminApi.markNoticesViewed(tab).then(() => { if (alive) onSeen(tab); }).catch(() => {});
    return () => { alive = false; };
  }, [tab, notices[tab]]);

  return <section>
    <div className="flex flex-wrap gap-2 mb-4 border-b-2 border-[#121212] pb-3" role="tablist" aria-label="客服系统">
      {TABS.map((item) => {
        const Icon = item.icon;
        const dot = notices[item.id] > 0;
        return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
          className={`bauhaus-btn relative px-5 py-2.5 gap-2 text-sm ${tab === item.id ? 'bg-[#121212] text-white' : 'bg-white'}`}>
          <Icon size={16} />{item.label}
          {dot && <span className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-[#D62828] border-2 border-white rounded-full" title={`${item.label}有 ${notices[item.id]} 条新内容`} aria-label={`${item.label}有 ${notices[item.id]} 条新内容`} />}
        </button>;
      })}
    </div>
    {tab === 'feedback' && <AdminTicketsSection kind="feedback" onNotice={onNotice} onError={onError} />}
    {tab === 'report' && <AdminTicketsSection kind="report" onNotice={onNotice} onError={onError} />}
    {tab === 'chat' && <AdminChatSection onNotice={onNotice} onError={onError} />}
  </section>;
}
