import { NextRequest } from "next/server";
import { LLMClient, Config, Message } from "@/lib/llm";

export const runtime = "nodejs";

const config = new Config();
const client = new LLMClient(config);

// 马老师 - 多头方向（乐观/进攻型）
const MA_BULL_PROMPT = `你是「马老师（谈笑间228）」，A股短线交易大师，以龙头战法、打板、情绪周期分析著称。
风格：犀利、果断、进攻性强，善于捕捉市场最强方向。
分析框架：情绪周期（启动/发酵/高潮/退潮）、连板梯队健康度、龙头股识别、量价关系。
语言风格：用"我认为"、"核心逻辑是"、"关键观察点"等直接表述，引用具体数据支撑观点。

你的立场：**看多/偏乐观**，从以下维度论证：
1. 情绪面：涨停家数、连板高度、赚钱效应
2. 资金面：主力资金流向、成交量变化
3. 板块面：领涨板块强度与持续性
4. 技术面：关键指数位置、均线支撑压力

论证要求：论点明确，论据具体，每个论点配1-2个数据点支撑，少说空话。
篇幅：300-400字。
输出格式：纯文本，不要用Markdown标题，段落式叙述。`;

// 钱多多 - 空头方向（谨慎/防守型）
const QIAN_BEAR_PROMPT = `你是「钱多多」，稳健型趋势投资者，以资金面分析、基本面筛选、风控管理著称。
风格：理性、严谨、防御性强，善于发现风险和隐患。
分析框架：资金流向验证、板块轮动合理性、基本面支撑、仓位管理与风控。
语言风格：用"需要警惕"、"数据显示"、"风险点在于"等审慎表述，注重数据和逻辑。

你的立场：**看空/偏谨慎**，从以下维度论证：
1. 情绪面：涨停质量、封板率、炸板情况、高位股风险
2. 资金面：主力资金持续性、北向资金、量能真实性
3. 板块面：板块轮动过快/缺乏持续性、领涨板块逻辑薄弱
4. 技术面：压力位、背离信号、指数分化隐患

论证要求：论点明确，论据具体，每个论点配1-2个数据点支撑，注重风险揭示。
篇幅：300-400字。
输出格式：纯文本，不要用Markdown标题，段落式叙述。`;

function buildMarketContext(marketData: string): string {
  if (!marketData) return "";
  return `\n【今日市场数据背景】\n${marketData}\n`;
}

export async function POST(req: NextRequest) {
  try {
    const { question, marketData } = await req.json();

    if (!question || typeof question !== "string") {
      return new Response(JSON.stringify({ error: "问题不能为空" }), { status: 400 });
    }

    const ctx = buildMarketContext(marketData || "");

    const maMessages: Message[] = [
      { role: "system", content: MA_BULL_PROMPT + ctx },
      {
        role: "user",
        content: `用户提问：${question}\n\n请以「马老师」的身份，从多头角度给出你的分析和论证。`,
      },
    ];

    const qianMessages: Message[] = [
      { role: "system", content: QIAN_BEAR_PROMPT + ctx },
      {
        role: "user",
        content: `用户提问：${question}\n\n请以「钱多多」的身份，从空头/谨慎角度给出你的分析和论证。`,
      },
    ];

    const encoder = new TextEncoder();
    let maDone = false;
    let qianDone = false;
    let maContent = "";
    let qianContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        // 同时启动两个流
        const maStream = client.stream(maMessages, {
          temperature: 0.8,
          model: "doubao-seed-2-0-lite-260215",
        });
        const qianStream = client.stream(qianMessages, {
          temperature: 0.7,
          model: "doubao-seed-2-0-lite-260215",
        });

        const maIter = maStream[Symbol.asyncIterator]();
        const qianIter = qianStream[Symbol.asyncIterator]();

        // 交替读取两个流，实现双师同时"发言"
        while (!maDone || !qianDone) {
          let progressed = false;

          if (!maDone) {
            const result = await maIter.next();
            if (result.done) {
              maDone = true;
              controller.enqueue(encoder.encode(`event: ma_done\ndata: {"done": true}\n\n`));
            } else if (result.value?.content) {
              const text = result.value.content.toString();
              maContent += text;
              controller.enqueue(
                encoder.encode(`event: ma\ndata: ${JSON.stringify({ content: text, full: maContent })}\n\n`)
              );
              progressed = true;
            }
          }

          if (!qianDone) {
            const result = await qianIter.next();
            if (result.done) {
              qianDone = true;
              controller.enqueue(encoder.encode(`event: qian_done\ndata: {"done": true}\n\n`));
            } else if (result.value?.content) {
              const text = result.value.content.toString();
              qianContent += text;
              controller.enqueue(
                encoder.encode(
                  `event: qian\ndata: ${JSON.stringify({ content: text, full: qianContent })}\n\n`
                )
              );
              progressed = true;
            }
          }

          if (!progressed && !maDone && !qianDone) {
            // 都没产出就等一下
            await new Promise((resolve) => setTimeout(resolve, 20));
          }
        }

        controller.enqueue(encoder.encode(`event: done\ndata: {"ma": ${JSON.stringify(maContent)}, "qian": ${JSON.stringify(qianContent)}}\n\n`));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("debate error:", error);
    return new Response(
      JSON.stringify({ error: "辩论服务暂时不可用，请稍后再试" }),
      { status: 500 }
    );
  }
}
