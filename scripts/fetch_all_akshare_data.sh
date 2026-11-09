#!/bin/bash
# 使用 akshare 获取所有市场数据

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
PUBLIC_DIR="$PROJECT_DIR/public"

# 创建数据目录
mkdir -p "$PUBLIC_DIR/market-data"
mkdir -p "$PUBLIC_DIR/limit-up-data"

echo "=== 使用 akshare 获取市场数据 ==="

# 获取市场数据
echo "1. 获取市场数据..."
python3 "$SCRIPT_DIR/fetch_market_data_akshare.py" > "$PUBLIC_DIR/market-data/latest.json"
echo "   ✓ 市场数据已保存到 public/market-data/latest.json"

# 获取连板数据（最近 10 个交易日）
echo "2. 获取连板数据..."
for i in {0..9}; do
    DATE=$(date -d "-$i days" +%Y%m%d 2>/dev/null || date -v"-${i}d" +%Y%m%d)
    echo "   获取 $DATE 的连板数据..."
    python3 "$SCRIPT_DIR/fetch_limit_up_data.py" "$DATE" > "$PUBLIC_DIR/limit-up-data/$DATE.json" 2>/dev/null || echo "   ⚠ $DATE 数据获取失败"
done
echo "   ✓ 连板数据已保存到 public/limit-up-data/"

echo ""
echo "=== 数据获取完成 ==="
echo "市场数据：$PUBLIC_DIR/market-data/latest.json"
echo "连板数据：$PUBLIC_DIR/limit-up-data/*.json"

# 获取每日财经事件
echo ""
echo "3. 获取每日财经事件..."
bash "$SCRIPT_DIR/fetch_daily_events.sh" || echo "   ⚠ 每日事件获取失败"
echo "   ✓ 事件数据已保存到 public/daily-events/"
