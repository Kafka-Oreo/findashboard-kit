"use client";

import { WeeklyReport } from "@/components/report/weekly-report";
import type { WeeklyReportData } from "@/components/report/weekly-report";

// W34 真实数据（2026年8月17日-8月21日）
// 数据来源：akshare七指数数据、涨跌停数据（akshare）、每日财经事件
const W34_DATA: WeeklyReportData = {
  weekNum: 34,
  weekLabel: '8月17日 — 8月21日',
  weeklySummary: {
    weekRange: '2026.08.17 - 2026.08.21',
    totalEvents: 32,
    avgTurnover: 0,
    maxLadder: 4,
    maxLadderStock: '（连板高度下降）',
    sentiment: {
      score: 32,
      label: '情绪偏弱',
      trend: '周初创业板指突破3700点后冲高回落，周三(08/19)市场出现大幅调整（创业板指跌6.26%、跌停118家）；周四上海地产新政刺激房地产、医药板块反弹，情绪小幅修复。全周科创50跌7.56%、创业板指跌5.20%。',
    },
  },
  weekDays: ['周一\n08.17', '周二\n08.18', '周三\n08.19', '周四\n08.20', '周五\n08.21'],
  dailyMarketData: [
    { day: '周一\n08.17', limitUp: 106, limitDown: 1, sentiment: 75 },
    { day: '周二\n08.18', limitUp: 79, limitDown: 5, sentiment: 58 },
    { day: '周三\n08.19', limitUp: 36, limitDown: 118, sentiment: 18 },
    { day: '周四\n08.20', limitUp: 79, limitDown: 12, sentiment: 52 },
    { day: '周五\n08.21', limitUp: 54, limitDown: 13, sentiment: 42 },
  ],
  sevenIndices: [
    {
      name: '上证指数',
      data: [1.41, 0.19, -2.40, 0.24, 0.04],
      total: -1.94,
      price: [3982.65, 3990.30, 3894.42, 3903.72, 3905.20],
    },
    {
      name: '深证成指',
      data: [2.44, -0.56, -5.01, 0.59, 0.87],
      total: -4.15,
      price: [14897.20, 14813.79, 14071.66, 14154.68, 14277.84],
    },
    {
      name: '创业板指',
      data: [3.14, -0.93, -6.26, 0.64, 1.43],
      total: -5.20,
      price: [3833.53, 3797.88, 3560.19, 3582.97, 3634.21],
    },
    {
      name: '沪深300',
      data: [1.61, -0.32, -2.90, 0.09, 0.57],
      total: -2.58,
      price: [4824.85, 4809.41, 4670.05, 4674.25, 4700.90],
    },
    {
      name: '科创50',
      data: [4.14, 0.11, -6.89, -0.87, 0.04],
      total: -7.56,
      price: [2024.57, 2026.80, 1887.24, 1870.82, 1871.57],
    },
    {
      name: '中证500',
      data: [2.43, -0.09, -4.81, 0.86, 0.05],
      total: -4.04,
      price: [8399.32, 8391.76, 7988.37, 8057.07, 8061.10],
    },
    {
      name: '北证50',
      data: [1.91, 2.67, -4.90, -0.06, -0.57],
      total: -2.97,
      price: [1161.07, 1192.08, 1133.67, 1132.99, 1126.52],
    },
  ],
  fundFlow: [
    { day: '周一\n08.17', main: 0 },
    { day: '周二\n08.18', main: 0 },
    { day: '周三\n08.19', main: 0 },
    { day: '周四\n08.20', main: 0 },
    { day: '周五\n08.21', main: 0 },
  ],
  fundFlowSummary: '本周主力资金流向数据暂缺。周三市场大幅调整，资金避险情绪升温；周四地产新政刺激下，房地产、医药板块获资金回流。',
  weeklyLadder: [
    { height: '4板', stock: '（连板高度下降）', sector: '情绪退潮', count: 0 },
    { height: '3板', stock: '首板晋级困难', sector: '高位退潮', count: 0 },
    { height: '2板', stock: '数量有限', sector: '新题材尝试', count: 5 },
    { height: '1板', stock: '约50-100只首板', sector: '地产、医药、电力', count: 70 },
  ],
  domesticEvents: [
    { date: '08.17', title: '创业板指涨3.14%突破3700点，市场情绪高涨', level: '市场级' },
    { date: '08.17', title: '紫金矿业披露中报，净利润同比增长68%', level: '公司级' },
    { date: '08.18', title: '北证50指数涨2.67%，小盘股表现活跃', level: '市场级' },
    { date: '08.19', title: '创业板指暴跌6.26%，市场遭遇大幅调整', level: '市场级' },
    { date: '08.19', title: '科创50指数跌6.89%，科技成长股集体回调', level: '市场级' },
    { date: '08.19', title: '两市超3000只个股下跌，跌停家数达118家', level: '市场级' },
    { date: '08.20', title: '上海地产新政落地，房地产板块快速反弹', level: '政策级' },
    { date: '08.20', title: '医药生物板块大涨，疫苗ETF涨停', level: '行业级' },
    { date: '08.21', title: '国常会：研究清理拖欠企业账款工作', level: '政策级' },
    { date: '08.21', title: '广东召开民营企业座谈会，民企发展受关注', level: '政策级' },
    { date: '08.21', title: '国民信托增资获批，信托行业整合加速', level: '行业级' },
    { date: '08.21', title: '电力安全会议召开，电力板块受关注', level: '行业级' },
  ],
  overseasEvents: [
    { date: '08.21', title: '美银观点：全球市场波动加剧，关注A股配置价值', level: '宏观' },
  ],
  catalysts: [
    { title: '国常会清理拖欠企业账款政策落地', time: '08月下旬', level: 'high' },
    { title: '上海地产新政持续发酵', time: '08月下旬', level: 'high' },
    { title: '中报业绩披露进入高峰期', time: '8月中下旬', level: 'medium' },
    { title: '电力安全相关政策推进', time: '08月下旬', level: 'medium' },
  ],
  warnings: [
    '周三创业板指单日暴跌6.26%，跌停家数达118家，市场风险集中释放',
    '科创50指数周跌7.56%，科技成长股短期承压明显',
    '连板高度大幅下降，情绪退潮期追高风险大',
    '中报披露高峰，注意业绩雷风险',
    '市场大幅波动后，短期可能进入震荡筑底阶段',
  ],
  institutionalRatings: [
    { stock: '紫金矿业', rating: '买入', target: '—', institution: '多家机构', change: '中报超预期' },
    { stock: '春风动力', rating: '买入', target: '—', institution: '多家机构', change: '维持' },
    { stock: '美好医疗', rating: '增持', target: '—', institution: '多家机构', change: '新增' },
  ],
  weeklyHotspots: [
    { time: '08/17', category: '财联社', title: '创业板指突破3700点，市场风险偏好提升' },
    { time: '08/17', category: '财联社', title: '紫金矿业中报净利增68%，有色金属板块受关注' },
    { time: '08/18', category: '财联社', title: '北证50指数涨2.67%，小盘股表现活跃' },
    { time: '08/19', category: '财联社', title: '市场大幅调整，创业板指跌超6%' },
    { time: '08/19', category: '财联社', title: '两市超3000股下跌，跌停超百家' },
    { time: '08/20', category: '财联社', title: '上海地产新政征求意见，地产链大涨' },
    { time: '08/20', category: '财联社', title: '医药生物板块反弹，疫苗ETF涨停' },
    { time: '08/21', category: '财联社', title: '国常会：研究清理拖欠企业账款工作' },
    { time: '08/21', category: '财联社', title: '广东召开民营企业座谈会，支持民企发展' },
    { time: '08/21', category: '财联社', title: '国民信托增资获批，信托行业整合提速' },
    { time: '08/21', category: '财联社', title: '全国电力安全委员会会议召开，电力安全受重视' },
    { time: '08/21', category: '财联社', title: '美银：A股估值具备吸引力，建议关注配置机会' },
  ],
  hotspotsDateRange: '8月17日 — 8月21日',
};

export default function WeeklyReportW34Page() {
  return <WeeklyReport data={W34_DATA} />;
}
