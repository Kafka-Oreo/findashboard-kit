/**
 * 每日财经事件定时抓取调度器
 *
 * 功能：每天 18:00（北京时间）自动执行当日事件抓取
 * 技术方案：node-cron + Asia/Shanghai 时区
 *
 * - 启动自检：服务启动时检查今日数据是否 verified，否则立即补跑
 * - 健康检查：GET /health 返回调度器运行状态
 * - 手动兜底：POST /api/daily-events 保留
 */

import cron, { type ScheduledTask } from 'node-cron';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

const CRON_EXPRESSION = '0 18 * * *'; // 每天 18:00
const TIMEZONE = 'Asia/Shanghai';

interface FetchResult {
  date: string;
  count: number;
  success: boolean;
  error?: string;
}

interface SchedulerStatus {
  cronRunning: boolean;
  lastUpdate: string | null; // ISO string
  todayVerified: boolean;
  todayDate: string;
  nextRun: string | null;
  timezone: string;
}

class DailyEventsScheduler {
  private task: ScheduledTask | null = null;
  private lastUpdate: Date | null = null;
  private isRunning = false;
  private initialized = false;

  /**
   * 启动调度器（单例）
   */
  start(): void {
    if (this.initialized) {
      this.log('已初始化，跳过');
      return;
    }
    this.initialized = true;

    this.log('==============================');
    this.log('调度器启动中...');
    this.log(`Cron 表达式: ${CRON_EXPRESSION}`);
    this.log(`时区: ${TIMEZONE}`);
    this.log(`下次执行: ${this.getNextRunTime()?.toLocaleString('zh-CN', { timeZone: TIMEZONE }) ?? '未知'}`);
    this.log('==============================');

    // 注册 cron 任务
    try {
      this.task = cron.schedule(
        CRON_EXPRESSION,
        () => {
          this.log('[CRON] 触发每日18:00定时抓取');
          this.runCronFetch();
        },
        {
          timezone: TIMEZONE,
        }
      );
      this.log('Cron 任务注册成功');
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.error(`Cron 注册失败: ${msg}`);
    }

    // 启动自检：今日数据不存在或状态异常，立即补跑
    this.runStartupCheck();
  }

  /**
   * 停止调度器
   */
  stop(): void {
    if (this.task) {
      this.task.stop();
      this.task = null;
    }
    this.initialized = false;
    this.log('调度器已停止');
  }

  /**
   * 手动触发抓取（兜底接口用）
   */
  async triggerFetch(date?: string): Promise<FetchResult> {
    this.log(`[手动触发] 开始抓取 ${date || '今日'} 数据`);
    return this.executeFetch(date);
  }

  /**
   * 获取调度器状态（健康检查用）
   */
  getStatus(): SchedulerStatus {
    const todayStr = this.getTodayStr();
    const todayVerified = this.isTodayVerified(todayStr);

    return {
      cronRunning: this.initialized && this.task !== null,
      lastUpdate: this.lastUpdate ? this.lastUpdate.toISOString() : null,
      todayVerified,
      todayDate: todayStr,
      nextRun: this.getNextRunTime()?.toISOString() ?? null,
      timezone: TIMEZONE,
    };
  }

  // ---- 内部方法 ----

