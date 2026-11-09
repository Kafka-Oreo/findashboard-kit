/**
 * 60日线乖离率 BIAS 星级计算（万得Wind基准体系）
 * 
 * ## 基准指数
 * 万得全A（Wind All A Share Index，代码 881001.WI）
 * 作为全市场估值温度的基准锚定指数
 * 
 * ## 计算公式
 * BIAS = (收盘价 - 60日均线) / 60日均线 × 100%
 * 
 * ## 万得全A原始预警阈值（Wind 一致预期）
 *   +30% → 一级卖出预警（轻度过热）
 *   +50% → 二级卖出预警（中度过热）
 *   +100% → 三级卖出预警（极度泡沫）
 *   -20% → 买入预警（深度超跌）
 * 
 * ## 星级判定标准（万得Wind校准版）
 * 以万得全A基准阈值为锚，上下浮动5%作为容错区间：
 *   偏离幅度 25%~35%  → 1 颗实心 ★（一级预警）
 *   偏离幅度 45%~60%  → 2 颗实心 ★（二级预警）
 *   偏离幅度 90% 以上 → 3 颗实心 ★（三级预警）
 * 
 * ## 行业板块换算
 *   行业实际阈值 = 万得全A基准阈值 × 该行业与万得全A相关系数的中位数
 * 
 * ## 注意事项
 * - 游资爆炒题材股（次新股、妖股等）不适用本套规则
 * - 只看偏离绝对值，正负方向单独用颜色区分
 * - 万得全A的相关系数为 1.00，直接使用原始阈值
 */

// 万得全A基准阈值（单位：%）— Wind 一致预期
const BASE_STAR1 = 25;   // 1星下限（30% - 5%容错）
const BASE_STAR2 = 45;   // 2星下限（50% - 5%容错）
const BASE_STAR3 = 90;   // 3星下限（100% - 10%）

// 万得全A原始预警阈值（不含容错）
export const WANDE_BASE_THRESHOLDS = {
  sell_level1: 30,    // +30% 一级卖出预警
  sell_level2: 50,    // +50% 二级卖出预警
  sell_level3: 100,   // +100% 三级卖出预警
  buy_warning: -20,   // -20% 买入预警
};

// 基准指数信息
export const BENCHMARK_INDEX = {
  name: '万得全A',
  code: '881001.WI',
  akshareSymbol: 'sh881001',
  description: '万得全A指数，覆盖全部A股股票，作为全市场估值温度基准',
};

