#!/usr/bin/env python3
"""
财联社数据抓取脚本
从财联社官网抓取【每日收评】和【数据看盘】数据
"""

import requests
from bs4 import BeautifulSoup
import json
import sys
import re
from datetime import datetime


def fetch_cls_article(url: str) -> str:
    """抓取财联社文章内容"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.encoding = 'utf-8'
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 提取文章内容
        content_div = soup.find('div', class_='detail-content') or soup.find('div', class_='article-content')
        if content_div:
            return content_div.get_text('\n', strip=True)
        
        # 备用：提取所有段落
        paragraphs = soup.find_all('p')
        if paragraphs:
            return '\n'.join([p.get_text(strip=True) for p in paragraphs])
        
        return ''
    except Exception as e:
        print(f"抓取失败: {e}", file=sys.stderr)
        return ''


def find_article_by_date(subject_url: str, target_date: str) -> str:
    """根据日期查找文章链接"""
    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
    
    try:
        response = requests.get(subject_url, headers=headers, timeout=10)
        soup = BeautifulSoup(response.text, 'html.parser')
        
        # 查找所有文章链接
        links = soup.find_all('a', href=True)
        for link in links:
            href = link.get('href', '')
            text = link.get_text(strip=True)
            
            # 检查是否包含目标日期
            if 'detail' in href and target_date in text:
                full_url = f"https://www.cls.cn{href}" if href.startswith('/') else href
                return full_url
        
        # 如果没有找到精确匹配，返回第一个detail链接
        for link in links:
            href = link.get('href', '')
            if 'detail' in href:
                full_url = f"https://www.cls.cn{href}" if href.startswith('/') else href
                return full_url
        
        return ''
    except Exception as e:
        print(f"查找文章失败: {e}", file=sys.stderr)
        return ''


def parse_indices(content: str) -> dict:
    """解析指数数据"""
    indices = {}
    
    patterns = [
        (r'沪指(?:跌|涨)(\d+\.\d+)%', 'sh'),
        (r'深成指(?:跌|涨)(\d+\.\d+)%', 'sz'),
        (r'创业板指(?:跌|涨)(\d+\.\d+)%', 'cyb'),
        (r'科创50(?:跌|涨)(\d+\.\d+)%', 'kc50'),
    ]
    
    for pattern, key in patterns:
        match = re.search(pattern, content)
        if match:
            value = float(match.group(1))
            # 判断涨跌
            context = content[max(0, match.start()-10):match.end()]
            if '跌' in context:
                value = -value
            indices[key] = value
    
    return indices


def parse_volume(content: str) -> str:
    """解析成交额"""
    match = re.search(r'成交额(\d+\.\d+)万亿', content)
    if match:
        return f"{match.group(1)}万亿"
    return ''


def parse_sectors(content: str) -> tuple:
    """解析强势和弱势板块"""
    hot_sectors = []
    weak_sectors = []
    
    # 强势板块
    strong_patterns = [
        r'(脑机接口)概念(?:延续强势|逆势走强|集体爆发)',
        r'(光刻机)概念(?:盘中活跃|集体爆发)',
        r'(白酒|食品饮料|大消费)(?:板块|方向)(?:表现活跃|集体反弹)',
        r'(分散染料)概念(?:局部异动|集体爆发)',
    ]
    
    for pattern in strong_patterns:
        match = re.search(pattern, content)
        if match and match.group(1) not in hot_sectors:
            hot_sectors.append(match.group(1))
    
    # 弱势板块
    weak_patterns = [
        r'(CPO|算力硬件)(?:概念|股)(?:遭重挫|集体重挫)',
        r'(存储芯片|半导体)(?:概念|板块)(?:集体调整|延续调整)',
    ]
    
    for pattern in weak_patterns:
        match = re.search(pattern, content)
        if match and match.group(1) not in weak_sectors:
            weak_sectors.append(match.group(1))
    
    return hot_sectors, weak_sectors


def main():
    if len(sys.argv) < 2:
        print("用法: python3 fetch_cls_data.py <date> [type]")
        print("  date: 日期，格式 YYYYMMDD")
        print("  type: review(每日收评) | data(数据看盘) | all(全部)")
        sys.exit(1)
    
    date = sys.argv[1]
    data_type = sys.argv[2] if len(sys.argv) > 2 else 'all'
    
    # 格式化日期
    dt = datetime.strptime(date, '%Y%m%d')
    date_str = dt.strftime('%Y-%m-%d')
    
    results = {}
    
    # 抓取每日收评
    if data_type in ['review', 'all']:
        print("正在抓取每日收评...", file=sys.stderr)
        review_url = find_article_by_date('https://www.cls.cn/subject/1139', date_str)
        if review_url:
            content = fetch_cls_article(review_url)
            if content:
                results['review'] = {
                    'url': review_url,
                    'content': content[:500],  # 只保存前500字
                    'indices': parse_indices(content),
                    'volume': parse_volume(content),
                    'hot_sectors': parse_sectors(content)[0],
                    'weak_sectors': parse_sectors(content)[1],
                }
                print(f"找到每日收评: {review_url}", file=sys.stderr)
            else:
                print("未获取到文章内容", file=sys.stderr)
        else:
            print(f"未找到{date_str}的每日收评", file=sys.stderr)
    
    # 输出结果
    print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
