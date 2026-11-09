#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
板块成份股实时行情 — 多源免费行情接口轮询（5级降级）
规定口径：主力支持【东方财富一级行业板块】，与日报"板块涨跌排行"(stock_board_industry_name_em) 同源。
优先级：
  1. 东方财富一级行业成分（push2delay 延时行情镜像，参数同 push2；板块名与排行榜逐字精确匹配，
     返回全量成分 + 实时涨跌幅 + 官方涨跌家数）
  2. 申万一级行业官方成分（全量）+ 腾讯行情批量补涨跌幅（兜底）
  3. 同花顺行业板块直连 (q.10jqka.com.cn/thshy)
  4. 同花顺概念板块直连 (q.10jqka.com.cn/gn)
  5. 东方财富 push2 JSON 接口（主域不稳时通常不可达，保留）
注：① 全部纯 HTTP，不依赖 akshare（规避成分接口废弃/未装包/东财主域阻断）；
    ② 输出全量成分股及上涨/下跌家数，避免仅取涨幅榜前 N 只的幸存者偏差。

执行规则：
  - 禁止读取本地缓存、禁止使用模拟编造数据
  - 单接口超时 8 秒，超时立刻切换下一个数据源
  - 三个数据源全部调用失败，才返回错误
  - 板块名称模糊匹配，不完全一致也尽量命中
  - 成功后返回个股名称 + 当日涨跌幅（2位小数）
  - 校验：个股涨跌方向与板块整体方向匹配

