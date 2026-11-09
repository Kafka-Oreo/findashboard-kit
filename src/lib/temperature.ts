/**
 * 市场情绪温度计算
 * ------------------------------------------------------------------
 * 四因子加权打分，输出 -80 ~ +100 的温度分数：
 *
 *   1. 涨跌比  (-50 ~ +50)  权重最大，反映市场广度
 *      ratioScore = (upCount - downCount) / (upCount + downCount) * 50
 *
 *   2. 涨停家数 (0 ~ +30)  每 3 家涨停 +1 分，90 家封顶
 *      limitUpScore = min(limitUp / 3, 30)
 *
 *   3. 跌停家数 (-30 ~ 0)  每 2 家跌停 -1 分，60 家封顶
 *      limitDownScore = -min(limitDown / 2, 30)
 *
 *   4. 最高连板 (0 ~ +20)  每 1 板 +3 分，7 板封顶
 *      boardScore = min(maxBoard * 3, 20)
 *
 * 理论最大 +100（全市场上涨 + 涨停≥90 + 连板≥7），
 * 理论最小  -80（全市场下跌 + 跌停≥60，连板为 0 不扣分）。
 *
 * 全部参数集中在 TEMPERATURE_WEIGHTS，需要调参只改这一处。
 */

import type { LadderStep, ReportData } from './types';

export const TEMPERATURE_WEIGHTS = {
  /** 涨跌比满分量程（±） */
  ratioMax: 50,
  /** 涨停得分上限，以及每多少家涨停得 1 分 */
  limitUpMax: 30,
  limitUpPer: 3,
  /** 跌停扣分上限，以及每多少家跌停扣 1 分 */
  limitDownMax: 30,
  limitDownPer: 2,
  /** 连板得分上限，以及每 1 连板得几分 */
  boardMax: 20,
  boardPer: 3,
  /** 最终分数区间 */
  scoreMin: -80,
  scoreMax: 100,
} as const;

export interface TemperatureInput {
  /** 涨停家数 */
  limitUp: number;
  /** 跌停家数 */
  limitDown: number;
  /** 上涨家数 */
  upCount: number;
  /** 下跌家数 */
  downCount: number;
  /** 最高连板数（1 = 只有首板） */
  maxBoard: number;
}

/** 四个因子的得分明细，用于透明化展示 */
export interface TemperatureBreakdown {
  ratio: number;
  limitUp: number;
  limitDown: number;
  board: number;
}

export type TemperatureLevel = '过热' | '活跃' | '正常' | '偏冷' | '次冰' | '深冰';

/** 与 src/app/globals.css 中的温度配色类保持一致 */
export type TemperatureTipClass =
  | 'tip-hot'
  | 'tip-warm'
  | 'tip-normal'
  | 'tip-cool'
  | 'tip-cold'
  | 'tip-frozen';

