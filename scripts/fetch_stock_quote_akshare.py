#!/usr/bin/env python3
"""
AKShare 个股行情查询（兜底）
用法: python3 fetch_stock_quote_akshare.py <股票名称|代码> [日期 YYYY-MM-DD]
输出 JSON 到 stdout
"""

import sys
import json
import warnings

warnings.filterwarnings("ignore")

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少参数"}, ensure_ascii=False))
        return

    query = sys.argv[1].strip()
    date_str = sys.argv[2].strip() if len(sys.argv) > 2 else ""

    try:
        import akshare as ak
    except ImportError:
        print(json.dumps({"success": False, "error": "akshare 未安装"}, ensure_ascii=False))
        return

    try:
        code = None
        name = None

        # 判断 query 是代码还是名称
        if query.replace(".", "").isdigit() or (len(query) >= 6 and query[:6].isdigit()):
            code = query[:6]
        else:
            name = query
            # 名字反查代码
            try:
                code_name_df = ak.stock_info_a_code_name()
                match = code_name_df[code_name_df["name"] == name]
                if len(match) > 0:
                    code = match.iloc[0]["code"]
                else:
                    # 模糊匹配
                    mask = code_name_df["name"].str.contains(name, na=False) | code_name_df["name"].apply(lambda x: name in x if isinstance(x, str) else False)
                    match2 = code_name_df[mask]
                    if len(match2) > 0:
                        code = match2.iloc[0]["code"]
            except Exception:
                pass

        if not code:
            print(json.dumps({"success": False, "error": "未找到对应股票代码"}, ensure_ascii=False))
            return

        # 获取历史 K 线
        if not date_str:
            from datetime import datetime, timedelta
            dt = datetime.now()
            date_str = dt.strftime("%Y-%m-%d")

        # 日期前后各取几天以防节假日
        import datetime as dt_mod
        target_dt = dt_mod.datetime.strptime(date_str, "%Y-%m-%d")
        start = (target_dt - dt_mod.timedelta(days=10)).strftime("%Y%m%d")
        end = (target_dt + dt_mod.timedelta(days=1)).strftime("%Y%m%d")

        try:
            df = ak.stock_zh_a_hist(symbol=code, period="daily", start_date=start, end_date=end, adjust="")
            if df is None or len(df) == 0:
                print(json.dumps({"success": False, "error": "无历史K线数据"}, ensure_ascii=False))
                return

            # 找最接近目标日期的那根K线
            df["日期"] = df["日期"].astype(str)
            target = date_str
            # 找 ≤ target 的最大日期
            target_df = df[df["日期"] <= target]
            if len(target_df) == 0:
                target_df = df
            row = target_df.iloc[-1]

            actual_date = row["日期"]
            close = float(row["收盘"])
            open_p = float(row["开盘"])
            high = float(row["最高"])
            low = float(row["最低"])
            volume = float(row["成交量"])
            amount = float(row.get("成交额", 0) if "成交额" in df.columns else 0)

            # 找前一日
            idx = df.index[df["日期"] == actual_date].tolist()
            prev_close = close
            if len(idx) > 0 and idx[0] > 0:
                prev_close = float(df.iloc[idx[0] - 1]["收盘"])

            change_pct = round((close - prev_close) / prev_close * 100, 2)
            change_amt = round(close - prev_close, 2)

            result = {
                "success": True,
                "data": {
                    "name": name or code,
                    "code": code,
                    "date": actual_date,
                    "open": open_p,
                    "close": close,
                    "high": high,
                    "low": low,
                    "preClose": prev_close,
                    "change": change_pct,
                    "changeAmt": change_amt,
                    "volume": int(volume),
                    "amount": amount,
                    "source": "akshare-history"
                }
            }
            print(json.dumps(result, ensure_ascii=False))
        except Exception as e:
            print(json.dumps({"success": False, "error": f"历史K线获取失败: {str(e)[:80]}"}, ensure_ascii=False))

    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)[:100]}, ensure_ascii=False))

if __name__ == "__main__":
    main()
