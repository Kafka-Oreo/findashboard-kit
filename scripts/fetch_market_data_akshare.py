#!/usr/bin/env python3
"""
使用 akshare 获取 A 股市场数据
包括：指数 K 线、成交量、板块数据等
"""

import akshare as ak
import json
import sys
from datetime import datetime, timedelta


def fetch_index_kline(symbol: str, days: int = 10) -> list:
    """
    获取指数日 K 线数据
    
    Args:
        symbol: 指数代码 (sh000001, sz399001, sz399006)
        days: 获取天数
    
    Returns:
        K 线数据列表
    """
    try:
        # akshare 使用不同的指数代码格式
        ak_symbol = symbol.replace('sh', '').replace('sz', '')
        
        # 获取日 K 线数据
        df = ak.stock_zh_index_daily(symbol=f"sh{ak_symbol}" if symbol.startswith('sh') else f"sz{ak_symbol}")
        
        # 取最近 N 天数据
        df = df.tail(days)
        
        result = []
        for _, row in df.iterrows():
            result.append({
                'day': row['date'].strftime('%Y-%m-%d'),
                'open': round(float(row['open']), 2),
                'close': round(float(row['close']), 2),
                'high': round(float(row['high']), 2),
                'low': round(float(row['low']), 2),
                'volume': int(row['volume']),
            })
        
        return result
    except Exception as e:
        print(f"Error fetching {symbol}: {e}", file=sys.stderr)
        return []


def fetch_sector_data() -> list:
    """
    获取板块数据
    
    Returns:
        板块数据列表
    """
    try:
        # 获取行业板块数据
        df = ak.stock_board_industry_name_em()
        
        result = []
        for _, row in df.iterrows():
            result.append({
                'code': str(row['板块代码']),
                'name': str(row['板块名称']),
                'change': round(float(row.get('最新涨跌幅', 0)), 2),
                'volume': int(row.get('总成交额', 0)),
            })
        
        return result
    except Exception as e:
        print(f"Error fetching sector data: {e}", file=sys.stderr)
        return []


def main():
    """
    主函数：获取所有市场数据并输出 JSON
    """
    try:
        # 获取主要指数 K 线数据
        sh_data = fetch_index_kline('sh000001', 15)  # 上证指数
        sz_data = fetch_index_kline('sz399001', 15)  # 深证成指
        cy_data = fetch_index_kline('sz399006', 15)  # 创业板指
        
        # 获取板块数据
        sector_data = fetch_sector_data()
        
        # 获取交易日列表
        trading_days = [d['day'] for d in sh_data[-7:]] if sh_data else []
        
        # 输出 JSON
        result = {
            'indices': {
                'sh': sh_data,
                'sz': sz_data,
                'cy': cy_data,
            },
            'tradingDays': trading_days,
            'sectors': sector_data,
            'lastUpdated': datetime.now().isoformat(),
        }
        
        print(json.dumps(result, ensure_ascii=False, indent=2))
        
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()
