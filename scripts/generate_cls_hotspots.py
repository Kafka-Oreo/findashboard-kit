#!/usr/bin/env python3
"""
预生成财联社当日热点快讯到 public/cls-hotspots/ 目录
供前端 API 读取，避免依赖实时 Python 环境
数据源：AKShare - stock_info_global_cls（财联社电报）
"""
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fetch_cls_hotspots import (
    classify_event,
    calc_attention_score,
    dedupe_events,
    select_key_events,
    build_cls_url,
)


def generate_date(target_date, limit=15, output_dir=None):
    """
    生成指定日期的财联社热点静态文件
    """
    try:
        import akshare as ak
    except ImportError:
        print(f"[WARN] akshare not installed, skipping cls-hotspots generation", file=sys.stderr)
        return False

    try:
        df = ak.stock_info_global_cls(symbol='财联社')
    except Exception as e:
        print(f"[WARN] akshare error: {e}", file=sys.stderr)
        return False

    if df is None or len(df) == 0:
        print(f"[WARN] no data", file=sys.stderr)
        return False

    raw_events = []
    is_latest = target_date == 'latest'

    for _, row in df.iterrows():
        title = str(row['标题']).strip()
        content = str(row.get('内容', '')).strip()
        pub_date = str(row.get('发布日期', '')).strip()
        pub_time = str(row.get('发布时间', '')).strip()

        # 非 latest 模式下，只取指定日期的
        if not is_latest and pub_date and pub_date != target_date_str:
            continue

        if not title and not content:
            continue

        # 标题为空时用内容前30字当标题
        display_title = title if title else (content[:30] + '...' if len(content) > 30 else content)

        # 过滤广告
        ad_keywords = ['扫码', '关注公众号', '点击领取', '免费领', '点击报名', '立即下载']
        if any(kw in display_title + content for kw in ad_keywords):
            continue

        category = classify_event(display_title, content)
        attention = calc_attention_score(display_title, content)
        url = build_cls_url(display_title)

        # 趋势
        trend = 'neutral'
        up_words = ['涨', '升', '利好', '暴涨', '大涨', '新高', '突破', '走强']
        down_words = ['跌', '降', '利空', '暴跌', '大跌', '新低', '下滑', '下跌', '走弱']
        if any(w in display_title for w in up_words):
            trend = 'up'
        elif any(w in display_title for w in down_words):
            trend = 'down'

        event = {
            'category': category,
            'title': display_title,
            'highlight': content[:120] if len(content) > 120 else content,
            'url': url,
            'source': '财联社',
            'trend': trend,
            'attention': attention,
            'fire_count': attention,
            'pub_time': f'{pub_date} {pub_time}' if pub_date else pub_time,
            'pub_date': pub_date,
        }
        raw_events.append(event)

    # 去重
    deduped = dedupe_events(raw_events)

    # 精选
    selected = select_key_events(deduped, limit=limit)

    result = {
        'success': True,
        'source': 'akshare-cls-precomputed',
        'date': target_date,
        'total': len(selected),
        'raw_count': len(raw_events),
        'deduped_count': len(deduped),
        'data': selected,
    }

    # 写入文件
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
        out_path = os.path.join(output_dir, f'{target_date}.json')
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        print(f"[OK] 财联社热点已生成: {out_path} ({len(selected)}条 / 原始{len(raw_events)}条)")

    return True


if __name__ == '__main__':
    from datetime import datetime
    target = sys.argv[1] if len(sys.argv) > 1 else datetime.now().strftime('%Y-%m-%d')
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 15
    out = sys.argv[3] if len(sys.argv) > 3 else None
    
    success = generate_date(target, limit, out)
    sys.exit(0 if success else 1)
