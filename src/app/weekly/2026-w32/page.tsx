"use client";

import { WeeklyReport } from "@/components/report/weekly-report";
import type { WeeklyReportData } from "@/components/report/weekly-report";

// W32 真实数据（2026年8月3日-8月7日）
// 数据来源：akshare七指数完整数据、market-data文件（08/03-08/05）、08/03涨停数据、每日财经事件
const W32_DATA: WeeklyReportData = {
  weekNum: 32,
  weekLabel: '8月3日 — 8月7日',
  weeklySummary: {
    weekRange: '2026.08.03 - 2026.08.07',
    totalEvents: 25,
    avgTurnover: 21497,
    maxLadder: 6,
    maxLadderStock: '传智教育',
    sentiment: {
      score: 78,
      label: '情绪偏强',
      trend: '本周市场情绪整体偏强，周二涨停家数达141只为周内峰值，全周创业板指累涨9.22%、科创50涨20.66%，科技成长板块领涨。',
    },
  },
  weekDays: ['周一\n08.03', '周二\n08.04', '周三\n08.05', '周四\n08.06', '周五\n08.07'],
  dailyMarketData: [
    { day: '周一\n08.03', limitUp: 83, limitDown: 9, sentiment: 65 },
    { day: '周二\n08.04', limitUp: 141, limitDown: 1, sentiment: 90 },
    { day: '周三\n08.05', limitUp: 104, limitDown: 1, sentiment: 75 },
    { day: '周四\n08.06', limitUp: 0, limitDown: 0, sentiment: 0 },
    { day: '周五\n08.07', limitUp: 0, limitDown: 0, sentiment: 0 },
  ],
  sevenIndices: [
    {
      name: '上证指数',
      data: [0, 0.33, 1.47, 0.57, 1.02],
      total: 2.81,
      price: [3809.66, 3822.29, 3878.43, 3900.35, 3940.04],
    },
    {
      name: '深证成指',
      data: [0, 3.25, 1.86, -0.24, 1.42],
      total: 6.89,
      price: [13578.93, 14020.28, 14281.05, 14246.77, 14513.84],
    },
    {
      name: '创业板指',
      data: [0, 5.64, 1.32, -0.55, 1.35],
      total: 9.22,
      price: [3343.96, 3532.62, 3579.25, 3559.56, 3652.12],
    },
    {
      name: '沪深300',
      data: [0, 1.27, 1.24, -0.15, 0.93],
      total: 4.13,
      price: [4588.20, 4646.47, 4704.10, 4697.04, 4777.50],
    },
    {
      name: '科创50',
      data: [0, 4.09, 4.78, 0.45, 2.51],
      total: 20.66,
      price: [1635.96, 1702.83, 1784.10, 1792.13, 1973.96],
    },
    {
      name: '中证500',
      data: [0, 2.60, 2.65, 0.26, 1.93],
      total: 9.28,
      price: [7493.98, 7688.82, 7892.57, 7913.09, 8189.30],
    },
    {
      name: '北证50',
      data: [0, 1.62, 2.37, 0.31, 1.01],
      total: 9.69,
      price: [1083.27, 1100.82, 1126.90, 1130.39, 1188.27],
    },
  ],
  fundFlow: [
    { day: '周一\n08.03', main: 77 },
    { day: '周二\n08.04', main: 125 },
    { day: '周三\n08.05', main: 0 },
    { day: '周四\n08.06', main: 0 },
    { day: '周五\n08.07', main: 0 },
  ],
  fundFlowSummary: '本周前两日主力资金累计净流入约202亿元。周二电子、机械、半导体板块获资金大幅流入，银行板块持续净流出。周三至周五资金数据暂缺。',
  weeklyLadder: [
    { height: '6板', stock: '传智教育', sector: 'AI应用/数字教育', count: 1, board: '主板' },
    { height: '5板', stock: '一鸣食品', sector: '食品饮料', count: 1, board: '主板' },
    { height: '4板', stock: '高争民爆', sector: '基础化工/民爆', count: 1, board: '主板' },
    { height: '2板', stock: '新能股份、天娱数科、恒银科技、中大力德', sector: '核电/AI/机器人', count: 4 },
    { height: '1板', stock: '约75只个股首板', sector: '核电、AI、PEEK材料等', count: 75 },
  ],
  domesticEvents: [
    { date: '08.03', title: '核电/电力板块爆发，久盛电气、瑞迪智驱20cm涨停', level: '行业级' },
    { date: '08.03', title: 'AI应用/数字教育活跃，传智教育6连板', level: '行业级' },
    { date: '08.04', title: '创业板指大涨5.64%，创年内最大单日涨幅', level: '市场级' },
    { date: '08.04', title: '科创50指数涨超4%，半导体板块领涨', level: '市场级' },
    { date: '08.04', title: '银行板块资金持续流出，农业银行、平安银行居前', level: '行业级' },
    { date: '08.05', title: '科创50指数续涨4.78%，光模块板块回应美国禁令传闻', level: '市场级' },
    { date: '08.05', title: '贵金属、有色金属板块领涨', level: '行业级' },
    { date: '08.07', title: '磷化铟概念大涨，云南锗业4天4板', level: '行业级' },
    { date: '08.07', title: 'PCB概念活跃，宝鼎科技6天5板', level: '行业级' },
    { date: '08.07', title: '跨境支付(CIPS)概念下跌，主力资金净流出', level: '行业级' },
  ],
  overseasEvents: [
    { date: '08.05', title: '美国光模块禁令传闻引发市场波动', level: '科技' },
  ],
  catalysts: [
    { title: '央行"十五五"改革发展规划印发', time: '08月10日', level: 'high' },
    { title: '16家公募集体上报两大创业板ETF', time: '08月中旬', level: 'medium' },
    { title: '平安银行等银行股中报披露', time: '08月14日', level: 'medium' },
    { title: '中报业绩披露进入高峰期', time: '8月中下旬', level: 'medium' },
  ],
  warnings: [
    '半导体板块周一单日大跌8%+，注意科技成长股波动风险',
    '银行板块连续多日资金净流出，权重股承压',
    '高位连板股数量有限，情绪持续性待观察',
    '中报披露期，警惕业绩不及预期个股',
    '本周仅前两日有完整资金数据，周四、周五涨停数据文件暂缺',
  ],
  institutionalRatings: [
    { stock: '春风动力', rating: '买入', target: '—', institution: '多家机构', change: '—' },
    { stock: '国电电力', rating: '增持', target: '—', institution: '多家机构', change: '—' },
    { stock: '德赛西威', rating: '买入', target: '—', institution: '多家机构', change: '—' },
  ],
  weeklyHotspots: [
    { time: '08/03', category: '财联社', title: '核电板块迎来爆发，多只个股涨停，行业景气度持续回升' },
    { time: '08/04', category: '财联社', title: '次新股指数大涨6.69%，市场风险偏好快速提升' },
    { time: '08/04', category: '财联社', title: '创业板ETF天弘单日净申购18.28亿元，资金持续涌入' },
    { time: '08/05', category: '财联社', title: '贵金属行业领涨两市，黄金价格突破新高' },
    { time: '08/05', category: '财联社', title: '全国国有企业改革深化提升行动推进会在深圳召开' },
    { time: '08/07', category: '财联社', title: '磷化铟概念大涨，第三代半导体材料持续受到关注' },
    { time: '08/07', category: '财联社', title: 'PCB概念活跃，宝鼎科技6天5板引领板块行情' },
    { time: '08/07', category: '财联社', title: '一汽老厂房展见证中国汽车产业跃迁，汽车板块受关注' },
    { time: '08/07', category: '财联社', title: '跨境支付(CIPS)概念走低，资金短期获利了结' },
    { time: '08/07', category: '财联社', title: '上海数据交易所全国首个数据要素运营指数发布' },
  ],
  hotspotsDateRange: '8月3日 — 8月7日',
};

export default function WeeklyReportW32Page() {
  return <WeeklyReport data={W32_DATA} />;
}
