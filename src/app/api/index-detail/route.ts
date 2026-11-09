import { NextResponse } from "next/server";
import { exec } from "child_process";
import path from "path";
import { promisify } from "util";
import fs from "fs";

const execAsync = promisify(exec);

export const dynamic = "force-dynamic";
export const revalidate = 0;

const SCRIPT_PATH = path.resolve(process.cwd(), "scripts/fetch_index_detail.py");

// 指数名称映射
const INDEX_NAMES = [
  "上证指数", "深证成指", "创业板指", "沪深300", "科创50", "中证500", "北证50",
];

// 简单内存缓存（5分钟）
interface CacheItem {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheItem>();
const CACHE_TTL = 5 * 60 * 1000;

function normalizeDate(dateStr: string): string {
  if (!dateStr) return "";
  // 支持 YYYY-MM-DD 和 YYYYMMDD 两种格式
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  if (/^\d{8}$/.test(dateStr)) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

function matchIndexName(index: string): string {
  for (const name of INDEX_NAMES) {
    if (index === name || name.includes(index) || index.includes(name.replace("指", ""))) {
      return name;
    }
  }
  return index;
}

async function getFromStaticFile(indexName: string, dateStr: string): Promise<any | null> {
  try {
    const staticPath = path.resolve(
      process.cwd(),
      "public/index-details",
      dateStr,
      `${indexName}.json`
    );
    if (fs.existsSync(staticPath)) {
      const content = fs.readFileSync(staticPath, "utf-8");
      const data = JSON.parse(content);
      if (data.success) {
        return data;
      }
    }
  } catch {
    // 静态文件读取失败，继续 fallback
  }
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const index = searchParams.get("index") || "";
  const changeStr = searchParams.get("indexChange") || searchParams.get("change") || "0";
  const dateStr = normalizeDate(searchParams.get("date") || "");
  const force = searchParams.get("force") === "1";

  if (!index) {
    return NextResponse.json(
      { success: false, error: "指数名称不能为空" },
      { status: 400 }
    );
  }

  const matchedName = matchIndexName(index);
  const expectedChange = parseFloat(changeStr) || 0;

  // 1. 先查内存缓存
  const cacheKey = `${matchedName}_${dateStr}`;
  if (!force) {
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }
  }

  // 2. 优先读静态文件（force 模式下跳过，直接拉最新）
  if (dateStr && !force) {
    const staticData = await getFromStaticFile(matchedName, dateStr);
    if (staticData && staticData.success) {
      const response = {
        success: true,
        data: staticData.data,
        history: staticData.history || [],
        source: staticData.source || "precomputed",
        sourceNote: "东方财富-AKShare",
      };
      cache.set(cacheKey, { data: response, timestamp: Date.now() });
      console.info(`[index-detail] 静态文件命中: ${matchedName} @ ${dateStr}`);
      return NextResponse.json(response);
    }
  }

  // 3. Fallback：实时调用 Python 脚本
  try {
    console.info(`[index-detail] 调取指数: '${matchedName}', 预期涨幅: ${expectedChange}%`);
    console.info(`[index-detail] 调用多源行情脚本...`);

    const scriptArg = `"${matchedName}" "${expectedChange}" "${dateStr}" --no-verify`;
    const cmd = `python3 "${SCRIPT_PATH}" ${scriptArg}`;

    const { stdout, stderr } = await execAsync(cmd, {
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = stdout.trim();
    if (!output) {
      console.error(`[index-detail] 脚本无输出, stderr: ${stderr}`);
      return NextResponse.json(
        { success: false, error: "暂无历史行情数据", sourceNote: "东方财富-AKShare" },
        { status: 500 }
      );
    }

    const result = JSON.parse(output);

    if (result.success && result.data) {
      const response = {
        success: true,
        data: result.data,
        history: result.data.history || [],
        source: result.data.source,
        sourceNote: "东方财富-AKShare",
      };
      console.info(`[index-detail] 成功，数据源: ${result.data.source}`);
      cache.set(cacheKey, { data: response, timestamp: Date.now() });
      return NextResponse.json(response);
    } else {
      console.error(`[index-detail] 全部 3 个数据源失败。最后错误: ${result.error || "未知"}`);
      return NextResponse.json(
        {
          success: false,
          error: "暂无历史行情数据",
          sourceNote: "东方财富-AKShare",
          details: result.details || [],
        },
        { status: 500 }
      );
    }
  } catch (err: any) {
    console.error(`[index-detail] 脚本异常: ${err.message}`);
    return NextResponse.json(
      {
        success: false,
        error: "暂无历史行情数据",
        sourceNote: "东方财富-AKShare",
      },
      { status: 500 }
    );
  }
}
