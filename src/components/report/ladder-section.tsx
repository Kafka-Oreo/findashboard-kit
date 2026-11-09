'use client';

import { useState, useEffect, useMemo } from 'react';
import type { ReportData } from '@/lib/types';
import { LadderChart } from './charts';

interface LadderSectionProps {
  data: ReportData;
  onOpenStockModal: (stockName: string, stockCode?: string) => void;
}

export function LadderSection({ data, onOpenStockModal }: LadderSectionProps) {
  const [showTable, setShowTable] = useState(false);
  const [ladderQuotes, setLadderQuotes] = useState<Record<string, { price?: number; change_pct?: number }>>({});
  const [ladderQuotesLoading, setLadderQuotesLoading] = useState(false);

  // 解析连板高度
  const parseHeight = (h: string): number => {
    if (h === '首板' || h === '1板' || h === '一板') return 1;
    const n = parseInt(h);
    return isNaN(n) ? 1 : n;
  };

  const realMaxBoard = useMemo(
    () => data.ladder.length > 0 ? Math.max(...data.ladder.map(item => parseHeight(item.height))) : 1,
    [data.ladder]
  );
  const displayMaxBoard = Math.max(realMaxBoard, 1);

  // 取最高连板的个股
  const topStock = useMemo(
    () => data.ladder.length > 0
      ? data.ladder.reduce((top, item) => parseHeight(item.height) > parseHeight(top.height) ? item : top).stock
      : '',
    [data.ladder]
  );

  // 情绪文案
  const { emotionDesc } = useMemo(() => {
    const limitUp = data.summary?.limitUp ?? 0;
    const sealRate = data.summary?.limitUpRate ?? 0;
    let desc = '';
    if (realMaxBoard >= 7 && limitUp > 80 && sealRate >= 70) {
      desc = '市场情绪过热，高位股风险加大';
    } else if (realMaxBoard >= 5 && limitUp > 60 && sealRate >= 60) {
      desc = '连板高度适中，短线情绪活跃';
    } else if (realMaxBoard >= 4 && limitUp > 50 && sealRate >= 55) {
      desc = '情绪偏强，梯队结构尚可';
    } else if (realMaxBoard >= 3 && limitUp > 40) {
      desc = '情绪中性分歧，梯队结构一般';
    } else if (limitUp >= 30 && sealRate >= 50) {
      desc = `当前最高连板${realMaxBoard}板，情绪偏弱，高位连板断档，跌停数量较多，注意风险，重点关注连板梯队完整性及晋级率变化。`;
    } else if (limitUp < 30) {
      desc = '市场接力情绪低迷，涨停家数稀少，做多意愿偏弱';
    } else {
      desc = '市场接力情绪低迷，高位连板全部断档，做多接力意愿偏弱';
    }
    return { emotionDesc: desc };
  }, [realMaxBoard, data.summary]);

  // 构建连板表格数据 + 股票代码映射
  const { ladderByHeight, stockCodeMap, sectors, hasTableData, allTableStockNames } = useMemo(() => {
    const ladderByHeight: Record<number, Record<number, string>> = {};
    const stockCodeMap: Record<string, string> = {};
    const sectors = data.sectorDistribution?.sectors ?? [];
    const allTableStockNames: string[] = [];

    if (data.sectorDistribution?.rows) {
      data.sectorDistribution.rows.forEach(row => {
        const h = parseHeight(row.height);
        ladderByHeight[h] = {};
        if (row.stockCodes) {
          Object.entries(row.stockCodes).forEach(([name, code]) => {
            if (code) stockCodeMap[name] = code;
          });
        }
        row.stocks.forEach((stock, idx) => {
          if (!stock) return;
          ladderByHeight[h][idx] = stock;
          if (row.stockCodes?.[stock]) stockCodeMap[stock] = row.stockCodes[stock];
          // 收集所有股票名（拆分多只）
          stock.split(/[、,，]/).forEach(n => {
            const trimmed = n.trim();
            if (trimmed) allTableStockNames.push(trimmed);
          });
        });
      });
    }

    // 首板行从 ladder 中按 sector 补充
    if (!ladderByHeight[1]) ladderByHeight[1] = {};
    data.ladder.forEach(item => {
      const h = parseHeight(item.height);
      if (h === 1) {
        const sectorIdx = sectors.findIndex(s => {
          const sShort = s.split('/')[0];
          return item.sector?.includes(sShort) || s.includes(item.sector?.split('/')[0] ?? '');
        });
        if (sectorIdx >= 0 && !ladderByHeight[1][sectorIdx]) {
          ladderByHeight[1][sectorIdx] = item.stock;
        }
      }
    });

    // 去重：每只股票只在最高连板那一行显示
    const allHeights = Object.keys(ladderByHeight).map(Number).sort((a, b) => b - a);
    const seenStocks = new Set<string>();
    allHeights.forEach(h => {
      const row = ladderByHeight[h];
      Object.keys(row).forEach(colIdx => {
        const stock = row[Number(colIdx)];
        if (stock) {
          if (seenStocks.has(stock)) {
            delete row[Number(colIdx)];
          } else {
            seenStocks.add(stock);
          }
        }
      });
    });

    const hasTableData = Object.values(ladderByHeight).some((row) =>
      Object.values(row).some((s) => s && s.trim().length > 0)
    );

    return { ladderByHeight, stockCodeMap, sectors, hasTableData, allTableStockNames };
  }, [data.ladder, data.sectorDistribution]);

  // 展开连板表时加载个股实时行情
  useEffect(() => {
    if (!showTable || allTableStockNames.length === 0) return;
    const uniqueNames = Array.from(new Set(allTableStockNames));
    if (uniqueNames.length === 0) return;
    setLadderQuotesLoading(true);
    fetch(`/api/stock-quote/realtime?names=${encodeURIComponent(uniqueNames.join(','))}`)
      .then(r => r.json())
      .then(res => {
        if (res?.byName) {
          const quotes: Record<string, { price?: number; change_pct?: number }> = {};
          for (const [name, q] of Object.entries(res.byName)) {
            const qq = q as { price?: number; change_pct?: number };
            quotes[name] = { price: qq.price, change_pct: qq.change_pct };
          }
          setLadderQuotes(quotes);
        }
      })
      .catch(() => {
        // 加载失败静默
      })
      .finally(() => setLadderQuotesLoading(false));
  }, [showTable, data.date, allTableStockNames]);

  // 渲染股票单元格（支持多只股票，带行情）
  const renderStockCell = (stockText: string, h: number) => {
    const names = stockText.split(/[、,，]/).map(s => s.trim()).filter(Boolean);
    return (
      <div className="flex flex-col gap-0.5">
        {names.map((name, ni) => {
          const quote = ladderQuotes[name];
          const isTop = name === topStock && h === realMaxBoard;
          const changePct = quote?.change_pct;
          const quoteColor = changePct !== undefined
            ? (changePct >= 0 ? '#dc2626' : '#16a34a')
            : undefined;
          return (
            <button
              key={ni}
              type="button"
              onClick={() => onOpenStockModal(name, stockCodeMap[name])}
              className="w-full text-center transition-opacity hover:opacity-70 cursor-pointer leading-tight"
            >
              <span
                style={{
                  color: isTop ? '#eab308' : 'var(--text-primary)',
                  fontWeight: isTop ? 'bold' : 'normal',
                  fontSize: '10px',
                }}
              >
                {name}
              </span>
              {quote && changePct !== undefined && (
                <span
                  className="block font-data"
                  style={{
                    color: quoteColor,
                    fontSize: '9px',
                    fontWeight: 500,
                    marginTop: '1px',
                  }}
                >
                  {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                </span>
              )}
              {ladderQuotesLoading && !quote && (
                <span
                  className="block"
                  style={{
                    color: 'var(--text-muted)',
                    fontSize: '8px',
                    marginTop: '1px',
                    opacity: 0.6,
                  }}
                >
                  ...
                </span>
              )}
            </button>
          );
        })}
      </div>
    );
  };

  if (!data || !data.ladder) {
    return (
      <div className="dark:bg-card-content bg-card-content dark:border-border border-border rounded-[16px] p-6 glass-card">
        <div className="text-[17px] dark:text-text-secondary text-text-secondary font-semibold mb-4 flex items-center gap-2">
          <span className="inline-block w-1 h-4 bg-warning rounded-sm" />
          短线情绪·连板高标梯队
        </div>
        <div className="text-[13px] dark:text-text-muted text-text-secondary py-8 text-center">连板梯队数据加载失败，请刷新重试</div>
      </div>
    );
  }

  return (
    <div className="dark:bg-card-content bg-card-content dark:border-border border-border rounded-[16px] p-6 glass-card">
      <div className="text-[17px] dark:text-text-secondary text-text-secondary font-semibold mb-4 flex items-center gap-2">
        <span className="inline-block w-1 h-4 bg-warning rounded-sm" />
        短线情绪·连板高标梯队
      </div>

      {/* Chart */}
      <div className="mb-3">
        {data.charts?.ladderHistory ? (
          <LadderChart data={data.charts} />
        ) : (
          <div className="text-xs dark:text-text-muted text-text-secondary py-8 text-center">暂无近一周连板高度历史数据</div>
        )}
      </div>

      {/* Text Description */}
      <div className="text-xs dark:text-white text-[#1d1d1f] mb-3 leading-relaxed">
        当前最高连板 <span className="text-warning font-bold font-data">{realMaxBoard}板</span>（{topStock}），
        {emotionDesc}。
        建议关注连板梯队完整性及晋级率变化。
      </div>

      {/* 连板表格 - 有数据时显示展开按钮 */}
      {hasTableData ? (
        <button
          onClick={() => setShowTable(!showTable)}
          className="w-full text-xs text-primary hover:text-primary transition-colors flex items-center justify-center gap-1 py-1.5 border border-primary/20 rounded-lg hover:bg-primary/20/30"
        >
          {showTable ? '收起连板表 ∧' : '展开连板表 ∨'}
        </button>
      ) : (
        <div className="w-full text-xs text-center py-3 border border-dashed rounded-lg" style={{ color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
          涨停池接口受限，本地脚本可获取完整个股
        </div>
      )}

      {/* Expandable Table - 涨停热点分布图 */}
      {showTable && hasTableData && data.sectorDistribution && (
        <div className="mt-3 overflow-x-auto">
          <div className="text-[11px] mb-2 font-semibold" style={{ color: 'var(--text-primary)' }}>{data.date.slice(5).replace('-', '-')} 涨停热点分布图</div>
          <table className="w-full text-[10px]" style={{ backgroundColor: 'var(--surface)', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th className="px-1.5 py-1 text-center font-medium sticky left-0 whitespace-nowrap" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>涨停连板高度</th>
                {sectors.map((sector, idx) => (
                  <th key={idx} className="px-1.5 py-1 text-center font-medium whitespace-nowrap" style={{ backgroundColor: 'var(--surface-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>{sector}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: displayMaxBoard }, (_, idx) => {
                const h = displayMaxBoard - idx;
                const rowData = ladderByHeight[h] || {};
                const hasStock = Object.values(rowData).some(s => s && s.trim() !== '');
                if (!hasStock) return null;
                const heightLabel = h === 1 ? '首板' : `${h}连板`;
                return (
                  <tr key={h}>
                    <td className="px-1.5 py-1 text-center font-bold sticky left-0" style={{ color: '#eab308', backgroundColor: 'var(--surface)', border: '1px solid var(--border)' }}>
                      {heightLabel}
                    </td>
                    {sectors.map((sector, colIdx) => {
                      const stock = rowData[colIdx] || null;
                      return (
                        <td key={colIdx} className="px-1 py-1.5 text-center align-top" style={{ backgroundColor: 'var(--surface)', border: '1px solid var(--border)', minHeight: '24px' }}>
                          {stock ? renderStockCell(stock, h) : null}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="text-[9px] mt-2 text-black dark:text-white">
            市场情绪看连板高度，题材热点看涨停家数（从左至右，从上到下涨停时间先后排序，黄色字体为强势股）
          </div>
        </div>
      )}
    </div>
  );
}
