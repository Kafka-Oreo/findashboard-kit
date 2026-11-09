import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ===== 类型定义 =====
interface TelegraphItem {
  id: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  attention: number;
  pub_date: string;
  pub_time: string;
  source_url: string;
  source: string;
  is_external: boolean;
}

interface TelegraphResult {
  success: boolean;
  date: string;
  total: number;
  external: { count: number; data: TelegraphItem[] };
  internal: { count: number; data: TelegraphItem[] };
  source: string;
  fetchedAt: string;
  complete: boolean;
  cached?: boolean;
  degraded?: boolean;
  error?: string;
}

interface FetchOutcome {
  items: TelegraphItem[];
  complete: boolean;
}

interface CacheEntry {
  items: TelegraphItem[];
  complete: boolean;
  fetchedAt: string;
  time: number;
}

// ===== 工具函数 =====
function getBeijingDate(ts: number): string {
  const d = new Date(ts * 1000 + 8 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

function getBeijingTime(ts: number): string {
  const d = new Date(ts * 1000 + 8 * 3600 * 1000);
  return d.toISOString().slice(11, 16);
}

function getTodayBeijing(): string {
  return getBeijingDate(Math.floor(Date.now() / 1000));
}

function signParams(params: Record<string, string>): string {
  const keys = Object.keys(params).sort();
  const qs = keys.map(k => `${k}=${encodeURIComponent(params[k])}`).join("&");
  const sha1 = crypto.createHash("sha1").update(qs).digest("hex");
  return crypto.createHash("md5").update(sha1).digest("hex");
}

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
  Referer: "https://www.cls.cn/",
};

// ===== 关键词分级：海外 vs 国内（加权计分）=====
// 权重说明：3=强特征（明确指向）  2=中特征（较明确）  1=弱特征（可能有歧义）

const overseasKeywords: { word: string; weight: number }[] = [
  // —— 强特征（3分）：明确海外央行 / 机构 / 股指 / 人物
  { word: "美联储", weight: 3 }, { word: "鲍威尔", weight: 3 },
  { word: "FOMC", weight: 3 }, { word: "美国非农", weight: 3 },
  { word: "美国CPI", weight: 3 }, { word: "美国PCE", weight: 3 },
  { word: "美债收益率", weight: 3 }, { word: "美国国债", weight: 3 },
  { word: "欧央行", weight: 3 }, { word: "欧洲央行", weight: 3 },
  { word: "日本央行", weight: 3 }, { word: "日银", weight: 3 },
  { word: "英国央行", weight: 3 }, { word: "澳洲联储", weight: 3 },
  { word: "新西兰联储", weight: 3 }, { word: "加拿大央行", weight: 3 },
  { word: "道琼斯", weight: 3 }, { word: "纳斯达克", weight: 3 },
  { word: "标普500", weight: 3 }, { word: "道指", weight: 3 },
  { word: "纳指", weight: 3 }, { word: "美股", weight: 3 },
  { word: "中概股", weight: 3 }, { word: "金龙指数", weight: 3 },
  { word: "恒生指数", weight: 3 }, { word: "恒生科技", weight: 3 },
  { word: "日经指数", weight: 3 }, { word: "日经225", weight: 3 },
  { word: "德国DAX", weight: 3 }, { word: "法国CAC", weight: 3 },
  { word: "英国富时", weight: 3 }, { word: "COMEX黄金", weight: 3 },
  { word: "WTI原油", weight: 3 }, { word: "布伦特原油", weight: 3 },
  { word: "LME铜", weight: 3 }, { word: "LME铝", weight: 3 },
  { word: "美元指数", weight: 3 }, { word: "IMF", weight: 3 },
  { word: "世界银行", weight: 3 }, { word: "OPEC", weight: 3 },
  { word: "欧佩克", weight: 3 }, { word: "北约", weight: 3 },
  { word: "G7", weight: 3 }, { word: "G20", weight: 3 },

  // —— 中特征（2分）：明确国家/地区 / 国际组织 / 海外知名公司全名
  { word: "美国", weight: 2 }, { word: "俄罗斯", weight: 2 }, { word: "乌克兰", weight: 2 },
  { word: "以色列", weight: 2 }, { word: "巴勒斯坦", weight: 2 }, { word: "伊朗", weight: 2 },
  { word: "沙特", weight: 2 }, { word: "土耳其", weight: 2 }, { word: "越南", weight: 2 },
  { word: "印度", weight: 2 }, { word: "日本", weight: 2 }, { word: "韩国", weight: 2 },
  { word: "德国", weight: 2 }, { word: "法国", weight: 2 }, { word: "英国", weight: 2 },
  { word: "欧盟", weight: 2 }, { word: "欧元区", weight: 2 },
  { word: "澳大利亚", weight: 2 }, { word: "加拿大", weight: 2 },
  { word: "巴西", weight: 2 }, { word: "阿根廷", weight: 2 }, { word: "墨西哥", weight: 2 },
  { word: "拜登", weight: 2 }, { word: "特朗普", weight: 2 }, { word: "普京", weight: 2 },
  { word: "泽连斯基", weight: 2 }, { word: "耶伦", weight: 2 },
  { word: "标普", weight: 2 }, { word: "欧股", weight: 2 }, { word: "日股", weight: 2 },
  { word: "韩股", weight: 2 }, { word: "恒指", weight: 2 }, { word: "港股", weight: 2 },
  { word: "国际油价", weight: 2 }, { word: "国际金价", weight: 2 }, { word: "国际铜价", weight: 2 },
  { word: "美债", weight: 2 }, { word: "欧元", weight: 2 }, { word: "日元", weight: 2 },
  { word: "英镑", weight: 2 }, { word: "布油", weight: 2 },
  { word: "联合国", weight: 2 }, { word: "WTO", weight: 2 },
  { word: "OpenAI", weight: 2 },

  // —— 弱特征（1分）：海外公司简称（可能有中国业务，需结合整体判断）
  { word: "苹果", weight: 1 }, { word: "特斯拉", weight: 1 }, { word: "英伟达", weight: 1 },
  { word: "微软", weight: 1 }, { word: "谷歌", weight: 1 }, { word: "亚马逊", weight: 1 },
  { word: "Meta", weight: 1 }, { word: "台积电", weight: 1 },
  { word: "三星", weight: 1 }, { word: "丰田", weight: 1 },
  { word: "巴菲特", weight: 1 }, { word: "马斯克", weight: 1 },
];

const domesticKeywords: { word: string; weight: number }[] = [
  // —— 强特征（3分）：明确国内金融监管机构 / A股专属术语
  { word: "证监会", weight: 3 }, { word: "金融监管总局", weight: 3 },
  { word: "国务院", weight: 3 }, { word: "财政部", weight: 3 }, { word: "发改委", weight: 3 },
  { word: "银保监会", weight: 3 }, { word: "上交所", weight: 3 }, { word: "深交所", weight: 3 },
  { word: "北交所", weight: 3 }, { word: "中金所", weight: 3 },
  { word: "上海证券交易所", weight: 3 }, { word: "深圳证券交易所", weight: 3 },
  { word: "北向资金", weight: 3 }, { word: "南向资金", weight: 3 },
  { word: "融资融券", weight: 3 }, { word: "两融", weight: 3 },
  { word: "沪指", weight: 3 }, { word: "上证指数", weight: 3 },
  { word: "深成指", weight: 3 }, { word: "创业板指", weight: 3 },
  { word: "科创板", weight: 3 }, { word: "科创50", weight: 3 },
  { word: "沪深300", weight: 3 }, { word: "中证500", weight: 3 }, { word: "中证1000", weight: 3 },
  { word: "北证50", weight: 3 },
  { word: "A股", weight: 3 }, { word: "a股", weight: 3 },
  { word: "社融", weight: 3 }, { word: "M2", weight: 3 }, { word: "LPR", weight: 3 },
  { word: "MLF", weight: 3 }, { word: "逆回购", weight: 3 },
  { word: "降准", weight: 3 }, { word: "降息", weight: 3 },
  { word: "国家统计局", weight: 3 }, { word: "海关总署", weight: 3 },
  { word: "工信部", weight: 3 }, { word: "商务部", weight: 3 },
  { word: "国企改革", weight: 3 }, { word: "国资", weight: 3 },
  { word: "公募基金", weight: 3 }, { word: "私募基金", weight: 3 },

  // —— 中特征（2分）：国内宏观 / 政策 / 市场通用词
  { word: "央行", weight: 2 }, { word: "两市", weight: 2 }, { word: "大盘", weight: 2 },
  { word: "创业板", weight: 2 }, { word: "大盘指数", weight: 2 },
  { word: "PMI", weight: 2 }, { word: "CPI", weight: 2 }, { word: "PPI", weight: 2 },
  { word: "GDP", weight: 2 }, { word: "财政政策", weight: 2 }, { word: "货币政策", weight: 2 },
  { word: "省", weight: 2 }, { word: "市", weight: 2 },
  { word: "国防部", weight: 2 }, { word: "外交部", weight: 2 },
  { word: "解放军", weight: 2 }, { word: "中国人民解放军", weight: 2 },
  { word: "上海期货交易所", weight: 2 }, { word: "大连商品交易所", weight: 2 },
  { word: "郑州商品交易所", weight: 2 },

  // —— 弱特征（1分）：省份/城市名（量大但可能出现在国际新闻中）
  { word: "江苏", weight: 1 }, { word: "浙江", weight: 1 }, { word: "广东", weight: 1 },
  { word: "上海", weight: 1 }, { word: "北京", weight: 1 }, { word: "深圳", weight: 1 },
  { word: "广州", weight: 1 }, { word: "杭州", weight: 1 }, { word: "南京", weight: 1 },
  { word: "苏州", weight: 1 }, { word: "成都", weight: 1 }, { word: "武汉", weight: 1 },
  { word: "西安", weight: 1 }, { word: "重庆", weight: 1 }, { word: "天津", weight: 1 },
  { word: "山东", weight: 1 }, { word: "河南", weight: 1 }, { word: "湖北", weight: 1 },
  { word: "湖南", weight: 1 }, { word: "福建", weight: 1 }, { word: "安徽", weight: 1 },
  { word: "江西", weight: 1 }, { word: "辽宁", weight: 1 }, { word: "吉林", weight: 1 },
  { word: "黑龙江", weight: 1 }, { word: "河北", weight: 1 }, { word: "山西", weight: 1 },
  { word: "陕西", weight: 1 }, { word: "四川", weight: 1 }, { word: "云南", weight: 1 },
  { word: "贵州", weight: 1 }, { word: "广西", weight: 1 }, { word: "甘肃", weight: 1 },
  { word: "青海", weight: 1 }, { word: "宁夏", weight: 1 }, { word: "新疆", weight: 1 },
  { word: "西藏", weight: 1 }, { word: "内蒙古", weight: 1 }, { word: "海南", weight: 1 },
  { word: "宁波", weight: 1 }, { word: "青岛", weight: 1 }, { word: "厦门", weight: 1 },
  { word: "大连", weight: 1 },
  { word: "国内", weight: 1 }, { word: "在华", weight: 1 }, { word: "中国", weight: 1 },
  { word: "中方", weight: 1 }, { word: "我国", weight: 1 },
];

/**
 * 加权计分制，判断新闻归属海外市场还是国内市场
 * 规则：
 * 1. 分别统计海外词分数 overseasScore 和国内词分数 domesticScore
 * 2. overseasScore > domesticScore → 海外
 * 3. domesticScore >= overseasScore → 国内（打平时默认归国内）
 */
function classifyMarket(title: string, content: string): boolean {
  const text = title + " " + content;
  let overseasScore = 0;
  let domesticScore = 0;

  for (const { word, weight } of overseasKeywords) {
    if (text.includes(word)) overseasScore += weight;
  }
  for (const { word, weight } of domesticKeywords) {
    if (text.includes(word)) domesticScore += weight;
  }

  // 海外分严格大于国内分，才算海外
  return overseasScore > domesticScore;
}

// ===== 主函数：拉取指定日期的财联社电报 =====
async function fetchTelegraph(targetDate: string): Promise<FetchOutcome> {
  const items: TelegraphItem[] = [];

  // 从次日0点（北京时间）开始往前翻，确保拿到完整一天
  const [y, m, d] = targetDate.split("-").map(Number);
  if (!y || !m || !d) {
    return { items, complete: true };
  }
  const nextDayUTC = new Date(Date.UTC(y, m - 1, d + 1));
  const lastTime = Math.floor((nextDayUTC.getTime() - 8 * 3600 * 1000) / 1000);

  let cursor = lastTime;
  const maxPages = 20;
  let complete = true;
  let foundTarget = false;
  let pagesAfterTarget = 0;

  for (let i = 0; i < maxPages; i++) {
    const params: Record<string, string> = {
      app: "CailianpressWeb",
      category: "",
      last_time: String(cursor),
      os: "web",
      refresh_type: "1",
      rn: "30",
      sv: "8.4.6",
    };
    params.sign = signParams(params);

    const url = `https://www.cls.cn/v1/roll/get_roll_list?${
      Object.keys(params).sort().map(k => `${k}=${encodeURIComponent(params[k])}`).join("&")
    }`;

    let list: any[] = [];
    try {
      const resp = await fetch(url, {
        headers: HEADERS,
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!resp.ok) {
        complete = false;
        break;
      }
      const data = await resp.json();
      list = data?.data?.roll_data || [];
      if (list.length === 0) {
        // 上游已无更多数据
        break;
      }
    } catch {
      complete = false;
      break;
    }

    let pageHasTarget = false;
    let reachedEarlierDate = false;

    for (const item of list) {
      const ctime = item.ctime || 0;
      const dateStr = getBeijingDate(ctime);

      if (dateStr < targetDate) {
        // 翻到更早的日期了，说明当天已完整覆盖
        reachedEarlierDate = true;
        break;
      }
      if (dateStr !== targetDate) {
        continue;
      }

      pageHasTarget = true;
      const title = (item.title || item.brief_title || "").trim();
      const content = (item.content || item.brief || "").trim();
      if (!title) continue;

      // 过滤广告
      if (/扫码|关注公众号|点击领取|免费领|点击报名|立即下载|会员专属|付费专栏/.test(title + content)) {
        continue;
      }

      const isExt = classifyMarket(title, content);
      const itemId = item.id || "";

      items.push({
        id: itemId || title,
        title,
        summary: content.length > 100 ? content.slice(0, 100) + "..." : content,
        content,
        category: guessCategory(title, content),
        attention: calcAttention(title, content),
        pub_date: dateStr,
        pub_time: getBeijingTime(ctime),
        source_url: itemId ? `https://www.cls.cn/detail/${itemId}` : "https://www.cls.cn/telegraph",
        source: "财联社电报",
        is_external: isExt,
      });
    }

    if (reachedEarlierDate) {
      // 正常翻完目标日期 → 完整
      complete = true;
      break;
    }

    if (pageHasTarget) {
      foundTarget = true;
      pagesAfterTarget = 0;
    } else if (foundTarget) {
      // 之前见过目标日期，这一页没有 → 可能刚翻完，也可能中间夹了次日数据
      pagesAfterTarget += 1;
      if (pagesAfterTarget >= 3) {
        complete = true;
        break;
      }
    } else if (i >= 2) {
      // 前 3 页都没见到目标日期，且还没翻到更早日期，目标日期距离游标太远
      complete = false;
      break;
    }

    // 更新游标到本页最早一条
    const nextCursor = list[list.length - 1]?.ctime;
    if (!nextCursor || nextCursor >= cursor) {
      // 游标未前移，防止死循环
      complete = false;
      break;
    }
    cursor = nextCursor;
  }

  // 如果跑满 maxPages 仍未显式判定完整，标记 incomplete
  if (items.length > 0 && !complete && pagesAfterTarget < 3) {
    complete = false;
  }

  return { items, complete };
}

function guessCategory(title: string, content: string): string {
  const t = title + content;
  const cats: [string, string[]][] = [
    ["宏观", ["美联储", "央行", "GDP", "CPI", "PPI", "PMI", "社融", "信贷", "降准", "降息", "LPR", "MLF", "货币政策", "财政"]],
    ["政策", ["国务院", "证监会", "财政部", "监管", "政策", "新规", "印发", "通知", "意见", "方案"]],
    ["产业", ["新能源", "光伏", "锂电", "芯片", "半导体", "AI", "人工智能", "汽车", "医药", "地产", "消费", "算力"]],
    ["美股", ["美股", "道指", "纳指", "标普", "纳斯达克", "中概", "苹果", "特斯拉", "英伟达"]],
    ["商品", ["原油", "黄金", "油价", "金价", "贵金属", "有色", "大宗", "OPEC"]],
    ["外汇", ["美元", "汇率", "人民币", "日元", "欧元", "美元指数"]],
  ];
  let best = "资讯";
  let bestN = 0;
  for (const [cat, words] of cats) {
    const n = words.filter(w => t.includes(w)).length;
    if (n > bestN) { bestN = n; best = cat; }
  }
  return best;
}

function calcAttention(title: string, content: string): number {
  let s = 30;
  const t = title + content;
  ["重磅", "突发", "刚刚", "重要", "关键", "影响", "万亿", "重大", "央行", "美联储", "降息", "加息"].forEach(w => {
    if (t.includes(w)) s += 5;
  });
  if (content.length > 200) s += 10;
  return Math.min(s, 100);
}

function emptyResult(dateStr: string, complete = true): TelegraphResult {
  return {
    success: true,
    date: dateStr,
    total: 0,
    external: { count: 0, data: [] },
    internal: { count: 0, data: [] },
    source: "财联社电报",
    fetchedAt: new Date().toISOString(),
    complete,
  };
}

// ===== 三层缓存 =====
const MEM_TTL_MS = 5 * 60 * 1000;       // 内存缓存 5 分钟
const TODAY_FRESH_MS = 10 * 60 * 1000;  // 当天磁盘缓存 10 分钟内视为新鲜

const memCache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<InflightResult>>();

interface InflightResult {
  items: TelegraphItem[];
  complete: boolean;
  fetchedAt: string;
  degraded?: boolean;
}

function diskPath(dateStr: string): string {
  return path.join(process.cwd(), "public", "cls-telegraph", `${dateStr}.json`);
}

async function readDisk(dateStr: string): Promise<TelegraphResult | null> {
  try {
    const raw = await fs.readFile(diskPath(dateStr), "utf-8");
    const parsed = JSON.parse(raw) as TelegraphResult;
    if (!parsed || parsed.date !== dateStr) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeDisk(dateStr: string, result: TelegraphResult): Promise<void> {
  try {
    const fullPath = diskPath(dateStr);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    const tmp = `${fullPath}.tmp-${process.pid}`;
    await fs.writeFile(tmp, JSON.stringify(result, null, 2), "utf-8");
    await fs.rename(tmp, fullPath);
  } catch {
    // 磁盘写入失败不影响响应
  }
}

function getMem(key: string): CacheEntry | null {
  const entry = memCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > MEM_TTL_MS) {
    memCache.delete(key);
    return null;
  }
  return entry;
}

function setMem(key: string, items: TelegraphItem[], complete: boolean, fetchedAt: string): void {
  memCache.set(key, { items, complete, fetchedAt, time: Date.now() });
}

function toResult(
  dateStr: string,
  items: TelegraphItem[],
  complete: boolean,
  limit: number,
  fetchedAt: string,
  extra: Partial<TelegraphResult> = {},
): TelegraphResult {
  const external = items.filter(x => x.is_external);
  const internal = items.filter(x => !x.is_external);
  return {
    success: true,
    date: dateStr,
    total: items.length,
    external: { count: external.length, data: external.slice(0, limit) },
    internal: { count: internal.length, data: internal.slice(0, limit) },
    source: "财联社电报",
    fetchedAt,
    complete,
    ...extra,
  };
}

function shouldUseDisk(disk: TelegraphResult, today: string, dateStr: string): boolean {
  if (dateStr < today) {
    // 历史日期：complete=true 永久使用；complete=false 需要补抓
    return disk.complete === true;
  }
  if (dateStr === today) {
    // 当天：磁盘数据 10 分钟内新鲜
    const fetchedAt = disk.fetchedAt ? Date.parse(disk.fetchedAt) : 0;
    if (!fetchedAt) return false;
    if (disk.complete === false) return false;
    return Date.now() - fetchedAt < TODAY_FRESH_MS;
  }
  return false;
}

async function fetchAndPersist(
  dateStr: string,
): Promise<{ items: TelegraphItem[]; complete: boolean; fetchedAt: string }> {
  const today = getTodayBeijing();

  if (dateStr > today) {
    return { items: [], complete: true, fetchedAt: new Date().toISOString() };
  }

  const outcome = await fetchTelegraph(dateStr);
  const fetchedAt = new Date().toISOString();
  const result = toResult(dateStr, outcome.items, outcome.complete, 200, fetchedAt);

  // 只要抓到了数据就写磁盘（即使 incomplete 也写，下次有机会补全）
  if (outcome.items.length > 0 || outcome.complete) {
    await writeDisk(dateStr, result);
  }

  return { items: outcome.items, complete: outcome.complete, fetchedAt };
}

// ===== GET Handler =====
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date") || getTodayBeijing();
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "30", 10) || 30, 1), 200);
  const force = url.searchParams.get("force") === "1";

  // 标准化日期格式 YYYY-MM-DD
  let dateStr = dateParam.replace(/\//g, "-");
  if (dateStr.length === 8) {
    dateStr = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }

  // 日期格式校验
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return NextResponse.json({
      success: false,
      error: `invalid date format: ${dateParam}`,
      date: dateStr,
    }, { status: 400 });
  }

  const today = getTodayBeijing();
  const cacheKey = dateStr; // 按日期缓存原始数据，limit 在响应时裁剪

  // 未来日期直接返回空
  if (dateStr > today) {
    return NextResponse.json(emptyResult(dateStr, true));
  }

  // 1. 内存缓存（force 时跳过）
  if (!force) {
    const mem = getMem(cacheKey);
    if (mem) {
      return NextResponse.json(
        toResult(dateStr, mem.items, mem.complete, limit, mem.fetchedAt, { cached: true }),
      );
    }
  }

  // 2. 并发去重
  const inflightKey = force ? `${cacheKey}:force` : cacheKey;
  let pending = inflight.get(inflightKey);
  if (!pending) {
    pending = (async (): Promise<{ items: TelegraphItem[]; complete: boolean; fetchedAt: string; degraded?: boolean }> => {
      // 3a. 磁盘缓存
      if (!force) {
        const disk = await readDisk(dateStr);
        if (disk && shouldUseDisk(disk, today, dateStr)) {
          const items = [...disk.external.data, ...disk.internal.data];
          setMem(cacheKey, items, disk.complete, disk.fetchedAt);
          return { items, complete: disk.complete, fetchedAt: disk.fetchedAt };
        }
      }

      // 3b. 调用财联社
      try {
        const r = await fetchAndPersist(dateStr);
        setMem(cacheKey, r.items, r.complete, r.fetchedAt);
        return r;
      } catch (err) {
        // 上游失败 → 降级使用磁盘缓存（无论是否 complete）
        const disk = await readDisk(dateStr);
        if (disk) {
          const items = [...disk.external.data, ...disk.internal.data];
          setMem(cacheKey, items, disk.complete, disk.fetchedAt);
          return { items, complete: disk.complete, fetchedAt: disk.fetchedAt, degraded: true };
        }
        const msg = err instanceof Error ? err.message : "unknown error";
        throw new Error(msg);
      }
    })();
    inflight.set(inflightKey, pending);
  }

  try {
    const r = await pending;
    return NextResponse.json(
      toResult(dateStr, r.items, r.complete, limit, r.fetchedAt, {
        cached: true,
        ...(r.degraded ? { degraded: true } : {}),
      }),
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({
      success: false,
      error: msg,
      date: dateStr,
      total: 0,
      external: { count: 0, data: [] },
      internal: { count: 0, data: [] },
    }, { status: 502 });
  } finally {
    inflight.delete(inflightKey);
  }
}
