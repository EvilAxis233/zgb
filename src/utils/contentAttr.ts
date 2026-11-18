/**
 * GM圆桌「内容属性」支持多选：后端统一存成「、」连接的字符串，
 * 展示时拆回数组逐项渲染 chip（兼容旧数据里的单个值）。
 */
export const CONTENT_ATTR_SEP = '、';

export const splitContentAttrs = (value?: string): string[] =>
  String(value || '').split(/[、,，]/).map((s) => s.trim()).filter(Boolean);
