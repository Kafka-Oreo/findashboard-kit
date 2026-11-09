import type { ReportData, LadderStep, SignalData, AnalystView } from '../types';
import { reports, availableDates } from './index';

// Get ISO week number
function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff / oneWeek) + start.getDay() / 7);
}

// Get all dates in the same week as the given date
export function getWeekDates(dateStr: string): string[] {
  const weekNum = getWeekNumber(dateStr);
  return availableDates.filter(d => getWeekNumber(d) === weekNum).sort();
}

// Generate weekly report from daily reports
export function generateWeeklyReport(weekStart: string): ReportData | null {
  const weekDates = getWeekDates(weekStart);
  if (weekDates.length === 0) return null;

  const weekReports = weekDates.map(d => reports[d]).filter(Boolean);
  if (weekReports.length === 0) return null;

  // Get week number and date range
  const weekNum = getWeekNumber(weekStart);
  const firstDate = weekDates[0];
  const lastDate = weekDates[weekDates.length - 1];
  const firstD = new Date(firstDate + 'T00:00:00');
  const lastD = new Date(lastDate + 'T00:00:00');

  // Get last report as base
  const lastReport = weekReports[weekReports.length - 1];

  // Calculate average temperature score
  const avgScore = Math.round(weekReports.reduce((sum, r) => sum + r.temperature.score, 0) / weekReports.length);

  // Aggregate ladder - combine all unique items
  const ladderMap = new Map<string, LadderStep>();
  for (const report of weekReports) {
    for (const item of report.ladder) {
      const key = item.stock;
      const existing = ladderMap.get(key);
      if (!existing) {
        ladderMap.set(key, item);
      }
    }
  }
  const ladder = Array.from(ladderMap.values());

  // Generate weekly signal
  const signalVerdict = avgScore >= 70 ? '偏多' : avgScore >= 40 ? '中性' : '偏空';
  const signalClass = avgScore >= 70 ? 'v-yes' as const : avgScore >= 40 ? 'v-caution' as const : 'v-no' as const;
  const signal: SignalData = {
    verdict: signalVerdict,
    verdictClass: signalClass,
    description: `周度情绪均值${avgScore}分，建议${avgScore >= 70 ? '积极操作' : avgScore >= 40 ? '波段操作' : '谨慎观望'}`,
  };

  // Generate weekly summary
  const upDays = weekReports.filter(r => r.temperature.score >= 50).length;
  const weeklySummary = `本周共${weekReports.length}个交易日，${upDays}天情绪偏暖，${weekReports.length - upDays}天偏冷。` +
    `市场情绪均值${avgScore}分，较上周${avgScore > 50 ? '升温' : '降温'}。`;

  // Generate weekly temperature
  const temperature = {
    score: avgScore,
    label: avgScore >= 70 ? '偏暖' : avgScore >= 40 ? '中性' : '偏冷',
    tipClass: avgScore >= 70 ? 'tip-warm' as const : avgScore >= 40 ? 'tip-cool' as const : 'tip-cold' as const,
    tipIcon: avgScore >= 70 ? '🔥' : avgScore >= 40 ? '⚖️' : '️',
    tipHtml: `本周情绪均值 <b>${avgScore}</b> 分`,
  };

  // Generate weekly scores
  const scores = {
    emotion: {
      value: `${avgScore}`,
      color: avgScore >= 70 ? '#F6465D' : avgScore >= 40 ? '#F0B90B' : '#0ECB81',
      desc: `周均情绪${avgScore >= 60 ? '偏强' : '偏弱'}`,
    },
    signal: {
      value: signalVerdict,
      color: avgScore >= 70 ? '#F6465D' : avgScore >= 40 ? '#F0B90B' : '#0ECB81',
      desc: `建议${avgScore >= 70 ? '积极' : avgScore >= 40 ? '波段' : '观望'}`,
    },
  };

  // Generate weekly catalysts (combine all)
  const catalysts = weekReports.flatMap(r => r.catalysts).slice(0, 5);
  const overseas = weekReports.flatMap(r => r.overseas).slice(0, 3);

  // Generate weekly analyst views
  const maView: AnalystView = {
    title: '周度复盘',
    body: `<p><b>本周总结：</b>${weeklySummary}</p><p><b>操作建议：</b>${signal.description}。</p>`,
  };

  const qianView: AnalystView = {
    title: '周度视角',
    body: `<p><b>周度视角：</b>本周市场${avgScore >= 60 ? '情绪偏强，赚钱效应较好' : '情绪偏弱，需要耐心等待'}。</p><p><b>核心逻辑：</b>关注市场情绪变化，把握节奏。</p>`,
  };

  // Weekly report data
  const weeklyReport: ReportData = {
    date: `week-${weekNum}`,
    dateLabel: `第${weekNum}周`,
    weekday: `${firstD.getMonth() + 1}/${firstD.getDate()}-${lastD.getMonth() + 1}/${lastD.getDate()}`,
    mainTitle: `A股周报 · 第${weekNum}周`,
    subtitle: weeklySummary,
    ladder,
    temperature,
    scores,
    catalysts,
    overseas,
    metrics: lastReport.metrics,
    movingAverages: lastReport.movingAverages,
    factors: lastReport.factors,
    signal,
    fundNote: `本周市场${avgScore >= 60 ? '偏强运行' : '震荡调整'}，建议${avgScore >= 70 ? '积极操作' : avgScore >= 40 ? '波段操作' : '谨慎观望'}。`,
    alerts: lastReport.alerts,
    followUp: weekReports.flatMap(r => r.followUp).filter((v, i, a) => a.indexOf(v) === i).slice(0, 5),
    maView,
    qianView,
    strategies: lastReport.strategies,
    directions: lastReport.directions,
    charts: lastReport.charts,
  };

  return weeklyReport;
}

// Cache for weekly reports
const weeklyReportCache = new Map<string, ReportData>();

export function getWeeklyReport(weekStart: string): ReportData | null {
  if (weeklyReportCache.has(weekStart)) {
    return weeklyReportCache.get(weekStart)!;
  }
  const report = generateWeeklyReport(weekStart);
  if (report) {
    weeklyReportCache.set(weekStart, report);
  }
  return report;
}

// Get weekly report by ISO week number
export function getWeeklyReportByWeek(weekNum: number): ReportData | null {
  // Find the first available date that belongs to this week
  const { availableDates } = require('./index');
  
  for (const date of availableDates) {
    const d = new Date(date + 'T00:00:00');
    const start = new Date(d.getFullYear(), 0, 1);
    const diff = d.getTime() - start.getTime();
    const oneWeek = 604800000;
    const wn = Math.ceil((diff / oneWeek) + (start.getDay() + 1) / 7);
    
    if (wn === weekNum) {
      // Find the Monday of this week
      const dayOfWeek = d.getDay();
      const monday = new Date(d);
      monday.setDate(d.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
      const mondayStr = monday.toISOString().split('T')[0];
      return getWeeklyReport(mondayStr);
    }
  }
  
  return null;
}
