import { NextRequest, NextResponse } from 'next/server';
import { getPool, getMarketDataByDateRange } from '@/lib/db';

interface HistoricalStats {
  next_day: { avg_change: number; win_rate: number };
  next_week: { avg_change: number; win_rate: number };
  next_month: { avg_change: number; win_rate: number };
  sample_size: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('eventType');
    const date = searchParams.get('date');

    if (!eventType || !date) {
      return NextResponse.json(
        { error: '缺少必要参数：eventType, date' },
        { status: 400 }
      );
    }

    // 验证事件类型
    const validTypes = [
      'trade_tariff', 'fed_rate', 'earnings', 'policy',
      'macro', 'geopolitical', 'industry', 'other'
    ];
    if (!validTypes.includes(eventType)) {
      return NextResponse.json(
        { error: `无效的事件类型，可选值：${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: '数据库连接失败' },
        { status: 500 }
      );
    }
    
    // 查询过去 2 年同类型事件
    const eventsResult = await pool.query(
      `SELECT event_date FROM investment_events
       WHERE event_type = $1
       AND event_date < $2::date
       AND event_date >= $2::date - INTERVAL '2 years'
       ORDER BY event_date DESC`,
      [eventType, date]
    );

    const historicalEvents = eventsResult.rows;

    if (historicalEvents.length === 0) {
      return NextResponse.json({
        message: '暂无历史同类事件数据',
        sample_size: 0,
      });
    }

    // 对每个历史事件，计算 T+1/T+7/T+30 市场表现
    const stats: {
      next_day: number[];
      next_week: number[];
      next_month: number[];
    } = {
      next_day: [],
      next_week: [],
      next_month: [],
    };

    for (const event of historicalEvents) {
      const eventDate = new Date(event.event_date);
      const endDate = new Date(eventDate);
      endDate.setDate(endDate.getDate() + 35); // 多取几天确保有数据

      const marketData = await getMarketDataByDateRange(
        eventDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0]
      );

      if (marketData.length > 0) {
        // 使用成交额 (turnover) 作为市场表现指标
        const baseTurnover = marketData[0].turnover;
        if (!baseTurnover) continue;

        // T+1
        if (marketData.length >= 2 && marketData[1].turnover) {
          const change = ((marketData[1].turnover - baseTurnover) / baseTurnover) * 100;
          stats.next_day.push(change);
        }

        // T+7
        if (marketData.length >= 8 && marketData[7].turnover) {
          const change = ((marketData[7].turnover - baseTurnover) / baseTurnover) * 100;
          stats.next_week.push(change);
        }

        // T+30
        if (marketData.length >= 31 && marketData[30].turnover) {
          const change = ((marketData[30].turnover - baseTurnover) / baseTurnover) * 100;
          stats.next_month.push(change);
        }
      }
    }

    // 计算统计结果
    const result: HistoricalStats = {
      next_day: calculateStats(stats.next_day),
      next_week: calculateStats(stats.next_week),
      next_month: calculateStats(stats.next_month),
      sample_size: historicalEvents.length,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('历史影响统计失败:', error);
    return NextResponse.json(
      { error: '历史影响统计失败' },
      { status: 500 }
    );
  }
}

function calculateStats(values: number[]): { avg_change: number; win_rate: number } {
  if (values.length === 0) {
    return { avg_change: 0, win_rate: 0 };
  }

  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const winCount = values.filter(v => v > 0).length;
  const winRate = (winCount / values.length) * 100;

  return {
    avg_change: Math.round(avg * 100) / 100,
    win_rate: Math.round(winRate),
  };
}