// 行业板块与万得全A相关系数中位数
// 数据来源：万得行业相关性统计
export const SECTOR_CORRELATION: Record<string, number> = {
  // 宽基指数（相关系数接近1）
  '上证指数': 0.97,
  '深证成指': 0.95,
  '创业板指': 0.90,
  '科创50': 0.85,
  '沪深300': 0.98,
  '中证500': 0.96,
  '中证1000': 0.93,
  '北证50': 0.60,
  '万得全A': 1.00,
  '上证50': 0.92,
  '上证180': 0.95,
  '深证100': 0.88,
  '中小板指': 0.90,
  '中证800': 0.97,

  // 低波动防御（银行/公用事业）— 0.65~0.80 → 中位 0.725
  '银行': 0.73,
  '国有大型银行Ⅱ': 0.70,
  '股份制银行': 0.72,
  '保险': 0.70,
  '电力': 0.72,
  '火电': 0.70,
  '水电': 0.73,
  '公用事业': 0.73,
  '高速公路': 0.75,
  '铁路运输': 0.75,
  '港口': 0.72,

  // 核心消费（食品饮料/白酒）— 0.60~0.75 → 中位 0.675
  '食品饮料': 0.68,
  '白酒': 0.65,
  '啤酒': 0.68,
  '调味品': 0.67,
  '乳业': 0.68,
  '饮料乳品': 0.68,
  '白色家电': 0.72,
  '家电': 0.72,
  '小家电': 0.68,
  '美容护理': 0.65,
  '商贸零售': 0.68,
  '超市': 0.70,
  '百货': 0.68,

  // 中游制造（化工/建材/家电）— 0.68~0.80 → 中位 0.74
  '化工': 0.75,
  '化学原料': 0.75,
  '化学制品': 0.74,
  '农化制品': 0.72,
  '化肥': 0.70,
  '建筑材料': 0.76,
  '水泥': 0.78,
  '玻璃玻纤': 0.74,
  '建筑装饰': 0.76,
  '工程咨询服务Ⅱ': 0.72,
  '工程机械': 0.74,
  '造纸': 0.72,
  '轻工制造': 0.72,
  '包装印刷': 0.70,
  'MLCC': 0.65,

  // 强周期（锂电/有色/煤炭）— 0.65~0.82 → 中位 0.735
  '有色金属': 0.75,
  '贵金属': 0.60,
  '小金属': 0.73,
  '稀土永磁': 0.70,
  '锂矿': 0.70,
  '锂电池': 0.72,
  '电池': 0.72,
  '煤炭': 0.78,
  '石油开采': 0.70,
  '油气开采': 0.70,
  '钢铁': 0.78,
  '非金属材料Ⅱ': 0.70,
  '非金属材料': 0.70,
  '锗镓概念': 0.65,
  '有色(铋)': 0.68,

  // 科技成长（计算机/传媒/AI）— 0.60~0.78 → 中位 0.69
  '计算机设备': 0.68,
  '软件开发': 0.66,
  'IT服务': 0.68,
  '互联网服务': 0.65,
  '游戏': 0.60,
  '传媒': 0.65,
  '影视院线': 0.60,
  '出版': 0.68,
  '广告营销': 0.65,
  '人工智能': 0.62,
  'AI': 0.62,
  'AIGC': 0.62,
  'chatgpt': 0.62,
  '云计算': 0.65,
  '大数据': 0.65,
  '数字经济': 0.66,
  '教育': 0.60,
  '旅游': 0.65,
  '酒店餐饮': 0.62,

  // 半导体/光模块/算力硬件 — 0.58~0.72 → 中位 0.65
  '半导体': 0.65,
  '半导体设备': 0.62,
  '光芯片': 0.60,
  'CPO': 0.60,
  '算力': 0.62,
  '数据中心': 0.65,
  '芯片': 0.65,
  '集成电路': 0.65,
  '通信设备': 0.68,
  '通信服务': 0.65,
  '消费电子': 0.70,
  '光学光电子': 0.68,
  '电子化学品': 0.62,
  '元件': 0.68,
  '元件/PCB': 0.68,
  '量子科技': 0.58,
  '元宇宙': 0.60,
  'VR/AR': 0.60,

  // 券商/科创50 — 0.70~0.85 → 中位 0.775
  '证券': 0.78,
  '券商': 0.78,
  '多元金融': 0.72,

  // 新能源/高端制造
  '光伏设备': 0.72,
  '风电设备': 0.70,
  '储能': 0.70,
  '新能源汽车': 0.72,
  '汽车零部件': 0.74,
  '汽车整车': 0.76,
  '军工': 0.74,
  '航天装备': 0.72,
  '航空装备': 0.72,
  '地面兵装Ⅱ': 0.72,
  '船舶制造': 0.74,
  '机器人': 0.68,
  '工业母机': 0.70,
  '自动化设备': 0.70,
  '高端装备': 0.72,
  '空心杯电机': 0.60,

  // 医药
  'CRO': 0.62,
  '医疗服务': 0.64,
  '生物制品': 0.66,
  '医疗器械': 0.68,
  '化学制药': 0.70,
  '中药Ⅱ': 0.72,
  '中药': 0.72,
  '医药商业': 0.70,
  '医美': 0.60,
  '创新药': 0.62,
  '超级真菌': 0.60,
  '青蒿素': 0.60,

  // 房地产
  '房地产开发': 0.75,
  '房地产服务': 0.72,
  '装修装饰Ⅱ': 0.70,
  '装修装饰': 0.70,

  // 交运/物流
  '机场': 0.68,
  '航空': 0.70,
  '航运': 0.72,
  '物流': 0.74,
  '快递': 0.70,

  // 农业
  '养殖业': 0.65,
  '渔业': 0.62,
  '畜禽养殖': 0.65,
  '种植业': 0.68,
  '农业': 0.68,
  '家禽概念': 0.62,
  '黄酒概念': 0.68,

  // 环保/碳中和
  '环保': 0.72,
  '环境治理': 0.72,
  '园林': 0.70,
  '碳中和': 0.68,
  '碳交易': 0.65,

  // 新能源发电
  '新能源发电': 0.70,
  '光伏': 0.65,

  // 纺织服饰
  '纺织服饰': 0.70,
  '服装家纺': 0.70,
  '贸易': 0.68,

  // 概念板块（默认中等相关）
  '次新股': 0.60,
  '新股与次新股': 0.60,
  '专精特新': 0.68,
  '国企改革': 0.78,
  '一带一路': 0.72,
  '中特估': 0.80,
  '区块链': 0.58,
  '数字货币': 0.60,
};

