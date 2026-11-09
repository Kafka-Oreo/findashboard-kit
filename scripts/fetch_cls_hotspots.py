#!/usr/bin/env python3
"""
获取财联社近期热点文章（电报/快讯），用于全球市场热点面板
数据源：AKShare - stock_info_global_cls（财联社电报）
功能：去重精选 + 关注度分级 + 跳转链接（财联社搜索页）
输出：JSON 格式
"""
import json
import sys
from datetime import datetime, date


def classify_event(title, content=''):
    """根据标题关键词推断分类"""
    text = title + content
    rules = [
        # 央行/政策（优先级最高）
        (['美联储', '加息', '降息', '鲍威尔', 'FOMC', '欧央行', '英国央行', '日本央行', '央行'], '央行'),
        (['政策', '监管', '证监会', '银保监', '国常会', '国务院', '发改委', '工信部'], '政策'),
        # 美股
        (['美股', '道指', '纳指', '标普', '纳斯达克', '道琼斯', 'S&P', '标普500', '美国股市'], '美股'),
        # 欧洲
        (['欧股', '德国', '法兰克福', 'DAX', '法国', 'CAC', '英国', '富时', '欧洲股市'], '欧洲'),
        # 亚太
        (['A股', '港股', '恒生', '日经', '韩国', 'KOSPI', '亚太', '日本股市', '台湾', '台股'], '亚太'),
        # 外汇/汇率
        (['美元', '汇率', '人民币', '欧元', '日元', '英镑', '外汇', 'USD', 'CNY'], '汇率'),
        # 商品
        (['原油', '黄金', '白银', '铜', '铝', '锌', '商品', '期货', '布伦特', 'WTI', 'COMEX', 'LME'], '商品'),
        # 地缘
        (['俄乌', '乌克兰', '俄罗斯', '战争', '冲突', '地缘', '以色列', '伊朗', '中东'], '地缘'),
        # 科技
        (['AI', '人工智能', '芯片', '英伟达', '半导体', '科技', 'OpenAI', '苹果', '微软', '谷歌', '特斯拉'], '科技'),
        # 中概
        (['中概', '中概股', 'ADR', '阿里巴巴', '京东', '拼多多', '百度'], '中概'),
        # 经贸
        (['关税', '贸易', '出口', '进口', '制裁', 'WTO', '经贸', '中美'], '经贸'),
        # 宏观
        (['GDP', 'CPI', 'PPI', '非农', '就业', '经济数据', '通胀', '通缩', 'PMI', '社融'], '宏观'),
        # 资金
        (['资金', '北向', '南向', '外资', '净流入', '净流出', '融资', '融券'], '资金'),
        # 产业
        (['新能源', '光伏', '锂电', '新能源车', '医药', '地产', '房地产', '消费', '汽车', '产业'], '产业'),
        # 避雷
        (['暴雷', '违约', '退市', '风险', '警示', '避雷', '亏损', '处罚'], '避雷'),
    ]

    for keywords, category in rules:
        for kw in keywords:
            if kw in text:
                return category
    return '资讯'  # 默认分类


def calc_attention_score(title, content=''):
    """
    计算关注度（1-5个🔥）
    基于关键词重要性、情绪强度、事件类型综合打分
    """
    text = title + content
    score = 1  # 基础1🔥

    # —— 最高级关键词（+3）
    critical_keywords = [
        '黑天鹅', '史诗级', '崩盘', '熔断', '紧急', '突发', '重磅', '独家',
        '创历史新高', '创历史新低', '首次', '破纪录', '史上最大'
    ]
    for kw in critical_keywords:
        if kw in text:
            score += 3
            break

    # —— 高级关键词（+2）
    high_keywords = [
        '暴涨', '暴跌', '大涨', '大跌', '涨超5', '跌超5', '大幅', '严重',
        '央行', '美联储', 'FOMC', '鲍威尔', '国务院', '证监会',
        '制裁', '禁令', '战争', '冲突升级', '加息', '降息', '降准'
    ]
    if score < 4:  # 还没到顶才加
        for kw in high_keywords:
            if kw in text:
                score += 2
                break

    # —— 中级关键词（+1）
    mid_keywords = [
        '重要', '提醒', '注意', '刚刚', '最新', '证实', '确认', '官宣', '正式',
        '利好', '利空', '上涨', '下跌', '回升', '回落',
        'GDP', 'CPI', 'PPI', '非农', 'PMI', '社融', '通胀'
    ]
    if score < 5:
        for kw in mid_keywords:
            if kw in text:
                score += 1
                break

    # 标题长度适中（信息密度高）额外+1
    if 15 <= len(title) <= 40:
        score += 0.5

    # 限制在 1-5
    score = max(1, min(5, round(score)))
    return score


