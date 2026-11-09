#!/usr/bin/env python3
"""
获取财联社当日电报新闻（带原文链接）
通过官方 cls.cn API 获取，包含 id -> https://www.cls.cn/detail/{id} 可精准跳转原文

用法：
  python3 scripts/fetch_cls_telegraph.py [date] [limit]

  date  - YYYYMMDD，默认今天
  limit - 返回条数，默认 50
"""
import sys
import json
import hashlib
import time
import urllib.request
import urllib.error
from urllib.parse import urlencode
from datetime import datetime, date

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Referer": "https://www.cls.cn/",
    "Accept": "application/json, text/plain, */*",
}

CATEGORY_MAP = {
    "宏观": "宏观经济",
    "股市": "股市",
    "公司": "公司",
    "行业": "行业",
    "科技": "科技",
    "市场": "市场",
    "数据": "数据",
    "地产": "地产",
    "外汇": "外汇",
    "债券": "债券",
    "期货": "期货",
    "商品": "商品",
    "国际": "国际",
    "港股": "港股",
    "美股": "美股",
    "电新": "新能源",
    "汽车": "汽车",
    "医药": "医药",
    "消费": "消费",
    "金融": "金融",
    "TMT": "TMT",
    "军工": "军工",
    "有色": "有色金属",
    "化工": "化工",
    "机械": "机械",
    "建材": "建材",
    "食品": "食品饮料",
}


def fetch_cls_telegraph(target_date=None, limit=100, max_pages=30):
    """
    滚动拉取财联社电报，直到获取到目标日期的所有新闻
    :param target_date: date 对象，默认今天
    :param limit: 最大返回条数
    :param max_pages: 最多翻页数
    :return: list of news items
    """
    if target_date is None:
        target_date = date.today()

    all_items = []
    last_time = int(time.time())
    reached_target_day = False
    passed_target_day = False
    page = 0
    # 第一页用 refresh_type=2 拉最新；翻页用 refresh_type=1 向前滚动
    refresh_type = "2"

    while page < max_pages and not passed_target_day:
        page += 1
        url = "https://www.cls.cn/v1/roll/get_roll_list"
        params = {
            "app": "CailianpressWeb",
            "category": "",
            "last_time": last_time,
            "os": "web",
            "refresh_type": refresh_type,
            "rn": "30",
            "sv": "8.4.6",
        }
        params["sign"] = hashlib.md5(
            hashlib.sha1(urlencode(params).encode("utf-8")).hexdigest().encode("utf-8")
        ).hexdigest()

        try:
            full_url = f"{url}?{urlencode(params)}"
            req = urllib.request.Request(full_url, headers=HEADERS)
            with urllib.request.urlopen(req, timeout=15) as resp:
                raw = resp.read().decode("utf-8")
            data = json.loads(raw)
        except Exception as e:
            print(f"Error fetching page {page}: {e}", file=sys.stderr)
            break

        roll_data = data.get("data", {}).get("roll_data", [])
        if not roll_data:
            break

        # 翻页后改为向前滚动模式
        if refresh_type == "2":
            refresh_type = "1"

        for item in roll_data:
            ctime = item.get("ctime", 0)
            item_date = datetime.fromtimestamp(ctime).date()

            if item_date > target_date:
                # 还没翻到目标日期，继续
                last_time = ctime
                continue

            if item_date < target_date:
                # 已经翻过了目标日期
                passed_target_day = True
                break

            reached_target_day = True
            last_time = ctime
            all_items.append(item)
            if len(all_items) >= limit:
                passed_target_day = True
                break

        if not roll_data:
            break

    # 转换为统一格式
    seen_ids = set()
    results = []
    for item in all_items:
        item_id = item.get("id", "")
        if not item_id or item_id in seen_ids:
            continue

        title = item.get("title", "").strip()
        content = item.get("content", "").strip()
        if not title and not content:
            continue

        ctime = item.get("ctime", 0)
        level = item.get("level", "")
        brief = item.get("brief", "")

        # 清洗content：去掉开头的【标题】前缀
        if content.startswith("【") and "】" in content:
            body = content[content.index("】") + 1:].strip()
        else:
            body = content

        # 没有title时，取content前30字作为title
        if not title:
            title = body[:30].strip()

        # 从subjects获取主题/分类
        subjects = item.get("subjects", [])
        subject_names = []
        if isinstance(subjects, list):
            for s in subjects:
                if isinstance(s, dict) and s.get("subject_name"):
                    subject_names.append(s["subject_name"])

        seen_ids.add(item_id)
        results.append({
            "id": item_id,
            "title": title,
            "content": body,
            "brief": brief,
            "url": f"https://www.cls.cn/detail/{item_id}",
            "ctime": ctime,
            "publish_time": datetime.fromtimestamp(ctime).strftime("%Y-%m-%d %H:%M:%S"),
            "level": level,
            "subjects": subject_names,
            "source": "财联社",
        })

    # 按时间倒序排列
    results.sort(key=lambda x: x["ctime"], reverse=True)

    return {
        "date": target_date.strftime("%Y%m%d"),
        "total": len(results),
        "data": results,
        "fetched_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
    }