// 默认相关系数（未匹配到的行业使用 0.65）
const DEFAULT_CORR = 0.65;

// 负向买入预警阈值（全A基准）
const BASE_BUY_WARNING = -20;

export interface BiasStarResult {
  stars: number;       // 0 / 1 / 2 / 3 颗实心星
  corr: number;        // 使用的相关系数
  threshold_star1: number;  // 1星门槛（%）
  threshold_star2: number;  // 2星门槛（%）
  threshold_star3: number;  // 3星门槛（%）
  isBuyWarning: boolean;    // 是否触发买入预警（负向）
  isBroadIndex: boolean;    // 是否为宽基指数
}

// 宽基指数列表
const BROAD_INDEX_NAMES = [
  '上证指数', '深证成指', '创业板指', '科创50', '沪深300',
  '中证500', '中证1000', '北证50', '万得全A',
  '上证50', '上证180', '深证100', '中小板指', '中证800',
];

/**
 * 计算板块/指数 BIAS 星级（万得Wind基准体系）
 * 
 * 核心校准规则：
 * - 宽基指数（上证指数、创业板指、科创50、万得全A等）直接使用万得全A原始阈值，不乘相关系数
 * - 行业板块使用"原始阈值 × 与万得全A相关系数"换算
 * 
 * @param sectorName 板块/指数名称
 * @param biasValue BIAS 数值（%）
 * @returns 星级结果
 */
export function calcBiasStar(
  sectorName: string,
  biasValue: number,
): BiasStarResult {
  const absBias = Math.abs(biasValue);

  // 判断是否为宽基指数
  const isBroadIndex = BROAD_INDEX_NAMES.some(
    name => sectorName.includes(name) || name.includes(sectorName)
  );

  // 宽基指数：直接使用万得全A原始阈值，不乘相关系数
  // 行业板块：使用相关系数换算后的阈值
  const corr = isBroadIndex ? 1.00 : (SECTOR_CORRELATION[sectorName] ?? DEFAULT_CORR);

  // 实际阈值
  const thresh_star1 = BASE_STAR1 * corr;
  const thresh_star2 = BASE_STAR2 * corr;
  const thresh_star3 = BASE_STAR3 * corr;

  // 买入预警（负向）
  const buyWarningThresh = BASE_BUY_WARNING * corr;
  const isBuyWarning = biasValue <= buyWarningThresh;

  // 打星判定（只看绝对值）
  // 25%~35% → 1★；45%~60% → 2★；90%以上 → 3★
  let stars = 0;
  if (absBias >= thresh_star3) {
    stars = 3;
  } else if (absBias >= thresh_star2 && absBias <= 60 * corr + 5) {
    // 45%~60% → 2星，注意上限60%（含5%容错）
    stars = 2;
  } else if (absBias >= thresh_star1 && absBias <= 35 * corr) {
    // 25%~35% → 1星，上限35%（即30%+5%容错）
    stars = 1;
  }

  return {
    stars,
    corr,
    threshold_star1: +thresh_star1.toFixed(2),
    threshold_star2: +thresh_star2.toFixed(2),
    threshold_star3: +thresh_star3.toFixed(2),
    isBuyWarning,
    isBroadIndex,
  };
}

/**
 * 渲染实心金色五角星字符串
 * @param stars 星数（0~3）
 * @returns 星星字符串
 */
export function renderStars(stars: number): string {
  return '★'.repeat(Math.max(0, Math.min(3, stars)));
}

/**
 * 获取指数/板块相对于万得全A的校准阈值
 * 用于前端展示"该板块校准后的预警阈值是多少"
 * @param sectorName 板块/指数名称
 * @returns 校准后的各档阈值（%）
 */
export function getCalibratedThresholds(sectorName: string) {
  const corr = SECTOR_CORRELATION[sectorName] ?? DEFAULT_CORR;
  return {
    corr,
    star1: +(BASE_STAR1 * corr).toFixed(2),
    star2: +(BASE_STAR2 * corr).toFixed(2),
    star3: +(BASE_STAR3 * corr).toFixed(2),
    buyWarning: +(BASE_BUY_WARNING * corr).toFixed(2),
    originalSell1: +(WANDE_BASE_THRESHOLDS.sell_level1 * corr).toFixed(2),
    originalSell2: +(WANDE_BASE_THRESHOLDS.sell_level2 * corr).toFixed(2),
    originalSell3: +(WANDE_BASE_THRESHOLDS.sell_level3 * corr).toFixed(2),
  };
}

