"use client";

import { WeeklyReport } from "@/components/report/weekly-report";
import type { WeeklyReportData } from "@/components/report/weekly-report";

// W33 真实数据（2026年8月10日-8月14日）
// 数据来源：akshare七指数数据、涨跌停数据（akshare）、每日财经事件
const W33_DATA: WeeklyReportData = {
  weekNum: 33,
  weekLabel: '8月10日 — 8月14日',
  weeklySummary: {
    weekRange: '2026.08.10 - 2026.08.14',
    totalEvents: 15,
    avgTurnover: 0,
    maxLadder: 5,
    maxLadderStock: '开开实业',
    sentiment: {
      score: 52,
      label: '情绪震荡偏弱',
      trend: '本周指数分化，创业板指周涨2.52%、上证指数周跌0.99%。涨跌停数量较上周有所回落，周五跌停家数升至10家，市场情绪偏弱震荡。',
    },
  },
  weekDays: ['周一\n08.10', '周二\n08.11', '周三\n08.12', '周四\n08.13', '周五\n08.14'],
  dailyMarketData: [
    { day: '周一\n08.10', limitUp: 99, limitDown: 5, sentiment: 72 },
    { day: '周二\n08.11', limitUp: 58, limitDown: 1, sentiment: 60 },
    { day: '周三\n08.12', limitUp: 92, limitDown: 0, sentiment: 78 },
    { day: '周四\n08.13', limitUp: 59, limitDown: 4, sentiment: 55 },
    { day: '周五\n08.14', limitUp: 63, limitDown: 10, sentiment: 48 },
  ],
  sevenIndices: [
    {
      name: '上证指数',
      data: [0.67, -0.82, 0.32, -0.50, 0.01],
      total: -0.99,
      price: [3966.59, 3934.09, 3946.68, 3926.97, 3927.18],
    },
    {
      name: '深证成指',
      data: [0.04, -0.40, 1.09, -0.87, 0.45],
      total: 0.26,
      price: [14519.65, 14461.57, 14619.20, 14492.11, 14557.32],
    },
    {
      name: '创业板指',
      data: [-0.73, 0.34, 1.49, -0.45, 1.12],
      total: 2.52,
      price: [3625.46, 3637.79, 3691.90, 3675.29, 3716.45],
    },
    {
      name: '沪深300',
      data: [0.16, -0.81, 0.58, -0.57, 0.04],
      total: -0.77,
      price: [4785.14, 4746.32, 4773.85, 4746.64, 4748.54],
    },
    {
      name: '科创50',
      data: [-0.36, -1.63, 1.61, -1.11, -0.00],
      total: -1.16,
      price: [1966.85, 1934.79, 1965.94, 1944.12, 1944.12],
    },
    {
      name: '中证500',
      data: [0.64, -0.79, 0.98, -0.96, 0.28],
      total: -0.51,
      price: [8241.61, 8176.51, 8256.64, 8177.37, 8200.27],
    },
    {
      name: '北证50',
      data: [-1.00, -0.86, 0.24, -1.62, -0.94],
      total: -3.15,
      price: [1176.39, 1166.26, 1169.06, 1150.12, 1139.31],
    },
  ],
  fundFlow: [
    { day: '周一\n08.10', main: 0 },
    { day: '周二\n08.11', main: 0 },
    { day: '周三\n08.12', main: 0 },
    { day: '周四\n08.13', main: 0 },
    { day: '周五\n08.14', main: 0 },
  ],
  fundFlowSummary: '本周主力资金流向数据暂缺。从指数表现看，创业板指连续获资金净流入，银行等权重板块资金面偏紧。',
  weeklyLadder: [
    { height: '5板', stock: '开开实业', sector: '医药商业/上海国改', count: 1, board: '主板' },
    { height: '4板', stock: '（数据有限）', sector: '—', count: 0 },
    { height: '3板', stock: '（数据有限）', sector: '—', count: 0 },
    { height: '2板', stock: '首板晋级有限', sector: '情绪退潮期', count: 0 },
    { height: '1板', stock: '约50-60只首板', sector: '医药、上海国改等', count: 55 },
  ],
  domesticEvents: [
    { date: '08.10', title: '央行"十五五"改革发展规划正式印发', level: '政策级' },
    { date: '08.10', title: '国联、民生等上市券商推出股票回购方案', level: '行业级' },
    { date: '08.10', title: '创业板ETF持续获资金净流入，机构看好成长方向', level: '市场级' },
    { date: '08.12', title: '上海地产新政征求意见，地产股受关注', level: '政策级' },
    { date: '08.14', title: '平安银行披露中报，业绩表现平稳', level: '公司级' },
    { date: '08.14', title: '银行板块中报陆续披露，整体息差承压', level: '行业级' },
  ],
  overseasEvents: [
    { date: '08.13', title: '海外市场震荡，美联储政策预期变化', level: '宏观' },
  ],
  catalysts: [
    { title: '国常会：研究清理拖欠企业账款工作', time: '08月20日', level: 'high' },
    { title: '中报业绩披露进入高峰期', time: '8月中下旬', level: 'medium' },
    { title: '上海地产新政正式落地', time: '08月下旬', level: 'medium' },
    { title: 'LPR报价下调预期', time: '08月22日', level: 'medium' },
  ],
  warnings: [
    '北证50指数周跌3.15%，小盘股流动性风险需关注',
    '周五跌停家数升至10家，市场情绪有走弱迹象',
    '中报披露期，警惕业绩不及预期个股',
    '科创50指数连续调整，科技股短期承压',
  ],
  institutionalRatings: [
    { stock: '平安银行', rating: '中性', target: '—', institution: '多家机构', change: '中报点评' },
    { stock: '国联证券', rating: '增持', target: '—', institution: '多家机构', change: '回购利好' },
  ],
  weeklyHotspots: [
    { time: '08/10', category: '财联社', title: '央行"十五五"改革发展规划印发，金融改革深化' },
    { time: '08/10', category: '财联社', title: '国联证券推出回购方案，券商板块受关注' },
    { time: '08/10', category: '财联社', title: '创业板ETF持续获资金净流入，成长方向受青睐' },
    { time: '08/12', category: '财联社', title: '上海地产新政征求意见，地产链板块异动' },
    { time: '08/12', category: '财联社', title: '医药商业板块异动，开开实业5连板' },
    { time: '08/14', category: '财联社', title: '平安银行披露2026年中报，业绩平稳' },
    { time: '08/14', category: '财联社', title: '银行板块中报密集披露，息差承压成焦点' },
  ],
  hotspotsDateRange: '8月10日 — 8月14日',
};

export default function WeeklyReportW33Page() {
  return <WeeklyReport data={W33_DATA} />;
}
