'use client';

import { useMemo } from 'react';
import { getEventsByDate, getEventsFromDate } from '@/lib/reports/upcoming-events';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { UpcomingEvent } from '@/lib/types';
import { format, parseISO, isToday, isTomorrow } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface TodayEventsProps {
  date: string;
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

function getWeekday(dateStr: string): string {
  const date = parseISO(dateStr);
  return WEEKDAY_CN[date.getDay()];
}

function formatDateLabel(dateStr: string): string {
  const date = parseISO(dateStr);
  if (isToday(date)) return '今天';
  if (isTomorrow(date)) return '明天';
  return format(date, 'M月d日', { locale: zhCN });
}

export function TodayEvents({ date }: TodayEventsProps) {
  const { ref } = useScrollReveal();

  // 获取当日及未来3天的事件
  const upcomingDays = useMemo(() => {
    return getEventsFromDate(date, 3);
  }, [date]);

  const events = useMemo(() => {
    return getEventsByDate(date);
  }, [date]);

  if (upcomingDays.length === 0) {
    return null;
  }

  return (
    <div ref={ref}>
      <div className="bg-surface rounded-xl border border-border overflow-hidden">
        <div className="px-6 py-4 border-b border-border bg-gradient-to-r from-surface to-surface-secondary">
          <h2 className="text-lg font-bold text-foreground">
            当日及未来事件
          </h2>
          <p className="text-[12px] text-muted-foreground mt-1">
            {formatDateLabel(date)} {getWeekday(date)} · 重大财报、宏观数据、重要会议提醒
          </p>
        </div>
        <div className="p-6">
          <div className="space-y-6">
            {upcomingDays.map((day, dayIdx) => (
              <div key={dayIdx}>
                <div className="flex items-center gap-2 mb-3">
                  <h3 className="text-[14px] font-bold text-foreground">
                    {formatDateLabel(day.date)} {day.weekday}
                  </h3>
                  {dayIdx === 0 && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-danger/12 text-danger">
                      当日
                    </span>
                  )}
                </div>
                <div className="space-y-2.5">
                  {day.events.map((event: UpcomingEvent, idx: number) => (
                    <div
                      key={idx}
                      className="flex items-start gap-3 p-3 rounded-lg bg-surface-secondary border border-border hover:border-border/60 transition-all duration-180"
                    >
                      <div className="flex-shrink-0 w-12 text-[13px] font-mono text-muted-foreground pt-0.5">
                        {event.time}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-[14px] font-bold text-foreground">
                            {event.company}
                          </span>
                          {event.tag && (
                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                              event.tag === '财报' ? 'bg-danger/12 text-danger' :
                              event.tag === '宏观' ? 'bg-success/12 text-success' :
                              'bg-warning/12 text-warning'
                            }`}>
                              {event.tag}
                            </span>
                          )}
                        </div>
                        <p className="text-[13px] text-muted-foreground leading-relaxed">
                          {event.focus}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border">
            <p className="text-[12px] text-muted-foreground text-center">
              查看完整事件日历 → 切换至「事件日历」标签页
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
