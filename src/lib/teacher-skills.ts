/**
 * 两位投顾老师的「视角 Skill」加载器
 *
 * Skill 来源（从 GitHub 安装到项目根 skills/ 目录）：
 *  - 马老师：skills/trend-leader-perspective/
 *    （可将自建人设包放到 skills/ 下，改下方映射表即可）
 *  - 钱老师（钱多多）：skills/qian-duoduo-perspective/
 *    https://github.com/Kafka-Oreo/qian-duoduo-perspective
 *
 * 加载策略：标准加载 + 核心方法论（SKILL.md + style/ + methodology/ + 工作流）。
 * 读取结果按 teacher 进程内缓存；文件缺失时回退到内置简版人设，保证对话不中断。
 * 仅服务端读取，不下发前端。
 */

import { readFile } from "node:fs/promises";
import path from "node:path";

export type TeacherId = "ma" | "qianduo";

interface SkillConfig {
  dir: string;
  files: string[];
}

const SKILL_CONFIG: Record<TeacherId, SkillConfig> = {
  ma: {
    dir: "trend-leader-perspective",
    files: [
      "SKILL.md",
      "style/expression-dna.md",
      "style/anti-ai-rules.md",
      "methodology/investment-framework.md",
      "methodology/decision-heuristics.md",
      "methodology/trading-toolkit.md",
      "workflows/analysis-workflow.md",
      "workflows/quality-check.md",
    ],
  },
  qianduo: {
    dir: "qian-duoduo-perspective",
    files: [
      "SKILL.md",
      "style/expression-dna.md",
      "style/anti-ai-rules.md",
      "methodology/investment-framework.md",
      "methodology/decision-heuristics.md",
      "methodology/industry-analysis.md",
      "workflows/quality-check.md",
    ],
  },
};

// 内置简版人设（skill 文件缺失时的兜底）
const FALLBACK_PROMPTS: Record<TeacherId, string> = {
  ma: `你是"马老师"（马老师），一位资深短线交易导师，风格犀利直接，擅长龙头战法、打板、连板梯队分析。
说话语气果断、有江湖气，关注短线情绪、连板高度、龙头辨识度；回答简洁有力、分点陈述。
你不是投资顾问，不构成任何投资建议，仅分享交易经验与思考，所有内容仅供学习交流。`,
  qianduo: `你是"钱多多"，一位稳健型掌门，擅长趋势跟踪、选股、风控。
语气沉稳理性，关注大趋势、资金流向、估值与安全边际，强调风控第一、仓位管理；回答条理清晰，常用"短期看...""中期看..."分层表达。
你不是投资顾问，不构成任何投资建议，仅分享投资理念与方法，所有内容仅供学习交流。`,
};

const skillCache = new Map<TeacherId, string>();

/** 剥离 Markdown 顶部的 YAML frontmatter（--- ... ---） */
function stripFrontmatter(content: string): string {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith("---")) return trimmed;
  const end = trimmed.indexOf("\n---", 3);
  if (end === -1) return trimmed;
  const after = trimmed.indexOf("\n", end + 1);
  return after === -1 ? "" : trimmed.slice(after + 1).trimStart();
}

function skillsRoot(): string {
  return path.join(process.cwd(), "skills");
}

async function loadSkillFiles(teacher: TeacherId): Promise<string | null> {
  const config = SKILL_CONFIG[teacher];
  if (!config) return null;

  const parts: string[] = [];
  let loadedCount = 0;

  for (const rel of config.files) {
    const abs = path.join(skillsRoot(), config.dir, rel);
    try {
      const raw = await readFile(abs, "utf8");
      const body = rel === "SKILL.md" ? stripFrontmatter(raw) : raw.trim();
      if (body) {
        parts.push(`\n\n===== ${rel} =====\n${body}`);
        loadedCount += 1;
      }
    } catch {
      // 单个文件缺失不阻断，继续加载其余文件
    }
  }

  if (loadedCount === 0) return null;
  return parts.join("\n");
}

/**
 * 构建某位老师的完整系统提示词（视角 Skill + 补充约定）。
 * 失败/缺失时回退到内置简版人设。
 */
export async function loadTeacherSystemPrompt(teacher: string): Promise<string> {
  const id: TeacherId = teacher === "qianduo" ? "qianduo" : "ma";

  const cached = skillCache.get(id);
  let skillContent = cached ?? null;
  if (!skillContent) {
    try {
      skillContent = await loadSkillFiles(id);
    } catch (err) {
      console.error(
        `[teacher-skills] 加载 ${id} skill 失败，使用内置人设:`,
        err instanceof Error ? err.message : err,
      );
      skillContent = null;
    }
    if (skillContent) skillCache.set(id, skillContent);
  }

  const base = skillContent ?? FALLBACK_PROMPTS[id];

  return `以下是你（AI 投顾助手）的完整人设与分析框架，请严格遵循其中的身份设定、表达风格、分析方法论与确定性约束：

${base}

【补充约定】
- 全程使用中文，以第一人称、上述老师本人身份与口吻回应，不要跳出角色做元说明。
- 回复使用 Markdown 格式：适当使用加粗、分点/编号列表、小标题，结构清晰、重点突出，避免冗长。
- 严格遵守上述确定性约束：不预测后续涨跌、不给买卖/加减仓/仓位/择时等操作指令、不提供个性化投资建议；涉及行情仅做客观数据陈述与条件式分析（"若…则…"）。
- 今日 A 股客观盘面数据（若有）会作为独立上下文提供；当用户问及今日/当日行情、量能、情绪、指数时，须以该数据为准作答并注明来源（万得 Wind），引用数字须与之一致、不得编造；用户问的是通用方法、历史经验或与今日盘面无关的问题时，按你的人设正常作答，不必强行引用盘面数据。
- 本对话仅为学习交流，不构成投资建议。`;
}
