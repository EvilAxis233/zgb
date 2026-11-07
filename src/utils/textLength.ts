// 中文及全角字符按 2 计，ASCII 按 1 计；上限 20 即「10 个中文字符 / 20 个英文字符」。
// 站内规则名、昵称的字数限制都用同一套算法，这里给宣群平台自填复用。
export const textWidth = (value: string): number =>
  Array.from(value).reduce((total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2), 0);

export const PROMO_PLATFORM_MAX_WIDTH = 20;
export const PROMO_PLATFORM_HINT = '最多 10 个中文字符或 20 个英文字符';

// 输入时按宽度截断，保证永远不会输入超限内容（中文算 2，英文算 1）。
export const clampByWidth = (value: string, max = PROMO_PLATFORM_MAX_WIDTH): string => {
  let width = 0;
  let result = '';
  for (const character of Array.from(value)) {
    const charWidth = /^[\x00-\x7F]$/.test(character) ? 1 : 2;
    if (width + charWidth > max) break;
    width += charWidth;
    result += character;
  }
  return result;
};
