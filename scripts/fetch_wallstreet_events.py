#!/usr/bin/env python3
"""
获取华尔街见闻和金十数据的重大事件
数据来源：
- 华尔街见闻：https://wallstreetcn.com/calendar
- 金十数据：https://www.jin10.com/calendar.html
"""

import json
import sys
from datetime import datetime, timedelta

def fetch_wallstreet_events(date_str: str) -> list:
    """
    从华尔街见闻获取重大事件
    注意：由于反爬限制，这里使用示例数据
    实际使用时需要配置代理或使用官方 API
    """
    # 示例数据 - 实际使用时替换为真实 API 调用
    events = [
        {
            "time": "09:30",
            "title": "中国 7 月官方制造业 PMI",
            "importance": "high",
            "source": "华尔街见闻",
            "country": "中国",
            "actual": None,
            "forecast": "49.5",
            "previous": "49.7"
        },
        {
            "time": "10:00",
            "title": "中国 7 月财新制造业 PMI",
            "importance": "high",
            "source": "华尔街见闻",
            "country": "中国",
            "actual": None,
            "forecast": "51.2",
            "previous": "51.0"
        },
        {
            "time": "20:30",
            "title": "美国 7 月非农就业人数",
            "importance": "high",
            "source": "金十数据",
            "country": "美国",
            "actual": None,
            "forecast": "18.5 万",
            "previous": "20.6 万"
        },
        {
            "time": "22:00",
            "title": "美国 7 月 ISM 制造业 PMI",
            "importance": "medium",
            "source": "金十数据",
            "country": "美国",
            "actual": None,
            "forecast": "48.5",
            "previous": "48.5"
        }
    ]
    
    return events

def main():
    if len(sys.argv) < 2:
        print(json.dumps([], ensure_ascii=False, indent=2))
        return
    
    date_str = sys.argv[1]
    events = fetch_wallstreet_events(date_str)
    
    # 过滤出高重要性事件（每日 1-2 个）
    high_importance = [e for e in events if e.get('importance') == 'high']
    
    # 输出 JSON
    print(json.dumps(high_importance[:2], ensure_ascii=False, indent=2))

if __name__ == '__main__':
    main()
