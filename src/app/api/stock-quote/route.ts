import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import nameCodeMap from "./name-code-map.json";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== 类型定义 =====
interface StockQuoteResult {
  name: string;
  code: string;
  change: number;   // 涨跌幅 %
  open: number;     // 开盘价
  close: number;    // 收盘价
  latest: number;   // 最新价（收盘数据场景下同收盘价）
  high: number;
  low: number;
  source: string;   // 数据源名称
  tradeDate: string; // YYYY-MM-DD
  volume?: number;   // 成交量（手）
  amount?: number;   // 成交额（元）
}

// ===== 工具函数 =====

// 名称→代码映射（从 JSON 静态导入，确保模块初始化稳定）
const NAME_CODE_MAP = nameCodeMap as Record<string, string>;

// 名称→代码查找
function findCodeByName(name: string): string | null {
  const direct = NAME_CODE_MAP[name];
  if (direct) return direct;
  // 模糊匹配（子串）
  for (const [k, v] of Object.entries(NAME_CODE_MAP)) {
    if (k.includes(name) || name.includes(k)) return v;
  }
  return null;
}

// ===== AKShare Python 脚本兜底 =====
async function fetchAkshareStock(
  query: string,
  date: string
): Promise<StockQuoteResult | null> {
  return new Promise((resolve) => {
    let stdout = "";
    const scriptPath = path.join(process.cwd(), "scripts", "fetch_stock_quote_akshare.py");
    const py = spawn("python3", [scriptPath, query, date], {
      timeout: 15000,
    });
    py.stdout.on("data", (d) => (stdout += d.toString()));
    py.on("close", (code) => {
      if (code !== 0) { resolve(null); return; }
      try {
        const data = JSON.parse(stdout.trim());
        if (!data || !data.name) { resolve(null); return; }
        resolve({
          name: data.name,
          code: data.code,
          change: Number(data.change_pct || data.change || 0),
          open: Number(data.open || 0),
          close: Number(data.close || 0),
          latest: Number(data.close || 0),
          high: Number(data.high || 0),
          low: Number(data.low || 0),
          volume: Number(data.volume || 0),
          amount: Number(data.amount || 0),
          tradeDate: data.date || date,
          source: "akshare-history",
        });
      } catch {
        resolve(null);
      }
    });
    py.on("error", () => resolve(null));
  });
}

// 根据代码判断板块
function getBoard(code: string): "main" | "chinext" | "bse" {
  if (code.startsWith("688") || code.startsWith("30")) return "chinext"; // 科创板/创业板
  if (code.startsWith("8") || code.startsWith("43") || code.startsWith("92")) return "bse"; // 北交所
  return "main"; // 主板
}

// 涨跌幅限制校验（返回 true=合法）
function validateChangeRange(code: string, change: number): boolean {
  // 整体极限：±33% 直接丢弃（防串位）
  if (change < -33 || change > 33) return false;

  const board = getBoard(code);
  if (board === "main") {
    return change >= -11 && change <= 11;
  }
  if (board === "chinext") {
    return change >= -22 && change <= 22;
  }
  if (board === "bse") {
    return change >= -32 && change <= 32;
  }
  return change >= -11 && change <= 11;
}

// 价格校验：>0 且 <1000
function validatePrice(...prices: number[]): boolean {
  for (const p of prices) {
    if (!p || isNaN(p) || p <= 0 || p > 1000) return false;
  }
  return true;
}

// 防串位校验：价格数字不得与股票代码相同（防止代码填进价格字段）
function validateNotCodeMixed(code: string, ...prices: number[]): boolean {
  const codeNum = parseFloat(code);
  if (isNaN(codeNum)) return true;
  for (const p of prices) {
    if (p === codeNum) return false;
  }
  return true;
}

// 完整四层校验
function validateResult(r: StockQuoteResult): boolean {
  // ① 日期：在外部调用处校验
  // ② 价格校验
  if (!validatePrice(r.open, r.close, r.latest, r.high, r.low)) return false;
  // ③ 涨跌幅分板块校验
  if (!validateChangeRange(r.code, r.change)) return false;
  // ④ 防串位校验
  if (!validateNotCodeMixed(r.code, r.open, r.close, r.latest, r.high, r.low)) return false;
  return true;
}

