#!/bin/bash
# ============================================================
# 每日财经事件抓取 - 统一入口脚本
# ============================================================
# 功能：抓取过去24小时权威财经事件，输出结构化JSON
# 数据源：财联社、东方财富、百度财经日历（via akshare）
#
# 使用方式：
#   bash scripts/fetch_daily_events.sh              # 抓取当天
#   bash scripts/fetch_daily_events.sh 20260807     # 抓取指定日期
#
# 输出文件：public/daily-events/{YYYYMMDD}.json
# ============================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="$PROJECT_DIR/public"
EVENTS_DIR="$PUBLIC_DIR/daily-events"
LOG_DIR="/app/work/logs/bypass"

# 日期参数
TARGET_DATE="${1:-$(date +%Y%m%d)}"

# 验证日期格式
if ! echo "$TARGET_DATE" | grep -qE '^[0-9]{8}$'; then
    echo "错误: 日期格式不正确，应为 YYYYMMDD，收到: $TARGET_DATE" >&2
    exit 1
fi

# 创建目录
mkdir -p "$EVENTS_DIR"
mkdir -p "$LOG_DIR"

echo "============================================"
echo "  每日财经事件抓取"
echo "  目标日期: $TARGET_DATE"
echo "  开始时间: $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"

# 执行 Python 抓取脚本
python3 "$SCRIPT_DIR/fetch_daily_events.py" "$TARGET_DATE" 2>"$LOG_DIR/fetch_daily_events.log"

# 检查结果
OUTPUT_FILE="$EVENTS_DIR/$TARGET_DATE.json"
if [ -f "$OUTPUT_FILE" ]; then
    EVENT_COUNT=$(python3 -c "import json; data=json.load(open('$OUTPUT_FILE')); print(len(data))")
    echo ""
    echo "✓ 抓取完成"
    echo "  输出文件: $OUTPUT_FILE"
    echo "  事件数量: $EVENT_COUNT 条"
    echo "  完成时间: $(date '+%Y-%m-%d %H:%M:%S')"
else
    echo "✗ 抓取失败: 输出文件不存在" >&2
    exit 1
fi

echo "============================================"
