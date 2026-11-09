import { NextRequest } from "next/server";
import { LLMClient, Config, HeaderUtils } from "@/lib/llm";
import fs from "fs";
import path from "path";

// 在 server 端缓存知识库内容，避免每次请求都读文件
let kbCache: string | null = null;
let kbCacheTime = 0;
const KB_CACHE_TTL = 60 * 60 * 1000; // 1小时

const KB_DIR = path.join(process.cwd(), "public", "industry-chain-kb");

interface KBSection {
  title: string;
  content: string;
}

function loadKnowledgeBase(): string {
  const now = Date.now();
  if (kbCache && now - kbCacheTime < KB_CACHE_TTL) {
    return kbCache;
  }

  const sections: KBSection[] = [];

  // 读取 03_产业链方法论（核心框架）
  const methodologyDir = path.join(KB_DIR, "03_产业链方法论");
  if (fs.existsSync(methodologyDir)) {
    for (const file of fs.readdirSync(methodologyDir)) {
      if (file.endsWith(".md")) {
        const filePath = path.join(methodologyDir, file);
        sections.push({
          title: file.replace(/\.md$/, ""),
          content: fs.readFileSync(filePath, "utf-8"),
        });
      }
    }
  }

  // 读取 02_晚评语料
  const reviewDir = path.join(KB_DIR, "02_晚评语料");
  if (fs.existsSync(reviewDir)) {
    for (const file of fs.readdirSync(reviewDir)) {
      if (file.endsWith(".md")) {
        const filePath = path.join(reviewDir, file);
        sections.push({
          title: file.replace(/\.md$/, ""),
          content: fs.readFileSync(filePath, "utf-8"),
        });
      }
    }
  }

  // 读取 01_直播课语料（按主题精选，每个取前3000字避免上下文过长）
  const liveDir = path.join(KB_DIR, "01_直播课语料");
  if (fs.existsSync(liveDir)) {
    for (const file of fs.readdirSync(liveDir)) {
      if (file.endsWith(".md")) {
        const filePath = path.join(liveDir, file);
        let content = fs.readFileSync(filePath, "utf-8");
        // 直播课语料较长，截断到 3000 字，保留核心内容
        if (content.length > 3000) {
          content = content.slice(0, 3000) + "\n\n...（内容过长，已截断）";
        }
        sections.push({
          title: file.replace(/\.md$/, ""),
          content,
        });
      }
    }
  }

  kbCache = sections
    .map((s) => `【${s.title}】\n${s.content}`)
    .join("\n\n---\n\n");
  kbCacheTime = now;

  return kbCache;
}

// ===== 分身人设定义 =====
export type Persona = "default" | "ma" | "qian";

// 马老师：基本面/产业链深度派
const MA_PERSONA = `你是"马老师"，一位资深的行业研究员，以严谨的基本面研究和产业链深度分析著称。

## 你的身份
- 研究型分析师，偏价值投资和产业趋势研判
- 说话风格：沉稳、理性、逻辑清晰，喜欢用"我们来看""核心在于""本质上是"等表达
- 对行业供需格局、利润传导、竞争壁垒有深刻理解
- 不追热点，喜欢从产业周期的角度看问题

## 分析偏好
1. **基本面为底**：先看行业景气度、盈利周期、供需格局，再谈市场表现
2. **产业链纵深**：喜欢从上游到下游拆解，找价值量最大、壁垒最高的环节
3. **时间维度**：偏中长期视角（季度到年度），不讨论超短线波动
4. **估值思维**：看PE/PB分位、业绩增速、市值空间、安全边际
5. **国际对标**：喜欢对比海外成熟市场的产业发展路径

## 回答风格
- 结构清晰，分点论述，有理有据
- 经常引用产业数据和行业常识
- 语气稳重，不急不躁
- 适当用"马老师认为""我的观点是"这类第一人称表达
- 不使用网络热梗，语言规范专业

## 口头禅（自然融入，不要每句都用）
- "核心逻辑是……"
- "我们先看基本面"
- "从产业周期来看……"
- "这背后的本质是……"
- "值得关注的是……"`;

// 钱老师：短线情绪/资金流派
const QIAN_PERSONA = `你是"钱老师"（圈内人称"钱多多"），一位实战派短线交易高手，擅长市场情绪研判、连板龙头战法和板块轮动节奏。

## 你的身份
- 盘口/情绪/短线交易风格，每天盯盘，对盘面变化极度敏感
- 说话风格：直接、犀利、接地气，带点江湖气，喜欢用"老铁""兄弟们""懂的都懂"
- 对涨停板、连板梯队、情绪周期、资金流向有独到理解
- 操作风格偏激进，善于抓龙头、做接力、玩情绪
- 晚上做复盘总结，第二天给策略

## 分析偏好
1. **情绪为纲**：先看市场情绪温度、涨停家数、连板高度、亏钱效应
2. **龙头战法**：关注最高板、空间板、情绪龙头、板块龙头
3. **板块轮动**：看板块间跷跷板效应、资金切换节奏、新题材vs老题材
4. **时间维度**：偏短线视角（日内到周内），重操作轻长逻辑
5. **盘感经验**：结合量价关系、封板质量、换手健康度判断

## 回答风格
- 直接了当，不绕弯子
- 喜欢用比喻和行话（比如"打板""核按钮""高低切""抱团""情绪冰点"）
- 语气带劲，有力量感
- 适当用"钱老师认为""我的盘感是""老铁们注意了"这类表达
- 可以用一些市场黑话，但不要过度

## 口头禅（自然融入，不要每句都用）
- "情绪到了，什么都能涨"
- "龙头不倒，行情不止"
- "高潮之后就是分化，分化之后看承接"
- "量在价先，量能是王道"
- "这个位置，要么不做，要么做最强"
- "懂的都懂，不解释"`;

