import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

/**
 * 获取财联社月度金股数据
 * GET /api/golden-stocks?month=2026-07
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month");

    // 确定数据文件路径
    const dataDir = path.join(process.cwd(), "public", "golden-stocks");
    const fileName = month ? `${month}.json` : "latest.json";
    const filePath = path.join(dataDir, fileName);

    // 检查文件是否存在
    if (!fs.existsSync(filePath)) {
      // 尝试读取 latest.json
      const latestPath = path.join(dataDir, "latest.json");
      if (fs.existsSync(latestPath)) {
        const data = fs.readFileSync(latestPath, "utf-8");
        return NextResponse.json(JSON.parse(data));
      }
      return NextResponse.json({
        month: month || "2026-07",
        mostWatched: [],
        topGainers: [],
        updateTime: new Date().toISOString()
      });
    }

    const data = fs.readFileSync(filePath, "utf-8");
    return NextResponse.json(JSON.parse(data));
  } catch (error) {
    console.error("Error reading golden stocks data:", error);
    return NextResponse.json({
      error: "Failed to load golden stocks data",
      mostWatched: [],
      topGainers: []
    }, { status: 500 });
  }
}
