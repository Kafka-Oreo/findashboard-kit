/**
 * Wind Alice Market (万得 AIFin Market) 数据接入
 *
 * 通过 Wind 官方 MCP 服务（JSON-RPC over HTTP）取数：
 *   1. initialize  —— 建立 MCP 会话
 *   2. tools/call  —— 调用具体取数工具
 *
 * 鉴权：Authorization: Bearer <WIND_API_KEY>
 * 响应：SSE 或直接 JSON-RPC，兼容两种解析。
 *
 * API Key 仅从环境变量 / 服务端配置读取，严禁硬编码或下发到前端。
 * 官方文档：https://aifinmarket.wind.com.cn
 */

export class WindError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "WindError";
    this.code = code;
  }
}

const WIND_MCP_ENDPOINTS: Record<string, string> = {
  stock_data: "https://mcp.wind.com.cn/vserver_stock_data/mcp/",
  fund_data: "https://mcp.wind.com.cn/vserver_fund_data/mcp/",
  index_data: "https://mcp.wind.com.cn/vserver_index_data/mcp/",
  bond_data: "https://mcp.wind.com.cn/vserver_bond_data/mcp/",
  financial_docs: "https://mcp.wind.com.cn/vserver_financial_docs/mcp/",
  economic_data: "https://mcp.wind.com.cn/vserver_economic_data/mcp/",
  analytics_data: "https://mcp.wind.com.cn/vserver_analytics_data/mcp/",
};

const MCP_PROTOCOL_VERSION = "2025-03-26";
const CLIENT_INFO = { name: "ai-advisor-wind", version: "1.0.0" };

function getApiKey(): string {
  return (process.env.WIND_API_KEY ?? "").trim();
}

/**
 * 解析 MCP 响应：可能是纯 JSON-RPC，也可能是 SSE（data: {...} 多帧）。
 */
function parseMcpResponse(text: string): {
  result?: { content?: Array<{ type: string; text?: string }>; isError?: boolean };
  error?: { message?: string } | string;
} {
  const trimmed = text.trim();

  // 1) 直接是 JSON
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through to SSE parsing
    }
  }

  // 2) SSE：逐帧找最后一个带 result/error 的 JSON
  let lastPayload: Record<string, unknown> | null = null;
  for (const rawLine of trimmed.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("data:")) continue;
    const dataStr = line.slice(5).trim();
    if (!dataStr || dataStr === "[DONE]") continue;
    try {
      const obj = JSON.parse(dataStr) as Record<string, unknown>;
      if (obj.result !== undefined || obj.error !== undefined) {
        lastPayload = obj;
      }
    } catch {
      // ignore partial frame
    }
  }
  return (lastPayload ?? {}) as never;
}