def dedupe_events(events):
    """
    去重逻辑：
    1. 标题完全相同 → 保留最新一条
    2. 标题相似度>70%（核心关键词重合）→ 保留关注度更高的
    """
    # 先按发布时间倒序，确保最新的在前
    events_sorted = sorted(
        events,
        key=lambda e: e.get('pub_time', ''),
        reverse=True
    )

    unique_events = []
    seen_titles = set()      # 完全相同的标题
    seen_keywords_set = []   # 核心关键词集合，用于相似度判断

    for ev in events_sorted:
        title = ev['title']

        # 完全去重
        if title in seen_titles:
            continue
        seen_titles.add(title)

        # 提取核心关键词（长度>=3的词 + 专有名词）
        title_clean = title.replace('【', '').replace('】', '').replace('：', ':')
        core_words = set()
        # 简单的关键词提取：2-4字短语
        for i in range(len(title_clean) - 1):
            for l in range(2, 5):
                if i + l <= len(title_clean):
                    w = title_clean[i:i+l]
                    # 过滤数字、符号开头
                    if w[0].isalpha() or '\u4e00' <= w[0] <= '\u9fff':
                        core_words.add(w)

        # 相似度判断：与已有事件核心词重合度>50% 视为重复
        is_dup = False
        for existing_words in seen_keywords_set:
            if len(core_words) > 0 and len(existing_words) > 0:
                overlap = core_words & existing_words
                # 用 Jaccard 相似度
                similarity = len(overlap) / len(core_words | existing_words)
                if similarity > 0.35:  # 35%以上视为同主题重复
                    is_dup = True
                    break

        if not is_dup:
            unique_events.append(ev)
            seen_keywords_set.append(core_words)

    return unique_events


def select_key_events(events, limit=8):
    """
    精选关键热点：
    1. 按关注度降序
    2. 确保分类多样性（每个分类最多2条）
    3. 保留关键分类（央行/政策/宏观/美股）优先
    """
    # 按关注度降序
    events_sorted = sorted(
        events,
        key=lambda e: (e.get('attention', 0), e.get('pub_time', '')),
        reverse=True
    )

    # 关键分类优先
    priority_categories = ['央行', '政策', '宏观', '美股', '地缘', '汇率', '商品']
    priority_events = [e for e in events_sorted if e['category'] in priority_categories]
    other_events = [e for e in events_sorted if e['category'] not in priority_categories]

    # 分类配额：确保多样性
    cat_count = {}
    selected = []

    # 第一轮：关键分类每个最多2条
    for ev in priority_events:
        cat = ev['category']
        if cat_count.get(cat, 0) < 2:
            selected.append(ev)
            cat_count[cat] = cat_count.get(cat, 0) + 1
            if len(selected) >= limit:
                break

    # 第二轮：补充其他分类
    if len(selected) < limit:
        for ev in other_events:
            cat = ev['category']
            if cat_count.get(cat, 0) < 1:  # 其他分类每类最多1条
                selected.append(ev)
                cat_count[cat] = cat_count.get(cat, 0) + 1
                if len(selected) >= limit:
                    break

    # 第三轮：还不够的话，按关注度补
    if len(selected) < limit:
        selected_titles = {e['title'] for e in selected}
        for ev in events_sorted:
            if ev['title'] not in selected_titles:
                selected.append(ev)
                selected_titles.add(ev['title'])
                if len(selected) >= limit:
                    break

    # 最终按关注度降序排列
    selected.sort(key=lambda e: e.get('attention', 0), reverse=True)
    return selected


