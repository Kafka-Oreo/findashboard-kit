#!/usr/bin/env python3
"""
财联社每日收评/数据看盘数据抓取脚本
从网页抓取数据并保存为JSON格式
"""

import json
import sys
import re
import requests
from datetime import datetime
from bs4 import BeautifulSoup

# 财联社专栏URL
CLS_SUBJECT_URLS = {
    "每日收评": "https://www.cls.cn/subject/1139",
    "数据看盘": "https://www.cls.cn/subject/1013",
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
}


def fetch_subject_page(subject_name: str) -> str:
    """
    抓取专栏页面
    
    Args:
        subject_name: 专栏名称
    
    Returns:
        页面HTML内容
    """
    url = CLS_SUBJECT_URLS.get(subject_name)
    if not url:
        print(f"未知的专栏: {subject_name}", file=sys.stderr)
        return ""
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        return response.text
    except requests.RequestException as e:
        print(f"请求失败: {e}", file=sys.stderr)
        return ""


def parse_articles(html: str, date: str) -> list[dict]:
    """
    解析文章列表
    
    Args:
        html: 页面HTML
        date: 目标日期 YYYYMMDD
    
    Returns:
        文章列表
    """
    articles = []
    target_date = datetime.strptime(date, "%Y%m%d").strftime("%Y-%m-%d")
    
    # 使用正则表达式提取文章信息
    # 匹配文章链接和标题
    pattern = r'<a[^>]*href="https://www\.cls\.cn/detail/(\d+)"[^>]*>\s*(.*?)\s*</a>'
    matches = re.findall(pattern, html, re.DOTALL)
    
    for article_id, title_html in matches:
        # 清理标题
        title = re.sub(r'<[^>]+>', '', title_html).strip()
        
        # 检查是否包含日期
        if target_date in title or date.replace("-", "") in title:
            articles.append({
                "id": article_id,
                "title": title,
                "url": f"https://www.cls.cn/detail/{article_id}",
            })
    
    return articles


def fetch_article_detail(article_id: str) -> dict:
    """
    抓取文章详情
    
    Args:
        article_id: 文章ID
    
    Returns:
        文章详情
    """
    url = f"https://www.cls.cn/detail/{article_id}"
    
    try:
        response = requests.get(url, headers=HEADERS, timeout=10)
        response.raise_for_status()
        html = response.text
        
        # 提取文章内容
        content_pattern = r'<div[^>]*class="[^"]*detail-content[^"]*"[^>]*>(.*?)</div>'
        content_match = re.search(content_pattern, html, re.DOTALL)
        
        if content_match:
            content = re.sub(r'<[^>]+>', '', content_match.group(1)).strip()
            return {
                "id": article_id,
                "url": url,
                "content": content[:2000],  # 限制长度
            }
        else:
            return {
                "id": article_id,
                "url": url,
                "content": "",
            }
    except requests.RequestException as e:
        print(f"请求文章详情失败: {e}", file=sys.stderr)
        return {
            "id": article_id,
            "url": url,
            "content": "",
        }


def fetch_daily_review(date: str) -> dict:
    """
    抓取每日收评数据
    
    Args:
        date: 日期 YYYYMMDD
    
    Returns:
        每日收评数据
    """
    html = fetch_subject_page("每日收评")
    if not html:
        return {"success": False, "message": "抓取页面失败"}
    
    articles = parse_articles(html, date)
    
    if articles:
        # 获取第一篇文章的详情
        article = articles[0]
        detail = fetch_article_detail(article["id"])
        
        return {
            "success": True,
            "data": {
                "title": article["title"],
                "url": article["url"],
                "content": detail.get("content", ""),
                "date": date,
            },
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
    html = fetch_subject_page("数据看盘")
    if not html:
        return {"success": False, "message": "抓取页面失败"}
    
    articles = parse_articles(html, date)
    
    if articles:
        # 获取第一篇文章的详情
        article = articles[0]
        detail = fetch_article_detail(article["id"])
        
        return {
            "success": True,
            "data": {
                "title": article["title"],
                "url": article["url"],
                "content": detail.get("content", ""),
                "date": date,
            },
        }
    else:
        return {
            "success": False,
            "message": f"未找到 {date} 的数据看盘数据",
        }


def main():
    """主函数"""
    if len(sys.argv) < 2:
        print("用法: python3 fetch_cls_articles.py <YYYYMMDD> [type]", file=sys.stderr)
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
