'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { availableDates, getDatesByMonth, getWeekNumber } from '@/lib/reports';
import { hasEvent } from '@/lib/events';
import { dashboardConfig } from '@/config/dashboard.config';
import { ThemeToggle } from './theme-toggle';
import { Toolbox } from './toolbox';
import type { ExportFormat } from '@/hooks/use-export-report';

interface DateNavProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  reportType?: 'daily' | 'weekly';
  onReportTypeChange?: (type: 'daily' | 'weekly') => void;
  viewMode?: 'report' | 'headline' | 'events' | 'outlook';
  onViewModeChange?: (mode: 'report' | 'headline' | 'events' | 'outlook') => void;
  onExport?: (format: ExportFormat) => void;
  isExporting?: boolean;
}

// 获取今天日期
const TODAY = new Date().toISOString().split('T')[0];

// 判断日期状态
type DateStatus = 'has-report' | 'no-report-past' | 'no-report-future' | 'no-report-before-start' | 'today' | 'weekend';

function getDateStatus(dateStr: string): DateStatus {
  if (availableDates.includes(dateStr)) {
    return 'has-report';
  }

  const date = new Date(dateStr);
  const today = new Date(TODAY);
  const dayOfWeek = date.getDay();

  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return 'weekend';
  }

  if (dateStr === TODAY) {
    return 'today';
  }

  if (dateStr < '2026-07-14') {
    return 'no-report-before-start';
  }

  if (dateStr < TODAY) {
    return 'no-report-past';
  }

  return 'no-report-future';
}

function getDateTooltip(dateStr: string, status: DateStatus): string {
  switch (status) {
    case 'has-report':
      return '点击查看日报';
    case 'no-report-past':
      return '今日未生成日报';
    case 'no-report-future':
      return '今日日报待生成';
    case 'no-report-before-start':
      return '当前为空';
    case 'today':
      return '今日日报待生成';
    case 'weekend':
      return '周末休市';
    default:
      return '';
  }
}

