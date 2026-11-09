#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
板块成份股数据获取脚本
数据源优先级：
1. 东方财富板块主页JSON接口 (akshare)
2. 申万行业成份股 (akshare)
"""

import sys
import json
import akshare as ak
import pandas as pd
from datetime import datetime

# 板块名称映射（用户输入 -> 东方财富标准名称）
SECTOR_NAME_MAP = {
    "医药生物": "医药生物行业",
    "电子": "电子行业",
    "计算机": "计算机行业",
    "机械设备": "机械设备行业",
    "电力设备": "电力设备行业",
    "汽车": "汽车行业",
    "基础化工": "基础化工行业",
    "食品饮料": "食品饮料行业",
    "有色金属": "有色金属行业",
    "房地产": "房地产行业",
    "银行": "银行行业",
    "非银金融": "非银金融行业",
    "交通运输": "交通运输行业",
    "通信": "通信行业",
    "传媒": "传媒行业",
    "煤炭": "煤炭行业",
    "钢铁": "钢铁行业",
    "石油石化": "石油石化行业",
    "建筑材料": "建筑材料行业",
    "建筑装饰": "建筑装饰行业",
    "农林牧渔": "农林牧渔行业",
    "纺织服饰": "纺织服饰行业",
    "轻工制造": "轻工制造行业",
    "商贸零售": "商贸零售行业",
    "社会服务": "社会服务行业",
    "综合": "综合行业",
    "环保": "环保行业",
    "美容护理": "美容护理行业",
    "家用电器": "家用电器行业",
    # 概念板块映射
    "CRO": "CRO概念",
    "创新药": "创新药概念",
    "半导体": "半导体概念",
    "芯片": "芯片概念",
    "光伏": "光伏概念",
    "新能源车": "新能源汽车概念",
    "人工智能": "人工智能概念",
    "AI": "人工智能概念",
    "机器人": "机器人概念",
    "PCB": "PCB概念",
    "消费电子": "消费电子概念",
    "5G": "5G概念",
    "华为": "华为概念",
    "特斯拉": "特斯拉概念",
}


def normalize_sector_name(sector_name: str) -> str:
    """标准化板块名称"""
    # 先检查映射表
    if sector_name in SECTOR_NAME_MAP:
        return SECTOR_NAME_MAP[sector_name]
    # 如果已经是标准名称（以"行业"结尾），直接返回
    if sector_name.endswith("行业"):
        return sector_name
    # 否则添加"行业"后缀
    return f"{sector_name}行业"


def fetch_from_eastmoney(sector_name: str) -> dict:
    """
    从东方财富获取板块成份股
    优先尝试概念板块，再尝试行业板块
    """
    normalized_name = normalize_sector_name(sector_name)
    
    # 先尝试概念板块
    try:
        df = ak.stock_board_concept_cons_em(symbol=normalized_name.replace("行业", ""))
        if df is not None and not df.empty:
            stocks = []
            for _, row in df.head(30).iterrows():
                stocks.append({
                    "code": str(row.get("代码", "")),
                    "name": str(row.get("名称", "")),
                    "price": float(row.get("最新价", 0) or 0),
                    "change": float(row.get("涨跌幅", 0) or 0),
                })
            return {
                "source": "eastmoney_concept",
                "sector": normalized_name,
                "stocks": stocks,
                "count": len(stocks),
            }
    except Exception as e:
        print(f"东方财富概念板块获取失败: {e}", file=sys.stderr)
    
    # 再尝试行业板块
    try:
        df = ak.stock_board_industry_cons_em(symbol=normalized_name)
        if df is not None and not df.empty:
            stocks = []
            for _, row in df.head(30).iterrows():
                stocks.append({
                    "code": str(row.get("代码", "")),
                    "name": str(row.get("名称", "")),
                    "price": float(row.get("最新价", 0) or 0),
                    "change": float(row.get("涨跌幅", 0) or 0),
                })
            return {
                "source": "eastmoney_industry",
                "sector": normalized_name,
                "stocks": stocks,
                "count": len(stocks),
            }
    except Exception as e:
        print(f"东方财富行业板块获取失败: {e}", file=sys.stderr)
    
    return None


def fetch_from_shenwan(sector_name: str) -> dict:
    """
    从申万获取行业成份股
    """
    # 申万行业代码映射
    sw_code_map = {
        "医药生物": "801150",
        "电子": "801080",
        "计算机": "801750",
        "机械设备": "801890",
        "电力设备": "801730",
        "汽车": "801880",
        "基础化工": "801030",
        "食品饮料": "801120",
        "有色金属": "801050",
        "房地产": "801180",
        "银行": "801780",
        "非银金融": "801790",
        "交通运输": "801170",
        "通信": "801770",
        "传媒": "801760",
        "煤炭": "801020",
        "钢铁": "801040",
        "石油石化": "801960",
        "建筑材料": "801710",
        "建筑装饰": "801720",
        "农林牧渔": "801010",
        "纺织服饰": "801880",
        "轻工制造": "801880",
        "商贸零售": "801880",
        "社会服务": "801880",
        "综合": "801880",
        "环保": "801880",
        "美容护理": "801880",
        "家用电器": "801110",
    }
    
    # 获取申万行业代码
    sector_key = sector_name.replace("行业", "")
    sw_code = sw_code_map.get(sector_key)
    
    if not sw_code:
        print(f"申万行业代码未找到: {sector_key}", file=sys.stderr)
        return None
    
    try:
        df = ak.index_component_sw(symbol=sw_code)
        if df is not None and not df.empty:
            stocks = []
            for _, row in df.head(30).iterrows():
                stocks.append({
                    "code": str(row.get("证券代码", "")),
                    "name": str(row.get("证券名称", "")),
                    "price": 0,  # 申万接口不返回实时价格
                    "change": 0,  # 申万接口不返回涨跌幅
                })
            return {
                "source": "shenwan",
                "sector": sector_name,
                "stocks": stocks,
                "count": len(stocks),
            }
    except Exception as e:
        print(f"申万行业成份股获取失败: {e}", file=sys.stderr)
    
    return None


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "请提供板块名称参数"}))
        sys.exit(1)
    
    sector_name = sys.argv[1]
    
    # 按优先级依次尝试数据源
    # 1. 东方财富（概念板块 + 行业板块）
    result = fetch_from_eastmoney(sector_name)
    if result:
        print(json.dumps(result, ensure_ascii=False))
        return
    
    # 2. 申万行业成份股
    result = fetch_from_shenwan(sector_name)
    if result:
        print(json.dumps(result, ensure_ascii=False))
        return
    
    # 所有数据源都失败
    print(json.dumps({"error": "板块当日成份股获取失败", "sector": sector_name}))
    sys.exit(1)


if __name__ == "__main__":
    main()
