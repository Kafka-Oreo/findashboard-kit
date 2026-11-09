'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { GlobalMarketEvent } from '@/lib/types';

interface ClsHotspot {
  category: string;
  title: string;
  url?: string;
  source_url?: string;
  source: string;
  trend: string;
  attention: number;
  fire_count: number;
  pub_time: string;
  highlight?: string;
  summary?: string;
}

type GlobalEventsObject = {
  us_market?: Array<{ name: string; value: string; change: string }>;
  hk_market?: Array<{ name: string; value: string; change: string }>;
  commodities?: Array<{ name: string; value: string; change: string }>;
  related_news?: Array<{ title: string; source: string; url: string }>;
};

interface Props {
  globalEvents?: unknown;
  events?: GlobalMarketEvent[];
}

function isGlobalEventsObject(v: unknown): v is GlobalEventsObject {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

/** 关注度火焰（纯 SVG，橙黄渐变，造型贴近 🔥） */
function FireIcon({ className = 'h-[13px] w-[13px]' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="cls-fire-grad" x1="12" y1="20" x2="12" y2="2" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#FFD21F" />
          <stop offset="0.45" stopColor="#FF9E0B" />
          <stop offset="1" stopColor="#F5432B" />
        </linearGradient>
      </defs>
      <path
        fill="url(#cls-fire-grad)"
        d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"
      />
    </svg>
  );
}

/** 按数量渲染一排 SVG 火焰 */
function FireRow({ count, className }: { count: number; className?: string }) {
  return (
    <span className={`inline-flex items-center leading-none ${className ?? ''}`}>
      {Array.from({ length: count }).map((_, i) => (
        <FireIcon key={i} />
      ))}
    </span>
  );
}

export default function GlobalMarketEvents({ globalEvents }: Props) {
  const ge = isGlobalEventsObject(globalEvents) ? globalEvents : undefined;
  const [hotspots, setHotspots] = useState<ClsHotspot[] | null>(null);
  const [loading, setLoading] = useState(true);

  // 搜索相关
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ClsHotspot[] | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 初始加载热点
  useEffect(() => {
    const fetchHotspots = async () => {
      try {
        const res = await fetch('/api/cls-hotspots?limit=8');
        const data = await res.json();
        if (data.success) {
          setHotspots(data.data);
        } else {
          setHotspots(null);
        }
      } catch {
        setHotspots(null);
      } finally {
        setLoading(false);
      }
    };
    fetchHotspots();
  }, []);

  // 搜索（防抖）
  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);

    if (!query.trim()) {
      setIsSearchMode(false);
      setSearchResults(null);
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      return;
    }

    setIsSearchMode(true);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/cls-search?q=${encodeURIComponent(query)}&limit=15`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data || []);
        } else {
          setSearchResults([]);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 500);
  }, []);

  // 分类标签颜色
  const getCategoryColor = (category: string) => {
    const colorMap: Record<string, string> = {
      '央行': 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300',
      '政策': 'bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300',
      '宏观': 'bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300',
      '美股': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300',
      '欧洲': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
      '亚太': 'bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300',
      '汇率': 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
      '商品': 'bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300',
      '地缘': 'bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
      '科技': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
      '中概': 'bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300',
      '经贸': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
      '资金': 'bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300',
      '产业': 'bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300',
      '避雷': 'bg-red-100 text-red-600 dark:bg-red-950/40 dark:text-red-400',
      '资讯': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
    };
    return colorMap[category] || colorMap['资讯'];
  };

  // 渲染关注度（SVG 火焰，1-5 火，对应关注度 0-100）
  const renderAttention = (count: number) => {
    const score = count || 0;
    // 0-20=1火，21-40=2火，41-60=3火，61-80=4火，81-100=5火
    const fires = Math.max(1, Math.min(5, Math.ceil(score / 20)));
    return <FireRow count={fires} className="gap-[1px]" />;
  };

  // 渲染火热度（旧格式保留）
  const renderFireCount = (count: number) => {
    const actualCount = Math.max(1, Math.min(3, count || 1));
    return <FireRow count={actualCount} />;
  };

  // 标题截断
  const truncateTitle = (title: string, maxLen: number = 38) => {
    if (title.length <= maxLen) return title;
    return title.slice(0, maxLen) + '...';
  };

  return (
    <div className="space-y-4">
      {/* 美股、港股、商品指数展示（保留原有数据） */}
      {ge && (
        <>
          {ge.us_market && ge.us_market.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6] flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#6e6e73] dark:text-[#a1a1a6]" />
                美股市场
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {ge.us_market.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-[#86868b] dark:text-[#a1a1a6]">{item.name}</span>
                    <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{item.value}</span>
                    <span className={
                      item.change.startsWith('+')
                        ? 'text-[#dc2626]'
                        : item.change.startsWith('-')
                          ? 'text-[#16a34a]'
                          : 'text-[#86868b] dark:text-[#a1a1a6]'
                    }>{item.change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {ge.hk_market && ge.hk_market.length > 0 && (
            <div className="space-y-1">
              <div className="text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6] flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-[#6e6e73] dark:text-[#a1a1a6]" />
                港股市场
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs">
                {ge.hk_market.slice(0, 3).map((item, idx) => (
                  <div key={idx} className="flex flex-col">
                    <span className="text-[#86868b] dark:text-[#a1a1a6]">{item.name}</span>
                    <span className="text-[#1d1d1f] dark:text-[#f5f5f7] font-medium">{item.value}</span>
                    <span className={
                      item.change.startsWith('+')
                        ? 'text-[#dc2626]'
                        : item.change.startsWith('-')
                          ? 'text-[#16a34a]'
                          : 'text-[#86868b] dark:text-[#a1a1a6]'
                    }>{item.change}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* 财联社热点新闻 */}
      <div className="space-y-2">
        <div className="text-xs font-medium text-[#6e6e73] dark:text-[#a1a1a6] flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="w-1 h-1 rounded-full bg-[#0066cc] dark:bg-[#2997ff]" />
            最新动态 · 财联社
          </div>
          <span className="text-[10px] text-[#86868b] dark:text-[#71717A] font-normal">
            {isSearchMode ? `搜索 ${searchResults?.length ?? 0} 条` : '实时更新'}
          </span>
        </div>

        {/* 搜索框 */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="搜索财联社新闻..."
            className="w-full h-7 px-3 pr-7 text-xs bg-[#f5f5f7] dark:bg-[#1d1d1f]
                       border border-transparent rounded-full
                       text-[#1d1d1f] dark:text-[#f5f5f7]
                       placeholder:text-[#86868b] dark:placeholder:text-[#71717A]
                       focus:outline-none focus:border-[#0066cc] dark:focus:border-[#2997ff]
                       focus:bg-white dark:focus:bg-[#272729]
                       transition-all"
          />
          <svg
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#86868b] dark:text-[#71717A]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          {searchQuery && (
            <button
              onClick={() => handleSearch('')}
              className="absolute right-6 top-1/2 -translate-y-1/2 w-4 h-4
                         flex items-center justify-center
                         text-[#86868b] dark:text-[#71717A]
                         hover:text-[#1d1d1f] dark:hover:text-[#f5f5f7]
                         transition-colors"
              aria-label="清除搜索"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* 列表内容 */}
        {searchLoading ? (
          <div className="space-y-2 pt-1">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 dark:bg-[#272729] rounded animate-pulse" />
            ))}
          </div>
        ) : isSearchMode ? (
          searchResults && searchResults.length > 0 ? (
            <div className="space-y-0.5">
              <div className="grid grid-cols-[60px_1fr_80px] gap-2 text-[10px] text-[#86868b] dark:text-[#71717A] pb-1 border-b border-[#f0f0f0] dark:border-[#27272A]">
                <span>分类</span>
                <span>搜索结果</span>
                <span className="text-right">时间</span>
              </div>
              {searchResults.map((item, idx) => (
                <a
                  key={`search-${idx}`}
                  href={item.source_url || item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid grid-cols-[60px_1fr_80px] gap-2 items-start py-1.5 border-b border-[#f5f5f5] dark:border-[#202023]
                           hover:bg-[#fafafa] dark:hover:bg-[#1d1d1f] transition-colors cursor-pointer group"
                  title={item.title}
                >
                  <span className={`inline-flex justify-center items-center text-[10px] px-1.5 py-0.5 rounded ${getCategoryColor(item.category)}`}>
                    {item.category}
                  </span>
                  <span className="text-xs text-[#1d1d1f] dark:text-[#f5f5f7] leading-tight
                                 group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors">
                    {truncateTitle(item.title, 36)}
                  </span>
                  <span className="text-[10px] text-[#86868b] dark:text-[#71717A] text-right pt-0.5">
                    {item.pub_time?.slice(11, 16) || ''}
                  </span>
                </a>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-xs text-[#86868b] dark:text-[#71717A]">
              未找到相关新闻
            </div>
          )
        ) : loading ? (
          <div className="space-y-2">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-6 bg-gray-100 dark:bg-[#272729] rounded animate-pulse" />
            ))}
          </div>
        ) : hotspots && hotspots.length > 0 ? (
          <div className="space-y-0.5">
            {/* 表头 */}
            <div className="grid grid-cols-[60px_1fr_80px] gap-2 text-[10px] text-[#86868b] dark:text-[#71717A] pb-1 border-b border-[#f0f0f0] dark:border-[#27272A]">
              <span>分类</span>
              <span>事件</span>
              <span className="text-right">关注度</span>
            </div>

            {/* 热点列表 */}
            {hotspots.map((item, idx) => (
              <a
                key={idx}
                href={item.source_url || item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="grid grid-cols-[60px_1fr_80px] gap-2 items-center py-1.5 border-b border-[#f5f5f5] dark:border-[#202023]
                         hover:bg-[#fafafa] dark:hover:bg-[#1d1d1f] transition-colors cursor-pointer group"
                title={item.title}
              >
                {/* 分类标签 */}
                <span className={`inline-flex justify-center items-center text-[10px] px-1.5 py-0.5 rounded ${getCategoryColor(item.category)}`}>
                  {item.category}
                </span>

                {/* 标题 */}
                <span className="text-xs text-[#1d1d1f] dark:text-[#f5f5f7] truncate
                               group-hover:text-[#0066cc] dark:group-hover:text-[#2997ff] transition-colors">
                  {truncateTitle(item.title, 36)}
                </span>

                {/* 关注度 */}
                <span className="text-right flex justify-end">
                  {renderAttention(item.attention || item.fire_count || 1)}
                </span>
              </a>
            ))}
          </div>
        ) : (
          // 兜底：展示 related_news 或静态提示
          <div className="text-xs text-[#86868b] dark:text-[#a1a1a6]">
            {ge?.related_news && ge.related_news.length > 0 ? (
              <div className="space-y-1.5">
                {ge.related_news.slice(0, 5).map((item, idx) => (
                  <a
                    key={idx}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-[#1d1d1f] dark:text-[#f5f5f7] hover:text-[#0066cc] dark:hover:text-[#2997ff] transition-colors"
                  >
                    <span className="text-[10px] text-[#86868b] dark:text-[#a1a1a6] mr-1">
                      {item.source}
                    </span>
                    {item.title}
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                数据加载中...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
