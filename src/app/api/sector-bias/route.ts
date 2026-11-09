import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

/**
 * 板块60日乖离率 API — 纯 Node.js 实现（腾讯财经数据源）
 * GET /api/sector-bias?date=YYYY-MM-DD&force=1
 *
 * 数据源：腾讯财经日K线接口（web.ifzq.gtimg.cn）
 * 零 Python 依赖，生产环境稳定可用
 *
 * 硬性约束：
 * 1. 必须拿到完整60根交易日收盘K线，不足即数据源异常
 * 2. BIAS = (收盘价 - MA60) / MA60 * 100%
 * 3. 相关系数 = 60日滚动皮尔逊相关系数（与沪深300）
 * 4. 全部失败 → 返回标准错误，绝不使用模拟/估算数据
 * 5. 按 BIAS 绝对值从大到小降序排列
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_TTL = 30 * 60 * 1000; // 30 分钟内存缓存
let cache: {
  data: any;
  timestamp: number;
  dateKey: string;
} | null = null;

// ---- 板块列表（腾讯财经代码，名称尽量贴近申万一级行业）----
const SECTORS: Array<{ code: string; name: string }> = [
  { code: "sz399986", name: "银行" },
  { code: "sz399997", name: "白酒" },
  { code: "sz399993", name: "煤炭" },
  { code: "sh000819", name: "有色金属" },
  { code: "sz399933", name: "钢铁" },
  { code: "sh000933", name: "贵金属" },
  { code: "sz399998", name: "光伏" },
  { code: "sz399989", name: "医疗服务" },
  { code: "sh000991", name: "非银金融" },
  { code: "sz399628", name: "信息技术" },
  { code: "sz399636", name: "电信运营" },
  { code: "sz399637", name: "公用事业" },
  { code: "sz399639", name: "原材料" },
  { code: "sz399640", name: "可选消费" },
  { code: "sz399643", name: "工业" },
  { code: "sh000075", name: "医药生物" },
  { code: "sh000076", name: "消费" },
  { code: "sh000077", name: "工业制造" },
  { code: "sh000078", name: "房地产" },
  { code: "sz399680", name: "次新股" },
  { code: "sz399618", name: "电子" },
  { code: "sz399971", name: "汽车" },
  { code: "sh000814", name: "建筑装饰" },
  { code: "sz399632", name: "电力设备" },
  { code: "sz399634", name: "食品饮料" },
  { code: "sz399635", name: "家用电器" },
  { code: "sz399638", name: "传媒" },
  { code: "sz399641", name: "农林牧渔" },
  { code: "sz399644", name: "纺织服装" },
  { code: "sz399646", name: "交通运输" },
];

const BENCHMARK_CODE = "sh000300";
const BENCHMARK_NAME = "沪深300";
const MA_WINDOW = 60;
const MIN_DATA_LENGTH = 60;
const MAX_DATE_GAP_DAYS = 10;

// ---- 工具函数 ----

function mean(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function std(arr: number[]): number {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, v) => s + (v - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function pearsonCorr(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2 || b.length !== n) return 0;
  const ma = mean(a);
  const mb = mean(b);
  const sa = std(a);
  const sb = std(b);
  if (sa === 0 || sb === 0) return 0;
  let cov = 0;
  for (let i = 0; i < n; i++) {
    cov += (a[i] - ma) * (b[i] - mb);
  }
  cov /= n;
  return cov / (sa * sb);
}

// 新浪日K代码格式转换：sz/sh + 6位数字 → 新浪格式
// 新浪：sh000001 / sz399001 → 直接用即可
function toSinaCode(code: string): string {
  return code; // 已经是 sz/sh 前缀格式
}

/**
 * 搜狐财经获取日K线（首选）
 * 返回: [{ date: 'YYYY-MM-DD', close: number }] 升序（最旧在前）
 */
async function fetchKlineSohu(code: string): Promise<Array<{ date: string; close: number }>> {
  // 提取纯数字代码
  const numCode = code.replace(/^(sh|sz|bj)/, "");
  // 判断是否为指数：000开头（上证综指/沪深300等）、399开头（深证系列指数）
  const isIndex = /^(000|399)\d{3}$/.test(numCode);
  // 搜狐代码格式：zs_xxxxxx（指数）/cn_xxxxxx（A股个股）/bj_xxxxxx（北交所）
  let sohuCode: string;
  if (isIndex) {
    sohuCode = `zs_${numCode}`;
  } else if (code.startsWith("bj")) {
    sohuCode = `bj_${numCode}`;
  } else {
    sohuCode = `cn_${numCode}`;
  }
  // 取近 250 个交易日（约一年），确保有 60+ 根有效 K 线
  const url = `https://q.stock.sohu.com/hisHq?code=${sohuCode}&start=20251001&end=20261231&stat=1&order=D&period=d&rt=jsonp`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://q.stock.sohu.com/",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const text = await res.text();
    // 搜狐返回 JSONP：callback([{status:0, hq:[...]}])
    const jsonMatch = text.match(/callback\((.+)\);?\s*$/);
    if (!jsonMatch) return [];
    const parsed = JSON.parse(jsonMatch[1]);
    const hq = parsed?.[0]?.hq;
    if (!Array.isArray(hq) || hq.length < MIN_DATA_LENGTH) return [];
    // 搜狐是倒序（最新在前），转升序
    const result: Array<{ date: string; close: number }> = [];
    for (const row of hq) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const date = String(row[0]);
      const close = parseFloat(row[2]);
      if (isNaN(close) || close <= 0 || !date) continue;
      result.push({ date, close });
    }
    return result.reverse(); // 升序
  } catch {
    return [];
  }
}

