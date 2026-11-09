'use client';

import { useState } from 'react';
import type { MarketData } from '@/lib/types';

interface LimitUpTableProps {
  marketData?: MarketData;
}

export function LimitUpTable({ marketData }: LimitUpTableProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  // 从 MarketData 获取涨停个股列表
  const data = marketData?.limitUpStocks ?? [];

  if (data.length === 0) {
    return null;
  }

  // 按行业分组
  const groupedData = data.reduce((acc, item) => {
    const key = item.industry || '其他';
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, typeof data>);

  // 获取所有行业（按出现顺序）
  const allIndustries = Object.keys(groupedData);

  // 获取连板层级颜色
  const getConsecutiveColor = (days: number) => {
    if (days >= 5) return 'text-danger'; // 5板以上红色
    if (days >= 3) return 'text-warning'; // 3-4板金色
    return 'text-primary'; // 2板蓝色
  };

  // 获取行业列表
  const industryList = Object.keys(groupedData);

  // 日期格式化 (YYYYMMDD -> MM-DD)
  const formatDate = (dateStr: string) => {
    if (dateStr.length === 8) {
      return `${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
    return dateStr;
  };

  return (
    <div className="mt-4">
      {/* 折叠按钮 */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full text-sm text-primary hover:text-primary transition-colors flex items-center justify-center gap-1 py-2 border border-primary/20 rounded-lg hover:bg-primary/20/30 mb-4"
      >
        {isExpanded ? '收起涨停表' : '展开涨停表'}
        <svg className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* 展开内容 */}
      {isExpanded && (
        <div>
          {/* 标题 */}
          <div className="text-sm font-semibold text-text-primary mb-3">
            涨停热点分布图
          </div>

          {/* 表格 */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-surface/50">
                  <th className="border border-border px-3 py-2 text-text-secondary font-medium text-center min-w-[80px]">
                    行业
                  </th>
                  <th className="border border-border px-3 py-2 text-text-secondary font-medium text-center min-w-[100px]">
                    股票数量
                  </th>
                  <th className="border border-border px-3 py-2 text-text-secondary font-medium text-center min-w-[100px]">
                    代表个股
                  </th>
                </tr>
              </thead>
              <tbody>
                {industryList.map((industry) => {
                  const stocks = groupedData[industry];
                  return (
                    <tr key={industry}>
                      <td className="border border-border px-3 py-2 text-center font-bold sticky left-0 bg-background text-primary">
                        {industry}
                      </td>
                      <td className="border border-border px-3 py-2 text-center text-text-secondary">
                        {stocks.length}
                      </td>
                      <td className="border border-border px-3 py-2 text-center">
                        <span className="text-text-secondary">{stocks.slice(0, 3).map(s => s.name).join('、')}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* 说明文字 */}
          <div className="text-xs text-text-muted mt-3">
            市场情绪看连板高度，板块热点看涨停家数（从左至右，从上到下涨停时间先后排序，黄色字体为强势股）
          </div>
        </div>
      )}
    </div>
  );
}
