import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// 内存缓存
let cache: { data: any; timestamp: number } | null = null;
const CACHE_TTL = 10 * 60 * 1000; // 10分钟缓存

// 财联社电报 API 配置
const CLApi = {
  baseUrl: "https://www.cls.cn/v1/roll/get_roll_list",
  headers: {
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    Referer: "https://www.cls.cn/",
    Accept: "application/json, text/plain, */*",
  },
};

// 签名算法
function signParams(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .reduce((acc: Record<string, string>, key) => {
      acc[key] = params[key];
      return acc;
    }, {});
  const queryString = new URLSearchParams(sorted).toString();
  const sha1 = crypto.createHash("sha1").update(queryString).digest("hex");
  const md5 = crypto.createHash("md5").update(sha1).digest("hex");
  return md5;
}

// 分类映射关键词
const categoryKeywords: Record<string, string[]> = {
  宏观: ["GDP", "CPI", "PPI", "PMI", "经济数据", "央行", "货币政策", "降准", "降息", "LPR", "MLF", "逆回购", "国务院", "国常会"],
  美股: ["美股", "道指", "纳指", "标普", "纳斯达克", "美联储", "美国非农", "美国通胀", "加息", "降息预期"],
  欧洲: ["欧洲央行", "欧元区", "德国", "法国", "英国", "欧央行", "欧洲股市", "伦敦", "法兰克福"],
  亚太: ["日本", "日经", "韩股", "韩国", "澳大利亚", "东盟", "亚太", "东京", "首尔"],
  外汇: ["人民币", "汇率", "美元指数", "外汇", "离岸人民币", "在岸人民币", "美元兑"],
  商品: ["原油", "黄金", "白银", "铜价", "铁矿石", "大宗商品", "期货", "国际油价", "WTI", "布伦特"],
  政策: ["证监会", "发改委", "财政部", "工信部", "国资委", "新规", "政策", "监管", "处罚", "立案"],
  科技: ["AI", "人工智能", "芯片", "半导体", "英伟达", "苹果", "华为", "新能源", "光伏", "机器人"],
  产业: ["房地产", "汽车", "医药", "军工", "白酒", "消费", "半导体", "新能源", "光伏", "储能", "创新药"],
};

function classifyEvent(title: string, content: string): string {
  const text = title + content;
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    if (keywords.some((kw) => text.includes(kw))) return cat;
  }
  return "资讯";
}

function calcAttentionScore(title: string, content: string, isHot: boolean): number {
  let score = 30;
  const text = title + content;
  const textLower = text.toLowerCase();

  // 重磅级关键词（+20分）
  const topKeywords = [
    "重磅", "突发", "刚刚", "紧急", "重要", "官宣", "刚刚宣布",
    "央行", "证监会", "国务院", "美联储", "国常会",
    "利好", "利空", "超预期", "不及预期",
  ];
  for (const kw of topKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      score += 20;
      break; // 最高级只加一次
    }
  }

  // 市场级关键词（每个 +8 分）
  const marketKeywords = [
    "涨停", "暴涨", "大跌", "新高", "新低", "突破", "崩盘", "熔断",
    "降准", "降息", "加息", "LPR", "MLF", "逆回购",
    "GDP", "CPI", "PPI", "PMI", "非农", "通胀",
    "重磅政策", "重大利好", "重大利空",
  ];
  let marketHits = 0;
  for (const kw of marketKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      marketHits++;
      if (marketHits >= 3) break;
    }
  }
  score += marketHits * 8;

  // 行业关键词（每个 +4 分，最多 2 个）
  const industryKeywords = [
    "AI", "人工智能", "芯片", "半导体", "英伟达", "苹果", "华为",
    "新能源", "光伏", "储能", "机器人", "房地产", "汽车", "医药",
    "军工", "白酒", "消费", "创新药", "黄金", "原油",
  ];
  let industryHits = 0;
  for (const kw of industryKeywords) {
    if (textLower.includes(kw.toLowerCase())) {
      industryHits++;
      if (industryHits >= 2) break;
    }
  }
  score += industryHits * 4;

  // 热度标记（+15分）
  if (isHot) score += 15;

  // 标题长度（越长越受关注）
  if (title.length > 20) score += 5;
  if (title.length > 30) score += 3;

  // 内容长度
  if (content.length > 200) score += 5;

  return Math.min(100, Math.max(10, score));
}

