import { UpcomingEventsData, UpcomingEvent, EventDay } from '../types';

export const upcomingEventsData: UpcomingEventsData = {
  title: '重大事件日历',
  subtitle: '北京时间 | 2026年7月22日更新 | 来源：由Followin MCP获取',
  coreWindow: '7月23日看 Google 与 Tesla；7月30-31日看 AI 巨头集体答卷',
  days: [
    // 7月14日 周二
    {
      date: '2026-07-14',
      weekday: '周二',
      events: [
        { time: '09:30', company: '中国统计局', focus: '二季度GDP数据发布', tag: '宏观' },
        { time: '10:00', company: '台积电', focus: '6月营收数据', tag: '财报' },
        { time: '20:30', company: '美国劳工部', focus: '6月CPI数据', tag: '宏观' },
      ],
    },
    // 7月15日 周三
    {
      date: '2026-07-15',
      weekday: '周三',
      events: [
        { time: '09:00', company: '中国央行', focus: 'MLF操作利率', tag: '宏观' },
        { time: '20:30', company: '美国零售销售', focus: '6月零售销售数据', tag: '宏观' },
        { time: '22:00', company: 'Netflix', focus: 'Q2财报、订阅用户增长', tag: '财报' },
      ],
    },
    // 7月16日 周四
    {
      date: '2026-07-16',
      weekday: '周四',
      events: [
        { time: '09:30', company: '中国国家统计局', focus: '6月工业增加值、社零', tag: '宏观' },
        { time: '20:30', company: '美国初请失业金', focus: '周度失业数据', tag: '宏观' },
        { time: '22:00', company: 'ASML', focus: 'Q2财报、光刻机订单', tag: '财报' },
      ],
    },
    // 7月17日 周五
    {
      date: '2026-07-17',
      weekday: '周五',
      events: [
        { time: '10:00', company: '中国发改委', focus: '上半年经济发布会', tag: '宏观' },
        { time: '20:30', company: '美国住房开工', focus: '6月住房数据', tag: '宏观' },
      ],
    },
    // 7月20日 周一
    {
      date: '2026-07-20',
      weekday: '周一',
      events: [
        { time: '09:15', company: '中国LPR', focus: '7月贷款市场报价利率', tag: '宏观' },
        { time: '20:30', company: '加拿大央行', focus: '利率决议', tag: '宏观' },
      ],
    },
    // 7月21日 周二
    {
      date: '2026-07-21',
      weekday: '周二',
      events: [
        { time: '09:30', company: '中国财新', focus: '7月制造业PMI初值', tag: '宏观' },
        { time: '20:30', company: '美国成屋销售', focus: '6月成屋销售', tag: '宏观' },
        { time: '22:00', company: 'Visa', focus: 'Q3财报、支付数据', tag: '财报' },
      ],
    },
    // 7月22日 周三
    {
      date: '2026-07-22',
      weekday: '周三',
      events: [
        { time: '09:00', company: '中国央行', focus: '逆回购操作', tag: '宏观' },
        { time: '20:30', company: '美国初请失业金', focus: '周度失业数据', tag: '宏观' },
        { time: '22:00', company: '德州仪器', focus: 'Q2财报、芯片周期', tag: '财报' },
        { time: '22:00', company: 'IBM', focus: 'Q2财报、AI业务', tag: '财报' },
      ],
    },
    // 7月23日 周四
    {
      date: '2026-07-23',
      weekday: '周四',
      events: [
        { time: '04:30', company: 'Alphabet', focus: 'AI搜索、Cloud、资本开支', tag: '财报' },
        { time: '04:30', company: '德州仪器', focus: '模拟芯片周期', tag: '财报' },
        { time: '05:00', company: 'IBM', focus: '软件订单、AI业务', tag: '财报' },
        { time: '05:00', company: 'ServiceNow', focus: '企业AI、cRPO', tag: '财报' },
        { time: '05:30', company: 'Tesla', focus: '毛利率、Robotaxi', tag: '财报' },
      ],
    },
    // 7月24日 周五
    {
      date: '2026-07-24',
      weekday: '周五',
      events: [
        { time: '05:00', company: 'Intel', focus: '18A良率、代工亏损', tag: '财报' },
        { time: '09:30', company: '中国财新', focus: '7月服务业PMI', tag: '宏观' },
      ],
    },
    // 7月27日 周一
    {
      date: '2026-07-27',
      weekday: '周一',
      events: [
        { time: '09:30', company: '长鑫科技', focus: '科创板上市，首日涨465.8%，市值超3.2万亿成A股"一哥"', tag: '新股' },
        { time: '全天', company: '央行', focus: '4000亿元MLF和3985亿元7天期逆回购到期', tag: '宏观' },
        { time: '全天', company: '工信部', focus: '固态锂电池行业标准征求意见稿讨论会（27-28日）', tag: '政策' },
        { time: '全天', company: '芝商所', focus: '推出单一股票期货（Alphabet、亚马逊、苹果、Meta、英伟达、SpaceX）', tag: '市场' },
        { time: '18:32', company: '商务部', focus: '回应美拟对中国AI企业调查制裁：反对科技经贸问题政治化', tag: '政策' },
        { time: '18:12', company: '商务部', focus: '回应美"强迫劳动"301调查最终措施：对华加征12.5%关税，坚决反对', tag: '政策' },
        { time: '18:20', company: '蚂蚁集团', focus: '正式发布LLaDA2.2扩散语言模型，具备"边行动边纠错"能力', tag: '科技' },
        { time: '19:22', company: '工信部', focus: '加快编制出台智能网联新能源汽车产业发展"十五五"规划', tag: '政策' },
      ],
    },
    // 7月28日 周二
    {
      date: '2026-07-28',
      weekday: '周二',
      events: [
        { time: '全天', company: 'CIGDC', focus: '中国国际游戏开发者大会在上海召开（28-30日）', tag: '会议' },
        { time: '全天', company: '国新办', focus: '"十五五"时期税收改革发展有关情况新闻发布会', tag: '政策' },
        { time: '全天', company: '央行', focus: '2530亿元7天期逆回购到期', tag: '宏观' },
        { time: '22:00', company: 'AMD', focus: 'Q2财报、AI芯片', tag: '财报' },
      ],
    },
    // 7月29日 周三
    {
      date: '2026-07-29',
      weekday: '周三',
      events: [
        { time: '全天', company: '氟产业大会', focus: '第三届氟产业绿色发展创新大会（29-30日）', tag: '会议' },
        { time: '08:00', company: 'SK海力士', focus: 'Q2财报、HBM供需、存储价格', tag: '财报' },
        { time: '10:00', company: '国新办', focus: '"十五五"时期知识产权保护和运用有关情况发布会', tag: '政策' },
      ],
    },
    // 7月30日 周四
    {
      date: '2026-07-30',
      weekday: '周四',
      events: [
        { time: '04:30', company: 'Meta', focus: '广告增长、AI资本开支', tag: '财报' },
        { time: '04:45', company: 'Qualcomm', focus: '手机芯片、数据中心', tag: '财报' },
        { time: '05:30', company: 'Microsoft', focus: 'Azure、Copilot、AI回报', tag: '财报' },
        { time: '09:00', company: '三星电子', focus: 'Q2财报、HBM、晶圆代工', tag: '财报' },
        { time: '全天', company: '美联储', focus: 'FOMC公布利率决议', tag: '宏观' },
        { time: '全天', company: '央行', focus: '2040亿元7天期逆回购到期', tag: '宏观' },
      ],
    },
    // 7月31日 周五
    {
      date: '2026-07-31',
      weekday: '周五',
      events: [
        { time: '05:00', company: 'Apple', focus: 'iPhone、服务、AI战略', tag: '财报' },
        { time: '05:00', company: 'Amazon', focus: 'AWS、零售利润率', tag: '财报' },
        { time: '全天', company: 'ChinaJoy', focus: '中国国际数码互动娱乐展览会（7月31日-8月3日）', tag: '会议' },
        { time: '全天', company: '铠侠', focus: '公布2027财年第一季度业绩', tag: '财报' },
        { time: '全天', company: '央行', focus: '890亿元7天期逆回购到期', tag: '宏观' },
      ],
    },
    // 8月1日 周六
    {
      date: '2026-08-01',
      weekday: '周六',
      events: [
        { time: '全天', company: '发改委', focus: '核定第四监管周期省级电网输配电价、区域电网输电价格', tag: '政策' },
        { time: '全天', company: '特朗普', focus: '所有进口到美国的仿制药未来两年内继续适用零关税', tag: '政策' },
        { time: '全天', company: '湖南裕能', focus: '全系列磷酸铁锂产品价格上调2000元/吨', tag: '行业' },
        { time: '全天', company: '国标实施', focus: '《新能源汽车维修作业安全要求》国家标准正式实施', tag: '政策' },
      ],
    },
    // 8月3日 周一
    {
      date: '2026-08-03',
      weekday: '周一',
      events: [
        { time: '全天', company: '港交所', focus: '港股下调最低涨跌价第二阶段生效', tag: '市场' },
        { time: '全天', company: '港交所', focus: '推出5年期中国国债期货', tag: '市场' },
      ],
    },
    // 8月4日 周二
    {
      date: '2026-08-04',
      weekday: '周二',
      events: [
        { time: '盘后', company: 'SpaceX', focus: '上市后首份季报', tag: '财报' },
      ],
    },
    // 8月12日 周二
    {
      date: '2026-08-12',
      weekday: '周二',
      events: [
        { time: '全天', company: '谷歌', focus: '发布会，将发布Pixel 11系列手机', tag: '科技' },
        { time: '全天', company: '国航', focus: '北京首都—乌兰巴托航线启用C919执飞，首条常态化国际客运航线', tag: '行业' },
        { time: '全天', company: 'EIA', focus: '公布月度短期能源展望报告', tag: '宏观' },
      ],
    },
    // 8月4日 周二
    {
      date: '2026-08-04',
      weekday: '周二',
      events: [
        { time: '全天', company: '中国上半年经济数据', focus: '海洋经济、生态环境等多领域核心数据发布', tag: '宏观' },
        { time: '盘前', company: '沙特阿美', focus: 'Q2财报，利润大增33%至334亿美元', tag: '财报' },
        { time: '盘后', company: 'Palantir', focus: 'Q2财报，美国商业收入劲增149%', tag: '财报' },
        { time: '公告', company: '中国央行', focus: '8月5日开展5000亿元买断式逆回购操作', tag: '宏观' },
        { time: '19:00', company: '欧洲央行', focus: '公布利率决议及经济预测', tag: '宏观' },
        { time: '20:30', company: '美国', focus: '7月ISM非制造业PMI', tag: '宏观' },
      ],
    },
    // 8月19日 周二
    {
      date: '2026-08-19',
      weekday: '周二',
      events: [
        { time: '全天', company: '世界机器人大会', focus: '2026世界机器人大会在北京举行（19-23日）', tag: '会议' },
      ],
    },
    // 8月10日 周一
    {
      date: '2026-08-10',
      weekday: '周一',
      events: [
        { time: '09:30', company: '宇树科技', focus: '科创板IPO申购（人形机器人第一股）', tag: '新股' },
        { time: '09:30', company: '绿控传动', focus: '新股申购', tag: '新股' },
        { time: '09:30', company: '双英集团', focus: '新股申购', tag: '新股' },
        { time: '全天', company: 'MSCI', focus: '长鑫科技纳入MSCI中国全股票指数生效', tag: '市场' },
      ],
    },
    // 8月11日 周二
    {
      date: '2026-08-11',
      weekday: '周二',
      events: [
        { time: '09:30', company: '宇树科技', focus: '中签结果公布', tag: '新股' },
        { time: '14:00', company: '澳大利亚央行', focus: '利率决议', tag: '宏观' },
        { time: '全天', company: '博鳌房地产论坛', focus: '2026博鳌房地产论坛（11-14日）', tag: '会议' },
      ],
    },
    // 8月12日 周三
    {
      date: '2026-08-12',
      weekday: '周三',
      events: [
        { time: '08:00', company: '国航', focus: 'C919首条国际航线开通（上海-香港）', tag: '行业' },
        { time: '20:30', company: '美国劳工部', focus: '7月CPI数据发布', tag: '宏观' },
        { time: '全天', company: 'OPEC', focus: '月度原油市场报告', tag: '宏观' },
        { time: '16:00', company: '腾讯控股', focus: 'Q2业绩发布', tag: '财报' },
        { time: '全天', company: '上海具身智能大会', focus: '上海具身智能机器人产业大会（12-14日）', tag: '会议' },
      ],
    },
    // 8月13日 周四
    {
      date: '2026-08-13',
      weekday: '周四',
      events: [
        { time: '16:00', company: '京东集团', focus: 'Q2业绩发布', tag: '财报' },
        { time: '01:00', company: '谷歌', focus: '新品发布会（Pixel 11系列）', tag: '科技' },
        { time: '20:30', company: '美国劳工部', focus: '7月PPI数据发布', tag: '宏观' },
      ],
    },
    // 8月14日 周五
    {
      date: '2026-08-14',
      weekday: '周五',
      events: [
        { time: '09:30', company: '高凯技术', focus: '新股申购', tag: '新股' },
        { time: '24:00', company: '发改委', focus: '国内成品油调价窗口', tag: '宏观' },
      ],
    },
    // 8月15日 周六
    {
      date: '2026-08-15',
      weekday: '周六',
      events: [
        { time: '10:00', company: '中国统计局', focus: '7月社零、工业增加值、固定资产投资数据', tag: '宏观' },
        { time: '全天', company: '绿色低碳创新大会', focus: '绿色低碳创新大会（15-16日）', tag: '会议' },
      ],
    },
    // 8月20日 周四
    {
      date: '2026-08-20',
      weekday: '周四',
      events: [
        { time: '09:30', company: '格林生物', focus: '新股申购', tag: '新股' },
        { time: '09:15', company: '中国央行', focus: 'LPR报价日', tag: '宏观' },
      ],
    },
    // 8月22日 周六
    {
      date: '2026-08-22',
      weekday: '周六',
      events: [
        { time: '全天', company: '世界人形机器人运动会', focus: '第二届世界人形机器人运动会（22-26日）', tag: '科技' },
      ],
    },
    // 8月26日 周三
    {
      date: '2026-08-26',
      weekday: '周三',
      events: [
        { time: '16:00', company: '英伟达', focus: '披露2026年中报', tag: '财报' },
      ],
    },
    // 8月27日 周四
    {
      date: '2026-08-27',
      weekday: '周四',
      events: [
        { time: '22:00', company: '美联储', focus: '杰克逊霍尔全球央行年会（美联储主席讲话）', tag: '宏观' },
      ],
    },
    // 8月31日 周一
    {
      date: '2026-08-31',
      weekday: '周一',
      events: [
        { time: '全天', company: 'A股', focus: '2026年中报披露收官', tag: '财报' },
      ],
    },
  ],
};

// 获取指定日期的事件
export function getEventsByDate(dateStr: string): UpcomingEvent[] {
  const day = upcomingEventsData.days.find(d => d.date === dateStr);
  return day?.events || [];
}

// 获取所有有事件的日期
export function getAllEventDates(): string[] {
  return upcomingEventsData.days.map(d => d.date).sort();
}

// 获取指定日期及未来N天的事件
export function getEventsFromDate(dateStr: string, daysAhead: number = 7): EventDay[] {
  const startDate = new Date(dateStr);
  return upcomingEventsData.days
    .filter(d => {
      const eventDate = new Date(d.date);
      const diffTime = eventDate.getTime() - startDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays >= 0 && diffDays <= daysAhead;
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 获取指定月份的事件
export function getEventsByMonth(year: number, month: number): EventDay[] {
  const monthStr = `${year}-${String(month).padStart(2, '0')}`;
  return upcomingEventsData.days
    .filter(d => d.date.startsWith(monthStr))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// 为了向后兼容，保留 upcomingEvents 导出
export const upcomingEvents = upcomingEventsData;
