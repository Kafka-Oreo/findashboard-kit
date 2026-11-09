/**
 * 解析用户输入的市场数据
 * 从自然语言文本中提取结构化市场数据
 */

import { MarketData } from "./types";

interface ParsedMarketData {
  turnover?: number;
  advance?: number;
  decline?: number;
  limitUp?: number;
  limitDown?: number;
  limitUpRate?: number;
  ma60Deviation?: number;
  shMa60Deviation?: number;
  cybMa60Deviation?: number;
  kcbMa60Deviation?: number;
  mainFundFlow?: number;
  northFundFlow?: number;
}

/**
 * 从文本中提取数字（支持中文单位）
 */
function extractNumber(text: string, patterns: string[]): number | undefined {
  for (const pattern of patterns) {
    const regex = new RegExp(pattern + '[：:]*\\s*([\\d.]+)\\s*(亿|万|%)?', 'i');
    const match = text.match(regex);
    if (match) {
      let value = parseFloat(match[1]);
      if (match[2] === '万') value = value / 10000;
      return value;
    }
  }
  return undefined;
}

/**
 * 解析用户输入的市场数据
 * 支持 JSON 格式和自然语言格式
 */
export function parseMarketDataFromText(text: string): ParsedMarketData {
  const result: ParsedMarketData = {};

  // 尝试解析 JSON 格式
  try {
    const jsonMatch = text.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (typeof parsed === 'object' && parsed !== null) {
        // 直接映射 JSON 字段
        if (parsed.turnover !== undefined) result.turnover = Number(parsed.turnover);
        if (parsed.advance !== undefined) result.advance = Number(parsed.advance);
        if (parsed.decline !== undefined) result.decline = Number(parsed.decline);
        if (parsed.limitUp !== undefined) result.limitUp = Number(parsed.limitUp);
        if (parsed.limitDown !== undefined) result.limitDown = Number(parsed.limitDown);
        if (parsed.limitUpRate !== undefined) result.limitUpRate = Number(parsed.limitUpRate);
        if (parsed.ma60Deviation !== undefined) result.ma60Deviation = Number(parsed.ma60Deviation);
        if (parsed.shMa60Deviation !== undefined) result.shMa60Deviation = Number(parsed.shMa60Deviation);
        if (parsed.cybMa60Deviation !== undefined) result.cybMa60Deviation = Number(parsed.cybMa60Deviation);
        if (parsed.kcbMa60Deviation !== undefined) result.kcbMa60Deviation = Number(parsed.kcbMa60Deviation);
        if (parsed.mainFundFlow !== undefined) result.mainFundFlow = Number(parsed.mainFundFlow);
        if (parsed.northFundFlow !== undefined) result.northFundFlow = Number(parsed.northFundFlow);
        
        // 如果解析到了数据，直接返回
        if (Object.keys(result).length > 0) {
          return result;
        }
      }
    }
  } catch (e) {
    // JSON 解析失败，继续尝试自然语言解析
  }

  // 自然语言解析
  // 成交额
  result.turnover = extractNumber(text, [
    '成交额', '成交金额', '两市成交', '沪深成交', 'total.*turnover', 'turnover'
  ]);

  // 上涨家数
  result.advance = extractNumber(text, [
    '上涨', '上涨家数', 'advance', 'up.*count', 'rise.*count'
  ]);

  // 下跌家数
  result.decline = extractNumber(text, [
    '下跌', '下跌家数', 'decline', 'down.*count', 'fall.*count'
  ]);

  // 涨停家数
  result.limitUp = extractNumber(text, [
    '涨停', '涨停家数', 'limitUp', 'limit.*up'
  ]);

  // 跌停家数
  result.limitDown = extractNumber(text, [
    '跌停', '跌停家数', 'limitDown', 'limit.*down'
  ]);

  // 封板率
  result.limitUpRate = extractNumber(text, [
    '封板率', 'limitRate', 'seal.*rate'
  ]);

  // MA60 乖离率
  result.ma60Deviation = extractNumber(text, [
    'MA60', 'ma60', '乖离率', 'deviation'
  ]);

  // 三大指数60日乖离率
  result.shMa60Deviation = extractNumber(text, [
    '上证.*MA60', '上证.*乖离', 'shMa60', '上证指数.*偏离'
  ]);
  result.cybMa60Deviation = extractNumber(text, [
    '创业板.*MA60', '创业板.*乖离', 'cybMa60', '创业板指.*偏离'
  ]);
  result.kcbMa60Deviation = extractNumber(text, [
    '科创板.*MA60', '科创板.*乖离', 'kcbMa60', '科创.*偏离'
  ]);

  // 主力资金
  result.mainFundFlow = extractNumber(text, [
    '主力', '主力资金', 'mainFund', 'main.*fund'
  ]);

  // 北向资金
  result.northFundFlow = extractNumber(text, [
    '北向', '北向资金', 'northFund', 'north.*fund'
  ]);

  return result;
}

/**
 * 合并 MarketData（用户输入优先）
 */
export function mergeMarketData(
  existing: MarketData,
  userInput: ParsedMarketData
): MarketData {
  return {
    ...existing,
    ...userInput,
    // 确保必填字段有值
    turnover: userInput.turnover ?? existing.turnover,
    advance: userInput.advance ?? existing.advance,
    decline: userInput.decline ?? existing.decline,
    limitUp: userInput.limitUp ?? existing.limitUp,
    limitDown: userInput.limitDown ?? existing.limitDown,
    limitUpRate: userInput.limitUpRate ?? existing.limitUpRate,
    ma60Deviation: userInput.ma60Deviation ?? existing.ma60Deviation,
    mainFundFlow: userInput.mainFundFlow ?? existing.mainFundFlow,
    northFundFlow: userInput.northFundFlow ?? existing.northFundFlow,
  };
}

/**
 * 创建空的 MarketData（所有字段为 null 或空数组）
 * 用于初始化或无数据时的默认值
 */
export function createEmptyMarketData(): MarketData {
  return {
    date: '',
    turnover: null,
    advance: null,
    decline: null,
    advanceDeclineRatio: null,
    limitUp: null,
    limitDown: null,
    limitUpRate: null,
    ma60Deviation: null,
    wandeMa60Deviation: null,
    shMa60Deviation: null,
    cybMa60Deviation: null,
    kcbMa60Deviation: null,
    mainFundFlow: null,
    northFundFlow: null,
    sectorRanking: [],
    abnormalSectors: [],
    limitUpStocks: [],
    goldenStocks: { mostWatched: [], topGainers: [] },
    followUp: [],
    source: '暂无数据',
    updateTime: '',
    isRealData: false,
  };
}
