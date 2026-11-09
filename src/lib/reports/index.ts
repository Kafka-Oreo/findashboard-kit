import type { ReportData } from '../types';

/**
 * 日报数据注册表
 *
 * 每个日报是一个独立的 TS 数据模块（符合 `ReportData` 结构），
 * 新增一份日报只需三步：
 *   1. 复制任意现有日期文件（如 `2026-09-23.ts`）为 `YYYY-MM-DD.ts`
 *   2. 替换其中的数据内容
 *   3. 在下方 import 并注册进 `reports` 对象
 *
 * 模板内置 5 份示例日报（2026-08-31 ~ 2026-09-23），用于演示
 * 页面各模块的渲染效果。接入你自己的数据时可直接删除示例。
 */

// ---- 示例日报（可整组删除） ----
import report0831 from './2026-08-31';
import report0914 from './2026-09-14';
import report0915 from './2026-09-15';
import report0916 from './2026-09-16';
import report0923 from './2026-09-23';

export const reports: Record<string, ReportData> = {
  '2026-08-31': report0831,
  '2026-09-14': report0914,
  '2026-09-15': report0915,
  '2026-09-16': report0916,
  '2026-09-23': report0923,
};

export const availableDates = Object.keys(reports).sort((a, b) => b.localeCompare(a));

// Get available months
export const availableMonths = Array.from(
  new Set(availableDates.map((d) => d.substring(0, 7)))
).sort((a, b) => b.localeCompare(a));

export function getReportByDate(date: string): ReportData | undefined {
  return reports[date];
}

// Get all dates for a specific month
export function getDatesByMonth(month: string): string[] {
  return availableDates
    .filter((d) => d.startsWith(month))
    .sort((a, b) => a.localeCompare(b));
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function getWeekday(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return WEEKDAYS[d.getDay()];
}

export function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// Get ISO week number
export function getWeekNumber(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00');
  const start = new Date(d.getFullYear(), 0, 1);
  const diff = d.getTime() - start.getTime();
  const oneWeek = 604800000;
  return Math.ceil((diff / oneWeek) + (start.getDay() + 1) / 7);
}
