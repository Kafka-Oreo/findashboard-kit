'use client';

import { UpcomingEventsData } from '@/lib/types';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';

interface EventsCalendarProps {
  data: UpcomingEventsData;
}

export function EventsCalendar({ data }: EventsCalendarProps) {
  const { ref, isVisible } = useScrollReveal();

  // Split days into two columns for desktop layout
  const leftDays = data.days.slice(0, Math.ceil(data.days.length / 2));
  const rightDays = data.days.slice(Math.ceil(data.days.length / 2));

  return (
    <section
      id="events-calendar"
      ref={ref}
      className={`mb-12 transition-all duration-500 ${
        isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
      }`}
    >
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground mb-3 tracking-wide">
          {data.title}
        </h2>
        <p className="text-sm text-muted-foreground">{data.subtitle}</p>
        <div className="mt-4 h-[2px] w-16 bg-danger" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
        {/* Left column */}
        <div className="space-y-8">
          {leftDays.map((day) => (
            <DayBlock key={day.date} day={day} />
          ))}
        </div>

        {/* Right column */}
        <div className="space-y-8 lg:border-l lg:border-border lg:pl-8 lg:ml-4">
          {rightDays.map((day) => (
            <DayBlock key={day.date} day={day} />
          ))}
        </div>
      </div>

      {/* Core window highlight */}
      <div className="mt-8 p-6 bg-surface-secondary border border-border rounded-lg">
        <p className="text-base text-foreground text-center">
          <span className="text-danger font-semibold">核心窗口：</span>
          {data.coreWindow}
        </p>
      </div>
    </section>
  );
}

function DayBlock({ day }: { day: { date: string; weekday: string; events: { time: string; company: string; focus: string }[] } }) {
  return (
    <div>
      <h3 className="text-lg font-semibold text-foreground mb-4">
        {day.date} <span className="text-muted-foreground font-normal">{day.weekday}</span>
      </h3>

      {/* Table header */}
      <div className="grid grid-cols-[80px_120px_1fr] gap-4 mb-3 pb-2 border-b border-border">
        <span className="text-sm font-medium text-muted-foreground">时间</span>
        <span className="text-sm font-medium text-muted-foreground">公司</span>
        <span className="text-sm font-medium text-muted-foreground">关注重点</span>
      </div>

      {/* Events */}
      <div className="space-y-0">
        {day.events.map((event, idx) => (
          <div
            key={idx}
            className="grid grid-cols-[80px_120px_1fr] gap-4 py-3 border-b border-dotted border-border last:border-b-0 hover:bg-surface-secondary transition-colors duration-150"
          >
            <span className="text-sm font-mono text-foreground">{event.time}</span>
            <span className="text-sm font-semibold text-foreground">{event.company}</span>
            <span className="text-sm text-muted-foreground">{event.focus}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