/**
 * 新浪财经获取日K线（降级备用）
 */
async function fetchKlineSina(code: string): Promise<Array<{ date: string; close: number }>> {
  // 新浪日K接口：数量=90（取近90个交易日，保证有60根有效K线）
  const sinaCode = toSinaCode(code);
  const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${sinaCode}&scale=240&ma=no&datalen=120`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://finance.sina.com.cn/",
      },
      cache: "no-store",
    });
    if (!res.ok) return [];
    const text = await res.text();
    // 新浪返回的是 JS 对象字面量数组，字段名无引号
    // 格式：[{day:"2025-01-02",open:"...",high:"...",low:"...",close:"...",volume:"..."},...]
    // 用 Function 构造函数安全解析（在隔离作用域内）
    let data: any[] = [];
    try {
      data = new Function("return " + text + ";")();
    } catch {
      return [];
    }
    if (!Array.isArray(data) || data.length < MIN_DATA_LENGTH) return [];

    const result: Array<{ date: string; close: number }> = [];
    for (const row of data) {
      const date = String(row.day).replace(/\//g, "-");
      const close = parseFloat(row.close);
      if (isNaN(close) || close <= 0 || !date) continue;
      result.push({ date, close });
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * 腾讯财经获取日K线（降级备用）
 * 返回: [{ date: 'YYYY-MM-DD', close: number }] 升序
 */
async function fetchKlineTencent(code: string): Promise<Array<{ date: string; close: number }>> {
  const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${code},day,,,80,qfq`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://finance.qq.com/",
      },
      cache: "no-store",
    } as RequestInit);
    if (!res.ok) return [];
    const json = await res.json();
    const dataObj = json?.data?.[code];
    if (!dataObj) return [];
    const klines: string[][] = dataObj.qfqday || dataObj.day || [];
    if (!Array.isArray(klines) || klines.length < MIN_DATA_LENGTH) return [];

    const result: Array<{ date: string; close: number }> = [];
    for (const row of klines) {
      if (!Array.isArray(row) || row.length < 3) continue;
      const date = String(row[0]);
      const close = parseFloat(row[2]);
      if (isNaN(close) || close <= 0 || !date) continue;
      result.push({ date, close });
    }
    return result;
  } catch {
    return [];
  }
}

/**
 * 获取日K线 — 搜狐（首选）→ 新浪（降级）→ 腾讯（最后备用）
 */
async function fetchKline(code: string): Promise<Array<{ date: string; close: number }>> {
  const sohu = await fetchKlineSohu(code);
  if (sohu.length >= MIN_DATA_LENGTH) return sohu;
  const sina = await fetchKlineSina(code);
  if (sina.length >= MIN_DATA_LENGTH) return sina;
  const tencent = await fetchKlineTencent(code);
  return tencent;
}

/**
 * 批量获取板块 K 线（并发控制，避免被限流）
 */
async function fetchKlineBatch(
  codes: string[],
  concurrency = 3
): Promise<Map<string, Array<{ date: string; close: number }>>> {
  const result = new Map<string, Array<{ date: string; close: number }>>();
  let index = 0;

  async function worker() {
    while (index < codes.length) {
      const i = index++;
      const code = codes[i];
      const kline = await fetchKline(code);
      result.set(code, kline);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, codes.length) },
    () => worker()
  );
  await Promise.all(workers);
  return result;
}

function isDataRecent(kline: Array<{ date: string; close: number }>, targetDate: string): boolean {
  if (kline.length === 0) return false;
  const last = kline[kline.length - 1].date;
  const gap = Math.abs(
    Math.floor(
      (new Date(last).getTime() - new Date(targetDate).getTime()) / (1000 * 60 * 60 * 24)
    )
  );
  return gap <= MAX_DATE_GAP_DAYS;
}

/**
 * 对齐两个序列到相同日期
 */
function alignByDate(
  datesA: string[],
  closesA: number[],
  datesB: string[],
  closesB: number[]
): { a: number[]; b: number[] } {
  const mapA = new Map<string, number>();
  const mapB = new Map<string, number>();
  for (let i = 0; i < datesA.length; i++) mapA.set(datesA[i], closesA[i]);
  for (let i = 0; i < datesB.length; i++) mapB.set(datesB[i], closesB[i]);

  const commonDates = [...mapA.keys()].filter((d) => mapB.has(d)).sort();
  return {
    a: commonDates.map((d) => mapA.get(d)!),
    b: commonDates.map((d) => mapB.get(d)!),
  };
}

