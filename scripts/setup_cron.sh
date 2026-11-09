#!/bin/bash
# 设置每日自动更新 A 股收盘日报的定时任务
# 每个交易日（周一到周五）17:15 自动运行

# 获取项目根目录
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPT_PATH="$PROJECT_ROOT/scripts/auto_update_daily_report.py"
LOG_PATH="$PROJECT_ROOT/logs/auto_update.log"

# 创建日志目录
mkdir -p "$PROJECT_ROOT/logs"

# 检查 Python 和 akshare 是否已安装
if ! command -v python3 &> /dev/null; then
    echo "错误：未找到 python3，请先安装 Python 3.8+"
    exit 1
fi

if ! python3 -c "import akshare" &> /dev/null; then
    echo "错误：未安装 akshare，请运行：pip install akshare"
    exit 1
fi

# 添加 cron job
# 格式：分 时 日 月 星期 命令
# 17:15 运行，仅在周一到周五（1-5）
CRON_JOB="15 17 * * 1-5 cd $PROJECT_ROOT && python3 $SCRIPT_PATH >> $LOG_PATH 2>&1"

# 检查是否已存在相同的 cron job
if crontab -l 2>/dev/null | grep -q "$SCRIPT_PATH"; then
    echo "定时任务已存在，无需重复添加"
    crontab -l | grep "$SCRIPT_PATH"
else
    # 添加 cron job
    (crontab -l 2>/dev/null; echo "$CRON_JOB") | crontab -
    echo "定时任务已添加："
    echo "$CRON_JOB"
fi

# 显示当前 cron jobs
echo ""
echo "当前所有定时任务："
crontab -l 2>/dev/null || echo "无定时任务"

echo ""
echo "日志文件位置：$LOG_PATH"
echo ""
echo "手动测试运行："
echo "  python3 $SCRIPT_PATH"
echo ""
echo "查看定时任务日志："
echo "  tail -f $LOG_PATH"
echo ""
echo "删除定时任务："
echo "  crontab -e  # 然后删除对应行"
echo "  或 crontab -r  # 删除所有定时任务"