// 睡眠
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ===== 数据源1：新浪财经日K线（主源） =====
// 接口：money.finance.sina.com.cn 日K JSON 接口
async function fetchFromSinaKline(code: string, targetDate: string): Promise<StockQuoteResult | null> {
  try {
    const sinaCode = (code.startsWith("6") || code.startsWith("9") || code.startsWith("5") ? "sh" : "sz") + code;
    const url = `https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/CN_MarketData.getKLineData?symbol=${sinaCode}&scale=240&ma=no&datalen=10`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const text = await res.text();
    // 新浪返回是 JSON 数组字符串
    let data: Array<{ day: string; open: string; high: string; low: string; close: string; volume: string }>;
    try {
      data = JSON.parse(text);
    } catch {
      return null;
    }

    if (!Array.isArray(data) || data.length === 0) return null;

    // 找目标日期
    const target = data.find(d => d.day === targetDate);
    if (!target) return null;

    const open = parseFloat(target.open);
    const close = parseFloat(target.close);
    const high = parseFloat(target.high);
    const low = parseFloat(target.low);

    // 找前一天数据计算涨跌幅
    const idx = data.findIndex(d => d.day === targetDate);
    let prevClose = 0;
    if (idx > 0) {
      prevClose = parseFloat(data[idx - 1].close);
    }

    const change = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 10000) / 100 : 0;

    return {
      name: "", // 日K接口不带名称，稍后补
      code,
      change,
      open,
      close,
      latest: close,
      high,
      low,
      source: "新浪财经",
      tradeDate: target.day,
    };
  } catch {
    return null;
  }
}

// ===== 数据源2：腾讯财经日K线 =====
async function fetchFromTencentKline(code: string, targetDate: string): Promise<StockQuoteResult | null> {
  try {
    const qqCode = (code.startsWith("6") ? "sh" : "sz") + code;
    const url = `https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${qqCode},day,,,10,qfq`;

    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const json = await res.json();
    const data = json.data;
    if (!data) return null;

    // 提取K线数组
    let klines: string[][] = [];
    for (const key of Object.keys(data)) {
      const v = data[key];
      if (v && v.qfqday && Array.isArray(v.qfqday)) {
        klines = v.qfqday;
        break;
      }
      if (v && v.day && Array.isArray(v.day)) {
        klines = v.day;
        break;
      }
    }

    if (!klines || klines.length === 0) return null;

    // 找目标日期
    const target = klines.find(k => k[0] === targetDate);
    if (!target) return null;

    // 腾讯日K格式：[日期, 开盘, 收盘, 最高, 最低, 成交量]
    const open = parseFloat(target[1]);
    const close = parseFloat(target[2]);
    const high = parseFloat(target[3]);
    const low = parseFloat(target[4]);

    // 找前一天计算涨跌幅
    const idx = klines.findIndex(k => k[0] === targetDate);
    let prevClose = 0;
    if (idx > 0) {
      prevClose = parseFloat(klines[idx - 1][2]);
    }

    const change = prevClose > 0 ? Math.round(((close - prevClose) / prevClose) * 10000) / 100 : 0;

    return {
      name: "",
      code,
      change,
      open,
      close,
      latest: close,
      high,
      low,
      source: "腾讯财经",
      tradeDate: target[0],
    };
  } catch {
    return null;
  }
}

// ===== 数据源3：新浪实时行情（兜底） =====
// 当日在交易时段或刚收盘时，实时接口可能有最新数据
async function fetchFromSinaRealtime(code: string, targetDate: string): Promise<StockQuoteResult | null> {
  try {
    const sinaCode = (code.startsWith("6") || code.startsWith("9") || code.startsWith("5") ? "sh" : "sz") + code;
    const url = `https://hq.sinajs.cn/list=${sinaCode}`;

    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Referer: "https://finance.sina.com.cn/",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const decoder = new TextDecoder("gbk");
    const text = decoder.decode(buffer);

    const match = text.match(/"([^"]+)"/);
    if (!match) return null;

    const parts = match[1].split(",");
    if (parts.length < 32 || !parts[0]) return null;

    const name = parts[0];
    const open = parseFloat(parts[1]);
    const prevClose = parseFloat(parts[2]);
    const current = parseFloat(parts[3]);
    const high = parseFloat(parts[4]);
    const low = parseFloat(parts[5]);
    const tradeDate = parts[30] || "";

    if (!name || !prevClose || isNaN(prevClose) || prevClose <= 0) return null;

    // 非交易时间现价可能为0，用昨收代替
    const validCurrent = current > 0 ? current : prevClose;
    const validOpen = open > 0 ? open : prevClose;
    const validHigh = high > 0 ? high : validCurrent;
    const validLow = low > 0 ? low : validCurrent;

    const change = Math.round(((validCurrent - prevClose) / prevClose) * 10000) / 100;

    return {
      name,
      code,
      change,
      open: validOpen,
      close: validCurrent,
      latest: validCurrent,
      high: validHigh,
      low: validLow,
      source: "新浪财经实时",
      tradeDate,
    };
  } catch {
    return null;
  }
}

