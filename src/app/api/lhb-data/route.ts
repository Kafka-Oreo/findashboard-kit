import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";

/**
 * 龙虎榜数据 API — 纯 Node.js 实现（东方财富 datacenter 接口）
 * GET /api/lhb-data?type=lhb&date=YYYYMMDD
 * GET /api/lhb-data?type=block&date=YYYYMMDD
 * GET /api/lhb-data?date=YYYYMMDD&force=1
 *
 * 数据源：东方财富 datacenter-web API（零第三方依赖，生产稳定）
 *
 * 返回格式（与现有前端兼容）：
 * {
 *   success: boolean,
 *   data: {
 *     items: [...]       // 龙虎榜个股（中文key）
 *     seat_details: [...] // 席位明细（中文key）
 *     date: string,
 *     total: number,
 *     data_source: string,
 *   }
 * }
 *
 * 约束：
 * 1. 指定日期严格返回该日数据，禁止 fallback 到前一日
 * 2. 全部失败 → 返回标准错误，绝不使用模拟/估算数据
 */

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const CACHE_TTL = 30 * 60 * 1000;
let cache: {
  data: any;
  timestamp: number;
  dateKey: string;
  typeKey: string;
} | null = null;

/**
 * 从静态文件读取（兼容旧格式：{date, items, ...}）
 */