export function DateNav({
  currentDate,
  onDateChange,
  reportType = 'daily',
  onReportTypeChange,
  viewMode = 'report',
  onViewModeChange,
  onExport,
  isExporting = false,
}: DateNavProps) {
  const router = useRouter();
  const [calendarOpen, setCalendarOpen] = useState(false);

  // 拆分状态管理
  const [calendarYear, setCalendarYear] = useState(() => parseInt(currentDate.substring(0, 4)));
  const [calendarMonth, setCalendarMonth] = useState(() => parseInt(currentDate.substring(5, 7)));

  const selectedMonth = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}`;
  const datesForMonth = useMemo(() => getDatesByMonth(selectedMonth), [selectedMonth]);

  // Build calendar grid for selected month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(calendarYear, calendarMonth - 1, 1);
    const lastDay = new Date(calendarYear, calendarMonth, 0);
    const startWeekday = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: Array<{ date: string; day: number; status: DateStatus; weekNum: number } | null> = [];

    for (let i = 0; i < startWeekday; i++) {
      days.push(null);
    }

    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${calendarYear}-${String(calendarMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const dateObj = new Date(calendarYear, calendarMonth - 1, d);
      const weekNum = getWeekNumber(dateStr);
      days.push({
        date: dateStr,
        day: d,
        status: getDateStatus(dateStr),
        weekNum,
      });
    }

    return days;
  }, [calendarYear, calendarMonth]);

  // Group days by week for weekly report buttons
  const weeksInMonth = useMemo(() => {
    const weeks: Array<{ weekNum: number; days: typeof calendarDays; hasReport: boolean }> = [];
    let currentWeek: typeof calendarDays = [];
    let currentWeekNum = -1;

    calendarDays.forEach((day) => {
      if (day === null) {
        currentWeek.push(day);
        return;
      }

      if (currentWeekNum === -1) {
        currentWeekNum = day.weekNum;
      }

      if (day.weekNum !== currentWeekNum) {
        if (currentWeek.length > 0) {
          weeks.push({
            weekNum: currentWeekNum,
            days: [...currentWeek],
            hasReport: currentWeek.some((d) => d?.status === 'has-report'),
          });
        }
        currentWeek = [];
        currentWeekNum = day.weekNum;
      }
      currentWeek.push(day);
    });

    if (currentWeek.length > 0) {
      weeks.push({
        weekNum: currentWeekNum,
        days: currentWeek,
        hasReport: currentWeek.some((d) => d?.status === 'has-report'),
      });
    }

    return weeks;
  }, [calendarDays]);

  const currentIdx = availableDates.indexOf(currentDate);
  const hasNewer = currentIdx > 0;
  const hasOlder = currentIdx >= 0 && currentIdx < availableDates.length - 1;

  const handlePrev = () => {
    if (hasNewer) onDateChange(availableDates[currentIdx - 1]);
  };
  const handleNext = () => {
    if (hasOlder) onDateChange(availableDates[currentIdx + 1]);
  };

  // 年份切换
  const handlePrevYear = () => {
    setCalendarYear((y) => y - 1);
  };

  const handleNextYear = () => {
    setCalendarYear((y) => y + 1);
  };

  // 月份点击
  const handleMonthClick = (month: number) => {
    setCalendarMonth(month);
  };

  // 月份标题点击 - 跳转月报
  const handleMonthTitleClick = () => {
    router.push(`/monthly-report?year=${calendarYear}&month=${calendarMonth}`);
  };
  const hasMonthlyReportRoute = false; // 模板未内置月报页面；如自行添加 /monthly-report 路由，请将此值改为 true

  const [statusModal, setStatusModal] = useState<{ date: string; message: string; subMessage?: string } | null>(null);

  const handleDateClick = (dateStr: string, status: DateStatus) => {
    if (status === 'has-report') {
      onDateChange(dateStr);
      if (onReportTypeChange) onReportTypeChange('daily');
      setCalendarOpen(false);
    } else if (status === 'weekend') {
      return;
    } else {
      const messages: Record<string, { message: string; subMessage?: string }> = {
        'no-report': { message: '今日未生成日报', subMessage: '该历史日期的日报尚未生成' },
        'future': { message: '今日日报待生成', subMessage: '该日期的日报将在收盘后生成' },
        'empty': { message: '当前为空', subMessage: '2026-07-14 之前的日期无数据' },
      };
      const msg = messages[status] || { message: '暂无数据' };
      setStatusModal({ date: dateStr, ...msg });
    }
  };

  // 生成当前年份的12个月
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  return (
    <div className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur-md">
      {/* Top bar */}
      <div className="max-w-[920px] mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          {/* Left: View mode buttons */}
          <div className="flex items-center gap-2">
            {onViewModeChange && (
              <div className="flex items-center bg-card border border-border rounded-full overflow-hidden">
                <button
                  onClick={() => onViewModeChange('report')}
                  className={`px-3 py-1.5 text-[11px] transition-colors ${
                    viewMode === 'report'
                      ? 'bg-accent text-warning font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  今日日报
                </button>
                {dashboardConfig.features.eventsCalendar && (
                <button
                  onClick={() => onViewModeChange('events')}
                  className={`px-3 py-1.5 text-[11px] transition-colors border-l border-border ${
                    viewMode === 'events'
                      ? 'bg-accent text-warning font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  事件日历
                </button>
                )}
                {dashboardConfig.nav.externalLinks.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-3 py-1.5 text-[11px] transition-colors border-l border-border text-muted-foreground hover:text-foreground`}
                  >
                    {link.label}
                  </a>
                ))}
                {dashboardConfig.nav.outlookLink && (
                  <a
                    href={dashboardConfig.nav.outlookLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`inline-block px-3 py-1.5 text-[11px] transition-colors border-l border-border text-muted-foreground hover:text-foreground`}
                  >
                    本月展望
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Center: Date navigation - click to open calendar */}
          <div
            className="flex items-center gap-2 cursor-pointer select-none rounded-lg px-2 py-1 hover:bg-accent/50 transition-colors"
            onClick={() => setCalendarOpen(!calendarOpen)}
            title="点击打开日历"
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                handlePrev();
              }}
              disabled={!hasNewer}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <div className="text-center min-w-[120px] flex items-center justify-center gap-1.5">
              <div>
                <div className="text-sm font-semibold text-foreground tracking-wide">
                  {reportType === 'weekly' ? '周报' : currentDate}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {reportType === 'weekly' ? '每周市场总结' : availableDates.length > 0 ? `${currentIdx + 1} / ${availableDates.length}` : ''}
                </div>
              </div>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-muted-foreground transition-colors ${calendarOpen ? 'text-warning' : ''} self-start mt-0.5`}>
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleNext();
              }}
              disabled={!hasOlder}
              className="w-7 h-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-card disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>

            {currentIdx > 0 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDateChange(availableDates[0]);
                }}
                className="px-2 py-1 rounded-md text-[10px] text-muted-foreground hover:text-warning hover:bg-card border border-border hover:border-warning/30 transition-colors"
                title="跳转到最新日期"
              >
                今日
              </button>
            )}
          </div>

          {/* Right: Theme toggle + Toolbox */}
          <div className="flex items-center gap-2">
            <ThemeToggle />
            {onExport && <Toolbox onExport={onExport} isExporting={isExporting} />}
          </div>
        </div>
      </div>

      {/* Calendar dropdown */}
      {calendarOpen && (
        <div className="border-t border-border bg-background/98">
          <div className="max-w-[920px] mx-auto px-4 py-4">
            {/* Year navigation */}
            <div className="flex items-center justify-center gap-3 mb-4 pb-3 border-b border-border/50">
              <button
                onClick={handlePrevYear}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="15 18 9 12 15 6" />
                </svg>
              </button>

              <div className="text-[15px] font-semibold text-foreground">
                {calendarYear}年
              </div>

              <button
                onClick={handleNextYear}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-all"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Month grid - 12 months */}
            <div className="grid grid-cols-6 gap-2 mb-4 pb-3 border-b border-border/50">
              {months.map((month) => {
                const isActive = month === calendarMonth;
                const monthStr = `${calendarYear}-${String(month).padStart(2, '0')}`;
                const hasReports = availableDates.some((d) => d.startsWith(monthStr));
                return (
                  <button
                    key={month}
                    onClick={() => handleMonthClick(month)}
                    className={`px-3 py-2.5 rounded-lg text-[13px] transition-all relative ${
                      isActive
                        ? 'bg-accent text-warning font-medium'
                        : hasReports
                        ? 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/30'
                    }`}
                  >
                    {month}月
                    {hasReports && (
                      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-success" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Month title (optional link to monthly report) */}
            <div className="flex items-center justify-between mb-2">
              <button
                onClick={hasMonthlyReportRoute ? handleMonthTitleClick : undefined}
                className="text-sm font-medium text-foreground hover:text-warning transition-colors flex items-center gap-1 group"
                title={hasMonthlyReportRoute ? '查看月报' : undefined}
              >
                {calendarYear}年{calendarMonth}月
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <polyline points="9 18 15 12 9 6" />
                </svg>
              </button>
            </div>

            {/* Calendar grid */}
            <div className="grid grid-cols-8 gap-1">
              <div className="text-[9px] text-muted-foreground text-center py-1">周</div>
              {['日', '一', '二', '三', '四', '五', '六'].map((d) => (
                <div key={d} className="text-[9px] text-muted-foreground text-center py-1">
                  {d}
                </div>
              ))}

              {weeksInMonth.map((week) => (
                <WeekRow
                  key={week.weekNum}
                  week={week}
                  currentDate={currentDate}
                  reportType={reportType}
                  onDateChange={onDateChange}
                  onReportTypeChange={onReportTypeChange}
                  setCalendarOpen={setCalendarOpen}
                  onDateClick={handleDateClick}
                  calendarYear={calendarYear}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-4 mt-2 pt-2 border-t border-border/50 flex-wrap">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-success" />
                <span className="text-[9px] text-muted-foreground">有日报</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-primary" />
                <span className="text-[9px] text-muted-foreground">今天</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-warning" />
                <span className="text-[9px] text-muted-foreground">有事件</span>
              </div>
            </div>

            {/* Collapse button */}
            <div className="flex justify-center mt-4 pt-2">
              <button
                onClick={() => setCalendarOpen(false)}
                className="flex items-center gap-1 px-5 py-1.5 rounded-full text-[11px] text-muted-foreground hover:text-foreground hover:bg-accent/60 transition-colors"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="18 15 12 9 6 15" />
                </svg>
                收起
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status Modal */}
      {statusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 backdrop-blur-sm" onClick={() => setStatusModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full mx-4 shadow-[0_20px_60px_rgba(15,23,42,0.15)]" onClick={(e) => e.stopPropagation()}>
            <div className="text-center">
              <div className="text-[26px] font-bold text-foreground mb-2">
                {statusModal.date}
              </div>
              <div className="text-[20px] text-warning mb-4">{statusModal.message}</div>
              {statusModal.subMessage && (
                <div className="text-[14px] text-muted-foreground mb-6">{statusModal.subMessage}</div>
              )}
              <button
                onClick={() => setStatusModal(null)}
                className="px-8 py-2.5 bg-accent hover:bg-accent/80 text-foreground rounded-full transition-all font-medium"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// 已有真实生成的周报（可直接跳转的周
// 注意：这里只列有实际页面的周报，不是"有日报"不等于"有周报"
const AVAILABLE_WEEKLY_REPORTS = new Set(['2026-w32', '2026-w33', '2026-w34', '2026-w35']);

function getWeeklyReportKey(year: number, weekNum: number): string {
  return `${year}-w${weekNum.toString().padStart(2, '0')}`;
}

// Week row component with weekly report button
function WeekRow({
  week,
  currentDate,
  reportType,
  onDateChange,
  onReportTypeChange,
  setCalendarOpen,
  onDateClick,
  calendarYear,
}: {
  week: { weekNum: number; days: Array<{ date: string; day: number; status: DateStatus; weekNum: number } | null>; hasReport: boolean };
  currentDate: string;
  reportType: 'daily' | 'weekly';
  onDateChange: (date: string) => void;
  onReportTypeChange?: (type: 'daily' | 'weekly') => void;
  setCalendarOpen: (open: boolean) => void;
  onDateClick: (date: string, status: DateStatus) => void;
  calendarYear: number;
}) {
  const hasActualWeekly = AVAILABLE_WEEKLY_REPORTS.has(getWeeklyReportKey(calendarYear, week.weekNum));
  const isWeeklyActive = reportType === 'weekly' && week.hasReport;

  const handleWeeklyClick = () => {
    if (hasActualWeekly) {
      // 有真实周报页面，直接跳转
      setCalendarOpen(false);
      window.location.href = `/weekly/${getWeeklyReportKey(calendarYear, week.weekNum)}`;
    } else if (week.hasReport && onReportTypeChange) {
      // 旧逻辑：切换到周报视图
      onReportTypeChange('weekly');
      onDateChange(`week-${week.weekNum}`);
      setCalendarOpen(false);
    }
  };

  return (
    <>
      {/* Week number button */}
      <button
        onClick={handleWeeklyClick}
        className={`h-7 rounded text-[10px] flex items-center justify-center font-medium transition-all
          ${hasActualWeekly
            ? 'bg-amber-500/15 text-amber-500 border border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-500/60'
            : isWeeklyActive
              ? 'bg-primary/15 text-primary border border-primary/40'
              : 'text-muted-foreground/50 cursor-default hover:bg-transparent'
          }`}
        title={hasActualWeekly ? `查看 W${week.weekNum} 周报` : ''}
      >
        W{week.weekNum}
      </button>
      {week.days.map((day, i) => {
        if (!day) {
          return <div key={`empty-${i}`} className="h-7" />;
        }

        const isCurrent = day.date === currentDate && reportType === 'daily';
        const { status } = day;
        const hasEventOnDay = hasEvent(day.date);
        const tooltip = getDateTooltip(day.date, status);

        let cellClass = '';
        let isClickable = true;

        if (isCurrent) {
          cellClass = 'bg-primary text-white font-bold text-[13px] shadow-md shadow-primary/30 ring-2 ring-primary/40';
        } else if (status === 'has-report') {
          cellClass = 'text-muted-foreground hover:bg-accent hover:text-foreground';
        } else if (status === 'weekend') {
          cellClass = 'text-transparent cursor-default';
          isClickable = false;
        } else if (status === 'no-report-before-start') {
          cellClass = 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
        } else {
          cellClass = 'text-muted-foreground hover:bg-accent/50 hover:text-foreground';
        }

        return (
          <button
            key={day.date}
            onClick={() => {
              if (isClickable) {
                onDateClick(day.date, status);
              }
            }}
            disabled={!isClickable && status === 'weekend'}
            className={`h-7 rounded text-[11px] flex items-center justify-center transition-colors relative ${cellClass}`}
            title={tooltip}
          >
            {day.day}
            {status === 'has-report' && !isCurrent && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-success" />
            )}
            {hasEventOnDay && status !== 'has-report' && (
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-warning" />
            )}
          </button>
        );
      })}
    </>
  );
}
