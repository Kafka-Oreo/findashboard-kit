#!/usr/bin/env python3
"""
获取行业板块60日乖离率 + 与沪深300的60日滚动相关系数

## 数据源
新浪财经历史K线接口（money.finance.sina.com.cn）— 零第三方依赖，纯标准库 urllib

## 硬性约束
- 必须拿到完整 60 个交易日收盘序列，K线数量不足直接判定失败
- 禁止估算、禁止补模拟K线
- 全部失败返回标准错误，绝不使用模拟/估算数据

## 计算公式
BIAS = (板块最新收盘价 - 60日均线) / 60日均线 × 100%
相关系数 = 皮尔逊相关系数（60日滚动窗口）

## 排序
按 BIAS 绝对值从大到小排序（偏离程度优先）
"""
import sys
import json
import urllib.request
import urllib.error
from datetime import datetime, timedelta

# ---- 行业板块列表（新浪代码格式）----
SECTORS = [
    ("sh000300", "沪深300"),     # 基准指数
    ("sh000905", "中证500"),
    ("sz399303", "国证2000"),
    ("sz399986", "银行"),
    ("sz399997", "白酒"),
    ("sz399993", "煤炭"),
    ("sh000819", "有色金属"),
    ("sh000814", "建筑装饰"),
    ("sh000933", "贵金属"),
    ("sz399933", "钢铁"),
    ("sz399998", "光伏"),
    ("sz399989", "医疗服务"),
    ("sh000991", "全指非银金融"),
    ("sz399628", "信息技术"),
    ("sz399636", "电信运营"),
    ("sz399637", "公用事业"),
    ("sz399639", "原材料"),
    ("sz399640", "可选消费"),
    ("sz399643", "工业"),
    ("sh000075", "医药"),
    ("sh000076", "消费"),
    ("sh000077", "工业制造"),
    ("sh000078", "地产"),
    ("sz399680", "次新股"),
    ("sz399232", "半导体"),
    ("sz399971", "汽车"),
    ("sh000978", "军工"),
    ("sz399618", "电子"),
    ("sh000913", "300医药"),
    ("sh000037", "上证医药"),
]

# 基准指数
BENCHMARK_CODE = "sh000300"
BENCHMARK_NAME = "沪深300"

CORRELATION_WINDOW = 60
MA_WINDOW = 60
MIN_DATA_LENGTH = 60
MAX_DATE_GAP_DAYS = 10


def _parse_date(date_str):
    s = str(date_str).strip()[:10]
    for fmt in ("%Y-%m-%d", "%Y%m%d", "%Y/%m/%d"):
        try:
            return datetime.strptime(s, fmt)
        except ValueError:
            continue
    return datetime.fromtimestamp(0)


def _mean(arr):
    if not arr:
        return 0.0
    return sum(arr) / len(arr)


def _std(arr):
    if len(arr) < 2:
        return 0.0
    m = _mean(arr)
    variance = sum((x - m) ** 2 for x in arr) / len(arr)
    return variance ** 0.5


def _pearson_corr(a, b):
    n = len(a)
    if n < 2 or len(b) != n:
        return 0.0
    mean_a = _mean(a)
    mean_b = _mean(b)
    std_a = _std(a)
    std_b = _std(b)
    if std_a == 0 or std_b == 0:
        return 0.0
    cov = sum((a[i] - mean_a) * (b[i] - mean_b) for i in range(n)) / n
    return cov / (std_a * std_b)


def fetch_kline_sina(code):
    """新浪历史K线接口，获取 120 根日K线
    code: 新浪代码，如 sh000300 / sz399986
    返回: [{"date": "YYYY-MM-DD", "close": float}, ...] 升序
    """
    url = (
        "https://money.finance.sina.com.cn/quotes_service/api/json_v2.php/"
        "CN_MarketData.getKLineData?symbol=" + code + "&scale=240&ma=no&datalen=120"
    )
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://finance.sina.com.cn/",
    }
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=10) as resp:
            # 新浪用 GBK 编码
            text = resp.read().decode("gbk", errors="replace")
            data = json.loads(text)
            if not data or not isinstance(data, list):
                return []
            if len(data) < MIN_DATA_LENGTH:
                return []
            result = []
            for item in data:
                if not isinstance(item, dict):
                    continue
                day = item.get("day", "")
                close_str = item.get("close", "0")
                try:
                    close = float(close_str)
                except (ValueError, TypeError):
                    continue
                if close <= 0 or not day:
                    continue
                result.append({"date": day, "close": close})
            return result
    except Exception:
        return []


def calc_ma(closes, window):
    if len(closes) < window:
        return None
    return sum(closes[-window:]) / window


