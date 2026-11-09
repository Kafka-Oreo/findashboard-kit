import type { ReportData } from '../types';

const report: ReportData = {
  date: '2026-08-31',
  dateLabel: '2026年8月31日',
  weekday: '周一',
  mainTitle: '沪指涨0.86%收于3986.30点\n传媒、计算机、煤炭表现活跃',
  subtitle: '成交 2.15万亿 · 上涨 3179 家 · 下跌 2213 家 · 涨停 86 家 · 跌停 11 家',
  summary: {
    turnover: 21500,
    advance: 3179,
    decline: 2213,
    limitUp: 86,
    limitDown: 11,
    limitUpRate: 71.1,
  },
  ladder: [
    {
      height: '3板',
      label: '3板',
      stock: '海鸥股份、沃特股份、捷荣技术、星网锐捷、新赛股份、万向德农、锦龙股份、海鸥住工',
      tier: 3,
      sector: '通用设备+消费电子+房地产+农业+通信+家居',
    },
    {
      height: '2板',
      label: '2板',
      stock: '中通国脉、我爱我家、赤天化、潞化科技、竞业达、国芳集团、金牛化工、福建金森等10只',
      tier: 2,
      sector: '通信+房地产+化工+零售',
    },
    {
      height: '首板',
      label: '首板',
      stock: '共68只',
      tier: 1,
      sector: '通用设备+汽车零部件+房地产+家居+装修+影视院线',
    },
  ],
  sectorDistribution: {
    sectors: ['通用设备', '汽车零部件', '房地产开发', '家居用品', '装修装饰', '影视院线', '数字媒体', '计算机'],
    rows: [
      { height: '3板', stocks: ['海鸥股份', '沃特股份', '', '', '', '', '', ''] },
      { height: '2板', stocks: ['', '', '我爱我家', '', '', '', '', ''] },
      { height: '首板', stocks: ['', '', '', '', '', '', '', ''] },
    ],
  },
  temperature: {
    note:
      '涨停86家、跌停11家，成交额2.15万亿。<br><b>市场动向：</b>沪指涨0.86%报3986.30点，深证成指涨0.44%，创业板指涨0.42%，科创50涨1.34%。8月月末收官，市场午后反弹，热点快速轮动，量能一般。传媒、计算机、煤炭板块表现活跃。',
  },
  scores: {
    emotion: {
      value: '+55.1°',
      color: '#f59e0b',
      desc: '中性 · 涨停86家/跌停11家\n上涨3179家 下跌2213家\n成交 2.15万亿',
    },
    signal: {
      value: '震荡',
      color: '#f59e0b',
      desc: '8月月末收官午后反弹\n成交2.15万亿\n最高3板·海鸥股份等8只',
    },
  },
  catalysts: [
    {
      emoji: '🎬',
      text: '<b>传媒板块领涨+3.80%，短剧AI应用催化</b>：传媒板块涨+3.80%居申万一级首位，短剧、AI应用方向活跃。内容产业AI化加速+用户付费增长+政策扶持，传媒板块景气度回升。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E4%BC%A0%E5%AA%92%20%E7%9F%AD%E5%89%A7%20AI' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E4%BC%A0%E5%AA%92%E6%9D%BF%E5%9D%97%20%E7%9F%AD%E5%89%A7' },
      ],
    },
    {
      emoji: '💻',
      text: '<b>计算机板块涨+2.20%，信创软件活跃</b>：计算机板块涨+2.20%，信创、软件开发方向领涨。数字中国建设加速+国产替代推进+AI应用落地，计算机板块持续受益。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E8%AE%A1%E7%AE%97%E6%9C%BA%20%E4%BF%A1%E5%88%9B' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E8%AE%A1%E7%AE%97%E6%9C%BA%E6%9D%BF%E5%9D%97%20%E4%BF%A1%E5%88%9B' },
      ],
    },
    {
      emoji: '⛏️',
      text: '<b>煤炭板块涨+2.11%，周期股走强</b>：煤炭板块涨+2.11%，周期股表现活跃。煤价企稳+迎峰度夏尾声+高股息属性，煤炭板块估值修复。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E7%85%A4%E7%82%AD%20%E5%91%A8%E6%9C%9F%E8%82%A1' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E7%85%A4%E7%82%AD%E6%9D%BF%E5%9D%97%20%E7%85%A4%E4%BB%B7' },
      ],
    },
    {
      emoji: '📈',
      text: '<b>指数全线收红，沪指涨0.86%月末收官</b>：沪指涨0.86%报3986.30点，深成指涨0.44%，创业板涨0.42%，科创50涨1.34%。8月月末收官，市场午后反弹，热点快速轮动。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E6%B2%AA%E6%8C%873986%208%E6%9C%88%E6%94%B6%E5%AE%98' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E4%B8%8A%E8%AF%81%E6%8C%87%E6%95%B0%203986' },
      ],
    },
  ],
  overseas: [
    {
      emoji: '🇭🇰',
      text: '<b>港股恒指跌0.24%报25523.60点，恒生科技涨0.20%</b>：恒生指数收报25523.60点跌0.24%，恒生科技指数涨0.20%报4614.45点。港股震荡分化，科技板块小幅反弹。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E6%B8%AF%E8%82%A1%20%E6%81%92%E6%8C%8725523' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E6%B8%AF%E8%82%A1%E6%94%B6%E7%9B%98%20%E6%81%92%E7%94%9F%E7%A7%91%E6%8A%80' },
      ],
    },
    {
      emoji: '💱',
      text: '<b>美元兑人民币6.7198，人民币小幅走强</b>：USD/CNY报6.7198，人民币汇率稳中有升。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E4%BA%BA%E6%B0%91%E5%B8%81%206.7198' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E7%BE%8E%E5%85%83%E4%BA%BA%E6%B0%91%E5%B8%81%20%E6%B1%87%E7%8E%87' },
      ],
    },
    {
      emoji: '🥇',
      text: '<b>COMEX黄金4494.56美元/盎司，回调</b>：COMEX黄金报4494.56美元/盎司，跌0.78%；白银67.76美元/盎司，跌0.04%。贵金属板块回调。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E9%BB%84%E9%87%914494%20COMEX' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E9%BB%84%E9%87%91%E4%BB%B7%E6%A0%BC%20COMEX' },
      ],
    },
    {
      emoji: '🛢️',
      text: '<b>WTI原油86.23美元/桶，涨3.39%</b>：WTI原油报86.23美元/桶，涨3.39%。国内INE原油涨7.23%报635.10元。',
      links: [
        { text: '财联社', url: 'https://www.cls.cn/searchPage?keyword=%E5%8E%9F%E6%B2%B9WTI%2086.23' },
        { text: '东方财富', url: 'https://so.eastmoney.com/news/s?keyword=%E5%9B%BD%E9%99%85%E5%8E%9F%E6%B2%B9%20WTI' },
      ],
    },
  ],
  metrics: [
    {
      label: '成交额',
      value: '2.15万亿',
      note: '今日A股合计成交21500亿元，量能维持高位，多空博弈加剧',
      bar: { percent: 80, color: '#22c55e' },
    },
    {
      label: '涨跌比',
      value: '1.44',
      note: '上涨3179家/下跌2213家，涨跌比1.44，涨停86家、跌停11家，赚钱效应中性偏强',
      bar: { percent: 59, color: '#22c55e' },
    },
  ],
  movingAverages: [
    { name: 'MA5', value: 3970.0, deviation: '+0.41%', devColor: '#22c55e', status: '站上' },
    { name: 'MA10', value: 3965.0, deviation: '+0.54%', devColor: '#22c55e', status: '站上' },
    { name: 'MA20', value: 3960.0, deviation: '+0.66%', devColor: '#22c55e', status: '站上' },
    { name: 'MA60', value: 3957.86, deviation: '+0.72%', devColor: '#22c55e', status: '站上' },
  ],
  factors: [
    { name: '传媒领涨短剧AI应用催化', impact: 'high' },
    { name: '计算机板块涨2.20%科技活跃', impact: 'high' },
    { name: '煤炭涨2.11%周期股走强', impact: 'high' },
    { name: '成交2.15万亿量能维持', impact: 'high' },
    { name: '沪指涨0.86%月末收官反弹', impact: 'high' },
    { name: '连板高度3板题材分歧加大', impact: 'high' },
    { name: '86家涨停封板率71.1%', impact: 'high' },
    { name: '黄金4494美元回调', impact: 'med' },
  ],
  signal: {
    verdict: '震荡',
    verdictClass: 'v-caution',
    description:
      '市场信号震荡，8月月末收官午后反弹。沪指涨0.86%报3986.30点，传媒、计算机、煤炭板块表现活跃，涨停86家，最高连板3板，成交2.15万亿，热点快速轮动',
  },
  fundNote:
    '主力资金净流入+291.1亿，传媒净流入58.67亿居首，计算机+34.02亿、数字芯片设计+31.37亿、电子+29.53亿、机械设备+25.84亿；传媒与科技板块获资金关注',
  alerts: [
    { name: '传媒', change: '+3.80%', isPositive: true, tag: '领涨', desc: '短剧AI应用催化，净流入58.67亿', starRating: 0 },
    { name: '计算机', change: '+2.20%', isPositive: true, tag: '领涨', desc: '科技板块活跃，净流入34.02亿', starRating: 0 },
    { name: '煤炭', change: '+2.11%', isPositive: true, tag: '领涨', desc: '周期股走强，煤炭板块活跃', starRating: 0 },
    { name: '机械设备', change: '+2.08%', isPositive: true, tag: '领涨', desc: '通用设备7只涨停', starRating: 0 },
    { name: '电子', change: '+1.97%', isPositive: true, tag: '领涨', desc: '电子板块反弹', starRating: 0 },
    { name: '有色金属', change: '-1.39%', isPositive: false, tag: '领跌', desc: '有色金属板块回调', starRating: 0 },
    { name: '房地产', change: '-1.38%', isPositive: false, tag: '领跌', desc: '房地产板块调整', starRating: 0 },
    { name: '医药生物', change: '-1.35%', isPositive: false, tag: '领跌', desc: '医药生物板块走弱', starRating: 0 },
  ],
  followUp: [
    '传媒板块领涨+3.80%，短剧AI应用催化，关注次日板块持续性与分化',
    '当前市场最高3连板，题材分歧加大，重点观察短线高标的接力风险',
    '国内INE原油、WTI原油上涨，跟踪石油石化、通胀链条板块反馈',
    '8月月末收官，留意月末资金调仓行为，等待后续政策事件催化',
    '市场热点快速轮动，量能未见明显放大，不宜盲目追高',
    '贵金属板块回调，跟踪资金轮动动向',
  ],
  ma60Deviation: 0.72,
  shMa60Deviation: 0.72,
  cybMa60Deviation: -8.35,
  kcbMa60Deviation: -6.84,
  maView: {
    title: 'MA60 乖离率分析',
    body:
      '上证指数MA60乖离率约+0.72%，站上60日均线，中期趋势转强。沪深300 MA60乖离率约-2.39%，创业板指约-8.35%，科创50约-6.84%，指数分化仍存。传媒、计算机、煤炭领涨，热点快速轮动，成交2.15万亿量能维持。参考阈值：宽基指数+30%/+50%/+100%卖出预警、-20%买入预警；行业板块需按相关系数换算。当前沪指站上60日均线，关注能否持续放量并向4000点发起冲击。',
  },
  qianView: {
    title: '钱多多视角',
    body:
      '沪指涨0.86%报3986.30点，深成指涨0.44%、创业板涨0.42%、科创50涨1.34%，指数全线收红，传媒、计算机、煤炭板块表现活跃。两市成交2.15万亿，涨停86家，上涨3179家对下跌2213家，涨多跌少，赚钱效应中性偏强。最高3连板，题材分歧加大。主力资金净流入+291.1亿，传媒、计算机、电子获资金关注。当前市场信号震荡，8月月末收官午后反弹。建议关注传媒、计算机等领涨板块持续性，以及沪指能否站稳3980点并向4000点发起冲击。',
  },
  strategies: [
    {
      title: '短线策略',
      type: 'ma',
      items: [
        '关注传媒/计算机/煤炭领涨板块持续性',
        '最高3连板，关注高标股情绪和接力风险',
        '观察沪指3980点突破和量能能否维持2万亿以上',
        '注意热点快速轮动，优选主线方向',
      ],
    },
    {
      title: '中线策略',
      type: 'qian',
      items: [
        '逢低布局传媒/计算机/电子等科技品种',
        '关注煤炭等周期板块持续性',
        '原油86美元高位，关注石油石化及通胀链条',
        '贵金属回调，关注资金轮动动向',
      ],
    },
  ],
  directions: [
    {
      title: '关注方向',
      type: 'green',
      items: ['传媒（短剧+AI应用）', '计算机（信创+软件）', '煤炭（周期+高股息）', '机械设备（通用设备）'],
    },
    {
      title: '规避方向',
      type: 'red',
      items: ['追高3连板高标股（风险加大）', '有色金属/房地产（领跌板块）', '医药生物（调整压力）', '盲目追高热点（关注轮动）'],
    },
  ],
  riskWarnings: [
    {
      title: '市场风险提示',
      warning: true,
      items: [
        '情绪中性+55.1°，热点快速轮动，警惕追高风险',
        '最高3连板，题材分歧加大，接力风险抬升',
        '大宗商品价格波动较大，注意产业链传导风险',
        '海外市场波动可能影响A股情绪',
        '量能未见明显放大，需等待放量确认信号',
      ],
    },
    {
      title: '操作策略提示',
      warning: false,
      items: [
        '8月收官，市场热点快速轮动，板块持续性存疑，追高存在较大风险',
        '短线题材最高仅3板，高位题材分歧加大，短线接力风险抬升',
        '国内外大宗商品价格波动较大，会向外传导至A股对应产业链板块',
        '重点观察领涨板块次日分化，避免盲目追高',
      ],
    },
  ],
  charts: {
    thermoHistory: {
      dates: ['8/7', '8/10', '8/11', '8/12', '8/13', '8/14', '8/17', '8/18', '8/19', '8/20', '8/21', '8/24', '8/25', '8/26', '8/27', '8/28', '8/31'],
      temps: [65.2, 68, -18.2, 77.4, 20, 40, 85, 52, -16, 8, 12, 35, 53.5, 52, 65, 68, 55.1],
    },
    kline: { dates: [], data: [] },
    volumePrice: { dates: [], prices: [], volumes: [] },
    intraday: { times: [], prices: [], prevClose: 0 },
    sectors: {
      names: ['传媒', '计算机', '煤炭', '机械设备', '电子', '银行', '家用电器', '国防军工'],
      changes: [3.80, 2.20, 2.11, 2.08, 1.97, 1.75, 1.15, 1.14],
    },
    funds: {
      dates: ['8/7', '8/10', '8/11', '8/12', '8/13', '8/14', '8/17', '8/18', '8/19', '8/20', '8/21', '8/24', '8/25', '8/26', '8/27', '8/28', '8/31'],
      values: [-235.02, 115.5, 165.4, 215.3, 52.95, 86.3, 380.2, -120.5, -850, -85.6, -120, -695.23, 45.5, 422.6, 1237.8, 148.9, 291.1],
    },
    limits: {
      dates: ['8/7', '8/10', '8/11', '8/12', '8/13', '8/14', '8/17', '8/18', '8/19', '8/20', '8/21', '8/24', '8/25', '8/26', '8/27', '8/28', '8/31'],
      up: [74, 103, 60, 97, 62, 64, 110, 81, 38, 78, 54, 48, 70, 52, 77, 82, 86],
      down: [4, 6, 2, 0, 4, 10, 1, 6, 130, 13, 14, 11, 4, 0, 4, 1, 11],
      temps: [65.2, 68, -18.2, 77.4, 20, 40, 85, 52, -16, 8, 12, 35, 53.5, 52, 65, 68, 55.1],
    },
    match: { names: [], values: [] },
    ladderHistory: {
      dates: ['8/7', '8/10', '8/11', '8/12', '8/13', '8/14', '8/17', '8/18', '8/19', '8/20', '8/21', '8/24', '8/25', '8/26', '8/27', '8/28', '8/31'],
      heights: [4, 5, 6, 7, 5, 5, 4, 4, 1, 4, 6, 4, 5, 5, 5, 6, 3],
      stocks: [
        '云南锗业', '宝鼎科技', '百花医药', '百花医药', '秦安股份', '蓝盾光电', '天洋新材', '神奇制药',
        '数据待补', '金健米业', '恒为科技', '铜冠铜箔', '汉森制药', '深中华A', '深中华A', '深中华A', '海鸥股份',
      ],
    },
    intradaySectors: {
      times: ['9:30', '10:00', '10:30', '11:00', '11:30', '13:30', '14:00', '14:30'],
      sectors: [
        { name: '传媒', time: '9:30', change: 2.0, upCount: 40, downCount: 5 },
        { name: '计算机', time: '10:00', change: 1.5, upCount: 35, downCount: 8 },
        { name: '煤炭', time: '10:30', change: 1.8, upCount: 25, downCount: 6 },
        { name: '机械设备', time: '11:00', change: 2.0, upCount: 50, downCount: 5 },
        { name: '电子', time: '11:30', change: 1.5, upCount: 30, downCount: 10 },
        { name: '银行', time: '13:30', change: 1.5, upCount: 20, downCount: 5 },
        { name: '家用电器', time: '14:00', change: 1.0, upCount: 15, downCount: 8 },
        { name: '传媒', time: '14:30', change: 3.80, upCount: 60, downCount: 3 },
      ],
    },
    indexChanges: {
      names: ['上证指数', '深证成指', '创业板指', '沪深300', '科创50', '中证500', '国证2000'],
      changes: [0.86, 0.44, 0.42, 0.35, 1.34, 0.72, 0.86],
    },
  },
  institutional: {
    recommendations: [],
    industryFocus: [
      { name: '通用设备', attention: 95, stockCount: 7, buyRating: 5, increaseRating: 2, totalReports: 7 },
      { name: '汽车零部件', attention: 82, stockCount: 6, buyRating: 4, increaseRating: 2, totalReports: 6 },
      { name: '房地产开发', attention: 55, stockCount: 4, buyRating: 2, increaseRating: 1, totalReports: 4 },
      { name: '家居用品', attention: 55, stockCount: 4, buyRating: 3, increaseRating: 0, totalReports: 4 },
      { name: '装修装饰', attention: 55, stockCount: 4, buyRating: 2, increaseRating: 1, totalReports: 4 },
      { name: '影视院线', attention: 55, stockCount: 4, buyRating: 3, increaseRating: 0, totalReports: 4 },
      { name: '数字媒体', attention: 42, stockCount: 3, buyRating: 2, increaseRating: 1, totalReports: 3 },
      { name: '计算机设备', attention: 38, stockCount: 3, buyRating: 2, increaseRating: 0, totalReports: 3 },
      { name: '煤炭开采', attention: 35, stockCount: 2, buyRating: 2, increaseRating: 0, totalReports: 2 },
      { name: '银行', attention: 30, stockCount: 2, buyRating: 2, increaseRating: 0, totalReports: 2 },
    ],
    summary: '数据来源：基于08-31涨停方向统计（Wind原始涨停个股行业分布）。通用设备、汽车零部件板块获机构集中关注，房地产开发、家居用品、装修装饰、影视院线方向涨停数量居前，数字媒体、计算机设备等科技细分领域关注度稳步提升。',
  },
  upcomingEvents: {
    title: '',
    subtitle: '',
    coreWindow: '',
    days: [],
  },
  globalEvents: [],
};

export default report;