def deduplicate_news(news_list):
    """
    去重：基于标题相似度 + 内容重叠
    1. 完全相同标题（去标点空格后）直接去重
    2. 标题前15字相同的，保留第一条
    3. 标题中相同关键词超过80%的视为重复
    """
    import re

    def normalize(text):
        """标准化：去标点、空格、特殊符号"""
        return re.sub(r'[^\w\u4e00-\u9fa5]', '', text)

    def char_overlap(a, b):
        """判断两个字符串的字符重叠率"""
        if not a or not b:
            return 0
        set_a = set(a)
        set_b = set(b)
        if not set_a or not set_b:
            return 0
        return len(set_a & set_b) / min(len(set_a), len(set_b))

    seen_titles = []  # list of normalized titles
    result = []

    for item in news_list:
        title_norm = normalize(item.get("title", ""))
        if not title_norm:
            continue

        # 检查是否重复
        is_dup = False
        for seen in seen_titles:
            # 完全一致
            if title_norm == seen:
                is_dup = True
                break
            # 前缀相同（前12字以上相同）
            min_len = min(len(title_norm), len(seen))
            if min_len >= 12 and title_norm[:12] == seen[:12]:
                is_dup = True
                break
            # 字符重叠率超过 75%
            if char_overlap(title_norm, seen) > 0.75:
                is_dup = True
                break

        if not is_dup:
            seen_titles.append(title_norm)
            result.append(item)

    return result