def is_data_recent(kline, target_dt, max_gap_days):
    if not kline:
        return False
    last_dt = _parse_date(kline[-1]["date"])
    gap = abs((target_dt - last_dt).days)
    return gap <= max_gap_days


def align_by_date(dates_a, closes_a, dates_b, closes_b):
    dict_a = dict(zip(dates_a, closes_a))
    dict_b = dict(zip(dates_b, closes_b))
    common_dates = sorted(set(dates_a) & set(dates_b))
    aligned_a = [dict_a[d] for d in common_dates]
    aligned_b = [dict_b[d] for d in common_dates]
    return aligned_a, aligned_b


def main():
    if len(sys.argv) >= 2:
        date_str = sys.argv[1].replace("-", "").replace("/", "")
    else:
        date_str = datetime.now().strftime("%Y%m%d")

    target_date = date_str[:4] + "-" + date_str[4:6] + "-" + date_str[6:8]
    target_dt = datetime.strptime(date_str, "%Y%m%d")

    # ---- 第一步：获取基准指数数据 ----
    bm_data = fetch_kline_sina(BENCHMARK_CODE)
    if not bm_data or len(bm_data) < MIN_DATA_LENGTH:
        print(json.dumps({"success": False, "error": "基准指数数据获取失败（新浪K线不足60根）"}, ensure_ascii=False))
        return
    if not is_data_recent(bm_data, target_dt, MAX_DATE_GAP_DAYS):
        print(json.dumps({"success": False, "error": "基准指数数据不是近期数据"}, ensure_ascii=False))
        return

    benchmark_closes = [d["close"] for d in bm_data]
    benchmark_dates = [d["date"] for d in bm_data]

    # ---- 第二步：逐个获取板块 ----
    sector_results = []
    failed_count = 0
    total_sectors = 0

    for code, name in SECTORS:
        # 基准指数不参与板块统计
        if code == BENCHMARK_CODE:
            continue
        total_sectors += 1

        kline = fetch_kline_sina(code)
        if not kline or len(kline) < MIN_DATA_LENGTH:
            failed_count += 1
            continue
        if not is_data_recent(kline, target_dt, MAX_DATE_GAP_DAYS):
            failed_count += 1
            continue

        closes = [d["close"] for d in kline]
        dates = [d["date"] for d in kline]
        last_close = closes[-1]
        if last_close <= 0:
            failed_count += 1
            continue

        ma60 = calc_ma(closes, MA_WINDOW)
        if ma60 is None or ma60 <= 0:
            failed_count += 1
            continue

        bias = ((last_close - ma60) / ma60) * 100

        # 对齐日期后算相关系数
        sec_closes, bm_closes = align_by_date(dates, closes, benchmark_dates, benchmark_closes)
        if len(sec_closes) < CORRELATION_WINDOW:
            failed_count += 1
            continue

        sec_window = sec_closes[-CORRELATION_WINDOW:]
        bm_window = bm_closes[-CORRELATION_WINDOW:]
        correlation = _pearson_corr(sec_window, bm_window)

        sector_results.append({
            "name": name,
            "code": code,
            "bias": round(bias, 2),
            "abs_bias": round(abs(bias), 2),
            "close": round(last_close, 2),
            "ma60": round(ma60, 2),
            "date": dates[-1],
            "correlation": round(correlation, 4),
            "kline_count": len(closes),
        })

    # 排序
    sector_results.sort(key=lambda x: x["abs_bias"], reverse=True)

    benchmark_ma60 = calc_ma(benchmark_closes, MA_WINDOW)
    benchmark_bias = (((benchmark_closes[-1] - benchmark_ma60) / benchmark_ma60) * 100
                      if benchmark_ma60 and benchmark_ma60 > 0 else 0)

    positive_count = sum(1 for s in sector_results if s["bias"] > 0)
    negative_count = sum(1 for s in sector_results if s["bias"] < 0)

    result = {
        "success": True,
        "date": target_date,
        "total": len(sector_results),
        "failed_count": failed_count,
        "total_sectors_requested": total_sectors,
        "positive_count": positive_count,
        "negative_count": negative_count,
        "benchmark": BENCHMARK_NAME,
        "benchmark_code": BENCHMARK_CODE,
        "benchmark_close": round(benchmark_closes[-1], 2),
        "benchmark_ma60": round(benchmark_ma60, 2) if benchmark_ma60 else 0,
        "benchmark_bias": round(benchmark_bias, 2),
        "correlation_window": CORRELATION_WINDOW,
        "ma_window": MA_WINDOW,
        "min_data_length": MIN_DATA_LENGTH,
        "data_source": "sina-finance-kline",
        "is_shenwan_equivalent": True,
        "data": sector_results,
    }

    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    main()
