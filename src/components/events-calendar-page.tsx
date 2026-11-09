'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { upcomingEventsData } from '@/lib/reports/upcoming-events';
import { UpcomingEvent, EventDay } from '@/lib/types';
import {
  fetchMonthlyEvents,
  mergeEventDays,
} from '@/lib/daily-events-converter';
import { isValidEventUrl } from '@/lib/utils';
import { useScrollReveal } from '@/hooks/use-scroll-reveal';
import { format, parseISO, isToday, isTomorrow, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, getISOWeek } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import { CalendarQA } from './calendar-qa';

interface EventsCalendarPageProps {
  currentDate: string;
  onDateChange: (date: string) => void;
}

const WEEKDAY_CN = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

// 重要等级配置
const IMPORTANCE_LEVELS = {
  5: { label: '★★★★★', name: '市场级', color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950/20' },
  4: { label: '★★★★', name: '行业级', color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/20' },
  3: { label: '★★★', name: '公司级', color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  2: { label: '★★', name: '普通', color: 'text-gray-500', bgColor: 'bg-gray-50 dark:bg-gray-950/20' },
};

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

// 事件卡片组件（投资驱动型）
function EventCard({ event, date, isExpanded, onToggle }: { event: UpcomingEvent; date: string; isExpanded: boolean; onToggle: () => void }) {
  // 子折叠状态
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    summary: true,
    focus: true,
    stocks: false,
    history: false,
    news: false,
  });

  // 根据 tag 判断重要等级
  const getImportance = (tag?: string) => {
    if (tag === '宏观' || tag === '政策') return 5;
    if (tag === '财报') return 4;
    if (tag === '会议' || tag === '市场') return 3;
    return 2;
  };

  const importance = getImportance(event.tag);
  const level = IMPORTANCE_LEVELS[importance as keyof typeof IMPORTANCE_LEVELS] || IMPORTANCE_LEVELS[2];

  // 切换子折叠
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // 历史影响数据状态
  const [historicalImpact, setHistoricalImpact] = useState<{
    event_type: string;
    summary: string;
    stats: Array<{
      period: string;
      avg_change: number;
      win_rate: number;
      sample_size: number;
    }>;
  } | null>(null);
  const [loadingHistorical, setLoadingHistorical] = useState(false);

  // 获取历史影响数据
  useEffect(() => {
    if (!isExpanded) return;
    
    const fetchHistoricalImpact = async () => {
      setLoadingHistorical(true);
      try {
        const params = new URLSearchParams({
          title: `${event.company} ${event.focus}`,
          summary: event.focus,
          date: date,
        });
        
        const response = await fetch(`/api/historical-impact?${params}`);
        if (response.ok) {
          const data = await response.json();
          setHistoricalImpact(data);
        }
      } catch (error) {
        console.error('Failed to fetch historical impact:', error);
      } finally {
        setLoadingHistorical(false);
      }
    };
    
    fetchHistoricalImpact();
  }, [isExpanded, event.company, event.focus, date]);

  // 模拟数据（实际应从后端获取）
  const mockData = {
    summary: `${event.company} ${event.focus}`,
    investment_focus: [event.focus],
    related_industries: [event.tag || '未知'],
    related_stocks: [
      { symbol: 'AAPL', name: event.company, market: '美股' as const },
    ],
    news_links: [
      { title: `${event.company}最新动态`, source: '财联社', url: '#' },
      { title: `${event.company}分析报告`, source: 'Reuters', url: '#' },
    ],
  };

  return (
    <div className={`rounded-lg border border-border ${level.bgColor} transition-all`}>
      {/* 第一层：事件概要 */}
      <div className="flex items-start gap-3 p-3">
        <span className={`text-xs font-medium ${level.color} whitespace-nowrap`}>{level.label}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground">{event.company}</span>
            <span className="text-xs text-muted-foreground">{event.time}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            {event.tag && (
              <span className="text-xs px-2 py-0.5 rounded bg-surface-secondary text-muted-foreground">{event.tag}</span>
            )}
            <span className="text-xs text-muted-foreground truncate">{event.focus}</span>
          </div>
        </div>
        <button
          onClick={onToggle}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          {isExpanded ? '收起' : '展开投资信息'}
        </button>
      </div>

      {/* 第二层：详细投资信息 */}
      {isExpanded && (
        <div className="border-t border-border">
          {/* 事件简介 */}
          <div className="border-b border-border">
            <button
              onClick={() => toggleSection('summary')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground">事件简介</span>
              <span className="text-xs text-muted-foreground">{expandedSections.summary ? '−' : '+'}</span>
            </button>
            {expandedSections.summary && (
              <div className="px-3 pb-3">
                <p className="text-sm text-foreground">{mockData.summary}</p>
              </div>
            )}
          </div>

          {/* 投资关注点 */}
          <div className="border-b border-border">
            <button
              onClick={() => toggleSection('focus')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground">投资关注点</span>
              <span className="text-xs text-muted-foreground">{expandedSections.focus ? '−' : '+'}</span>
            </button>
            {expandedSections.focus && (
              <div className="px-3 pb-3">
                <ul className="space-y-1">
                  {mockData.investment_focus.map((item, idx) => (
                    <li key={idx} className="text-sm text-foreground flex items-start gap-2">
                      <span className="text-muted-foreground">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* 关联股票 */}
          <div className="border-b border-border">
            <button
              onClick={() => toggleSection('stocks')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground">关联股票</span>
              <span className="text-xs text-muted-foreground">{expandedSections.stocks ? '−' : '+'}</span>
            </button>
            {expandedSections.stocks && (
              <div className="px-3 pb-3">
                <div className="space-y-2">
                  {mockData.related_stocks.map((stock, idx) => (
                    <div key={idx} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                      <div>
                        <span className="text-sm font-medium text-foreground">{stock.name}</span>
                        <span className="text-xs text-muted-foreground ml-2">{stock.symbol}</span>
                      </div>
                      <span className="text-xs px-2 py-0.5 rounded bg-surface-secondary text-muted-foreground">{stock.market}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 历史影响 */}
          <div className="border-b border-border">
            <button
              onClick={() => toggleSection('history')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground">历史影响</span>
              <span className="text-xs text-muted-foreground">{expandedSections.history ? '−' : '+'}</span>
            </button>
            {expandedSections.history && (
              <div className="px-3 pb-3">
                {loadingHistorical ? (
                  <div className="text-xs text-muted-foreground py-2">正在计算历史统计...</div>
                ) : historicalImpact ? (
                  <div className="space-y-3">
                    {/* 自动生成的摘要 */}
                    <div className="text-sm text-foreground">{historicalImpact.summary}</div>
                    
                    {/* 详细统计 */}
                    {historicalImpact.stats.length > 0 && (
                      <div className="space-y-2">
                        {historicalImpact.stats.map((stat, idx) => {
                          const periodLabel = stat.period === 'next_day' ? '次日' : 
                                             stat.period === 'next_week' ? '一周' : '一月';
                          const direction = stat.avg_change > 0 ? '上涨' : '下跌';
                          const color = stat.avg_change > 0 ? 'text-up' : 'text-down';
                          
                          return (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-border/50 last:border-0">
                              <span className="text-xs text-muted-foreground">{periodLabel}</span>
                              <div className="flex items-center gap-3">
                                <span className={`text-xs font-medium ${color}`}>
                                  {direction} {Math.abs(stat.avg_change)}%
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  ({stat.win_rate}% 上涨，{stat.sample_size} 次)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground py-2">暂无历史统计数据</div>
                )}
              </div>
            )}
          </div>

          {/* 相关新闻 */}
          <div>
            <button
              onClick={() => toggleSection('news')}
              className="w-full flex items-center justify-between p-3 text-left hover:bg-surface-secondary/50 transition-colors"
            >
              <span className="text-xs font-medium text-muted-foreground">相关新闻</span>
              <span className="text-xs text-muted-foreground">{expandedSections.news ? '−' : '+'}</span>
            </button>
            {expandedSections.news && (
              <div className="px-3 pb-3">
                <div className="space-y-2">
                  {mockData.news_links.map((news, idx) => (
                    <a
                      key={idx}
                      href={news.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block py-1 border-b border-border/50 last:border-0 hover:bg-surface-secondary/50 transition-colors"
                    >
                      <div className="text-sm text-foreground">{news.title}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{news.source}</div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── 事件列表项组件（统一处理链接与点击冲突） ───────── */
function EventListItem({ event, dotColor, tagClass, onSelect }: {
  event: UpcomingEvent;
  dotColor: string;
  onSelect: (event: UpcomingEvent) => void;
  tagClass?: string;
}) {
  const tagClasses: Record<string, string> = {
    '宏观': 'bg-[#DBEAFE] text-[#1D4ED8] dark:bg-[#172554] dark:text-[#93C5FD]',
    '政策': 'bg-[#EDE9FE] text-[#6D28D9] dark:bg-[#2E1065] dark:text-[#C4B5FD]',
    '财报': 'bg-[#FFEDD5] text-[#C2410C] dark:bg-[#431407] dark:text-[#FDBA74]',
    '行业': 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#052E16] dark:text-[#86EFAC]',
  };
  const resolvedTagClass = tagClass || (event.tag && tagClasses[event.tag]) || 'bg-[#F1F5F9] text-[#475569] dark:bg-[#27272A] dark:text-[#A1A1AA]';
  const validUrl = isValidEventUrl(event.url);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(event)}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(event); } }}
      className="w-full text-left p-2.5 rounded-lg bg-[#FAFBFC] dark:bg-[#1F1F23] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#2563EB]/30 dark:hover:border-[#3B82F6]/40 transition-all duration-200 cursor-pointer group"
    >
      <div className="flex items-start gap-2.5">
        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${dotColor}`}></div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            {validUrl ? (
              <a
                href={event.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-sm font-medium text-[#111827] dark:text-[#F4F4F5] leading-tight truncate hover:text-[#2563EB] dark:hover:text-[#60A5FA] transition-colors flex items-center gap-1 flex-1 min-w-0"
                title={event.company}
              >
                <span className="truncate">{event.company}</span>
                <svg className="w-3 h-3 flex-shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            ) : (
              <span className="text-sm font-medium text-[#111827] dark:text-[#F4F4F5] leading-tight truncate flex-1">{event.company}</span>
            )}
            {event.tag && (
              <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ${resolvedTagClass}`}>{event.tag}</span>
            )}
          </div>
          <p className="text-xs text-[#64748B] dark:text-[#A1A1AA] leading-relaxed line-clamp-2">{event.focus}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[11px] text-[#94A3B8] dark:text-[#71717A] font-data">{event.time}</span>
            <span className="text-[11px]">
              {Array.from({ length: 5 }, (_, j) => (
                <span key={j} className={j < (event.importance || 2) ? 'text-[#F59E0B]' : 'text-[#D1D5DB] dark:text-[#52525B]'}>★</span>
              ))}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ───────── 右侧详情面板组件 ───────── */
function DetailPanel({ date, events, selectedEvent, onSelectEvent, onClose }: {
  date: string;
  events: UpcomingEvent[];
  selectedEvent: UpcomingEvent | null;
  onSelectEvent: (event: UpcomingEvent | null) => void;
  onClose: () => void;
}) {
  const [showAI, setShowAI] = useState(false);
  const [eventDetailExpanded, setEventDetailExpanded] = useState(true);

  // AI 分析状态
  const [aiAnalysisLoading, setAiAnalysisLoading] = useState(false);
  const [aiAnalysisResult, setAiAnalysisResult] = useState<string | null>(null);

  // 当选中新事件时，自动展开详情
  useEffect(() => {
    if (selectedEvent) {
      setEventDetailExpanded(true);
      setShowAI(false);
    }
  }, [selectedEvent]);

  const getImportance = (tag?: string) => {
    if (tag === '宏观' || tag === '政策') return 5;
    if (tag === '财报') return 4;
    if (tag === '会议' || tag === '市场') return 3;
    return 2;
  };

  const critical = events.filter((e) => getImportance(e.tag) === 5);
  const high = events.filter((e) => getImportance(e.tag) === 4);
  const other = events.filter((e) => getImportance(e.tag) <= 3);

  // 格式化日期显示
  const formatDisplayDate = (d: string) => {
    const match = d.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!match) return d;
    const [, y, m, day] = match;
    const dt = new Date(Number(y), Number(m) - 1, Number(day));
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${y}年${Number(m)}月${Number(day)}日（${weekdays[dt.getDay()]}）`;
  };

  // 历史指标（模拟数据）
  const metrics = {
    upProb: '70%',
    avgVol: '1.35%',
    maxVol: '2.87%',
  };

  // 相关市场
  const markets = ['美股', '美债', '美元', '黄金', '原油'];

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* 头部 */}
      <div className="flex-shrink-0 flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] dark:border-[#27272A]">
        <div>
          <h3 className="text-lg font-semibold text-[#111827] dark:text-[#F4F4F5] tracking-tight">
            {formatDisplayDate(date)}
          </h3>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClose();
          }}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#27272A] text-[#94A3B8] dark:text-[#71717A] hover:text-[#111827] dark:hover:text-[#F4F4F5] transition-colors"
          aria-label="关闭"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {/* 选中事件详情 */}
        {selectedEvent && (
          <div className="space-y-4">
            {/* 事件标题 */}
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <h4 className="text-base font-semibold text-[#111827] dark:text-[#F4F4F5] leading-snug">
                    {selectedEvent.company}
                  </h4>
                  {selectedEvent.focus && selectedEvent.focus !== selectedEvent.company && (
                    <p className="text-sm text-[#64748B] dark:text-[#A1A1AA] mt-1">{selectedEvent.focus}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onSelectEvent(null);
                  }}
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#27272A] text-[#94A3B8] dark:text-[#71717A] hover:text-[#111827] dark:hover:text-[#F4F4F5] transition-colors"
                  aria-label="返回事件列表"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              {/* 标签 + 星级 */}
              <div className="flex items-center gap-2 mt-2">
                {selectedEvent.tag && (
                  <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                    selectedEvent.tag === '宏观' ? 'bg-[#DBEAFE] text-[#1D4ED8] dark:bg-[#172554] dark:text-[#93C5FD]' :
                    selectedEvent.tag === '政策' ? 'bg-[#EDE9FE] text-[#6D28D9] dark:bg-[#2E1065] dark:text-[#C4B5FD]' :
                    selectedEvent.tag === '财报' ? 'bg-[#FFEDD5] text-[#C2410C] dark:bg-[#431407] dark:text-[#FDBA74]' :
                    selectedEvent.tag === '行业' ? 'bg-[#DCFCE7] text-[#15803D] dark:bg-[#052E16] dark:text-[#86EFAC]' :
                    'bg-[#F1F5F9] text-[#475569] dark:bg-[#27272A] dark:text-[#A1A1AA]'
                  }`}>{selectedEvent.tag}</span>
                )}
                <span className="text-sm">
                  {Array.from({ length: 5 }, (_, j) => (
                    <span key={j} className={j < getImportance(selectedEvent.tag) ? 'text-[#F59E0B]' : 'text-[#D1D5DB] dark:text-[#52525B]'}>★</span>
                  ))}
                </span>
                <span className={`text-xs font-medium ${getImportance(selectedEvent.tag) >= 5 ? 'text-[#EF4444]' : getImportance(selectedEvent.tag) >= 4 ? 'text-[#F97316]' : 'text-[#94A3B8] dark:text-[#71717A]'}`}>
                  {getImportance(selectedEvent.tag) >= 5 ? '重大事件' : getImportance(selectedEvent.tag) >= 4 ? '重要事件' : '普通事件'}
                </span>
              </div>
            </div>

            {/* 详情内容 - 可折叠 */}
            {eventDetailExpanded && (
              <>
                {/* 分隔线 */}
                <div className="border-t border-[#E5E7EB] dark:border-[#27272A]" />

                {/* 信息 Section */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94A3B8] dark:text-[#71717A]">类型</span>
                    <span className="text-sm text-[#111827] dark:text-[#F4F4F5] font-medium">{selectedEvent.tag || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94A3B8] dark:text-[#71717A]">时间</span>
                    <span className="text-sm text-[#111827] dark:text-[#F4F4F5] font-medium font-data">{selectedEvent.time || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#94A3B8] dark:text-[#71717A]">重要性</span>
                    <span className="text-sm">
                      {Array.from({ length: 5 }, (_, j) => (
                        <span key={j} className={j < getImportance(selectedEvent.tag) ? 'text-[#F59E0B]' : 'text-[#D1D5DB] dark:text-[#52525B]'}>★</span>
                      ))}
                    </span>
                  </div>
                </div>

                {/* 分隔线 */}
                <div className="border-t border-[#E5E7EB] dark:border-[#27272A]" />

                {/* 事件影响 */}
                <div>
                  <h4 className="text-xs font-semibold text-[#111827] dark:text-[#F4F4F5] mb-2">事件影响</h4>
                  <p className="text-sm text-[#64748B] dark:text-[#A1A1AA] leading-relaxed">
                    {selectedEvent.description || `${selectedEvent.company}将于${selectedEvent.time}发布重要信息，${selectedEvent.focus || '投资者需密切关注后续进展'}。`}
                  </p>
                  {isValidEventUrl(selectedEvent.url) && (
                    <div className="mt-3 pt-3 border-t border-[#E5E7EB] dark:border-[#27272A]">
                      <span className="text-xs text-[#94A3B8] dark:text-[#71717A]">来源：</span>
                      <a
                        href={selectedEvent.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#2563EB] dark:text-[#3B82F6] hover:underline"
                      >
                        {selectedEvent.source || '查看原文'}
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  )}
                </div>

                {/* 相关市场 */}
                <div>
                  <h4 className="text-xs font-semibold text-[#111827] dark:text-[#F4F4F5] mb-2">相关市场</h4>
                  <div className="flex flex-wrap gap-1.5">
                    {['A股', '港股', '美股'].map((m) => (
                      <span key={m} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-[#F1F5F9] dark:bg-[#27272A] text-[#475569] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#27272A]">
                        {m}
                      </span>
                    ))}
                  </div>
                </div>

                {/* 分隔线 */}
                <div className="border-t border-[#E5E7EB] dark:border-[#27272A]" />

                {/* AI 分析按钮 */}
                <button
                  type="button"
                  onClick={async () => {
                    if (!showAI && !aiAnalysisResult) {
                      setAiAnalysisLoading(true);
                      try {
                        const response = await fetch('/api/analyze-event', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            title: selectedEvent?.company || '',
                            summary: selectedEvent?.focus || '',
                            type: selectedEvent?.tag || '未分类',
                            markets: [],
                            time: selectedEvent?.time,
                          }),
                        });
                        const data = await response.json();
                        if (data.success) {
                          setAiAnalysisResult(data.analysis);
                        } else {
                          setAiAnalysisResult('分析失败，请稍后重试');
                        }
                      } catch (error) {
                        setAiAnalysisResult('分析失败，请稍后重试');
                      } finally {
                        setAiAnalysisLoading(false);
                        setShowAI(true);
                      }
                    } else {
                      setShowAI(!showAI);
                    }
                  }}
                  disabled={aiAnalysisLoading}
                  className="w-full h-9 rounded-lg bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] text-xs font-medium flex items-center justify-center gap-1.5 hover:brightness-105 transition-all disabled:opacity-60"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                  </svg>
                  {aiAnalysisLoading ? 'AI 分析中...' : (showAI ? '收起 AI 分析' : '查看 AI 分析')}
                  <svg className="w-4 h-4 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={showAI ? "M19 9l-7 7-7-7" : "M9 5l7 7-7 7"} />
                  </svg>
                </button>
                {showAI && aiAnalysisResult && (
                  <div className="p-3 rounded-xl bg-[#FAFBFC] dark:bg-[#1F1F23] border border-[#E5E7EB] dark:border-[#27272A]">
                    <p className="text-xs text-[#64748B] dark:text-[#A1A1AA] leading-relaxed whitespace-pre-wrap">
                      {aiAnalysisResult}
                    </p>
                  </div>
                )}

                {/* 分隔线 */}
                <div className="border-t border-[#E5E7EB] dark:border-[#27272A]" />

                {/* 向AI提问 */}
                <div>
                  <button
                    type="button"
                    onClick={() => {
                      setAiAnalysisLoading(true);
                      setAiAnalysisResult(null);
                      // TODO: 调用 AI 分析接口
                      setTimeout(() => setAiAnalysisLoading(false), 1500);
                    }}
                    disabled={aiAnalysisLoading}
                    className="w-full h-9 flex items-center justify-center gap-2 rounded-[10px] bg-[#EFF6FF] dark:bg-[#172554] text-[#2563EB] dark:text-[#60A5FA] text-xs font-medium hover:brightness-105 transition-all duration-200 disabled:opacity-60"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {aiAnalysisLoading ? 'AI 分析中...' : '向 AI 提问'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* 事件列表（未选中事件时显示） */}
        {!selectedEvent && (
          events.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-xl bg-[#F1F5F9] dark:bg-[#27272A] flex items-center justify-center mb-3">
              <svg className="w-5 h-5 text-[#94A3B8] dark:text-[#71717A]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-sm font-medium text-[#111827] dark:text-[#F4F4F5]">暂无事件数据</p>
            <p className="text-xs text-[#94A3B8] dark:text-[#71717A] mt-1">该日期暂无投资事件记录</p>
          </div>
        ) : (
          <>
            {/* 重点事件 */}
            {(critical.length > 0 || high.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-3.5 rounded-full bg-[#EF4444]"></div>
                  <h4 className="text-xs font-semibold text-[#111827] dark:text-[#F4F4F5]">重点事件</h4>
                  <span className="text-xs text-[#94A3B8] dark:text-[#71717A] ml-auto">{critical.length + high.length} 条</span>
                </div>
                <div className="space-y-2">
                  {[...critical, ...high].map((event, i) => (
                    <EventListItem
                      key={i}
                      event={event}
                      dotColor={getImportance(event.tag) === 5 ? 'bg-[#EF4444]' : 'bg-[#F97316]'}
                      onSelect={onSelectEvent}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 其他事件 */}
            {other.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1 h-3.5 rounded-full bg-[#3B82F6]"></div>
                  <h4 className="text-xs font-semibold text-[#111827] dark:text-[#F4F4F5]">其他事件</h4>
                  <span className="text-xs text-[#94A3B8] dark:text-[#71717A] ml-auto">{other.length} 条</span>
                </div>
                <div className="space-y-1.5">
                  {other.map((event, i) => (
                    <EventListItem
                      key={i}
                      event={event}
                      dotColor="bg-[#94A3B8] dark:bg-[#71717A]"
                      onSelect={onSelectEvent}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* 相关市场 */}
            <div>
              <h4 className="text-xs font-semibold text-[#111827] dark:text-[#F4F4F5] mb-1.5">相关市场</h4>
              <div className="flex flex-wrap gap-1.5">
                {markets.map((m) => (
                  <span key={m} className="px-2.5 py-1 rounded-lg bg-[#F1F5F9] dark:bg-[#27272A] text-xs text-[#475569] dark:text-[#A1A1AA] border border-[#E5E7EB] dark:border-[#27272A]">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </>
        )
        )}
      </div>
    </div>
  );
}

export function EventsCalendarPage({ currentDate, onDateChange }: EventsCalendarPageProps) {
  const { ref } = useScrollReveal();

  // ===== 动态事件：从 API 加载每日抓取的财经事件 =====
  const [dynamicEventDays, setDynamicEventDays] = useState<EventDay[]>([]);
  const [dynamicLoading, setDynamicLoading] = useState(false);
  const [dynamicError, setDynamicError] = useState<string | null>(null);
  // 抓取失败的日期（data_status=failed），不伪造数据，仅提示
  const [fetchFailures, setFetchFailures] = useState<Record<string, { error?: string }>>({});
  const [retryingDate, setRetryingDate] = useState<string | null>(null);

  const retryFetchDate = async (dateStr: string) => {
    setRetryingDate(dateStr);
    try {
      const res = await fetch('/api/daily-events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: dateStr }),
      });
      const data = await res.json();
      if (data.success) {
        // 重新拉取整月数据
        await loadMonthEvents(calendarViewDate);
      }
    } catch (e) {
      // 失败不伪造数据，保留失败提示
      console.error('retry failed', e);
    } finally {
      setRetryingDate(null);
    }
  };

  // 月历浏览月份（独立状态）
  const [calendarViewDate, setCalendarViewDate] = useState(() => {
    const date = parseISO(currentDate);
    return startOfMonth(date);
  });

  // 拉取指定月份动态事件（可复用于重试）
  const loadMonthEvents = useCallback(async (viewDate: Date) => {
    const year = viewDate.getFullYear();
    const month = String(viewDate.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;
    setDynamicLoading(true);
    try {
      const [days, raw] = await Promise.all([
        fetchMonthlyEvents(monthStr),
        fetch(`/api/daily-events/month?month=${monthStr}`).then(r => r.json()).catch(() => null),
      ]);
      setDynamicEventDays(days);
      // 记录失败日期（data_status=failed），不伪造数据，仅用于提示
      const failed: Record<string, { error?: string }> = {};
      if (raw && Array.isArray(raw.days)) {
        for (const day of raw.days as Array<{ date: string; data_status?: string; errors?: string[] }>) {
          if (day.data_status === 'failed') {
            failed[day.date] = { error: day.errors?.[0] || '抓取失败' };
          }
        }
      }
      setFetchFailures(failed);
    } catch {
      // 整月请求失败（网络错误），不标记单日失败，静默降级
      setDynamicEventDays([]);
      setFetchFailures({});
    } finally {
      setDynamicLoading(false);
    }
  }, []);

  // 当日历视图月份变化时，加载该月的动态事件
  useEffect(() => {
    loadMonthEvents(calendarViewDate);
  }, [calendarViewDate, loadMonthEvents]);

  // 合并静态 + 动态事件的完整数据源
  const allEventDays = useMemo(() => {
    return mergeEventDays(upcomingEventsData.days, dynamicEventDays);
  }, [dynamicEventDays]);

  // 包装静态数据访问函数，使用合并后的数据
  const getEventsByDate = useCallback((dateStr: string): UpcomingEvent[] => {
    const day = allEventDays.find(d => d.date === dateStr);
    return day?.events || [];
  }, [allEventDays]);

  const getEventsFromDate = useCallback((dateStr: string, daysAhead: number = 7): EventDay[] => {
    const startDate = new Date(dateStr);
    return allEventDays
      .filter(d => {
        const eventDate = new Date(d.date);
        const diffTime = eventDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= daysAhead;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allEventDays]);

  const getEventsByMonth = useCallback((year: number, month: number): EventDay[] => {
    const monthStr = `${year}-${String(month).padStart(2, '0')}`;
    return allEventDays
      .filter(d => d.date.startsWith(monthStr))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allEventDays]);

  // 年份状态（独立于月份）
  const [viewYear, setViewYear] = useState(() => {
    return parseISO(currentDate).getFullYear();
  });

  // 事件展开状态（使用标题 + 时间作为唯一标识）
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set());
  // 事件详情状态（点击单条事件后显示详情）
  const [selectedEvent, setSelectedEvent] = useState<UpcomingEvent | null>(null);

  const getEventId = (event: UpcomingEvent) => `${event.company}-${event.focus}-${event.time}`;

  const toggleEvent = (eventId: string) => {
    setExpandedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) {
        next.delete(eventId);
      } else {
        next.add(eventId);
      }
      return next;
    });
  };

  // 今日复盘展开状态
  const [isReviewExpanded, setIsReviewExpanded] = useState(true);

  // 事件筛选状态
  const [eventFilter, setEventFilter] = useState<'all' | 'earnings' | 'macro' | 'policy' | 'meeting' | 'industry'>('all');

  // Hover 预览状态
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  // 月份选择状态
  const [selectedMonth, setSelectedMonth] = useState(() => parseISO(currentDate).getMonth());

  // 月份选择面板显示状态
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // 保存弹窗打开前的滚动位置，关闭时恢复
  const [scrollPosition, setScrollPosition] = useState<number>(0);

  // 点击日期查看事件详情
  const [selectedDateForEvents, setSelectedDateForEvents] = useState<string | null>(null);
  const [selectedDetailEvent, setSelectedDetailEvent] = useState<UpcomingEvent | null>(null);
  const [showAllDayEvents, setShowAllDayEvents] = useState(false);
  const [showCalendarQA, setShowCalendarQA] = useState(false);

  // 获取当前选中日期及未来7天的事件
  const upcomingEvents = useMemo(() => {
    return getEventsFromDate(currentDate, 7);
  }, [currentDate]);

  // 获取当前选中日期的事件（优先使用 selectedDateForEvents，否则使用 currentDate）
  const selectedDayEvents = useMemo(() => {
    const dateToUse = selectedDateForEvents || currentDate;
    return getEventsByDate(dateToUse);
  }, [currentDate, selectedDateForEvents]);

  // 按重要等级排序事件
  const sortedEvents = useMemo(() => {
    const getImportance = (tag?: string) => {
      if (tag === '宏观' || tag === '政策') return 5; // 市场级
      if (tag === '行业') return 4; // 行业级
      if (tag === '财报') return 3; // 公司级
      return 2; // 普通
    };
    return [...selectedDayEvents].sort((a, b) => getImportance(b.tag) - getImportance(a.tag));
  }, [selectedDayEvents]);

  // 获取月历显示的事件
  const monthEvents = useMemo(() => {
    return getEventsByMonth(calendarViewDate.getFullYear(), calendarViewDate.getMonth() + 1);
  }, [calendarViewDate, getEventsByMonth]);

  // 当月筛选后的事件汇总（按日期从早到晚 + 事件时间排序）
  const monthSummaryEvents = useMemo(() => {
    if (eventFilter === 'all') return [];
    const tagMap: Record<string, string> = {
      meeting: '会议', earnings: '财报', macro: '宏观', policy: '政策', industry: '行业',
    };
    const targetTag = tagMap[eventFilter];
    if (!targetTag) return [];
    const list: { date: string; event: UpcomingEvent }[] = [];
    monthEvents.forEach(day => {
      const matched = day.events.filter((e: UpcomingEvent) => e.tag === targetTag);
      matched.forEach((e: UpcomingEvent) => list.push({ date: day.date, event: e }));
    });
    list.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.event.time || '').localeCompare(b.event.time || '');
    });
    return list;
  }, [monthEvents, eventFilter]);

  // 计算日期风险等级
  const getRiskLevel = (events: UpcomingEvent[]): 'low' | 'medium' | 'high' | 'critical' => {
    const getImportance = (tag?: string) => {
      if (tag === '宏观' || tag === '政策') return 5;
      if (tag === '财报') return 4;
      if (tag === '会议' || tag === '市场') return 3;
      return 2;
    };
    const score = events.reduce((sum, e) => sum + getImportance(e.tag), 0);
    if (score >= 15) return 'critical';
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  };

  // 计算日期事件分类统计
  const getEventCounts = (events: UpcomingEvent[]) => {
    const counts = {
      macro: 0,
      earnings: 0,
      policy: 0,
      industry: 0,
      meeting: 0,
    };
    events.forEach(e => {
      if (e.tag === '宏观') counts.macro++;
      else if (e.tag === '财报') counts.earnings++;
      else if (e.tag === '政策') counts.policy++;
      else if (e.tag === '行业') counts.industry++;
      else if (e.tag === '会议') counts.meeting++;
    });
    return counts;
  };

  // 筛选事件
  const filterEvents = (events: UpcomingEvent[]) => {
    if (eventFilter === 'all') return events;
    const tagMap: Record<string, string> = {
      earnings: '财报',
      macro: '宏观',
      policy: '政策',
      meeting: '会议',
      industry: '行业',
    };
    return events.filter(e => e.tag === tagMap[eventFilter]);
  };

  // 生成月历网格
  const calendarDays = useMemo(() => {
    const start = startOfMonth(calendarViewDate);
    const end = endOfMonth(calendarViewDate);
    const days = eachDayOfInterval({ start, end });
    
    // 添加月初空白占位符（与 date-nav.tsx 保持一致）
    const startWeekday = start.getDay();
    const result: Array<{
      date: Date;
      dateStr: string;
      events: UpcomingEvent[];
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      riskLevel: 'low' | 'medium' | 'high' | 'critical';
      counts: { macro: number; earnings: number; policy: number; industry: number; meeting: number };
      heatScore: number;
    } | null> = [];
    
    for (let i = 0; i < startWeekday; i++) {
      result.push(null);
    }
    
    days.forEach(day => {
      const dateStr = format(day, 'yyyy-MM-dd');
      const dayEvents = monthEvents.find(e => e.date === dateStr)?.events || [];

      // 计算事件分类统计
      const counts = {
        macro: dayEvents.filter(e => e.tag === '宏观').length,
        earnings: dayEvents.filter(e => e.tag === '财报').length,
        policy: dayEvents.filter(e => e.tag === '政策').length,
        industry: dayEvents.filter(e => e.tag === '行业').length,
        meeting: dayEvents.filter(e => e.tag === '会议').length,
      };

      // 计算风险等级（基于事件权重）
      const getEventWeight = (tag?: string) => {
        if (tag === '宏观' || tag === '政策') return 5;
        if (tag === '财报') return 4;
        if (tag === '会议' || tag === '市场') return 3;
        return 2;
      };
      const totalWeight = dayEvents.reduce((sum, e) => sum + getEventWeight(e.tag), 0);
      let riskLevel: 'low' | 'medium' | 'high' | 'critical' = 'low';
      if (totalWeight >= 15) riskLevel = 'critical';
      else if (totalWeight >= 10) riskLevel = 'high';
      else if (totalWeight >= 5) riskLevel = 'medium';

      result.push({
        date: day,
        dateStr,
        events: dayEvents,
        isCurrentMonth: isSameMonth(day, calendarViewDate),
        isToday: isToday(day),
        isSelected: isSameDay(day, parseISO(currentDate)),
        riskLevel,
        counts,
        heatScore: totalWeight,
      });
    });
    
    return result;
  }, [calendarViewDate, monthEvents, currentDate]);

  // 月份导航
  const handlePrevMonth = () => {
    setCalendarViewDate(prev => subMonths(prev, 1));
  };

  const handleNextMonth = () => {
    setCalendarViewDate(prev => addMonths(prev, 1));
  };

  // 年份导航
  const handlePrevYear = () => {
    setViewYear(prev => prev - 1);
  };

  const handleNextYear = () => {
    setViewYear(prev => prev + 1);
  };

  // 点击月份
  const handleMonthClick = (month: number) => {
    setCalendarViewDate(new Date(viewYear, month - 1, 1));
  };

  // 点击日期查看事件详情
  const handleDayClick = (dateStr: string) => {
    setScrollPosition(window.scrollY);
    setSelectedDateForEvents(dateStr);
    setShowAllDayEvents(false);
  };

  // 按等级分组事件
  const eventsByLevel = useMemo(() => {
    const getImportance = (tag?: string) => {
      if (tag === '宏观' || tag === '政策') return 5; // 市场级
      if (tag === '行业') return 4; // 行业级
      if (tag === '财报') return 3; // 公司级
      return 2; // 普通
    };
    const groups: Record<number, UpcomingEvent[]> = { 5: [], 4: [], 3: [], 2: [] };
    sortedEvents.forEach(event => {
      const level = getImportance(event.tag);
      if (groups[level]) {
        groups[level].push(event);
      }
    });
    return groups;
  }, [sortedEvents]);

  return (
    <div ref={ref} className="space-y-6">
      {/* 1. 今日投资事件概览 */}
      <section>
        <h2 className="text-lg font-semibold text-foreground mb-4">
          今日投资事件概览
        </h2>
        <div className="rounded-2xl bg-surface-secondary border border-border p-6">
          {/* 日期标题 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-2xl font-bold text-foreground">
                {format(parseISO(selectedDateForEvents || currentDate), 'yyyy年M月d日', { locale: zhCN })}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {getWeekday(selectedDateForEvents || currentDate)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{selectedDayEvents.length}</div>
              <div className="text-xs text-muted-foreground">个事件</div>
            </div>
          </div>

          {selectedDayEvents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-sm text-muted-foreground">
                该日期暂无事件数据（数据源：华尔街见闻、金十数据）
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {/* 市场级事件 */}
              {eventsByLevel[5].length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-red-500">市场级事件</span>
                    <span className="text-xs text-muted-foreground">{eventsByLevel[5].length}</span>
                  </div>
                  <div className="space-y-2">
                    {eventsByLevel[5].map((event, i) => (
                      <EventListItem
                        key={i}
                        event={event}
                        dotColor="bg-red-500"
                        onSelect={setSelectedEvent}
                        tagClass="bg-red-500/10 text-red-500"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 行业级事件 */}
              {eventsByLevel[4].length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-orange-500">行业级事件</span>
                    <span className="text-xs text-muted-foreground">{eventsByLevel[4].length}</span>
                  </div>
                  <div className="space-y-2">
                    {eventsByLevel[4].map((event, i) => (
                      <EventListItem
                        key={i}
                        event={event}
                        dotColor="bg-orange-500"
                        onSelect={setSelectedEvent}
                        tagClass="bg-orange-500/10 text-orange-500"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 公司级事件 */}
              {eventsByLevel[3].length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-blue-500">公司级事件</span>
                    <span className="text-xs text-muted-foreground">{eventsByLevel[3].length}</span>
                  </div>
                  <div className="space-y-2">
                    {eventsByLevel[3].map((event, i) => (
                      <EventListItem
                        key={i}
                        event={event}
                        dotColor="bg-blue-500"
                        onSelect={setSelectedEvent}
                        tagClass="bg-blue-500/10 text-blue-500"
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* 普通事件 */}
              {eventsByLevel[2].length > 0 && (
                <div className="border-t border-border pt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xs font-medium text-gray-500">普通事件</span>
                    <span className="text-xs text-muted-foreground">{eventsByLevel[2].length}</span>
                  </div>
                  <div className="space-y-2">
                    {eventsByLevel[2].map((event, i) => (
                      <EventListItem
                        key={i}
                        event={event}
                        dotColor="bg-gray-500"
                        onSelect={setSelectedEvent}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* 2. 事件详情提示 */}
      {selectedDayEvents.length === 0 && (
        <section>
          <div className="rounded-lg bg-surface-secondary border border-border p-8 text-center">
            <div className="text-sm text-muted-foreground">
              该日期暂无事件数据（数据源：华尔街见闻、金十数据）
            </div>
          </div>
        </section>
      )}

      {/* 3. 今日复盘（折叠） */}
      <section>
        <button
          onClick={() => setIsReviewExpanded(!isReviewExpanded)}
          className="flex items-center justify-between w-full rounded-lg bg-surface-secondary border border-border p-4 hover:bg-surface transition-colors"
        >
          <span className="text-sm font-medium text-foreground">今日复盘</span>
          <span className="text-xs text-muted-foreground">{isReviewExpanded ? '收起' : '展开'}</span>
        </button>
        {isReviewExpanded && (
          <div className="mt-3 rounded-lg bg-surface-secondary border border-border p-4 space-y-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-2">今日重要事件总结</div>
              {sortedEvents.length === 0 ? (
                <div className="text-sm text-muted-foreground">今日暂无重点事件</div>
              ) : (
                <div className="space-y-2">
                  {(showAllDayEvents ? sortedEvents : sortedEvents.slice(0, 5)).map((event, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: (event.importance || 0) >= 5 ? '#EF4444' : (event.importance || 0) >= 4 ? '#F97316' : '#22C55E' }} />
                      <div className="min-w-0 flex-1">
                        {event.url ? (
                          <a
                            href={event.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:opacity-70 transition-opacity text-xs font-medium text-foreground leading-snug line-clamp-2 flex items-start gap-1"
                          >
                            <span className="min-w-0">{event.focus || event.company}</span>
                            <svg className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                          </a>
                        ) : (
                          <div className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                            {event.focus || event.company}
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">{event.company}</div>
                      </div>
                    </div>
                  ))}
                  {sortedEvents.length > 5 && (
                    <button
                      onClick={() => setShowAllDayEvents(!showAllDayEvents)}
                      className="text-[11px] text-[#2563EB] dark:text-[#3B82F6] hover:opacity-70 transition-opacity pl-3.5 text-left"
                    >
                      {showAllDayEvents ? '收起' : `还有 ${sortedEvents.length - 5} 件事件，点击展开全部`}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="pt-3 border-t border-border/40">
              <div className="text-xs font-medium text-muted-foreground mb-2">明日关注事项</div>
              {(() => {
                const futureDays = upcomingEvents.filter(d => d.date > currentDate && d.events?.length > 0);
                const allEvents = futureDays.flatMap(d =>
                  (d.events || []).map(e => ({ ...e, date: d.date }))
                ).slice(0, 5);
                if (allEvents.length === 0) {
                  return <div className="text-sm text-muted-foreground">明日暂无关注事件</div>;
                }
                return (
                  <div className="space-y-1.5">
                    {allEvents.map((evt, i) => (
                      <div key={evt.company + evt.date + '-' + i} className="flex gap-2">
                        <span className="w-1.5 h-1.5 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: (evt.importance || 0) >= 5 ? '#EF4444' : (evt.importance || 0) >= 4 ? '#F97316' : '#22C55E' }} />
                        <div className="min-w-0 flex-1">
                          {evt.url ? (
                            <a
                              href={evt.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:opacity-70 transition-opacity text-xs font-medium text-foreground leading-snug line-clamp-2 flex items-start gap-1"
                            >
                              <span className="min-w-0">{evt.focus || evt.company}</span>
                              <svg className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" /></svg>
                            </a>
                          ) : (
                            <div className="text-xs font-medium text-foreground leading-snug line-clamp-2">
                              {evt.focus || evt.company}
                            </div>
                          )}
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            <span className="mr-2">{evt.date.slice(5)}</span>
                            {evt.company}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>
        )}
      </section>

      {/* 5. 投资事件数据库（月历 + 右侧详情面板） */}
      <section className="cal-section -mx-4 px-4 py-6 sm:mx-0 sm:px-0 sm:py-0">
        <h2 className="cal-title mb-4">投资事件数据库</h2>

        <div className="min-w-0">
          {/* 左侧日历区域 */}
          <div className="min-w-0">
            {/* 月份导航 */}
        <div className="flex items-center justify-between mb-6 relative">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="cal-nav-btn"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMonthPicker(!showMonthPicker)}
                className="cal-month-text hover:opacity-70 transition-opacity"
              >
                {calendarViewDate.getFullYear()}年{calendarViewDate.getMonth() + 1}月
              </button>
              {calendarViewDate.getFullYear() === 2026 && calendarViewDate.getMonth() === 7 && (
                <Link
                  href="/weekly/2026-w35"
                  className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                  </svg>
                  W35 周报
                </Link>
              )}
            </div>
            <button
              onClick={handleNextMonth}
              className="cal-nav-btn"
            >
              <svg className="w-4 h-4 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          
          {/* 日程密度切换 */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground">少</span>
            <div className="cal-slider-track">
              <div className="cal-slider-thumb" />
            </div>
            <span className="text-[11px] text-muted-foreground">多</span>
          </div>

          {/* 年月选择下拉面板 */}
          {showMonthPicker && (
            <div className="absolute top-full left-0 mt-2 p-4 rounded-2xl bg-white dark:bg-[#1d1d1f] border border-border/20 shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] z-50 min-w-[320px]">
              {/* 年份选择 */}
              <div className="mb-4">
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">年份</div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setViewYear(prev => prev - 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-secondary transition-colors text-sm"
                  >
                    &lt;
                  </button>
                  <div className="flex-1 text-center text-sm font-semibold text-foreground">
                    {viewYear}年
                  </div>
                  <button
                    onClick={() => setViewYear(prev => prev + 1)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-secondary transition-colors text-sm"
                  >
                    &gt;
                  </button>
                </div>
              </div>

              {/* 月份选择网格 */}
              <div>
                <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">月份</div>
                <div className="grid grid-cols-6 gap-1.5">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(month => {
                    const isActive = calendarViewDate.getFullYear() === viewYear && calendarViewDate.getMonth() + 1 === month;
                    return (
                      <button
                        key={month}
                        onClick={() => {
                          handleMonthClick(month);
                          setShowMonthPicker(false);
                        }}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-surface-secondary text-foreground hover:bg-surface'
                        }`}
                      >
                        {month}月
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 星期表头（7天） */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAY_CN.map(day => (
            <div key={day} className="cal-weekday">
              {day}
            </div>
          ))}
        </div>

        {/* 日历网格（7列） */}
        <div className="grid grid-cols-7 gap-2">
          {(() => {
            // 将日历按周分组（每组 7 天）
            const weeks: Array<{ weekNum: number; year: number; days: typeof calendarDays }> = [];
            for (let i = 0; i < calendarDays.length; i += 7) {
              const weekSlice = calendarDays.slice(i, i + 7);
              // 找到本周第一个真实日期（非 null 占位符）来计算周数
              const firstRealDay = weekSlice.find(d => d !== null);
              let weekNum = 0;
              let year = 0;
              if (firstRealDay) {
                weekNum = getISOWeek(firstRealDay.date);
                year = firstRealDay.date.getFullYear();
              }
              weeks.push({ weekNum, year, days: weekSlice });
            }

            return weeks.map((week, wi) => {
              return (
                <React.Fragment key={`week-row-${wi}`}>
                  {/* 7 个日期格 */}
                  {week.days.map((day, di) => {
                    const idx = wi * 7 + di;
                    // 空白占位符（月初）
                    if (day === null) {
                      return <div key={idx} className="aspect-square rounded-[15px] bg-[#FAFBFC] dark:bg-[#121214] border border-[#F0F2F5] dark:border-[#202023]" />;
                    }

                    // 事件状态点颜色
                    const statusDotColors: Record<string, string> = {
                      earnings: 'bg-orange-500',
                      macro: 'bg-red-500',
                      policy: 'bg-yellow-500',
                      industry: 'bg-green-500',
                      meeting: 'bg-emerald-400',
                    };

                    // 固定显示4个核心分类标签：宏观/行业/财报/会议（横向排列）
                    const fixedCategories = ['macro', 'industry', 'earnings', 'meeting'];
                    const categoryMap: Record<string, string> = {
                      earnings: '财报',
                      macro: '宏观',
                      policy: '政策',
                      industry: '行业',
                      meeting: '会议',
                    };
                    const displayCategories = fixedCategories.map((key) => {
                      const count = (day.counts as Record<string, number>)[key] || 0;
                      return { name: categoryMap[key] || key, count, key, hasData: count > 0 };
                    });

                    // Badge 样式映射
                    const badgeClassMap: Record<string, string> = {
                      macro: 'cal-badge-macro',
                      policy: 'cal-badge-policy',
                      earnings: 'cal-badge-earnings',
                      industry: 'cal-badge-industry',
                      meeting: 'cal-badge-meeting',
                    };

                    // 星级计算
                    const starCount = day.heatScore >= 20 ? 5 : day.heatScore >= 15 ? 4 : day.heatScore >= 10 ? 3 : day.heatScore >= 5 ? 2 : 1;
                    const starClass = day.riskLevel === 'critical' ? 'cal-stars-critical' : day.riskLevel === 'high' ? 'cal-stars-high' : day.riskLevel === 'medium' ? 'cal-stars-medium' : 'cal-stars-low';
                    const weekdayStr = WEEKDAY_CN[day.date.getDay()];
                    const hasEvents = day.events.length > 0;

                    return (
                      <button
                        key={day.dateStr}
                        onClick={() => handleDayClick(day.dateStr)}
                        onMouseEnter={() => setHoverDate(day.dateStr)}
                        onMouseLeave={() => setHoverDate(null)}
                        className={`cal-card relative ${
                          day.isToday
                            ? 'cal-card-today'
                            : day.isSelected
                            ? 'cal-card-selected'
                            : !hasEvents
                            ? 'cal-card-empty'
                            : ''
                        }`}
                      >
                        {/* 左上角：日期 + 星期 */}
                        <div className="flex items-baseline gap-1">
                          <span className={`text-[18px] font-semibold leading-none ${
                            day.isToday ? 'text-white' : day.isSelected ? 'text-[#2563EB] dark:text-[#60A5FA]' : 'text-[#111827] dark:text-[#F4F4F5]'
                          }`}>
                            {day.date.getDate()}
                          </span>
                          <span className={`text-[11px] font-medium ${
                            day.isToday ? 'text-white/60' : 'text-[#94A3B8] dark:text-[#71717A]'
                          }`}>
                            {weekdayStr}
                          </span>
                        </div>

                        {/* 事件状态点 */}
                        {hasEvents && (
                          <div className="flex items-center gap-1 mt-1.5">
                            {displayCategories.length > 0 && (
                              <div className={`w-[6px] h-[6px] rounded-full ${statusDotColors[displayCategories[0].key] || 'bg-gray-400'}`} />
                            )}
                            {displayCategories.length > 1 && (
                              <div className={`w-[6px] h-[6px] rounded-full ${statusDotColors[displayCategories[1].key] || 'bg-gray-400'}`} />
                            )}
                          </div>
                        )}

                        {/* 弹性空间 */}
                        <div className="flex-1" />

                        {/* 事件分类 Badge — 固定4个核心分类横向排列 */}
                        <div className="flex flex-wrap gap-1 mb-1">
                          {displayCategories.map((cat, i) => (
                            <span
                              key={i}
                              className={`cal-badge text-[11px] ${
                                cat.hasData
                                  ? day.isToday
                                    ? 'cal-badge-today'
                                    : badgeClassMap[cat.key] || ''
                                  : 'bg-[#F1F5F9]/60 text-[#94A3B8] dark:bg-[#27272A]/40 dark:text-[#52525B]'
                              }`}
                              style={{ fontSize: '11px', padding: '2px 6px' }}
                            >
                              {cat.name}
                            </span>
                          ))}
                        </div>

                        {/* 底部星级 */}
                        <div className={`cal-stars ${day.isToday ? 'text-white/50' : starClass}`}>
                          {'★'.repeat(starCount)}{'☆'.repeat(5 - starCount)}
                        </div>

                        {/* Hover 预览 */}
                        {hoverDate === day.dateStr && day.events.length > 0 && (
                          <div className="absolute z-50 left-full top-0 ml-2 p-3 rounded-xl bg-white dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] shadow-[0_8px_24px_rgba(0,0,0,0.08)] dark:shadow-[0_8px_24px_rgba(0,0,0,0.3)] min-w-[200px] max-w-[280px]">
                            <div className="text-sm font-semibold text-[#111827] dark:text-[#F4F4F5] mb-2">
                              {format(day.date, 'M 月 d 日')}
                              <span className="text-[11px] font-normal text-[#94A3B8] dark:text-[#71717A] ml-1.5">{weekdayStr}</span>
                            </div>
                            <div className="space-y-1.5">
                              {day.events.slice(0, 5).map((event: UpcomingEvent, i: number) => (
                                <div key={i} className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
                                  <span className="text-[#111827] dark:text-[#F4F4F5] font-medium">{event.company}</span>
                                  {event.tag && <span className={`ml-1 cal-badge ${badgeClassMap[Object.entries({macro:'宏观',policy:'政策',earnings:'财报',industry:'行业',meeting:'会议'}).find(([_,v]) => v === event.tag)?.[0] || 'meeting'] || ''}`} style={{fontSize:'10px', padding:'2px 5px'}}>{event.tag}</span>}
                                </div>
                              ))}
                              {day.events.length > 5 && (
                                <div className="text-xs text-[#2563EB] dark:text-[#3B82F6]">查看更多 →</div>
                              )}
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </React.Fragment>
              );
            });
          })()}
        </div>

        {/* 底部筛选器 - Segmented Control */}
        <div className="flex justify-center mt-6">
          <div className="cal-filter-bar">
            <button
              onClick={() => setEventFilter('all')}
              className={`cal-filter-btn ${eventFilter === 'all' ? 'cal-filter-btn-active' : ''}`}
            >
              全部
            </button>
            {[
              { key: 'macro', label: '宏观' },
              { key: 'policy', label: '政策' },
              { key: 'earnings', label: '财报' },
              { key: 'industry', label: '行业' },
              { key: 'meeting', label: '会议' },
            ].map(item => (
              <button
                key={item.key}
                onClick={() => setEventFilter(item.key as typeof eventFilter)}
                className={`cal-filter-btn ${eventFilter === item.key ? 'cal-filter-btn-active' : ''}`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {/* 日历图例 */}
        <div className="flex items-center justify-center gap-6 mt-4 text-xs text-[#64748B] dark:text-[#71717A]">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-green-500 inline-block" />
            <span>有日报</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" />
            <span>今天</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-orange-400 inline-block" />
            <span>有事件</span>
          </div>
        </div>

        {/* 标签筛选后的事件汇总列表 */}
        {eventFilter !== 'all' && (
          <div className="mt-6 pt-5 cal-legend-border">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-1 h-4 rounded-full bg-[#2563EB]" />
              <h4 className="text-sm font-semibold text-[#111827] dark:text-[#F4F4F5] tracking-tight">
                {(() => {
                  const labelMap: Record<string, string> = {
                    meeting: '会议', earnings: '财报', macro: '宏观', policy: '政策', industry: '行业'
                  };
                  return `${labelMap[eventFilter]}事件汇总`;
                })()}
              </h4>
              <span className="text-xs text-[#94A3B8] dark:text-[#71717A] ml-auto">
                本月共 {monthSummaryEvents.length} 条
              </span>
            </div>
            {monthSummaryEvents.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-[#94A3B8] dark:text-[#71717A]">本月暂无该类别事件</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                {monthSummaryEvents.map((item, idx) => {
                  const hasValidUrl = isValidEventUrl(item.event.url);
                  const Wrapper = hasValidUrl ? 'a' : 'div';
                  const wrapperProps = hasValidUrl
                    ? { href: item.event.url!, target: '_blank' as const, rel: 'noopener noreferrer' }
                    : {};
                  return (
                    <Wrapper
                      key={idx}
                      {...wrapperProps}
                      className="block group p-3.5 rounded-xl bg-white dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] hover:border-[#3B82F6]/30 dark:hover:border-[#3B82F6]/50 transition-all duration-200"
                    >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-16 text-right">
                        <div className="text-[11px] text-[#64748B] dark:text-[#71717A] font-medium">
                          {format(parseISO(item.date), 'M月d日', { locale: zhCN })}
                        </div>
                        <div className="text-[10px] text-[#94A3B8] dark:text-[#71717A] mt-0.5">
                          {item.event.time}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[#111827] dark:text-[#F4F4F5] leading-snug group-hover:text-[#2563EB] dark:group-hover:text-[#3B82F6] transition-colors duration-200">
                          {item.event.company}
                          {item.event.focus && item.event.focus !== item.event.company && (
                            <span className="text-[#64748B] dark:text-[#A1A1AA] font-normal">
                              {' · '}{item.event.focus}
                            </span>
                          )}
                        </div>
                        {item.event.description && (
                          <p className="text-xs text-[#64748B] dark:text-[#71717A] mt-1.5 line-clamp-2 leading-relaxed">
                            {item.event.description}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          {item.event.tag && (
                            <span className={`cal-badge ${
                              item.event.tag === '宏观' ? 'cal-badge-macro' :
                              item.event.tag === '政策' ? 'cal-badge-policy' :
                              item.event.tag === '财报' ? 'cal-badge-earnings' :
                              item.event.tag === '行业' ? 'cal-badge-industry' :
                              'cal-badge-meeting'
                            }`} style={{fontSize:'10px', padding:'2px 6px'}}>
                              {item.event.tag}
                            </span>
                          )}
                          {item.event.source && (
                            <span className="text-[10px] text-[#94A3B8] dark:text-[#71717A]">
                              来源：{item.event.source}
                            </span>
                          )}
                          {hasValidUrl && (
                            <span className="text-[10px] text-[#2563EB] dark:text-[#3B82F6] ml-auto flex items-center gap-0.5">
                              查看原文
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                              </svg>
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    </Wrapper>
                  );
                })}
              </div>
            )}
          </div>
        )}
        </div>
      </div>

      {/* 日期详情弹窗 */}
      {selectedDateForEvents && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => {
          setSelectedDateForEvents(null);
          setSelectedDetailEvent(null);
          requestAnimationFrame(() => {
            window.scrollTo({ top: scrollPosition, behavior: 'instant' });
          });
        }}>
          <div
            className="w-full max-w-[580px] rounded-2xl bg-white dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#27272A] shadow-[0_8px_32px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] overflow-hidden"
            style={{ height: "70vh", maxHeight: "70vh" }}
            onClick={(e) => e.stopPropagation()}
          >
            <DetailPanel
              date={selectedDateForEvents}
              events={selectedDayEvents}
              selectedEvent={selectedDetailEvent}
              onSelectEvent={setSelectedDetailEvent}
              onClose={() => {
                setSelectedDateForEvents(null);
                setSelectedDetailEvent(null);
                requestAnimationFrame(() => {
                  window.scrollTo({ top: scrollPosition, behavior: 'instant' });
                });
              }}
            />
          </div>
        </div>
      )}
      </section>

      {/* 悬浮 AI 按钮 */}
      <button
        onClick={() => setShowCalendarQA(true)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-white dark:bg-[#18181B] border border-[#E5E7EB] dark:border-[#3B82F6] flex items-center justify-center shadow-[0_2px_12px_rgba(0,0,0,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] hover:scale-[1.03] transition-transform duration-200"
        title="AI 日历问答"
      >
        <svg className="w-6 h-6 text-[#2563EB] dark:text-[#3B82F6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
        </svg>
      </button>

      {/* 日历问答弹窗 */}
      <CalendarQA isOpen={showCalendarQA} onClose={() => setShowCalendarQA(false)} />
    </div>
  );
}