  /**
   * 启动自检
   */
  private async runStartupCheck(): Promise<void> {
    const todayStr = this.getTodayStr();
    this.log(`[启动自检] 检查 ${todayStr} 数据状态...`);

    const verified = this.isTodayVerified(todayStr);
    if (verified) {
      this.log('[启动自检] ✅ 今日数据已 verified，无需补跑');
      return;
    }

    this.log('[启动自检] ⚠️ 今日数据未就绪，立即补跑');
    try {
      const result = await this.executeFetch(todayStr);
      if (result.success) {
        this.log(`[启动自检] ✅ 补跑成功，${result.count} 条事件`);
      } else {
        this.error(`[启动自检] ❌ 补跑失败: ${result.error}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.error(`[启动自检] ❌ 补跑异常: ${msg}`);
    }
  }

  /**
   * Cron 触发的抓取
   */
  private async runCronFetch(): Promise<void> {
    const todayStr = this.getTodayStr();
    this.log(`[Cron 执行] 开始抓取 ${todayStr} 数据`);

    try {
      const result = await this.executeFetch(todayStr);
      if (result.success) {
        this.log(`[Cron 执行] ✅ 完成，共 ${result.count} 条事件`);
      } else {
        this.error(`[Cron 执行] ❌ 失败: ${result.error}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      this.error(`[Cron 执行] ❌ 异常: ${msg}`);
    }
  }

  /**
   * 检查今日数据是否 verified
   */
  private isTodayVerified(dateStr: string): boolean {
    const filePath = path.join(process.cwd(), 'public', 'daily-events', `${dateStr}.json`);
    try {
      if (!fs.existsSync(filePath)) return false;
      const raw = fs.readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw);
      return data.data_status === 'verified' && (data.events?.length || 0) > 0;
    } catch {
      return false;
    }
  }

  /**
   * 获取今日日期字符串（北京时间 YYYYMMDD）
   */
  private getTodayStr(): string {
    const now = new Date();
    const cnDate = new Date(
      now.toLocaleString('en-US', { timeZone: TIMEZONE })
    );
    const y = cnDate.getFullYear();
    const m = String(cnDate.getMonth() + 1).padStart(2, '0');
    const d = String(cnDate.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
  }

  /**
   * 获取下次执行时间
   */
  private getNextRunTime(): Date | null {
    if (!this.task) return null;
    // node-cron 没有直接的 next() 方法，手动计算
    const now = new Date();
    const cnNow = new Date(now.toLocaleString('en-US', { timeZone: TIMEZONE }));
    const next = new Date(cnNow);
    next.setHours(18, 0, 0, 0);
    if (next <= cnNow) {
      next.setDate(next.getDate() + 1);
    }
    // 转回 UTC Date
    return next;
  }

  /**
   * 执行抓取脚本
   */
  private async executeFetch(date?: string): Promise<FetchResult> {
    if (this.isRunning) {
      this.log('上一次抓取尚未完成，跳过本次执行');
      return {
        date: date || '',
        count: 0,
        success: false,
        error: '上一次抓取尚未完成',
      };
    }

    this.isRunning = true;
    const targetDate = date || this.getTodayStr();

    this.log(`开始抓取 ${targetDate} 财经事件...`);

    try {
      const scriptPath = path.join(process.cwd(), 'scripts', 'fetch_daily_events.py');

      const { stdout, stderr } = await execAsync(`python3 "${scriptPath}" ${targetDate}`, {
        timeout: 120 * 1000,
        env: { ...process.env },
      });

      if (stderr && stderr.trim()) {
        this.log(`stderr: ${stderr.trim().slice(0, 300)}`);
      }

      // 解析结果
      let count = 0;
      let success = true;

      try {
        const jsonMatch = stdout.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          count = parsed.events?.length || parsed.count || 0;
          success = parsed.data_status !== 'failed';
        }
      } catch {
        // 解析失败不影响主流程，取默认值
      }

      this.lastUpdate = new Date();
      this.log(`抓取完成: ${count} 条事件，状态: ${success ? '成功' : '失败'}`);

      return { date: targetDate, count, success };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      this.error(`抓取失败: ${errMsg}`);
      return { date: targetDate, count: 0, success: false, error: errMsg };
    } finally {
      this.isRunning = false;
    }
  }

  // ---- 日志工具 ----

  private log(message: string): void {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.log(`[${ts}] [DailyEventsScheduler] ${message}`);
  }

  private error(message: string): void {
    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    console.error(`[${ts}] [DailyEventsScheduler] ERROR: ${message}`);
  }
}

// 全局单例
let schedulerInstance: DailyEventsScheduler | null = null;

export function getScheduler(): DailyEventsScheduler {
  if (!schedulerInstance) {
    schedulerInstance = new DailyEventsScheduler();
  }
  return schedulerInstance;
}

/**
 * 启动调度器（在 instrumentation.ts 中调用，服务端启动时执行）
 */
export function startScheduler(): void {
  if (typeof window !== 'undefined') return;
  const scheduler = getScheduler();
  scheduler.start();
}

export default DailyEventsScheduler;
