#!/bin/bash
# ============================================================
# 每日财经事件抓取 - 统一调度入口
# ============================================================
# 功能：一键抓取过去24小时权威财经事件，输出结构化JSON
# 数据源：东方财富、财联社、百度财经日历（via akshare）
# 输出：public/daily-events/{YYYYMMDD}.json
#
# 使用方式：
#   bash scripts/fetch_all_daily_events.sh              # 抓取当天
#   bash scripts/fetch_all_daily_events.sh 20260810     # 抓取指定日期
#
# 定时任务（每天凌晨5点）：
#   bash scripts/setup_cron_events.sh
# ============================================================

set -euo pipefail

# 项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
LOG_DIR="$PROJECT_DIR/logs"
LOG_FILE="$LOG_DIR/fetch_daily_events.log"

# 创建日志目录
mkdir -p "$LOG_DIR"

# 日期参数
TARGET_DATE="${1:-$(date +%Y%m%d)}"

# 日志函数
log() {
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] $*" | tee -a "$LOG_FILE"
}

# ============================================================
# 环境检查
# ============================================================
check_env() {
    log "===== 环境检查 ====="

    # Python3
    if ! command -v python3 &> /dev/null; then
        log "ERROR: 未找到 python3，请先安装 Python 3.8+"
        exit 1
    fi
    log "Python: $(python3 --version 2>&1)"

    # akshare
    if ! python3 -c "import akshare" &> /dev/null; then
        log "WARN: akshare 未安装，正在安装..."
        pip install akshare -q
        if ! python3 -c "import akshare" &> /dev/null; then
            log "ERROR: akshare 安装失败"
            exit 1
        fi
    fi
    log "akshare: $(python3 -c 'import akshare; print(akshare.__version__)' 2>/dev/null || echo 'unknown')"

    # 数据目录
    mkdir -p "$PROJECT_DIR/public/daily-events"
    log "数据目录: $PROJECT_DIR/public/daily-events/"
}

# ============================================================
# 执行抓取
# ============================================================
run_fetch() {
    log "===== 开始抓取 $TARGET_DATE 财经事件 ====="

    local start_time
    start_time=$(date +%s)

    # 执行抓取脚本
    python3 "$SCRIPT_DIR/fetch_daily_events.py" "$TARGET_DATE" >> "$LOG_FILE" 2>&1
    local exit_code=$?

    local end_time
    end_time=$(date +%s)
    local duration=$((end_time - start_time))

    if [ $exit_code -eq 0 ]; then
        local output_file="$PROJECT_DIR/public/daily-events/${TARGET_DATE}.json"
        if [ -f "$output_file" ]; then
            local count
            count=$(python3 -c "import json; d=json.load(open('$output_file')); print(len(d.get('events', [])))" 2>/dev/null || echo "?")
            log "SUCCESS: 抓取完成，共 $count 条事件，耗时 ${duration}s"
            log "输出文件: $output_file"
        else
            log "WARN: 抓取脚本成功但输出文件不存在"
        fi
    else
        log "ERROR: 抓取脚本失败，退出码: $exit_code"
        exit $exit_code
    fi
}

# ============================================================
# 验证输出
# ============================================================
validate_output() {
    local output_file="$PROJECT_DIR/public/daily-events/${TARGET_DATE}.json"

    if [ ! -f "$output_file" ]; then
        log "WARN: 输出文件不存在，跳过验证"
        return
    fi

    log "===== 验证输出 ====="

    # 检查 JSON 格式
    if python3 -c "import json; json.load(open('$output_file'))" 2>/dev/null; then
        log "JSON 格式: 有效"
    else
        log "ERROR: JSON 格式无效"
        return
    fi

    # 检查必要字段
    python3 << PYEOF >> "$LOG_FILE" 2>&1
import json

with open("$output_file") as f:
    data = json.load(f)

events = data.get("events", [])
print(f"事件数量: {len(events)}")

required_fields = ["event_title", "event_summary", "source_media", "source_url", "event_time", "event_level"]
missing = []
for i, ev in enumerate(events):
    for field in required_fields:
        if field not in ev or not ev[field]:
            missing.append(f"事件{i+1}缺少{field}")

if missing:
    print(f"字段缺失: {len(missing)} 处")
    for m in missing[:5]:
        print(f"  - {m}")
else:
    print("字段完整性: 全部通过")

# 统计各级别
levels = {}
for ev in events:
    lv = ev.get("event_level", "未知")
    levels[lv] = levels.get(lv, 0) + 1
print(f"级别分布: {', '.join(f'{k}:{v}' for k,v in sorted(levels.items()))}")

# 统计各来源
sources = {}
for ev in events:
    src = ev.get("source_media", "未知")
    sources[src] = sources.get(src, 0) + 1
print(f"来源分布: {', '.join(f'{k}:{v}' for k,v in sorted(sources.items()))}")
PYEOF
}

# ============================================================
# 主流程
# ============================================================
main() {
    log ""
    log "=========================================="
    log "  每日财经事件抓取"
    log "  目标日期: $TARGET_DATE"
    log "=========================================="

    check_env
    run_fetch
    validate_output

    log "===== 完成 ====="
    log ""
}

main "$@"
