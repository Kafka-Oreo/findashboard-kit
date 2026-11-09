#!/bin/bash
# 启动每日自动数据采集任务

cd "$(dirname "$0")/../python"

echo "========================================"
echo "  AkShare 每日自动数据采集任务"
echo "========================================"
echo ""
echo "任务时间: 每天 05:00 (北京时间)"
echo "数据来源: AkShare"
echo ""
echo "按 Ctrl+C 停止任务"
echo "========================================"
echo ""

python3 task.py
