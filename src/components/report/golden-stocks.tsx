"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MarketData } from '@/lib/types';

interface GoldenStocksSectionProps {
  marketData?: MarketData;
}

export function GoldenStocksSection({ marketData }: GoldenStocksSectionProps) {
  // 从 MarketData 获取金股数据
  const data = marketData?.goldenStocks ?? null;

  if (!data || (!data.mostWatched.length && !data.topGainers.length)) {
    return (
      <div className="text-center py-8 text-sm text-text-secondary">
        暂无金股数据
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* 券商关注最多 */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <span className="w-1 h-4 bg-primary rounded-full"></span>
            券商关注最多
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.mostWatched.map((stock, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-5">{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {stock.name}
                      <span className="text-xs text-text-muted ml-1">{stock.code}</span>
                    </div>
                    <div className="text-xs text-text-muted">{stock.broker}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-text-muted">{stock.count}家推荐</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 涨幅最多 */}
      <Card className="bg-surface border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-text-secondary flex items-center gap-2">
            <span className="w-1 h-4 bg-danger rounded-full"></span>
            涨幅最多
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.topGainers.map((stock, i) => (
              <div
                key={i}
                className="flex items-center justify-between py-1.5 border-b border-border last:border-0"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted w-5">{i + 1}</span>
                  <div>
                    <div className="text-sm font-medium text-text-primary">
                      {stock.name}
                      <span className="text-xs text-text-muted ml-1">{stock.code}</span>
                    </div>
                    <div className="text-xs text-text-muted">{stock.broker}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`text-sm font-medium font-data ${
                      stock.change >= 0 ? "text-danger" : "text-success"
                    }`}
                  >
                    {stock.change >= 0 ? "+" : ""}
                    {stock.change.toFixed(2)}%
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* 更新时间 */}
      <div className="col-span-1 md:col-span-2 text-center text-xs text-text-muted">
        数据更新时间：{marketData?.updateTime || "暂无"} | 数据来源：财联社
      </div>
    </div>
  );
}
