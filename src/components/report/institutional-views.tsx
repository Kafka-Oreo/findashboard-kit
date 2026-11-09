'use client';

import { useEffect, useState } from 'react';
import type { ReportData } from '@/lib/types';
import { IndustryChainQA } from './industry-chain-qa';

interface GoldenStock {
  code: string;
  name: string;
  price: number;
  change: number;
  industry: string;
  recommendCount: number;
  institutions: string[];
  targetPrice?: number;
}

interface IndustryDetail {
  code: string;
  name: string;
  rating: string;
  org: string;
  title: string;
  date: string;
  count: number;
}

interface Props {
  data: ReportData;
}

export function InstitutionalViews({ data }: Props) {
  const [goldenStocks, setGoldenStocks] = useState<GoldenStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIndustry, setSelectedIndustry] = useState<string | null>(null);
  const [industryDetails, setIndustryDetails] = useState<Record<string, IndustryDetail[]>>({});

  useEffect(() => {
    const fetchGoldenStocks = async () => {
      try {
        const res = await fetch('/api/golden-stocks');
        const json = await res.json();
        if (json.data) {
          setGoldenStocks(json.data);
        }
      } catch (error) {
        console.error('Failed to fetch golden stocks:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchGoldenStocks();
  }, []);

  // 点击条形图时加载该行业的研报明细
  const handleIndustryClick = async (industryName: string) => {
    if (selectedIndustry === industryName) {
      setSelectedIndustry(null);
      return;
    }
    setSelectedIndustry(industryName);

    // 如果已有缓存数据，直接显示
    if (industryDetails[industryName]) {
      return;
    }

    try {
      const res = await fetch(`/api/industry-ratings?industry=${encodeURIComponent(industryName)}&date=${encodeURIComponent(data.date)}`);
      const json = await res.json();
      if (json.success && json.data) {
        // 转换格式：后端字段名 org/title → 前端使用 institution/title
        const mapped = json.data.map((item: {
          code: string; name: string; rating: string; org: string; analyst: string; title: string; date: string; count: number;
        }) => ({
          code: item.code,
          name: item.name,
          rating: item.rating,
          org: item.org,
          title: item.title,
          date: item.date,
          count: item.count || 1,
        }));
        setIndustryDetails(prev => ({ ...prev, [industryName]: mapped }));
      } else {
        setIndustryDetails(prev => ({ ...prev, [industryName]: [] }));
      }
    } catch (error) {
      console.error('Failed to fetch industry details:', error);
      setIndustryDetails(prev => ({ ...prev, [industryName]: [] }));
    }
  };

  if (!data.institutional) return null;

  const { industryFocus, summary } = data.institutional;

  // 按推荐次数排序
  const mostRecommended = [...goldenStocks]
    .sort((a, b) => b.recommendCount - a.recommendCount)
    .slice(0, 5);

  // 按涨幅排序
  const topGainers = [...goldenStocks]
    .sort((a, b) => b.change - a.change)
    .slice(0, 5);

  // 按行业统计
  const industryStats: Record<string, { count: number; stocks: string[] }> = {};
  goldenStocks.forEach(stock => {
    if (!industryStats[stock.industry]) {
      industryStats[stock.industry] = { count: 0, stocks: [] };
    }
    industryStats[stock.industry].count++;
    industryStats[stock.industry].stocks.push(stock.name);
  });

  const topIndustries = Object.entries(industryStats)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5);

  return (
    <div className="space-y-3">
      {/* 行业关注度 */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-2.5">
          <div className="text-[15px] text-text-secondary font-semibold flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-amber-500 rounded-sm" />
            行业关注度 · 机构聚焦方向
          </div>
          <IndustryChainQA showPersonaSwitch={false} />
        </div>
        <div className="grid grid-cols-1 gap-2">
          {industryFocus.slice(0, 10).map((ind, i) => {
            const maxAttention = industryFocus[0]?.attention || 1;
            const percent = (ind.attention / maxAttention) * 100;
            const isSelected = selectedIndustry === ind.name;
            return (
              <div key={i}>
                <div
                  className="flex items-center gap-2 cursor-pointer hover:bg-surface-secondary/50 rounded px-1 py-0.5 transition-colors"
                  onClick={() => handleIndustryClick(ind.name)}
                >
                  <div className="w-20 text-[11px] text-primary truncate">{ind.name}</div>
                  <div className="flex-1 h-4 bg-surface rounded-sm overflow-hidden relative">
                    <div
                      className="h-full rounded-sm transition-all duration-500"
                      style={{
                        width: `${percent}%`,
                        background: `linear-gradient(90deg, #f59e0b ${percent}%, #1e293b ${percent}%)`
                      }}
                    />
                    <div className="absolute inset-0 flex items-center px-2">
                      <span className="text-[10px] text-primary font-medium">关注度 {ind.attention}</span>
                    </div>
                  </div>
                  <div className="w-20 text-right text-[10px] text-primary font-medium shrink-0">
                    买入{ind.buyRating} / 增持{ind.increaseRating}
                  </div>
                </div>
                {/* 点击展开的研报明细 */}
                {isSelected && (
                  <div className="ml-20 mt-1 mb-1 bg-surface-secondary/30 rounded p-2">
                    {industryDetails[ind.name] ? (
                      industryDetails[ind.name].length > 0 ? (
                        <div className="space-y-1">
                          <div className="text-[10px] text-text-muted mb-1">
                            共 {industryDetails[ind.name].length} 条研报 · 买入{ind.buyRating} 增持{ind.increaseRating}
                          </div>
                          {industryDetails[ind.name].slice(0, 8).map((item, j) => (
                            <div key={j} className="flex items-center gap-2 text-[10px]">
                              <span className="text-primary font-medium w-16 truncate">{item.name}</span>
                              <span className={`px-1 rounded text-[9px] ${
                                item.rating === '买入' ? 'bg-red-500/20 text-red-400' :
                                item.rating === '增持' ? 'bg-amber-500/20 text-amber-400' :
                                'bg-gray-500/20 text-gray-400'
                              }`}>{item.rating}</span>
                              <span className="text-text-secondary truncate flex-1">{item.title || item.org}</span>
                              <span className="text-text-muted shrink-0">{item.org}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-[10px] text-text-muted">当日暂无该行业新发布研报</div>
                      )
                    ) : (
                      <div className="text-[10px] text-text-muted">加载中...</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div className="text-[10px] text-text-muted mt-3">数据来源：东方财富、财联社</div>
      </div>

      {/* 财联社月度金股 */}
      {!loading && goldenStocks.length > 0 && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-[13px] text-text-secondary font-semibold mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-red-500 rounded-sm" />
            财联社月度金股 · 机构精选
          </div>

          {/* 券商关注最多 */}
          <div className="mb-3">
            <div className="text-[11px] text-text-muted mb-1.5 flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              券商关注最多
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {mostRecommended.map((stock, i) => (
                <div
                  key={i}
                  className="bg-surface rounded px-2 py-1.5 text-center hover:bg-surface-secondary transition-colors"
                >
                  <div className="text-[11px] text-primary font-medium truncate">{stock.name}</div>
                  <div className="text-[10px] text-text-muted">{stock.recommendCount}家推荐</div>
                </div>
              ))}
            </div>
          </div>

          {/* 涨幅最多 */}
          <div className="mb-3">
            <div className="text-[11px] text-text-muted mb-1.5 flex items-center gap-1">
              <svg className="w-3 h-3 text-red-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.06l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.54-4.849l-3.022.81a.75.75 0 01-.388-1.449z" clipRule="evenodd" />
              </svg>
              涨幅最多
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {topGainers.map((stock, i) => (
                <div
                  key={i}
                  className="bg-surface rounded px-2 py-1.5 text-center hover:bg-surface-secondary transition-colors"
                >
                  <div className="text-[11px] text-primary font-medium truncate">{stock.name}</div>
                  <div className="text-[10px] text-red-500 font-data">+{stock.change.toFixed(1)}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* 热门行业 */}
          <div>
            <div className="text-[11px] text-text-muted mb-1.5 flex items-center gap-1">
              <svg className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M4.25 2A2.25 2.25 0 002 4.25v2.5A2.25 2.25 0 004.25 9h2.5A2.25 2.25 0 009 6.75v-2.5A2.25 2.25 0 006.75 2h-2.5zm0 9A2.25 2.25 0 002 13.25v2.5A2.25 2.25 0 004.25 18h2.5A2.25 2.25 0 009 15.75v-2.5A2.25 2.25 0 006.75 11h-2.5zm9-9A2.25 2.25 0 0011 4.25v2.5A2.25 2.25 0 0013.25 9h2.5A2.25 2.25 0 0018 6.75v-2.5A2.25 2.25 0 0015.75 2h-2.5zm0 9A2.25 2.25 0 0011 13.25v2.5A2.25 2.25 0 0013.25 18h2.5A2.25 2.25 0 0018 15.75v-2.5A2.25 2.25 0 0015.75 11h-2.5z" clipRule="evenodd" />
              </svg>
              热门行业
            </div>
            <div className="flex flex-wrap gap-1.5">
              {topIndustries.map(([industry, stats], i) => (
                <div
                  key={i}
                  className="bg-surface rounded px-2 py-1 text-[10px] text-text-secondary hover:bg-surface-secondary transition-colors"
                >
                  <span className="text-primary font-medium">{industry}</span>
                  <span className="ml-1">({stats.count}只)</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 机构推荐 · 最新投资评级 */}
      {summary && (
        <div className="bg-surface border border-border rounded-lg p-5">
          <div className="text-[15px] text-text-secondary font-semibold mb-2 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-blue-500 rounded-sm" />
            机构推荐 · 最新投资评级
          </div>
          <div className="text-[12px] text-text-secondary leading-relaxed">
            {summary}
          </div>
          {goldenStocks.length > 0 && (
            <div className="mt-2 pt-2 border-t border-border text-[11px] text-text-muted">
              数据来源：财联社月度金股 · 共{goldenStocks.length}只金股
            </div>
          )}

          <div className="mt-2 pt-2 border-t border-border text-[10px] text-text-muted leading-relaxed">
            <span className="font-semibold text-text-secondary">免责声明：</span>
            以上数据汇总财联社月度标的统计、券商研报覆盖频次排行、阶段区间涨跌幅统计数据，仅做客观数据陈列，不构成任何投资参考。投资有风险，入市需谨慎。
          </div>
        </div>
      )}
    </div>
  );
}
