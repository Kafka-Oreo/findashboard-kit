#!/bin/bash
# ============================================================
# 定时任务配置脚本
# ============================================================
# 功能：配置系统 cron 定时任务，每天凌晨 5:00 自动抓取财经事件
#
# 使用方式：
#   bash scripts/setup_cron.sh              # 安装定时任务
#   bash scripts/setup_cron.sh --remove     # 移除定时任务
#   bash scripts/setup_cron.sh --status     # 查看当前状态
# ============================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="/app/work/logs/bypass"

# cron 标识
CRON_TAG="# daily-events-fetcher"

setup_cron() {
    echo "=== 配置定时任务 ==="
    echo "任务: 每天凌晨 5:00 抓取财经事件"
    echo "脚本: $SCRIPT_DIR/fetch_daily_events.sh"
    echo "日志: $LOG_DIR/cron_daily_events.log"
    echo ""

    # 确保日志目录存在
    mkdir -p "$LOG_DIR"

    # 移除旧的 cron 条目（如果存在）
    remove_cron_silent

    # 添加新的 cron 条目
    # 格式: 分 时 日 月 周 命令
    CRON_CMD="0 5 * * * /bin/bash $SCRIPT_DIR/fetch_daily_events.sh >> $LOG_DIR/cron_daily_events.log 2>&1 $CRON_TAG"

    (crontab -l 2>/dev/null || echo "") | grep -v "$CRON_TAG" | { cat; echo "$CRON_CMD"; } | crontab -

    echo "✓ 定时任务已安装"
    echo ""
    echo "当前 crontab:"
    crontab -l 2>/dev/null | grep "$CRON_TAG" || echo "  (无)"
    echo ""
    echo "提示: 确保 cron 服务正在运行"
    echo "  检查: service cron status"
    echo "  启动: service cron start"
}

remove_cron() {
    echo "=== 移除定时任务 ==="
    remove_cron_silent
    echo "✓ 定时任务已移除"
}

remove_cron_silent() {
    (crontab -l 2>/dev/null || echo "") | grep -v "$CRON_TAG" | crontab - 2>/dev/null || true
}

show_status() {
    echo "=== 定时任务状态 ==="
    echo ""
    echo "已配置的定时任务:"
    crontab -l 2>/dev/null | grep "$CRON_TAG" || echo "  (无定时任务)"
    echo ""
    echo "最近执行日志:"
    if [ -f "$LOG_DIR/cron_daily_events.log" ]; then
        tail -n 20 "$LOG_DIR/cron_daily_events.log"
    else
        echo "  (暂无日志)"
    fi
}

# 主入口
case "${1:-}" in
    --remove|-r)
        remove_cron
        ;;
    --status|-s)
        show_status
        ;;
    *)
        setup_cron
        ;;
esac
