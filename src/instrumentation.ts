/**
 * Next.js Instrumentation
 *
 * 服务启动时按需初始化定时任务调度器（每天 05:00 自动抓取财经事件）。
 *
 * 调度器为可选增强，默认关闭。启用需同时满足：
 *   1. 环境变量 ENABLE_EVENTS_SCHEDULER=1
 *   2. Python 3.8+ 与 akshare 可用（scripts/fetch_daily_events.py）
 *   3. 如需写入数据库：DATABASE_URL（可选，纯静态 JSON 模式无需）
 */

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.ENABLE_EVENTS_SCHEDULER !== '1') return;

  const { startScheduler } = await import('./lib/daily-events-scheduler');
  startScheduler();
}
