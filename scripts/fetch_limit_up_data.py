#!/usr/bin/env python3
"""
获取A股连板行情数据
使用 akshare 接口获取涨停池数据，清洗后输出JSON格式
"""

import akshare as ak
import json
import sys
from datetime import datetime


def fetch_limit_up_data(date: str) -> list:
    """
    获取指定日期的涨停池数据
    
    Args:
        date: 日期字符串，格式 YYYYMMDD
    
    Returns:
        连板数据列表
    """
    try:
        # 调用 akshare 接口获取涨停池数据
        df = ak.stock_zt_pool_em(date=date)
        
        # 数据清洗
        # 1. 去除空值
        df = df.dropna(subset=['代码', '名称', '连板数'])
        
        # 2. 只保留连板股票（连板数 > 0）
        df = df[df['连板数'] > 0]
        
        # 3. 去重（按股票代码）
        df = df.drop_duplicates(subset=['代码'])
        
        # 4. 统一格式
        result = []
        for _, row in df.iterrows():
            result.append({
                'code': str(row['代码']).zfill(6),  # 确保6位代码
                'name': str(row['名称']),
                'changePercent': round(float(row['涨跌幅']), 2),
                'price': round(float(row['最新价']), 2),
                'volume': round(float(row['成交额']), 2),
                'turnoverRate': round(float(row['换手率']), 2),
                'sealedCapital': round(float(row['封板资金']), 2),
                'firstSealTime': str(row['首次封板时间']),
                'lastSealTime': str(row['最后封板时间']),
                'brokenCount': int(row['炸板次数']),
                'limitUpStats': str(row['涨停统计']),
                'consecutiveDays': int(row['连板数']),
                'industry': str(row['所属行业'])
            })
        
        # 5. 按连板数降序排序
        result.sort(key=lambda x: x['consecutiveDays'], reverse=True)
        
        return result
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fetch_limit_up_data.py <date>", file=sys.stderr)
        print("  date format: YYYYMMDD (e.g., 20260723)", file=sys.stderr)
        sys.exit(1)
    
    date = sys.argv[1]
    
    # 验证日期格式
    try:
        datetime.strptime(date, '%Y%m%d')
    except ValueError:
        print(f"Error: Invalid date format '{date}'. Expected YYYYMMDD.", file=sys.stderr)
        sys.exit(1)
    
    # 获取数据
    data = fetch_limit_up_data(date)
    
    # 输出JSON
    print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
