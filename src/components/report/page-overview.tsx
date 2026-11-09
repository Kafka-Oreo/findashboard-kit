'use client';

import { useState, useEffect } from 'react';
import type { ReportData, DailyEvent, MarketData } from '@/lib/types';
import { ThermoChart, LimitsChart, LadderChart } from './charts';
import { LadderSection } from './ladder-section';
import { getCatalystUrl, isGenericHomepage } from '@/lib/utils';
import { quotePools } from '@/lib/quote-corpus';

interface Props {
  data: ReportData;
  marketData: MarketData; // 统一市场数据（唯一数据源）
  showAll?: boolean;
  section?: 'catalysts' | 'ladder';
  events?: DailyEvent[];
}

export function PageOverview({ data, marketData, showAll, section, events }: Props) {
  const tempPercent = ((data.temperature.score + 100) / 200) * 100;
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [stockModalName, setStockModalName] = useState("");
  const [stockData, setStockData] = useState<any>(null);
  const [stockLoading, setStockLoading] = useState(false);
  const [stockError, setStockError] = useState(false);
  const [hoveredEvent, setHoveredEvent] = useState<number | null>(null);
  // 财联社电报（外部/内部因素用）
  const [telegraphData, setTelegraphData] = useState<{
    external: any[];
    internal: any[];
  } | null>(null);
  const [telegraphLoading, setTelegraphLoading] = useState(true);
  const [telegraphError, setTelegraphError] = useState(false);

  useEffect(() => {
    if (section !== 'catalysts') return;
    setTelegraphLoading(true);
    setTelegraphError(false);
    const params = new URLSearchParams();
    if (data.date) params.set('date', data.date.replace(/-/g, ''));
    params.set('limit', '60');
    fetch(`/api/cls-telegraph?${params.toString()}`)
      .then(r => r.json())
      .then(res => {
        if (res.success) {
          setTelegraphData({
            external: res.external?.data ?? [],
            internal: res.internal?.data ?? [],
          });
        } else {
          setTelegraphError(true);
        }
      })
      .catch(() => setTelegraphError(true))
      .finally(() => setTelegraphLoading(false));
  }, [data.date, section]);

  const levelColor = (level: string) => {
    if (level === 'A' || level === 'S') return '#ef4444';
    if (level === 'B') return '#f97316';
    return '#6b7280';
  };

  if (section === 'catalysts') {
    // ====== 财联社当日新闻：外部因素 / 内部因素 ======
    const renderNewsItem = (item: any, idx: number) => (
      <a
        key={item.id || idx}
        href={item.source_url || item.url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block text-[12px] text-text-secondary leading-relaxed mb-3 last:mb-0 no-underline -mx-2 px-2 py-1.5 -my-1 rounded-lg hover:bg-black/[0.03] dark:hover:bg-white/[0.04] transition-colors"
        title="点击查看原文"
      >
        <div className="flex items-start gap-2">
          <span
            className="flex-shrink-0 w-1.5 h-1.5 rounded-full mt-1.5"
            style={{ backgroundColor: levelColor(item.level) }}
          />
          <div className="flex-1 min-w-0">
            <div className="font-medium text-[12.5px] dark:text-white text-[#1d1d1f] leading-snug mb-0.5 line-clamp-2 group-hover:text-accent-blue dark:group-hover:text-accent-blue transition-colors">
              {item.title}
            </div>
            <div className="text-[11px] text-text-muted line-clamp-2">
              {item.content?.slice(0, 60)}...
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[10px] text-text-muted">
                {item.publish_time?.slice(11, 16)}
              </span>
              {item.subjects?.[0] && (
                <span
                  className="text-[10px] px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'rgba(37, 99, 235, 0.08)', color: '#2563eb' }}
                >
                  {item.subjects[0]}
                </span>
              )}
              <span className="text-[10px] text-accent-blue opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
                原文 →
              </span>
            </div>
          </div>
        </div>
      </a>
    );

    const renderLoading = () => (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="animate-pulse">
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-4/5 mb-2" />
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-full mb-1" />
            <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded w-2/3" />
          </div>
        ))}
      </div>
    );

    return (
      <div className="grid grid-cols-2 gap-4">
        {/* 外部因素 */}
        <div className="dark:bg-card-content bg-card-content dark:border-border border-border rounded-[16px] p-6 glass-card">
          <div className="text-[15px] dark:text-text-secondary text-text-secondary font-semibold mb-4 flex items-center justify-between">
            <span>海外市场当日讯息</span>
            <span className="text-[10px] font-normal text-text-muted">财联社电报</span>
          </div>
          {telegraphLoading ? renderLoading() : telegraphError ? (
            <div className="text-xs text-text-muted py-8 text-center">新闻加载失败</div>
          ) : telegraphData?.external?.length ? (
            telegraphData.external.slice(0, 6).map((item, i) => renderNewsItem(item, i))
          ) : (
            <div className="text-xs text-text-muted py-8 text-center">暂无相关新闻</div>
          )}
        </div>
        {/* 内部因素 */}
        <div className="dark:bg-card-content bg-card-content dark:border-border border-border rounded-[16px] p-6 glass-card">
          <div className="text-[15px] dark:text-text-secondary text-text-secondary font-semibold mb-4 flex items-center justify-between">
            <span>国内市场当日讯息</span>
            <span className="text-[10px] font-normal text-text-muted">财联社电报</span>
          </div>
          {telegraphLoading ? renderLoading() : telegraphError ? (
            <div className="text-xs text-text-muted py-8 text-center">新闻加载失败</div>
          ) : telegraphData?.internal?.length ? (
            telegraphData.internal.slice(0, 6).map((item, i) => renderNewsItem(item, i))
          ) : (
            <div className="text-xs text-text-muted py-8 text-center">暂无相关新闻</div>
          )}
        </div>
      </div>
    );
  }

  const openStockModal = (stockName: string, stockCode?: string) => {
    setStockModalName(stockName);
    setStockModalOpen(true);
    setStockData(null);
    setStockError(false);
    setStockLoading(true);
    const params = new URLSearchParams();
    params.set('name', stockName);
    if (stockCode) params.set('code', stockCode);
    if (data.date) params.set('date', data.date);
    fetch(`/api/stock-quote?${params.toString()}`)
      .then(r => r.json())
      .then(res => {
        if (res.success && res.data) {
          setStockData(res.data);
          setStockError(false);
        } else {
          setStockError(true);
        }
      })
      .catch(() => setStockError(true))
      .finally(() => setStockLoading(false));
  };

  const closeStockModal = () => {
    setStockModalOpen(false);
    setStockData(null);
    setStockError(false);
  };

  if (section === 'ladder') {
    return (
      <>
        <LadderSection data={data} onOpenStockModal={openStockModal} />
        {/* 个股详情弹窗 */}
        {stockModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={closeStockModal}
          >
            <div
              className="rounded-2xl p-6 w-[340px] shadow-2xl relative"
              style={{
                backgroundColor: 'var(--card-content)',
                border: '1px solid var(--border)',
              }}
              onClick={e => e.stopPropagation()}
            >
              {/* 关闭按钮 */}
              <button
                type="button"
                onClick={closeStockModal}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center rounded-full transition-opacity hover:opacity-70"
                style={{ color: 'var(--text-muted)' }}
              >
                ×
              </button>

              {/* 标题：股票名称 + 涨跌幅 */}
              <div className="mb-5">
                <div className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                  {stockModalName}
                </div>
                {stockData && stockData.code && (
                  <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                    {stockData.code} · {stockData.source || '数据接口'}
                  </div>
                )}
              </div>

              {/* 内容区 */}
              {stockLoading && (
                <div className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                  行情加载中...
                </div>
              )}

              {stockError && (
                <div className="py-10 text-center">
                  <div className="text-sm mb-2" style={{ color: '#ef4444' }}>
                    个股行情加载失败，请刷新页面
                  </div>
                  <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                    数据源：多源免费行情接口
                  </div>
                </div>
              )}

              {!stockLoading && !stockError && stockData && (
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  {(() => {
                    const numOrNull = (v: unknown): number | null => {
                      const n = typeof v === 'number' ? v : Number(v);
                      return Number.isFinite(n) ? n : null;
                    };
                    const change = numOrNull(stockData.change);
                    const latest = numOrNull(stockData.latest ?? stockData.close);
                    const open = numOrNull(stockData.open);
                    const close = numOrNull(stockData.close);
                    const priceColor = (change ?? 0) >= 0 ? '#dc2626' : '#16a34a';
                    return (
                      <>
                        <div>
                          <div className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>当日涨跌幅</div>
                          <div className="text-lg font-bold font-data" style={{ color: change === null ? 'var(--text-muted)' : priceColor }}>
                            {change === null ? '--' : `${change >= 0 ? '+' : ''}${change.toFixed(2)}%`}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>最新价</div>
                          <div className="text-lg font-bold font-data" style={{ color: latest === null ? 'var(--text-muted)' : priceColor }}>
                            {latest === null ? '--' : latest.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>开盘价</div>
                          <div className="text-base font-semibold font-data" style={{ color: 'var(--text-primary)' }}>
                            {open === null ? '--' : open.toFixed(2)}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] mb-0.5" style={{ color: 'var(--text-muted)' }}>收盘价</div>
                          <div className="text-base font-semibold font-data" style={{ color: 'var(--text-primary)' }}>
                            {close === null ? '--' : close.toFixed(2)}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* 底部提示 */}
              <div className="mt-5 text-[10px] text-center" style={{ color: 'var(--text-muted)' }}>
                点击空白处关闭弹窗
              </div>
            </div>
          </div>
        )}
      </>
    );
  }
  // 解析日期信息
  const dateInfo = data.date ? new Date(data.date) : null;
  const year = dateInfo?.getFullYear() ?? 2026;
  const month = dateInfo?.getMonth() ?? 6; // 0-indexed
  const day = dateInfo?.getDate() ?? 27;
  const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
  const weekday = dateInfo ? weekdays[dateInfo.getDay()] : '日';

  // 获取高重要性事件，最多4个
  const majorEvents = (events || []).filter(e => e.importance === 'high').slice(0, 4);

  // 根据实际行情数据判断看多/看空（优先使用 MarketData）
  const upNum = marketData.advance ?? 0;
  const downNum = marketData.decline ?? 0;
  // 根据当日盘面和市场行情选择契合的投资名言
  const isUp = upNum > downNum;
  const sentimentText = isUp ? '看涨' : '看跌';
  const sentimentColor = isUp ? '#ef4444' : '#22c55e';

  // 判断市场状态（强势/弱势/震荡）
  const upDownRatio = upNum / (upNum + downNum);
  const isStrongUp = isUp && upDownRatio > 0.7; // 强势上涨（上涨占比>70%）
  const isWeakUp = isUp && upDownRatio <= 0.7; // 弱势上涨
  const isStrongDown = !isUp && upDownRatio < 0.3; // 强势下跌（下跌占比>70%）
  const isWeakDown = !isUp && upDownRatio >= 0.3; // 弱势下跌

  // 根据市场状态选择语录池
  let quotePool: string[];
  if (isStrongUp) quotePool = quotePools.strongUp;
  else if (isWeakUp) quotePool = quotePools.weakUp;
  else if (isStrongDown) quotePool = quotePools.strongDown;
  else quotePool = quotePools.weakDown;

  const todayQuote = quotePool[day % quotePool.length];

  // 根据双师观点和行情生成宜忌
  const directions = data.directions || [];
  const greenItems = directions.find(d => d.type === 'green')?.items || [];
  const redItems = directions.find(d => d.type === 'red')?.items || [];
  const yellowItems = directions.find(d => d.type === 'yellow')?.items || [];

  // 宜：可关注方向 + 积极操作建议
  const yiActions = ['持仓观望', '逢低布局', '精选个股', '控制仓位', '持有主线'];
  const yiDirection = greenItems[0] || yellowItems[0] || '主线方向';
  const yiAction = isUp ? yiActions[day % yiActions.length] : '持仓观望';
  const yi = `${yiAction} · ${yiDirection}`;

  // 忌：需谨慎/不追高方向 + 消极操作建议
  const jiActions = ['追涨杀跌', '频繁交易', '满仓操作', '盲目跟风', '情绪化交易'];
  const jiDirection = redItems[0] || '高标股';
  const jiAction = isUp ? '追涨杀跌' : jiActions[day % jiActions.length];
  const ji = `${jiAction} · ${jiDirection}`;

  return (
    <div className="space-y-3">
      {/* Main Title with Event Dots on Both Sides */}
      <div className="text-center py-6 relative" style={{ minHeight: '180px' }}>
        {/* 农历日期行（装饰性） */}
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="h-px flex-1 max-w-[80px] bg-surface-secondary" />
          <span className="text-[11px] dark:text-text-muted text-text-secondary">丙午（马年）六月{(() => {
            const n = day;
            const cnNums = ['初', '十', '廿', '三'];
            if (n <= 10) return '初' + ['一','二','三','四','五','六','七','八','九','十'][n - 1];
            if (n === 20) return '二十';
            if (n === 30) return '三十';
            const tens = Math.floor(n / 10); // 1 or 2
            const ones = n % 10;
            return cnNums[tens] + ['一','二','三','四','五','六','七','八','九'][ones - 1];
          })()}</span>
          <div className="h-px flex-1 max-w-[80px] bg-surface-secondary" />
        </div>

        {/* 公历月份 */}
        <div className="text-[12px] dark:text-text-muted text-text-secondary mb-1">{year}年{month + 1}月</div>

        {/* 大日期数字 */}
        <div className="text-7xl font-bold dark:text-[#E8E8E8] text-primary leading-none mb-2 font-data">{day}</div>

        {/* 星期 */}
        <div className="text-base dark:text-text-muted text-text-secondary mb-3">星期{weekday}</div>

        {/* 看涨/看跌 */}
        <div className="text-sm font-semibold mb-3" style={{ color: sentimentColor }}>
          {sentimentText}
        </div>

        {/* 投资名言 */}
        <div className="text-[11px] dark:text-text-secondary text-text-muted italic mb-4 px-8">
          {todayQuote}
        </div>

        {/* 宜忌标签 */}
        <div className="flex items-center justify-center gap-4 mb-4">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-danger text-[10px] text-text-primary font-bold">宜</span>
            <span className="text-[11px] dark:text-text-primary text-text-muted">{yi}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-success text-[10px] text-text-primary font-bold">忌</span>
            <span className="text-[11px] dark:text-text-primary text-text-muted">{ji}</span>
          </div>
        </div>

        {/* 主标题 */}
        <h1 className="text-2xl font-bold dark:text-white text-[#1d1d1f] leading-relaxed whitespace-pre-line">
          {data.mainTitle}
        </h1>
        <div className="text-[10px] text-text-muted mt-1.5 italic">声明：本复盘仅为本人的股市思考历程，非荐股，请勿跟票。</div>
      </div>

      {/* Thermometer - New Layout */}
      <div className="glass-card">
        <div className="text-[17px] dark:text-text-secondary text-text-secondary font-semibold mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-danger rounded-sm" />
          市场情绪温度计 · 近 7 个交易日
        </div>

        <div className="flex gap-6">
          {/* Left 1/4: Vertical Thermometer with labels on left */}
          <div className="w-1/4 flex flex-col items-center justify-center">
            <div className="relative h-48 flex items-center w-full">
              {/* Labels on the left side - aligned with temperature values */}
              <div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between text-[11px] font-semibold py-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-danger dark:text-danger font-data">+75°</span>
                  <span className="text-danger dark:text-danger">过热</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-danger dark:text-danger font-data">+50°</span>
                  <span className="text-danger dark:text-danger">活跃</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-warning dark:text-warning font-data">+25°</span>
                  <span className="text-warning dark:text-warning">正常</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-success dark:text-success font-data">+0°</span>
                  <span className="text-success dark:text-success">偏冷</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-primary dark:text-primary font-data">-25°</span>
                  <span className="text-primary dark:text-primary">次冰</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-primary dark:text-primary font-data">-50°</span>
                  <span className="text-primary dark:text-primary">深冰</span>
                </div>
              </div>
              
              {/* Thermometer */}
              <div className="relative h-full w-8 ml-20">
                {/* Thermometer background */}
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: 'linear-gradient(180deg, #991b1b 0%, #ef4444 20%, #f97316 35%, #eab308 50%, #22c55e 65%, #3b82f6 80%, #1e40af 100%)',
                  }}
                />
                {/* Pointer */}
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-10 h-1 bg-surface rounded-sm z-10 shadow-[0_0_8px_rgba(255,255,255,0.6)] transition-all duration-500"
                  style={{ top: `${100 - tempPercent}%` }}
                >
                  {/* 温度数值显示 */}
                  <span className="absolute left-full ml-2 -translate-y-1/2 text-[15px] font-extrabold text-primary whitespace-nowrap font-data">
                    {data.temperature.label}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right 3/4: Chart + Description */}
          <div className="w-3/4 flex flex-col">
            {/* 近两周涨跌停 & 情绪温度 */}
            <div className="mb-4">
              <div className="text-[15px] dark:text-text-secondary text-text-secondary font-semibold mb-3">近两周涨跌停 & 情绪温度</div>
              <LimitsChart data={data.charts} />
            </div>

            {/* 市场解读 */}
            <div
              className={`rounded-xl p-4 flex gap-3 ${
                data.temperature.tipClass === 'tip-warm'
                  ? 'bg-gradient-to-br from-amber-50 to-orange-50 dark:from-warning/20 dark:to-background border border-amber-200/50 dark:border-warning/25'
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-primary/20 dark:to-background border border-blue-200/50 dark:border-primary/25'
              }`}
            >
              <div className="text-2xl shrink-0 leading-snug">{data.temperature.tipIcon}</div>
              <div
                className="text-[13px] text-text-primary dark:text-text-secondary leading-relaxed [&_b]:text-warning dark:[&_b]:text-text-primary [&_b]:font-semibold"
                dangerouslySetInnerHTML={{ __html: data.temperature.tipHtml }}
              />
            </div>
          </div>
        </div>

        {/* 市场指标卡片 + 免责声明 */}
        <div className="mt-6 bg-[#f0f4ff] dark:bg-[#1a1a2e] rounded-xl p-6">
          <div className="grid grid-cols-5 gap-4 text-center">
            <div>
              <div className="text-sm text-[#666] dark:text-[#999] mb-1">涨停家数</div>
              <div className="text-3xl font-bold text-[#dc2626]">{data.summary?.limitUp ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-[#666] dark:text-[#999] mb-1">跌停家数</div>
              <div className="text-3xl font-bold text-[#16a34a]">{data.summary?.limitDown ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-[#666] dark:text-[#999] mb-1">上涨家数</div>
              <div className="text-3xl font-bold text-[#f59e0b]">{data.summary?.advance ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-[#666] dark:text-[#999] mb-1">下跌家数</div>
              <div className="text-3xl font-bold text-[#3b82f6]">{data.summary?.decline ?? 0}</div>
            </div>
            <div>
              <div className="text-sm text-[#666] dark:text-[#999] mb-1">成交量</div>
              <div className="text-3xl font-bold text-[#3b82f6]">{data.summary?.turnover ? `${(data.summary.turnover / 10000).toFixed(1)}万亿` : '—'}</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