async function mcpRequest(
  serverType: keyof typeof WIND_MCP_ENDPOINTS,
  method: string,
  params: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<unknown> {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new WindError("AUTH_ERROR", "WIND_API_KEY 未配置");
  }
  const endpoint = WIND_MCP_ENDPOINTS[serverType];
  if (!endpoint) {
    throw new WindError("ROUTE_ERROR", `未知的 Wind 服务类型: ${String(serverType)}`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json, text/event-stream",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: Date.now(),
        method,
        params,
      }),
      signal: controller.signal,
    });

    if (!resp.ok) {
      throw new WindError(
        "NETWORK_ERROR",
        `Wind MCP HTTP ${resp.status}`,
      );
    }

    const text = await resp.text();
    const payload = parseMcpResponse(text);

    if (payload.error) {
      const msg =
        typeof payload.error === "string"
          ? payload.error
          : payload.error.message ?? "Wind 接口返回错误";
      throw new WindError("BACKEND_ERROR", msg);
    }
    if (payload.result?.isError) {
      const msg = payload.result.content?.[0]?.text ?? "Wind 工具返回错误";
      throw new WindError("BACKEND_ERROR", msg);
    }
    return payload.result;
  } catch (err) {
    if (err instanceof WindError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new WindError("NETWORK_ERROR", "Wind 请求超时");
    }
    throw new WindError(
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Wind 网络请求失败",
    );
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 调用 Wind 取数工具：先 initialize 建立会话，再 tools/call。
 */
export async function windCall(
  serverType: keyof typeof WIND_MCP_ENDPOINTS,
  toolName: string,
  toolParams: Record<string, unknown>,
): Promise<unknown> {
  await mcpRequest(serverType, "initialize", {
    protocolVersion: MCP_PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: CLIENT_INFO,
  });
  const result = await mcpRequest(
    serverType,
    "tools/call",
    { name: toolName, arguments: toolParams },
    60_000,
  );
  return result;
}

/**
 * 从 tools/call 结果中解析出表格数据（columns + rows）。
 * Wind 工具把业务数据包在 result.content[0].text 的 JSON 字符串里。
 */
export function parseWindTable(
  result: unknown,
): { columns: string[]; rows: string[][]; unit: Record<string, string> } | null {
  const content = (
    result as { content?: Array<{ type?: string; text?: string }> }
  )?.content;
  const text = content?.find((c) => c.type === "text" || typeof c.text === "string")
    ?.text;
  if (!text) return null;

  let parsed: {
    data?: {
      columns?: Array<{ name: string }>;
      rows?: unknown[][];
      unit?: Record<string, string>;
    };
    error?: unknown;
  };
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (parsed.error) return null;
  const data = parsed.data;
  if (!data?.columns || !data?.rows) return null;

  const columns = data.columns.map((c) => c.name);
  const rows = data.rows.map((r) => r.map((cell) => String(cell ?? "")));
  return { columns, rows, unit: data.unit ?? {} };
}

/** 按列名取某一行的字段值 */
function cell(row: string[], columns: string[], name: string): string {
  const idx = columns.indexOf(name);
  return idx >= 0 ? row[idx] : "";
}

export interface IndexSnapshot {
  code: string;
  name: string;
  price: string;
  changePct: string;
  turnoverYi: number | null; // 成交额（亿元）
  advance?: number;
  decline?: number;
  flat?: number;
}

/**
 * 获取单个指数的行情快照。
 */
async function fetchIndexSnapshot(
  windcode: string,
  indexes: string[],
  withBreadth = false,
): Promise<IndexSnapshot | null> {
  const fields = withBreadth
    ? ["中文简称", "最新成交价", "涨跌幅", "成交额", "上涨家数", "下跌家数", "平盘家数"]
    : ["中文简称", "最新成交价", "涨跌幅", "成交额"];
  const result = await windCall("index_data", "get_index_price_indicators", {
    windcode,
    indexes: indexes.length ? indexes.join(",") : fields.join(","),
  });
  const table = parseWindTable(result);
  if (!table || table.rows.length === 0) return null;

  const row = table.rows[0];
  const turnoverYuan = Number(cell(row, table.columns, "成交额"));
  const num = (v: string): number | undefined => {
    const n = Number(v);
    return Number.isFinite(n) && v !== "" ? n : undefined;
  };

  return {
    code: windcode,
    name: cell(row, table.columns, "中文简称") || windcode,
    price: cell(row, table.columns, "最新成交价"),
    changePct: cell(row, table.columns, "涨跌幅"),
    turnoverYi: Number.isFinite(turnoverYuan)
      ? Math.round((turnoverYuan / 1e8) * 10) / 10
      : null,
    advance: num(cell(row, table.columns, "上涨家数")),
    decline: num(cell(row, table.columns, "下跌家数")),
    flat: num(cell(row, table.columns, "平盘家数")),
  };
}

export interface MarketBreadth {
  date: string;
  indexes: IndexSnapshot[];
  source: "wind";
}

/**
 * 获取今日 A 股客观盘面快照（三大指数 + 上证成分涨跌家数）。
 * 任何一个指数失败不影响其它；全部失败时抛错由调用方降级。
 */
/**
 * 北京时区（UTC+8）下的当前日期，格式 YYYY-MM-DD。
 * A 股交易日历按北京时间走，避免凌晨时段 UTC 切片错标成前一天。
 */
export function todayInShanghai(): string {
  const now = new Date();
  const bj = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return bj.toISOString().slice(0, 10);
}

let snapshotPromise: Promise<MarketBreadth | null> | null = null;

/**
 * 获取今日 A 股客观盘面快照（三大指数 + 上证成分涨跌家数）。
 * 三个指数并行请求（单个失败不影响其余），同一时刻并发只打一轮 Wind；
 * 全部失败时返回 null，由调用方降级。
 */
export async function fetchTodayMarketSnapshot(): Promise<MarketBreadth | null> {
  if (snapshotPromise) return snapshotPromise;

  snapshotPromise = (async () => {
    const targets: Array<{ code: string; breadth: boolean }> = [
      { code: "000001.SH", breadth: true }, // 上证指数（成分涨跌家数）
      { code: "399001.SZ", breadth: false }, // 深证成指
      { code: "399006.SZ", breadth: false }, // 创业板指
    ];

    const results = await Promise.allSettled(
      targets.map((t) => fetchIndexSnapshot(t.code, [], t.breadth)),
    );

    const indexes: IndexSnapshot[] = [];
    results.forEach((r, i) => {
      if (r.status === "fulfilled" && r.value) {
        indexes.push(r.value);
      } else if (r.status === "rejected") {
        const err = r.reason;
        console.error(
          `[wind] 指数 ${targets[i].code} 取数失败:`,
          err instanceof WindError ? `${err.code} ${err.message}` : err,
        );
      }
    });

    if (indexes.length === 0) return null;

    return { date: todayInShanghai(), indexes, source: "wind" };
  })();

  try {
    return await snapshotPromise;
  } finally {
    // 完成后释放，让下次调用重新取数（成功/失败都释放，TTL 由调用方缓存控制）
    snapshotPromise = null;
  }
}

/**
 * 把盘面快照格式化成注入 LLM 的文本（仅客观数据，不含任何观点/建议）。
 */
export function formatMarketSnapshotForPrompt(snap: MarketBreadth): string {
  const lines: string[] = [];
  lines.push(`【今日 A 股客观盘面数据 · 交易日 ${snap.date}】（数据来源：万得 Wind）`);
  for (const ix of snap.indexes) {
    const parts: string[] = [];
    parts.push(`${ix.name} ${ix.price} 点（${Number(ix.changePct) >= 0 ? "+" : ""}${ix.changePct}%）`);
    if (ix.turnoverYi !== null) parts.push(`成交额约 ${ix.turnoverYi} 亿元`);
    if (ix.advance !== undefined)
      parts.push(`成分股：上涨 ${ix.advance} / 下跌 ${ix.decline ?? "-"} / 平盘 ${ix.flat ?? "-"}`);
    lines.push(`- ${parts.join("，")}`);
  }
  lines.push("（注：以上为客观行情数据；成交额为指数成分口径，仅供参考。）");
  return lines.join("\n");
}
