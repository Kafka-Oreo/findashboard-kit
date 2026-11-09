#!/usr/bin/env python3
"""
龙虎榜数据抓取脚本（零第三方依赖版）
直接调用东方财富龙虎榜接口，不依赖 akshare

用法: python3 fetch_lhb_data.py [date]
  date: YYYYMMDD 格式，默认今日

输出: JSON 格式到 stdout
"""

import sys
import json
import urllib.request
import urllib.parse
from datetime import datetime


def fetch_lhb(date_str: str = "") -> dict:
    """
    从东方财富获取龙虎榜数据（零依赖）
    接口: datacenter-web.eastmoney.com RPT_DAILYBILLBOARD_DETAILSNEW
    """
    if not date_str:
        date_str = datetime.now().strftime("%Y%m%d")

    dash_date = f"{date_str[:4]}-{date_str[4:6]}-{date_str[6:8]}"

    url = "https://datacenter-web.eastmoney.com/api/data/v1/get"
    params = {
        "sortColumns": "BILLBOARD_NET_AMT",
        "sortTypes": "-1",
        "pageSize": "200",
        "pageNumber": "1",
        "reportName": "RPT_DAILYBILLBOARD_DETAILSNEW",
        "columns": "ALL",
        "filter": f"(TRADE_DATE='{dash_date}')",
        "source": "WEB",
        "client": "WEB",
    }

    full_url = f"{url}?{urllib.parse.urlencode(params)}"
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        "Referer": "https://data.eastmoney.com/",
        "Accept": "application/json, text/plain, */*",
    }

    req = urllib.request.Request(full_url, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as e:
        return {"success": False, "error": f"request error: {str(e)}", "date": date_str, "data": []}

    result_data = data.get("result", {}).get("data", []) or []
    total_count = data.get("result", {}).get("count", 0)
    if not result_data:
        return {"success": False, "error": "no data", "date": date_str, "data": []}

    # 解析并格式化（一只股票可能多条，按净买额去重，取最大那条）
    stock_map: dict = {}
    for item in result_data:
        code = item.get("SECURITY_CODE", "")
        name = item.get("SECURITY_NAME_ABBR", "") or ""
        close_price = item.get("CLOSE_PRICE", 0) or 0
        change_pct = item.get("CHANGE_RATE", 0) or 0
        turnover_rate = item.get("TURNOVERRATE", 0) or 0
        buy_amount = item.get("BILLBOARD_BUY_AMT", 0) or 0
        sell_amount = item.get("BILLBOARD_SELL_AMT", 0) or 0
        net_amount = item.get("BILLBOARD_NET_AMT", 0) or 0
        reason = item.get("EXPLANATION", "") or item.get("EXPLAIN", "") or ""
        trade_date = item.get("TRADE_DATE", "")[:10] if item.get("TRADE_DATE") else dash_date
        market = item.get("TRADE_MARKET", "") or ""

        # 同一股票多次上榜，累加买/卖金额
        if code in stock_map:
            s = stock_map[code]
            s["buy_amount"] += float(buy_amount)
            s["sell_amount"] += float(sell_amount)
            s["net_amount"] += float(net_amount)
            # 保留所有上榜原因
            if reason and reason not in s["reason"]:
                s["reason"] = (s["reason"] + "；" + reason) if s["reason"] else reason
        else:
            stock_map[code] = {
                "code": code,
                "name": name,
                "close": round(float(close_price), 2),
                "change_pct": round(float(change_pct), 2),
                "turnover_rate": round(float(turnover_rate), 2),
                "buy_amount": float(buy_amount),
                "sell_amount": float(sell_amount),
                "net_amount": float(net_amount),
                "reason": reason,
                "market": market,
                "trade_date": trade_date,
            }

    # 转成列表，按净买额降序
    stocks = sorted(stock_map.values(), key=lambda x: x["net_amount"], reverse=True)

    # 金额单位从元转万元
    for s in stocks:
        s["buy_amount"] = round(s["buy_amount"] / 10000, 2)
        s["sell_amount"] = round(s["sell_amount"] / 10000, 2)
        s["net_amount"] = round(s["net_amount"] / 10000, 2)

    return {
        "success": True,
        "date": date_str,
        "total": len(stocks),
        "total_raw": total_count,
        "data": stocks,
        "source": "eastmoney-lhb",
    }


def main():
    date_str = sys.argv[1] if len(sys.argv) > 1 else ""
    result = fetch_lhb(date_str)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
