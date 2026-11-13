import { useEffect, useState } from 'react';
import { X, BookOpen, Crown } from 'lucide-react';

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const guide = [
  ['登录与档案', '使用 QQ 号接收邮箱验证码登录。登录后可在个人档案修改昵称、头像、简介、喜好与雷区（各最多 6 个，每个最多 6 个中文字 / 12 个英文字母），并查看自己主持和参加的已结团记录。'],
  ['浏览与报名', '在网团、面团和宣群板块查看招募内容。可按团名、主持、规则、时段与日期筛选；点击卡片查看详情。鼠标停在封面或贴纸上约 1 秒会弹出原图，移开即关闭。登录后可报名，报名后可查看主持联系方式。每个时段有固定封车时间：早场当天 12:00、午场当天 18:00、晚场次日 00:00（北京时间），到点自动封车并结算名单；封车或满员后不再公开招募，封车后也不能取消报名。'],
  ['发布内容', '在对应板块发布网团、面团或宣群，填写日期时段、人数、简介与最多六个自定义标签（每个最多 6 个中文字符或 12 个英文字符，前面不带井号）。网团与面团可一次选择多个时段批量发车，宣群只能选 1 个时间。可上传团封面，会员可以直接上传并裁剪贴纸（自动存入贴纸库，本团最多选用 2 张），也可以从个人贴纸库里挑选。面团可填写地点与地址；宣群可填写宣群方式和平台。'],
  ['团务管理', '在「团务管理」查看自己发布和报名的内容。主持可修改内容、增加时段、更换团封面与本团贴纸、锁车或重新开放、移出报名玩家，也可结团或弃团；弃团会删除该团与相关成员记录。管理员在团详情里可直接编辑或删除违规团（删除需二次确认）。宣群不填写人数或站内报名，登录后可查看联系方式；发布者可随时「结束宣发」，确认后该宣群不再展示，但记录保留在团务管理的「宣群 · 历史记录」中；在历史记录里点「删除记录」并二次确认，才会永久删除。'],
  ['签到与点赞', '每天签到可获得 1 张玩家点赞券，0 点刷新。累计签到每满 7 次可获得 GM 点赞券，按第 7 次签到时的身份发放：会员 3 张、普通用户 1 张。升级会员或变为普通用户都不影响已攒次数；会员期间断签不清零，普通用户期间断签则重新计算。主持结团后，成员可从个人档案进入团详情，使用点赞券为同团 GM 或玩家点赞。'],
  ['反馈与举报', '在个人档案或团务管理旁的「反馈」「举报」入口提交意见。举报需填写被举报账号或昵称，并附上至少一张图片；管理员会在后台受理，可从头像菜单的「工单」查看受理状态。'],
] as const;

const memberBenefits = [
  ['已上线 · 动态鎏金头像框', '会员头像会带上缓缓流动的鎏金光环，显示在主界面团卡片、团详情、右上角头像和个人资料里；普通用户为纯黑描边。'],
  ['已上线 · 自定义展示铭牌', '会员可在「个人资料 → 铭牌」挑选样式并自定义文字（最多 6 个汉字或 12 个英文字符），佩戴后显示在昵称旁和自己发布的团卡片上。'],
  ['已上线 · 贴纸库与长条贴纸', '贴纸为会员专享：非会员无法上传；会员可在「个人资料 → 贴纸」预存最多 10 张长条贴纸，并把其中 2 张设为默认佩戴。发车、编辑已发团或团务管理时都能直接上传并裁剪，上传后自动存入贴纸库；库存满 10 张时会提示已超库存，需自己点选一张替换，不会自动挤掉旧图。新上传的贴纸只进库存、不会自动默认佩戴，发车时自行选用（最多 2 张，只对本团生效）；手机上也能直接选图裁剪。「我的贴纸」标题右侧可勾选是否公开自己的贴纸库存，右上角的「贴纸广场」按钮可打开独立页面浏览其他会员公开的贴纸；点图片右下角的空心星 ☆ 即可加入库存，变成黄心 ★ 表示已拥有，只复制引用、不改对方库存、不自动默认佩戴，广场不显示其他会员的 QQ 号。会员权益到期后铭牌与贴纸按钮会置灰，已发布的团不受影响。'],
  ['已上线 · 更多 GM 点赞券', '累计签到每满 7 次，按当次身份发放 GM 点赞券：会员 3 张、普通用户 1 张。累计签到次数全站统一，升级会员或变为普通用户都不会清零，切换身份时已攒的次数继续有效；会员期间断签不清零，普通用户期间断签才重新计算。每天签到仍可获得 1 张玩家点赞券。结团后可在团详情给同团 GM 或玩家点赞。'],
  ['全站功能 · 动态头像与动态封面', '上传 GIF、APNG 或动态 WebP 时会原样保留动画、不裁剪（不超过 8MB），静态图仍可裁剪压缩。这是全站基础功能，所有登录用户都可使用，并非会员专属。'],
  ['开通与续费（已开放）', '加入交流群 917744498 联系站长开通或续费，开通前请先在本站用 QQ 号登录，方便核对身份。'],
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
