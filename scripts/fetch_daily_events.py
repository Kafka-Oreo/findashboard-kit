#!/usr/bin/env python3
"""
每日财经事件抓取脚本 v2
=======================
数据源（全部通过 akshare 获取）：
  1. 东方财富股票新闻 (stock_news_em) — 带真实链接的权威财经新闻
  2. 财联社全球资讯 (stock_info_global_cls) — A股核心消息面
  3. 东方财富全球资讯 (stock_info_global_em) — 全球宏观 + 行业动态
  4. 百度财经日历 (news_economic_baidu) — 宏观经济数据发布

输出格式（每条事件）：
  {
    "event_title": "事件标题",
    "event_summary": "100字以内摘要，含市场潜在影响",
    "source_media": "权威来源名称",
    "source_url": "真实可访问链接",
    "event_time": "yyyy-MM-dd HH:mm",
    "event_level": "市场级 / 行业级 / 公司级"
  }

输出文件：public/daily-events/{YYYYMMDD}.json

使用方式：
  python3 scripts/fetch_daily_events.py [YYYYMMDD]
  不传参数则默认抓取过去24小时事件，保存到当天日期文件
"""

import json
import os
import re
import sys
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import quote

import akshare as ak


# ============================================================
# 配置
# ============================================================

# 权威来源白名单
AUTHORITATIVE_SOURCES = [
    "上海证券报", "中国证券报", "证券时报", "证券日报",
    "财新网", "第一财经", "界面新闻",
    "证券时报网", "中国证券报·中证网", "上海证券报·中国证券网",
    "证券日报网", "华夏时报", "经济观察报",
    "21世纪经济报道", "每日经济新闻", "中国基金报",
    "央视新闻", "新华社", "人民日报",
    "东方财富", "同花顺", "财联社",
]

# 事件级别关键词
LEVEL_KEYWORDS = {
    "市场级": [
        "央行", "人民银行", "美联储", "Fed", "利率", "降息", "加息", "降准",
        "逆回购", "MLF", "LPR", "国债", "外汇", "汇率",
        "GDP", "CPI", "PPI", "PMI", "非农", "就业", "通胀", "社融",
        "国务院", "财政部", "发改委", "金融监管", "银保监",
        "证监会", "交易所", "量化", "减持", "退市", "IPO",
        "关税", "制裁", "出口管制", "贸易",
        "政治局", "中央经济", "政府工作报告",
        "A股", "大盘", "指数", "沪深", "北向资金",
        "申购", "中签", "打新",
    ],
    "行业级": [
        "半导体", "芯片", "集成电路", "AI", "人工智能",
        "新能源", "光伏", "锂电", "储能",
        "自动驾驶", "机器人", "具身智能",
        "医药", "创新药", "CXO", "医疗器械",
        "算力", "数据中心", "云计算", "光模块",
        "房地产", "楼市", "公积金",
        "汽车", "电动车", "交付", "销量",
        "存储芯片", "鸿蒙", "消费电子",
        "稀土", "锂矿", "黄金", "原油",
        "行业", "板块", "产业", "规划",
    ],
    "公司级": [
        "财报", "业绩", "营收", "净利润", "分红", "回购",
        "并购", "重组", "定增", "增发",
        "上市", "发行价", "辅导",
        "停牌", "复牌", "ST",
    ],
}

# 非财经过滤词
NON_FINANCIAL_KWS = [
    "地震", "台风", "洪水", "暴风", "暴雨",
    "枪击", "坠毁", "沉船", "空难", "翻船",
    "明星", "娱乐", "八卦", "综艺", "选秀", "恋情",
    "体育", "赛事", "进球", "冠军", "比赛",
    "天气", "气温", "气象",
    "赛车", "车祸", "溺水",
]

# 财经相关性关键词（至少命中一个才保留）
FINANCIAL_KWS = (
    LEVEL_KEYWORDS["市场级"]
    + LEVEL_KEYWORDS["行业级"]
    + LEVEL_KEYWORDS["公司级"]
    + [
        "股", "涨", "跌", "收盘", "开盘", "涨停", "跌停",
        "基金", "ETF", "债券", "期货", "人民币", "美元",
        "资金流", "主力", "外资", "概念", "题材", "热点",
        "特斯拉", "苹果", "英伟达", "华为", "腾讯", "阿里",
        "产能", "扩产", "订单", "合同", "中标",
    ]
)


# ============================================================
# 工具函数
# ============================================================