function readStaticFile(fileName: string): any | null {
  try {
    const filePath = path.join(process.cwd(), "public", "lhb-data", fileName);
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, "utf-8");
    const result = JSON.parse(content);
    if (result.items && Array.isArray(result.items)) {
      return result;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * 东方财富龙虎榜明细实时拉取
 * 返回：{ items, seat_details }（中文key，兼容前端）
 */
async function fetchLhbRealtime(dateStr: string): Promise<{
  items: any[];
  seat_details: any[];
  date: string;
  total_seat_deals: number;
} | null> {
  const filter = encodeURIComponent(`(TRADE_DATE='${dateStr}')`);
  const pageSize = 2000;
  const url =
    `https://datacenter-web.eastmoney.com/api/data/v1/get` +
    `?sortColumns=NET_AMT` +
    `&sortTypes=-1` +
    `&pageSize=${pageSize}` +
    `&pageNumber=1` +
    `&reportName=RPT_OPERATEDEPT_TRADE_DETAILSNEW` +
    `&columns=ALL` +
    `&filter=${filter}` +
    `&source=WEB` +
    `&client=WEB`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://data.eastmoney.com/",
      },
      cache: "no-store",
    } as RequestInit);

    if (!res.ok) return null;
    const json = await res.json();
    const rawData = json?.result?.data || [];
    if (!Array.isArray(rawData) || rawData.length === 0) return null;

    // 按股票代码聚合
    const stockMap = new Map<string, {
      code: string;
      name: string;
      close: number;
      changePct: number;
      turnoverRate: number;
      totalAmt: number;
      buyAmt: number;
      sellAmt: number;
      reasons: string[];
      threeDayReasons: string[];
      buySeats: { name: string; amt: number; isThreeDay: boolean }[];
      sellSeats: { name: string; amt: number; isThreeDay: boolean }[];
      tradeDate: string;
    }>();

    for (const raw of rawData) {
      const code = String(raw.SECURITY_CODE || "");
      const name = String(raw.SECURITY_NAME_ABBR || "");
      const deptName = String(raw.OPERATEDEPT_NAME || "");
      const reason = String(raw.EXPLANATION || "").trim();
      const close = parseFloat(raw.CLOSE_PRICE) || 0;
      const changePct = parseFloat(raw.CHANGE_RATE) || 0;
      const turnoverRate = parseFloat(raw.TURNOVER_RATE) || 0;
      const buyAmt = parseFloat(raw.ACT_BUY) || 0;
      const sellAmt = parseFloat(raw.ACT_SELL) || 0;
      const totalAmt = parseFloat(raw.LIANG_AMT) || 0;
      const netAmt = parseFloat(raw.NET_AMT) || 0;
      const tradeDate = String(raw.TRADE_DATE || dateStr).slice(0, 10);

      // 判断是否三日上榜
      const isThreeDay =
        reason.includes("连续三个交易日") ||
        reason.includes("连续3个") ||
        reason.includes("累计涨幅") ||
        reason.includes("累计跌幅") ||
        reason.includes("3日累计") ||
        reason.includes("三个交易日");

      if (!stockMap.has(code)) {
        stockMap.set(code, {
          code,
          name,
          close,
          changePct,
          turnoverRate,
          totalAmt,
          buyAmt: 0,
          sellAmt: 0,
          reasons: [],
          threeDayReasons: [],
          buySeats: [],
          sellSeats: [],
          tradeDate,
        });
      }
      const stock = stockMap.get(code)!;

      // 合并上榜原因（去重）
      if (reason && !stock.reasons.includes(reason)) {
        stock.reasons.push(reason);
        if (isThreeDay) {
          stock.threeDayReasons.push(reason);
        }
      }

      // 累计买卖金额（只累计当日上榜的，三日的单独统计）
      if (!isThreeDay) {
        stock.buyAmt += buyAmt;
        stock.sellAmt += sellAmt;
      }

      // 席位明细
      if (deptName && buyAmt > 0) {
        stock.buySeats.push({ name: deptName, amt: buyAmt, isThreeDay });
      }
      if (deptName && sellAmt > 0) {
        stock.sellSeats.push({ name: deptName, amt: sellAmt, isThreeDay });
      }
    }

    // 生成主列表（按当日净买入降序）
    const items: any[] = [];
    const seatDetails: any[] = [];

    for (const stock of stockMap.values()) {
      // 主列表：只展示当日上榜的股票，三日原因作为标签
      const netAmt = stock.buyAmt - stock.sellAmt;
      const hasThreeDayLabel = stock.threeDayReasons.length > 0;

      items.push({
        代码: stock.code,
        名称: stock.name,
        收盘价: Number(stock.close.toFixed(2)),
        涨跌幅: Number(stock.changePct.toFixed(2)),
        龙虎榜净买额: Number(netAmt.toFixed(2)),
        龙虎榜买入额: Number(stock.buyAmt.toFixed(2)),
        龙虎榜卖出额: Number(stock.sellAmt.toFixed(2)),
        龙虎榜成交额: Number((stock.buyAmt + stock.sellAmt).toFixed(2)),
        市场总成交额: stock.totalAmt,
        换手率: Number(stock.turnoverRate.toFixed(2)),
        上榜原因: stock.reasons.filter(r => !stock.threeDayReasons.includes(r)).join("；") || stock.reasons.join("；"),
        上榜日: stock.tradeDate,
        三日上榜: hasThreeDayLabel,
        三日上榜原因: stock.threeDayReasons.join("；"),
        净额类型: stock.buyAmt === 0 && stock.sellAmt === 0 ? "三日累计净额" : "当日单日净额",
      });

      // 席位明细：按营业部聚合，同一营业部合并买入和卖出
      // 使用 Map 按营业部名称聚合
      const seatMap = new Map<string, {
        buyAmt: number;
        sellAmt: number;
        isThreeDay: boolean;
      }>();

      // 聚合买入席位
      for (const seat of stock.buySeats) {
        const existing = seatMap.get(seat.name) || { buyAmt: 0, sellAmt: 0, isThreeDay: seat.isThreeDay };
        existing.buyAmt += seat.amt;
        seatMap.set(seat.name, existing);
      }

      // 聚合卖出席席
      for (const seat of stock.sellSeats) {
        const existing = seatMap.get(seat.name) || { buyAmt: 0, sellAmt: 0, isThreeDay: seat.isThreeDay };
        existing.sellAmt += seat.amt;
        seatMap.set(seat.name, existing);
      }

      // 转换为数组并计算净额
      const seatAggregated = Array.from(seatMap.entries()).map(([name, data]) => ({
        name,
        buyAmt: data.buyAmt,
        sellAmt: data.sellAmt,
        netAmt: data.buyAmt - data.sellAmt,
        isThreeDay: data.isThreeDay,
      }));

      // 按净额绝对值降序排序，取前10
      const topSeats = seatAggregated
        .sort((a, b) => Math.abs(b.netAmt) - Math.abs(a.netAmt))
        .slice(0, 10);

      for (const seat of topSeats) {
        const direction = seat.netAmt >= 0 ? "买入" : "卖出";
        seatDetails.push({
          代码: stock.code,
          名称: stock.name,
          交易营业部名称: seat.name,
          方向: direction,
          买入金额: Number(seat.buyAmt.toFixed(2)),
          卖出金额: Number(seat.sellAmt.toFixed(2)),
          净额: Number(seat.netAmt.toFixed(2)),
          净额类型: seat.isThreeDay ? "三日累计净额" : "当日单日净额",
          上榜原因: stock.reasons[0] || "",
        });
      }
    }

    // 主列表按当日净买入降序
    items.sort((a, b) => b.龙虎榜净买额 - a.龙虎榜净买额);

    // 主列表去重：按股票代码唯一，一只股票只保留一条记录
    const seenCodes = new Set<string>();
    const dedupedItems = items.filter((item) => {
      if (seenCodes.has(item.代码)) return false;
      seenCodes.add(item.代码);
      return true;
    });

    return {
      items: dedupedItems,
      seat_details: seatDetails,
      date: dateStr,
      total_seat_deals: seatDetails.length,
    };
  } catch {
    return null;
  }
}