def classify_news(news_list):
    """
    按主题+关键词分类：外部因素 vs 内部因素

    外部因素：侧重海外市场（美股、环球、外汇、大宗商品、国际政治、全球科技巨头）
    内部因素：侧重国内 + A股（国内政策、行业公司、A股公告、产业新闻）

    原则：
    - 明确海外主题 → 外部
    - 明确A股/国内政策主题 → 内部
    - 文本中强海外关键词 → 外部
    - 文本中强国内/A股关键词 → 内部
    - 两边都不沾的 → 按主题倾向或默认内部
    - 两边都沾的 → 选主题更多的一方
    """
    # === 外部因素主题（强匹配） ===
    external_subject_strong = [
        "美股", "美股动态", "美股盘前", "美股财报",
        "环球市场", "环球市场情报", "全球市场",
        "外汇", "美元", "人民币汇率", "离岸人民币",
        "大宗商品", "原油", "黄金", "白银", "贵金属",
        "美债", "美联储", "欧央行", "日央行", "英国央行",
        "国际财经", "全球财经",
    ]

    # 外部因素主题（弱匹配）
    external_subject_weak = [
        "港股", "港股动态", "恒生指数",
        "期货", "商品期货",
        "国际航运", "海运",
    ]

    # === 内部因素主题（强匹配） ===
    internal_subject_strong = [
        "A股", "A股公告", "A股公告速递", "A股策略",
        "科创板", "创业板", "北交所",
        "证监会", "国常会", "央行", "财政部", "发改委",
        "国内宏观", "宏观经济", "中国经济",
        "A股公司", "上市公司", "公告速递",
    ]

    # 内部因素主题（弱匹配）
    internal_subject_weak = [
        "半导体", "半导体芯片", "芯片", "新能源", "汽车",
        "医药", "消费", "地产", "军工", "化工", "机械",
        "建材", "食品", "白酒", "通信", "计算机", "传媒",
        "电子", "光伏", "储能", "锂电池", "充电桩",
        "AI", "人工智能", "机器人",
        "A股行业", "行业板块",
    ]

    # 外部文本强关键词（出现即可判外部）
    external_text_strong = [
        "美联储", "FOMC", "鲍威尔", "美债",
        "美股", "道指", "纳指", "标普500", "道琼斯", "纳斯达克",
        "WTI", "布伦特", "COMEX", "OPEC+", "欧佩克",
        "特朗普", "拜登",
        "欧洲央行", "日本央行", "英国央行",
        "离岸人民币", "美元兑人民币", "人民币兑美元",
        "霍尔木兹", "中东局势", "俄乌", "巴以",
        "国际油价", "国际金价", "全球股市",
    ]

    # 内部文本强关键词（出现即可判内部）
    internal_text_strong = [
        "A股", "上证指数", "深证成指", "创业板指", "科创50",
        "证监会", "国常会", "国务院", "政治局", "中央经济工作会议",
        "降准", "MLF", "LPR", "逆回购", "央行公开市场",
        "北向资金", "南向资金", "融资融券",
        "涨停", "跌停", "连板", "领涨", "领跌",
        "财政部", "发改委", "工信部", "商务部", "住建部",
        "上海证券交易所", "深圳证券交易所", "上交所", "深交所",
        "上市公司", "股份有限公司", "公告", "业绩预告",
    ]

    external = []
    internal = []

    for item in news_list:
        subjects = item.get("subjects", [])
        subjects_str = " ".join(subjects)
        title = item.get("title", "")
        content = item.get("content", "")
        text = title + " " + content

        # === 计算得分 ===
        ext_score = 0
        int_score = 0

        # 主题强匹配 = 3分
        for kw in external_subject_strong:
            if kw in subjects_str:
                ext_score += 3
                break

        for kw in internal_subject_strong:
            if kw in subjects_str:
                int_score += 3
                break

        # 主题弱匹配 = 1分
        for kw in external_subject_weak:
            if kw in subjects_str:
                ext_score += 1
                break

        for kw in internal_subject_weak:
            if kw in subjects_str:
                int_score += 1
                break

        # 文本强关键词 = 2分
        ext_text_hits = sum(1 for kw in external_text_strong if kw in text)
        int_text_hits = sum(1 for kw in internal_text_strong if kw in text)
        ext_score += min(ext_text_hits * 2, 4)  # 最多加4分
        int_score += min(int_text_hits * 2, 4)  # 最多加4分

        # === 特殊规则：主题直接归类（最高优先级）===
        has_us_market = any(("美股" in s) for s in subjects)
        has_global = any(("环球" in s) for s in subjects)
        has_forex = any(("外汇" in s) for s in subjects)
        has_us_bond = any(("美债" in s) for s in subjects)
        has_commodity_intl = any(("原油" in s or "黄金" in s or "白银" in s or "大宗商品" in s or "贵金属" in s) for s in subjects)
        has_a_stock = any(("A股" in s or "公告" in s) for s in subjects)
        has_domestic_policy = any(("证监会" in s or "国常会" in s or "央行" in s or "财政部" in s or "发改委" in s or "工信部" in s or "商务部" in s) for s in subjects)
        has_domestic_industry = any(("半导体" in s or "芯片" in s or "新能源" in s or "光伏" in s or "医药" in s or "汽车产业" in s or "消费" in s or "地产" in s or "军工" in s or "机械" in s or "化工" in s or "储能" in s or "基建" in s) for s in subjects)
        has_weather = any(("天气" in s or "台风" in s or "地震" in s) for s in subjects)
        has_domestic_macro = any(("国内宏观" in s or "中国经济" in s) for s in subjects)
        has_regulatory = any(("A股监管" in s or "A股交易" in s) for s in subjects)
        has_infra = any(("基建" in s or "投资" in s) for s in subjects)

        # 内部因素：A股 / 国内政策 / 国内行业 / 天气灾害 / 国内宏观 / 基建投资
        if has_a_stock or has_domestic_policy or has_domestic_industry or has_domestic_macro or has_weather or has_regulatory or has_infra:
            internal.append(item)
            continue

        # 外部因素：美股 / 环球市场 / 外汇 / 美债 / 国际大宗商品
        if has_us_market or has_global or has_forex or has_us_bond or has_commodity_intl:
            external.append(item)
            continue

        # 期货市场情报：根据文本关键词判断内外
        if any(("期货" in s or "商品" in s) for s in subjects):
            # 国内期货关键词
            domestic_futures = ["国内商品", "上期所", "大商所", "郑商所", "沪银", "沪金", "沪铜", "沪锌", "螺纹", "铁矿石", "焦炭", "焦煤", "豆粕", "棕榈"]
            # 国际期货关键词
            intl_futures = ["COMEX", "WTI", "布伦特", "LME", "伦敦", "纽约", "CBOT", "ICE", "国际油价", "国际金价", "美元指数"]

            has_dom_fut = any(kw in text for kw in domestic_futures)
            has_intl_fut = any(kw in text for kw in intl_futures)

            if has_intl_fut and not has_dom_fut:
                external.append(item)
                continue
            elif has_dom_fut:
                internal.append(item)
                continue

        # 航运主题：根据文本判断
        if any(("航运" in s or "海运" in s) for s in subjects):
            if any(kw in text for kw in ["霍尔木兹", "红海", "巴拿马", "苏伊士", "马士基", "地中海航运", "国际航运", "全球航运"]):
                external.append(item)
                continue
            else:
                internal.append(item)
                continue

        # 得分判断
        if ext_score > int_score:
            external.append(item)
        elif int_score > ext_score:
            internal.append(item)
        else:
            # 打平时：标题/内容含明确国内地域词且无强海外词 → 归内部
            domestic_words = ["上海", "北京", "深圳", "广东", "中国", "国内", "我国", "A股", "沪深", "深交所", "上交所", "国家", "国务院", "财政部", "证监会", "央行", "发改委"]
            intl_words = ["美国", "美股", "美联储", "日本", "欧洲", "欧盟", "英国", "德国", "法国", "印度", "巴西", "俄罗斯", "全球", "国际", "海外", "环球"]
            has_domestic_word = any(w in title or w in content for w in domestic_words)
            has_intl_word = any(w in title or w in content for w in intl_words)

            # 明确有国际/海外词且无国内强词 → 外部
            if has_intl_word and not has_domestic_word:
                external.append(item)
            else:
                internal.append(item)

    return external, internal


def main():
    target_date = None
    limit = 80

    if len(sys.argv) > 1:
        date_str = sys.argv[1]
        try:
            target_date = datetime.strptime(date_str, "%Y%m%d").date()
        except ValueError:
            print(f"Invalid date format: {date_str}, use YYYYMMDD", file=sys.stderr)
            sys.exit(1)

    if len(sys.argv) > 2:
        try:
            limit = int(sys.argv[2])
        except ValueError:
            pass

    result = fetch_cls_telegraph(target_date, limit)

    # 先去重
    deduped = deduplicate_news(result["data"])

    # 再分类
    external, internal = classify_news(deduped)

    output = {
        "date": result["date"],
        "total": len(deduped),
        "fetched_at": result["fetched_at"],
        "external": {
            "count": len(external),
            "data": external,
        },
        "internal": {
            "count": len(internal),
            "data": internal,
        },
    }

    print(json.dumps(output, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
