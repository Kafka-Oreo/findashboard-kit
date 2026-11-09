'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import AIAvatars from './ai-avatars';
import { getWeeklyReportByWeek } from '@/lib/reports/weekly';

// === Dark Gold Design Tokens ===
const GOLD = '#C89B3C';
const GOLD_LIGHT = '#E8C97A';
const GOLD_DARK = '#8B6914';
const BG_DEEP = '#0A0A0A';
const BG_CARD = '#141210';
const BG_CARD_HOVER = '#1A1713';
const TEXT_PRIMARY = '#F0E6D2';
const TEXT_SECONDARY = '#A89B7E';
const TEXT_MUTED = '#6B5E48';
const BORDER = '#2A2418';
const BORDER_GOLD = '#3D3018';
const UP_RED = '#E74C3C';
const DOWN_GREEN = '#2ECC71';


// === Light Theme Tokens ===
const LIGHT_BG = '#FDF8F0'; // 浅米白
const LIGHT_BG_GRADIENT_FROM = '#FFFDF8'; // 淡金色渐变起始
const LIGHT_BG_GRADIENT_TO = '#F8F0E0'; // 淡金色渐变结束
const LIGHT_BG_CARD = '#FFFFFF'; // 白色卡片
const LIGHT_BG_CARD_SECONDARY = '#FAFAF7'; // 浅灰白
const LIGHT_GOLD = '#B8860B';
const LIGHT_GOLD_LIGHT = '#D4A84B';
const LIGHT_GOLD_DARK = '#8B6914';
const LIGHT_TEXT_PRIMARY = '#1F2937';
const LIGHT_TEXT_SECONDARY = '#6B7280';
const LIGHT_TEXT_MUTED = '#9CA3AF';
const LIGHT_BORDER = '#E5E7EB';
const LIGHT_BORDER_GOLD = '#E8D5B0';
const LIGHT_UP_RED = '#DC2626';
const LIGHT_DOWN_GREEN = '#16A34A';
const LIGHT_GRID_LINE = '#E5E7EB';
const LIGHT_AXIS_LINE = '#D1D5DB';
// ==== Types ====
export type DailyMarketItem = {
  day: string;
  limitUp: number;
  limitDown: number;
  sentiment: number;
};

export type SevenIndexItem = {
  name: string;
  data: (number | string)[];
  total: number;
  price: (number | string)[];
  color?: string;
};

export type FundFlowItem = {
  day: string;
  main: number;
};

export type LadderItem = {
  height: string;
  stock: string;
  sector: string;
  count: number;
  board?: string;
  code?: string;
  price?: number;
  changePct?: number;
};

export type CatalystItem = {
  title: string;
  time: string;
  level: string;
  date?: string;
};

export type EventItem = {
  date: string;
  title: string;
  level: string;
};

export type RatingItem = {
  stock: string;
  rating: string;
  target: string;
  institution: string;
  change: string;
  title?: string;
  sector?: string;
  level?: string;
  company?: string;
};

export type HotspotItem = {
  time: string;
  title: string;
  category: string;
};

export type WeeklySummary = {
  weekRange: string;
  totalEvents: number;
  avgTurnover: number;
  maxLadder: number;
  maxLadderStock: string;
  sentiment: {
    score: number;
    label: string;
    trend: string;
  };
};

export type WeeklyReportData = {
  weekNum: number;
  weekLabel: string;
  weeklySummary: WeeklySummary;
  dailyMarketData: DailyMarketItem[];
  sevenIndices: SevenIndexItem[];
  weekDays: string[];
  fundFlow: FundFlowItem[];
  fundFlowSummary: string;
  weeklyLadder: LadderItem[];
  catalysts: CatalystItem[];
  warnings: string[];
  domesticEvents: EventItem[];
  overseasEvents: EventItem[];
  institutionalRatings: RatingItem[];
  weeklyHotspots: HotspotItem[];
  hotspotsDateRange: string;
};

interface WeeklyReportProps {
  weekNum?: number;
  data?: any;
}

// Daily limit & sentiment data
const dailyMarketData = [
  { day: '周一\n08.24', limitUp: 48, limitDown: 8, sentiment: 52 },
  { day: '周二\n08.25', limitUp: 60, limitDown: 12, sentiment: 48 },
  { day: '周三\n08.26', limitUp: 58, limitDown: 15, sentiment: 55 },
  { day: '周四\n08.27', limitUp: 77, limitDown: 6, sentiment: 65 },
  { day: '周五\n08.28', limitUp: 82, limitDown: 6, sentiment: 70 },
];

const weeklySummary = {
  weekRange: '2026.08.24 - 2026.08.28',
  totalEvents: 68,
  avgTurnover: 25600,
  maxLadder: 4,
  maxLadderStock: '汉森制药',
  sentiment: {
    score: 58,
    label: '情绪震荡偏强',
    trend: '周中探底后周五回暖，涨停家数逐日抬升，跌停家数收窄',
  },
};

