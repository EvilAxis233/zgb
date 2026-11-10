import React, { useState, useEffect, useMemo } from 'react';
import {
  toDateString,
  parseDateString,
  getWeekDayName,
  buildTimeSchedule,
  parseTimeSchedule,
  formatDisplayTime,
  formatPeriod,
  PERIOD_HINT,
  TimePeriod,
  TIME_PERIODS,
} from '../utils/date';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Check } from 'lucide-react';

interface CalendarPickerProps {
  value: string;
  onChange: (timeSchedule: string) => void;
  multiple?: boolean;
  selectedSlots?: string[];
  onChangeSlots?: (slots: string[]) => void;
  maxDaysAhead?: number | null; // null 表示未来日期不设上限
  hideHeader?: boolean;
  borderless?: boolean;
}

export const CalendarPicker: React.FC<CalendarPickerProps> = ({
  value,
  onChange,
  multiple = false,
  selectedSlots = [],
  onChangeSlots,
  maxDaysAhead = 31,
  hideHeader = false,
  borderless = false,
}) => {
  // 今日与最晚日期
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => toDateString(today), [today]);

  const maxDate = useMemo(() => {
    const d = new Date(today);
    if (maxDaysAhead !== null) d.setDate(d.getDate() + maxDaysAhead);
    return d;
  }, [today, maxDaysAhead]);

  const maxDateStr = useMemo(() => maxDaysAhead === null ? null : toDateString(maxDate), [maxDate, maxDaysAhead]);

  // 从传入的 value 解析已选中的日期与时段
  const parsedValue = useMemo(() => parseTimeSchedule(value), [value]);

  const [selectedDate, setSelectedDate] = useState<string>(parsedValue.dateStr || '');
  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod | null>(parsedValue.period || null);
  const slotMap = useMemo(() => {
    const map = new Map<string, Set<TimePeriod>>();
    for (const slot of selectedSlots) {
      const parsed = parseTimeSchedule(slot);
      if (parsed.dateStr && parsed.period) map.set(parsed.dateStr, new Set([...(map.get(parsed.dateStr) || []), parsed.period]));
    }
    return map;
  }, [selectedSlots]);

  // 日历当前展示的年份和月份
  const [viewYear, setViewYear] = useState<number>(() => {
    if (parsedValue.dateStr) {
      const d = parseDateString(parsedValue.dateStr);
      if (d) return d.getFullYear();
    }
    return today.getFullYear();
  });

  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (parsedValue.dateStr) {
      const d = parseDateString(parsedValue.dateStr);
      if (d) return d.getMonth();
    }
    return today.getMonth();
  });

  // 当外部 value 变化且合法时同步内部状态
  useEffect(() => {
    if (multiple) return;
    const parsed = parseTimeSchedule(value);
    if (parsed.valid && parsed.dateStr && parsed.period) {
      setSelectedDate(parsed.dateStr);
      setSelectedPeriod(parsed.period);
    }
  }, [value, multiple]);

  // 触发 onChange 向上通知
  const handleSelect = (dateStr: string, period: TimePeriod | null) => {
    setSelectedDate(dateStr);
    setSelectedPeriod(period);
    if (dateStr && period) {
      const formatted = buildTimeSchedule(dateStr, period);
      onChange(formatted);
    } else {
      onChange('');
    }
  };
  const toggleSlot = (period: TimePeriod) => {
    if (!selectedDate) return;
    const target = `${selectedDate}:${period}`;
    const keys = selectedSlots.map((slot) => {
      const parsed = parseTimeSchedule(slot);
      return `${parsed.dateStr}:${parsed.period}`;
    });
    const next = keys.includes(target)
      ? selectedSlots.filter((_, index) => keys[index] !== target)
      : [...selectedSlots, buildTimeSchedule(selectedDate, period)];
    onChangeSlots?.(next.sort((a, b) => a.localeCompare(b, 'zh-CN')));
  };

  // 月份切换
  const canGoPrevMonth = useMemo(() => {
    // 检查上个月的最后一天是否在今天之后或当天
    const lastDayOfPrevMonth = new Date(viewYear, viewMonth, 0);
    return toDateString(lastDayOfPrevMonth) >= todayStr;
  }, [viewYear, viewMonth, todayStr]);

  const canGoNextMonth = useMemo(() => {
    // 检查下个月第一天是否在最晚日期之前或当天
    const firstDayOfNextMonth = new Date(viewYear, viewMonth + 1, 1);
    return maxDateStr === null || toDateString(firstDayOfNextMonth) <= maxDateStr;
  }, [viewYear, viewMonth, maxDateStr]);

  const handlePrevMonth = () => {
    if (!canGoPrevMonth) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNextMonth) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // 生成当前月所有的日期格子
  const daysInMonth = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const totalDays = lastDay.getDate();

    // 周一为一周开始 (0: 周一 ... 6: 周日)
    let startDayOfWeek = firstDay.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const days: {
      dateStr: string;
      dayNumber: number;
      isSelectable: boolean;
      isToday: boolean;
      isSelected: boolean;
    }[] = [];

    // 空白前置位
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({
        dateStr: '',
        dayNumber: 0,
        isSelectable: false,
        isToday: false,
        isSelected: false,
      });
    }

    // 当月每一天
    for (let d = 1; d <= totalDays; d++) {
      const dateObj = new Date(viewYear, viewMonth, d);
      const str = toDateString(dateObj);
      const isSelectable = str >= todayStr && (maxDateStr === null || str <= maxDateStr);
      const isToday = str === todayStr;
      const isSelected = str === selectedDate;

      days.push({
        dateStr: str,
        dayNumber: d,
        isSelectable,
        isToday,
        isSelected,
      });
    }

    return days;
  }, [viewYear, viewMonth, todayStr, maxDateStr, selectedDate]);

  const selectedDateWeekDay = useMemo(() => {
    if (!selectedDate) return '';
    const d = parseDateString(selectedDate);
    return d ? getWeekDayName(d) : '';
  }, [selectedDate]);

  return (
    <div className={`${borderless ? 'p-1 space-y-3' : 'border-2 border-[#121212] bg-[#FAF9F5] p-3.5 space-y-3.5'}`}>
      {/* 顶部标题与范围提示 */}
      {!hideHeader && (
        <div className="flex items-center justify-between border-b-2 border-[#121212] pb-2">
          <div className="flex items-center gap-1.5 font-black text-xs text-[#121212]">
            <CalendarIcon className="w-4 h-4 text-[#D62828]" />
            <span>{multiple ? '选择多个开团日期与时段' : '选择开团日期与时段'}</span>
          </div>
          <span className="text-[11px] font-bold text-[#666666] bg-[#FFFFFF] px-2 py-0.5 border border-[#CCCCCC]">
            {maxDaysAhead === null ? '可选任意未来日期' : `可选今日起最晚 ${maxDaysAhead} 天内`}
          </span>
        </div>
      )}

      {/* 日历导航条 */}
      <div className="flex items-center justify-between bg-white px-3 py-1.5 border-2 border-[#121212] shadow-[2px_2px_0px_#121212]">
        <button
          type="button"
          onClick={handlePrevMonth}
          disabled={!canGoPrevMonth}
          className={`p-1 border border-[#121212] transition-colors ${
            canGoPrevMonth
              ? 'hover:bg-[#D62828] hover:text-white cursor-pointer text-[#121212]'
              : 'opacity-25 cursor-not-allowed bg-[#EAE8E0] text-[#888888]'
          }`}
          title="上个月"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <span className="text-sm font-black text-[#121212] tracking-wider">
          {viewYear} 年 {viewMonth + 1} 月
        </span>

        <button
          type="button"
          onClick={handleNextMonth}
          disabled={!canGoNextMonth}
          className={`p-1 border border-[#121212] transition-colors ${
            canGoNextMonth
              ? 'hover:bg-[#D62828] hover:text-white cursor-pointer text-[#121212]'
              : 'opacity-25 cursor-not-allowed bg-[#EAE8E0] text-[#888888]'
          }`}
          title="下个月"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* 星期行 */}
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-black text-[#121212] border-b border-[#E0DED7] pb-1">
        <span>一</span>
        <span>二</span>
        <span>三</span>
        <span>四</span>
        <span>五</span>
        <span className="text-[#D62828]">六</span>
        <span className="text-[#D62828]">日</span>
      </div>

      {/* 日期网格 */}
      <div className="grid grid-cols-7 gap-1">
        {daysInMonth.map((day, idx) => {
          if (!day.dateStr) {
            return <div key={`empty-${idx}`} className="h-9" />;
          }

          if (!day.isSelectable) {
            return (
              <div
                key={day.dateStr}
                className="h-9 flex items-center justify-center text-xs text-[#BBBBBB] select-none cursor-not-allowed bg-transparent"
              >
                {day.dayNumber}
              </div>
            );
          }

          return (
            <button
              key={day.dateStr}
              type="button"
              onClick={() => multiple ? setSelectedDate(day.dateStr) : handleSelect(day.dateStr, selectedPeriod)}
              className={`h-9 relative flex flex-col items-center justify-center text-xs font-bold transition-all cursor-pointer border ${
                day.isSelected
                  ? 'bg-[#121212] text-white border-[#121212] shadow-[2px_2px_0px_#D62828]'
                  : 'bg-white text-[#121212] border-[#CCCCCC] hover:border-[#121212] hover:bg-[#FAF0E6]'
              }`}
            >
              <span>{day.dayNumber}</span>
              {multiple && slotMap.has(day.dateStr) && <span className="text-[9px] leading-none">{[...slotMap.get(day.dateStr)!].join('')}</span>}
              {day.isToday && (
                <span
                  className={`text-[9px] leading-none font-bold ${
                    day.isSelected ? 'text-[#F4A261]' : 'text-[#D62828]'
                  }`}
                >
                  今
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* 时段划分：早、中、晚 */}
      <div className="border-t-2 border-[#121212] pt-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <label className="text-xs font-black text-[#121212] flex items-center gap-1 shrink-0">
            <span className="w-2 h-2 bg-[#004E98]" />
            <span>开团时段 ({PERIOD_HINT})</span>
            <span className="text-[#D62828]">*</span>
          </label>
          {selectedDate && (
            <span className="text-xs font-bold text-[#004E98] shrink-0">
              已选日期: {selectedDate} ({selectedDateWeekDay})
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {TIME_PERIODS.map(({ key, label, desc }) => {
            const isChosen = multiple ? !!slotMap.get(selectedDate)?.has(key) : selectedPeriod === key;
            return (
              <button
                key={key}
                type="button"
                disabled={!selectedDate}
                onClick={() => multiple ? toggleSlot(key) : handleSelect(selectedDate, key)}
                className={`p-2.5 flex flex-col items-center justify-center border-2 transition-all ${
                  !selectedDate
                    ? 'opacity-40 cursor-not-allowed border-[#CCCCCC] bg-[#EEEEEE] text-[#888888]'
                    : isChosen
                    ? 'bg-[#004E98] text-white border-[#121212] shadow-[3px_3px_0px_#121212] scale-[1.02]'
                    : 'bg-white text-[#121212] border-[#121212] hover:bg-[#FAF0E6] cursor-pointer'
                }`}
              >
                <div className="flex items-center gap-1">
                  {isChosen && <Check className="w-3.5 h-3.5 text-white" />}
                  <span className="text-sm font-black">{label}</span>
                </div>
                <span className={`text-[10px] mt-0.5 ${isChosen ? 'text-white/80' : 'text-[#666666]'}`}>
                  {key === '早' ? '上午' : key === '中' ? '下午' : '晚上'}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 底部结果提示栏：未选前留空，选完后直接展示时间 */}
      <div
        className={`px-3 py-2 text-xs font-bold border flex items-center justify-center min-h-[38px] transition-all ${
          multiple ? selectedSlots.length > 0 : selectedDate && selectedPeriod
            ? 'bg-[#EBF7EE] border-[#2A9D8F] text-[#1E6B60] shadow-[2px_2px_0px_#121212]'
            : 'bg-white/60 border-[#E0DED7]'
        }`}
      >
        {multiple ? (
          <span className="text-[#121212] text-center">{selectedSlots.length ? `已选 ${selectedSlots.length} 个时段：${selectedSlots.map(formatDisplayTime).join('、')}` : `点击日期，再选择${PERIOD_HINT}；再次点击时段可取消`}</span>
        ) : selectedDate && selectedPeriod ? (
          <span className="font-mono font-black text-xs sm:text-sm text-[#121212]">
            {`${selectedDate}（${selectedDateWeekDay}）${formatPeriod(selectedPeriod)}`}
          </span>
        ) : null}
      </div>
    </div>
  );
};
