import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getScheduler } from '@/lib/daily-events-scheduler';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/daily-events?date=YYYYMMDD
 * 获取指定日期的财经事件
 *
 * GET /api/daily-events?status=true
 * 获取调度器状态
 */
export async function GET(request: NextRequest) {
  try {
    const status = request.nextUrl.searchParams.get('status');

    // 获取调度器状态
    if (status === 'true') {
      const scheduler = getScheduler();
      const s = scheduler.getStatus();
      return NextResponse.json({
        success: true,
        scheduler: {
          running: s.cronRunning,
          lastRun: s.lastUpdate,
          nextRun: s.nextRun,
          todayVerified: s.todayVerified,
          todayDate: s.todayDate,
          timezone: s.timezone,
        },
      });
    }

    const rawDate = request.nextUrl.searchParams.get('date');

    if (!rawDate) {
      return NextResponse.json(
        { success: false, error: '缺少日期参数，请传入 ?date=YYYYMMDD' },
        { status: 400 }
      );
    }

    // 日期格式归一化：兼容 YYYY-MM-DD 与 YYYYMMDD（数据文件按 YYYYMMDD 命名）
    const date = rawDate.replace(/-/g, '');

    // 读取每日事件数据文件
    const filePath = path.join(process.cwd(), 'public', 'daily-events', `${date}.json`);

    try {
      const fileContent = await fs.readFile(filePath, 'utf-8');
      const data = JSON.parse(fileContent);

      // 兼容新旧数据格式
      const events = data.events || [];
      const sources = data.sources || [...new Set(events.map((e: { source_media?: string }) => e.source_media).filter(Boolean))];

      return NextResponse.json({
        success: true,
        date: data.date || date,
        events,
        sources,
        updated_at: data.updated_at,
        count: events.length,
      });
    } catch {
      // 文件不存在，返回空数组
      return NextResponse.json({
        success: true,
        date,
        events: [],
        sources: [],
        count: 0,
        message: `未找到 ${date} 的事件数据`,
      });
    }
  } catch (error) {
    console.error('Failed to fetch daily events:', error);
    return NextResponse.json(
      { success: false, error: '获取每日事件失败' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/daily-events
 * 手动触发抓取
 *
 * Body: { date?: "YYYYMMDD" }
 * 不传 date 则默认当天
 */
export async function POST(request: NextRequest) {
  try {
    let date: string | undefined;

    try {
      const body = await request.json();
      date = body.date;
    } catch {
      // 没有 body 或 body 不是 JSON，使用默认值
    }

    const scheduler = getScheduler();
    const result = await scheduler.triggerFetch(date);

    return NextResponse.json({
      ...result,
    });
  } catch (error) {
    console.error('Failed to trigger daily events fetch:', error);
    return NextResponse.json(
      { success: false, error: '触发抓取失败' },
      { status: 500 }
    );
  }
}
