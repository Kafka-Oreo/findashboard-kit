import { NextResponse } from 'next/server';
import { getScheduler } from '@/lib/daily-events-scheduler';

/**
 * GET /health
 *
 * 健康检查接口，返回调度器运行状态
 * 用于外部监控每日事件抓取是否正常在跑
 */
export async function GET() {
  try {
    const scheduler = getScheduler();
    scheduler.start(); // 懒启动：确保调度器已初始化
    const status = scheduler.getStatus();

    return NextResponse.json({
      success: true,
      ...status,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        success: false,
        error: msg,
        cronRunning: false,
        lastUpdate: null,
        todayVerified: false,
      },
      { status: 500 }
    );
  }
}
