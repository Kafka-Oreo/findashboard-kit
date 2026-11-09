/**
 * 市场情绪温度计算工具
 * 基于涨跌停家数、成交量、连板高度等数据计算情绪温度
 * 参考 Wind 情绪指标体系
 */

export interface MarketMetrics {
  limitUp: number;      // 涨停家数
  limitDown: number;    // 跌停家数
  upCount: number;      // 上涨家数
  downCount: number;    // 下跌家数
  volume: number;       // 成交量（亿）
  maxConsecutive: number; // 最高连板数
  consecutiveCount: number; // 连板家数（2 板及以上）
  prevVolume?: number;  // 前一日成交量（亿）
  prevLimitUp?: number; // 前一日涨停家数
}

export interface TemperatureResult {
  score: number;        // 温度分数 (-100 到 +100)
  level: '过热' | '活跃' | '正常' | '偏冷' | '次冰' | '深冰';
  levelClass: 'tip-warm' | 'tip-cool' | 'tip-cold';
  levelColor: string;
  description: string;
}

/**
 * 计算市场情绪温度
 * 
 * 温度等级划分（参考 Wind 情绪指标）：
 * - 过热 (+75° 以上): 涨停>200 家，连板>10 板，市场极度亢奋
 * - 活跃 (+50° ~ +75°): 涨停 100-200 家，连板 7-10 板，市场活跃
 * - 正常 (+25° ~ +50°): 涨停 50-100 家，连板 4-7 板，市场平稳
 * - 偏冷 (0° ~ +25°): 涨停 30-50 家，连板 2-4 板，市场谨慎
 * - 次冰 (-25° ~ 0°): 涨停 10-30 家，连板 1-2 板，市场低迷
 * - 深冰 (-50° 以下): 涨停<10 家，跌停>50 家，市场恐慌
 */
export function calculateTemperature(metrics: MarketMetrics): TemperatureResult {
  let score = 0;
  
  // 1. 涨停家数评分（权重 35%）
  const limitUpScore = Math.min(metrics.limitUp / 200, 1) * 100;
  score += limitUpScore * 0.35;
  
  // 2. 跌停家数扣分（权重 15%）
  const limitDownPenalty = Math.min(metrics.limitDown / 100, 1) * 100;
  score -= limitDownPenalty * 0.15;
  
  // 3. 涨跌比评分（权重 20%）
  const upDownRatio = metrics.upCount / (metrics.upCount + metrics.downCount);
  const upDownScore = (upDownRatio - 0.5) * 2 * 100; // -100 到 +100
  score += upDownScore * 0.20;
  
  // 4. 连板高度评分（权重 20%）
  const consecutiveScore = Math.min((metrics.maxConsecutive - 1) / 10, 1) * 100;
  score += consecutiveScore * 0.20;
  
  // 5. 量能评分（权重 10%）
  let volumeScore = 0;
  if (metrics.prevVolume) {
    const volumeChange = (metrics.volume - metrics.prevVolume) / metrics.prevVolume;
    volumeScore = Math.max(-50, Math.min(50, volumeChange * 100));
  } else {
    // 无前日数据时，根据绝对量能判断
    volumeScore = metrics.volume > 15000 ? 30 : metrics.volume > 10000 ? 0 : -20;
  }
  score += volumeScore * 0.10;
  
  // 限制在 -100 到 +100 之间
  score = Math.max(-100, Math.min(100, score));
  
  // 确定温度等级
  let level: TemperatureResult['level'];
  let levelClass: TemperatureResult['levelClass'];
  let levelColor: string;
  let description: string;
  
  if (score >= 75) {
    level = '过热';
    levelClass = 'tip-warm';
    levelColor = '#991b1b';
    description = `市场极度亢奋，涨停${metrics.limitUp}家，连板高度${metrics.maxConsecutive}板，注意追高风险`;
  } else if (score >= 50) {
    level = '活跃';
    levelClass = 'tip-warm';
    levelColor = '#ef4444';
    description = `市场活跃，涨停${metrics.limitUp}家，连板高度${metrics.maxConsecutive}板，可积极参与`;
  } else if (score >= 25) {
    level = '正常';
    levelClass = 'tip-warm';
    levelColor = '#eab308';
    description = `市场平稳，涨停${metrics.limitUp}家，连板高度${metrics.maxConsecutive}板，结构性机会`;
  } else if (score >= 0) {
    level = '偏冷';
    levelClass = 'tip-cool';
    levelColor = '#22c55e';
    description = `市场谨慎，涨停${metrics.limitUp}家，连板高度${metrics.maxConsecutive}板，控制仓位`;
  } else if (score >= -25) {
    level = '次冰';
    levelClass = 'tip-cold';
    levelColor = '#3b82f6';
    description = `市场低迷，涨停${metrics.limitUp}家，跌停${metrics.limitDown}家，等待企稳`;
  } else {
    level = '深冰';
    levelClass = 'tip-cold';
    levelColor = '#1e40af';
    description = `市场恐慌，涨停${metrics.limitUp}家，跌停${metrics.limitDown}家，观望为主`;
  }
  
  return {
    score: Math.round(score),
    level,
    levelClass,
    levelColor,
    description,
  };
}

/**
 * 根据温度分数获取等级信息（用于手动设置温度时，与 Wind 情绪指标匹配）
 */
export function getTemperatureLevel(score: number): Omit<TemperatureResult, 'score'> {
  if (score >= 75) {
    return {
      level: '过热',
      levelClass: 'tip-warm',
      levelColor: '#991b1b',
      description: '市场极度亢奋，注意追高风险',
    };
  } else if (score >= 50) {
    return {
      level: '活跃',
      levelClass: 'tip-warm',
      levelColor: '#ef4444',
      description: '市场活跃，可积极参与',
    };
  } else if (score >= 25) {
    return {
      level: '正常',
      levelClass: 'tip-warm',
      levelColor: '#eab308',
      description: '市场平稳，结构性机会',
    };
  } else if (score >= 0) {
    return {
      level: '偏冷',
      levelClass: 'tip-cool',
      levelColor: '#22c55e',
      description: '市场谨慎，控制仓位',
    };
  } else if (score >= -25) {
    return {
      level: '次冰',
      levelClass: 'tip-cold',
      levelColor: '#3b82f6',
      description: '市场低迷，等待企稳',
    };
  } else {
    return {
      level: '深冰',
      levelClass: 'tip-cold',
      levelColor: '#1e40af',
      description: '市场恐慌，观望为主',
    };
  }
}
