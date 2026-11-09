#!/usr/bin/env python3
"""
财联社新闻搜索
============
数据源：AKShare - stock_info_global_cls（财联社电报）
逻辑：拉取最新财联社电报列表后，在本地按关键词过滤，支持多关键词
输出：JSON 格式列表
"""
import json
import sys
import urllib.parse
from datetime import datetime

import akshare as ak


def classify_event(title: str, content: str = "") -> str:
    """根据标题关键词推断分类"""
    text = title + content
    rules = [
        (['美联储', '加息', '降息', '鲍威尔', 'FOMC', '欧央行', '英国央行', '日本央行', '央行'], '央行'),
        (['政策', '监管', '证监会', '银保监', '国常会', '国务院', '发改委', '工信部', '网信办'], '政策'),
        (['美股', '道指', '纳指', '标普', '纳斯达克', '道琼斯', 'S&P', '标普500', '美国股市'], '美股'),
        (['欧股', '德国', '法兰克福', 'DAX', '法国', 'CAC', '英国', '富时', '欧洲股市'], '欧洲'),
        (['A股', '港股', '恒生', '日经', '韩国', 'KOSPI', '亚太', '日本股市', '台湾', '台股'], '亚太'),
        (['美元', '汇率', '人民币', '欧元', '日元', '英镑', '外汇', 'USD', 'CNY'], '汇率'),
        (['原油', '黄金', '白银', '铜', '铝', '锌', '商品', '期货', '布伦特', 'WTI', 'COMEX', 'LME'], '商品'),
        (['俄乌', '乌克兰', '俄罗斯', '战争', '冲突', '地缘', '以色列', '伊朗', '中东'], '地缘'),
        (['AI', '人工智能', '芯片', '英伟达', '半导体', '科技', 'OpenAI', '苹果', '微软', '谷歌', '特斯拉'], '科技'),
        (['中概', '中概股', 'ADR', '阿里巴巴', '京东', '拼多多', '百度'], '中概'),
        (['关税', '贸易', '出口', '进口', '制裁', 'WTO', '经贸', '中美'], '经贸'),
        (['GDP', 'CPI', 'PPI', '非农', '就业', '经济数据', '通胀', '通缩', 'PMI', '社融'], '宏观'),
        (['资金', '北向', '南向', '外资', '净流入', '净流出', '融资', '融券'], '资金'),
        (['新能源', '光伏', '锂电', '新能源车', '医药', '地产', '房地产', '消费', '汽车', '产业'], '产业'),
        (['暴雷', '违约', '退市', '风险', '警示', '避雷', '亏损', '处罚'], '避雷'),
    ]
    for keywords, category in rules:
        for kw in keywords:
            if kw in text:
                return category
    return '资讯'


def calc_trend(title: str, content: str = "") -> str:
    """估算情绪方向（涨/跌/中性）"""
    text = title + content
    pos = ['上涨', '涨', '利好', '增长', '提升', '突破', '新高', '反弹', '走强', '净流入', '盈利', '增长']
    neg = ['下跌', '跌', '利空', '下滑', '回落', '暴跌', '新低', '走弱', '净流出', '亏损', '减少', '处罚']
    pos_count = sum(1 for w in pos if w in text)
    neg_count = sum(1 for w in neg if w in text)
    if pos_count > neg_count:
        return 'up'
    if neg_count > pos_count:
        return 'down'
    return 'neutral'


def search_cls_news(keyword: str, limit: int = 20) -> list[dict]:
    """
    搜索财联社电报新闻
    :param keyword: 搜索关键词，多个词用空格分隔
    :param limit: 返回条数上限
    :return: 新闻列表
    """
    try:
        df = ak.stock_info_global_cls(symbol='全部')
    except Exception as e:
        print(f"[ERROR] 拉取财联社电报失败: {e}", file=sys.stderr)
        return []

    if df.empty:
        return []

    # 关键词列表（空格分隔，AND 关系）
    keywords = [kw.strip() for kw in keyword.split() if kw.strip()]
    results = []

    for _, row in df.iterrows():
        title = str(row.get('标题', '')).strip()
        content = str(row.get('内容', '')).strip()
        pub_date = str(row.get('发布日期', '')).strip()
        pub_time = str(row.get('发布时间', '')).strip()

        if not title:
            continue

        # 关键词过滤
        if keywords:
            haystack = (title + content)
            if not all(kw in haystack for kw in keywords):
                continue

        # 构造财联社搜索链接（以标题中第一个关键词或整标题搜索）
        search_kw = keywords[0] if keywords else title[:10]
        url = f"https://www.cls.cn/searchPage?keyword={urllib.parse.quote(search_kw)}"

        results.append({
            'title': title,
            'highlight': content[:120] if content else '',
            'url': url,
            'source': '财联社',
            'category': classify_event(title, content),
            'trend': calc_trend(title, content),
            'attention': 1,
            'fire_count': 1,
            'pub_time': f"{pub_date} {pub_time}" if pub_date else pub_time,
            'pub_date': pub_date,
        })

        if len(results) >= limit:
            break

    return results


def main():
    keyword = sys.argv[1] if len(sys.argv) > 1 else ''
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 20

    if not keyword:
        print(json.dumps({
            'success': False,
            'error': '缺少关键词',
            'data': [],
        }, ensure_ascii=False))
        return

    results = search_cls_news(keyword, limit)

    output = {
        'success': True,
        'keyword': keyword,
        'total': len(results),
        'source': 'cls_telegraph',
        'fetched_at': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'data': results,
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
