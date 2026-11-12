export type TimePeriod = '早' | '中' | '晚';

export const TIME_PERIODS: { key: TimePeriod; label: string; desc: string }[] = [
  { key: '早', label: '早', desc: '上午 (约 09:00 - 12:00)' },
  { key: '中', label: '午', desc: '下午 (约 13:30 - 18:00)' },
  { key: '晚', label: '晚', desc: '晚上 (约 19:00 - 23:30)' },
];

// 时段在页面上的显示字：「中」统一显示为「午」（数据库与接口仍沿用「中」，兼容存量数据与后端校验）。
const PERIOD_DISPLAY: Record<TimePeriod, string> = { 早: '早', 中: '午', 晚: '晚' };

export function formatPeriod(period: TimePeriod | null | undefined): string {
  return period ? PERIOD_DISPLAY[period] || period : '';
}

export const PERIOD_HINT = '早 / 午 / 晚';

// 封车（结算）时间：早场当天 12:00、午场当天 18:00、晚场次日 00:00，统一按北京时间（UTC+8）。
// 与后端 periodCloseAt 保持同一口径；24 表示「跨到次日零点」。
export const PERIOD_CLOSE_HOUR: Record<TimePeriod, number> = { 早: 12, 中: 18, 晚: 24 };

/** 该日期时段是否已经过了封车时间（过点后不再允许发布/报名） */
export function isSlotClosed(dateStr: string, period: TimePeriod, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const cutoff = new Date(`${dateStr}T00:00:00+08:00`).getTime() + PERIOD_CLOSE_HOUR[period] * 3600 * 1000;
  return now.getTime() >= cutoff;
}

/** 封车时间的展示文案，例如「12:00」「次日 00:00」 */
export function periodCloseLabel(period: TimePeriod): string {
  return PERIOD_CLOSE_HOUR[period] >= 24 ? '次日 00:00' : `${String(PERIOD_CLOSE_HOUR[period]).padStart(2, '0')}:00`;
}

const WEEKDAYS = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];

/**
 * 将本地 Date 对象转换为 YYYY-MM-DD 字符串（避免 UTC 造成的时区偏差）
 */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * 解析 YYYY-MM-DD / YYYY/MM/DD / YYYY.MM.DD 为本地 Date 对象
 */
export function parseDateString(str: string): Date | null {
  if (!str) return null;
  const match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;
  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10) - 1;
  const day = parseInt(match[3], 10);
  const d = new Date(year, month, day);
  return isNaN(d.getTime()) ? null : d;
}

/**
 * 获取星期几中文名称，如 '星期一' ... '星期日'
 */
export function getWeekDayName(d: Date): string {
  return WEEKDAYS[d.getDay()];
}

/**
 * 构建标准战役时间字符串：“日期（星期几）早中晚”
 * 例如：2026-10-16（星期五）晚
 */
export function buildTimeSchedule(dateStr: string, period: TimePeriod): string {
  const d = parseDateString(dateStr);
  const weekDay = d ? getWeekDayName(d) : '';
  return `${dateStr}（${weekDay}）${period}`;
}

export interface ParsedTimeSchedule {
  dateStr: string | null;
  weekDay: string | null;
  period: TimePeriod | null;
  valid: boolean;
  raw: string;
}

/**
 * 从可能的时间字符串中解析出日期和时段
 */
export function parseTimeSchedule(raw: string): ParsedTimeSchedule {
  if (!raw) {
    return { dateStr: null, weekDay: null, period: null, valid: false, raw: '' };
  }

  const str = raw.trim();

  // 1. 尝试匹配完整的标准格式或包含日期的格式
  // 例如：2026-10-16（星期五）晚 或 2026/10/16 (周五) 早 或 2026-10-16 晚
  const dateMatch = str.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  let dateStr: string | null = null;
  let weekDay: string | null = null;
  let period: TimePeriod | null = null;

  if (dateMatch) {
    const year = dateMatch[1];
    const month = dateMatch[2].padStart(2, '0');
    const day = dateMatch[3].padStart(2, '0');
    dateStr = `${year}-${month}-${day}`;

    const d = parseDateString(dateStr);
    if (d) {
      weekDay = getWeekDayName(d);
    }
  }

  // 2. 匹配时段
  if (/(早|上午|晨)/.test(str)) {
    period = '早';
  } else if (/(中|下午|午)/.test(str)) {
    period = '中';
  } else if (/(晚|夜)/.test(str)) {
    period = '晚';
  }

  const valid = Boolean(dateStr && period);

  return {
    dateStr,
    weekDay,
    period,
    valid,
    raw: str,
  };
}