// Sentiment chart option (dynamic by theme)
function getSentimentChartOption(isDark: boolean, marketData: DailyMarketItem[]) {
  const textPrimary = isDark ? TEXT_PRIMARY : LIGHT_TEXT_PRIMARY;
  const textSecondary = isDark ? TEXT_SECONDARY : LIGHT_TEXT_SECONDARY;
  const textMuted = isDark ? TEXT_MUTED : LIGHT_TEXT_MUTED;
  const border = isDark ? BORDER : LIGHT_GRID_LINE;
  const tooltipBg = isDark ? 'rgba(20,20,20,0.95)' : 'rgba(255,255,255,0.98)';
  const tooltipBorder = isDark ? 'rgba(200,155,60,0.3)' : 'rgba(184,134,11,0.2)';
  const splitLineColor = isDark ? 'rgba(200,155,60,0.08)' : 'rgba(200,200,200,0.4)';
  const itemBorderColor = isDark ? '#0A0A0A' : '#FFFFFF';
  const gold = isDark ? GOLD : LIGHT_GOLD;

  return {
    backgroundColor: 'transparent',
    grid: { top: 30, right: 50, bottom: 30, left: 45 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: textPrimary, fontSize: 12 },
    },
    legend: {
      data: ['涨停家数', '跌停家数', '情绪温度'],
      textStyle: { color: textMuted, fontSize: 11 },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
    },
    xAxis: {
      type: 'category',
      data: marketData.map(d => d.day),
      axisLine: { lineStyle: { color: border } },
      axisLabel: { color: textSecondary, fontSize: 11, lineHeight: 14 },
      axisTick: { show: false },
    },
    yAxis: [
      {
        type: 'value',
        name: '家数',
        nameTextStyle: { color: textMuted, fontSize: 10 },
        splitLine: { lineStyle: { color: splitLineColor } },
        axisLabel: { color: textMuted, fontSize: 10 },
      },
      {
        type: 'value',
        name: '情绪',
        min: 0,
        max: 100,
        nameTextStyle: { color: textMuted, fontSize: 10 },
        splitLine: { show: false },
        axisLabel: { color: textMuted, fontSize: 10 },
      },
    ],
    series: [
      {
        name: '涨停家数',
        type: 'bar',
        data: marketData.map(d => d.limitUp),
        barWidth: 12,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? '#E74C3C' : '#DC2626' },
              { offset: 1, color: isDark ? 'rgba(231,76,60,0.3)' : 'rgba(220,38,38,0.2)' },
            ],
          },
          borderRadius: [3, 3, 0, 0],
        },
      },
      {
        name: '跌停家数',
        type: 'bar',
        data: marketData.map(d => d.limitDown),
        barWidth: 12,
        itemStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? '#2ECC71' : '#16A34A' },
              { offset: 1, color: isDark ? 'rgba(46,204,113,0.3)' : 'rgba(22,163,74,0.2)' },
            ],
          },
          borderRadius: [3, 3, 0, 0],
        },
      },
      {
        name: '情绪温度',
        type: 'line',
        yAxisIndex: 1,
        data: marketData.map(d => d.sentiment),
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { color: gold, width: 2 },
        itemStyle: { color: gold, borderColor: itemBorderColor, borderWidth: 2 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: isDark ? 'rgba(200,155,60,0.2)' : 'rgba(184,134,11,0.15)' },
              { offset: 1, color: 'rgba(200,155,60,0)' },
            ],
          },
        },
      },
    ],
  };
}

// Seven indices weekly change data (%)
const sevenIndices = [
  { name: '上证指数', data: [0.23, -0.59, 0.35, 1.21, -0.42], total: 0.78, price: [3245.6, 3226.5, 3237.8, 3277.0, 3263.2] },
  { name: '深证成指', data: [-0.45, -1.12, -0.28, 0.89, -0.76], total: -1.72, price: [9876.5, 9765.8, 9738.2, 9824.6, 9750.1] },
  { name: '创业板指', data: [-1.87, -3.21, -0.95, 0.56, -1.34], total: -6.81, price: [2056.8, 1990.5, 1971.6, 1982.6, 1956.0] },
  { name: '沪深300', data: [0.45, -0.72, 0.18, 1.05, -0.33], total: 0.63, price: [3965.2, 3936.8, 3943.9, 3985.3, 3972.1] },
  { name: '中证500', data: [-0.82, -1.34, -0.56, 0.67, -0.89], total: -2.94, price: [5678.3, 5602.1, 5570.8, 5608.2, 5558.4] },
  { name: '科创50', data: [-2.15, -3.45, -1.23, 0.45, -1.67], total: -8.05, price: [876.5, 846.3, 835.9, 839.7, 825.7] },
  { name: '北证50', data: [-0.98, -2.01, -0.67, 1.23, -0.85], total: -3.28, price: [892.4, 874.5, 868.6, 879.3, 871.8] },
];

