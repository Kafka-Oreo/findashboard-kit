#!/usr/bin/env python3
"""
获取A股涨跌停统计数据
使用 akshare 接口获取涨停池和跌停池数据，统计每日涨跌停数量
"""

import akshare as ak
import json
import sys
from datetime import datetime, timedelta


def fetch_limit_stats(date: str) -> dict:
    """
    获取指定日期的涨跌停统计数据
    
    Args:
        date: 日期字符串，格式 YYYYMMDD
    
    Returns:
        涨跌停统计数据
    """
    result = {
        'date': date,
        'limitUp': 0,  # 涨停数量
        'limitDown': 0,  # 跌停数量
        'upCount': 0,  # 上涨家数
        'downCount': 0,  # 下跌家数
        'flatCount': 0,  # 平盘家数
    }
    
    try:
        # 获取涨停池数据
        try:
            df_zt = ak.stock_zt_pool_em(date=date)
            if df_zt is not None and len(df_zt) > 0:
                result['limitUp'] = len(df_zt)
        except Exception as e:
            print(f"Warning: Failed to fetch limit up data: {e}", file=sys.stderr)
        
        # 获取跌停池数据
        try:
            df_dt = ak.stock_zt_pool_dtgc_em(date=date)
            if df_dt is not None and len(df_dt) > 0:
                result['limitDown'] = len(df_dt)
        except Exception as e:
            print(f"Warning: Failed to fetch limit down data: {e}", file=sys.stderr)
        
        # 获取市场概况数据（上涨/下跌家数）
        try:
            # 使用东方财富的市场概况接口
            df_market = ak.stock_market_activity_legu()
            if df_market is not None and len(df_market) > 0:
                # 查找指定日期的数据
                date_formatted = f"{date[:4]}-{date[4:6]}-{date[6:8]}"
                row = df_market[df_market['日期'] == date_formatted]
                if len(row) > 0:
                    result['upCount'] = int(row.iloc[0].get('上涨家数', 0))
                    result['downCount'] = int(row.iloc[0].get('下跌家数', 0))
                    result['flatCount'] = int(row.iloc[0].get('平盘家数', 0))
        except Exception as e:
            print(f"Warning: Failed to fetch market activity data: {e}", file=sys.stderr)
        
        return result
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


def fetch_multi_day_stats(dates: list) -> list:
    """
    获取多日的涨跌停统计数据
    
    Args:
        dates: 日期列表，格式 YYYYMMDD
    
    Returns:
        涨跌停统计数据列表
    """
    results = []
    for date in dates:
        stats = fetch_limit_stats(date)
        results.append(stats)
    return results


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 fetch_limit_stats.py <date1> [date2] [date3] ...", file=sys.stderr)
        print("  date format: YYYYMMDD (e.g., 20260723)", file=sys.stderr)
        sys.exit(1)
    
    dates = sys.argv[1:]
    
    # 验证日期格式
    for date in dates:
        try:
            datetime.strptime(date, '%Y%m%d')
        except ValueError:
            print(f"Error: Invalid date format '{date}'. Expected YYYYMMDD.", file=sys.stderr)
            sys.exit(1)
    
    # 获取数据
    if len(dates) == 1:
        data = fetch_limit_stats(dates[0])
    else:
        data = fetch_multi_day_stats(dates)
    
    # 输出JSON
    print(json.dumps(data, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
