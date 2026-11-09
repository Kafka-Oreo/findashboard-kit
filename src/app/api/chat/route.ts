import { NextRequest } from "next/server";
import { LLMClient, Config, HeaderUtils } from "@/lib/llm";
import TANXIAOJIAN_SYSTEM_PROMPT from "@/lib/skills/tanxiaojian-228";
import QIANDUODUO_SYSTEM_PROMPT from "@/lib/skills/duoduoceshi";
import { parseMarketDataFromText } from "@/lib/parseMarketData";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 两位老师的完整系统提示词
const TEACHER_PROMPTS = {
  ma: {
    name: '谈笑间228投资助手',
    prompt: TANXIAOJIAN_SYSTEM_PROMPT,
  },
  qian: {
    name: '钱多多投资助手',
    prompt: QIANDUODUO_SYSTEM_PROMPT,
  },
};

// 合并两位老师的系统提示词
const COMBINED_SYSTEM_PROMPT = `你是A股短线投资AI助手，融合了两位资深投资老师的分析框架：

【谈笑间228 · 技术面与情绪周期】
核心能力：趋势判断、龙头识别、打板策略、情绪周期分析
分析框架：
- 市场情绪周期（启动/发酵/高潮/退潮）
- 连板梯队健康度评估
- 龙头股辨识与跟踪
- 量价关系分析

【钱多多 · 资金面与基本面】
核心能力：趋势跟踪、选股策略、风险控制
分析框架：
- 资金流向分析
- 板块轮动规律
- 基本面筛选
- 仓位管理与风控

【综合分析原则】
1. 技术面与基本面结合，给出全面判断
2. 情绪周期与资金流向相互验证
3. 机会与风险并重，不偏不倚
4. 给出具体可操作的建议，避免空泛

【回答范围限制】

**严格禁止一切内容：**
 禁止对板块/个股后续涨跌、行情持续性、周期拐点、反弹/下跌做任何市场预判；
② 禁止给出买入、卖出、低吸、加仓、仓位控制、择时入场、止盈止损、观察K线/均线/连板数量操作策略；
③ 禁止给出任何主观交易忠告、持仓建议

**内容允许输出范围：**
- 当日板块成交额、全市场成交量等客观盘口数据陈述；
- 产业政策、国产替代政策要求、产业链上下游订单、量产落地客观事实；
- 行业产品价格周期、上下游供需、厂商报价博弈客观现状；
- 宏观指标（美债利率）对成长行业估值定价的理论逻辑；
- 行业客观潜在不确定性风险因素罗列。

**仅做【客观行业、产业、板块基本面静态分析】**

【回答风格】
- 专业但不晦涩，用通俗语言解释专业概念
- 数据支撑观点，避免主观臆断
- 风险提示到位，不盲目乐观
- 简洁明了，重点突出
- 客观分析，不做主观判断

【知识库参考】
以下知识库内容供你参考，在回答相关问题时可引用：

## 投资方法论知识库
- 技术分析方法：动态止盈法、关键K线分析、均线组买卖点、缺口理论、斐波那契时间窗口
- 仓位管理：强势上攻7-8成、正常震荡6-7成、弱势企稳4-5成、明显下行3-4成
- 量能参考：>3万亿牛市特征、2.5-3万亿活跃、2-2.5万亿正常、<2万亿缩量低迷
- 15大核心框架：景气增速30%分水岭、AI渗透率位置感、拥挤度分析、牛市终结信号等

## 行业分析知识库
- 行业分析6步法：行业定位→景气度判断→核心指标→收入成本拆解→估值方法→结论
- 10大行业框架：航空机场、保险、传媒、电力、电子、房地产、纺织、钢铁、公路铁路、电力设备
- 估值方法：P/E、P/B、DCF、EV/EBITDA、NAV、P/EV+NBVM、市值/产能

## 市场观点与案例知识库
- AI产业：渗透率28.3%≈1998年互联网，已进入下半场但距终场仍有距离
- 科技轮动："喜新厌旧"迁徙模型，从大板块往细分新方向切
- 实战案例：Meta出售算力（利空实质利好）、光模块拥挤度底部布局、量化杀跌后快速修复
- 市场情绪：共振判断行情质量、拥挤度+龙头比价+海外映射三维择时`;

export async function POST(request: NextRequest) {
  const { messages: userMessages, teacher = "combined" } = await request.json();
  const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);

  // 解析用户最后一条消息中的市场数据
  const lastUserMessage = userMessages[userMessages.length - 1];
  const parsedMarketData = lastUserMessage?.role === "user" 
    ? parseMarketDataFromText(lastUserMessage.content)
    : {};

  const config = new Config();
  const client = new LLMClient(config, customHeaders);

  // 根据老师类型选择对应的系统提示词
  let fullSystemPrompt: string;
  if (teacher === "combined") {
    fullSystemPrompt = COMBINED_SYSTEM_PROMPT;
  } else {
    const teacherConfig = TEACHER_PROMPTS[teacher as keyof typeof TEACHER_PROMPTS] || TEACHER_PROMPTS.ma;
    fullSystemPrompt = teacherConfig.prompt;
  }

  const messages = [
    { role: "system" as const, content: fullSystemPrompt },
    ...userMessages,
  ];

  const stream = client.stream(messages, {
    model: "doubao-seed-2-0-mini-260215",
    temperature: 0.8,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // 首先发送解析后的市场数据
        if (Object.keys(parsedMarketData).length > 0) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ 
                type: "marketData", 
                data: parsedMarketData 
              })}\n\n`
            )
          );
        }

        for await (const chunk of stream) {
          if (chunk.content) {
            const text = chunk.content.toString();
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: "content", content: text })}\n\n`)
            );
          }
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : "Unknown error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`
          )
        );
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