def is_allowed_source(source_name: str) -> bool:
    """检查来源是否在权威白名单中"""
    if not source_name:
        return False
    for allowed in AUTHORITATIVE_SOURCES:
        if allowed in source_name or source_name in allowed:
            return True
    return False


def is_financial(title: str, content: str = "") -> bool:
    """判断是否为财经相关新闻"""
    text = title + " " + content
    # 排除非财经
    for kw in NON_FINANCIAL_KWS:
        if kw in text:
            return False
    # 至少命中一个财经关键词
    for kw in FINANCIAL_KWS:
        if kw in text:
            return True
    return False


def classify_event(title: str, content: str = "") -> str:
    """分类事件级别：市场级 > 行业级 > 公司级"""
    text = title + " " + content
    for level in ["市场级", "行业级", "公司级"]:
        for kw in LEVEL_KEYWORDS[level]:
            if kw in text:
                return level
    return "公司级"  # 默认


def generate_summary(title: str, content: str, max_len: int = 100) -> str:
    """生成100字以内摘要"""
    text = content if content and len(content) > 10 else title
    text = text.strip()
    # 去除数字噪音
    text = re.sub(r'[\d\.\-]{10,}', '', text).strip()
    # 去除【】标记的前缀，保留核心内容
    text = re.sub(r'^【[^】]*】', '', text).strip()
    if len(text) <= max_len:
        return text
    for sep in ["。", "；", "，"]:
        idx = text[:max_len].rfind(sep)
        if idx > 30:
            return text[:idx]
    return text[:max_len]


def build_cls_search_url(title: str) -> str:
    """为财联社数据构造搜索链接（财联社原始数据无文章链接时使用）"""
    keyword = title[:40].strip()
    return f"https://www.cls.cn/searchPage?keyword={quote(keyword)}&type=all"


def dedup_key(title: str) -> str:
    """生成去重用的简化标题"""
    return re.sub(r'[^\w\u4e00-\u9fff]', '', title)


# ============================================================
# 数据源采集
# ============================================================

def fetch_stock_news_em() -> tuple[list[dict], dict]:
    """
    数据源1: 东方财富股票新闻 (stock_news_em)
    优势: 带真实文章链接，来源标注清晰
    返回: (事件列表, 数据源状态)
    """
    events = []
    source_status = {"name": "stock_news_em", "status": "failed", "raw_count": 0, "error": ""}
    symbols = [
        ("000001", "上证指数"),
        ("399001", "深证成指"),
        ("399006", "创业板指"),
        ("000300", "沪深300"),
    ]
    any_success = False
    errors = []
    for symbol, label in symbols:
        try:
            df = ak.stock_news_em(symbol=symbol)
            any_success = True
            if df.empty:
                continue
            for _, row in df.iterrows():
                title = str(row.get("新闻标题", "")).strip()
                content = str(row.get("新闻内容", "")).strip()
                source = str(row.get("文章来源", "")).strip()
                url = str(row.get("新闻链接", "")).strip()
                pub_time = str(row.get("发布时间", "")).strip()

                if not title or not url or not source:
                    continue
                if not url.startswith("http"):
                    continue

                events.append({
                    "raw_title": title,
                    "raw_content": content,
                    "pub_time_str": pub_time,
                    "source_raw": source,
                    "url": url,
                    "source_type": "em_news",
                })
            print(f"  [东方财富-{label}] {len(df)} 条", file=sys.stderr)
        except Exception as e:
            errors.append(f"{label}: {e}")
            print(f"  [东方财富-{label}] 失败: {e}", file=sys.stderr)
    if any_success:
        source_status["status"] = "success"
    else:
        source_status["error"] = "; ".join(errors)
    source_status["raw_count"] = len(events)
    return events, source_status


