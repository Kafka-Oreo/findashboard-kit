import { NextRequest } from "next/server";
import { LLMClient, Config, HeaderUtils } from "@/lib/llm";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EVENTS_DIR = path.join(process.cwd(), "public", "daily-events");

// 事件类型定义
interface DailyEvent {
  event_title: string;
  event_summary: string;
  source_media: string;
  source_url: string;
  event_time: string;
  event_level: string;
}

interface DailyEventsData {
  date: string;
  events: DailyEvent[];
}

// 缓存事件数据
let eventsCache: Record<string, DailyEventsData> = {};
let cacheTime = 0;
const CACHE_TTL = 30 * 60 * 1000; // 30分钟

/**
 * 加载指定日期范围内的事件数据
 */
function loadEventsInRange(startDate: string, endDate: string): DailyEvent[] {
  const now = Date.now();
  if (now - cacheTime > CACHE_TTL) {
    eventsCache = {};
    cacheTime = now;
  }

  const allEvents: DailyEvent[] = [];
  const start = parseInt(startDate, 10);
  const end = parseInt(endDate, 10);

  if (!fs.existsSync(EVENTS_DIR)) return allEvents;

  const files = fs.readdirSync(EVENTS_DIR).filter((f) => f.endsWith(".json"));

  for (const file of files) {
    const dateStr = file.replace(".json", "");
    const dateNum = parseInt(dateStr, 10);
    if (dateNum >= start && dateNum <= end) {
      if (!eventsCache[dateStr]) {
        try {
          const filePath = path.join(EVENTS_DIR, file);
          const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as DailyEventsData;
          eventsCache[dateStr] = data;
        } catch {
          continue;
        }
      }
      if (eventsCache[dateStr]?.events) {
        allEvents.push(...eventsCache[dateStr].events);
      }
    }
  }

  return allEvents.sort(
    (a, b) => new Date(a.event_time).getTime() - new Date(b.event_time).getTime(),
  );
}

/**
 * 获取可用的事件日期列表
 */
function getAvailableDates(): string[] {
  if (!fs.existsSync(EVENTS_DIR)) return [];
  return fs
    .readdirSync(EVENTS_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(".json", ""))
    .sort();
}

const SYSTEM_PROMPT = `你是一个专业的财经日历助手，负责回答用户关于投资事件、财经日历、市场重大事件的问题。

## 你的职责
1. 基于提供的事件数据，准确回答用户关于财经日历的问题
2. 帮助用户梳理未来或过去一段时间的重要投资事件
3. 对事件进行分类整理（宏观、政策、财报、行业、会议等）
4. 提示事件可能对市场产生的影响

## 回答规范
- 回答结构清晰，使用 Markdown 格式
- 按时间顺序或重要程度排列事件
- 标注事件来源（如财联社、东方财富等）
- 区分"已发生"和"待发生"事件
- 如果数据中没有相关信息，坦诚告知，不要编造
- 对于市场影响的分析保持客观，使用"可能影响""需关注"等措辞

## 事件分类参考
- 宏观：央行政策、经济数据、利率决议等
- 政策：监管政策、行业政策、法律法规等
- 财报：上市公司财报发布、业绩预告等
- 行业：行业动态、产业链事件、重要产品发布等
- 会议：重要会议、论坛、峰会等
- 风险提示：监管处罚、退市风险、黑天鹅事件等

请用中文回答。`;

export async function POST(request: NextRequest) {
  try {
    const { question } = await request.json();

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "问题不能为空" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const availableDates = getAvailableDates();
    if (availableDates.length === 0) {
      return new Response(JSON.stringify({ error: "暂无事件数据" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 取数据范围：从最早可用日期到最晚可用日期（覆盖所有已有数据）
    const minDate = availableDates[0];
    const maxDate = availableDates[availableDates.length - 1];

    const allEvents = loadEventsInRange(minDate, maxDate);

    // 限制事件数量，避免上下文过长（取最新200条）
    const recentEvents = allEvents.slice(-200);

    const eventsText = recentEvents
      .map(
        (e, i) =>
          `${i + 1}. [${e.event_level}] ${e.event_time} - ${e.event_title}\n   摘要：${e.event_summary}\n   来源：${e.source_media}`,
      )
      .join("\n\n");

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const systemContent = `${SYSTEM_PROMPT}\n\n## 数据范围说明\n当前可用事件数据日期范围：${minDate} 至 ${maxDate}。\n如果用户询问超出此范围的日期，请说明数据覆盖范围。\n\n## 事件数据（按时间排序）\n\n${eventsText}`;

    const messages = [
      {
        role: "system" as const,
        content: systemContent,
      },
      {
        role: "user" as const,
        content: question,
      },
    ];

    const stream = client.stream(messages, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.5,
      thinking: "enabled",
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "ready" })}\n\n`),
          );

          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              if (text) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify({ type: "content", text })}\n\n`),
                );
              }
            }
            const additional = (chunk as { additional_kwargs?: { reasoning_content?: string } })
              .additional_kwargs;
            if (additional?.reasoning_content) {
              const text = additional.reasoning_content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: "thinking", text })}\n\n`),
              );
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (streamError) {
          console.error("[CalendarQA] Stream error:", streamError);
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                type: "error",
                message: streamError instanceof Error ? streamError.message : "流式输出异常",
              })}\n\n`,
            ),
          );
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("[CalendarQA] Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "服务异常",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}
