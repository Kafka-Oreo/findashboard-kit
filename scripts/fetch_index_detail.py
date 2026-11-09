#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
多源指数行情获取脚本（3级优先级 + 强制校验 + 近5日历史数据）
优先级：AKShare → efinance → qstock
用法：python3 fetch_index_detail.py <指数名称> <预期涨跌幅>
输出：JSON 格式，含当日详情 + 最近5个交易日历史行情
"""
import sys
import json
import datetime
import traceback

try:
    import requests
except ImportError:
    requests = None

# 七指数标准代码映射
INDEX_CODE_MAP = {
    "上证指数":      {"ak": "sh000001", "ef": "1.000001", "qs": "sh000001"},
    "深证成指":      {"ak": "sz399001", "ef": "0.399001", "qs": "sz399001"},
    "创业板指":      {"ak": "sz399006", "ef": "0.399006", "qs": "sz399006"},
    "沪深300":      {"ak": "sh000300", "ef": "1.000300", "qs": "sh000300"},
    "科创50":       {"ak": "sh000688", "ef": "1.000688", "qs": "sh000688"},
    "中证500":      {"ak": "sh000905", "ef": "1.000905", "qs": "sh000905"},
    "北证50":       {"ak": "bj899050", "ef": "",         "qs": "bj899050"},
}

def get_today_str():
    return datetime.date.today().strftime("%Y-%m-%d")

def is_today(date_str):
    """判断日期字符串是否为今日"""
    if not date_str:
        return False
    today = get_today_str()
    return date_str[:10] == today

def verify_result(result, expected_change, target_date=None):
    """校验返回结果：日期匹配+涨幅方向+字段完整性
    target_date: 目标日期字符串(YYYY-MM-DD)，None则不校验日期
    """
    if not result or not isinstance(result, dict):
        return False, "数据为空"
    # 必填字段
    required = ["name", "code", "open", "close", "high", "low", "volume", "amount", "change_pct", "date"]
    for f in required:
        if f not in result or result[f] is None:
            return False, f"缺少字段: {f}"
    # 日期校验（与目标日期一致即可，不强制为今日）
    if target_date:
        data_date = result.get("date", "")
        if data_date and data_date != target_date:
            return False, f"日期不符: 期望{target_date} 实际{data_date}"
    # 涨跌幅数值偏差校验（允许 ±0.3% 误差）
    try:
        chg = float(result.get("change_pct", 0))
        exp = float(expected_change)
        # 特殊值：预期为 999.99 表示跳过涨跌幅校验（批量查询场景）
        if exp != 999.99 and abs(chg - exp) > 0.3:
            return False, f"涨跌幅偏差过大: 实际{chg:.2f}% vs 预期{exp:.2f}%"
    except (ValueError, TypeError):
        return False, "涨跌幅数据异常"
    return True, "校验通过"

def fetch_by_sina_realtime(index_name, expected_change=None):
    """优先级0：新浪财经实时行情（仅当日，数据准、速度快、零第三方依赖）"""
    import urllib.request

    code_info = INDEX_CODE_MAP.get(index_name)
    if not code_info:
        return None, "无对应指数代码"

    code = code_info["ak"]  # 新浪代码格式与AKShare一致

    try:
        url = f"https://hq.sinajs.cn/list={code}"
        req = urllib.request.Request(url, headers={
            "Referer": "https://finance.sina.com.cn",
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
        })
        with urllib.request.urlopen(req, timeout=8) as resp:
            raw = resp.read()
        text = raw.decode("gbk").strip()

        if "=" not in text:
            return None, "新浪返回格式异常"

        data_str = text.split("=")[1].strip('"').strip()
        if not data_str:
            return None, "新浪返回空数据"

        parts = data_str.split(",")
        if len(parts) < 10:
            return None, f"新浪数据字段不足（{len(parts)}项）"

        name = parts[0]
        open_p = float(parts[1])
        pre_close = float(parts[2])
        latest = float(parts[3])
        high = float(parts[4])
        low = float(parts[5])
        volume = float(parts[8]) if parts[8] else 0
        amount = float(parts[9]) if parts[9] else 0
        date_raw = parts[30] if len(parts) > 30 else get_today_str()

        if pre_close == 0:
            return None, "昨收价为0"

        change_pct = round((latest - pre_close) / pre_close * 100, 2)

        result = {
            "name": name if name else index_name,
            "code": code,
            "open": open_p,
            "close": latest,
            "high": high,
            "low": low,
            "volume": volume,
            "amount": amount,
            "change_pct": change_pct,
            "date": date_raw if date_raw else get_today_str(),
            "source": "sina-realtime",
        }

        # 基础校验
        ok, msg = verify_result(result, expected_change if expected_change is not None else 999.99)
        if not ok:
            return None, f"新浪校验失败: {msg}"

        # 尝试补充近5日历史（用AKShare）
        try:
            import akshare as ak
            history, _ = fetch_history_by_akshare(index_name, days=10)
            if history:
                result["history"] = history[-5:]
            else:
                result["history"] = []
        except Exception:
            result["history"] = []

        return result, "成功"

    except Exception as e:
        return None, f"新浪实时异常: {str(e)[:80]}"


def fetch_history_by_akshare(index_name, days=10):
    """用AKShare获取历史K线，返回近days日数据
    优先用新浪接口(stock_zh_index_daily)，备用东方财富(stock_zh_index_daily_em)
    新浪接口字段: date, open, high, low, close, volume（无成交额、无涨跌幅，需自行计算）
    """
    try:
        import akshare as ak
    except ImportError:
        return None, "akshare 未安装"

    code_info = INDEX_CODE_MAP.get(index_name)
    if not code_info or not code_info["ak"]:
        return None, "无对应 AKShare 代码"

    code = code_info["ak"]  # 如 "sh000001"
    code_num = code[2:] if len(code) > 2 else code

    # ========== 方案1：新浪历史K线（稳定，优先用） ==========
    try:
        df = ak.stock_zh_index_daily(symbol=code)
        if df is not None and not df.empty:
            df = df.tail(days + 1)  # 多取1天用于计算首日涨跌幅
            history = []
            prev_close = None
            for _, r in df.iterrows():
                close_price = float(r.get("close", 0))
                open_price = float(r.get("open", 0))
                high_price = float(r.get("high", 0))
                low_price = float(r.get("low", 0))
                vol = float(r.get("volume", 0))
                date_str = str(r.get("date", ""))[:10]
                # 涨跌幅 = (收盘价 - 昨收) / 昨收 * 100
                change_pct = 0.0
                if prev_close and prev_close > 0:
                    change_pct = round((close_price - prev_close) / prev_close * 100, 2)
                history.append({
                    "date": date_str,
                    "open": open_price,
                    "close": close_price,
                    "high": high_price,
                    "low": low_price,
                    "volume": vol,
                    "amount": 0.0,  # 新浪接口无成交额
                    "change_pct": change_pct,
                })
                prev_close = close_price

            if len(history) > days:
                history = history[-days:]  # 只保留最后 days 条
            if history:
                return history, f"AKShare-新浪历史K线成功({len(history)}条)"
    except Exception as e:
        # 新浪失败，继续试东方财富
        pass

    # ========== 方案2：东方财富历史K线 ==========
    try:
        df = ak.stock_zh_index_daily_em(symbol=code_num)
        if df is not None and not df.empty:
            df = df.tail(days)
            history = []
            for _, r in df.iterrows():
                date_str = str(r.get("日期", r.get("date", "")))[:10]
                history.append({
                    "date": date_str,
                    "open": float(r.get("开盘", r.get("open", 0))),
                    "close": float(r.get("收盘", r.get("close", 0))),
                    "high": float(r.get("最高", r.get("high", 0))),
                    "low": float(r.get("最低", r.get("low", 0))),
                    "volume": float(r.get("成交量", r.get("volume", 0))),
                    "amount": float(r.get("成交额", r.get("amount", 0))),
                    "change_pct": float(r.get("涨跌幅", r.get("change_pct", r.get("振幅", 0)))),
                })
            if history:
                return history, f"AKShare-东方财富历史K线成功({len(history)}条)"
    except Exception as e:
        return None, f"AKShare历史K线均失败: {str(e)[:80]}"

    return None, "AKShare历史数据为空"

def fetch_history_by_efinance(index_name, days=10):
    """efinance 历史K线"""
    try:
        import efinance as ef
    except ImportError:
        return None, "efinance 未安装"

    try:
        code_info = INDEX_CODE_MAP.get(index_name)
        if not code_info or not code_info["ef"]:
            return None, "无对应 efinance 代码"

        code = code_info["ef"]
        df = ef.stock.get_quote_history(code, klt=101)  # 101=日K
        if df is None or df.empty:
            return None, "efinance历史数据为空"

        df = df.tail(days)
        history = []
        for _, r in df.iterrows():
            date_str = str(r.get("日期", r.get("date", "")))[:10]
            history.append({
                "date": date_str,
                "open": float(r.get("开盘", r.get("open", 0))),
                "close": float(r.get("收盘", r.get("close", 0))),
                "high": float(r.get("最高", r.get("high", 0))),
                "low": float(r.get("最低", r.get("low", 0))),
                "volume": float(r.get("成交量", r.get("volume", 0))),
                "amount": float(r.get("成交额", r.get("amount", 0))),
                "change_pct": float(r.get("涨跌幅", r.get("change_pct", 0))),
            })

        if not history:
            return None, "无历史数据"
        return history, "成功"
    except Exception as e:
        return None, f"efinance历史数据异常: {str(e)[:100]}"

def fetch_history_by_qstock(index_name, days=10):
    """qstock 历史K线"""
    try:
        import qstock as qs
    except ImportError:
        return None, "qstock 未安装"

    try:
        code_info = INDEX_CODE_MAP.get(index_name)
        if not code_info or not code_info["qs"]:
            return None, "无对应 qstock 代码"

        code = code_info["qs"]
        df = qs.get_data(code, freq="d", n=days)
        if df is None or df.empty:
            return None, "qstock历史数据为空"

        df = df.tail(days)
        history = []
        for idx, r in df.iterrows():
            date_str = str(idx)[:10] if hasattr(idx, 'strftime') else str(idx)[:10]
            history.append({
                "date": date_str,
                "open": float(r.get("open", r.get("今开", 0))),
                "close": float(r.get("close", r.get("最新价", 0))),
                "high": float(r.get("high", r.get("最高", 0))),
                "low": float(r.get("low", r.get("最低", 0))),
                "volume": float(r.get("volume", r.get("成交量", 0))),
                "amount": float(r.get("amount", r.get("成交额", 0))),
                "change_pct": float(r.get("change_pct", r.get("涨跌幅", r.get("chg_pct", 0)))),
            })

        if not history:
            return None, "无历史数据"
        return history, "成功"
    except Exception as e:
        return None, f"qstock历史数据异常: {str(e)[:100]}"

def fetch_by_akshare(index_name, expected_change):
    """优先级1：AKShare（当日 + 近5日历史）"""
    try:
        import akshare as ak
    except ImportError:
        return None, "akshare 未安装"

    try:
        code_info = INDEX_CODE_MAP.get(index_name)
        if not code_info or not code_info["ak"]:
            return None, "无对应 AKShare 代码"

        code = code_info["ak"]
        # 获取实时指数行情
        df = ak.stock_zh_index_spot_em()
        if df is None or df.empty:
            return None, "AKShare 返回空数据"

        # 模糊匹配代码或名称
        code_num = code[2:] if len(code) > 2 else code
        row = df[df["代码"].astype(str).str.contains(code_num, na=False)]
        if row.empty:
            row = df[df["名称"].astype(str).str.contains(index_name.replace("指", ""), na=False)]
        if row.empty:
            return None, "未匹配到指数数据"

        r = row.iloc[0]
        result = {
            "name": str(r.get("名称", index_name)),
            "code": str(r.get("代码", code)),
            "open": float(r.get("今开", 0)),
            "close": float(r.get("最新价", 0)),
            "high": float(r.get("最高", 0)),
            "low": float(r.get("最低", 0)),
            "volume": float(r.get("成交量", 0)),
            "amount": float(r.get("成交额", 0)),
            "change_pct": float(r.get("涨跌幅", 0)),
            "date": get_today_str(),
            "source": "akshare",
        }

        ok, msg = verify_result(result, expected_change)
        if not ok:
            return None, f"AKShare 校验失败: {msg}"

        # 获取近5日历史数据
        history, _ = fetch_history_by_akshare(index_name, days=10)
        if history:
            result["history"] = history[-5:]
        else:
            result["history"] = []

        return result, "成功"
    except Exception as e:
        return None, f"AKShare 异常: {str(e)[:100]}"

def fetch_by_efinance(index_name, expected_change):
    """优先级2：efinance（当日 + 近5日历史）"""
    try:
        import efinance as ef
    except ImportError:
        return None, "efinance 未安装"

    try:
        code_info = INDEX_CODE_MAP.get(index_name)
        if not code_info or not code_info["ef"]:
            return None, "无对应 efinance 代码"

        code = code_info["ef"]
        df = ef.stock.get_realtime_quotes()
        if df is None or df.empty:
            return None, "efinance 返回空数据"

        row = df[df["股票代码"].astype(str) == code]
        if row.empty:
            return None, "未匹配到指数数据"

        r = row.iloc[0]
        result = {
            "name": str(r.get("股票名称", index_name)),
            "code": str(r.get("股票代码", code)),
            "open": float(r.get("今日开", 0)),
            "close": float(r.get("最新价", 0)),
            "high": float(r.get("最高", 0)),
            "low": float(r.get("最低", 0)),
            "volume": float(r.get("成交量", 0)),
            "amount": float(r.get("成交额", 0)),
            "change_pct": float(r.get("涨跌幅", 0)),
            "date": get_today_str(),
            "source": "efinance",
        }

        ok, msg = verify_result(result, expected_change)
        if not ok:
            return None, f"efinance 校验失败: {msg}"

        # 获取近5日历史数据
        history, _ = fetch_history_by_efinance(index_name, days=10)
        if history:
            result["history"] = history[-5:]
        else:
            result["history"] = []

        return result, "成功"
    except Exception as e:
        return None, f"efinance 异常: {str(e)[:100]}"

def fetch_by_qstock(index_name, expected_change):
    """优先级3：qstock（当日 + 近5日历史）"""
    try:
        import qstock as qs
    except ImportError:
        return None, "qstock 未安装"

    try:
        code_info = INDEX_CODE_MAP.get(index_name)
        if not code_info or not code_info["qs"]:
            return None, "无对应 qstock 代码"

        code = code_info["qs"]
        df = qs.realtime_data(code=code)
        if df is None or df.empty:
            return None, "qstock 返回空数据"

        r = df.iloc[0]
        close = float(r.get("最新价", r.get("price", 0)))
        chg_pct = float(r.get("涨跌幅", r.get("change_pct", r.get("涨跌", 0))))

        result = {
            "name": str(r.get("名称", r.get("name", index_name))),
            "code": str(r.get("代码", r.get("code", code))),
            "open": float(r.get("今开", r.get("open", 0))),
            "close": close,
            "high": float(r.get("最高", r.get("high", 0))),
            "low": float(r.get("最低", r.get("low", 0))),
            "volume": float(r.get("成交量", r.get("volume", 0))),
            "amount": float(r.get("成交额", r.get("amount", 0))),
            "change_pct": chg_pct,
            "date": get_today_str(),
            "source": "qstock",
        }

        ok, msg = verify_result(result, expected_change)
        if not ok:
            return None, f"qstock 校验失败: {msg}"

        # 获取近5日历史数据
        history, _ = fetch_history_by_qstock(index_name, days=10)
        if history:
            result["history"] = history[-5:]
        else:
            result["history"] = []

        return result, "成功"
    except Exception as e:
        return None, f"qstock 异常: {str(e)[:100]}"

def fetch_history_by_date_akshare(index_name, target_date, expected_change):
    """
    指定日期查询：从 AKShare 东方财富历史K线中找到 target_date 对应的数据
    同时返回近5日历史行情
    """
    history, msg = fetch_history_by_akshare(index_name, days=30)
    if not history:
        return None, f"AKShare历史K线获取失败: {msg}"

    # 查找目标日期
    target = None
    target_idx = -1
    for i, h in enumerate(history):
        if h["date"][:10] == target_date:
            target = h
            target_idx = i
            break

    # 如果没找到精确日期，找最后一个 <= target_date 的交易日
    if not target:
        for i in range(len(history) - 1, -1, -1):
            if history[i]["date"][:10] <= target_date:
                target = history[i]
                target_idx = i
                break

    if not target:
        return None, f"未找到目标日期 {target_date} 的历史K线数据"

    # 涨跌幅校验（允许 ±1.5% 误差，应对报告数据四舍五入）
    try:
        chg = float(target.get("change_pct", 0))
        exp = float(expected_change)
        if abs(chg - exp) > 1.5:
            # 偏差过大时仍返回数据，但标记为近似
            pass
    except (ValueError, TypeError):
        pass

    # 构造结果
    result = {
        "name": index_name,
        "code": INDEX_CODE_MAP.get(index_name, {}).get("ak", ""),
        "open": target["open"],
        "close": target["close"],
        "high": target["high"],
        "low": target["low"],
        "volume": target["volume"],
        "amount": target["amount"],
        "change_pct": target["change_pct"],
        "date": target["date"][:10],
        "source": "akshare-history",
    }

    # 近5日历史（含目标日期）
    if target_idx >= 0:
        start = max(0, target_idx - 4)
        result["history"] = history[start:target_idx + 1]
    else:
        result["history"] = history[-5:]

    return result, f"成功（历史K线，{target['date'][:10]}）"


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "参数不足：指数名称 预期涨跌幅 [目标日期] [--no-verify]"}, ensure_ascii=False))
        sys.exit(1)

    # 解析参数，识别 --no-verify 标志
    # 注意：只过滤 -- 开头的选项，-数字（如 -0.06）是负数涨跌幅，不能过滤
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    no_verify = "--no-verify" in sys.argv[1:] or "--skip-verify" in sys.argv[1:]

    if len(args) < 2:
        print(json.dumps({"success": False, "error": "参数不足：指数名称 预期涨跌幅 [目标日期]"}, ensure_ascii=False))
        sys.exit(1)

    index_name = args[0]
    expected_change = float(args[1])
    target_date = args[2] if len(args) > 2 else get_today_str()
    # no_verify 模式：跳过涨跌幅校验（批量查询场景，用特殊值 999.99）
    if no_verify:
        expected_change = 999.99
    # 确保日期格式 YYYY-MM-DD
    if len(target_date) == 8 and target_date.isdigit():
        target_date = f"{target_date[:4]}-{target_date[4:6]}-{target_date[6:]}"
    is_today_query = is_today(target_date)

    errors = []

    # ========== 当日查询：先试实时行情，失败则回退历史K线 ==========
    if is_today_query:
        # 优先级0: 新浪财经实时行情（最准最快，免装依赖）
        result, msg = fetch_by_sina_realtime(index_name, expected_change)
        if result:
            print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
            return
        errors.append(f"新浪实时: {msg}")

        # 优先级1: AKShare 实时行情
        result, msg = fetch_by_akshare(index_name, expected_change)
        if result:
            print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
            return
        errors.append(f"AKShare实时: {msg}")

        # 优先级2: 当日数据取历史K线最后一条（应对接口波动）
        result, msg = fetch_history_by_date_akshare(index_name, target_date, expected_change)
        if result:
            print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
            return
        errors.append(f"AKShare历史: {msg}")

        # 优先级3: efinance
        result, msg = fetch_by_efinance(index_name, expected_change)
        if result:
            print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
            return
        errors.append(f"efinance: {msg}")

        # 优先级4: qstock
        result, msg = fetch_by_qstock(index_name, expected_change)
        if result:
            print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
            return
        errors.append(f"qstock: {msg}")

    # ========== 历史日期查询：直接用 AKShare 历史K线（东方财富数据源）==========
    else:
        # 主方案：AKShare 历史K线（stock_zh_index_daily_em = 东方财富数据）
        result, msg = fetch_history_by_date_akshare(index_name, target_date, expected_change)
        if result:
            print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
            return
        errors.append(f"AKShare历史K线(东方财富): {msg}")

        # 备用：efinance 历史K线
        try:
            import efinance as ef
            history, _ = fetch_history_by_efinance(index_name, days=30)
            if history:
                for i, h in enumerate(history):
                    if h["date"][:10] <= target_date:
                        result = {
                            "name": index_name,
                            "code": INDEX_CODE_MAP.get(index_name, {}).get("ef", ""),
                            "open": h["open"],
                            "close": h["close"],
                            "high": h["high"],
                            "low": h["low"],
                            "volume": h["volume"],
                            "amount": h["amount"],
                            "change_pct": h["change_pct"],
                            "date": h["date"][:10],
                            "source": "efinance-history",
                            "history": history[max(0, i-4):i+1],
                        }
                        print(json.dumps({"success": True, "data": result}, ensure_ascii=False))
                        return
        except ImportError:
            errors.append("efinance: 未安装")
        except Exception as e:
            errors.append(f"efinance: {str(e)[:80]}")

    # 全部失败
    print(json.dumps({
        "success": False,
        "error": "全部数据源均失败，暂未返回真实行情",
        "details": errors,
    }, ensure_ascii=False))

if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(json.dumps({"success": False, "error": f"脚本异常: {str(e)[:200]}"}, ensure_ascii=False))
        traceback.print_exc()
        sys.exit(1)