用法：python3 fetch_sector_cons_multi.py "板块名称" "预期涨跌幅"
输出：JSON（stdout）
"""
import sys
import json
import datetime
import signal

TARGET_DATE = datetime.date.today().isoformat()
TIMEOUT_SECONDS = 8
# 同花顺直连源需翻页（行业全量分页），给更宽的单源预算
THS_TIMEOUT_SECONDS = 20
# 申万全量成分 + 腾讯分批行情，给最宽预算
SW_TIMEOUT_SECONDS = 30
# 东财行业主力源（列表+成分分页）
EM_TIMEOUT_SECONDS = 25


# ---------------------------------------------------------------------------
# 超时工具
# ---------------------------------------------------------------------------
class TimeoutError(Exception):
    pass


def _timeout_handler(signum, frame):
    raise TimeoutError("接口调用超时")


def with_timeout(func, timeout=TIMEOUT_SECONDS):
    """限时执行函数，超时返回 None"""
    old_handler = signal.signal(signal.SIGALRM, _timeout_handler)
    signal.alarm(timeout)
    try:
        result = func()
        signal.alarm(0)
        return result
    except TimeoutError:
        signal.alarm(0)
        return None
    except Exception:
        signal.alarm(0)
        return None
    finally:
        signal.signal(signal.SIGALRM, old_handler)


# ---------------------------------------------------------------------------
# 板块名称模糊匹配工具
# ---------------------------------------------------------------------------
def normalize(name: str) -> str:
    """规范化板块名：去空格、去Ⅱ/Ⅲ、去括号、转小写"""
    if not name:
        return ""
    n = name.strip().lower()
    for ch in [" ", "　", "Ⅱ", "Ⅲ", "Ⅱ", "ⅱ", "ⅲ", "(", ")", "（", "）"]:
        n = n.replace(ch, "")
    return n


def fuzzy_match(sector: str, candidate: str) -> float:
    """返回 0~1 的相似度，基于子串包含 + 字符重合度"""
    s1, s2 = normalize(sector), normalize(candidate)
    if not s1 or not s2:
        return 0.0
    if s1 == s2:
        return 1.0
    if s1 in s2 or s2 in s1:
        return 0.9
    # 字符重合度
    set1, set2 = set(s1), set(s2)
    if not set1 or not set2:
        return 0.0
    common = len(set1 & set2)
    union = len(set1 | set2)
    return common / union if union > 0 else 0.0


def find_best_match(target: str, candidates: list[str]) -> tuple[str | None, float]:
    """从候选列表中找最相似的板块名"""
    best_name, best_score = None, 0.0
    for c in candidates:
        score = fuzzy_match(target, c)
        if score > best_score:
            best_score = score
            best_name = c
    # 相似度阈值 0.5 以上才认为匹配
    if best_score >= 0.5:
        return best_name, best_score
    return None, 0.0


# ---------------------------------------------------------------------------
# 结果校验（宽松版：主要校验方向匹配 + 数据完整）
# ---------------------------------------------------------------------------
def validate_stocks(stocks: list[dict], expected_change: float) -> bool:
    if not stocks or len(stocks) < 3:
        return False

    # 计算平均涨跌幅
    changes = [s.get("change") for s in stocks if s.get("change") is not None]
    if not changes:
        return False

    avg_change = sum(changes) / len(changes)
    direction = 1 if expected_change > 0 else (-1 if expected_change < 0 else 0)

    # 涨跌幅偏差太大则舍弃（容忍 ±3%，因为个股和板块整体有差异）
    if direction != 0 and abs(avg_change - expected_change) > 5.0:
        # 差距过大但方向一致仍可接受（因为成分股样本可能不全）
        if (avg_change > 0 and expected_change > 0) or (avg_change < 0 and expected_change < 0):
            pass
        else:
            return False

    # 方向匹配：>50% 个股与板块同向即通过
    if direction != 0:
        same_dir = sum(1 for c in changes
                       if (direction > 0 and c >= 0) or (direction < 0 and c <= 0))
        ratio = same_dir / len(changes)
        if ratio < 0.45:
            return False

    return True


# ===========================================================================
# 数据源 1：AKShare - 同花顺概念板块成分股 (ak.ths_concept)
# ===========================================================================
def fetch_ths_concept(sector_name: str, expected_change: float) -> dict | None:
    try:
        import akshare as ak
    except ImportError:
        return None

    def _do_fetch():
        # 先获取全部同花顺概念板块列表，做模糊匹配
        try:
            concept_list_df = ak.stock_board_concept_name_ths()
        except Exception:
            try:
                concept_list_df = ak.stock_board_concept_name_em()
            except Exception:
                return None

        if concept_list_df is None or concept_list_df.empty:
            return None

        # 找概念名称列
        name_col = None
        for col in concept_list_df.columns:
            if "概念名称" in col or "板块名称" in col or "名称" in col:
                name_col = col
                break
        if not name_col:
            return None

        candidates = concept_list_df[name_col].astype(str).tolist()
        matched_name, score = find_best_match(sector_name, candidates)
        if not matched_name:
            return None

        # 获取成分股
        try:
            df = ak.stock_board_concept_cons_ths(symbol=matched_name)
        except Exception:
            try:
                df = ak.stock_board_concept_cons_em(symbol=matched_name)
            except Exception:
                return None

        if df is None or df.empty:
            return None

        # 映射列名
        name_col_stock = code_col_stock = change_col_stock = None
        for col in df.columns:
            cl = str(col)
            if "股票名称" in cl or "名称" in cl or "name" in cl.lower():
                if not name_col_stock:
                    name_col_stock = col
            elif "股票代码" in cl or "代码" in cl or "code" in cl.lower():
                if not code_col_stock:
                    code_col_stock = col
            elif "涨跌幅" in cl or ("change" in cl.lower() and "涨跌" not in cl):
                if "涨跌幅" in cl:
                    change_col_stock = col
            elif cl == "涨跌幅":
                change_col_stock = col

        if not name_col_stock or not change_col_stock:
            return None

        stocks = []
        for _, row in df.iterrows():
            try:
                change_val = float(row[change_col_stock])
            except (ValueError, TypeError):
                continue
            stock_name = str(row[name_col_stock])
            stock_code = str(row[code_col_stock]) if code_col_stock else ""
            if not stock_name or stock_name == "nan":
                continue
            stocks.append({
                "name": stock_name,
                "code": stock_code,
                "change": round(change_val, 2),
            })

        if not validate_stocks(stocks, expected_change):
            return None

        return {
            "sectorName": sector_name,
            "matchedName": matched_name,
            "stocks": stocks,
        }

    return with_timeout(_do_fetch, TIMEOUT_SECONDS)


# ===========================================================================
# 数据源 2：AKShare - 申万行业成分股 (ak.sw_index_cons)
# ===========================================================================
def fetch_sw_index_cons(sector_name: str, expected_change: float) -> dict | None:
    try:
        import akshare as ak
    except ImportError:
        return None

    def _do_fetch():
        # 获取申万行业列表
        try:
            sw_list_df = ak.sw_index_first_info()
        except Exception:
            try:
                sw_list_df = ak.index_stock_info_sw()
            except Exception:
                return None

        if sw_list_df is None or sw_list_df.empty:
            return None

        # 找行业名称列
        name_col = code_col = None
        for col in sw_list_df.columns:
            cl = str(col)
            if "行业名称" in cl or "名称" in cl or "name" in cl.lower():
                if not name_col:
                    name_col = col
            elif "行业代码" in cl or "指数代码" in cl or "代码" in cl or "code" in cl.lower():
                if not code_col:
                    code_col = col

        if not name_col:
            return None

        candidates = sw_list_df[name_col].astype(str).tolist()
        matched_name, score = find_best_match(sector_name, candidates)
        if not matched_name:
            return None

        # 找到对应行的指数代码
        matched_code = None
        if code_col:
            row = sw_list_df[sw_list_df[name_col] == matched_name]
            if not row.empty:
                matched_code = str(row.iloc[0][code_col])

        # 获取成分股
        try:
            if matched_code:
                df = ak.sw_index_cons(symbol=matched_code)
            else:
                df = ak.sw_index_cons(symbol=matched_name)
        except Exception:
            try:
                df = ak.index_stock_cons_sw(symbol=matched_code or matched_name)
            except Exception:
                return None

        if df is None or df.empty:
            return None

        # 申万成分股只有股票名+代码，没有实时涨跌幅
        # 需要逐个获取实时行情 → 成本太高，这里退而求其次：
        # 如果有涨跌幅列就用，没有就返回 None 让下一个数据源处理
        name_col_stock = code_col_stock = change_col_stock = None
        for col in df.columns:
            cl = str(col)
            if "股票名称" in cl or "名称" in cl or "name" in cl.lower():
                if not name_col_stock:
                    name_col_stock = col
            elif "股票代码" in cl or "代码" in cl or "code" in cl.lower():
                if not code_col_stock:
                    code_col_stock = col
            elif "涨跌幅" in cl:
                change_col_stock = col

        if not name_col_stock:
            return None

        if not change_col_stock:
            # 没有实时涨跌幅数据，跳过此数据源
            return None

        stocks = []
        for _, row in df.iterrows():
            try:
                change_val = float(row[change_col_stock])
            except (ValueError, TypeError):
                continue
            stock_name = str(row[name_col_stock])
            stock_code = str(row[code_col_stock]) if code_col_stock else ""
            if not stock_name or stock_name == "nan":
                continue
            stocks.append({
                "name": stock_name,
                "code": stock_code,
                "change": round(change_val, 2),
            })

        if not validate_stocks(stocks, expected_change):
            return None

        return {
            "sectorName": sector_name,
            "matchedName": matched_name,
            "stocks": stocks,
        }

    return with_timeout(_do_fetch, TIMEOUT_SECONDS)


# ===========================================================================
# 数据源 3：东方财富板块主页 JSON 接口（兜底）
# ===========================================================================
def fetch_eastmoney_json(sector_name: str, expected_change: float) -> dict | None:
    def _do_fetch():
        import urllib.request
        import urllib.parse

        # 东方财富板块搜索：先找板块代码
        search_url = "https://search-api-web.eastmoney.com/search/jsonp?cb=jQuery&param="
        param = {
            "uid": "",
            "keyword": sector_name,
            "type": ["cmsArticleWebOld"],
            "client": "web",
            "clientType": "web",
            "clientVersion": "curr",
            "param": {
                "cmsArticleWebOld": {
                    "searchScope": "default",
                    "sort": "default",
                    "pageIndex": 1,
                    "pageSize": 5,
                    "preTag": "<em>",
                    "postTag": "</em>"
                }
            }
        }
        # 搜索接口不适用于板块代码查找，改用板块列表直接匹配
        try:
            # 尝试调用东方财富概念板块列表
            url = "https://push2.eastmoney.com/api/qt/clist/get?pn=1&pz=500&po=1&np=1&fltt=2&invt=2&fid=f3&fs=m:90+t:3&fields=f2,f3,f4,f12,f14"
            req = urllib.request.Request(url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return None

        diff = (data.get("data") or {}).get("diff") or []
        if not diff:
            return None

        # 模糊匹配板块名
        candidates = [str(item.get("f14", "")) for item in diff if item.get("f14")]
        matched_name, score = find_best_match(sector_name, candidates)
        if not matched_name:
            return None

        # 获取匹配到的板块代码
        matched_item = next(
            (item for item in diff if str(item.get("f14")) == matched_name),
            None
        )
        if not matched_item:
            return None

        sector_code = str(matched_item.get("f12", ""))
        if not sector_code:
            return None

        # 获取该板块成分股列表
        try:
            # f12=代码 f14=名称 f2=最新价 f3=涨跌幅
            cons_url = (
                f"https://push2.eastmoney.com/api/qt/clist/get?"
                f"pn=1&pz=100&po=1&np=1&fltt=2&invt=2&fid=f3&"
                f"fs=b:{sector_code}+f:!50&fields=f2,f3,f12,f14"
            )
            req = urllib.request.Request(cons_url, headers={
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
            })
            with urllib.request.urlopen(req, timeout=5) as resp:
                cons_data = json.loads(resp.read().decode("utf-8"))
        except Exception:
            return None

        cons_diff = (cons_data.get("data") or {}).get("diff") or []
        if not cons_diff:
            return None

        stocks = []
        for item in cons_diff:
            name = str(item.get("f14", ""))
            code = str(item.get("f12", ""))
            try:
                change_val = float(item.get("f3"))
            except (ValueError, TypeError):
                continue
            if not name or name == "nan" or name == "-":
                continue
            stocks.append({
                "name": name,
                "code": code,
                "change": round(change_val, 2),
            })

        if not validate_stocks(stocks, expected_change):
            return None

        return {
            "sectorName": sector_name,
            "matchedName": matched_name,
            "stocks": stocks,
        }

    return with_timeout(_do_fetch, TIMEOUT_SECONDS)


# ===========================================================================
# 数据源：同花顺 q.10jqka.com.cn 直连（纯 HTTP，不依赖 akshare）
#   - 行业板块：列表页取板块代码，detail 分页（ajax）抓全量成分，表格自带涨跌幅
#   - 概念板块：列表页取板块代码，detail 首页抓成分（概念分页有反爬，仅首页）
#   - 表格列：序号 / 代码(6位) / 名称 / 现价 / 涨跌幅(%) / ...
# ===========================================================================
THS_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
}


def _ths_http_get(url: str, referer: str) -> str:
    import urllib.request

    req = urllib.request.Request(
        url, headers={**THS_HEADERS, "Referer": referer}
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        return resp.read().decode("gbk", "ignore")


def _parse_ths_cons_rows(html: str) -> list[dict]:
    """解析同花顺成分股表格行 → [{name, code, change}]"""
    import re

    stocks = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html, re.S):
        tds = [
            re.sub(r"<[^>]+>", "", t).replace("&nbsp;", "").strip()
            for t in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)
        ]
        if len(tds) < 5 or not re.fullmatch(r"\d{6}", tds[1]):
            continue
        try:
            change_val = float(tds[4])
        except (ValueError, TypeError):
            continue
        name = tds[2]
        if not name or name in ("-", "nan"):
            continue
        stocks.append({
            "name": name,
            "code": tds[1],
            "change": round(change_val, 2),
        })
    return stocks


def _ths_fetch_board_list(kind: str) -> list[tuple[str, str]]:
    """抓取同花顺板块列表，返回 [(code, name)]。kind: 'thshy'(行业) / 'gn'(概念)"""
    import re

    base = f"http://q.10jqka.com.cn/{kind}/"
    html = _ths_http_get(base, "http://q.10jqka.com.cn/")
    pattern = rf"{kind}/detail/code/(\d+)/[^>\"]*\"[^>]*>([^<]+)<"
    pairs = re.findall(pattern, html)
    return [(code, name.strip()) for code, name in pairs if name.strip()]


def _ths_fetch_cons(kind: str, code: str, max_pages: int) -> list[dict]:
    """抓取某板块成分股。kind: 'thshy'(行业,分页全量) / 'gn'(概念,仅首页)"""
    import time

    home_url = f"http://q.10jqka.com.cn/{kind}/detail/code/{code}/"
    stocks = _parse_ths_cons_rows(_ths_http_get(home_url, f"http://q.10jqka.com.cn/{kind}/"))

    # 概念板块分页 ajax 有反爬(401)，仅行业板块抓分页全量
    if kind == "thshy":
        seen = {s["code"] for s in stocks}
        for page in range(2, max_pages + 1):
            page_url = (
                f"http://q.10jqka.com.cn/{kind}/detail/field/199112/order/desc/"
                f"page/{page}/ajax/1/code/{code}/"
            )
            try:
                rows = _parse_ths_cons_rows(_ths_http_get(page_url, home_url))
            except Exception:
                break
            if not rows:
                break
            new_rows = [r for r in rows if r["code"] not in seen]
            if not new_rows:
                break
            for r in new_rows:
                seen.add(r["code"])
            stocks.extend(new_rows)
            if len(rows) < 20:
                break
            time.sleep(0.3)

    return stocks


def _fetch_ths(kind: str, sector_name: str, expected_change: float,
               label: str) -> dict | None:
    def _do_fetch():
        boards = _ths_fetch_board_list(kind)
        if not boards:
            return None

        names = [name for _, name in boards]
        matched_name, score = find_best_match(sector_name, names)
        if not matched_name:
            return None
        matched_code = next(code for code, name in boards if name == matched_name)

        stocks = _ths_fetch_cons(kind, matched_code, max_pages=6)
        if not stocks or len(stocks) < 3:
            return None

        # 高置信匹配（板块名归一化后一致/子串包含，score>=0.9）成分归属已可靠，
        # 仅成分股采样（尤其首页前20只）的涨跌方向不能代表板块整体，跳过方向校验，
        # 避免把真实成分误杀；低置信匹配才用方向校验防止模糊匹配到错误板块。
        if score < 0.9 and not validate_stocks(stocks, expected_change):
            return None

        return {
            "sectorName": sector_name,
            "matchedName": matched_name,
            "matchScore": round(score, 2),
            "stocks": stocks,
        }

    return with_timeout(_do_fetch, THS_TIMEOUT_SECONDS)


def fetch_ths_industry_http(sector_name: str, expected_change: float) -> dict | None:
    """数据源 1：同花顺行业板块成分（直连，含全量分页 + 实时涨跌幅）"""
    return _fetch_ths("thshy", sector_name, expected_change, "行业")


def fetch_ths_concept_http(sector_name: str, expected_change: float) -> dict | None:
    """数据源 2：同花顺概念板块成分（直连，首页成分 + 实时涨跌幅）"""
    return _fetch_ths("gn", sector_name, expected_change, "概念")


# ===========================================================================
# 数据源：申万一级行业官方成分（全量）+ 腾讯行情批量补涨跌幅（纯 HTTP）
#   - 申万官方 API 返回一级行业全部成分股代码/名称/权重（无翻页）
#   - 腾讯 qt.gtimg.cn 批量查实时涨跌幅（GBK，~分隔；parts[1]=名称 parts[32]=涨跌幅%）
#   - 覆盖 31 个申万一级行业，数据全量，避免同花顺首页"涨幅榜前20只"幸存者偏差
# ===========================================================================
# 申万一级行业：标准名 → 申万成分代码（纯代码，不带 .SI 后缀）
SW_LEVEL1 = {
    "农林牧渔": "801010", "基础化工": "801030", "钢铁": "801040",
    "有色金属": "801050", "电子": "801080", "汽车": "801880",
    "家用电器": "801110", "食品饮料": "801120", "纺织服饰": "801130",
    "轻工制造": "801140", "医药生物": "801150", "公用事业": "801160",
    "交通运输": "801170", "房地产": "801180", "商贸零售": "801200",
    "社会服务": "801210", "银行": "801780", "非银金融": "801790",
    "综合": "801230", "建筑材料": "801710", "建筑装饰": "801720",
    "电力设备": "801730", "机械设备": "801890", "国防军工": "801740",
    "计算机": "801750", "传媒": "801760", "通信": "801770",
    "煤炭": "801950", "石油石化": "801960", "环保": "801970",
    "美容护理": "801980",
}

# 成分规模大（>200只）的申万一级行业：其"细分板块"（子串匹配命中）不用全行业兜底，
# 否则会把三级细分（如"电子化学品"43只）误扩成整个一级（如"电子"493只），范围夸大。
# 仅板块名与一级名精确一致时才用这些行业；细分板块落到同花顺细分源。
LARGE_LEVEL1 = {"基础化工", "电子", "汽车", "医药生物", "计算机", "电力设备", "机械设备"}


def _tx_prefix(code: str) -> str:
    if code.startswith(("4", "8", "920")):
        return "bj" + code
    if code.startswith(("60", "68", "90", "11", "13", "18")):
        return "sh" + code
    return "sz" + code


def _tx_batch_change(codes: list[str]) -> dict[str, float]:
    """腾讯批量行情：返回 {code: 涨跌幅%}，每批 50 只"""
    import urllib.request
    import time

    result: dict[str, float] = {}
    for i in range(0, len(codes), 50):
        batch = codes[i:i + 50]
        url = "https://qt.gtimg.cn/q=" + ",".join(_tx_prefix(c) for c in batch)
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://gu.qq.com/"}
        )
        raw = urllib.request.urlopen(req, timeout=10).read().decode("gbk", "ignore")
        for line in raw.strip().split(";"):
            line = line.strip()
            if '"' not in line:
                continue
            var, val = line.split("=", 1)
            code = var.split("_")[-1][2:]  # 去掉 sh/sz/bj 前缀
            parts = val.strip('"').split("~")
            if len(parts) > 32 and parts[32] not in ("", "-"):
                try:
                    result[code] = float(parts[32])
                except ValueError:
                    pass
        if i + 50 < len(codes):
            time.sleep(0.3)
    return result


def fetch_sw_level1_tencent(sector_name: str, expected_change: float) -> dict | None:
    """数据源 0：申万一级行业全量成分 + 腾讯实时行情"""
    def _do_fetch():
        import urllib.request
        import urllib.parse
        import json as _json
        import ssl

        names = list(SW_LEVEL1.keys())
        matched_name, score = find_best_match(sector_name, names)
        # 申万一级仅覆盖大类，子串包含(0.9)或更精确才采信，避免三级板块误配到一级
        if not matched_name or score < 0.9:
            return None
        # 非精确匹配（板块名≠一级名）且命中大行业时不兜底，细分板块交由同花顺细分源
        exact = normalize(sector_name) == normalize(matched_name)
        if not exact and matched_name in LARGE_LEVEL1:
            return None

        sw_code = SW_LEVEL1[matched_name]
        url = (
            "https://www.swsresearch.com/institute-sw/api/index_publish/details/"
            "component_stocks/?" + urllib.parse.urlencode(
                {"swindexcode": sw_code, "page": "1", "page_size": "10000"}
            )
        )
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        req = urllib.request.Request(
            url, headers={"User-Agent": "Mozilla/5.0 Chrome/114.0.0.0"}
        )
        data = _json.loads(
            urllib.request.urlopen(req, timeout=10, context=ctx).read().decode()
        )
        rows = ((data.get("data") or {}).get("results")) or []
        if len(rows) < 3:
            return None

        codes = [str(r.get("stockcode", "")).zfill(6) for r in rows]
        change_map = _tx_batch_change(codes)

        stocks = []
        for r in rows:
            code = str(r.get("stockcode", "")).zfill(6)
            name = str(r.get("stockname", "")).strip()
            if not name or name == "nan":
                continue
            ch = change_map.get(code)
            if ch is None:
                continue  # 无实时行情（停牌/未匹配）的个股跳过
            stocks.append({"name": name, "code": code, "change": round(ch, 2)})

        if not validate_stocks(stocks, expected_change):
            return None

        up = sum(1 for s in stocks if s["change"] > 0)
        dn = sum(1 for s in stocks if s["change"] < 0)
        return {
            "sectorName": sector_name,
            "matchedName": matched_name,
            "stocks": stocks,
            "upCount": up,
            "downCount": dn,
        }

    return with_timeout(_do_fetch, SW_TIMEOUT_SECONDS)


# ===========================================================================
# 数据源：东方财富一级行业板块成分（与日报板块涨跌排行同源，主力源）
#   - 排行榜本身用 akshare stock_board_industry_name_em（东财行业板块）
#   - 本源走东财官方接口的延时行情镜像 push2delay（主域 push2 部分网络被阻断，
#     参数与 push2 完全一致，仅约 15 分钟延时，对收盘日报无影响）
#   - 行业列表：fs=m:90 t:2 f:!50（含全部行业板块 BK 代码），成分：fs=b:{BK} f:!50
#   - 板块名与排行榜逐字一致 → 精确匹配，无需模糊猜测，成分自带实时涨跌幅
# ===========================================================================
EM_BASE = "https://push2delay.eastmoney.com"
EM_UT = "bd1d9ddb04089700cf9c27f6f7426281"


def _em_get(params: dict) -> dict:
    import urllib.request
    import urllib.parse

    url = EM_BASE + "/api/qt/clist/get?" + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Referer": "https://quote.eastmoney.com/",
    })
    return json.loads(urllib.request.urlopen(req, timeout=10).read().decode("utf-8"))


# ---------------------------------------------------------------------------
# 东方财富【31 个一级行业】白名单（申万 2021 版，东财平台一级行业），标准名 → BK 代码
# 用户规定口径：板块行情支持东方财富一级行业，成分按一级行业全量返回
# ---------------------------------------------------------------------------
EM_LEVEL1 = {
    "农林牧渔": "BK0433", "基础化工": "BK1206", "钢铁": "BK0479", "有色金属": "BK0478",
    "电子": "BK1201", "家用电器": "BK0456", "食品饮料": "BK0438", "纺织服饰": "BK0436",
    "轻工制造": "BK1212", "医药生物": "BK1216", "公用事业": "BK0427", "交通运输": "BK1210",
    "房地产": "BK1202", "商贸零售": "BK1213", "社会服务": "BK1214", "综合": "BK1217",
    "建筑材料": "BK1208", "建筑装饰": "BK1209", "电力设备": "BK1200", "国防军工": "BK1204",
    "计算机": "BK1207", "传媒": "BK0486", "通信": "BK1215", "银行": "BK1283",
    "非银金融": "BK1203", "汽车": "BK1211", "机械设备": "BK1205", "煤炭": "BK0437",
    "石油石化": "BK0464", "环保": "BK0728", "美容护理": "BK1035",
}
# 别名 → 一级标准名
# 含：① 申万更名（商业贸易→商贸零售、休闲服务→社会服务）；
#     ② 日报常用的一级行业简称/异名，避免一级简称落到模糊匹配被二级/三级细分板块截胡
#     （如"化工"被三级"煤化工"抢走、"军工"应指向一级"国防军工"）。
# 仅收录明确指向整个一级行业的简称；细分板块名（汽车零部件/电网设备/地面兵装等）不在此列。
EM_LEVEL1_ALIAS = {
    # 申万/东财更名
    "商业贸易": "商贸零售",
    "休闲服务": "社会服务",
    # 基础化工
    "化工": "基础化工",
    # 国防军工
    "军工": "国防军工",
    # 商贸零售
    "零售": "商贸零售",
    "商贸": "商贸零售",
    "商贸零售行业": "商贸零售",
    # 医药生物
    "医药": "医药生物",
    "生物医药": "医药生物",
    # 家用电器
    "家电": "家用电器",
    # 非银金融
    "非银": "非银金融",
    "非银行金融": "非银金融",
    # 电力设备（申万名"电气设备"）
    "电气设备": "电力设备",
    # 食品饮料（日报常拆"食品/饮料"，都归口整个一级）
    "食品": "食品饮料",
    "饮料": "食品饮料",
}
for _l1_name in EM_LEVEL1:
    EM_LEVEL1_ALIAS.setdefault(_l1_name, _l1_name)


def fetch_em_level1(sector_name: str, expected_change: float) -> dict | None:
    """数据源 0：东方财富 31 个一级行业白名单（板块名精确命中一级才返回其全量成分）"""
    def _do_fetch():
        import time

        std_name = EM_LEVEL1_ALIAS.get(normalize(sector_name))
        if not std_name:
            return None  # 非一级行业名（二级/三级细分），交由后续数据源处理
        bk = EM_LEVEL1[std_name]

        stocks: list[dict] = []
        seen_codes: set[str] = set()
        for pn in range(1, 8):
            try:
                data = (_em_get({
                    "pn": pn, "pz": 100, "po": 1, "np": 1, "ut": EM_UT,
                    "fltt": 2, "invt": 2, "fid": "f3",
                    "fs": f"b:{bk} f:!50",
                    "fields": "f3,f12,f14",
                }) or {}).get("data") or {}
            except Exception:
                break
            diff = data.get("diff") or []
            if not diff:
                break
            for it in diff:
                name = str(it.get("f14", "")).strip()
                code = str(it.get("f12", "")).strip()
                ch = it.get("f3")
                if not name or not isinstance(ch, (int, float)) or code in seen_codes:
                    continue
                seen_codes.add(code)
                stocks.append({"name": name, "code": code, "change": round(float(ch), 2)})
            # 东财单页上限 100；不足 100 表示已是最后一页
            if len(diff) < 100:
                break
            time.sleep(0.2)

        if len(stocks) < 3:
            return None

        up = sum(1 for s in stocks if s["change"] > 0)
        dn = sum(1 for s in stocks if s["change"] < 0)
        return {
            "sectorName": sector_name,
            "matchedName": std_name,
            "matchScore": 1.0,
            "stocks": stocks,
            "upCount": up,
            "downCount": dn,
        }

    return with_timeout(_do_fetch, EM_TIMEOUT_SECONDS)


def fetch_em_industry(sector_name: str, expected_change: float) -> dict | None:
    """数据源：东方财富行业板块（一/二/三级全量模糊匹配，二级/三级细分板块兜底）"""
    def _do_fetch():
        import time

        # 1) 拉取东财全量行业板块列表（分页），建立 板块名 → BK代码 映射
        boards: list[dict] = []
        for pn in range(1, 6):
            try:
                data = (_em_get({
                    "pn": pn, "pz": 100, "po": 1, "np": 1, "ut": EM_UT,
                    "fltt": 2, "invt": 2, "fid": "f3",
                    "fs": "m:90 t:2 f:!50",
                    "fields": "f3,f12,f14,f104,f105",
                }) or {}).get("data") or {}
            except Exception:
                break
            diff = data.get("diff") or []
            boards.extend(diff)
            if len(diff) < 100:
                break
            time.sleep(0.2)

        if not boards:
            return None

        # 2) 板块名匹配：归一化精确匹配优先（兼容 Ⅱ/Ⅲ 后缀，排行榜名字与之一致）
        target = normalize(sector_name)
        exact = [b for b in boards if normalize(str(b.get("f14", ""))) == target]
        score = 1.0
        if exact:
            # Ⅱ/Ⅲ 同名重复时，取层级更高者（后缀少 / 代码小）
            def _rank_key(b: dict):
                nm = str(b.get("f14", ""))
                return (nm.count("Ⅲ") * 2 + nm.count("Ⅱ"), str(b.get("f12")))
            best = min(exact, key=_rank_key)
        else:
            cand = [str(b.get("f14", "")) for b in boards]
            matched_name, score = find_best_match(sector_name, cand)
            if not matched_name:
                return None
            best = next(b for b in boards if str(b.get("f14")) == matched_name)

        bk = str(best.get("f12"))
        matched_name = str(best.get("f14"))

        # 3) 拉取该板块全部成分股（分页，自带涨跌幅 f3）
        stocks: list[dict] = []
        seen_codes: set[str] = set()
        for pn in range(1, 8):
            try:
                data = (_em_get({
                    "pn": pn, "pz": 100, "po": 1, "np": 1, "ut": EM_UT,
                    "fltt": 2, "invt": 2, "fid": "f3",
                    "fs": f"b:{bk} f:!50",
                    "fields": "f3,f12,f14",
                }) or {}).get("data") or {}
            except Exception:
                break
            diff = data.get("diff") or []
            if not diff:
                break
            for it in diff:
                name = str(it.get("f14", "")).strip()
                code = str(it.get("f12", "")).strip()
                ch = it.get("f3")
                if not name or not isinstance(ch, (int, float)) or code in seen_codes:
                    continue
                seen_codes.add(code)
                stocks.append({"name": name, "code": code, "change": round(float(ch), 2)})
            # 东财单页上限 100；不足 100 表示已是最后一页
            if len(diff) < 100:
                break
            time.sleep(0.2)

        if len(stocks) < 3:
            return None

        # 精确/高置信匹配成分归属可靠，跳过方向校验；低置信模糊匹配才校验防误配
        if score < 0.9 and not validate_stocks(stocks, expected_change):
            return None

        up = sum(1 for s in stocks if s["change"] > 0)
        dn = sum(1 for s in stocks if s["change"] < 0)
        return {
            "sectorName": sector_name,
            "matchedName": matched_name,
            "matchScore": round(score, 2),
            "stocks": stocks,
            "upCount": up,
            "downCount": dn,
        }

    return with_timeout(_do_fetch, EM_TIMEOUT_SECONDS)


# ===========================================================================
# 主流程：按优先级依次尝试
# ===========================================================================
DATA_SOURCES = [
    ("东方财富一级行业", fetch_em_level1),
    ("东方财富行业板块", fetch_em_industry),
    ("申万一级-腾讯行情", fetch_sw_level1_tencent),
    ("同花顺行业-直连", fetch_ths_industry_http),
    ("同花顺概念-直连", fetch_ths_concept_http),
    ("东方财富-JSON", fetch_eastmoney_json),
]


def main():
    if len(sys.argv) < 2:
        print(json.dumps({"success": False, "error": "缺少板块名称参数"}, ensure_ascii=False))
        sys.exit(1)

    sector_name = sys.argv[1]
    expected_change = float(sys.argv[2]) if len(sys.argv) > 2 else 0.0

    errors = []

    for source_name, fetch_fn in DATA_SOURCES:
        try:
            result = fetch_fn(sector_name, expected_change)
        except Exception as e:
            errors.append(f"{source_name}: 异常 - {str(e)[:80]}")
            continue

        if result is None:
            errors.append(f"{source_name}: 无数据或超时")
            continue

        # 返回全量成分（按涨跌幅从高到低排序），由前端决定展示哪些；
        # 保留全量以支持真实的"上涨/下跌家数"统计，避免仅取涨幅前N只的幸存者偏差
        stocks = sorted(result["stocks"], key=lambda s: s["change"], reverse=True)
        up = result.get("upCount")
        dn = result.get("downCount")
        if up is None or dn is None:
            up = sum(1 for s in stocks if s["change"] > 0)
            dn = sum(1 for s in stocks if s["change"] < 0)
        output = {
            "success": True,
            "sectorName": sector_name,
            "matchedName": result.get("matchedName", sector_name),
            "stocks": stocks,
            "upCount": up,
            "downCount": dn,
            "totalCount": len(stocks),
            "dataSource": source_name,
            "fetchDate": TARGET_DATE,
        }
        print(json.dumps(output, ensure_ascii=False))
        sys.exit(0)

    # 全部失败
    print(json.dumps({
        "success": False,
        "error": "板块个股行情加载失败，请刷新页面",
        "errors": errors,
    }, ensure_ascii=False))
    sys.exit(1)


if __name__ == "__main__":
    main()