def fetch_cls_global() -> tuple[list[dict], dict]:
    """
    数据源2: 财联社全球资讯 (stock_info_global_cls)
    注意: 无文章链接，source_url 留空（禁止伪造链接）
    返回: (事件列表, 数据源状态)
    """
    events = []
    source_status = {"name": "stock_info_global_cls", "status": "failed", "raw_count": 0, "error": ""}
    try:
        df = ak.stock_info_global_cls()
        source_status["status"] = "success"
        if df.empty:
            source_status["raw_count"] = 0
            return events, source_status
        for _, row in df.iterrows():
            title = str(row.get("标题", "")).strip()
            content = str(row.get("内容", "")).strip()
            pub_date = str(row.get("发布日期", "")).strip()
            pub_time = str(row.get("发布时间", "")).strip()

            if not title or len(title) < 8:
                continue

            # 拼接日期时间
            event_time = ""
            for fmt in ["%Y%m%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y%m%d"]:
                try:
                    dt_str = f"{pub_date} {pub_time}".strip()
                    dt = datetime.strptime(dt_str[:19], fmt)
                    event_time = dt.strftime("%Y-%m-%d %H:%M")
                    break
                except ValueError:
                    continue

            events.append({
                "raw_title": title,
                "raw_content": content,
                "pub_time_str": event_time,
                "source_raw": "财联社",
                "url": "",  # CLS 数据无原始链接
                "source_type": "cls",
            })
        print(f"  [财联社] {len(df)} 条", file=sys.stderr)
    except Exception as e:
        source_status["error"] = str(e)
        print(f"  [财联社] 失败: {e}", file=sys.stderr)
    source_status["raw_count"] = len(events)
    return events, source_status


def fetch_em_global() -> tuple[list[dict], dict]:
    """
    数据源3: 东方财富全球资讯 (stock_info_global_em)
    返回: (事件列表, 数据源状态)
    """
    events = []
    source_status = {"name": "stock_info_global_em", "status": "failed", "raw_count": 0, "error": ""}
    try:
        df = ak.stock_info_global_em()
        source_status["status"] = "success"
        if df.empty:
            source_status["raw_count"] = 0
            return events, source_status
        for _, row in df.iterrows():
            title = str(row.get("标题", "")).strip() if "标题" in df.columns else ""
            content = str(row.get("内容", "")).strip() if "内容" in df.columns else ""
            pub_date = str(row.get("发布日期", "")).strip() if "发布日期" in df.columns else ""
            pub_time = str(row.get("发布时间", "")).strip() if "发布时间" in df.columns else ""

            if not title and not content:
                continue

            event_time = ""
            if pub_date:
                for fmt in ["%Y%m%d %H:%M:%S", "%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y%m%d"]:
                    try:
                        dt_str = f"{pub_date} {pub_time}".strip()
                        dt = datetime.strptime(dt_str[:19], fmt)
                        event_time = dt.strftime("%Y-%m-%d %H:%M")
                        break
                    except ValueError:
                        continue

            events.append({
                "raw_title": title or content[:80],
                "raw_content": content,
                "pub_time_str": event_time,
                "source_raw": "东方财富网",
                "url": "",
                "source_type": "em_global",
            })
        print(f"  [东方财富-全球] {len(df)} 条", file=sys.stderr)
    except Exception as e:
        source_status["error"] = str(e)
        print(f"  [东方财富-全球] 失败: {e}", file=sys.stderr)
    source_status["raw_count"] = len(events)
    return events, source_status


def fetch_economic_calendar() -> tuple[list[dict], dict]:
    """
    数据源4: 百度财经日历 (news_economic_baidu)
    特点: 宏观经济数据发布日历，含公布值/预期/前值
    返回: (事件列表, 数据源状态)
    """
    events = []
    source_status = {"name": "news_economic_baidu", "status": "failed", "raw_count": 0, "error": ""}
    try:
        df = ak.news_economic_baidu()
        source_status["status"] = "success"
        if df.empty:
            source_status["raw_count"] = 0
            return events, source_status
        for _, row in df.iterrows():
            date_str = str(row.get("日期", "")).strip()
            time_str = str(row.get("时间", "")).strip()
            region = str(row.get("地区", "")).strip()
            event_name = str(row.get("事件", "")).strip()
            actual = str(row.get("公布", "")).strip()
            forecast = str(row.get("预期", "")).strip()
            prev = str(row.get("前值", "")).strip()
            importance = row.get("重要性", 1)

            if not event_name:
                continue

            # 构建标题和摘要
            title = f"{region} {event_name}"
            summary_parts = [f"{region}{event_name}"]
            if actual not in ("NaN", "None", "", "-"):
                summary_parts.append(f"公布值:{actual}")
            if forecast not in ("NaN", "None", "", "-"):
                summary_parts.append(f"预期:{forecast}")
            if prev not in ("NaN", "None", "", "-"):
                summary_parts.append(f"前值:{prev}")
            summary = "，".join(summary_parts)

            # 判断重要性
            try:
                imp = int(importance)
            except (ValueError, TypeError):
                imp = 1

            event_time = ""
            try:
                dt = datetime.strptime(f"{date_str} {time_str}", "%Y-%m-%d %H:%M")
                event_time = dt.strftime("%Y-%m-%d %H:%M")
            except ValueError:
                continue

            # 预分类
            level = "行业级"
            market_kws = ["央行", "利率", "GDP", "CPI", "PMI", "非农", "美联储", "失业率"]
            if imp >= 3 or any(kw in event_name for kw in market_kws):
                level = "市场级"

            events.append({
                "raw_title": title,
                "raw_content": summary,
                "pub_time_str": event_time,
                "source_raw": "百度财经日历",
                "url": "",
                "source_type": "calendar",
                "pre_level": level,
            })
        print(f"  [财经日历] {len(df)} 条", file=sys.stderr)
    except Exception as e:
        source_status["error"] = str(e)
        print(f"  [财经日历] 失败: {e}", file=sys.stderr)
    source_status["raw_count"] = len(events)
    return events, source_status


