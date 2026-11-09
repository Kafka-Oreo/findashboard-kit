#!/usr/bin/env python3
"""
获取龙虎榜和大宗交易数据
数据来源：东方财富 (via akshare)
"""

import akshare as ak
from datetime import datetime
import json
import os
import sys


def get_trading_date(date_str: str = None) -> str:
    """获取交易日期，格式 YYYYMMDD"""
    if date_str:
        return date_str
    return datetime.now().strftime("%Y%m%d")


def fetch_lhb_detail(date_str: str) -> dict:
    """获取龙虎榜明细数据（含席位明细）"""
    try:
        # akshare 接口使用 start_date 和 end_date
        df = ak.stock_lhb_detail_em(start_date=date_str, end_date=date_str)
        if df is None or df.empty:
            print(f"[龙虎榜] {date_str} 无数据", file=sys.stderr)
            return {"date": date_str, "items": [], "error": "无数据"}
        
        # 转换为字典列表
        items = []
        for _, row in df.iterrows():
            item = {}
            for col in df.columns:
                val = row[col]
                # 处理 NaN
                if val != val:  # NaN check
                    item[col] = None
                elif hasattr(val, 'strftime'):  # date/datetime 对象
                    item[col] = val.strftime("%Y-%m-%d")
                else:
                    item[col] = val
            
            # 根据上榜原因区分当日单日净额和三周期累计净额
            # 如果上榜原因包含"连续三个交易日内"，则龙虎榜净买额是三周期累计净额
            # 否则是当日单日净额
            reason = item.get('上榜原因', '') or ''
            if '连续三个交易日内' in reason:
                item['净额类型'] = '三日累计净额'
            else:
                item['净额类型'] = '当日单日净额'
            
            items.append(item)
        
        print(f"[龙虎榜汇总] {date_str}: {len(items)} 条记录", file=sys.stderr)
        
        # 获取每个个股的席位明细
        seat_details = []
        seen_seats = set()  # 用于去重
        for item in items:
            code = item.get('代码')
            if not code:
                continue
            
            try:
                # 获取席位明细（只获取一次，数据已包含买入和卖出金额）
                df_seats = ak.stock_lhb_stock_detail_em(symbol=code, date=date_str, flag='买入')
                if df_seats is not None and not df_seats.empty:
                    for _, seat_row in df_seats.iterrows():
                        seat = {}
                        for col in df_seats.columns:
                            val = seat_row[col]
                            if val != val:
                                seat[col] = None
                            else:
                                seat[col] = val
                        seat['代码'] = code
                        seat['名称'] = item.get('名称')
                        seat['净额类型'] = item.get('净额类型')
                        # 添加席位序号用于区分同一营业部的不同席位
                        seat['席位序号'] = seat.get('序号')
                        
                        # 去重：同一股票+同一席位序号只保留一次
                        seat_key = (code, seat.get('序号'))
                        if seat_key not in seen_seats:
                            seen_seats.add(seat_key)
                            seat_details.append(seat)
            except Exception as e:
                print(f"[席位明细] {code} {item.get('名称')} 获取失败：{e}", file=sys.stderr)
                continue
        
        print(f"[席位明细] {date_str}: {len(seat_details)} 条席位记录", file=sys.stderr)
        
        return {
            "date": date_str,
            "items": items,
            "seat_details": seat_details
        }
    except Exception as e:
        print(f"[龙虎榜] 获取失败：{e}", file=sys.stderr)
        return {"date": date_str, "items": [], "error": str(e)}


def fetch_block_trade(date_str: str) -> dict:
    """获取大宗交易数据"""
    try:
        # akshare 接口：stock_dzjy_mrmx(symbol='A股', start_date, end_date)
        df = ak.stock_dzjy_mrmx(symbol="A股", start_date=date_str, end_date=date_str)
        if df is None or df.empty:
            print(f"[大宗交易] {date_str} 无数据", file=sys.stderr)
            return {"date": date_str, "items": [], "error": "无数据"}
        
        # 转换为字典列表
        items = []
        for _, row in df.iterrows():
            item = {}
            for col in df.columns:
                val = row[col]
                if val != val:  # NaN check
                    item[col] = None
                elif hasattr(val, 'strftime'):  # date/datetime 对象
                    item[col] = val.strftime("%Y-%m-%d")
                else:
                    item[col] = val
            items.append(item)
        
        print(f"[大宗交易] {date_str}: {len(items)} 条记录", file=sys.stderr)
        return {"date": date_str, "items": items}
    except Exception as e:
        print(f"[大宗交易] 获取失败：{e}", file=sys.stderr)
        return {"date": date_str, "items": [], "error": str(e)}


def main():
    # 获取日期参数
    date_str = sys.argv[1] if len(sys.argv) > 1 else get_trading_date()
    
    print(f"开始获取 {date_str} 龙虎榜和大宗交易数据...", file=sys.stderr)
    
    # 获取数据
    lhb_data = fetch_lhb_detail(date_str)
    block_data = fetch_block_trade(date_str)
    
    # 确保输出目录存在
    output_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "public", "lhb-data")
    os.makedirs(output_dir, exist_ok=True)
    
    # 保存龙虎榜数据
    lhb_file = os.path.join(output_dir, f"{date_str}.json")
    with open(lhb_file, "w", encoding="utf-8") as f:
        json.dump(lhb_data, f, ensure_ascii=False, indent=2)
    print(f"龙虎榜数据已保存：{lhb_file}", file=sys.stderr)
    
    # 保存大宗交易数据
    block_file = os.path.join(output_dir, f"block-{date_str}.json")
    with open(block_file, "w", encoding="utf-8") as f:
        json.dump(block_data, f, ensure_ascii=False, indent=2)
    print(f"大宗交易数据已保存：{block_file}", file=sys.stderr)
    
    # 同时保存一份 latest.json
    latest_lhb = os.path.join(output_dir, "latest.json")
    with open(latest_lhb, "w", encoding="utf-8") as f:
        json.dump(lhb_data, f, ensure_ascii=False, indent=2)
    
    latest_block = os.path.join(output_dir, "block-latest.json")
    with open(latest_block, "w", encoding="utf-8") as f:
        json.dump(block_data, f, ensure_ascii=False, indent=2)
    
    print("数据获取完成", file=sys.stderr)


if __name__ == "__main__":
    main()
