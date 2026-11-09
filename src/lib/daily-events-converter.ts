/**
 * 每日财经事件 → 事件日历格式转换工具
 * 
 * 将从 akshare 抓取的 DailyEvent 格式转换为日历组件使用的 UpcomingEvent 格式，
 * 使动态抓取的事件能直接展示在事件日历中。
 */

import type { UpcomingEvent, EventDay } from './types';

/** 抓取的每日事件数据结构（与 fetch_daily_events.py 输出一致） */
export interface FetchedDailyEvent {
  event_title: string;
  event_summary: string;
  source_media: string;
  source_url: string;
  event_time: string; // "yyyy-MM-dd HH:mm"
  event_level: string; // "市场级" | "行业级" | "公司级"
}

/** 旧格式事件（早期手动录入的数据） */
interface LegacyEvent {
  time: string;
  company: string;
  title: string;
  tag?: string;
  importance?: number;
  description?: string;
  link?: string; // 原文链接
  source?: string; // 来源媒体
}

/** 月度事件 API 返回的日期分组 */
export interface FetchedEventDay {
  date: string; // "yyyy-MM-dd"
  weekday: string;
  events: Array<FetchedDailyEvent | LegacyEvent>;
  data_status?: 'verified' | 'partial' | 'failed';
  sources?: Record<string, 'success' | 'failed' | 'skipped'>;
  last_updated?: string;
  errors?: string[];
}

/** 月度事件 API 返回结构 */
export interface MonthlyEventsResponse {
  success: boolean;
  month: string;
  days: FetchedEventDay[];
  totalEvents: number;
  failed_days?: string[];
  partial_days?: string[];
}

/** 判断事件是否为新格式（fetch_daily_events.py 输出） */
function isNewFormat(event: FetchedDailyEvent | LegacyEvent): event is FetchedDailyEvent {
  return 'event_title' in event && typeof (event as FetchedDailyEvent).event_title === 'string';
}

/**
 * event_level → tag 映射
 * 
 * 市场级（央行/监管/宏观数据）→ 宏观
 * 行业级（行业政策/产业新闻）→ 产业
 * 公司级（公司公告/财报）→ 财报
 */
function mapEventLevelToTag(level: string): UpcomingEvent['tag'] {
  switch (level) {
    case '市场级':
      return '宏观';
    case '行业级':
      return '行业';
    case '公司级':
      return '财报';
    default:
      return '宏观';
  }
}

/**
 * 旧 tag 字符串 → UpcomingEvent tag 类型
 */
function normalizeTag(tag: string): UpcomingEvent['tag'] {
  const validTags: UpcomingEvent['tag'][] = ['财报', '宏观', '会议', '新股', '政策', '市场', '科技', '行业'];
  if (validTags.includes(tag as UpcomingEvent['tag'])) {
    return tag as UpcomingEvent['tag'];
  }
  // 尝试映射常见别名
  const tagMap: Record<string, UpcomingEvent['tag']> = {
    '产业': '行业',
    '产品': '行业',
    '数据': '宏观',
    'IPO': '新股',
    '进展': '行业',
    '资金': '宏观',
  };
  return tagMap[tag] || '宏观';
}

/**
 * 从 event_time 中提取时间部分
 * "2026-08-10 09:30" → "09:30"
 */
function extractTime(eventTime: string): string {
  if (!eventTime) return '全天';
  const parts = eventTime.split(' ');
  if (parts.length >= 2) {
    return parts[1];
  }
  return eventTime; // 旧格式已经是 "09:30" 或 "全天"
}

/**
 * 从 event_title 中提取公司/主体名称
 * 尝试从标题中提取关键主体
 */
