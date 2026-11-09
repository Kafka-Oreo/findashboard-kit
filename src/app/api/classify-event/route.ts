import { NextRequest, NextResponse } from 'next/server';
import { getPool } from '@/lib/db';

// 事件类型定义
const EVENT_TYPES = {
  trade_tariff: '贸易/关税',
  fed_rate: '央行/利率',
  earnings: '财报',
  policy: '政策/监管',
  macro: '宏观数据',
  geopolitical: '地缘政治',
  industry: '行业事件',
  other: '其他',
} as const;

type EventType = keyof typeof EVENT_TYPES;

// AI 分类 Prompt
const CLASSIFY_PROMPT = `将以下事件分类为以下类型之一：
- trade_tariff (贸易/关税)
- fed_rate (央行/利率)
- earnings (财报)
- policy (政策/监管)
- macro (宏观数据)
- geopolitical (地缘政治)
- industry (行业事件)
- other (其他)

事件标题：{title}
事件摘要：{summary}

只返回类型名称（如 trade_tariff），不要解释。`;

export async function POST(request: NextRequest) {
  try {
    const { title, summary, event_date } = await request.json();

    if (!title || !event_date) {
      return NextResponse.json(
        { error: '缺少必要参数：title, event_date' },
        { status: 400 }
      );
    }

    // 调用 AI 进行事件分类
    const eventType = await classifyEvent(title, summary || '');

    // 保存到数据库
    const pool = getPool();
    if (!pool) {
      return NextResponse.json(
        { error: '数据库连接失败' },
        { status: 500 }
      );
    }
    
    const result = await pool.query(
      `INSERT INTO investment_events (event_date, event_type, title, summary)
       VALUES ($1, $2, $3, $4)
       RETURNING id, event_date, event_type, title`,
      [event_date, eventType, title, summary || null]
    );

    return NextResponse.json({
      success: true,
      data: result.rows[0],
      event_type_label: EVENT_TYPES[eventType as EventType],
    });
  } catch (error) {
    console.error('事件分类失败:', error);
    return NextResponse.json(
      { error: '事件分类失败' },
      { status: 500 }
    );
  }
}

// AI 事件分类函数（OpenAI 兼容接口，见 src/lib/llm.ts）
async function classifyEvent(title: string, summary: string): Promise<string> {
  try {
    const { LLMClient, Config } = await import('@/lib/llm');
    const client = new LLMClient(new Config());

    const prompt = CLASSIFY_PROMPT.replace('{title}', title).replace('{summary}', summary);
    let result = '';
    for await (const chunk of client.stream([{ role: 'user', content: prompt }], {
      temperature: 0,
    })) {
      result += chunk.content;
    }

    const cleaned = result.trim().toLowerCase();

    // 验证返回的类型是否有效
    if (cleaned in EVENT_TYPES) {
      return cleaned;
    }

    return 'other';
  } catch (error) {
    console.error('AI 分类失败，使用默认类型:', error);
    return 'other';
  }
}

// 批量分类接口
export async function PUT(request: NextRequest) {
  try {
    const { events } = await request.json();

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json(
        { error: 'events 必须是非空数组' },
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
    
    const results = [];
    for (const event of events) {
      const eventType = await classifyEvent(event.title, event.summary || '');
      const result = await pool.query(
        `INSERT INTO investment_events (event_date, event_type, title, summary)
         VALUES ($1, $2, $3, $4)
         RETURNING id, event_date, event_type, title`,
        [event.event_date, eventType, event.title, event.summary || null]
      );
      results.push(result.rows[0]);
    }

    return NextResponse.json({
      success: true,
      count: results.length,
      data: results,
    });
  } catch (error) {
    console.error('批量事件分类失败:', error);
    return NextResponse.json(
      { error: '批量事件分类失败' },
      { status: 500 }
    );
  }
}
