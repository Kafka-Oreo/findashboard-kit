'use client';

import { useState, useCallback, useEffect } from 'react';
import { availableDates, getReportByDate } from '@/lib/reports';
import { getWeeklyReportByWeek } from '@/lib/reports/weekly';
import { DateNav } from '@/components/date-nav';
import { ReportViewer } from '@/components/report/report-viewer';
import AIAvatars from '@/components/report/ai-avatars';
import { TocSidebar } from '@/components/toc-sidebar';
import { EventsCalendarPage } from '@/components/events-calendar-page';
import { Toolbox } from '@/components/toolbox';
import { useExportReport } from '@/hooks/use-export-report';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dashboardConfig } from '@/config/dashboard.config';
import type { ReportData, DailyEvent } from '@/lib/types';

type ReportType = 'daily' | 'weekly';
type ViewMode = 'report' | 'headline' | 'events' | 'outlook';

export default function Home() {
  const dates = availableDates;
  const [selectedDate, setSelectedDate] = useState(dates[0]);
  const [reportType, setReportType] = useState<ReportType>('daily');
  const [viewMode, setViewMode] = useState<ViewMode>('report');
  const [weeklyReport, setWeeklyReport] = useState<ReportData | null>(null);
  const [dailyEvents, setDailyEvents] = useState<DailyEvent[]>([]);
  const [tocCollapsed, setTocCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1280;
  });

  // Auto-collapse/expand TOC based on viewport
  useEffect(() => {
    const handleResize = () => {
      const shouldCollapse = window.innerWidth < 1280;
      setTocCollapsed((prev) => (prev !== shouldCollapse ? shouldCollapse : prev));
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Fetch daily events for the selected date
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/daily-events?date=${selectedDate}`);
        const data = await res.json();
        if (data.success && data.events) {
          setDailyEvents(data.events);
        }
      } catch (err) {
        console.error('Failed to fetch daily events:', err);
      }
    };
    fetchEvents();
  }, [selectedDate]);

  // Get current report based on type
  const report = reportType === 'weekly' && weeklyReport ? weeklyReport : getReportByDate(selectedDate);

  // Export: snapshot the report column (excludes DateNav / TocSidebar / AIAvatars)
  const { ref: exportRef, isExporting, exportReport } = useExportReport({
    filename: `${dashboardConfig.site.exportPrefix}_${selectedDate}`,
  });

  const handleExport = useCallback(
    async (format: 'png' | 'jpg' | 'pdf') => {
      // Export only available in report/headline view.
      if (viewMode === 'events' || viewMode === 'outlook') {
        toast.error('当前页面暂不支持导出');
        return;
      }
      try {
        await exportReport(format);
        toast.success(format === 'pdf' ? 'PDF 已开始下载' : '图片已开始下载');
      } catch (err) {
        const msg = err instanceof Error ? err.message : '导出失败，请重试';
        toast.error(msg);
      }
    },
    [exportReport, viewMode],
  );

  // Handle date change
  const handleDateChange = useCallback((date: string) => {
    if (date.startsWith('week-')) {
      const weekNum = parseInt(date.replace('week-', ''));
      const weekDates = dates.filter((d) => {
        const dDate = new Date(d + 'T00:00:00');
        const start = new Date(dDate.getFullYear(), 0, 1);
        const diff = dDate.getTime() - start.getTime();
        const oneWeek = 604800000;
        const wn = Math.ceil((diff / oneWeek) + (start.getDay() + 1) / 7);
        return wn === weekNum;
      });

      if (weekDates.length > 0) {
        const weekReport = getWeeklyReportByWeek(weekNum);
        if (weekReport) {
          setWeeklyReport(weekReport);
          setReportType('weekly');
          return;
        }
      }
    }

    setSelectedDate(date);
    setReportType('daily');
    setWeeklyReport(null);
  }, [dates]);

  const handleReportTypeChange = useCallback((type: ReportType) => {
    setReportType(type);
  }, []);

  const handleViewModeChange = useCallback((mode: ViewMode) => {
    setViewMode(mode);
  }, []);

  if (!report) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center">
        <div className="text-muted-foreground text-lg">未找到报告数据</div>
      </div>
    );
  }

  const isExportable = viewMode === 'report' || viewMode === 'headline';

  return (
    <div className="min-h-screen bg-page">
      <DateNav
        currentDate={selectedDate}
        onDateChange={handleDateChange}
        reportType={reportType}
        onReportTypeChange={handleReportTypeChange}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onExport={exportReport}
        isExporting={isExporting}
      />

      <div className="max-w-[1400px] mx-auto px-6 py-8 flex gap-8">
        {viewMode === 'report' && <TocSidebar collapsed={tocCollapsed} onCollapsedChange={setTocCollapsed} />}

        <div className="flex-1 min-w-0">
          {viewMode === 'events' ? (
            <EventsCalendarPage
              currentDate={selectedDate}
              onDateChange={setSelectedDate}
            />
          ) : viewMode === 'outlook' ? (
            dashboardConfig.nav.outlookLink ? (
            <div className="rounded-lg bg-surface-secondary border border-border p-8 text-center">
              <div className="text-lg font-semibold text-foreground mb-2">本月展望</div>
              <div className="text-sm text-muted-foreground mb-4">
                点击下方链接查看本月市场展望
              </div>
              <a
                href={dashboardConfig.nav.outlookLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-primary hover:text-primary/80 transition-colors border border-primary/30 rounded-lg hover:border-primary/50"
              >
                前往查看 →
              </a>
            </div>
            ) : (
              <div className="rounded-lg bg-surface-secondary border border-border p-8 text-center text-sm text-muted-foreground">
                未配置「本月展望」链接（src/config/dashboard.config.ts → nav.outlookLink）
              </div>
            )
          ) : (
            <div
              ref={isExportable ? exportRef : undefined}
              id="report-export-root"
              className="relative"
            >
              {/* Export-only title bar (hidden on screen) */}
              <div
                data-export-header
                className="hidden exporting:block exporting:mb-6 exporting:pb-4 exporting:border-b exporting:border-[--border]"
              >
                <div className="flex items-baseline gap-3">
                  <span className="text-xl font-bold tracking-tight text-[--foreground]">
                    {dashboardConfig.site.name}
                  </span>
                  <span className="text-sm text-[--muted]">
                    {selectedDate}
                  </span>
                </div>
              </div>

              <ReportViewer
                key={reportType === 'weekly' ? `weekly-${weeklyReport?.dateLabel}` : selectedDate}
                data={report}
                events={dailyEvents}
              />
            </div>
          )}
        </div>
      </div>

      {/* AI 投顾助手：全宽区域，让顾问入口卡片可以足够宽、足够矮；左侧留出目录宽度避免遮挡 */}
      {isExportable && dashboardConfig.features.aiAdvisor && (
        <section
          id="sec-ai-avatars"
          data-export-hide
          className="border-t border-border/40 bg-[#F5F7FB] dark:bg-[#09090B]"
        >
          <div
            className={cn(
              "px-6 py-8 transition-[padding] duration-300",
              viewMode === 'report' && !tocCollapsed ? "md:pl-[236px]" : "md:pl-6",
            )}
          >
            <div className="mx-auto max-w-[1400px]">
              <AIAvatars />
            </div>
          </div>
        </section>
      )}

      {isExportable && <Toolbox onExport={handleExport} isExporting={isExporting} />}
    </div>
  );
}
