// 从 functions/api/[[path]].js 里抽出真实邮件模板函数，生成「所见即所得」的预览页。
// 用法：node scripts/gen-signup-mail-preview.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const apiFile = path.resolve(here, '../functions/api/[[path]].js');
const templateFile = path.resolve(here, 'signup-mail-preview.template.html');
const outFile = path.resolve(here, '../../signup-mail-preview.html');

const source = fs.readFileSync(apiFile, 'utf8');
const start = source.indexOf('// === SIGNUP_MAIL_TEMPLATE_START ===');
const end = source.indexOf('// === SIGNUP_MAIL_TEMPLATE_END ===');
if (start < 0 || end < 0 || end <= start) throw new Error('找不到邮件模板标记，请检查 [[path]].js');
const block = source.slice(start, end);
const buildSignupMail = new Function(block + '\nreturn buildSignupMail;')();

const hk = new Intl.DateTimeFormat('zh-CN', {
  timeZone: 'Asia/Hong_Kong', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hour12: false,
});
const parts = Object.fromEntries(hk.formatToParts(new Date()).map((p) => [p.type, p.value]));
const stamp = `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}（香港时间）`;
const shortTime = `${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
const manageUrl = 'https://pigbee.fun/?view=manage';

const base = {
  gmName: '雾灯',
  manageUrl,
  happenedAt: stamp,
};
const samples = [
  {
    key: 'signup',
    label: '新玩家报名 · 网团',
    preview: '山雀 报名了你的团，当前 3/4 人…',
    data: {
      ...base,
      event: 'signup',
      playerName: '山雀',
      playerQq: '123456789',
      title: '克苏鲁的呼唤 · 追书人',
      rule: 'COC 7th',
      timeSchedule: '2026-11-14 晚',
      modeLine: '网团 · 语音 · QQ、Kook',
      location: '',
      currentPlayers: 3,
      maxPlayers: 4,
    },
  },
  {
    key: 'full',
    label: '新玩家报名 · 面团满员',
    preview: '阿盐 报名后本团已满员，可准备封车…',
    data: {
      ...base,
      event: 'signup',
      playerName: '阿盐',
      playerQq: '987654321',
      title: '龙与地下城 · 灰鹰之夜',
      rule: 'DND 5e',
      timeSchedule: '2026-11-21 晚',
      modeLine: '面团 · 上海市 徐汇区',
      location: '上海市 徐汇区 桌游吧（详细地址报名后告知）',
      currentPlayers: 4,
      maxPlayers: 4,
    },
  },
  {
    key: 'cancel',
    label: '玩家取消报名',
    preview: '山雀 取消了报名，名额已释放…',
    data: {
      ...base,
      event: 'cancel',
      playerName: '山雀',
      playerQq: '123456789',
      title: '克苏鲁的呼唤 · 追书人',
      rule: 'COC 7th',
      timeSchedule: '2026-11-14 晚',
      modeLine: '网团 · 语音 · QQ、Kook',
      location: '',
      currentPlayers: 2,
      maxPlayers: 4,
    },
  },
];

const mails = samples.map((sample) => {
  const mail = buildSignupMail(sample.data);
  return {
    key: sample.key,
    label: sample.label,
    preview: sample.preview,
    from: '诸告板 <login@mail.dhvault.top>',
    to: '892134567@qq.com',
    time: shortTime,
    date: stamp,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
  };
});

const json = JSON.stringify(mails)
  .replace(/</g, '\\u003c')
  .replace(/\u2028/g, '\\u2028')
  .replace(/\u2029/g, '\\u2029');
const template = fs.readFileSync(templateFile, 'utf8');
if (!template.includes('/*__MAILS__*/')) throw new Error('预览模板缺少 __MAILS__ 占位符');
fs.writeFileSync(outFile, template.replace('/*__MAILS__*/', json), 'utf8');
console.log(`已生成 ${outFile}`);
for (const mail of mails) console.log(`  - ${mail.label}: ${mail.subject} (HTML ${mail.html.length} 字符 / 纯文本 ${mail.text.length} 字符)`);
