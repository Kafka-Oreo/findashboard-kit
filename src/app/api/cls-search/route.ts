import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";
import path from "path";

const execAsync = promisify(exec);

// 简单内存缓存（关键词 -> 结果）
interface CacheItem {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheItem>();
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const keyword = (searchParams.get("q") || "").trim();
  const limit = Math.min(parseInt(searchParams.get("limit") || "20", 10), 50);

  if (!keyword) {
    return NextResponse.json(
      { success: false, error: "缺少搜索关键词 q 参数", data: [] },
      { status: 400 }
    );
  }

  const cacheKey = `${keyword.toLowerCase()}_${limit}`;

  // 命中缓存
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json({ ...cached.data, fromCache: true });
  }

  const scriptPath = path.join(
    process.cwd(),
    "scripts",
    "search_cls_news.py"
  );

  try {
    const { stdout } = await execAsync(
      `python3 "${scriptPath}" "${keyword.replace(/"/g, '\\"')}" ${limit}`,
      { timeout: 30 * 1000 }
    );

    // 解析 JSON
    const jsonMatch = stdout.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("脚本输出无效 JSON");
    }

    const result = JSON.parse(jsonMatch[0]);

    // 写入缓存
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    // 控制缓存大小
    if (cache.size > 100) {
      const firstKey = cache.keys().next().value;
      if (firstKey) cache.delete(firstKey);
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[cls-search] 搜索失败:", error?.message || error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "搜索失败",
        data: [],
        keyword,
      },
      { status: 500 }
    );
  }
}
