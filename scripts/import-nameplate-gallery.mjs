import fs from 'node:fs';

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error('Usage: node scripts/import-nameplate-gallery.mjs <50.html>');
const source = fs.readFileSync(sourcePath, 'utf8');
const excluded = new Set(['D08', 'D20', 'D26']);

const entries = [...source.matchAll(/id: '([DS]\d{2})', codeClass: 'np-[ds]\d{2}', type: '(dynamic|static)', category: '[^']+',\s*name: '([^']+)', desc: '[^']+', font: '([^']+)'/g)]
  .map((match) => ({ code: match[1], type: match[2], name: match[3], font: match[4] }))
  .filter((entry) => !excluded.has(entry.code));
if (entries.length !== 47) throw new Error(`Expected 47 selected styles; found ${entries.length}`);

const marks = {
  D01:['♛','◆'], D02:['⚡','_V9'], D03:['✦','SSR'], D04:['♨','✦'], D05:['❄','❄'], D06:['⚡','⚡'], D07:['[›',']'],
  D09:['⚙','⚙'], D10:['☯','●'], D11:['♪','♫'], D12:['≋','♦'], D13:['❧','☀'], D14:['◉','☠'], D15:['▣','●'],
  D16:['⊕','LOCK'], D17:['✿','✿'], D18:['⊗','✦'], D19:['☢','⚠'], D21:['◈','✹'], D22:['▂▆▃','♫'], D23:['⚔','≋'],
  D24:['◈','✦'], D25:['❧','✿'], D27:['◉','☼'], D28:['●','EVA'], D29:['❖','✸'], D30:['∞','✳'],
  S01:['御','印'], S02:['◉','●'], S03:['龍','◈'], S04:['◈','◈'], S05:['☁','❖'], S06:['■','CH'], S07:['☺','!'],
  S08:['◉','GT'], S09:['◉','A-90'], S10:['♛','❧'], S11:['●','●'], S12:['◈','●'], S13:['♞','★'], S14:['◆','★'],
  S15:['▣','24F'], S16:['▰','✎'], S17:['◼','TOP'], S18:['♛','✝'], S19:['✈','80分'], S20:['⛨','♞'],
};
if (entries.some((entry) => !marks[entry.code])) throw new Error('A selected style is missing ornaments');

const fontFamily = (font) => font.includes('f-calli') ? 'calligraphy'
  : font.includes('f-cursive') ? 'cursive'
  : font.includes('f-fun') ? 'fun'
  : font.includes('f-tech') ? 'tech'
  : font.includes('f-classic') ? 'classic'
  : font.includes('f-serif') ? 'serif' : 'sans';
const data = `// Adapted from the user-provided 50.html. D08, D20 and D26 were excluded.\n` +
  `export const REFERENCE_NAMEPLATE_STYLES = ${JSON.stringify(entries.map((entry) => ({
    id: `nb-ref-${entry.code.toLowerCase()}`,
    code: `50-${entry.code}`,
    name: entry.name,
    type: entry.type,
    font: fontFamily(entry.font),
    leftMark: marks[entry.code][0],
    rightMark: marks[entry.code][1],
  })), null, 2)} as const;\n`;
fs.writeFileSync('src/nameplateGallery.ts', data, 'utf8');

const styleStart = source.indexOf('/* ================= 公共关键帧动画');
const styleEnd = source.indexOf('/* 卡片悬浮微效 */');
if (styleStart < 0 || styleEnd < styleStart) throw new Error('Could not find source CSS');
let css = source.slice(styleStart, styleEnd);
for (const code of excluded) {
  const number = code.slice(1);
  css = css.replace(new RegExp(`/\\* ${code}:.*?\\*/[\\s\\S]*?(?=/\\* D${String(Number(number) + 1).padStart(2, '0')}:)`, 'g'), '');
}
css = css.replaceAll('.np-', '.nb-ref-');
css = css.replace('30 款动态铭牌独立样式 (np-d01 ~ np-d30)', '27 款动态铭牌独立样式 (np-d01 ~ np-d30，排除 D08、D20、D26)');
const keyframes = [...css.matchAll(/@keyframes ([\w-]+)/g)].map((match) => match[1]);
for (const keyframe of keyframes) css = css.replace(new RegExp(`\\b${keyframe}\\b`, 'g'), `ref-${keyframe}`);
css = `/* Styles adapted from the user-provided 50.html for the site's compact badges. */\n` +
  `.nb-badge[class*="nb-ref-"] { gap: 3px; min-width: 74px; max-width: 150px; padding-inline: 8px; }\n` +
  `.nb-badge[class*="nb-ref-"] .nb-text { flex: 0 1 auto; min-width: 0; }\n` +
  `.nb-ref-mark { position: relative; z-index: 2; flex: none; font-size: 10px; line-height: 1; }\n` +
  `.nb-ref-mark-long { font-size: 8px; letter-spacing: -.5px; }\n` +
  `.nb-ref-font-serif { font-family: Georgia, "SimSun", serif; }\n` +
  `.nb-ref-font-calligraphy, .nb-ref-font-cursive { font-family: "KaiTi", "STKaiti", cursive; }\n` +
  `.nb-ref-font-fun { font-family: "Microsoft YaHei", sans-serif; font-weight: 900; }\n` +
  `.nb-ref-font-tech { font-family: Consolas, monospace; }\n` +
  `.nb-ref-font-classic { font-family: "SimSun", serif; }\n` +
  `.nb-ref-font-sans { font-family: "Microsoft YaHei", sans-serif; }\n` + css +
  `\n/* Glass needs its own contrast on light cards, without a separate preview backdrop. */\n.nb-ref-s12 { background: rgba(46, 58, 78, .9); }\n` +
  `\n@media (prefers-reduced-motion: reduce) { .nb-badge[class*="nb-ref-"], .nb-badge[class*="nb-ref-"]::before, .nb-badge[class*="nb-ref-"]::after, .nb-badge[class*="nb-ref-"] .nb-ref-mark, .nb-badge[class*="nb-ref-"] .nb-ref-mark * { animation: none !important; } }\n`;
fs.writeFileSync('src/styles/nameplates-gallery.css', css, 'utf8');
console.log(`Imported ${entries.length} nameplates`);