def build_cls_url(title):
    """构造财联社搜索 URL"""
    import urllib.parse
    encoded = urllib.parse.quote(title[:30])  # 取前30字作为关键词
    return f'https://www.cls.cn/searchPage?keyword={encoded}&type=all'


def fetch_cls_hotspots(limit=8):
    """
    获取财联社热点文章列表（去重精选版）
    零第三方依赖：使用 Python 标准库 urllib 直接调用财联社电报 API
    """
    import urllib.request
    import urllib.parse
    import hashlib
    import time as _time
    from datetime import datetime

    HEADERS = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Referer': 'https://www.cls.cn/',
        'Accept': 'application/json, text/plain, */*',
    }

    raw_events = []
    last_time = int(_time.time())
    max_pages = 5

    for page in range(max_pages):
        url = 'https://www.cls.cn/v1/roll/get_roll_list'
        refresh_type = '2' if page == 0 else '1'
        params = {
            'app': 'CailianpressWeb',
            'category': '',
            'last_time': str(last_time),
            'os': 'web',
            'refresh_type': refresh_type,
            'rn': '30',
            'sv': '8.4.6',
        }
        params['sign'] = hashlib.md5(
            hashlib.sha1(urllib.parse.urlencode(params).encode('utf-8')).hexdigest().encode('utf-8')
        ).hexdigest()

        full_url = f"https://www.cls.cn/v1/roll/get_roll_list?{urllib.parse.urlencode(params)}"
        req = urllib.request.Request(full_url, headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=15) as resp:
                data = json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            if page == 0:
                return {
                    'success': False,
                    'error': f'cls api error: {str(e)}',
                    'data': []
                }
            break

        roll_data = data.get('data', {}).get('roll_data', [])
        if not roll_data:
            break

        for item in roll_data:
            title = str(item.get('title', '') or item.get('brief_title', '')).strip()
            content_text = str(item.get('content', '') or item.get('brief', '')).strip()
            ctime = item.get('ctime', 0)
            if ctime:
                dt = datetime.fromtimestamp(ctime)
                pub_date = dt.strftime('%Y-%m-%d')
                pub_time = dt.strftime('%H:%M')
            else:
                pub_date = ''
                pub_time = ''

            if not title:
                continue

            # 过滤纯广告/推广类
            ad_keywords = ['扫码', '关注公众号', '点击领取', '免费领', '点击报名', '立即下载']
            if any(kw in title + content_text for kw in ad_keywords):
                continue

            # 分类
            category = classify_event(title, content_text)

            # 关注度
            attention = calc_attention_score(title, content_text)

            # 跳转链接（财联社详情页）
            item_id = item.get('id', '')
            if item_id:
                source_url = f'https://www.cls.cn/detail/{item_id}'
            else:
                encoded_title = urllib.parse.quote(title)
                source_url = f'https://www.cls.cn/searchPage?keyword={encoded_title}&type=all'

            raw_events.append({
                'title': title,
                'summary': content_text[:80] + '...' if len(content_text) > 80 else content_text,
                'content': content_text,
                'category': category,
                'attention': attention,
                'pub_date': pub_date,
                'pub_time': pub_time,
                'source_url': source_url,
                'source': '财联社-电报API',
            })

        # 更新翻页游标
        last_time = roll_data[-1].get('ctime', last_time)

        # 取够40条用于去重精选
        if len(raw_events) >= 40:
            break

    if not raw_events:
        return {
            'success': False,
            'error': 'no data',
            'data': []
        }

    # 去重
    deduped_events = dedupe_events(raw_events)

    # 按关注度排序
    deduped_events.sort(key=lambda x: x.get('attention', 0), reverse=True)

    # 取前 N 条
    hotspots = deduped_events[:limit]

    return {
        'success': True,
        'data': hotspots,
        'source': '财联社-电报API',
        'total': len(raw_events),
        'deduped_count': len(deduped_events),
    }


def main():
    limit = 8
    if len(sys.argv) > 1:
        try:
            limit = int(sys.argv[1])
        except Exception:
            pass

    result = fetch_cls_hotspots(limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
