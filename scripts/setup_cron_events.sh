#!/bin/bash
# ============================================================
# 设置每日财经事件抓取定时任务（每日两次：凌晨5点 + 傍晚18点
# ============================================================
# 使用方式：
#   bash scripts/setup_cron_events.sh        # 安装定时任务
#   bash scripts/setup_cron_events.sh remove  # 移除定时任务
# ============================================================

set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_PATH="$PROJECT_ROOT/scripts/fetch_all_daily_events.sh"
LOG_PATH="$PROJECT_ROOT/logs/cron_events.log"

mkdir -p "$PROJECT_ROOT/logs"

# 检查环境
if ! command -v python3 &> /dev/null; then
    echo "错误：未找到 python3"
    exit 1
fi

ACTION="${1:-install}"

if [ "$ACTION" = "remove" ]; then
    # 移除定时任务
    if crontab -l 2>/dev/null | grep -q "fetch_all_daily_events.sh"; then
        crontab -l 2>/dev/null | grep -v "fetch_all_daily_events.sh" | crontab -
        echo "已移除财经事件抓取定时任务"
    else
        echo "未找到相关定时任务"
    fi
    exit 0
fi

# 安装定时任务
# 每天 05:00 和 18:00 各运行一次（北京时间），周一至周五
CRON_MORNING="0 5 * * 1-5 /bin/bash $SCRIPT_PATH >> $LOG_PATH 2>&1"
CRON_EVENING="0 18 * * 1-5 /bin/bash $SCRIPT_PATH >> $LOG_PATH 2>&1"

if crontab -l 2>/dev/null | grep -q "fetch_all_daily_events.sh"; then
    echo "定时任务已存在，当前配置："
    crontab -l | grep "fetch_all_daily_events.sh"
else
    (crontab -l 2>/dev/null; echo "$CRON_MORNING") | crontab -
    (crontab -l 2>/dev/null; echo "$CRON_EVENING") | crontab -
    echo "定时任务已添加："
    echo "  $CRON_MORNING"
    echo "  $CRON_EVENING"
fi

echo ""
echo "当前所有定时任务："
crontab -l 2>/dev/null || echo "  无"

echo ""
echo "日志文件：$LOG_PATH"
echo ""
echo "手动测试："
echo "  bash $SCRIPT_PATH"
echo ""
echo "查看日志："
echo "  tail -f $LOG_PATH"
echo ""
echo "移除任务："
echo "  bash $0 remove"
