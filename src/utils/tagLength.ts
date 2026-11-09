// 自定义标签长度口径：中文/全角按 2，半角英文按 1，总宽度上限 12。
// 也就是「最多 6 个中文字符」或「最多 12 个英文字符」，混排按宽度折算。
export const TAG_MAX_WIDTH = 12;
export const TAG_MAX_COUNT = 6;
export const TAG_LIMIT_HINT = '最多 6 个，每个最多 6 个中文字符 / 12 个英文字符';

export const tagWidth = (value: string) =>
  Array.from(value).reduce((total, character) => total + (/^[\x00-\x7F]$/.test(character) ? 1 : 2), 0);

export const tagTooLong = (value: string) => tagWidth(value) > TAG_MAX_WIDTH;

/** 输入时即时截断到允许宽度，避免用户打完才被提示超长。 */
export const clampTag = (value: string) => {
  let result = '';
  let width = 0;
  for (const character of Array.from(value)) {
    const step = /^[\x00-\x7F]$/.test(character) ? 1 : 2;
    if (width + step > TAG_MAX_WIDTH) break;
    result += character;
    width += step;
  }
  return result;
};
