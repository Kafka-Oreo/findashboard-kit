import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// 七指数标准名称与代码映射（顺序固定）
const SEVEN_INDICES: { name: string; code: string }[] = [
  { name: "上证指数", code: "sh000001" },
  { name: "深证成指", code: "sz399001" },
  { name: "创业板指", code: "sz399006" },
  { name: "沪深300", code: "sh000300" },
  { name: "科创50", code: "sh000688" },
  { name: "中证500", code: "sh000905" },
  { name: "北证50", code: "bj899050" },
];

// 内存缓存（5分钟）
interface CacheItem {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheItem>();
const CACHE_TTL = 5 * 60 * 1000;

function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

// 解析新浪实时行情返回行
// 格式：var hq_str_sh000001="上证指数,3912.522,3889.779,3912.522,3931.384,3895.971,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2026-08-26,15:00:00,00,";
function parseSinaLine(line: string): {
  name: string;
  open: number;
  close: number; // 当前价/收盘价
  preclose: number; // 昨收
  high: number;
  low: number;
  volume: number;
  amount: number;
  date: string;
  time: string;
  code: string;
} | null {
  const match = line.match(/var hq_str_(.+?)="(.+)";/);
  if (!match) return null;
  const code = match[1];
  const fields = match[2].split(",");
  if (fields.length < 32) return null;

  const name = fields[0];
  const open = parseFloat(fields[1]);
  const preclose = parseFloat(fields[2]);
  const close = parseFloat(fields[3]);
  const high = parseFloat(fields[4]);
  const low = parseFloat(fields[5]);
  const volume = parseFloat(fields[8]) || 0; // 成交量（股）
  const amount = parseFloat(fields[9]) || 0; // 成交额（元）
  const date = fields[30];
  const time = fields[31];

  if (!name || isNaN(close)) return null;

  return { name, open, close, preclose, high, low, volume, amount, date, time, code };
}

// 新浪日K线接口（获取指定交易日数据）
async function fetchSinaDailyK(code: string, dateStr: string): Promise<{
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  date: string;
} | null> {
  try {
    // 新浪日K：https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=sh000001&scale=240&ma=no&datalen=10
    const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${code}&scale=240&ma=no&datalen=5`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://finance.sina.com.cn/",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const text = await res.text();
    if (!text || text.includes("null") || text.length < 10) return null;

    // 返回 JSON 数组
    let data: any[];
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    // 找指定日期的K线
    const targetDate = dateStr.replace(/-/g, "");
    let found = data.find((d: any) => {
      const dStr = (d.day || d.date || "").replace(/-/g, "");
      return dStr === targetDate;
    });

    // 如果没找到指定日期，用最后一条（最近交易日）
    if (!found) found = data[data.length - 1];

    return {
      open: parseFloat(found.open) || 0,
      close: parseFloat(found.close) || 0,
      high: parseFloat(found.high) || 0,
      low: parseFloat(found.low) || 0,
      volume: parseFloat(found.volume) || 0,
      amount: parseFloat(found.amount || found.turnover) || 0,
      date: found.day || found.date || dateStr,
    };
  } catch {
    return null;
  }
}

// 腾讯日K线接口（第二数据源）
async function fetchTencentDailyK(code: string, dateStr: string): Promise<{
  open: number;
  close: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  date: string;
} | null> {
  try {
    // 腾讯日K：https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=sh000001,day,,,5,qfq
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},day,,,5,qfq`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return null;
    const json = await res.json();
    const dayData = json?.data?.[code]?.qfqday || json?.data?.[code]?.day;
    if (!Array.isArray(dayData) || dayData.length === 0) return null;

    const targetDate = dateStr.replace(/-/g, "");
    let found = dayData.find((d: any[]) => {
      const dStr = (d[0] || "").replace(/-/g, "");
      return dStr === targetDate;
    });
    if (!found) found = dayData[dayData.length - 1];

    return {
      date: found[0] || dateStr,
      open: parseFloat(found[1]) || 0,
      close: parseFloat(found[2]) || 0,
      high: parseFloat(found[3]) || 0,
      low: parseFloat(found[4]) || 0,
      volume: parseFloat(found[5]) || 0,
      amount: 0,
    };
  } catch {
    return null;
  }
}

interface IndexResult {
  name: string;
  success: boolean;
  change: number;
  close: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  amount: number;
  source: string;
  date: string;
  error?: string;
}

async function fetchSingleIndex(name: string, code: string, dateStr: string): Promise<IndexResult> {
  const cacheKey = `batch_${name}_${dateStr}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }

  // 如果 dateStr 是今天或未来，用实时行情；否则用日K
  const today = new Date().toISOString().slice(0, 10);
  const isTodayOrLater = !dateStr || dateStr >= today;

  let result: IndexResult | null = null;

  if (isTodayOrLater) {
    // 实时行情：新浪批量接口（一次返回所有，在外面批量调用）
    // 这里单独调用时用新浪实时单条
    try {
      const url = `https://hq.sinajs.cn/list=${code}`;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Referer: "https://finance.sina.com.cn/",
        },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const text = await res.text();
        const parsed = parseSinaLine(text);
        if (parsed && parsed.close > 0) {
          const change = parsed.preclose > 0
            ? ((parsed.close - parsed.preclose) / parsed.preclose) * 100
            : 0;
          result = {
            name: parsed.name,
            success: true,
            change,
            close: parsed.close,
            open: parsed.open,
            high: parsed.high,
            low: parsed.low,
            volume: parsed.volume,
            amount: parsed.amount,
            source: "新浪实时",
            date: parsed.date || today,
          };
        }
      }
    } catch {
      // 继续尝试下一个源
    }
  }

  // 日K线数据源1：新浪日K
  if (!result) {
    const kline = await fetchSinaDailyK(code, dateStr || today);
    if (kline && kline.close > 0) {
      // 计算涨跌幅：需要昨收。从前一根K线获取
      let prevClose = 0;
      try {
        const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${code}&scale=240&ma=no&datalen=10`;
        const res = await fetch(url, {
          headers: {
            "User-Agent": "Mozilla/5.0",
            Referer: "https://finance.sina.com.cn/",
          },
        });
        if (res.ok) {
          const data = JSON.parse(await res.text());
          if (Array.isArray(data) && data.length >= 2) {
            const targetIdx = data.findIndex((d: any) =>
              (d.day || "").replace(/-/g, "") === (dateStr || today).replace(/-/g, "")
            );
            if (targetIdx > 0) {
              prevClose = parseFloat(data[targetIdx - 1].close) || 0;
            } else if (targetIdx === -1 && data.length >= 2) {
              // 没找到目标日，用最后一根的前一根作昨收
              prevClose = parseFloat(data[data.length - 2].close) || 0;
            }
          }
        }
      } catch {
        // ignore
      }

      const change = prevClose > 0 ? ((kline.close - prevClose) / prevClose) * 100 : 0;
      result = {
        name,
        success: true,
        change,
        close: kline.close,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        volume: kline.volume,
        amount: kline.amount,
        source: "新浪日K",
        date: kline.date,
      };
    }
  }

  // 日K线数据源2：腾讯日K
  if (!result) {
    const kline = await fetchTencentDailyK(code, dateStr || today);
    if (kline && kline.close > 0) {
      result = {
        name,
        success: true,
        change: 0, // 腾讯源暂不计算涨跌幅（需要额外取昨收）
        close: kline.close,
        open: kline.open,
        high: kline.high,
        low: kline.low,
        volume: kline.volume,
        amount: kline.amount,
        source: "腾讯日K",
        date: kline.date,
      };
    }
  }

  if (!result) {
    result = {
      name,
      success: false,
      change: 0,
      close: 0,
      open: 0,
      high: 0,
      low: 0,
      volume: 0,
      amount: 0,
      source: "",
      date: dateStr || today,
      error: "所有数据源均失败",
    };
  }

  cache.set(cacheKey, { data: result, timestamp: Date.now() });
  return result;
}

// 批量获取：优先用新浪实时批量接口（一次HTTP请求拿所有）
async function fetchBatchSina(codes: string[], dateStr: string): Promise<Map<string, IndexResult>> {
  const results = new Map<string, IndexResult>();
  try {
    const url = `https://hq.sinajs.cn/list=${codes.join(",")}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        Referer: "https://finance.sina.com.cn/",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!res.ok) return results;
    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim().length > 0);

    for (const line of lines) {
      const parsed = parseSinaLine(line);
      if (!parsed) continue;
      const change = parsed.preclose > 0
        ? ((parsed.close - parsed.preclose) / parsed.preclose) * 100
        : 0;
      results.set(parsed.code, {
        name: parsed.name,
        success: true,
        change,
        close: parsed.close,
        open: parsed.open,
        high: parsed.high,
        low: parsed.low,
        volume: parsed.volume,
        amount: parsed.amount,
        source: "新浪实时",
        date: parsed.date,
      });
    }
  } catch {
    // ignore
  }
  return results;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateStr = normalizeDate(searchParams.get("date") || "");
  const indicesParam = searchParams.get("indices") || "";

  // 支持自定义指数列表，默认七个
  const indices = indicesParam
    ? indicesParam.split(",").map((s) => s.trim()).filter(Boolean)
      .map((name) => SEVEN_INDICES.find((i) => i.name === name) || SEVEN_INDICES.find((i) => i.name.includes(name) || name.includes(i.name.replace("指", ""))) || { name, code: name })
    : SEVEN_INDICES;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const isTodayOrLater = !dateStr || dateStr >= today;
    const results: IndexResult[] = [];

    if (isTodayOrLater) {
      // 当日/未来：用新浪批量实时接口（一次请求，高效）
      const codes = indices.map((i) => i.code);
      const batchMap = await fetchBatchSina(codes, dateStr);

      for (const idx of indices) {
        const hit = batchMap.get(idx.code);
        if (hit) {
          hit.name = idx.name; // 强制使用标准名称
          results.push(hit);
          // 写入缓存
          cache.set(`batch_${idx.name}_${dateStr}`, { data: hit, timestamp: Date.now() });
        } else {
          // 批量失败则单独请求（日K降级）
          const single = await fetchSingleIndex(idx.name, idx.code, dateStr || today);
          results.push(single);
        }
      }
    } else {
      // 历史日期：逐个取日K线
      for (const idx of indices) {
        const single = await fetchSingleIndex(idx.name, idx.code, dateStr);
        results.push(single);
      }
    }

    const successResults = results.filter((r) => r.success);
    const failedResults = results.filter((r) => !r.success);

    return NextResponse.json({
      success: successResults.length > 0,
      date: dateStr,
      total: results.length,
      successCount: successResults.length,
      data: results,
      names: successResults.map((r) => r.name),
      changes: successResults.map((r) => r.change),
      details: successResults.map((r) => ({
        name: r.name,
        open: r.open,
        close: r.close,
        high: r.high,
        low: r.low,
        volume: r.volume,
        turnover: r.amount,
        change: r.change,
        date: r.date,
      })),
      failed: failedResults.map((r) => ({ name: r.name, error: r.error })),
      sourceNote: "新浪财经",
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: err.message || "批量获取失败",
        sourceNote: "新浪财经",
      },
      { status: 500 }
    );
  }
}
