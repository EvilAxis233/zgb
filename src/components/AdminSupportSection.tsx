import { useState } from 'react';
import { Flag, MessageSquareText, Headphones } from 'lucide-react';
import { AdminTicketsSection } from './AdminTicketsSection';
import { AdminChatSection } from './AdminChatSection';

type SupportTab = 'feedback' | 'report' | 'chat';
const TABS: Array<{ id: SupportTab; label: string; icon: typeof MessageSquareText }> = [
  { id: 'feedback', label: '反馈', icon: MessageSquareText },
  { id: 'report', label: '举报', icon: Flag },
  { id: 'chat', label: '猪猪客服对话', icon: Headphones },
];

/** 后台「客服系统」：把反馈、举报与猪猪客服对话整合在一个分页下，用子页签切换。 */
export function AdminSupportSection({ onNotice, onError }: { onNotice: (message: string) => void; onError: (error: unknown) => void }) {
  const [tab, setTab] = useState<SupportTab>('feedback');
  return <section>
    <div className="flex flex-wrap gap-2 mb-4 border-b-2 border-[#121212] pb-3" role="tablist" aria-label="客服系统">
      {TABS.map((item) => {
        const Icon = item.icon;
        return <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}
          className={`bauhaus-btn px-5 py-2.5 gap-2 text-sm ${tab === item.id ? 'bg-[#121212] text-white' : 'bg-white'}`}>
          <Icon size={16} />{item.label}
        </button>;
      })}
    </div>
    {tab === 'feedback' && <AdminTicketsSection kind="feedback" onNotice={onNotice} onError={onError} />}
    {tab === 'report' && <AdminTicketsSection kind="report" onNotice={onNotice} onError={onError} />}
    {tab === 'chat' && <AdminChatSection onNotice={onNotice} onError={onError} />}
  </section>;
}
