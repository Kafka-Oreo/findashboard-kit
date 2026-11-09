/**
 * 统一市场数据结构
 * 所有组件只能接收此结构，禁止自行计算或读取 JSON
 * 所有核心字段为 null 表示暂无数据
 */
export interface MarketData {
  // 日期
  date: string; // 数据日期

  // 市场核心指标
  turnover: number | null; // 成交额（亿元）
  advance: number | null; // 上涨家数
  decline: number | null; // 下跌家数

  // 涨跌停
  limitUp: number | null; // 涨停家数
  limitDown: number | null; // 跌停家数

  // 情绪指标
  limitUpRate: number | null; // 封板率（0-100）
  advanceDeclineRatio: number | null; // 涨跌比

  // 技术指标
  ma60Deviation: number | null; // MA60 乖离率（百分比）- 万得全A（主基准）
  wandeMa60Deviation: number | null; // 万得全A MA60 乖离率（百分比）- 完整命名
  shMa60Deviation: number | null; // 上证指数 MA60 乖离率（百分比）
  cybMa60Deviation: number | null; // 创业板指 MA60 乖离率（百分比）
  kcbMa60Deviation: number | null; // 科创板指 MA60 乖离率（百分比）

  // 资金指标
  mainFundFlow: number | null; // 主力净流入（亿元）
  northFundFlow: number | null; // 北向资金净流入（亿元）

  // 板块
  sectorRanking: Array<{
    name: string;
    change: number;
  }>;

  abnormalSectors: Array<{
    name: string;
    reason: string;
    starRating?: number; // 星级（1-3）
    bias60?: number; // 60日乖离率%
  }>;

  // 涨停个股
  limitUpStocks: Array<{
    name: string;
    code: string;
    industry: string;
    reason: string;
    sealRate: string;
  }>;

  // 金股
  goldenStocks: {
    mostWatched: Array<{ name: string; code: string; broker: string; count: number }>;
    topGainers: Array<{ name: string; code: string; broker: string; change: number }>;
  } | null;

  // 数据状态
  source: string; // 数据来源：用户输入/API/暂无数据
  updateTime: string; // 更新时间
  isRealData: boolean; // 是否为真实数据

  // 后续关注催化
  followUp: Array<{
    title: string;
    desc: string;
  }>;
}

export interface LadderStep {
  height: string;
  label: string;
  stock: string;
  tier: number;
  sector?: string;
}

export interface SectorDistribution {
  sectors: string[];
  rows: {
    height: string;
    stocks: (string | null)[];
    stockCodes?: Record<string, string>; // 股票名称 -> 6位代码 映射
  }[];
}

export interface SectorItem {
  name: string;
  change: number;
}

export interface CatalystItem {
  text: string;
  highlight?: string;
  emoji?: string;
  links?: { text: string; url: string }[];
  textSuffix?: string;
}

export interface IndexData {
  name: string;
  close: number;
  change: number;
  volume: string;
}

export interface AnalystView {
  title: string;
  body: string;
}

export interface SignalData {
  verdict: string;
  verdictClass: 'v-no' | 'v-caution' | 'v-yes';
  description: string;
}

export interface ChartData {
  thermoHistory: { dates: string[]; temps: number[] };
  kline: { dates: string[]; data: number[][] };
  volumePrice: { dates: string[]; prices: number[]; volumes: number[]; upDownDiff?: number[] };
  intraday: { times: string[]; prices: number[]; prevClose: number };
  sectors: { names: string[]; changes: number[] };
  funds: { dates: string[]; values: number[] };
  limits: { dates: string[]; up: number[]; down: number[]; temps: number[] };
  match: { names: string[]; values: number[] };
  sectorFlowTrend?: { dates: string[]; series: { name: string; data: number[] }[] };
  limitVsFund?: { categories: string[]; limit: number[]; fund: number[] };
  indexVolumes?: { dates: string[]; shanghai: number[]; shenzhen: number[] };
  ladderHistory?: { dates: string[]; heights: number[]; stocks?: string[] };
  intradaySectors?: { times: string[]; sectors: { name: string; time: string; change: number; upCount?: number; downCount?: number }[] };
  sectorDistribution?: SectorDistribution;
  indexChanges?: {
    names: string[];
    changes: number[];
    details?: Array<{
      name: string;
      open: number;
      close: number;
      high: number;
      low: number;
      volume: number;
      turnover: number;
      change: number;
      date?: string;
    }>;
  };
  sectorFunds?: {
    inflow: { name: string; amount: number; change: number }[];
    outflow: { name: string; amount: number; change: number }[];
    total: number;
    source: string;
  };
}

export interface StrategyBlock {
  title: string;
  type: 'ma' | 'qian';
  items: string[];
}

export interface DirectionBlock {
  title: string;
  type: 'green' | 'red' | 'yellow';
  items: string[];
}

export interface MetricBlock {
  label: string;
  value: string;
  valueColor?: string;
  note?: string;
  bar?: { percent: number; color: string };
  subMetrics?: { label: string; value: string; color: string }[];
}