// ===== 主流程：串行降级调用 + 四层校验 =====
async function fetchStockQuote(
  name: string,
  code: string,
  targetDate: string
): Promise<StockQuoteResult | null> {
  const sources = [
    { fn: fetchFromSinaKline, label: "新浪日K" },
    { fn: fetchFromTencentKline, label: "腾讯日K" },
    { fn: fetchFromSinaRealtime, label: "新浪实时" },
  ];

  let result: StockQuoteResult | null = null;

  for (let i = 0; i < sources.length; i++) {
    const src = sources[i];
    try {
      const raw = await src.fn(code, targetDate);
      if (!raw) continue;

      // ① 日期校验：必须等于目标复盘日
      if (!raw.tradeDate || raw.tradeDate !== targetDate) continue;

      // 如果日K接口没返回名称，用传入名称补
      if (!raw.name && name) raw.name = name;

      // ②③④ 价格 + 涨跌幅 + 防串位 校验
      if (!validateResult(raw)) continue;

      result = raw;
      break; // 成功拿到，退出循环
    } catch {
      // 单个源失败，继续
    }

    // 源与源之间增加 500ms 间隔（最后一个源不需要）
    if (i < sources.length - 1) {
      await sleep(500);
    }
  }

  // ===== 6. AKShare 兜底（Python脚本，最后手段）=====
  try {
    const scriptPath = path.join(process.cwd(), "scripts", "fetch_stock_quote_akshare.py");
    const akResult = await new Promise<string>((resolve, reject) => {
      const python = spawn("python3", [
        scriptPath,
        code || name,
        targetDate,
      ]);
      let stdout = "";
      let stderr = "";
      python.stdout.on("data", (d) => (stdout += d));
      python.stderr.on("data", (d) => (stderr += d));
      python.on("close", (code) => {
        if (code === 0) resolve(stdout.trim());
        else reject(new Error(stderr.slice(0, 200)));
      });
      python.on("error", reject);
    });

    if (akResult) {
      const parsed = JSON.parse(akResult);
      if (parsed && parsed.success && parsed.data) {
        const d = parsed.data;
        result = {
          name: d.name,
          code: d.code,
          change: Number(d.change_pct),
          open: Number(d.open),
          close: Number(d.close),
          latest: Number(d.close),
          high: Number(d.high),
          low: Number(d.low),
          tradeDate: d.date,
          source: "akshare",
          volume: Number(d.volume) || 0,
        };
      }
    }
  } catch {
    // AKShare 失败，忽略，返回已有的 result（可能为 null）
  }

  return result;
}

// ===== 按日期缓存（切换日期自动隔离） =====
const CACHE_TTL = 60_000; // 1分钟短时缓存
const cache = new Map<string, { data: StockQuoteResult; time: number }>();

// 切换日期时的缓存清理：简单做法 — 每天零点过期。
// 这里用 Map+TTL 已足够，因为 key 包含 date，不同日期互不影响。

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get("name") || "";
  const codeParam = searchParams.get("code") || undefined;
  const date = searchParams.get("date") || "";

  if (!name && !codeParam) {
    return NextResponse.json(
      { success: false, error: "请提供股票名称或代码" },
      { status: 200 }
    );
  }

  if (!date) {
    return NextResponse.json(
      { success: false, error: "请指定复盘日期" },
      { status: 200 }
    );
  }

  // 解析代码
  let code = codeParam || "";
  if (!code && name) {
    const found = findCodeByName(name);
    if (found) code = found;
  }
  if (!code) {
    return NextResponse.json(
      { success: false, error: "个股行情加载失败，请刷新页面" },
      { status: 200 }
    );
  }

  const cacheKey = `${code}_${date}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.time < CACHE_TTL) {
    return NextResponse.json({ success: true, data: cached.data }, { status: 200 });
  }

  try {
    const result = await fetchStockQuote(name, code, date);

    if (result) {
      cache.set(cacheKey, { data: result, time: Date.now() });
      return NextResponse.json({ success: true, data: result }, { status: 200 });
    }

    return NextResponse.json(
      { success: false, error: "个股行情加载失败，请刷新页面" },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { success: false, error: "个股行情加载失败，请刷新页面" },
      { status: 200 }
    );
  }
}
