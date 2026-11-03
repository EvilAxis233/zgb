import { useEffect, useState } from 'react';
import { X, BookOpen, Crown } from 'lucide-react';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const guide = [
  ['登录与档案', '使用 QQ 号接收邮箱验证码登录。登录后可在个人档案修改昵称、头像、简介、喜好与禁忌，并查看自己主持和参加的已结团记录。'],
  ['浏览与报名', '在网团、面团和宣群板块查看招募内容。可按团名、主持、规则、时段与日期筛选；点击卡片查看详情。登录后可报名，报名后可查看主持联系方式。满员、锁车或到期后不再公开招募；开团日期前可取消报名。'],
  ['发布内容', '在对应板块发布网团、面团或宣群，填写日期时段、人数、简介与标签，可一次选择多个时段。面团可填写地点与地址；宣群可填写宣群方式和平台。'],
  ['团务管理', '在「团务管理」查看自己发布和报名的内容。主持可修改内容、增加时段、锁车或重新开放、移出报名玩家，也可结团或弃团；弃团会删除该团与相关成员记录。宣群不设结团操作。'],
  ['签到与点赞', '每天签到可获得 1 张玩家点赞券，0点刷新。普通用户连续签到每满 7 天获得 1 张 GM 点赞券。主持结团后，成员可从个人档案进入团详情，使用点赞券为同团 GM 或玩家点赞。'],
  ['反馈与举报', '在个人档案或团务管理旁的「反馈」「举报」入口提交意见。举报需填写被举报账号或昵称，并附上至少一张图片；管理员会在后台受理。'],
] as const;

const memberBenefits = [
  ['已开放 · GM 点赞券', '会员期间累计签到每满 7 次，获得 2 张 GM 点赞券，比普通用户多 1 张；中断签到不清零。每天签到仍可获得 1 张玩家点赞券。'],
  ['已上线 · 自定义展示铭牌', '会员可在个人档案中选择并佩戴自定义展示铭牌。'],
  ['开通与续费', '等待爱发电审核中，即将上线...'],
] as const;

export function InstructionsModal({ isOpen, onClose }: InstructionsModalProps) {
  const [section, setSection] = useState<'guide' | 'member'>('guide');
  useEffect(() => { if (isOpen) setSection('guide'); }, [isOpen]);
  useEffect(() => {
    if (!isOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [isOpen, onClose]);
  if (!isOpen) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
    <div className="w-full max-w-lg bg-white border-3 border-[#121212] shadow-[8px_8px_0px_#121212] flex flex-col max-h-[90vh] overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="instructions-modal-title">
      <header className="flex items-center justify-between px-5 py-4 border-b-2 border-[#121212] bg-[#FAF9F5]">
        <h2 id="instructions-modal-title" className="text-lg font-black flex items-center gap-2"><BookOpen size={20} />使用说明</h2>
        <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center border-2 border-[#121212] bg-white hover:bg-[#D62828] hover:text-white cursor-pointer" aria-label="关闭"><X size={20} /></button>
      </header>
      <nav className="grid grid-cols-2 border-b-2 border-[#121212]" aria-label="说明分类">
        <button type="button" aria-current={section === 'guide' ? 'page' : undefined} onClick={() => setSection('guide')} className={`py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer ${section === 'guide' ? 'bg-[#121212] text-white' : 'bg-white text-[#121212]'}`}><BookOpen size={16} />普通说明</button>
        <button type="button" aria-current={section === 'member' ? 'page' : undefined} onClick={() => setSection('member')} className={`py-3 text-sm font-black flex items-center justify-center gap-2 cursor-pointer ${section === 'member' ? 'bg-[#D62828] text-white' : 'bg-white text-[#121212]'}`}><Crown size={16} />会员权益</button>
      </nav>
      <div className="instructions-scrollbar p-5 overflow-y-auto space-y-3.5 text-xs text-[#222]">
        {(section === 'guide' ? guide : memberBenefits).map(([title, description]) => <section key={title} className="p-3.5 bg-[#FAF9F5] border-2 border-[#121212] shadow-[2px_2px_0px_#121212]">
          <h3 className="font-black text-sm text-[#121212] mb-1.5">{title}</h3>
          <p className="text-[#444] leading-relaxed">{description}</p>
        </section>)}
      </div>
      <footer className="p-4 border-t-2 border-[#121212] bg-[#FAF9F5] flex justify-end"><button type="button" onClick={onClose} className="bauhaus-btn bg-[#121212] text-white px-5 py-2 text-xs font-bold hover:bg-[#D62828] cursor-pointer">我明白了</button></footer>
    </div>
  </div>;
}