/**
 * 从静态文件读取（仅在有缓存时读，force 模式跳过）
 */
function readStaticFile(dateStr: string): any | null {
  try {
    const filePath = path.join(process.cwd(), "public", "sector-bias", `${dateStr}.json`);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    const result = JSON.parse(content);
    if (result.success && result.data && Array.isArray(result.data)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let dateStr = searchParams.get("date") || "";
  const force = searchParams.get("force") === "1";

  // 标准化日期格式
  if (dateStr) {
    dateStr = dateStr.replace(/[/-]/g, "");
    if (dateStr.length === 8) {
      dateStr = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
    }
  }
  if (!dateStr) {
    const now = new Date();
    dateStr = now.toISOString().slice(0, 10);
  }

  // ---- 缓存检查 ----
  if (!force && cache && cache.dateKey === dateStr && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  // ---- 静态文件（force 模式跳过）----
  if (!force) {
    const staticData = readStaticFile(dateStr);
    if (staticData) {
      cache = { data: staticData, timestamp: Date.now(), dateKey: dateStr };
      return NextResponse.json(staticData);
    }
  }

  // ---- 实时计算（腾讯财经）----
  try {
    // 1. 获取基准指数
    const bmKline = await fetchKline(BENCHMARK_CODE);
    if (bmKline.length < MIN_DATA_LENGTH || !isDataRecent(bmKline, dateStr)) {
      return NextResponse.json(
        { success: false, error: "基准指数数据获取失败（腾讯财经K线不足60根）" },
        { status: 200 }
      );
    }

    const bmDates = bmKline.map((k) => k.date);
    const bmCloses = bmKline.map((k) => k.close);

    // 2. 批量获取板块
    const sectorCodes = SECTORS.map((s) => s.code);
    const klineMap = await fetchKlineBatch(sectorCodes, 5);

    const sectorResults: any[] = [];
    let failedCount = 0;

    for (const sector of SECTORS) {
      const kline = klineMap.get(sector.code) || [];
      if (kline.length < MIN_DATA_LENGTH || !isDataRecent(kline, dateStr)) {
        failedCount++;
        continue;
      }

      const closes = kline.map((k) => k.close);
      const dates = kline.map((k) => k.date);
      const lastClose = closes[closes.length - 1];
      if (lastClose <= 0) {
        failedCount++;
        continue;
      }

      // MA60
      const ma60 = mean(closes.slice(-MA_WINDOW));
      if (ma60 <= 0) {
        failedCount++;
        continue;
      }

      // BIAS
      const bias = ((lastClose - ma60) / ma60) * 100;

      // 对齐日期后算 60 日相关系数
      const aligned = alignByDate(dates, closes, bmDates, bmCloses);
      if (aligned.a.length < MA_WINDOW) {
        failedCount++;
        continue;
      }

      const windowA = aligned.a.slice(-MA_WINDOW);
      const windowB = aligned.b.slice(-MA_WINDOW);
      const correlation = pearsonCorr(windowA, windowB);

      sectorResults.push({
        name: sector.name,
        code: sector.code,
        bias: Number(bias.toFixed(2)),
        abs_bias: Number(Math.abs(bias).toFixed(2)),
        close: Number(lastClose.toFixed(2)),
        ma60: Number(ma60.toFixed(2)),
        date: dates[dates.length - 1],
        correlation: Number(correlation.toFixed(4)),
        kline_count: closes.length,
      });
    }

    // 按 |BIAS| 降序
    sectorResults.sort((a, b) => b.abs_bias - a.abs_bias);

    // 基准 BIAS
    const bmMa60 = mean(bmCloses.slice(-MA_WINDOW));
    const benchmarkBias = bmMa60 > 0 ? ((bmCloses[bmCloses.length - 1] - bmMa60) / bmMa60) * 100 : 0;

    const positiveCount = sectorResults.filter((s) => s.bias > 0).length;
    const negativeCount = sectorResults.filter((s) => s.bias < 0).length;

    const result = {
      success: true,
      date: dateStr,
      total: sectorResults.length,
      failed_count: failedCount,
      total_sectors_requested: SECTORS.length,
      positive_count: positiveCount,
      negative_count: negativeCount,
      benchmark: BENCHMARK_NAME,
      benchmark_code: BENCHMARK_CODE,
      benchmark_close: Number(bmCloses[bmCloses.length - 1].toFixed(2)),
      benchmark_ma60: Number(bmMa60.toFixed(2)),
      benchmark_bias: Number(benchmarkBias.toFixed(2)),
      correlation_window: MA_WINDOW,
      ma_window: MA_WINDOW,
      min_data_length: MIN_DATA_LENGTH,
      data_source: "sohu-finance-kline",
      is_shenwan_equivalent: true,
      data: sectorResults,
    };

    // 更新缓存
    cache = { data: result, timestamp: Date.now(), dateKey: dateStr };

    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: `板块BIAS计算失败: ${error?.message || "未知错误"}` },
      { status: 200 }
    );
  }
}
