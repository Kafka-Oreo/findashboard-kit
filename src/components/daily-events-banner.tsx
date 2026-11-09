'use client';

import { useEffect, useState } from 'react';

interface DailyEvent {
  title: string;
  time: string;
  source: string;
  level: string;
}

interface RawEvent {
  event_title?: string;
  event_time?: string;
  source_media?: string;
  event_level?: string;
}

interface DailyEventsBannerProps {
  date: string;
}

export function DailyEventsBanner({ date }: DailyEventsBannerProps) {
  const [events, setEvents] = useState<DailyEvent[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setEvents([]);
    // 获取每日重大事件
    fetch(`/api/daily-events?date=${date}`)
      .then(res => res.json())
      .then(data => {
        if (data.success && Array.isArray(data.events)) {
          // 字段映射：event_title/event_time/source_media/event_level → 展示结构
          const mapped: DailyEvent[] = (data.events as RawEvent[])
            .filter(e => e.event_title)
            .map(e => ({
              title: e.event_title ?? '',
              time: e.event_time ?? '',
              source: e.source_media ?? '',
              level: e.event_level ?? '',
            }));
          // 优先展示市场级事件，其次行业级，最多 2 条
          const levelRank: Record<string, number> = { 市场级: 0, 行业级: 1, 公司级: 2 };
          mapped.sort((a, b) => (levelRank[a.level] ?? 9) - (levelRank[b.level] ?? 9));
          setEvents(mapped.slice(0, 2));
        }
      })
      .catch(err => {
        console.error('Failed to fetch daily events:', err);
      });

    setIsVisible(true);
  }, [date]);

  if (!events || events.length === 0) {
    return null;
  }

  return (
    <div className={`flex justify-between items-center gap-4 mb-4 transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}>
      {events.map((event, index) => (
        <div
          key={index}
          className={`flex-1 relative group cursor-pointer ${index === 0 ? 'text-left' : 'text-right'}`}
        >
          {/* 浮动气泡 */}
          <div className={`relative inline-block px-4 py-2 rounded-full border border-border bg-surface/80 backdrop-blur-sm transition-all duration-300 group-hover:scale-105 group-hover:border-primary/50 group-hover:shadow-[0_0_15px_rgba(59,130,246,0.3)]`}>
            {/* 气泡装饰 */}
            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* 事件内容 */}
            <div className="relative flex items-center gap-2">
              {index === 0 && (
                <span className="text-primary text-xs">●</span>
              )}
              <span className="text-text-secondary text-xs font-medium">{event.title}</span>
              {index === 1 && (
                <span className="text-primary text-xs">●</span>
              )}
            </div>

            {/* 悬浮提示 */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg bg-surface border border-border text-text-primary text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10">
              <div className="font-medium">{event.title}</div>
              <div className="text-text-secondary mt-1">{event.time} · {event.source}</div>
              {/* 提示框箭头 */}
              <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-border" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
