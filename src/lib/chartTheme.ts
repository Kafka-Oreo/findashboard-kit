/**
 * 统一图表主题配置
 * 所有 ECharts 图表都从这里获取颜色
 * 修改此处即可全局切换图表配色
 */

export interface ChartThemeConfig {
  background: string;
  text: string;
  axis: string;
  grid: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  purple: string;
  tooltipBg: string;
  tooltipBorder: string;
}

export interface ChartThemes {
  dark: ChartThemeConfig;
  light: ChartThemeConfig;
}

export const chartTheme: ChartThemes = {
  dark: {
    background: "#111827",
    text: "#f3f4f6",
    axis: "#9ca3af",
    grid: "#374151",
    red: "#ef4444",
    green: "#22c55e",
    yellow: "#f59e0b",
    blue: "#3b82f6",
    purple: "#a855f7",
    tooltipBg: "#1e293b",
    tooltipBorder: "#334155",
  },
  light: {
    background: "#ffffff",
    text: "#111827",
    axis: "#6b7280",
    grid: "#e5e7eb",
    red: "#dc2626",
    green: "#16a34a",
    yellow: "#d97706",
    blue: "#2563eb",
    purple: "#9333ea",
    tooltipBg: "#ffffff",
    tooltipBorder: "#d2d2d7",
  },
};

/**
 * 获取当前主题的图表配置
 * @param isDark - 是否为深色模式
 * @returns 当前主题的图表配置
 */
export function getChartTheme(isDark: boolean): ChartThemeConfig {
  return isDark ? chartTheme.dark : chartTheme.light;
}

/**
 * 创建 ECharts tooltip 配置
 */
export function createTooltipConfig(theme: ChartThemeConfig) {
  return {
    backgroundColor: theme.tooltipBg,
    borderColor: theme.tooltipBorder,
    textStyle: { color: theme.text },
  };
}

/**
 * 创建 ECharts 坐标轴配置
 */
export function createAxisConfig(theme: ChartThemeConfig) {
  return {
    axisLine: { lineStyle: { color: theme.grid } },
    axisLabel: { color: theme.axis },
    splitLine: { lineStyle: { color: theme.grid, type: "dashed" as const } },
  };
}
