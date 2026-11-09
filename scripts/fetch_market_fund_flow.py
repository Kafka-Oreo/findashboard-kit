#!/usr/bin/env python3
"""
使用 akshare 获取大盘主力资金流向数据
数据来源：东方财富网-数据中心-资金流向-大盘
"""

import akshare as ak
import json
import sys
from datetime import datetime


def fetch_market_fund_flow(days: int = 10) -> list:
    """
    获取大盘主力资金流向数据
    
    Args:
        days: 获取天数
    
    Returns:
        资金流向数据列表
    """
    try:
        df = ak.stock_market_fund_flow()
        
        # 取最近 N 天数据
        df = df.tail(days)
        
        result = []
        for _, row in df.iterrows():
            # 解析日期
            date_str = str(row['日期'])
            if len(date_str) == 8:
                date_formatted = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"
            else:
                date_formatted = date_str
            
            # 获取主力净流入（单位：元，转换为亿元）
            main_net_inflow = float(row.get('主力净流入-净额', 0))
            main_net_inflow_yi = round(main_net_inflow / 100000000, 2)
            
            result.append({
                'date': date_formatted,
                'mainNetInflow': main_net_inflow_yi,
            })
        
        return result
    except Exception as e:
        print(f"Error fetching market fund flow: {e}", file=sys.stderr)
        return []


def main():
    """
    主函数：获取大盘资金流向数据并输出 JSON
    """
    try:
        days = int(sys.argv[1]) if len(sys.argv) > 1 else 10
        data = fetch_market_fund_flow(days)
        
        # 输出 JSON
        result = {
            'dates': [d['date'] for d in data],
            'values': [d['mainNetInflow'] for d in data],
            'data': data,
        }
        
        print(json.dumps(result, ensure_ascii=False, indent=2))
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
