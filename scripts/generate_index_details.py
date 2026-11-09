#!/usr/bin/env python3
"""
预生成七指数详情数据到 public/index-details/{date}/ 目录
用法: python3 generate_index_details.py [YYYYMMDD]
"""
import json
import sys
import os


def main():
    # 日期参数
    if len(sys.argv) > 1:
        date_arg = sys.argv[1].strip()
        if len(date_arg) == 8:
            target_date = f"{date_arg[:4]}-{date_arg[4:6]}-{date_arg[6:]}"
        else:
            target_date = date_arg
    else:
        # 默认：找最新的日报文件
        reports_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "src/lib/reports")
        dates = []
        for f in os.listdir(reports_dir):
            if f.endswith(".ts") and f != "index.ts" and f[0].isdigit():
                dates.append(f.replace(".ts", ""))
        dates.sort(reverse=True)
        if not dates:
            print("错误: 未找到日报文件", file=sys.stderr)
            sys.exit(1)
        target_date = dates[0]

    date_compact = target_date.replace("-", "")

    # 输出目录
    project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    out_dir = os.path.join(project_root, "public/index-details", target_date)
    os.makedirs(out_dir, exist_ok=True)

    # 七指数
    indices = [
        ("上证指数", "sh000001"),
        ("深证成指", "sz399001"),
        ("创业板指", "sz399006"),
        ("沪深300", "sh000300"),
        ("中证500", "sh000905"),
        ("科创50", "sh000688"),
        ("北证50", "bj899050"),
    ]

    try:
        import akshare as ak
    except ImportError:
        print("警告: akshare 未安装，跳过指数详情预生成", file=sys.stderr)
        sys.exit(0)

    success_count = 0
    for name, code in indices:
        try:
            df = ak.stock_zh_index_daily(symbol=code)
            if df is None or len(df) < 60:
                print(f"  {name}: 数据不足 ({len(df) if df is not None else 0}根)", file=sys.stderr)
                continue

            df = df.sort_values("date").reset_index(drop=True)
            df['date'] = df['date'].astype(str)

            target_rows = df[df['date'] == target_date]
            if target_rows.empty:
                print(f"  {name}: 无 {target_date} 数据", file=sys.stderr)
                continue

            row = target_rows.iloc[0]
            idx = target_rows.index[0]
            if idx == 0:
                continue

            prev_close = float(df.iloc[idx - 1]['close'])
            close = float(row['close'])
            change_pct = round((close - prev_close) / prev_close * 100, 2)

            # 近5日历史
            history = []
            start_idx = max(0, idx - 4)
            for i in range(start_idx, idx + 1):
                h_row = df.iloc[i]
                h_prev_close = float(df.iloc[i - 1]['close']) if i > 0 else float(h_row['close'])
                h_change = round((float(h_row['close']) - h_prev_close) / h_prev_close * 100, 2) if i > 0 else 0
                history.append({
                    "date": h_row['date'],
                    "open": float(h_row['open']),
                    "close": float(h_row['close']),
                    "high": float(h_row['high']),
                    "low": float(h_row['low']),
                    "volume": float(h_row['volume']),
                    "change_pct": h_change,
                })

            result = {
                "success": True,
                "source": "akshare-history-precomputed",
                "data": {
                    "name": name,
                    "code": code,
                    "open": float(row['open']),
                    "close": close,
                    "high": float(row['high']),
                    "low": float(row['low']),
                    "volume": float(row['volume']),
                    "turnover": 0,
                    "change_pct": change_pct,
                    "date": target_date,
                    "source": "akshare-history-precomputed",
                    "history": history,
                },
                "history": history,
            }

            safe_name = name.replace('/', '_')
            out_path = os.path.join(out_dir, f"{safe_name}.json")
            with open(out_path, "w", encoding="utf-8") as f:
                json.dump(result, f, ensure_ascii=False, indent=2)

            print(f"✅ {name}: {change_pct:+.2f}%")
            success_count += 1

        except Exception as e:
            print(f"❌ {name}: {e}", file=sys.stderr)

    print(f"\n完成: {success_count}/{len(indices)} 个指数详情已保存到 {out_dir}")


if __name__ == "__main__":
    main()
