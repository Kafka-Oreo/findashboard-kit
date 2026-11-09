import { NextRequest, NextResponse } from 'next/server';
import { readFile, readdir } from 'fs/promises';
import path from 'path';

/**
 * GET /api/daily-events/status?date=YYYYMMDD
 *
 * 返回指定日期（或最新日期）的抓取状态。
 * 用于前端判断当天数据是真实抓取(verified)、部分成功(partial)还是失败(failed)。
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    let dateParam = searchParams.get('date');

    const eventsDir = path.join(process.cwd(), 'public', 'daily-events');

    // 未指定日期时取最新文件
    if (!dateParam) {
      const allFiles = await readdir(eventsDir);
      const jsonFiles = allFiles
        .filter(f => /^\d{8}\.json$/.test(f))
        .sort()
        .reverse();
      if (jsonFiles.length === 0) {
        return NextResponse.json({
          success: true,
          status: 'no_data',
          date: null,
          total: 0,
          last_updated: null,
          sources: {},
        });
      }
      dateParam = jsonFiles[0].replace('.json', '');
    }

    if (!/^\d{8}$/.test(dateParam)) {
      return NextResponse.json(
        { error: 'date 格式错误，应为 YYYYMMDD' },
        { status: 400 }
      );
    }

    const filePath = path.join(eventsDir, `${dateParam}.json`);
    let raw: string;
    try {
      raw = await readFile(filePath, 'utf-8');
    } catch {
      return NextResponse.json({
        success: true,
        status: 'failed',
        date: dateParam,
        total: 0,
        last_updated: null,
        sources: {},
        message: '该日期无抓取数据文件（可能尚未抓取或抓取失败）',
      });
    }

    const data = JSON.parse(raw) as {
      events?: unknown[];
      data_status?: string;
      last_updated?: string;
      source_status?: Record<string, { success: boolean; count: number; error?: string }>;
    };

    const events = Array.isArray(data) ? data : (data.events || []);
    const status = data.data_status === 'partial'
      ? 'partial'
      : data.data_status === 'failed'
        ? 'failed'
        : 'verified';

    return NextResponse.json({
      success: true,
      status,
      date: dateParam,
      total: events.length,
      last_updated: data.last_updated || null,
      sources: data.source_status || {},
    });
  } catch (error) {
    console.error('[Daily Events Status API] Error:', error);
    return NextResponse.json(
      { error: '获取抓取状态失败' },
      { status: 500 }
    );
  }
}