function extractCompany(title: string, sourceMedia: string): string {
  if (!title) return sourceMedia || '财经要闻';

  // 按优先级排序：具体公司 > 监管机构 > 基金/ETF > 行业概念
  const subjects = [
    // 监管与宏观机构
    '中国人民银行', '金融监管总局', '国家统计局', '外汇局', '银保监会',
    '央行', '证监会', '国务院', '发改委', '工信部', '商务部', '财政部',
    '美联储', '欧央行',
    // 科技/芯片
    '华为', '腾讯', '阿里', '字节跳动', '百度', '小米', '苹果', '特斯拉', '英伟达',
    '宁德时代', '比亚迪', '长鑫科技', '寒武纪', '中际旭创', '新易盛',
    '宇树科技', '紫光国微', '中兴通讯', '中国移动', '中国电信', '中国联通',
    '美团', '拼多多', '京东',
    // 基金/券商/银行
    '中信证券', '国泰君安', '华泰证券', '海通证券', '东方财富', '同花顺',
    '国联民生', '汇添富', '华夏基金', '易方达', '嘉实基金', '南方基金',
    '工商银行', '建设银行', '农业银行', '中国银行', '招商银行',
    // ETF 指数
    '沪深300ETF', '创业板ETF', '科创50ETF', '上证50ETF', '中证500ETF',
    '黄金ETF', '黄金LOF', '北证50',
    // 新能源
    '理想汽车', '蔚来', '小鹏汽车', '长城汽车', '吉利汽车',
    '隆基绿能', '通威股份', '阳光电源', '晶科能源', '天合光能',
    // 医药
    '恒瑞医药', '药明康德', '迈瑞医疗', '片仔癀', '云南白药',
    // 消费
    '贵州茅台', '五粮液', '泸州老窖', '山西汾酒', '海天味业',
    '美的集团', '格力电器', '海尔智家',
    // 地产
    '万科', '保利发展', '招商蛇口',
    // 资源
    '紫金矿业', '中国神华', '中国石油', '中国石化',
    '江西铜业', '铜陵有色',
    // 行业/概念（最后匹配，避免覆盖更具体的）
    '磷化铟', '光模块', 'AI算力', '存储芯片', '人形机器人',
    '创新药', '新能源车', '光伏', '半导体', '人工智能', '芯片',
  ];

  for (const subject of subjects) {
    if (title.includes(subject)) {
      return subject;
    }
  }

  // 如果标题中没有匹配到已知主体，使用来源媒体
  return sourceMedia || '财经要闻';
}

/**
 * 从 event_title 中提取事件焦点描述
 * 去掉公司名后的部分作为 focus
 */
function extractFocus(title: string, company: string): string {
  if (!title) return '';
  // 去掉公司名后的部分
  const idx = title.indexOf(company);
  if (idx >= 0) {
    const rest = title.slice(idx + company.length).trim();
    if (rest.length > 0) {
      // 去掉开头的空格、标点
      return rest.replace(/^[，、：:\s]+/, '');
    }
  }
  return title;
}

/**
 * 将单条事件转换为日历事件格式（兼容新旧格式）
 */
export function convertToCalendarEvent(event: FetchedDailyEvent | LegacyEvent): UpcomingEvent {
  // 旧格式直接映射
  if (!isNewFormat(event)) {
    return {
      time: event.time || '全天',
      company: event.company || '未知',
      focus: event.title || '',
      tag: normalizeTag(event.tag || ''),
      description: event.description,
      importance: event.importance,
      url: event.link, // 映射 link 到 url
      source: event.source, // 映射 source
    };
  }

  // 新格式转换
  const company = extractCompany(event.event_title, event.source_media);
  const focus = extractFocus(event.event_title, company);
  const time = extractTime(event.event_time);

  return {
    time,
    company,
    focus,
    tag: mapEventLevelToTag(event.event_level),
    description: event.event_summary,
    url: event.source_url,
    source: event.source_media,
    publishTime: event.event_time,
    importance: event.event_level === '市场级' ? 5 : event.event_level === '行业级' ? 4 : 3,
  };
}

/**
 * 将月度 API 返回的事件数据转换为日历 EventDay 格式
 */
export function convertToEventDays(days: FetchedEventDay[]): EventDay[] {
  return days.map(day => ({
    date: day.date,
    weekday: day.weekday,
    events: day.events.map(convertToCalendarEvent),
  }));
}

/**
 * 合并硬编码事件和动态抓取事件
 * 动态事件追加到对应日期，如果日期不存在则新增
 */
export function mergeEventDays(
  staticDays: EventDay[],
  dynamicDays: EventDay[]
): EventDay[] {
  const merged = new Map<string, EventDay>();

  // 先放入静态事件
  for (const day of staticDays) {
    merged.set(day.date, { ...day, events: [...day.events] });
  }

  // 合并动态事件
  for (const day of dynamicDays) {
    const existing = merged.get(day.date);
    if (existing) {
      // 去重：检查是否已有相同标题的事件
      const existingTitles = new Set(existing.events.map(e => e.focus));
      const newEvents = day.events.filter(e => !existingTitles.has(e.focus));
      existing.events = [...existing.events, ...newEvents];
    } else {
      merged.set(day.date, { ...day, events: [...day.events] });
    }
  }

  // 按日期排序返回
  return Array.from(merged.values()).sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * 从 API 获取月度事件数据
 */
export async function fetchMonthlyEvents(month: string): Promise<EventDay[]> {
  try {
    const response = await fetch(`/api/daily-events/month?month=${month}`);
    if (!response.ok) {
      console.error('[Events Fetch] API error:', response.status);
      return [];
    }
    const data: MonthlyEventsResponse = await response.json();
    if (!data.success || !data.days) {
      return [];
    }
    return convertToEventDays(data.days);
  } catch (error) {
    console.error('[Events Fetch] Failed to fetch monthly events:', error);
    return [];
  }
}
