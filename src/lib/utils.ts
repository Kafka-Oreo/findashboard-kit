import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 校验事件 URL 是否有效（仅允许 http/https）
 * - 空值、非法 URL、非 http/https 协议均返回 false
 */
export function isValidEventUrl(url?: string | null): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * 判断某日期是否为 A 股交易日（排除周六、周日）
 * dateStr 支持 "YYYY-MM-DD"、"M/D"、"MM/DD" 格式
 */
export function isTradingDay(dateStr: string, refYear?: number): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  let y: number | undefined = refYear;
  let m: number, d: number;

  if (dateStr.includes('-')) {
    // YYYY-MM-DD
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      y = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
      d = parseInt(parts[2], 10);
    } else if (parts.length === 2) {
      m = parseInt(parts[0], 10);
      d = parseInt(parts[1], 10);
    } else {
      return false;
    }
  } else if (dateStr.includes('/')) {
    // M/D 或 MM/DD
    const parts = dateStr.split('/');
    m = parseInt(parts[0], 10);
    d = parseInt(parts[1], 10);
  } else {
    return false;
  }

  if (isNaN(m) || isNaN(d)) return false;
  const year = y ?? refYear ?? new Date().getFullYear();
  const date = new Date(year, m - 1, d);
  if (isNaN(date.getTime())) return false;
  const dayOfWeek = date.getDay(); // 0=周日, 6=周六
  return dayOfWeek !== 0 && dayOfWeek !== 6;
}

/**
 * 过滤连板历史中的非交易日数据
 * 返回过滤后的 dates / heights / stocks
 */
export function filterLadderHistoryTradingDays(
  ladderHistory: { dates: string[]; heights: number[]; stocks?: string[] },
  refYear?: number,
): { dates: string[]; heights: number[]; stocks?: string[] } {
  const indices: number[] = [];
  ladderHistory.dates.forEach((d, i) => {
    if (isTradingDay(d, refYear)) indices.push(i);
  });
  return {
    dates: indices.map(i => ladderHistory.dates[i]),
    heights: indices.map(i => ladderHistory.heights[i]),
    stocks: ladderHistory.stocks ? indices.map(i => ladderHistory.stocks![i]) : undefined,
  };
}

/**
 * 过滤情绪温度历史中的非交易日数据
 */
export function filterThermoTradingDays(
  thermo: { dates: string[]; temps: number[] },
  refYear?: number,
): { dates: string[]; temps: number[] } {
  const indices: number[] = [];
  thermo.dates.forEach((d, i) => {
    if (isTradingDay(d, refYear)) indices.push(i);
  });
  return {
    dates: indices.map(i => thermo.dates[i]),
    temps: indices.map(i => thermo.temps[i]),
  };
}

/**
 * 过滤涨跌停+温度合并图中的非交易日数据
 */
export function filterLimitsTradingDays(
  limits: { dates: string[]; up: number[]; down: number[]; temps: number[] },
  refYear?: number,
): { dates: string[]; up: number[]; down: number[]; temps: number[] } {
  const indices: number[] = [];
  limits.dates.forEach((d, i) => {
    if (isTradingDay(d, refYear)) indices.push(i);
  });
  return {
    dates: indices.map(i => limits.dates[i]),
    up: indices.map(i => limits.up[i]),
    down: indices.map(i => limits.down[i]),
    temps: indices.map(i => limits.temps[i]),
  };
}

/**
 * 过滤主力资金流向 ChartData 中的非交易日
 */
export function filterFundsTradingDays(
  funds: { dates: string[]; values: number[] },
  refYear?: number
): { dates: string[]; values: number[] } {
  const indices: number[] = [];
  funds.dates.forEach((d, i) => {
    if (isTradingDay(d, refYear)) indices.push(i);
  });
  return {
    dates: indices.map(i => funds.dates[i]),
    values: indices.map(i => funds.values[i]),
  };
}

/**
 * 通用首页链接黑名单（不算"准确原文链接"，走搜索兜底）
 */
// 通用来源链接：指向财联社电报频道（保证可访问），fallback为搜索引擎
export function getSourceLink(keyword: string): string {
  const encoded = encodeURIComponent(keyword);
  return `https://www.cls.cn/telegraph?keyword=${encoded}`;
}

// 判断catalyst链接是否为真实详情页链接（而非搜索页/首页占位）
export function isRealLink(link?: { url: string; label: string }): boolean {
  if (!link?.url) return false;
  const homepagePatterns = [
    /^https?:\/\/[^/]+\/?$/,        // 首页
    /cls\.cn\/?$/,                   // 财联社首页
    /eastmoney\.com\/?$/,            // 东财首页
    /baidu\.com\/?$/,                // 百度首页
  ];
  return !homepagePatterns.some(p => p.test(link.url));
}

const GENERIC_HOMEPAGES = [
  'https://finance.eastmoney.com/',
  'http://finance.eastmoney.com/',
  'https://www.eastmoney.com/',
  'http://www.eastmoney.com/',
  'https://www.cls.cn/',
  'https://wallstreetcn.com/',
];

/**
 * 判断链接是否为通用首页（非具体原文）
 */
export function isGenericHomepage(url: string | undefined | null): boolean {
  if (!url) return true;
  return GENERIC_HOMEPAGES.some(h => url === h || url === h + '/');
}

/**
 * 从催化剂 HTML 文本中提取关键词（去掉 HTML 标签，取标题部分）
 */
export function extractCatalystKeywords(html: string): string {
  // 去掉 HTML 标签
  const text = html.replace(/<[^>]+>/g, '').trim();
  // 取标题部分（冒号之前的内容）作为核心关键词
  const colonMatch = text.match(/^[^：:]+[：:]/);
  const titlePart = colonMatch ? colonMatch[0].replace(/[：:]$/, '') : text;
  // 清理标点，取前 5 个关键词
  const cleaned = titlePart.replace(/[，。、；""''（）\[\]【】！？,.\-/\\]/g, ' ').trim();
  const words = cleaned.split(/\s+/).filter(Boolean).slice(0, 6).join(' ');
  return words.slice(0, 40) || text.slice(0, 30);
}

/**
 * 构造东方财富新闻搜索 URL
 */
export function buildEastmoneySearchUrl(keyword: string): string {
  const encoded = encodeURIComponent(keyword);
  return `https://so.eastmoney.com/news/s?keyword=${encoded}`;
}

/**
 * 构造财联社搜索 URL
 */
export function buildClsSearchUrl(keyword: string): string {
  const encoded = encodeURIComponent(keyword);
  return `https://www.cls.cn/searchPage?keyword=${encoded}`;
}

/**
 * 获取催化剂的可跳转链接
 * 优先级：数据中已有的真实原文链接 > 东方财富搜索结果
 */
export function getCatalystUrl(catalyst: { links?: Array<{ text: string; url: string }>; text: string }): string {
  const firstLink = catalyst.links?.[0];
  // 优先使用真实详情链接；但财联社 detail 页面常被反爬拦截，改用搜索页保证可访问
  if (firstLink?.url && !isGenericHomepage(firstLink.url)) {
    // 财联社 detail 链接改为搜索页跳转，确保一定能打开
    if (firstLink.url.includes('cls.cn/detail/')) {
      const keyword = extractCatalystKeywords(catalyst.text);
      return buildClsSearchUrl(keyword);
    }
    return firstLink.url;
  }
  const keyword = extractCatalystKeywords(catalyst.text);
  return buildClsSearchUrl(keyword);
}