const weekDays = ['周一', '周二', '周三', '周四', '周五'];

// Fund flow data (亿元)
const fundFlow = [
  { day: '周一', main: -328, north: 25.6 },
  { day: '周二', main: -695, north: -42.3 },
  { day: '周三', main: -256, north: 18.7 },
  { day: '周四', main: 128, north: 56.2 },
  { day: '周五', main: -156, north: -8.9 },
];

// Ladder data (weekly summary)
const weeklyLadder = [
  { height: '4板', stock: '汉森制药', sector: '化学制药', count: 2 },
  { height: '3板', stock: '深中华A、中关村', sector: '零售/地产', count: 5 },
  { height: '2板', stock: '禾盛新材、金盾股份', sector: '新材料/军工', count: 12 },
  { height: '1板', stock: '超60只个股首板', sector: '题材分散', count: 48 },
];

// Catalysts for next week
const catalysts = [
  { title: '9月美联储议息会议', time: '9月17-18日', level: 'high' },
  { title: '国内PMI数据公布', time: '8月31日', level: 'medium' },
  { title: '中报业绩披露收尾', time: '8月30日截止', level: 'medium' },
  { title: '华为开发者大会', time: '9月初', level: 'high' },
];

// Warnings / risk reminders
const warnings = [
  '中报最后密集披露期，警惕业绩雷区',
  '高位连板股数量偏少，情绪持续性存疑',
  '创业板连续调整，注意科技成长股估值下修风险',
  '美联储9月议息会议临近，外围扰动加剧',
  '房地产新政落地效果待观察，相关板块波动可能加大',
];

// Domestic market key events
const domesticEvents = [
  { date: '8.24', title: '交易所求证：要求券商从源头提升IPO申报质量', level: '市场级' },
  { date: '8.25', title: '财政部拟发行贴现国债300亿元', level: '市场级' },
  { date: '8.26', title: '江苏鼓励生物医药企业增资扩产', level: '行业级' },
  { date: '8.27', title: '互联网金融协会拟筹备征信工作委员会', level: '市场级' },
  { date: '8.28', title: '《个人住房贷款管理办法（试行）》印发', level: '市场级' },
  { date: '8.28', title: '国家金融监管总局印发五个融资管理办法', level: '市场级' },
];

// Overseas events
const overseasEvents = [
  { date: '8.25', title: '英伟达Q2财报发布，AI收入再超预期', level: '科技' },
  { date: '8.26', title: '软银拟收购人形机器人开发商1X多数股权', level: '科技' },
  { date: '8.27', title: '美国7月耐用品订单环比超预期', level: '宏观' },
  { date: '8.28', title: '欧央行释放9月降息信号', level: '宏观' },
];

// Institutional ratings / recommendations
const institutionalRatings = [
  { stock: '康龙化成', rating: '买入', target: '33.2港元', institution: '高盛', change: '上调' },
  { stock: '宁德时代', rating: '买入', target: '320元', institution: '中信证券', change: '维持' },
  { stock: '比亚迪', rating: '增持', target: '280元', institution: '中金公司', change: '维持' },
  { stock: '中芯国际', rating: '买入', target: '68元', institution: '海通证券', change: '上调' },
  { stock: '长江电力', rating: '买入', target: '32元', institution: '国泰君安', change: '维持' },
];

// Weekly cls hotspots (5 days)
const weeklyHotspots = [
  { time: '08-28 16:32', title: '房地产融资新政落地，五个管理办法同时印发', category: '政策' },
  { time: '08-28 14:15', title: '沪指午后跳水，两市超4000只个股下跌', category: '市场' },
  { time: '08-27 21:08', title: '英伟达财报超预期，AI算力需求持续爆发', category: '科技' },
  { time: '08-27 10:45', title: '人形机器人概念走强，软银收购1X刺激板块', category: '科技' },
  { time: '08-26 15:30', title: '江苏生物医药产业新政，鼓励创新药研发', category: '医药' },
  { time: '08-26 09:12', title: '硅片价格分化，电池片报价或将下调', category: '光伏' },
  { time: '08-25 14:20', title: '上海离岸贸易印花税政策深入实施', category: '政策' },
  { time: '08-25 11:30', title: '财政部拟发行300亿元贴现国债', category: '宏观' },
  { time: '08-24 16:00', title: '交易所求证提升IPO申报质量，严审入口关', category: '监管' },
  { time: '08-24 10:25', title: '上海商业航天发展规划出炉，支持重复使用火箭', category: '航天' },
];

