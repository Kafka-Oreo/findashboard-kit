import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

/**
 * GET /api/daily-events/month?month=2026-08
 * 
 * 返回指定月份所有已抓取的每日财经事件，按日期分组。
 * 用于事件日历页面展示。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    if (!monthParam) {
      return NextResponse.json(
        { error: '缺少 month 参数，格式: YYYY-MM' },
        { status: 400 }
      );
    }

    // 验证格式
    const monthMatch = monthParam.match(/^(\d{4})-(\d{2})$/);
    if (!monthMatch) {
      return NextResponse.json(
        { error: 'month 格式错误，应为 YYYY-MM' },
        { status: 400 }
      );
    }

    const [, year, month] = monthMatch;
    const prefix = `${year}${month}`;

    // 读取 daily-events 目录
    const eventsDir = path.join(process.cwd(), 'public', 'daily-events');
    let files: string[];
    try {
      const allFiles = await readdir(eventsDir);
      files = allFiles
        .filter(f => f.startsWith(prefix) && f.endsWith('.json'))
        .sort();
    } catch {
      // 目录不存在，返回空
      return NextResponse.json({
        success: true,
        month: monthParam,
        days: [],
        totalEvents: 0,
      });
    }

    // 读取每天的事件并分组
    type EventItem = {
      event_title: string;
      event_summary: string;
      source_media: string;
      source_url: string;
      event_time: string;
      event_level: string;
      [key: string]: unknown;
    };
    type DayItem = {
      date: string;
      weekday: string;
      events: EventItem[];
      data_status?: 'verified' | 'partial' | 'failed';
      last_updated?: string;
      source_status?: Record<string, { success: boolean; count: number; error?: string }>;
    };
    const days: DayItem[] = [];

    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    let totalEvents = 0;
    let failedDays = 0;
    let partialDays = 0;

    for (const file of files) {
      const dateStr = file.replace('.json', '');
      const dateObj = new Date(`${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`);
      const weekday = weekdays[dateObj.getDay()];
      const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;

      try {
        const filePath = path.join(eventsDir, file);
        const content = await readFile(filePath, 'utf-8');
        const raw = JSON.parse(content);
        const data = raw as {
          events?: EventItem[];
          data_status?: string;
          last_updated?: string;
          source_status?: Record<string, { success: boolean; count: number; error?: string }>;
        };

        const events: EventItem[] = Array.isArray(data) ? (data as EventItem[]) : (data.events || []);
        // 只有 verified/partial 且确有事件的日期才计入日历；failed 日期单独标记
        const status = (data.data_status === 'partial'
          ? 'partial'
          : data.data_status === 'failed'
            ? 'failed'
            : 'verified') as DayItem['data_status'];

        if (events.length > 0 || status === 'failed') {
          const dayItem: DayItem = {
            date: formattedDate,
            weekday,
            events,
            data_status: status,
          };
          if (data.last_updated) dayItem.last_updated = data.last_updated;
          if (data.source_status) dayItem.source_status = data.source_status;
          days.push(dayItem);
          totalEvents += events.length;
          if (status === 'failed') failedDays += 1;
          if (status === 'partial') partialDays += 1;
        }
      } catch {
        // 跳过无法解析的文件
        continue;
      }
    }

    return NextResponse.json({
      success: true,
      month: monthParam,
      days,
      totalEvents,
      summary: {
        days: days.length,
        verified: days.length - failedDays - partialDays,
        partial: partialDays,
        failed: failedDays,
      },
    });
  } catch (error) {
    console.error('[Daily Events Month API] Error:', error);
    return NextResponse.json(
      { error: '获取月度事件失败' },
      { status: 500 }
    );
  }
}