# ============================================================
# 主流程
# ============================================================

def fetch_daily_events(target_date: Optional[str] = None) -> list[dict]:
    """
    抓取指定日期的财经事件

    Args:
        target_date: 目标日期 YYYYMMDD，默认当天
                     指定日期时抓取该日 00:00~24:00 的事件

    Returns:
        结构化事件列表
    """
    now = datetime.now()

    if target_date is None:
        target_date = now.strftime("%Y%m%d")

    # 计算时间窗口
    target_dt = datetime.strptime(target_date, "%Y%m%d")
    is_today = target_dt.date() == now.date()

    if is_today:
        # 今天：过去 24 小时
        window_start = now - timedelta(hours=24)
        window_end = now
        print(f"[INFO] 采集窗口: {window_start.strftime('%Y-%m-%d %H:%M')} ~ {window_end.strftime('%Y-%m-%d %H:%M')} (过去24小时)", file=sys.stderr)
    else:
        # 历史日期：当天 00:00 ~ 24:00
        window_start = target_dt.replace(hour=0, minute=0, second=0)
        window_end = target_dt.replace(hour=23, minute=59, second=59)
        print(f"[INFO] 采集窗口: {window_start.strftime('%Y-%m-%d %H:%M')} ~ {window_end.strftime('%Y-%m-%d %H:%M')} (指定日期)", file=sys.stderr)

    print(f"[INFO] 目标日期: {target_date}", file=sys.stderr)

    # 1. 采集原始数据（每个数据源独立 try/catch，记录成功/失败状态）
    print("[1/4] 采集原始数据...", file=sys.stderr)
    all_raw = []
    source_status: dict[str, dict] = {}

    for name, fetcher in [
        ("stock_news_em", fetch_stock_news_em),
        ("stock_info_global_cls", fetch_cls_global),
        ("stock_info_global_em", fetch_em_global),
        ("news_economic_baidu", fetch_economic_calendar),
    ]:
        try:
            items, status = fetcher()
            source_status[name] = status
            all_raw.extend(items)
        except Exception as e:
            source_status[name] = {"success": False, "error": str(e), "raw_count": 0}
            print(f"  [{name}] 采集异常: {e}", file=sys.stderr)

    success_count = sum(1 for s in source_status.values() if s.get("success"))
    print(f"  合计: {len(all_raw)} 条原始数据，{success_count}/{len(source_status)} 个数据源成功", file=sys.stderr)

    # 2. 时间窗口过滤
    print("[2/4] 时间窗口过滤...", file=sys.stderr)
    time_filtered = []
    for ev in all_raw:
        pt_str = ev.get("pub_time_str", "")
        if not pt_str:
            continue
        # 尝试解析时间
        parsed = False
        for fmt in ["%Y-%m-%d %H:%M", "%Y-%m-%d %H:%M:%S"]:
            try:
                pt = datetime.strptime(pt_str[:19], fmt)
                if window_start <= pt <= window_end:
                    ev["_parsed_time"] = pt
                    time_filtered.append(ev)
                    parsed = True
                break
            except ValueError:
                continue
        if not parsed:
            # 对于无法解析时间的，跳过
            pass
    print(f"  过滤后: {len(time_filtered)} 条", file=sys.stderr)

    # 3. 财经相关性 + 来源过滤 + 分类
    print("[3/4] 相关性过滤与分类...", file=sys.stderr)
    classified = []
    for ev in time_filtered:
        title = ev["raw_title"]
        content = ev["raw_content"]
        source_raw = ev["source_raw"]
        source_type = ev["source_type"]

        # 财经相关性检查
        if not is_financial(title, content):
            continue

        # 对于 stock_news_em 数据源，额外检查来源白名单
        if source_type == "em_news" and not is_allowed_source(source_raw):
            continue

        # 分类
        level = ev.get("pre_level", "") or classify_event(title, content)

        # 来源标注
        source_media = source_raw
        if source_type in ("cls", "em_global", "calendar"):
            # 对这些数据源，使用固定权威来源标注
            if source_type == "cls":
                source_media = "财联社"
            elif source_type == "em_global":
                source_media = "东方财富网"
            elif source_type == "calendar":
                source_media = "百度财经日历"
        elif source_type == "em_news":
            # 尝试匹配权威来源
            matched = False
            for auth in AUTHORITATIVE_SOURCES:
                if auth in source_raw:
                    source_media = auth
                    matched = True
                    break
            if not matched:
                source_media = source_raw

        # URL处理：仅使用数据源真实返回的链接，无链接则置空（禁止拼接/伪造 URL）
        url = ev.get("url", "")
        if not isinstance(url, str) or not url.startswith(("http://", "https://")):
            url = ""

        # 摘要
        summary = generate_summary(title, content)

        # 事件时间
        event_time = ev.get("pub_time_str", "")
        try:
            dt = datetime.strptime(event_time[:16], "%Y-%m-%d %H:%M")
            event_time = dt.strftime("%Y-%m-%d %H:%M")
        except ValueError:
            event_time = now.strftime("%Y-%m-%d %H:%M")

        classified.append({
            "event_title": title,
            "event_summary": summary,
            "source_media": source_media,
            "source_url": url,
            "event_time": event_time,
            "event_level": level,
        })
    print(f"  过滤后: {len(classified)} 条", file=sys.stderr)

    # 4. 去重
    print("[4/4] 去重...", file=sys.stderr)
    seen = set()
    unique = []
    for ev in classified:
        key = dedup_key(ev["event_title"])
        if key and key not in seen and len(key) > 5:
            seen.add(key)
            unique.append(ev)
    print(f"  去重后: {len(unique)} 条", file=sys.stderr)

    # 排序：市场级 > 行业级 > 公司级，同级别按时间倒序
    level_order = {"市场级": 0, "行业级": 1, "公司级": 2}
    unique.sort(key=lambda x: (
        level_order.get(x["event_level"], 9),
        x["event_time"]
    ))
    # 同级别内时间倒序
    from itertools import groupby
    sorted_events = []
    for level, group in groupby(unique, key=lambda x: x["event_level"]):
        group_list = sorted(group, key=lambda x: x["event_time"], reverse=True)
        sorted_events.extend(group_list)

    print(f"[INFO] 最终: {len(sorted_events)} 条事件", file=sys.stderr)
    return sorted_events


