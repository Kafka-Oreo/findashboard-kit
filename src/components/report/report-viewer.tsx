'use client';

import { useEffect, useState } from 'react';
import type { ReportData, DailyEvent, MarketData } from '@/lib/types';
import { PageOverview } from './page-overview';
import { PageAnalysis } from './page-analysis';
import { PageStrategy } from './page-strategy';
import { InstitutionalViews } from './institutional-views';
import GlobalMarketEvents from './global-market-events';

const defaultMarketData: MarketData = {
  turnover: null,
  advance: null,
  decline: null,
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
  source: '',
  updateTime: '',
  isRealData: false,
  date: '',
  advanceDeclineRatio: null,
  limitUpStocks: [],
  goldenStocks: { mostWatched: [], topGainers: [] },
  followUp: [],
};

/** 北京时区（UTC+8）当前日期 YYYY-MM-DD，避免凌晨时段 UTC 切片错标成前一天 */
function todayInShanghai(): string {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** 从日报静态数据构造 MarketData（历史日报 / 实时接口不可用时的兜底数据源） */
function buildMarketDataFromReport(data: ReportData): MarketData {
  return {
    turnover: data.summary?.turnover ?? null,
    advance: data.summary?.advance ?? null,
    decline: data.summary?.decline ?? null,
    limitUp: data.summary?.limitUp ?? null,
    limitDown: data.summary?.limitDown ?? null,
    limitUpRate: data.summary?.limitUpRate ?? null,
    ma60Deviation: data.ma60Deviation ?? null,
    wandeMa60Deviation: data.wandeMa60Deviation ?? data.ma60Deviation ?? null,
    shMa60Deviation: data.shMa60Deviation ?? null,
    cybMa60Deviation: data.cybMa60Deviation ?? null,
    kcbMa60Deviation: data.kcbMa60Deviation ?? null,
    mainFundFlow: null,
    northFundFlow: null,
    sectorRanking: [],
    abnormalSectors: (data.alerts ?? []).map(alert => ({
      name: alert.name,
      reason: alert.tag,
      starRating: alert.starRating ?? (alert.isPositive ? (alert.tag === '领涨' ? 3 : alert.tag === '延续' ? 2 : 1) : 1),
      bias60: alert.bias60,
    })),
    source: '日报数据',
    updateTime: data.dateLabel,
    isRealData: true,
    date: data.date,
    advanceDeclineRatio: null,
    limitUpStocks: [],
    goldenStocks: { mostWatched: [], topGainers: [] },
    followUp: (data.followUp ?? []).map(text => {
      const parts = text.split('——');
      return { title: parts[0] || '', desc: parts[1] || '' };
    }),
  };
}

interface ReportViewerProps {
  data: ReportData;
  events?: DailyEvent[];
}

export function ReportViewer({ data, events }: ReportViewerProps) {
  const [marketData, setMarketData] = useState<MarketData>(defaultMarketData);

  useEffect(() => {
    // 从 API 获取统一市场数据（仅当查看今日日报时）；历史日报或接口不可用时用日报静态数据兜底
    async function fetchMarketData() {
      // 历史日报直接使用日报文件中的数据，不从 API 获取
      if (data.date !== todayInShanghai()) {
        setMarketData(buildMarketDataFromReport(data));
        return;
      }

      try {
        const res = await fetch('/api/market/latest');
        const json = await res.json();

        if (json.success && json.data) {
          // 转换为 MarketData 结构
          const md: MarketData = {
            turnover: json.data.turnover ?? null,
            advance: json.data.advance ?? null,
            decline: json.data.decline ?? null,
            limitUp: json.data.limit_up ?? null,
            limitDown: json.data.limit_down ?? null,
            limitUpRate: json.data.limit_up_rate ?? null,
            ma60Deviation: json.data.ma60_deviation ?? data.ma60Deviation ?? null,
            wandeMa60Deviation: json.data.wande_ma60_deviation ?? json.data.ma60_deviation ?? data.wandeMa60Deviation ?? data.ma60Deviation ?? null,
            shMa60Deviation: json.data.sh_ma60_deviation ?? data.shMa60Deviation ?? null,
            cybMa60Deviation: json.data.cyb_ma60_deviation ?? data.cybMa60Deviation ?? null,
            kcbMa60Deviation: json.data.kcb_ma60_deviation ?? data.kcbMa60Deviation ?? null,
            mainFundFlow: json.data.main_fund_flow ?? null,
            northFundFlow: json.data.north_fund_flow ?? null,
            sectorRanking: Array.isArray(json.data.sector) ? json.data.sector : [],
            abnormalSectors: (data.alerts ?? []).map(alert => ({
              name: alert.name,
              reason: alert.tag,
              starRating: alert.starRating ?? (alert.isPositive ? (alert.tag === '领涨' ? 3 : alert.tag === '延续' ? 2 : 1) : 1),
              bias60: alert.bias60,
            })),
            source: json.data.source || 'API',
            updateTime: json.data.update_time || new Date().toLocaleString('zh-CN'),
            isRealData: json.data.is_real_data ?? true,
            date: json.data.trade_date || data.date,
            advanceDeclineRatio: null,
            limitUpStocks: [],
            goldenStocks: { mostWatched: [], topGainers: [] },
            followUp: (data.followUp ?? []).map(text => {
              const parts = text.split('——');
              return { title: parts[0] || '', desc: parts[1] || '' };
            }),
          };
          setMarketData(md);
        } else {
          // 接口返回无数据（DB/文件均不可用）时，用日报静态数据兜底
          setMarketData(buildMarketDataFromReport(data));
        }
      } catch (error) {
        console.error('Failed to fetch market data:', error);
        setMarketData(buildMarketDataFromReport(data));
      }
    }
    fetchMarketData();
  }, [data]);

  return (
    <div className="space-y-6">
      {/* P1: 情绪总览 */}
      <div id="sec-temperature">
        <PageOverview data={data} marketData={marketData ?? undefined} showAll={false} events={events} />
      </div>
      <div id="sec-catalysts">
        <PageOverview data={data} marketData={marketData ?? undefined} showAll={true} section="catalysts" />
      </div>
      <div id="sec-ladder">
        <PageOverview data={data} marketData={marketData ?? undefined} showAll={true} section="ladder" />
      </div>

      {/* P2: 策略建议 */}
      <div id="sec-signals">
        <PageStrategy data={data} section="signals" />
      </div>

      {/* P3: 数据分析 */}
      <div id="sec-intraday">
        <PageAnalysis marketData={marketData ?? defaultMarketData} data={data} section="intraday" />
      </div>

      {/* P4: 机构观点 */}
      {data.institutional && (
        <div id="sec-institutional">
          <InstitutionalViews data={data} />
        </div>
      )}

      {/* P5: 全球市场热点 */}
      <div id="sec-global-events">
        <GlobalMarketEvents events={data.globalEvents} />
      </div>

      {/* P6: 避雷提醒 */}
      {data.riskWarnings && (
        <div id="sec-risk-warnings" className="bg-surface border border-border rounded-xl p-5">
          <div className="text-[15px] text-text-secondary font-semibold mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-danger rounded-sm" />
            避雷与提醒
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.riskWarnings.map((block, i) => (
              <div key={i} className={`rounded-lg p-3 ${block.warning ? 'bg-warning/20/30 border border-warning/20' : 'bg-primary/20/30 border border-primary/20'}`}>
                <div className={`text-[12px] font-bold mb-2 flex items-center gap-1.5 ${block.warning ? 'text-warning' : 'text-primary'}`}>
                  {block.warning && <span>⚠</span>}
                  {block.title}
                </div>
                <ul className="space-y-1.5">
                  {block.items.map((item, j) => (
                    <li key={j} className="text-[11px] text-text-secondary leading-relaxed flex gap-1.5">
                      <span className="text-text-muted shrink-0">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
