'use client';

import { useState, useEffect } from 'react';
import type { MarketData, ReportData } from '@/lib/types';
import { calcBiasStar, calcSectorStarWithCorr } from '@/lib/bias-star';
import { isTradingDay } from '@/lib/utils';

interface Props {
  marketData: MarketData;
  data?: ReportData;
  section?: 'sectors' | 'index' | 'intraday';
}

export function PageAnalysis({ marketData, data, section }: Props) {
  const [showAllSectors, setShowAllSectors] = useState(false);
  const [sectorBiasList, setSectorBiasList] = useState<{ name: string; bias: number; correlation?: number }[] | null>(null);
  const [sectorBiasLoading, setSectorBiasLoading] = useState(true);
  const [sectorBiasError, setSectorBiasError] = useState(false);
  const [isShenwanEquivalent, setIsShenwanEquivalent] = useState(false);
  const [benchmarkName, setBenchmarkName] = useState('万得全A');

  // 判断是否为交易日（非交易日不渲染异常信号板块）
  // 仅使用日报静态日期判断，避免在渲染期间读取当前时间（purity 规则）
  const reportDate = typeof data?.date === 'string' ? data.date : '';
  const isTrading = reportDate ? isTradingDay(reportDate) : true;

  // 从API获取真实板块60日BIAS数据
  useEffect(() => {
    // 北京时间（UTC+8）日期，避免凌晨 UTC 切片错标前一天
    const dateStr = data?.date || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let cancelled = false;

    setSectorBiasLoading(true);
    setSectorBiasError(false);

    fetch(`/api/sector-bias?date=${dateStr}`)
      .then(res => res.json())
      .then(res => {
        if (cancelled) return;
        if (res.success && res.data && Array.isArray(res.data)) {
          // 按BIAS绝对值从大到小排序（偏离程度优先）
          const sorted = [...res.data].sort((a: { bias: number }, b: { bias: number }) => Math.abs(b.bias) - Math.abs(a.bias));
          setSectorBiasList(sorted);
          setIsShenwanEquivalent(!!res.isShenwanEquivalent);
          if (res.benchmark) setBenchmarkName(res.benchmark);
        } else {
          setSectorBiasError(true);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setSectorBiasError(true);
      })
      .finally(() => {
        if (!cancelled) setSectorBiasLoading(false);
      });

    return () => { cancelled = true; };
  }, [data?.date]);

  // 异常信号板块渲染内容（三态：加载/错误/正常）
  // UI结构、样式、文案完全保持原有格式，仅替换数据来源和星级计算方式
  let sectorBiasContent: React.ReactNode;
  if (!isTrading) {
    // 非交易日不执行本模块渲染
    sectorBiasContent = (
      <div className="text-[10px] text-text-muted py-3 text-center">非交易日，不展示异常信号板块</div>
    );
  } else if (sectorBiasLoading) {
    sectorBiasContent = (
      <div className="text-[10px] text-text-muted py-3 text-center">数据加载中...</div>
    );
  } else if (sectorBiasError || !sectorBiasList || sectorBiasList.length === 0) {
    sectorBiasContent = (
      <div className="text-[10px] text-warning py-3 text-center">⚠️ 数据源异常，暂不展示异常信号板块</div>
    );
  } else {
    const sortedList = [...sectorBiasList].sort((a, b) => Math.abs(b.bias) - Math.abs(a.bias));
    sectorBiasContent = (
      <div>
        {/* 表格表头 */}
        <div className="grid grid-cols-3 text-[9px] text-text-muted pb-1 border-b border-border/40">
          <div>板块名称</div>
          <div className="text-center">BIAS(%)</div>
          <div className="text-right">星级</div>
        </div>
        <div className="space-y-1 mt-1">
          {sortedList.slice(0, showAllSectors ? undefined : 3).map((sector, i) => {
            const bias = sector.bias;
            const { stars: starRating } = calcSectorStarWithCorr(bias, sector.correlation);
            const stars = '★'.repeat(starRating);
            const isUp = bias > 0;
            return (
              <div key={i} className="grid grid-cols-3 items-center text-[10px] py-0.5">
                <span className="text-text-secondary truncate pr-1">{sector.name}</span>
                <span className={`text-center font-mono font-medium ${
                  isUp ? 'text-up' : bias < 0 ? 'text-down' : 'text-text-secondary'
                }`}>
                  {isUp ? '+' : ''}{bias.toFixed(2)}%
                </span>
                <span className="text-right text-warning tracking-wide">
                  {stars || <span className="text-text-weak">—</span>}
                </span>
              </div>
            );
          })}
        </div>
        {sortedList.length > 3 && (
          <button
            className="w-full mt-2 text-[9px] text-text-muted hover:text-accent transition-colors"
            onClick={(e) => { e.stopPropagation(); setShowAllSectors(!showAllSectors); }}
          >
            {showAllSectors ? '收起 ▲' : `展开全部 ${sortedList.length} 个 ▼`}
          </button>
        )}
        <div className="mt-2 text-[8px] text-text-muted leading-relaxed">
          {isShenwanEquivalent ? (
            <>
              {benchmarkName}基准（申万等效替代）：+30%/+50%/+100% 卖出预警 · -20% 买入预警<br/>
              行业实际阈值 = 基准阈值 × 行业-{benchmarkName} 60日皮尔逊相关系数<br/>
              <span className="text-text-weak">基准为申万等效替代，非原生万得全A · 仅实心金色五角星</span>
            </>
          ) : (
            <>
              {benchmarkName}基准：+30%/+50%/+100% 卖出预警 · -20% 买入预警<br/>
              行业实际阈值 = 基准阈值 × 行业-{benchmarkName} 60日皮尔逊相关系数 · 仅实心金色五角星
            </>
          )}
        </div>
      </div>
    );
  }

  if (section === 'sectors') {
    return (
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="text-[13px] text-text-secondary font-semibold mb-2.5 flex items-center gap-1.5">
          <span className="inline-block w-1 h-3 bg-danger rounded-sm" />
          板块异动 · 潜在风险与机会
        </div>
        {marketData.abnormalSectors && marketData.abnormalSectors.length > 0 ? (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr>
                <th className="text-left text-text-muted text-[10px] uppercase tracking-wider py-1.5 px-2 border-b border-border">板块</th>
                <th className="text-left text-text-muted text-[10px] uppercase tracking-wider py-1.5 px-2 border-b border-border">异动</th>
              </tr>
            </thead>
            <tbody>
              {marketData.abnormalSectors.map((a, i) => (
                <tr key={i}>
                  <td className="py-1.5 px-2 border-b border-border/40 text-text-secondary">{a.name}</td>
                  <td className="py-1.5 px-2 border-b border-border/40 text-text-secondary">{a.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-xs text-text-muted py-4 text-center">暂无板块异动数据</div>
        )}
      </div>
    );
  }



  if (section === 'intraday') {
    return (
      <div className="grid grid-cols-2 gap-3">
        {/* 左：60日线乖离率 */}
        <div className="bg-surface border border-border rounded-lg p-4 flex flex-col">
          <div className="text-sm text-text-secondary font-semibold mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-warning rounded-sm" />
            60日线乖离率
          </div>
          
          {/* 星标注释 */}
          <div className="text-[8px] text-text-muted mb-2 leading-relaxed">
            万得全A 60日BIAS经验值：★25%-35% ★★45%-60% ★★★90%+ ｜ 宽基直接用原始阈值
          </div>

          {/* 四大指数乖离率（万得全A为基准） */}
          <div className="space-y-1.5">
            {/* 万得全A（基准指数，最醒目） */}
            {marketData.wandeMa60Deviation !== null && marketData.wandeMa60Deviation !== undefined && (() => {
              const biasValue = marketData.wandeMa60Deviation;
              const { stars: starRating } = calcBiasStar('万得全A', biasValue);
              const biasStars = '★'.repeat(starRating);
              const biasColor = biasValue >= 0 ? '#ef4444' : '#22c55e';
              return (
                <div className="flex items-center justify-between bg-accent/5 rounded px-1.5 py-0.5 -mx-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-warning">{biasStars}</span>
                    <span className="text-[10px] text-text-secondary font-semibold">万得全A</span>
                    <span className="text-[8px] text-text-muted bg-border/50 px-1 rounded">基准</span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color: biasColor }}>
                    {biasValue > 0 ? '+' : ''}{biasValue}%
                  </span>
                </div>
              );
            })()}
            {/* 上证指数 */}
            {marketData.shMa60Deviation !== null && (() => {
              const biasValue = marketData.shMa60Deviation;
              const { stars: starRating } = calcBiasStar('上证指数', biasValue);
              const biasStars = '★'.repeat(starRating);
              const biasColor = biasValue >= 0 ? '#ef4444' : '#22c55e';
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-warning">{biasStars}</span>
                    <span className="text-[10px] text-text-secondary">上证指数</span>
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: biasColor }}>
                    {biasValue > 0 ? '+' : ''}{biasValue}%
                  </span>
                </div>
              );
            })()}
            {/* 创业板指 */}
            {marketData.cybMa60Deviation !== null && (() => {
              const biasValue = marketData.cybMa60Deviation;
              const { stars: starRating } = calcBiasStar('创业板指', biasValue);
              const biasStars = '★'.repeat(starRating);
              const biasColor = biasValue >= 0 ? '#ef4444' : '#22c55e';
              return (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-warning">{biasStars}</span>
                    <span className="text-[10px] text-text-secondary">创业板指</span>
                  </div>
                  <span className="text-[10px] font-medium" style={{ color: biasColor }}>
                    {biasValue > 0 ? '+' : ''}{biasValue}%
                  </span>
                </div>
              );
            })()}
          {/* 宽基指数BIAS */}
          <div className="mb-3 pb-3 border-b border-border/40">
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-medium text-text-secondary">宽基60日BIAS</div>
              <div className="text-[9px] text-text-muted">超卖→↑ 超买→↓</div>
            </div>
            {/* 万得全A / 上证指数 */}
            {marketData.ma60Deviation !== null && (() => {
              const biasValue = marketData.ma60Deviation;
              const biasColor = biasValue >= 0 ? '#ef4444' : '#22c55e';
              return (
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-text-secondary">{benchmarkName}</span>
                  </div>
                  <span className="text-[10px] font-medium tabular-nums" style={{ color: biasColor }}>
                    {biasValue > 0 ? '+' : ''}{biasValue}%
                  </span>
                </div>
              );
            })()}
            {marketData.shMa60Deviation !== null && (() => {
              const biasValue = marketData.shMa60Deviation;
              const biasColor = biasValue >= 0 ? '#ef4444' : '#22c55e';
              return (
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-text-secondary">上证指数</span>
                  <span className="text-[10px] font-medium tabular-nums" style={{ color: biasColor }}>
                    {biasValue > 0 ? '+' : ''}{biasValue}%
                  </span>
                </div>
              );
            })()}
            {/* 创业板 */}
            {marketData.cybMa60Deviation !== null && (() => {
              const biasValue = marketData.cybMa60Deviation;
              const biasColor = biasValue >= 0 ? '#ef4444' : '#22c55e';
              return (
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-text-secondary">创业板指</span>
                  <span className="text-[10px] font-medium tabular-nums" style={{ color: biasColor }}>
                    {biasValue > 0 ? '+' : ''}{biasValue}%
                  </span>
                </div>
              );
            })()}
            {/* 科创50 */}
            {marketData.kcbMa60Deviation !== null && (() => {
              const biasValue = marketData.kcbMa60Deviation;
              const { stars: starRating } = calcBiasStar('科创50', biasValue);
              const biasStars = '★'.repeat(starRating);
              const biasColor = biasValue >= 0 ? '#ef4444' : '#22c55e';
              return (
                <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/30">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-warning">{biasStars}</span>
                    <span className="text-[10px] text-text-secondary">科创50</span>
                  </div>
                  <span className="text-[11px] font-semibold tabular-nums" style={{ color: biasColor }}>
                    {biasValue > 0 ? '+' : ''}{biasValue}%
                  </span>
                </div>
              );
            })()}
          </div>
          </div>

          {/* 异常信号板块 */}
          <div className="mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-[10px] text-text-muted">异常信号板块</div>
              <div className="text-[9px] text-text-muted">BIAS=(现价-60MA)/60MA</div>
            </div>
            {sectorBiasContent}
          </div>
        </div>

        {/* 右：后续关注催化 */}
        <div className="bg-surface border border-border rounded-lg p-4 flex flex-col">
          <div className="text-sm text-text-secondary font-semibold mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-green-500 rounded-sm" />
            后续关注催化
          </div>
          <div className="space-y-2.5 flex-1">
            {data?.followUp && data.followUp.length > 0 ? (
              data.followUp.slice(0, 6).map((item, i) => {
                const cleanItem = item.replace(/——| -/g, " ").trim();
                return (
                  <div key={i} className="flex gap-2 items-start">
                    <div className="flex-shrink-0 w-4 h-4 rounded-full bg-green-500/10 text-green-500 text-[9px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </div>
                    <div className="text-[11px] text-text-secondary leading-relaxed flex-1">
                      {cleanItem}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-[10px] text-text-muted py-2 text-center">暂无后续关注催化数据</div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Default: full page (fallback)
  return null;
}
