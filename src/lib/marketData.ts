import type { MarketData } from './types';

/**
 * 从 API 数据转换为统一 MarketData 结构
 * 所有组件必须使用此函数转换后的数据
 */
export function transformToMarketData(
  marketData: any,
  limitUpData: any,
  reportData: any
): MarketData {
  // 从 limitUpData 获取涨跌停数据
  const limitUp = limitUpData?.upCount ?? 0;
  const limitDown = limitUpData?.downCount ?? 0;
  const limitUpRate = limitUpData?.sealRate ?? 0;
  const advanceDeclineRatio = limitUpData?.limitRatio ?? 0;

  // 从 marketData 获取成交和涨跌数据
  const turnover = marketData?.indices?.sh?.slice(-1)[0]?.volume ?? 0;
  const advance = limitUpData?.upCount ?? 0; // 需要从其他地方获取
  const decline = limitUpData?.downCount ?? 0; // 需要从其他地方获取

  // 从 reportData 获取 MA60 乖离率
  const ma60Deviation = reportData?.movingAverages?.[3]?.deviation
    ? parseFloat(reportData.movingAverages[3].deviation.replace('%', '').replace('+', ''))
    : 0;

  // 板块排行
  const sectorRanking = (marketData?.sectors ?? [])
    .map((s: any) => ({ name: s.name, change: s.change }))
    .sort((a: any, b: any) => b.change - a.change);

  // 涨停个股列表
  const limitUpStocks = limitUpData?.stocks ?? [];

  // 金股数据
  const goldenStocks = reportData?.goldenStocks
    ? {
        mostWatched: reportData.goldenStocks.mostWatched ?? [],
        topGainers: reportData.goldenStocks.topGainers ?? [],
      }
    : null;

  return {
    date: marketData?.tradingDays?.slice(-1)[0] ?? new Date().toISOString().split('T')[0],
    turnover,
    advance,
    decline,
    limitUp,
    limitDown,
    advanceDeclineRatio,
    limitUpRate,
    ma60Deviation,
    shMa60Deviation: marketData?.shMa60Deviation ?? null,
    wandeMa60Deviation: marketData?.wandeMa60Deviation ?? ma60Deviation ?? null,
    cybMa60Deviation: marketData?.cybMa60Deviation ?? null,
    kcbMa60Deviation: marketData?.kcbMa60Deviation ?? null,
    mainFundFlow: marketData?.funds?.values?.slice(-1)[0] ?? null,
    northFundFlow: null,
    sectorRanking,
    abnormalSectors: marketData?.alerts ?? [],
    limitUpStocks,
    goldenStocks,
    followUp: reportData?.followUp ?? [],
    source: 'API',
    updateTime: new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }),
    isRealData: true,
  };
}

/**
 * 从 API 获取并转换 MarketData
 * 组件应该调用此函数获取数据，而不是直接读取 JSON
 */
export async function fetchMarketData(date: string): Promise<MarketData> {
  const [marketRes, limitUpRes, reportRes] = await Promise.all([
    fetch('/api/market-data'),
    fetch(`/api/limit-up-data?date=${date}`),
    fetch(`/api/report?date=${date}`),
  ]);

  const marketData = await marketRes.json();
  const limitUpData = await limitUpRes.json();
  const reportData = await reportRes.json();

  return transformToMarketData(
    marketData.data,
    limitUpData.data,
    reportData.data
  );
}