/**
 * 大宗交易实时数据（东方财富 datacenter RPT_DATA_BLOCKTRADE）
 */
async function fetchBlockTradeRealtime(dateStr: string): Promise<{
  items: any[];
  date: string;
  total: number;
} | null> {
  // dateStr 格式: YYYY-MM-DD（由 normalizeDate 统一处理）
  const filterDate = dateStr || new Date().toISOString().slice(0, 10);
  const filter = encodeURIComponent(`(TRADE_DATE='${filterDate}')`);
  const pageSize = 500;
  const url =
    `https://datacenter-web.eastmoney.com/api/data/v1/get` +
    `?sortColumns=DEAL_AMT` +
    `&sortTypes=-1` +
    `&pageSize=${pageSize}` +
    `&pageNumber=1` +
    `&reportName=RPT_DATA_BLOCKTRADE` +
    `&columns=ALL` +
    `&filter=${filter}` +
    `&source=WEB` +
    `&client=WEB`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Referer: "https://data.eastmoney.com/",
      },
      cache: "no-store",
    } as RequestInit);

    if (!res.ok) return null;
    const json = await res.json();
    const rawData = json?.result?.data || [];
    if (!Array.isArray(rawData) || rawData.length === 0) return null;

    const items: any[] = [];
    for (const raw of rawData) {
      const code = String(raw.SECURITY_CODE || "");
      const name = String(raw.SECURITY_NAME_ABBR || "");
      const price = parseFloat(raw.DEAL_PRICE) || 0;
      const volume = parseFloat(raw.DEAL_VOLUME) || 0;
      const amount = parseFloat(raw.DEAL_AMT) || 0;
      const buyer = String(raw.BUYER_NAME || "");
      const seller = String(raw.SELLER_NAME || "");
      const closePrice = parseFloat(raw.CLOSE_PRICE) || 0;
      const changeRate = parseFloat(raw.CHANGE_RATE) || 0;
      const premiumRatio = parseFloat(raw.PREMIUM_RATIO) || 0;

      items.push({
        证券代码: code,
        证券简称: name,
        成交价: Number(price.toFixed(2)),
        收盘价: Number(closePrice.toFixed(2)),
        涨跌幅: Number(changeRate.toFixed(2)),
        溢折率: Number((premiumRatio * 100).toFixed(2)),
        成交量: volume,
        成交额: amount,
        成交量万股: Number((volume / 10000).toFixed(2)),
        成交额万元: Number((amount / 10000).toFixed(2)),
        买方营业部: buyer,
        卖方营业部: seller,
        交易日期: filterDate,
      });
    }

    return {
      items,
      date: filterDate,
      total: items.length,
    };
  } catch {
    return null;
  }
}