/**
 * 判断偏离方向
 * @param biasValue BIAS 数值（%）
 * @returns 'overheat' | 'oversold' | 'neutral'
 */
export function getBiasDirection(biasValue: number): 'overheat' | 'oversold' | 'neutral' {
  if (biasValue > 5) return 'overheat';
  if (biasValue < -5) return 'oversold';
  return 'neutral';
}

/**
 * 获取偏离程度文字描述
 * @param stars 星数
 * @param direction 方向
 * @returns 中文描述
 */
export function getBiasLevelText(stars: number, direction: 'overheat' | 'oversold' | 'neutral'): string {
  if (direction === 'neutral') return '正常区间';
  const prefix = direction === 'overheat' ? '过热' : '超跌';
  const level = stars >= 3 ? '极度' : stars >= 2 ? '中度' : stars >= 1 ? '轻度' : '轻度';
  return `${level}${prefix}`;
}

/**
 * 批量计算一组板块的 BIAS 星级
 * @param sectors 板块列表，每项需包含 name 和 bias60
 * @returns 带星级计算结果的板块列表
 */
export function calcSectorsBiasStar(
  sectors: Array<{ name: string; bias60?: number }>
) {
  return sectors.map(s => ({
    ...s,
    ...calcBiasStar(s.name, s.bias60 ?? 0),
  }));
}

/**
 * 用后端实时计算的相关系数计算行业板块星级
 * 
 * 规则：
 * - 行业实际阈值 = 万得全A原始阈值 × 该行业与万得全A相关系数
 * - 星级判定取 BIAS 绝对值
 * - 25%~35% → 1★；45%~60% → 2★；90%以上 → 3★
 * - 相关系数为负或接近0时，阈值趋近于0，不打星（不适用）
 * 
 * @param biasValue 行业板块 BIAS（%）
 * @param correlation 该行业与万得全A的滚动60日皮尔逊相关系数
 * @returns 星级结果
 */
export function calcSectorStarWithCorr(
  biasValue: number,
  correlation: number | undefined,
): BiasStarResult {
  // 相关系数取绝对值：负相关行业同样需要换算（波动幅度与大盘反向但量级可比）
  // 皮尔逊相关系数范围[-1, 1]，绝对值越大说明联动性越强（正或反向）
  // 取绝对值后用于阈值换算，确保阈值始终为正数
  const rawCorr = correlation && !isNaN(correlation) ? correlation : 0;
  let corr = Math.abs(rawCorr);

  // 相关系数下限：当|corr|过低时（如<0.5），说明行业与大盘联动性极弱
  // 此时用相关系数换算阈值会失去意义（阈值过小导致任何波动都触发星级）
  // 设下限为0.5，对应低相关防御行业的合理换算基准
  // 参考：行业波动率系数经验中位数约0.65，此处取更低值作为下限保护
  const MIN_CORR = 0.50;
  if (corr > 0 && corr < MIN_CORR) {
    corr = MIN_CORR;
  }

  const absBias = Math.abs(biasValue);

  // 实际阈值 = 原始阈值 × 相关系数绝对值
  const thresh_star1 = BASE_STAR1 * corr;
  const thresh_star2 = BASE_STAR2 * corr;
  const thresh_star3 = BASE_STAR3 * corr;

  // 买入预警（负向）
  const buyWarningThresh = BASE_BUY_WARNING * corr;
  const isBuyWarning = biasValue <= buyWarningThresh;

  // 打星判定（只看绝对值）
  // 25%~35% → 1★；45%~60% → 2★；90%以上 → 3★
  let stars = 0;
  if (corr > 0 && absBias >= thresh_star3) {
    stars = 3;
  } else if (corr > 0 && absBias >= thresh_star2) {
    // 2星：45%~60% 区间（含5%容错）
    const upperBound = 60 * corr;
    if (absBias <= upperBound) {
      stars = 2;
    }
  } else if (corr > 0 && absBias >= thresh_star1) {
    // 1星：25%~35% 区间（+5%容错）
    const upperBound = 35 * corr;
    if (absBias <= upperBound) {
      stars = 1;
    }
  }

  return {
    stars,
    corr: +corr.toFixed(4),
    threshold_star1: +thresh_star1.toFixed(2),
    threshold_star2: +thresh_star2.toFixed(2),
    threshold_star3: +thresh_star3.toFixed(2),
    isBuyWarning,
    isBroadIndex: false,
  };
}
