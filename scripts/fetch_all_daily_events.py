#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一入口：抓取过去 24 小时权威财经事件

用法：
  python3 scripts/fetch_all_daily_events.sh      # 抓取昨天（自动判定）
  python3 scripts/fetch_daily_events.py 20260723 # 抓取指定日期

数据输出位置：
  public/daily-events/{YYYYMMDD}.json

核心原则（最高优先级）：
  - 所有数据必须来自真实 akshare 数据源响应
  - 禁止手工编造新闻 / 数字 / 来源 / URL
  - 禁止按 URL 规律拼接不存在的链接
  - 抓取完全失败时不写 JSON（返回 None）
  - 每个数据源独立 try/except，记录 success/failed 状态
"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__))))

from fetch_daily_events import (
    fetch_daily_events,
    save_events,
    target_date,
    source_status,
)
from datetime import datetime


def main():
    # 记录抓取开始时间
    start_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    print(f"[{start_time}] 开始抓取财经事件，目标日期：{target_date}", file=sys.stderr)

    # 真实抓取（内部逐源 try/except，失败不造假）
    events = fetch_daily_events(target_date)

    # 根据数据源成功情况判定状态
    success_count = sum(1 for s in source_status.values() if s.get("success"))
    total_sources = len(source_status)
    if success_count == 0:
        data_status = "failed"
    elif success_count < total_sources:
        data_status = "partial"
    else:
        data_status = "verified"

    # 保存（完全失败时不写文件）
    output_file = save_events(events, target_date, source_status, data_status)

    # 输出摘要（stdout，供调用方解析）
    result = {
        "date": target_date,
        "data_status": data_status,
        "count": len(events),
        "sources_total": total_sources,
        "sources_success": success_count,
        "source_status": source_status,
        "file": output_file,
        "events": events,
    }

    import json
    print(json.dumps(result, ensure_ascii=False, indent=2))

    # 完全失败时以非 0 退出码结束，便于 cron/调度器识别
    if data_status == "failed":
        print("[ERROR] 所有数据源抓取失败，未写入数据文件", file=sys.stderr)
        sys.exit(2)


if __name__ == "__main__":
    main()