/**
 * 标准化日期 → YYYY-MM-DD
 */
function normalizeDate(dateStr: string): string {
  const s = dateStr.replace(/[/-]/g, "");
  if (s.length === 8) {
    return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
  }
  return dateStr;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const rawDate = searchParams.get("date") || "";
  const force = searchParams.get("force") === "1";
  const type = searchParams.get("type") || "lhb"; // lhb = 龙虎榜, block = 大宗交易

  const dateStr = rawDate ? normalizeDate(rawDate) : "";
  const cacheKey = dateStr || "latest";

  // 内存缓存
  if (
    !force &&
    cache &&
    cache.dateKey === cacheKey &&
    cache.typeKey === type &&
    Date.now() - cache.timestamp < CACHE_TTL
  ) {
    return NextResponse.json(cache.data);
  }

  // ========== 大宗交易 type=block ==========
  if (type === "block") {
    const rt = await fetchBlockTradeRealtime(dateStr || "");
    if (rt) {
      const resp = {
        success: true,
        data: {
          items: rt.items,
          date: rt.date,
          total: rt.total,
          data_source: "eastmoney-datacenter-blocktrade",
        },
      };
      cache = { data: resp, timestamp: Date.now(), dateKey: cacheKey, typeKey: type };
      return NextResponse.json(resp);
    }
    return NextResponse.json(
      { success: false, error: "大宗交易数据获取失败", data: { items: [], date: dateStr, total: 0 } },
      { status: 200 }
    );
  }

  // ========== force=1：直接实时拉取 ==========
  if (force) {
    const rt = await fetchLhbRealtime(dateStr);
    if (rt) {
      const resp = {
        success: true,
        data: {
          items: rt.items,
          seat_details: rt.seat_details,
          total_seat_deals: rt.total_seat_deals,
          date: rt.date,
          total: rt.items.length,
          data_source: "eastmoney-datacenter-seat-detail",
        },
      };
      cache = { data: resp, timestamp: Date.now(), dateKey: cacheKey, typeKey: type };
      return NextResponse.json(resp);
    }
    return NextResponse.json(
      { success: false, error: "实时拉取失败", data: { items: [], seat_details: [], date: dateStr } },
      { status: 200 }
    );
  }

  // ========== 第一优先级：静态文件（指定日期）==========
  if (dateStr) {
    const compactDate = dateStr.replace(/-/g, "");
    const staticData = readStaticFile(`${compactDate}.json`);
    if (staticData) {
      const resp = {
        success: true,
        data: {
          items: staticData.items,
          seat_details: staticData.seat_details || [],
          date: staticData.date || dateStr,
          total: staticData.items.length,
          data_source: "static-file",
        },
      };
      cache = { data: resp, timestamp: Date.now(), dateKey: cacheKey, typeKey: type };
      return NextResponse.json(resp);
    }
  }

  // ========== 第二优先级：latest.json（仅在没传date时用）==========
  if (!dateStr) {
    const latestData = readStaticFile("latest.json");
    if (latestData) {
      const resp = {
        success: true,
        data: {
          items: latestData.items,
          seat_details: latestData.seat_details || [],
          date: latestData.date || "",
          total: latestData.items.length,
          data_source: "static-latest",
        },
      };
      cache = { data: resp, timestamp: Date.now(), dateKey: cacheKey, typeKey: type };
      return NextResponse.json(resp);
    }
  }

  // ========== 第三优先级：实时拉取 ==========
  const rt = await fetchLhbRealtime(dateStr);
  if (rt) {
    const resp = {
      success: true,
      data: {
        items: rt.items,
        seat_details: rt.seat_details,
        date: rt.date,
        total: rt.items.length,
        data_source: "eastmoney-datacenter",
      },
    };
    cache = { data: resp, timestamp: Date.now(), dateKey: cacheKey, typeKey: type };
    return NextResponse.json(resp);
  }

  return NextResponse.json(
    { success: false, error: "龙虎榜数据获取失败", data: { items: [], seat_details: [], date: dateStr } },
    { status: 200 }
  );
}
