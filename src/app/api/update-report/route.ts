import { NextRequest, NextResponse } from "next/server";

/**
 * 手动触发每日日报更新 API
 * POST /api/update-report
 * 
 * 注意：此 API 不执行任何 Python 脚本或 AkShare 调用
 * 数据采集由独立的 Python Scheduler 服务完成
 * 
 * 架构说明：
 * Python Scheduler (独立部署) → AkShare → PostgreSQL → Next.js API → 页面展示
 */
export async function POST(request: NextRequest) {
  return NextResponse.json(
    {
      success: false,
      message: "数据采集由独立的 Python Scheduler 服务完成，请运行: bash scripts/start_scheduler.sh",
      architecture: {
        scheduler: "python/task.py (APScheduler, 每天 05:00 执行)",
        datasource: "AkShare (A股真实数据)",
        database: "PostgreSQL (market_data 表)",
        api: "Next.js API (从数据库读取)",
        frontend: "React 页面展示"
      }
    },
    { status: 400 }
  );
}

export async function GET() {
  return NextResponse.json({
    message: "数据采集由独立的 Python Scheduler 服务完成",
    usage: "请运行: bash scripts/start_scheduler.sh",
    schedule: "每天 05:00 (北京时间) 自动采集"
  });
}