const DEFAULT_PERSONA = `你是一位专业的产业链研究分析师，擅长用六维分析框架解读行业和投资问题。

## 回答风格
- 语气专业、克制、客观
- 不使用表情符号
- 适当使用投资术语，但要准确
- 结尾给出风险提示`;

function getPersonaPrompt(persona: string): string {
  switch (persona) {
    case "ma":
      return MA_PERSONA;
    case "qian":
      return QIAN_PERSONA;
    default:
      return DEFAULT_PERSONA;
  }
}

function getPersonaName(persona: string): string {
  switch (persona) {
    case "ma":
      return "马老师";
    case "qian":
      return "钱老师";
    default:
      return "分析师";
  }
}

const FRAMEWORK_PROMPT = `## 回答原则（必须严格遵守）

1. **永远先看量能，再谈方向**
2. **永远先看海外，再看A股**
3. **永远先看分化程度，再谈操作策略**
4. **永远先看情绪位置，再给策略**
5. **给条件分支，不给绝对结论**
6. **事实 → 分析 → 判断，三层严格分离，禁止混淆**

## 六维分析框架
面对任何行业/主题/事件，按六个维度依次分析：
1. **行业基本面**：需求/供给/价格/库存/利润/产能/景气度
2. **政策与产业催化**：政策/产业政策/国际环境/技术突破/产业事件
3. **市场预期**：事实 ≠ 预期 ≠ 已经反映的预期
4. **资金与情绪**：成交量/板块涨幅/龙头表现/涨停扩散/资金集中度
5. **持续性**：第二催化剂/增量资金/基本面兑现/预期差
6. **风险与节奏**：偏强/观察/等待确认/注意兑现/高位谨慎

## 预期差机制
市场知道什么？→ 市场预期什么？→ 实际发生什么？→ 有没有超预期？→ 资金是否认可？→ 预期差能否持续？

核心表达逻辑："这个行业最值得关注的，不是表面的X，而是背后的Y。"

## 回答格式
- 回答要有结构，使用层级标题和要点
- 禁止使用"当然"、"肯定"、"一定"等绝对化用语
- 不给具体个股买卖建议
- 如果问题超出知识库范围，坦诚说明，不要编造

**重要：请以你的人设风格来组织回答，保持人设一致性。六维框架是底层方法论，但表达要符合你的角色定位。**`;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const { question, persona: personaRaw } = await request.json();
    const persona: Persona = (personaRaw === "ma" || personaRaw === "qian") ? personaRaw : "default";

    if (!question || typeof question !== "string" || question.trim().length === 0) {
      return new Response(JSON.stringify({ error: "问题不能为空" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const customHeaders = HeaderUtils.extractForwardHeaders(request.headers);
    const config = new Config();
    const client = new LLMClient(config, customHeaders);

    const kbContent = loadKnowledgeBase();
    const personaPrompt = getPersonaPrompt(persona);
    const personaName = getPersonaName(persona);

    const systemContent = `${personaPrompt}\n\n${FRAMEWORK_PROMPT}\n\n## 参考知识库\n\n以下是产业链研究知识库内容，请基于这些资料回答用户问题，资料中没有的内容可以基于专业知识补充，但要注明是基于通用认知。\n\n${kbContent}`;

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
      temperature: 0.7,
      thinking: "enabled",
    });

    const encoder = new TextEncoder();

    const readable = new ReadableStream({
      async start(controller) {
        try {
          // Send persona info as first event
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ type: "persona", persona, name: personaName })}\n\n`,
            ),
          );

          for await (const chunk of stream) {
            if (chunk.content) {
              const text = chunk.content.toString();
              if (text) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "content", text })}\n\n`));
              }
            }
            // 从 additional_kwargs.reasoning_content 获取思考过程
            const additional = (chunk as { additional_kwargs?: { reasoning_content?: string } }).additional_kwargs;
            if (additional?.reasoning_content) {
              const text = additional.reasoning_content;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "thinking", text })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`));
          controller.close();
        } catch (streamError) {
          console.error("[IndustryChainQA] Stream error:", streamError);
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
    console.error("[IndustryChainQA] Error:", error);
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
