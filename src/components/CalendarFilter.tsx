import React, { useState, useMemo } from 'react';
import {
  toDateString,
  parseDateString,
  getWeekDayName,
} from '../utils/date';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, X } from 'lucide-react';

interface CalendarFilterProps {
  selectedDate: string | null;
  onSelectDate: (dateStr: string | null) => void;
  activeDatesWithCampaigns?: Set<string>;
  maxDaysAhead?: number; // 默认往后 30 天
}

const WEEKDAY_HEADERS = ['一', '二', '三', '四', '五', '六', '日'];

export const CalendarFilter: React.FC<CalendarFilterProps> = ({
  selectedDate,
  onSelectDate,
  activeDatesWithCampaigns = new Set(),
  maxDaysAhead = 30,
}) => {
  // 今日 00:00:00
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const todayStr = useMemo(() => toDateString(today), [today]);

  // 最晚可选日期（往后一个月）
  const maxDate = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() + maxDaysAhead);
    return d;
  }, [today, maxDaysAhead]);

  const maxDateStr = useMemo(() => toDateString(maxDate), [maxDate]);

  // 当前展示的年月
  const [viewYear, setViewYear] = useState<number>(() => today.getFullYear());
  const [viewMonth, setViewMonth] = useState<number>(() => today.getMonth());

  // 计算是否可以翻页
  const canGoPrev = useMemo(() => {
    return viewYear > today.getFullYear() || (viewYear === today.getFullYear() && viewMonth > today.getMonth());
  }, [viewYear, viewMonth, today]);

  const canGoNext = useMemo(() => {
    return viewYear < maxDate.getFullYear() || (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth());
  }, [viewYear, viewMonth, maxDate]);

  const handlePrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  // 生成当前月的所有日期单元格
  const daysInCurrentMonth = useMemo(() => {
    return new Date(viewYear, viewMonth + 1, 0).getDate();
  }, [viewYear, viewMonth]);

  // 1号是周几 (0 为周日，转为以周一为0的坐标)
  const startDayOffset = useMemo(() => {
    const dayOfWeek = new Date(viewYear, viewMonth, 1).getDay();
    return (dayOfWeek + 6) % 7;
  }, [viewYear, viewMonth]);

  const calendarDays = useMemo(() => {
    const cells: {
      key: string;
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isInRange: boolean;
      hasCampaigns: boolean;
      isSelected: boolean;
    }[] = [];

    // 空占位单元格
    for (let i = 0; i < startDayOffset; i++) {
      cells.push({
        key: `empty-${i}`,
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isToday: false,
        isInRange: false,
        hasCampaigns: false,
        isSelected: false,
      });
    }

    // 当月天数
    for (let d = 1; d <= daysInCurrentMonth; d++) {
      const yearStr = String(viewYear);
      const monthStr = String(viewMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${yearStr}-${monthStr}-${dayStr}`;

      const isToday = dateStr === todayStr;
      const isInRange = dateStr >= todayStr && dateStr <= maxDateStr;
      const hasCampaigns = activeDatesWithCampaigns.has(dateStr);
      const isSelected = selectedDate === dateStr;

      cells.push({
        key: dateStr,
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isToday,
        isInRange,
        hasCampaigns,
        isSelected,
      });
    }

    return cells;
  }, [viewYear, viewMonth, daysInCurrentMonth, startDayOffset, todayStr, maxDateStr, activeDatesWithCampaigns, selectedDate]);

  const selectedDateLabel = useMemo(() => {
    if (!selectedDate) return null;
    const d = parseDateString(selectedDate);
    if (!d) return selectedDate;
    const week = getWeekDayName(d);
    return `${selectedDate}（${week}）`;
  }, [selectedDate]);

  return (
    <div className="space-y-2 pt-2 border-t border-[#E5E5E0]">
      {/* 标题栏 */}
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#121212] flex items-center gap-1.5">
          <CalendarIcon className="w-3.5 h-3.5 text-[#D62828]" />
          <span>按日期筛团</span>
        </label>
        {selectedDate && (
          <span className="text-[10px] text-[#D62828] font-bold">已选日期</span>
        )}
      </div>

      {/* 日历主体盒子 */}
      <div className="bg-[#FAF9F5] border border-[#121212] p-2 space-y-1.5 select-none">
        {/* 年月份导航 */}
        <div className="flex items-center justify-between px-1 text-xs font-black text-[#121212]">
          <span>
            {viewYear}年{viewMonth + 1}月
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              disabled={!canGoPrev}
              title="上个月"
              className={`p-0.5 border border-[#121212] transition-colors ${
                canGoPrev
                  ? 'bg-white hover:bg-[#121212] hover:text-white cursor-pointer'
                  : 'bg-[#E5E5E0] text-[#AAAAAA] cursor-not-allowed border-[#CCCCCC]'
              }`}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              disabled={!canGoNext}
              title="下个月"
              className={`p-0.5 border border-[#121212] transition-colors ${
                canGoNext
                  ? 'bg-white hover:bg-[#121212] hover:text-white cursor-pointer'
                  : 'bg-[#E5E5E0] text-[#AAAAAA] cursor-not-allowed border-[#CCCCCC]'
              }`}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 星期表头 */}
        <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-bold text-[#666666] border-b border-[#E5E5E0] pb-1">
          {WEEKDAY_HEADERS.map((w, idx) => (
            <div key={w} className={idx >= 5 ? 'text-[#D62828]' : ''}>
              {w}
            </div>
          ))}
        </div>

        {/* 日期网格 */}
        <div className="grid grid-cols-7 gap-0.5 text-center">
          {calendarDays.map((cell) => {
            if (!cell.isCurrentMonth) {
              return <div key={cell.key} className="h-6" />;
            }

            const disabled = !cell.isInRange;

            let btnClass = 'bg-white text-[#121212] border border-transparent hover:border-[#121212] hover:bg-[#F2F0E8] cursor-pointer';
            if (cell.isSelected) {
              btnClass = 'bg-[#121212] text-white border border-[#121212] font-black shadow-[1px_1px_0px_#D62828]';
            } else if (disabled) {
              btnClass = 'text-[#BBBBBB] bg-transparent cursor-not-allowed pointer-events-none';
            } else if (cell.isToday) {
              btnClass = 'bg-white text-[#D62828] border border-[#D62828] font-bold hover:bg-[#D62828] hover:text-white';
            }

            return (
              <button
                key={cell.key}
                type="button"
                disabled={disabled}
                onClick={() => {
                  if (cell.isSelected) {
                    onSelectDate(null);
                  } else {
                    onSelectDate(cell.dateStr);
                  }
                }}
                title={
                  disabled
                    ? '超出可选范围'
                    : `${cell.dateStr}${cell.hasCampaigns ? '（有开团战役）' : ''}`
                }
                className={`relative h-6 text-[11px] font-medium flex flex-col items-center justify-center transition-all ${btnClass}`}
              >
                <span className="leading-none">{cell.dayNum}</span>
                {/* 开团标记红点 */}
                {cell.hasCampaigns && !cell.isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#D62828]" />
                )}
                {cell.hasCampaigns && cell.isSelected && (
                  <span className="absolute bottom-0.5 w-1 h-1 rounded-full bg-[#F4A261]" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 选中日期提示及快速取消 */}
      {selectedDate && (
        <div className="flex items-center justify-between p-1.5 bg-[#FAF0F0] border border-[#D62828] text-xs">
          <span className="font-bold text-[#D62828] truncate text-[11px]">
            {selectedDateLabel}
          </span>
          <button
            type="button"
            onClick={() => onSelectDate(null)}
            className="text-[11px] font-black text-[#D62828] hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
          >
            <X className="w-3 h-3" />
            <span>取消</span>
          </button>
        </div>
      )}
    </div>
  );
};
