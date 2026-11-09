// 事件日历数据 - 2026-07-23 至 2026-10-01
// 包含确定会发生的预示事件

export interface CalendarEvent {
  date: string;
  title: string;
  type: 'economic' | 'corporate' | 'market' | 'holiday';
  importance: 'high' | 'medium' | 'low';
  description?: string;
}

export const calendarEvents: CalendarEvent[] = [
  // 2026年7月
  { date: '2026-07-24', title: '美联储议息会议', type: 'economic', importance: 'high', description: 'FOMC利率决议，市场关注降息预期' },
  { date: '2026-07-25', title: '中报预告密集期', type: 'corporate', importance: 'medium', description: '上市公司半年度业绩预告集中披露' },
  { date: '2026-07-28', title: '政治局会议', type: 'economic', importance: 'high', description: '中央政治局会议，分析研究当前经济形势' },
  { date: '2026-07-31', title: '7月PMI数据', type: 'economic', importance: 'medium', description: '官方制造业PMI公布' },

  // 2026年8月
  { date: '2026-08-01', title: '7月财新PMI', type: 'economic', importance: 'medium', description: '财新制造业PMI公布' },
  { date: '2026-08-05', title: '中报披露开始', type: 'corporate', importance: 'high', description: '上市公司半年度报告开始披露' },
  { date: '2026-08-10', title: '7月CPI/PPI', type: 'economic', importance: 'medium', description: '7月物价数据公布' },
  { date: '2026-08-15', title: '7月社融数据', type: 'economic', importance: 'high', description: '7月社会融资规模及信贷数据' },
  { date: '2026-08-20', title: 'LPR报价', type: 'economic', importance: 'medium', description: '贷款市场报价利率公布' },
  { date: '2026-08-25', title: '中报披露高峰', type: 'corporate', importance: 'high', description: '上市公司半年度报告披露高峰期' },
  { date: '2026-08-31', title: '中报披露截止', type: 'corporate', importance: 'high', description: '上市公司半年度报告披露截止日' },

  // 2026年9月
  { date: '2026-09-01', title: '8月PMI数据', type: 'economic', importance: 'medium', description: '官方制造业PMI公布' },
  { date: '2026-09-05', title: '8月财新PMI', type: 'economic', importance: 'medium', description: '财新制造业PMI公布' },
  { date: '2026-09-10', title: '8月CPI/PPI', type: 'economic', importance: 'medium', description: '8月物价数据公布' },
  { date: '2026-09-15', title: '8月社融数据', type: 'economic', importance: 'high', description: '8月社会融资规模及信贷数据' },
  { date: '2026-09-18', title: '美联储议息会议', type: 'economic', importance: 'high', description: 'FOMC利率决议' },
  { date: '2026-09-20', title: 'LPR报价', type: 'economic', importance: 'medium', description: '贷款市场报价利率公布' },
  { date: '2026-09-25', title: '国庆前资金面', type: 'market', importance: 'medium', description: '国庆节前市场资金面关注' },
  { date: '2026-09-30', title: '三季报预告', type: 'corporate', importance: 'medium', description: '上市公司三季度业绩预告开始' },

  // 2026年10月
  { date: '2026-10-01', title: '国庆节', type: 'holiday', importance: 'high', description: '国庆节假期，A股休市' },
];

// 获取指定日期的事件
export function getEventsByDate(date: string): CalendarEvent[] {
  return calendarEvents.filter(e => e.date === date);
}

// 获取指定月份的事件
export function getEventsByMonth(yearMonth: string): CalendarEvent[] {
  return calendarEvents.filter(e => e.date.startsWith(yearMonth));
}

// 判断日期是否有事件
export function hasEvent(date: string): boolean {
  return calendarEvents.some(e => e.date === date);
}

// 获取事件类型标签
export function getEventTypeLabel(type: CalendarEvent['type']): string {
  const labels: Record<CalendarEvent['type'], string> = {
    economic: '经济数据',
    corporate: '公司事件',
    market: '市场事件',
    holiday: '节假日',
  };
  return labels[type];
}

// 获取事件类型颜色
export function getEventTypeColor(type: CalendarEvent['type']): string {
  const colors: Record<CalendarEvent['type'], string> = {
    economic: '#3b82f6',
    corporate: '#f59e0b',
    market: '#8b5cf6',
    holiday: '#ef4444',
  };
  return colors[type];
}