// 摘要提取
function getSummary(content: string, maxLen = 60): string {
  // 去除 HTML 标签
  const clean = content.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();
  if (clean.length <= maxLen) return clean;
  return clean.slice(0, maxLen) + "...";
}

// 拉取财联社电报数据
async function fetchClsTelegraph(limit = 40): Promise<any[]> {
  const allItems: any[] = [];
  let lastTime = Math.floor(Date.now() / 1000);
  const maxPages = 6;

  for (let page = 0; page < maxPages; page++) {
    const params: Record<string, string> = {
      app: "CailianpressWeb",
      category: "",
      last_time: String(lastTime),
      os: "web",
      refresh_type: page === 0 ? "2" : "1",
      rn: "30",
      sv: "8.4.6",
    };
    params.sign = signParams(params);

    const url = `${CLApi.baseUrl}?${new URLSearchParams(params).toString()}`;

    try {
      const resp = await fetch(url, {
        headers: CLApi.headers,
        signal: AbortSignal.timeout(10000),
      });
      if (!resp.ok) break;
      const data = await resp.json();
      const rollData = data?.data?.roll_data || [];
      if (!rollData.length) break;

      for (const item of rollData) {
        const title = (item.title || item.brief_title || "").trim();
        const content = (item.content || item.brief || "").trim();
        if (!title) continue;

        // 过滤广告
        const adKws = ["扫码", "关注公众号", "点击领取", "免费领", "点击报名", "立即下载", "会员专属", "付费专栏"];
        if (adKws.some((kw) => title.includes(kw) || content.includes(kw))) continue;

        const ctime = item.ctime || 0;
        const dt = ctime ? new Date(ctime * 1000) : new Date();
        const pubDate = dt.toISOString().slice(0, 10);
        const pubTime = dt.toTimeString().slice(0, 5);

        allItems.push({
          id: item.id || String(ctime + Math.random()),
          title,
          content,
          summary: getSummary(content, 60),
          ctime,
          pub_date: pubDate,
          pub_time: pubTime,
          category: classifyEvent(title, content),
          attention: calcAttentionScore(title, content, item.is_hot || item.is_red || false),
          source_url: item.id ? `https://www.cls.cn/detail/${item.id}` : `https://www.cls.cn/telegraph`,
          is_hot: item.is_hot || item.is_red || false,
        });
      }

      // 更新翻页游标
      lastTime = rollData[rollData.length - 1].ctime || lastTime;

      if (allItems.length >= limit) break;
    } catch (e) {
      break;
    }
  }

  return allItems;
}

// 去重
function dedupeEvents(events: any[]): any[] {
  const seen = new Set<string>();
  return events.filter((event) => {
    const key = event.title.slice(0, 15);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const limit = parseInt(searchParams.get("limit") || "8", 10);
  const force = searchParams.get("force") === "1";

  // 1. 检查缓存
  if (!force && cache && Date.now() - cache.timestamp < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    // 拉取财联社电报（实时）
    const rawEvents = await fetchClsTelegraph(40);

    if (!rawEvents.length) {
      const emptyResult = {
        success: false,
        error: "no data from cls api",
        source: "cls-api",
        data: [],
        total: 0,
        deduped_count: 0,
      };
      cache = { data: emptyResult, timestamp: Date.now() };
      return NextResponse.json(emptyResult);
    }

    // 去重
    const deduped = dedupeEvents(rawEvents);

    // 按关注度排序
    deduped.sort((a, b) => b.attention - a.attention);

    // 取前 N 条
    const hotspots = deduped.slice(0, limit).map((item) => ({
      title: item.title,
      summary: item.summary,
      content: item.content,
      category: item.category,
      attention: item.attention,
      pub_date: item.pub_date,
      pub_time: item.pub_time,
      source_url: item.source_url,
      source: "财联社-电报API",
    }));

    const result = {
      success: true,
      data: hotspots,
      source: "cls-api",
      total: rawEvents.length,
      deduped_count: deduped.length,
    };

    cache = { data: result, timestamp: Date.now() };
    return NextResponse.json(result);
  } catch (error: any) {
    console.error(`[cls-hotspots] 执行失败: ${error.message}`);
    const emptyResult = {
      success: false,
      error: error.message,
      source: "none",
      data: [],
    };
    cache = { data: emptyResult, timestamp: Date.now() };
    return NextResponse.json(emptyResult, { status: 200 });
  }
}
