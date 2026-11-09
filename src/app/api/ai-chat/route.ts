import { NextRequest } from "next/server";
import { LLMClient, Config, HeaderUtils } from "@/lib/llm";
import {
  fetchTodayMarketSnapshot,
  formatMarketSnapshotForPrompt,
  todayInShanghai,
  WindError,
} from "@/lib/wind";
import { loadTeacherSystemPrompt } from "@/lib/teacher-skills";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 当日盘面数据缓存（进程内）：成功 10 分钟 TTL；Wind 不可用时负缓存 2 分钟，
// 避免降级期间每条消息都等待 Wind 超时。
let snapshotCache: { date: string; text: string | null; ts: number } | null = null;
const SNAPSHOT_TTL_MS = 10 * 60 * 1000;
const SNAPSHOT_NEG_TTL_MS = 2 * 60 * 1000;

async function getMarketSnapshotText(): Promise<string | null> {
  const today = todayInShanghai();
  const now = Date.now();
  if (snapshotCache && snapshotCache.date === today) {
    const ttl = snapshotCache.text ? SNAPSHOT_TTL_MS : SNAPSHOT_NEG_TTL_MS;
    if (now - snapshotCache.ts < ttl) return snapshotCache.text;
  }
  try {
    const snap = await fetchTodayMarketSnapshot();
    if (!snap) {
      snapshotCache = { date: today, text: null, ts: now };
      return null;
    }
    const text = formatMarketSnapshotForPrompt(snap);
    snapshotCache = { date: today, text, ts: now };
    return text;
  } catch (err) {
    console.error(
      "[ai-chat] Wind 盘面数据获取失败，降级为无数据对话:",
      err instanceof WindError ? `${err.code} ${err.message}` : err,
    );
    snapshotCache = { date: today, text: null, ts: now };
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      teacher?: string;
      message?: string;
      messages?: Array<{ role?: string; content?: unknown }>;
    };
    const teacher = typeof body.teacher === "string" ? body.teacher : "ma";
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message) {
      return new Response(
        JSON.stringify({ error: "问题内容不能为空" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    // 从 skills/ 目录加载对应老师的视角 Skill（GitHub 安装），失败回退内置人设
    const systemPrompt = await loadTeacherSystemPrompt(teacher);

    // 构建消息：系统人设 + 今日客观盘面(Wind) + 历史对话 + 当前问题
    // 说明：不注入日报观点/分析，仅注入万得(Wind)提供的今日客观行情数字，
    // 用户问非今日问题时可自由作答，盘面数据仅供参考引用。
    const msgArray: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    // 注入今日客观盘面数据（来自 Wind；取不到则跳过，不影响对话）
    const marketText = await getMarketSnapshotText();
    if (marketText) {
      msgArray.push({
        role: "system",
        content: `${marketText}

以上为今日 A 股客观盘面数据（万得 Wind）。当用户问及今日/当日行情、情绪、量能、指数时，你应优先基于这些客观数字作答，并注明数据来源；回答里凡引用到具体数字必须与上面一致，不得编造。用户若问的是通用方法、历史经验或与今日盘面无关的问题，则按你的人设正常作答，不必强行引用这些数据。`,
      });
    }

    // 历史对话（只接收字符串内容，防止异常类型进入 LLM 调用）
    if (Array.isArray(body.messages)) {
      for (const m of body.messages) {
        if (
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim()
        ) {
          msgArray.push({ role: m.role, content: m.content });
        }
      }
    }

    // 加上当前问题
    msgArray.push({ role: "user", content: message });

    const encoder = new TextEncoder();
    const stream = client.stream(msgArray, {
      model: "doubao-seed-2-0-lite-260215",
      temperature: 0.7,
    });

    const readableStream = new ReadableStream({
      async start(controller) {
        // 客户端断开（关闭弹窗/中断请求/连接丢失）后，底层流已失效，
        // 后续 enqueue/close 会抛 ERR_INVALID_STATE，这里做静默保护。
        let closed = false;
        const safeEnqueue = (data: Uint8Array) => {
          if (closed) return;
          try {
            controller.enqueue(data);
          } catch {
            closed = true;
          }
        };
        const safeClose = () => {
          if (closed) return;
          try {
            controller.close();
          } catch {
            // already closed / errored
          }
          closed = true;
        };

        // 监听客户端断开，提前终止上游 LLM 迭代，避免继续消耗 token
        request.signal.addEventListener("abort", () => {
          closed = true;
        });

        try {
          for await (const chunk of stream) {
            if (closed) break;
            if (chunk.content) {
              const text = chunk.content.toString();
              safeEnqueue(encoder.encode(`data: ${JSON.stringify({ content: text })}\n\n`));
            }
          }
          safeEnqueue(encoder.encode(`data: [DONE]\n\n`));
          safeClose();
        } catch (err) {
          console.error("AI chat stream error:", err);
          safeEnqueue(
            encoder.encode(`data: ${JSON.stringify({ error: "生成失败，请稍后重试" })}\n\n`),
          );
          safeClose();
        }
      },
    });

    return new Response(readableStream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("AI chat error:", error);
    return new Response(
      JSON.stringify({ error: "服务异常，请稍后重试" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
}