/**
 * 格式化主页卡片/弹窗中统一展示的时间字符串
 * 确保显示为“日期（星期几）早中晚”，如“2026-10-16（星期五）晚”
 * 若为老数据无法解析出完整结构，则降级显示原内容
 */
export function formatDisplayTime(raw: string): string {
  if (!raw) return '时间待定';
  const parsed = parseTimeSchedule(raw);
  if (parsed.valid && parsed.dateStr && parsed.period) {
    const d = parseDateString(parsed.dateStr);
    const week = d ? getWeekDayName(d) : parsed.weekDay || '';
    return `${parsed.dateStr}（${week}）${formatPeriod(parsed.period)}`;
  }
  return raw;
}

/**
 * 获取相对于今日的偏移日期 YYYY-MM-DD
 */
export function getRelativeDateString(daysOffset: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return toDateString(d);
}

/**
 * 判断两个 YYYY-MM-DD 是否相同
 */
export function isSameDay(dateStr1: string, dateStr2: string): boolean {
  return dateStr1 === dateStr2;
}

/**
 * 获取本周末涵盖的日期集合（星期六与星期日，若本周已过则只计剩余）
 */
export function getWeekendDates(): string[] {
  const now = new Date();
  const day = now.getDay(); // 0 is Sunday, 6 is Saturday
  const dates: string[] = [];

  if (day === 6) {
    // 今天是周六
    dates.push(toDateString(now));
    const sun = new Date(now);
    sun.setDate(now.getDate() + 1);
    dates.push(toDateString(sun));
  } else if (day === 0) {
    // 今天是周日
    dates.push(toDateString(now));
  } else {
    // 周一至周五：获取本周六和本周日
    const satOffset = 6 - day;
    const sat = new Date(now);
    sat.setDate(now.getDate() + satOffset);
    dates.push(toDateString(sat));

    const sun = new Date(now);
    sun.setDate(now.getDate() + satOffset + 1);
    dates.push(toDateString(sun));
  }

  return dates;
}

/**
 * 时间筛选逻辑辅助函数
 */
export function matchCampaignTime(
  campaignTime: string,
  datePreset: 'all' | 'today' | 'tomorrow' | 'weekend' | 'week' | 'custom',
  customDate: string,
  periodFilter: 'all' | TimePeriod
): boolean {
  // 如果完全没有时间筛选限制，直接通过
  if (datePreset === 'all' && periodFilter === 'all') {
    return true;
  }

  const parsed = parseTimeSchedule(campaignTime);

  // 时段筛选检查
  if (periodFilter !== 'all') {
    if (!parsed.period || parsed.period !== periodFilter) {
      return false;
    }
  }

  // 日期筛选检查
  if (datePreset === 'all') {
    return true;
  }

  // 如果筛选了具体日期或范围，但该团解析不出日期，则不匹配
  if (!parsed.dateStr) {
    return false;
  }

  const todayStr = getRelativeDateString(0);
  const tomorrowStr = getRelativeDateString(1);

  switch (datePreset) {
    case 'today':
      return parsed.dateStr === todayStr;

    case 'tomorrow':
      return parsed.dateStr === tomorrowStr;

    case 'weekend': {
      const weekendDates = getWeekendDates();
      return weekendDates.includes(parsed.dateStr);
    }

    case 'week': {
      // 未来 7 天：今天到今天+6天
      const parsedDate = parseDateString(parsed.dateStr);
      const todayDate = parseDateString(todayStr);
      if (!parsedDate || !todayDate) return false;
      const diffTime = parsedDate.getTime() - todayDate.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays < 7;
    }

    case 'custom': {
      if (!customDate) return true;
      return parsed.dateStr === customDate;
    }

    default:
      return true;
  }
}
