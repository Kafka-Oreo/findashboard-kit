#!/usr/bin/env python3
"""
财联社【每日收评】数据解析脚本
从财联社每日收评文章中提取关键数据用于日报生成
"""

import re
import json
import sys
from datetime import datetime


def parse_cls_review(content: str) -> dict:
    """
    解析财联社每日收评内容，提取关键数据
    """
    result = {
        'indices': {},
        'volume': '',
        'up_down': '',
        'hot_sectors': [],
        'weak_sectors': [],
        'summary': '',
        'outlook': ''
    }

    # 提取指数涨跌幅
    index_patterns = [
        (r'沪指(?:跌|涨)(\d+\.\d+)%', 'sh'),
        (r'深成指(?:跌|涨)(\d+\.\d+)%', 'sz'),
        (r'创业板指(?:跌|涨)(\d+\.\d+)%', 'cyb'),
        (r'科创50(?:跌|涨)(\d+\.\d+)%', 'kc50'),
    ]

    for pattern, key in index_patterns:
        match = re.search(pattern, content)
        if match:
            value = float(match.group(1))
            if '跌' in content[match.start():match.end()]:
                value = -value
            result['indices'][key] = value

    # 提取成交额
    volume_match = re.search(r'成交额(\d+\.\d+)万亿', content)
    if volume_match:
        result['volume'] = f"{volume_match.group(1)}万亿"

    # 提取涨跌家数
    up_match = re.search(r'超(\d+)只个股(?:上涨|飘红)', content)
    down_match = re.search(r'超(\d+)只个股(?:下跌|收绿)', content)
    if up_match:
        result['up_down'] = f"上涨{up_match.group(1)}家"
    if down_match:
        if result['up_down']:
            result['up_down'] += f"，下跌{down_match.group(1)}家"
        else:
            result['up_down'] = f"下跌{down_match.group(1)}家"

    # 提取强势板块
    strong_patterns = [
        r'(脑机接口)概念(?:延续强势|逆势走强|集体爆发)',
        r'(光刻机)概念(?:盘中活跃|集体爆发)',
        r'(大消费|白酒|食品饮料)(?:板块|方向)(?:表现活跃|集体反弹|集体修复)',
        r'(分散染料)概念(?:局部异动|集体爆发)',
    ]

    for pattern in strong_patterns:
        match = re.search(pattern, content)
        if match:
            result['hot_sectors'].append(match.group(1))

    # 提取弱势板块
    weak_patterns = [
        r'(CPO|算力硬件)(?:概念|股)(?:遭重挫|集体重挫|集体调整)',
        r'(存储芯片|半导体)(?:概念|板块)(?:集体调整|延续调整)',
    ]

    for pattern in weak_patterns:
        match = re.search(pattern, content)
        if match:
            result['weak_sectors'].append(match.group(1))

    # 提取总结
    summary_match = re.search(r'财联社\d+月\d+日讯，(.*?)(?:\n\n|$)', content, re.DOTALL)
    if summary_match:
        result['summary'] = summary_match.group(1).strip()[:200]

    # 提取后市分析
    outlook_match = re.search(r'\*\*后市分析\*\*\s*\n+(.*?)(?:\n\n\*\*|$)', content, re.DOTALL)
    if outlook_match:
        result['outlook'] = outlook_match.group(1).strip()[:300]

    return result


def main():
    if len(sys.argv) < 2:
        print("用法: python3 parse_cls_review.py <content_file>")
        sys.exit(1)

    content_file = sys.argv[1]
    with open(content_file, 'r', encoding='utf-8') as f:
        content = f.read()

    result = parse_cls_review(content)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
