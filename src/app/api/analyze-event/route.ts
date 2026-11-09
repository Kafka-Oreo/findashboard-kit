import { NextRequest, NextResponse } from 'next/server';
import { LLMClient, Config, HeaderUtils } from "@/lib/llm";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// AI 事件分析 Prompt
const ANALYSIS_PROMPT = `你是一位专业的A股投资分析师。请根据以下投资事件信息，提供简洁专业的分析：

【分析要求】
1. 分析该事件对A股市场的潜在影响（正面/负面/中性）
2. 指出可能受益或受损的板块
3. 给出投资者应关注的要点
4. 保持客观，不做主观预测

【输出格式】
- 影响评估：1-2句话
- 相关板块：列出2-3个相关板块
- 关注要点：1-2个关键点

【限制】
- 总字数控制在150字以内
- 不做涨跌预测
- 不给买卖建议
- 仅做客观分析

事件标题：{title}
事件摘要：{summary}
事件类型：{type}
相关市场：{markets}
事件时间：{time}`;

export async function POST(request: NextRequest) {
  try {
    const { title, summary, type, markets, time } = await request.json();

    if (!title) {
      return NextResponse.json(
        { error: '缺少必要参数：title' },
        { status: 400 }
      );
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const prompt = ANALYSIS_PROMPT
      .replace('{title}', title)
      .replace('{summary}', summary || '无')
      .replace('{type}', type || '未分类')
      .replace('{markets}', markets?.join('、') || '未指定')
      .replace('{time}', time || '未指定');

    const messages = [
      { role: 'system' as const, content: '你是专业的A股投资分析师，擅长客观分析投资事件对市场的影响。' },
      { role: 'user' as const, content: prompt },
    ];

    const stream = client.stream(messages, {
      model: 'doubao-seed-2-0-mini-260215',
      temperature: 0.7,
    });

    let fullContent = '';
    for await (const chunk of stream) {
      if (chunk.content) {
        fullContent += chunk.content.toString();
      }
    }

    return NextResponse.json({
      success: true,
      analysis: fullContent.trim(),
    });
  } catch (error) {
    console.error('AI 分析失败:', error);
    return NextResponse.json(
      { error: 'AI 分析失败，请稍后重试' },
      { status: 500 }
    );
  }
}
