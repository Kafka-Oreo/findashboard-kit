#!/usr/bin/env python3
"""
财联社数据抓取脚本
抓取【数据看盘】和【每日收评】数据
"""

import json
import sys
import requests
from datetime import datetime

# 财联社API
CLS_API = "https://www.cls.cn/v1/roll/get_roll_list"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Referer": "https://www.cls.cn",
    "Accept": "application/json, text/plain, */*",
}

# 专栏ID映射
SUBJECT_IDS = {
    "数据看盘": 1013,  # 数据看盘专栏ID
    "每日收评": 1139,  # 每日收评专栏ID
}


def fetch_cls_articles(subject_id: int, date: str, count: int = 10) -> list[dict]:
    """
    抓取财联社专栏文章
    
    Args:
        subject_id: 专栏ID
        date: 日期 YYYYMMDD
        count: 获取数量
    
    Returns:
        文章列表
    """
    params = {
        "app": "CailianpressWeb",
        "os": "web",
        "sv": "7.7.5",
        "rn": str(count),
        "subject_id": str(subject_id),
    }
    
    try:
        response = requests.get(CLS_API, params=params, headers=HEADERS, timeout=10)
        response.raise_for_status()
        data = response.json()
        
        if data.get("code") == 0 and data.get("data"):
            articles = data["data"].get("roll_data", [])
            return articles
        else:
            print(f"API返回错误: {data.get('msg', '未知错误')}", file=sys.stderr)
            return []
    except requests.RequestException as e:
        print(f"请求失败: {e}", file=sys.stderr)
        return []


def filter_articles_by_date(articles: list[dict], date: str) -> list[dict]:
    """
    按日期过滤文章
    
    Args:
        articles: 文章列表
        date: 日期 YYYYMMDD
    
    Returns:
        过滤后的文章列表
    """
    target_date = datetime.strptime(date, "%Y%m%d").date()
    filtered = []
    
    for article in articles:
        # 文章时间戳（秒）
        ctime = article.get("ctime", 0)
        if ctime:
            article_date = datetime.fromtimestamp(ctime).date()
            if article_date == target_date:
                filtered.append(article)
    
    return filtered


def parse_article(article: dict) -> dict:
    """
    解析文章数据
    
    Args:
        article: 原始文章数据
    
    Returns:
        解析后的文章数据
    """
    return {
        "title": article.get("title", ""),
        "content": article.get("content", ""),
        "summary": article.get("summary", ""),
        "ctime": article.get("ctime", 0),
        "time": datetime.fromtimestamp(article.get("ctime", 0)).strftime("%H:%M") if article.get("ctime") else "",
        "url": f"https://www.cls.cn/detail/{article.get('id', '')}",
        "author": article.get("author", ""),
    }


def fetch_daily_review(date: str) -> dict:
    """
    抓取每日收评数据
    
    Args:
        date: 日期 YYYYMMDD
    
    Returns:
        每日收评数据
    """
    subject_id = SUBJECT_IDS["每日收评"]
    articles = fetch_cls_articles(subject_id, date, count=5)
    
    # 按日期过滤
    filtered = filter_articles_by_date(articles, date)
    
    if filtered:
        # 取最新的一篇
        latest = filtered[0]
        parsed = parse_article(latest)
        return {
            "success": True,
            "data": parsed,
        }
    else:
        return {
            "success": False,
            "message": f"未找到 {date} 的每日收评数据",
        }


def fetch_data_view(date: str) -> dict:
    """
    抓取数据看盘数据
    
    Args:
        date: 日期 YYYYMMDD
    
    Returns:
        数据看盘数据
    """
    subject_id = SUBJECT_IDS["数据看盘"]
    articles = fetch_cls_articles(subject_id, date, count=5)
    
    # 按日期过滤
    filtered = filter_articles_by_date(articles, date)
    
    if filtered:
        # 取最新的一篇
        latest = filtered[0]
        parsed = parse_article(latest)
        return {
            "success": True,
            "data": parsed,
        }
    else:
        return {
            "success": False,
            "message": f"未找到 {date} 的数据看盘数据",
        }


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python3 fetch_cls_review.py <YYYYMMDD> [type]", file=sys.stderr)
        print("  type: review(每日收评) | dataview(数据看盘) | all(全部)", file=sys.stderr)
        sys.exit(1)
    
    date = sys.argv[1]
    fetch_type = sys.argv[2] if len(sys.argv) > 2 else "all"
    
    results = {}
    
    if fetch_type in ["review", "all"]:
        results["每日收评"] = fetch_daily_review(date)
    
    if fetch_type in ["dataview", "all"]:
        results["数据看盘"] = fetch_data_view(date)
    
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