export interface ReportData {
  date: string;
  dateLabel: string;
  weekday: string;
  mainTitle: string;
  subtitle: string;
  summary?: {
    turnover: number;
    advance: number;
    decline: number;
    limitUp: number;
    limitDown: number;
    limitUpRate: number;
  };
  ladder: LadderStep[];
  sectorDistribution?: SectorDistribution;
  riskWarnings?: { title: string; items: string[]; warning?: boolean }[];
  /** 情绪温度（可选）。缺省时由 summary + ladder 经四因子公式自动计算，
   *  见 src/lib/temperature.ts；此处仅用于旧数据兼容或人工覆盖文案。 */
  temperature?: {
    score?: number;
    label?: string;
    tipClass?: 'tip-frozen' | 'tip-cold' | 'tip-cool' | 'tip-normal' | 'tip-warm' | 'tip-hot';
    tipIcon?: string;
    /** 完全手写的解读文案（优先级最高，将跳过自动生成） */
    tipHtml?: string;
    /** 人工补充解读，自动计算的结论之后追加展示 */
    note?: string;
  };
  scores: {
    emotion: { value: string; color: string; desc: string };
    signal: { value: string; color: string; desc: string };
  };
  catalysts: CatalystItem[];
  overseas: CatalystItem[];
  institutional?: {
    recommendations: { code: string; name: string; rating: string; institution: string; analyst: string; industry?: string; date: string }[];
    industryFocus: { name: string; attention: number; stockCount: number; buyRating: number; increaseRating: number; totalReports?: number }[];
    summary: string;
  };
  metrics: MetricBlock[];
  movingAverages: { name: string; value: number; deviation: string; devColor: string; status: string }[];
  factors: { name: string; impact: 'high' | 'med' | 'low' }[];
  signal: SignalData;
  fundNote: string;
  alerts: { name: string; change: string; isPositive: boolean; tag: string; desc: string; bias60?: number; starRating?: number }[];
  followUp: string[];
  ma60Deviation?: number;
  wandeMa60Deviation?: number;
  shMa60Deviation?: number;
  cybMa60Deviation?: number;
  kcbMa60Deviation?: number;
  maView: AnalystView;
  qianView: AnalystView;
  strategies: StrategyBlock[];
  directions: DirectionBlock[];
  charts: ChartData;
  upcomingEvents?: UpcomingEventsData;
  globalEvents?: GlobalMarketEvent[];
}

export interface GlobalMarketEvent {
  category: '美股' | '欧洲' | '亚太' | '外汇' | '商品' | '政策' | '科技' | '央行' | '中概' | '地缘' | '产业' | '晨报' | '收盘' | '避雷' | '资讯' | '宏观' | '汇率' | '经贸' | '资金' | '消费' | '金融';
  title: string;
  highlight?: string;
  impact?: 'high' | 'med' | 'low';
  attention?: number | string;
  time?: string;
  url?: string;
  anchor?: string;
  source?: string;
  trend?: 'up' | 'down' | 'neutral'; // 涨跌标识：up=涨(红), down=跌(绿), neutral=中性
  fire_count?: number; // 火爆程度 1-5，对应 🔥 数量
}

export interface UpcomingEvent {
  time: string;
  company: string;
  focus: string;
  tag?: '财报' | '宏观' | '会议' | '新股' | '政策' | '市场' | '科技' | '行业';
  // 扩展字段
  description?: string; // 事件完整描述
  publishTime?: string; // 公布时间
  importance?: number; // 重要等级 1-5
  historicalEvents?: { date: string; marketPerformance: string }[]; // 历史回溯
  history?: { date: string; marketPerformance: number; description: string }[]; // 历史回溯（新格式）
  affectedIndustries?: string[]; // 受影响行业
  relatedStocks?: string[]; // 相关个股（字符串数组）
  relatedStocksDetail?: { symbol: string; name: string }[]; // 相关个股（详细格式）
  researchReports?: { title: string; url: string }[]; // 研报链接
  officialAnnouncements?: { title: string; url: string }[]; // 官方公告
  relatedLinks?: { title: string; url: string }[]; // 关联资料
  url?: string; // 原文链接（来自动态抓取的事件）
  source?: string; // 来源媒体（来自动态抓取的事件）
}

// 投资事件数据结构
export interface RelatedStock {
  symbol: string;
  name: string;
  market: 'A 股' | '港股' | '美股';
}

export interface HistoricalImpact {
  title: string;
  description: string;
}

export interface NewsLink {
  title: string;
  source: string;
  url: string;
}

export interface InvestmentEvent {
  id: string;
  date: string;
  time: string;
  title: string;
  importance: 1 | 2 | 3 | 4 | 5;
  category: '宏观' | '财报' | '会议' | '政策' | '行业' | '数据';
  summary: string;
  investment_focus: string[];
  related_industries: string[];
  related_stocks: RelatedStock[];
  historical_impacts: HistoricalImpact[];
  news_links: NewsLink[];
}

export type EventDataStatus = 'verified' | 'partial' | 'failed' | 'no_attempt'

export interface EventDay {
  date: string;
  weekday: string;
  events: UpcomingEvent[];
  status?: EventDataStatus;
  sources?: Record<string, 'success' | 'failed' | 'skipped'>;
  lastUpdated?: string;
  error?: string;
}

export interface UpcomingEventsData {
  title: string;
  subtitle: string;
  coreWindow: string;
  days: EventDay[];
}

export interface DailyEvent {
  title: string;
  time: string;
  source: string;
  importance: 'high' | 'medium' | 'low';
  description: string;
}
