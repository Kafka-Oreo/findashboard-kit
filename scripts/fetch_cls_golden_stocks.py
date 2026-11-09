#!/usr/bin/env python3
"""
获取财联社月度金股数据
数据来源：财联社官网 (cls.cn)
"""

import json
import sys
from datetime import datetime

try:
    import akshare as ak
except ImportError:
    print("Error: akshare not installed. Run: pip install akshare", file=sys.stderr)
    sys.exit(1)


def fetch_cls_golden_stocks(year=None, month=None):
    """
    获取财联社月度金股数据
    
    Returns:
        dict: {
            month: "2026-07",
            mostWatched: [{name, code, broker, count, change}],
            topGainers: [{name, code, broker, change, count}]
        }
    """
    now = datetime.now()
    if year is None:
        year = now.year
    if month is None:
        month = now.month
    
    # 使用 akshare 获取券商金股数据
    # 注意：akshare 的接口可能会变化，需要根据实际情况调整
    try:
        # 获取券商金股数据
        df = ak.stock_lggs_akshare()
        
        if df is None or df.empty:
            return {
                "month": f"{year}-{month:02d}",
                "mostWatched": [],
                "topGainers": [],
                "updateTime": datetime.now().strftime("%Y-%m-%d %H:%M")
            }
        
        # 筛选当月数据
        # 根据实际数据结构调整筛选逻辑
        current_month = f"{year}-{month:02d}"
        
        # 按券商推荐次数排序（关注最多）
        most_watched = []
        # 按涨幅排序（涨幅最多）
        top_gainers = []
        
        # 处理数据
        for _, row in df.iterrows():
            stock = {
                "name": row.get("股票名称", ""),
                "code": row.get("股票代码", ""),
                "broker": row.get("券商", ""),
                "count": int(row.get("推荐次数", 0)),
                "change": float(row.get("涨跌幅", 0))
            }
            most_watched.append(stock)
            top_gainers.append(stock)
        
        # 按推荐次数排序
        most_watched.sort(key=lambda x: x["count"], reverse=True)
        # 按涨幅排序
        top_gainers.sort(key=lambda x: x["change"], reverse=True)
        
        return {
            "month": current_month,
            "mostWatched": most_watched[:10],  # 前 10 个关注最多
            "topGainers": top_gainers[:10],    # 前 10 个涨幅最多
            "updateTime": datetime.now().strftime("%Y-%m-%d %H:%M")
        }
        
    except Exception as e:
        print(f"Error fetching data: {e}", file=sys.stderr)
        return {
            "month": f"{year}-{month:02d}",
            "mostWatched": [],
            "topGainers": [],
            "updateTime": datetime.now().strftime("%Y-%m-%d %H:%M"),
            "error": str(e)
        }


if __name__ == "__main__":
    year = int(sys.argv[1]) if len(sys.argv) > 1 else None
    month = int(sys.argv[2]) if len(sys.argv) > 2 else None
    
    result = fetch_cls_golden_stocks(year, month)
    print(json.dumps(result, ensure_ascii=False, indent=2))