def save_events(
    events: list[dict],
    target_date: str,
    source_status: dict[str, dict] | None = None,
    data_status: str = "verified",
) -> str | None:
    """保存事件到 JSON 文件。

    data_status:
      - verified: 至少一个数据源成功且产出了真实事件
      - partial:  部分数据源成功（可能无事件）
      - failed:   全部数据源失败，此时不写入文件，避免伪造/空数据误导前端
    """
    output_dir = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "public", "daily-events"
    )
    os.makedirs(output_dir, exist_ok=True)

    output_file = os.path.join(output_dir, f"{target_date}.json")

    # 全部数据源失败：不写入文件（前端按无数据/失败处理）
    if data_status == "failed":
        if os.path.exists(output_file):
            os.remove(output_file)
            print(f"[WARN] 抓取完全失败，已移除旧数据文件 {output_file}", file=sys.stderr)
        else:
            print("[WARN] 抓取完全失败，不写入数据文件", file=sys.stderr)
        return None

    # 保存为项目已有格式（兼容现有 API），并附加数据状态字段
    output_data = {
        "date": target_date,
        "events": events,
        "sources": list(set(ev["source_media"] for ev in events)),
        "data_status": data_status,
        "source_status": source_status or {},
        "updated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }

    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)

    print(f"[INFO] 已保存到 {output_file} (status={data_status})", file=sys.stderr)
    return output_file


def main():
    target_date = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime("%Y%m%d")

    # 验证日期格式
    try:
        datetime.strptime(target_date, "%Y%m%d")
    except ValueError:
        print(f"错误: 日期格式不正确，应为 YYYYMMDD，收到: {target_date}", file=sys.stderr)
        sys.exit(1)

    # 抓取事件
    events = fetch_daily_events(target_date)

    # 保存
    output_file = save_events(events, target_date)

    # 输出结果摘要
    result = {
        "date": target_date,
        "count": len(events),
        "file": output_file,
        "events": events,
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