export interface TemperatureResult {
  /** 最终温度分数，-80 ~ +100 */
  score: number;
  /** 各因子得分 */
  breakdown: TemperatureBreakdown;
  level: TemperatureLevel;
  tipClass: TemperatureTipClass;
  tipIcon: string;
  color: string;
  /** 用于温度计指针旁的文字，如 "44° 正常" */
  label: string;
  /** 一句话结论（不含具体数字） */
  summary: string;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

/** 保留 1 位小数，避免 -0 这类显示 */
const round1 = (value: number) => {
  const r = Math.round(value * 10) / 10;
  return Object.is(r, -0) ? 0 : r;
};

const num = (value: unknown) => {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** 温度等级划分：与温度计刻度（+75/+50/+25/0/-25）一一对应 */
export function getTemperatureLevel(score: number): {
  level: TemperatureLevel;
  tipClass: TemperatureTipClass;
  tipIcon: string;
  color: string;
  summary: string;
} {
  if (score >= 75) {
    return {
      level: '过热',
      tipClass: 'tip-hot',
      tipIcon: '🔴',
      color: '#991b1b',
      summary: '市场极度亢奋，涨停与连板高度共振，注意追高风险',
    };
  }
  if (score >= 50) {
    return {
      level: '活跃',
      tipClass: 'tip-warm',
      tipIcon: '🟠',
      color: '#ef4444',
      summary: '情绪活跃，赚钱效应较好，可积极参与主线',
    };
  }
  if (score >= 25) {
    return {
      level: '正常',
      tipClass: 'tip-normal',
      tipIcon: '🟡',
      color: '#eab308',
      summary: '多空相对均衡，情绪平稳，结构性机会为主',
    };
  }
  if (score >= 0) {
    return {
      level: '偏冷',
      tipClass: 'tip-cool',
      tipIcon: '🟢',
      color: '#22c55e',
      summary: '情绪转弱，赚钱效应回落，宜控制仓位',
    };
  }
  if (score >= -25) {
    return {
      level: '次冰',
      tipClass: 'tip-cold',
      tipIcon: '🔵',
      color: '#3b82f6',
      summary: '市场低迷，跌停占优，等待企稳信号',
    };
  }
  return {
    level: '深冰',
    tipClass: 'tip-frozen',
    tipIcon: '❄️',
    color: '#1e40af',
    summary: '市场恐慌，风险偏好极低，以观望为主',
  };
}

/**
 * 计算市场情绪温度（核心函数）
 *
 * @example
 * calculateTemperature({ limitUp: 51, limitDown: 15, upCount: 1891, downCount: 3564, maxBoard: 4 })
 * // → { score: 6, breakdown: { ratio: -15.3, limitUp: 17, limitDown: -7.5, board: 12 }, level: '偏冷', ... }
 */
export function calculateTemperature(input: TemperatureInput): TemperatureResult {
  const limitUp = num(input.limitUp);
  const limitDown = num(input.limitDown);
  const upCount = num(input.upCount);
  const downCount = num(input.downCount);
  const maxBoard = num(input.maxBoard);

  const w = TEMPERATURE_WEIGHTS;

  // 1. 涨跌比得分 -50 ~ +50，涨跌家数全为 0 时记 0 分
  const total = upCount + downCount;
  const ratioRaw = total > 0 ? ((upCount - downCount) / total) * w.ratioMax : 0;
  const ratio = round1(clamp(ratioRaw, -w.ratioMax, w.ratioMax));

  // 2. 涨停得分 0 ~ +30
  const limitUpScore = round1(Math.min(limitUp / w.limitUpPer, w.limitUpMax));

  // 3. 跌停扣分 -30 ~ 0
  const limitDownScore = round1(-Math.min(limitDown / w.limitDownPer, w.limitDownMax));

  // 4. 连板得分 0 ~ +20（首板不算高度，故按 (maxBoard - 1) 或不减？）
  //    口径：直接使用最高连板数，1 板 = 3 分，与「连板高度越高情绪越热」一致
  const boardScore = round1(Math.min(maxBoard * w.boardPer, w.boardMax));

  // 5. 汇总并夹取到区间
  const raw = ratio + limitUpScore + limitDownScore + boardScore;
  const score = Math.round(clamp(raw, w.scoreMin, w.scoreMax));

  const meta = getTemperatureLevel(score);

  return {
    score,
    breakdown: {
      ratio,
      limitUp: limitUpScore,
      limitDown: limitDownScore,
      board: boardScore,
    },
    label: `${score}° ${meta.level}`,
    ...meta,
  };
}

/** 从连板梯队数据中取最高连板数（tier 字段，首板为 1） */
export function getMaxBoard(ladder?: LadderStep[]): number {
  if (!ladder || ladder.length === 0) return 0;
  return ladder.reduce((max, step) => {
    const tier = num(step?.tier);
    return tier > max ? tier : max;
  }, 0);
}

/** 生成温度解读文案：结论 + 四因子明细 →（有人工备注时追加备注，否则补一行基础统计） */
export function buildTemperatureTipHtml(
  result: TemperatureResult,
  input: TemperatureInput,
  note?: string,
): string {
  const { score, breakdown, level, tipIcon } = result;
  const sign = (v: number) => (v > 0 ? `+${v}` : `${v}`);

  const conclusion =
    `情绪温度 <b>${score}°，处于${level}区间${tipIcon}</b>（${result.summary}）。` +
    `分项：涨跌比 <b>${sign(breakdown.ratio)}</b>、涨停 <b>${sign(breakdown.limitUp)}</b>、` +
    `跌停 <b>${sign(breakdown.limitDown)}</b>、连板 <b>${sign(breakdown.board)}</b>。`;

  if (note) return `${conclusion}<br>${note}`;

  const upCount = num(input.upCount);
  const downCount = num(input.downCount);
  const total = upCount + downCount;
  const upRatio = total > 0 ? ((upCount / total) * 100).toFixed(1) : '0.0';

  return (
    conclusion +
    `当日<b>上涨${upCount}家、下跌${downCount}家</b>（上涨占比${upRatio}%），` +
    `涨停${num(input.limitUp)}家、跌停${num(input.limitDown)}家，最高${num(input.maxBoard)}连板。`
  );
}

/** 页面最终渲染用的温度块 */
export interface ResolvedTemperature {
  score: number;
  label: string;
  tipClass: TemperatureTipClass;
  tipIcon: string;
  tipHtml: string;
  level: TemperatureLevel;
  breakdown?: TemperatureBreakdown;
}

/**
 * 解析一份日报的温度：
 * - 若存在 summary（上涨/下跌/涨停/跌停家数），一律按四因子公式自动计算；
 *   连板高度取自 ladder 的最大 tier。
 * - summary 缺失时回退到报告里手填的温度字段（兼容旧数据）。
 */
export function resolveTemperature(
  report: Pick<ReportData, 'summary' | 'ladder' | 'temperature'>,
): ResolvedTemperature {
  const summary = report.summary;
  const manual = report.temperature;

  if (summary && (summary.advance || summary.decline || summary.limitUp || summary.limitDown)) {
    const input: TemperatureInput = {
      limitUp: summary.limitUp ?? 0,
      limitDown: summary.limitDown ?? 0,
      upCount: summary.advance ?? 0,
      downCount: summary.decline ?? 0,
      maxBoard: getMaxBoard(report.ladder),
    };
    const result = calculateTemperature(input);
    return {
      score: result.score,
      label: result.label,
      tipClass: result.tipClass,
      tipIcon: result.tipIcon,
      tipHtml: manual?.tipHtml
        ? manual.tipHtml
        : buildTemperatureTipHtml(result, input, manual?.note),
      level: result.level,
      breakdown: result.breakdown,
    };
  }

  const score = num(manual?.score);
  const meta = getTemperatureLevel(score);
  return {
    score,
    label: manual?.label ?? `${score}° ${meta.level}`,
    tipClass: (manual?.tipClass as TemperatureTipClass) ?? meta.tipClass,
    tipIcon: manual?.tipIcon ?? meta.tipIcon,
    tipHtml: manual?.tipHtml ?? manual?.note ?? meta.summary,
    level: meta.level,
  };
}