// Default W35 data (exported for reuse)
export const W35_DATA: WeeklyReportData = {
  weekNum: 35,
  weekLabel: '8月24日 — 8月28日',
  weeklySummary,
  dailyMarketData,
  sevenIndices,
  weekDays,
  fundFlow,
  fundFlowSummary: '本周主力资金累计净流出约1307亿元。周二受权重护盘失效影响，主力单日大幅流出。周四探底回升，资金小幅回流。',
  weeklyLadder,
  catalysts,
  warnings,
  domesticEvents,
  overseasEvents,
  institutionalRatings,
  weeklyHotspots,
  hotspotsDateRange: '08.24 - 08.28',
};

export function WeeklyReport({ data }: WeeklyReportProps) {
  const [activeTab, setActiveTab] = useState<string>('all');
  const containerRef = useRef<HTMLDivElement>(null);

  // 深色/浅色模式（SSR 先渲染深色，客户端挂载后再同步真实偏好，避免 hydration mismatch）
  const [isDark, setIsDark] = useState<boolean>(true);
  const [mounted, setMounted] = useState<boolean>(false);
  // 七指数图当前选中的指数名称（用于单指数选中时显示数据标签）
  const [selectedIndices, setSelectedIndices] = useState<Set<string> | null>(null);
  const [ladderQuotes, setLadderQuotes] = useState<Record<string, { price: number; change_pct: number }>>({});
  const [ladderLoading, setLadderLoading] = useState(false);

  // 使用传入数据，默认 W35
  const d = (data ?? W35_DATA) as WeeklyReportData;
  const weekDays = d.weekDays;
  const fundFlow = d.fundFlow;
  const weeklyLadder = d.weeklyLadder;
  const catalysts = d.catalysts;
  const warnings = d.warnings;
  const domesticEvents = d.domesticEvents;
  const overseasEvents = d.overseasEvents;
  const institutionalRatings = d.institutionalRatings;
  const weeklyHotspots = d.weeklyHotspots;
  const dailyMarketData = d.dailyMarketData;
  const sevenIndices = d.sevenIndices;
  const weekLabel = d.weekLabel;
  const weeklySummary = d.weeklySummary;
  const fundFlowSummary = d.fundFlowSummary;
  const hotspotsDateRange = d.hotspotsDateRange;

  // 主题色变量（根据 isDark 动态切换）
  const tBg = isDark ? BG_DEEP : LIGHT_BG;
  const tBgCard = isDark ? BG_CARD : LIGHT_BG_CARD;
  const tBgCardHover = isDark ? BG_CARD_HOVER : LIGHT_BG_CARD_SECONDARY;
  const tTextPrimary = isDark ? TEXT_PRIMARY : LIGHT_TEXT_PRIMARY;
  const tTextSecondary = isDark ? TEXT_SECONDARY : LIGHT_TEXT_SECONDARY;
  const tTextMuted = isDark ? TEXT_MUTED : LIGHT_TEXT_MUTED;
  const tBorder = isDark ? BORDER : LIGHT_BORDER_GOLD;
  const tGoldTitle = isDark ? GOLD_LIGHT : LIGHT_GOLD_DARK;
  const tGold = isDark ? GOLD : LIGHT_GOLD;
  const tGoldLight = isDark ? GOLD_LIGHT : LIGHT_GOLD_LIGHT;
  const tUp = isDark ? UP_RED : LIGHT_UP_RED;
  const tDown = isDark ? DOWN_GREEN : LIGHT_DOWN_GREEN;

  useEffect(() => {
    const stored = localStorage.getItem('theme-mode');
    if (stored) {
      setIsDark(stored === 'dark');
    } else {
      setIsDark(document.documentElement.classList.contains('dark'));
    }
    setMounted(true);
  }, []);

  // 加载连板表个股实时行情
  useEffect(() => {
    const names = weeklyLadder.map(s => s.stock).filter(Boolean);
    if (names.length === 0) return;

    const loadQuotes = async () => {
      setLadderLoading(true);
      try {
        const res = await fetch(`/api/stock-quote/realtime?names=${encodeURIComponent(names.join(','))}`);
        const data = await res.json();
        if (data?.byName) {
          const quotes: Record<string, { price: number; change_pct: number }> = {};
          for (const [name, q] of Object.entries(data.byName)) {
            const qq = q as { price: number; change_pct: number };
            quotes[name] = { price: qq.price, change_pct: qq.change_pct };
          }
          setLadderQuotes(quotes);
        }
      } catch {
        // 加载失败，保持空数据
      } finally {
        setLadderLoading(false);
      }
    };

    loadQuotes();
  }, [weeklyLadder]);

  const toggleTheme = () => {
    setIsDark((prev) => {
      const next = !prev;
      localStorage.setItem('theme-mode', next ? 'dark' : 'light');
      if (next) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      return next;
    });
  };

  // Seven indices line chart option
  const lineChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? BG_CARD : '#FFFFFF',
      borderColor: isDark ? BORDER_GOLD : LIGHT_BORDER_GOLD,
      textStyle: { color: isDark ? TEXT_PRIMARY : LIGHT_TEXT_PRIMARY, fontSize: 12 },
      axisPointer: { type: 'cross', lineStyle: { color: isDark ? GOLD_DARK : LIGHT_GOLD } },
    },
    legend: {
      data: d.sevenIndices.map((i: SevenIndexItem) => i.name),
      textStyle: { color: tTextSecondary, fontSize: 11 },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 2,
      icon: 'roundRect',
    },
    grid: {
      left: 40,
      right: 20,
      top: 50,
      bottom: 30,
    },
    xAxis: {
      type: 'category',
      data: weekDays,
      axisLine: { lineStyle: { color: isDark ? BORDER : LIGHT_GRID_LINE } },
      axisLabel: { color: tTextSecondary, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '涨跌幅(%)',
      nameTextStyle: { color: isDark ? TEXT_MUTED : LIGHT_TEXT_MUTED, fontSize: 10 },
      axisLine: { show: false },
      axisLabel: { color: tTextSecondary, fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? BORDER : LIGHT_GRID_LINE, type: 'dashed' } },
    },
    series: d.sevenIndices.map((idx: SevenIndexItem, i: number) => ({
      name: idx.name,
      type: 'line',
      data: idx.data,
      smooth: true,
      symbol: 'circle',
      symbolSize: i === 0 ? 9 : 4,
      lineStyle: { width: i === 0 ? 2.5 : 1.5, opacity: i === 0 ? 1 : 0.85 },
      itemStyle: { borderWidth: 0 },
      emphasis: { focus: 'series' },
      label: {
        show: false,
        position: 'top',
        distance: 6,
        color: GOLD,
        fontSize: 12,
        fontWeight: 'bold',
      },
      labelLayout: {
        hideOverlap: true,
      },
    })),
    color: ['#C89B3C', '#E74C3C', '#2ECC71', '#3498DB', '#9B59B6', '#E67E22', '#1ABC9C'],
  };

  const lineChartRef = useRef<ReactECharts | null>(null);

  const updateSingleIndexLabel = (selected: Record<string, boolean>) => {
    const chart = lineChartRef.current?.getEchartsInstance();
    if (!chart) return;
    const selectedNames = Object.entries(selected)
      .filter(([, v]) => v)
      .map(([k]) => k);
    const isSingle = selectedNames.length === 1;
    const singleName = isSingle ? selectedNames[0] : null;

    const labelColor = isDark ? '#C89B3C' : '#B8860B';

    const seriesUpdates = d.sevenIndices.map((idx: SevenIndexItem) => {
      const show = isSingle && idx.name === singleName;
      return {
        label: {
          show,
          position: 'top' as const,
          color: labelColor,
          fontSize: 12,
          fontWeight: 'bold' as const,
          formatter: (params: { dataIndex: number }) => {
            const val = idx.price?.[params.dataIndex];
            if (val == null || val === '-') return '';
            return typeof val === 'number' ? val.toFixed(2) : String(val);
          },
        },
      };
    });

    chart.setOption({ series: seriesUpdates });
  };

  const onLineChartEvents = {
    legendselectchanged: (params: { selected: Record<string, boolean> }) => {
      setSelectedIndices(
        new Set(
          Object.entries(params.selected)
            .filter(([, v]) => v)
            .map(([k]) => k)
        )
      );
      updateSingleIndexLabel(params.selected);
    },
  };

  // Fund flow bar chart
  const fundChartOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: isDark ? BG_CARD : '#FFFFFF',
      borderColor: isDark ? BORDER_GOLD : LIGHT_BORDER_GOLD,
      textStyle: { color: isDark ? TEXT_PRIMARY : LIGHT_TEXT_PRIMARY, fontSize: 12 },
      axisPointer: { type: 'shadow' },
      valueFormatter: (v: number) => `${v}亿`,
    },
    legend: {
      data: ['主力资金'],
      textStyle: { color: tTextSecondary, fontSize: 11 },
      top: 0,
      right: 0,
      itemWidth: 12,
      itemHeight: 8,
      icon: 'rect',
    },
    grid: { left: 45, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: fundFlow.map(f => f.day),
      axisLine: { lineStyle: { color: isDark ? BORDER : LIGHT_GRID_LINE } },
      axisLabel: { color: tTextSecondary, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '亿元',
      nameTextStyle: { color: isDark ? TEXT_MUTED : LIGHT_TEXT_MUTED, fontSize: 10 },
      axisLine: { show: false },
      axisLabel: { color: tTextSecondary, fontSize: 11 },
      splitLine: { lineStyle: { color: isDark ? BORDER : LIGHT_GRID_LINE, type: 'dashed' } },
    },
    series: [
      {
        name: '主力资金',
        type: 'bar',
        data: fundFlow.map(f => ({
          value: f.main,
          itemStyle: { color: f.main >= 0 ? (isDark ? UP_RED : LIGHT_UP_RED) : (isDark ? DOWN_GREEN : LIGHT_DOWN_GREEN), borderRadius: [3, 3, 0, 0] },
        })),
        barWidth: 22,
      },
    ],
  };

  // Section wrapper component styles
  const cardStyle = {
    background: tBgCard,
    border: `1px solid ${tBorder}`,
    borderRadius: '8px',
  };

  const sectionTitle = {
    color: tGoldTitle,
    fontSize: '15px',
    fontWeight: 600,
    letterSpacing: '0.5px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  };

  const goldDot = (
    <span style={{ width: '4px', height: '4px', background: tGold, borderRadius: '50%' }} />
  );

  return (
    <div
      ref={containerRef}
      style={{
        minHeight: '100vh',
        background: isDark
          ? BG_DEEP
          : `linear-gradient(180deg, ${LIGHT_BG_GRADIENT_FROM} 0%, ${LIGHT_BG_GRADIENT_TO} 100%)`,
        color: isDark ? TEXT_PRIMARY : LIGHT_TEXT_PRIMARY,
        fontFamily: "'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif",
        transition: 'background 0.3s ease, color 0.3s ease',
      }}
    >
      {/* === Header / 标题区 === */}
      <div
        style={{
          padding: '60px 24px 40px',
          textAlign: 'center',
          borderBottom: `1px solid ${isDark ? BORDER : LIGHT_BORDER_GOLD}`,
          background: isDark
            ? `linear-gradient(180deg, ${BG_CARD} 0%, ${BG_DEEP} 100%)`
            : `linear-gradient(180deg, ${LIGHT_BG_GRADIENT_FROM} 0%, ${LIGHT_BG_GRADIENT_TO} 100%)`,
          position: 'relative',
        }}
      >
        <button
          onClick={toggleTheme}
          style={{
            position: 'absolute',
            top: '24px',
            right: '24px',
            padding: '8px 16px',
            borderRadius: '9999px',
            border: `1px solid ${isDark ? BORDER : LIGHT_BORDER_GOLD}`,
            background: 'transparent',
            color: isDark ? GOLD : LIGHT_GOLD,
            fontSize: '12px',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          {isDark ? '☀️ 浅色' : '🌙 深色'}
        </button>
        <div style={{ color: tGold, fontSize: '14px', letterSpacing: '4px', marginBottom: '16px' }}>
          2026 年 8 月
        </div>
        <div style={{ fontSize: '14px', color: tTextSecondary, marginBottom: '48px' }}>周</div>
        <div
          style={{
            fontSize: '36px',
            fontWeight: 700,
            color: tGoldLight,
            letterSpacing: '6px',
            textShadow: isDark ? `0 0 30px ${GOLD_DARK}` : 'none',
            marginBottom: '12px',
          }}
        >
          W{d.weekNum}
        </div>
        <div style={{ fontSize: '14px', color: tTextSecondary, marginTop: '8px' }}>
          {weeklySummary.weekRange}
        </div>
        <div style={{ fontSize: '12px', color: tTextMuted, marginTop: '4px' }}>
          A股周度复盘 · 5个交易日 · {weeklySummary.totalEvents}条财经事件
        </div>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '32px 20px 60px' }}>
        {/* === 1. 涨跌停 & 情绪温度 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={sectionTitle} className="mb-3">
            {goldDot}本周涨跌停 & 情绪温度
          </div>
          <ReactECharts option={getSentimentChartOption(isDark, d.dailyMarketData)} style={{ height: '260px', width: '100%' }} notMerge />
          <div style={{ fontSize: '13px', color: tTextSecondary, lineHeight: 1.8, marginTop: '12px' }}>
            本周情绪整体<span style={{ color: weeklySummary.sentiment.score >= 60 ? UP_RED : DOWN_GREEN }}>{weeklySummary.sentiment.label}</span>，
            {weeklySummary.sentiment.trend}。
            周成交均值约 <span style={{ color: tGoldLight }}>{(weeklySummary.avgTurnover / 10000).toFixed(2)}万亿</span>，
            涨停家数从周一 <span style={{ color: UP_RED }}>48家</span> 回升至周五 <span style={{ color: UP_RED }}>82家</span>，
            赚钱效应有所修复。
          </div>
        </div>

        {/* === 2. 海外市场 & 国内市场讯息 === */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }} className="mb-5">
          <div style={cardStyle} className="p-4">
            <div style={{ ...sectionTitle, fontSize: '13px' }} className="mb-3">
              {goldDot}海外市场本周
            </div>
            <div style={{ fontSize: '12px', lineHeight: 2 }}>
              {overseasEvents.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '4px 0', borderBottom: i < overseasEvents.length - 1 ? `1px solid ${tBorder}` : 'none' }}>
                  <span style={{ color: tTextMuted, fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '2px' }}>{e.date}</span>
                  <span style={{ color: tTextSecondary, fontSize: '11px', lineHeight: 1.5 }}>{e.title}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={cardStyle} className="p-4">
            <div style={{ ...sectionTitle, fontSize: '13px' }} className="mb-3">
              {goldDot}国内市场本周
            </div>
            <div style={{ fontSize: '12px', lineHeight: 2 }}>
              {domesticEvents.map((e, i) => (
                <div key={i} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '4px 0', borderBottom: i < domesticEvents.length - 1 ? `1px solid ${tBorder}` : 'none' }}>
                  <span style={{ color: tTextMuted, fontSize: '10px', whiteSpace: 'nowrap', flexShrink: 0, paddingTop: '2px' }}>{e.date}</span>
                  <span style={{ color: tTextSecondary, fontSize: '11px', lineHeight: 1.5 }}>{e.title}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* === 3. 本周短线情绪·连板高标梯队 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={sectionTitle} className="mb-4">
            {goldDot}本周短线情绪 · 连板高标梯队
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <span style={{ fontSize: '12px', color: tTextSecondary }}>本周最高连板</span>
              <span style={{ fontSize: '28px', fontWeight: 700, color: UP_RED, marginLeft: '12px' }}>{weeklySummary.maxLadder}板</span>
              <span style={{ fontSize: '12px', color: GOLD, marginLeft: '8px' }}>{weeklySummary.maxLadderStock}</span>
            </div>
            <div style={{ fontSize: '11px', color: tTextMuted, textAlign: 'right' }}>
              <div>累计晋级 {weeklyLadder.reduce((s, l) => s + l.count, 0)} 次</div>
              <div>连板溢价率 约 28%</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {weeklyLadder.map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span
                  style={{
                    width: '48px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: i === 0 ? 'rgba(231,76,60,0.15)' : 'rgba(200,155,60,0.08)',
                    border: `1px solid ${i === 0 ? 'rgba(231,76,60,0.4)' : tBorder}`,
                    borderRadius: '4px',
                    color: i === 0 ? UP_RED : GOLD_LIGHT,
                    fontSize: '13px',
                    fontWeight: 600,
                  }}
                >
                  {step.height}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', color: tTextPrimary, fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {step.stock}
                    {step.code && <span style={{ fontSize: '10px', color: tTextMuted, fontWeight: 400 }}>{step.code}</span>}
                  </div>
                  <div style={{ fontSize: '11px', color: tTextMuted, marginTop: '2px' }}>{step.sector}</div>
                </div>
                <div style={{ fontSize: '11px', color: tTextSecondary, minWidth: '60px', textAlign: 'right' }}>
                  {ladderLoading ? (
                    <div style={{ fontSize: '10px', color: tTextMuted }}>加载中...</div>
                  ) : ladderQuotes[step.stock] ? (
                    <>
                      <div style={{ fontWeight: 600, color: tTextPrimary }}>
                        {ladderQuotes[step.stock].price.toFixed(2)}
                      </div>
                      <div style={{ color: ladderQuotes[step.stock].change_pct >= 0 ? tUp : tDown, fontWeight: 500 }}>
                        {ladderQuotes[step.stock].change_pct >= 0 ? '+' : ''}{ladderQuotes[step.stock].change_pct.toFixed(2)}%
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '10px', color: tTextMuted }}>暂无行情</div>
                  )}
                  <div style={{ fontSize: '10px', color: tTextMuted }}>{step.count}只</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === 4. 主力资金流向对比 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={sectionTitle} className="mb-4">
            {goldDot}本周主力资金流向对比
          </div>
          <div style={{ height: '220px' }}>
            <ReactECharts option={fundChartOption} style={{ height: '100%', width: '100%' }} />
          </div>
          <div style={{ fontSize: '12px', color: tTextSecondary, marginTop: '12px', lineHeight: 1.8 }}>
            本周主力资金累计<span style={{ color: DOWN_GREEN }}>{fundFlowSummary}</span>
          </div>
        </div>

        {/* === 5. 七指数本周涨跌幅折线图 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={sectionTitle} className="mb-4">
            {goldDot}七指数本周涨跌幅
          </div>
          <div style={{ height: '260px' }}>
            <ReactECharts ref={lineChartRef} option={lineChartOption} style={{ height: '100%', width: '100%' }} onEvents={onLineChartEvents} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(d.sevenIndices.length, 7)}, 1fr)`, gap: '4px', marginTop: '16px' }}>
            {d.sevenIndices.map((idx, i) => {
              const hasTotal = typeof idx.total === 'number' && !isNaN(idx.total);
              return (
                <div key={i} style={{ textAlign: 'center', padding: '8px 4px' }}>
                  <div style={{ fontSize: '10px', color: tTextMuted, marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{idx.name}</div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: hasTotal ? (idx.total >= 0 ? tUp : tDown) : tTextMuted }}>
                    {hasTotal ? `${idx.total >= 0 ? '+' : ''}${idx.total.toFixed(2)}%` : '暂缺'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* === 6. 后续关注催化 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={sectionTitle} className="mb-4">
            {goldDot}后续关注催化
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {catalysts.map((c, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  background: tBgCardHover,
                  borderLeft: `3px solid ${c.level === 'high' ? UP_RED : GOLD_DARK}`,
                  borderRadius: '0 4px 4px 0',
                }}
              >
                <span style={{ fontSize: '13px', color: tTextPrimary }}>{c.title}</span>
                <span style={{ fontSize: '11px', color: tTextMuted }}>{c.time}</span>
              </div>
            ))}
          </div>
        </div>

        {/* === 7. 机构推荐 · 最新投资评级 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={sectionTitle} className="mb-4">
            {goldDot}机构推荐 · 最新投资评级
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tBorder}` }}>
                  <th style={{ textAlign: 'left', padding: '8px 12px', color: tTextSecondary, fontWeight: 500 }}>股票</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: tTextSecondary, fontWeight: 500 }}>评级</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: tTextSecondary, fontWeight: 500 }}>目标价</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: tTextSecondary, fontWeight: 500 }}>机构</th>
                  <th style={{ textAlign: 'center', padding: '8px 12px', color: tTextSecondary, fontWeight: 500 }}>变动</th>
                </tr>
              </thead>
              <tbody>
                {institutionalRatings.map((r, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${tBorder}` }}>
                    <td style={{ padding: '10px 12px', color: tTextPrimary, fontWeight: 500 }}>{r.stock}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{
                        padding: '2px 8px',
                        borderRadius: '3px',
                        fontSize: '11px',
                        background: r.rating === '买入' ? 'rgba(231,76,60,0.12)' : 'rgba(200,155,60,0.12)',
                        color: r.rating === '买入' ? UP_RED : GOLD_LIGHT,
                      }}>{r.rating}</span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: tGoldLight }}>{r.target}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: tTextSecondary, fontSize: '11px' }}>{r.institution}</td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', color: r.change === '上调' ? UP_RED : tTextMuted, fontSize: '11px' }}>{r.change}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* === 8. 本周最新动态·财联社 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={{ ...sectionTitle, marginBottom: '16px' }}>
            {goldDot}本周最新动态 · 财联社
            <span style={{ fontSize: '11px', color: tTextMuted, fontWeight: 400, marginLeft: '8px' }}>{hotspotsDateRange}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {weeklyHotspots.map((item, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '10px 0',
                  borderBottom: i < weeklyHotspots.length - 1 ? `1px solid ${tBorder}` : 'none',
                  alignItems: 'flex-start',
                }}
              >
                <span style={{
                  fontSize: '10px',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  background: 'rgba(200,155,60,0.1)',
                  color: GOLD_LIGHT,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  marginTop: '1px',
                }}>
                  {item.category}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', color: tTextPrimary, lineHeight: 1.6 }}>{item.title}</div>
                  <div style={{ fontSize: '10px', color: tTextMuted, marginTop: '4px' }}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* === 9. 后续避雷与提醒 === */}
        <div style={cardStyle} className="mb-5 p-5">
          <div style={sectionTitle} className="mb-4">
            {goldDot}后续避雷与提醒
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {warnings.map((w, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  padding: '10px 14px',
                  background: 'rgba(231,76,60,0.05)',
                  border: `1px solid rgba(231,76,60,0.15)`,
                  borderRadius: '4px',
                }}
              >
                <span style={{ color: UP_RED, fontSize: '13px', flexShrink: 0 }}>⚠</span>
                <span style={{ fontSize: '12px', color: tTextSecondary, lineHeight: 1.7 }}>{w}</span>
              </div>
            ))}
          </div>
        </div>

        {/* === 10. AI 投顾助手 === */}
        <div style={cardStyle} className="p-5">
          <div style={sectionTitle} className="mb-4">
            {goldDot}AI 投顾助手
            <span style={{ fontSize: '11px', color: tTextMuted, fontWeight: 400, marginLeft: '8px' }}>双师分身 · 点击对话</span>
          </div>
          <AIAvatars />
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: '48px', paddingTop: '24px', borderTop: `1px solid ${tBorder}` }}>
          <div style={{ fontSize: '11px', color: tTextMuted, lineHeight: 2 }}>
            数据来源：东方财富、财联社、公开信息整理
          </div>
          <div style={{ fontSize: '10px', color: tTextMuted, opacity: 0.6, marginTop: '4px' }}>
            仅供参考，不构成投资建议
          </div>
        </div>
      </div>
    </div>
  );
}
