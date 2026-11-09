import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

/**
 * 板块成份股实时行情 API — 多源免费行情接口轮询
 * GET /api/sector-cons?sector=板块名称&sectorChange=预期涨跌幅
 *
 * ⚠️ 硬性执行规范：
 * 1. 数据源优先级（主力为东方财富一级行业板块，与日报板块涨跌排行完全同源）：
 *    东方财富一级行业成分(push2延时行情镜像) → 申万全量+腾讯 → 同花顺行业 → 同花顺概念 → 东财JSON兜底
 *    全部纯 HTTP 不依赖 akshare；东财板块名与排行榜逐字一致→精确匹配，成分自带实时涨跌幅，
 *    返回全量成分（避免只取涨幅榜前N只的幸存者偏差）。
 * 2. 单源超时即切换下一个数据源
 * 3. 板块名称精确匹配优先，模糊匹配兜底
 * 4. 高置信匹配跳过方向校验，低置信模糊匹配才做方向校验防误匹配
 * 5. 返回全量成分股 + 上涨/下跌家数，前端按领涨/领跌平衡展示
 * 6. 全部数据源失败 → 返回标准错误提示，绝不使用历史缓存
 * 6. 底部标注：数据源：多源免费行情接口，已禁用历史缓存
 */

// 板块名称映射（用户输入 → 各数据源标准名称）
const SECTOR_NAME_MAP: Record<string, string> = {
  // 行业板块
  "贵金属": "贵金属",
  "煤炭": "煤炭",
  "煤炭开采": "煤炭开采",
  "电力": "电力",
  "钢铁": "钢铁",
  "有色金属": "有色金属",
  "基础化工": "基础化工",
  "建筑材料": "建筑材料",
  "建筑装饰": "建筑装饰",
  "房地产": "房地产",
  "房地产开发": "房地产开发",
  "房地产开发Ⅱ": "房地产开发",
  "交通运输": "交通运输",
  "汽车": "汽车",
  "汽车零部件": "汽车零部件",
  "机械设备": "机械设备",
  "国防军工": "国防军工",
  "电子": "电子",
  "计算机": "计算机",
  "传媒": "传媒",
  "通信": "通信",
  "通信设备": "通信设备",
  "通信设备Ⅱ": "通信设备",
  "食品饮料": "食品饮料",
  "家用电器": "家用电器",
  "纺织服饰": "纺织服饰",
  "轻工制造": "轻工制造",
  "商贸零售": "商贸零售",
  "社会服务": "社会服务",
  "医药生物": "医药生物",
  "医疗服务": "医疗服务",
  "医疗服务Ⅱ": "医疗服务",
  "生物制品": "生物制品",
  "生物制品Ⅱ": "生物制品",
  "中药": "中药",
  "中药Ⅱ": "中药",
  "医疗器械": "医疗器械",
  "公用事业": "公用事业",
  "环保": "环保",
  "石油石化": "石油石化",
  "银行": "银行",
  "国有大型银行": "银行",
  "国有大型银行Ⅱ": "银行",
  "非银金融": "非银金融",
  "综合": "综合",
  "综合Ⅱ": "综合",
  "美容护理": "美容护理",
  "农林牧渔": "农林牧渔",
  "电子化学品": "电子化学品",
  "非金属材料Ⅱ": "非金属材料",
  "非金属材料": "非金属材料",
  "装修装饰Ⅱ": "装修装饰",
  "房地产服务": "房地产服务",
  // 概念板块
  "CRO": "CRO",
  "创新药": "创新药",
  "半导体": "半导体",
  "芯片": "芯片",
  "光伏": "光伏",
  "光伏设备": "光伏设备",
  "新能源车": "新能源汽车",
  "人工智能": "人工智能",
  "AI": "人工智能",
  "机器人": "机器人",
  "PCB": "PCB",
  "消费电子": "消费电子",
  "5G": "5G",
  "华为": "华为",
  "特斯拉": "特斯拉",
  "昨日连板": "昨日连板",
  "光芯片": "光芯片",
  "光通信": "光通信",
  "青蒿素": "青蒿素",
  "超级真菌": "超级真菌",
  "肿瘤治疗": "肿瘤治疗",
  "千金藤素": "千金藤素",
  "黄酒概念": "黄酒",
  "房屋租赁": "房屋租赁",
  "锗镓概念": "锗镓",
};

function normalizeSectorName(name: string): string {
  return SECTOR_NAME_MAP[name] || name.replace("Ⅱ", "");
}

const ERROR_MESSAGE = "板块个股行情加载失败，请刷新页面";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const sector = searchParams.get("sector");
  const sectorChangeStr = searchParams.get("sectorChange");

  if (!sector) {
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGE },
      { status: 400 }
    );
  }

  // 预期涨跌幅（从主面板板块排行传入，用于校验数据源准确性）
  const expectedChange = sectorChangeStr ? parseFloat(sectorChangeStr) : 0;

  try {
    const normalizedSector = normalizeSectorName(sector);
    console.log(
      `[sector-cons][多源] 拉取板块：'${sector}' → '${normalizedSector}'，预期涨幅：${expectedChange}%`
    );

    // 优先调用多源脚本（5级数据源 + 强制校验）
    const multiScript = path.join(
      process.cwd(),
      "scripts",
      "fetch_sector_cons_multi.py"
    );
    const multiCmd = `python3 "${multiScript}" "${normalizedSector}" "${expectedChange}"`;

    let lastError: any = null;

    try {
      console.log(`[sector-cons][多源] 调用多源行情脚本...`);
      const output = execSync(multiCmd, {
        encoding: "utf-8",
        timeout: 30000, // 首个数据源（东财一级）成功即返回；含分页拉全量成分
        env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      });

      // 提取 JSON
      const lines = output.trim().split("\n");
      const jsonStart = lines.findIndex((line) => line.trim().startsWith("{"));
      if (jsonStart === -1) {
        throw new Error("Python 多源脚本输出格式异常");
      }

      const jsonStr = lines.slice(jsonStart).join("\n");
      const result = JSON.parse(jsonStr);

      if (!result.success || !result.stocks || result.stocks.length === 0) {
        lastError = result.error || result.errors?.[0] || "多源脚本无有效数据";
        console.log(`[sector-cons][多源] 失败: ${lastError}`);
        throw new Error(lastError);
      }

      // 按涨跌幅从高到低排序（A股红涨绿跌惯例）
      const sortedStocks = [...result.stocks].sort(
        (a: any, b: any) => b.change - a.change
      );

      console.log(
        `[sector-cons][多源] 成功！数据源: ${result.dataSource || "未知"}，个股数: ${sortedStocks.length}`
      );
      const upCount =
        typeof result.upCount === "number"
          ? result.upCount
          : sortedStocks.filter((s: any) => s.change > 0).length;
      const downCount =
        typeof result.downCount === "number"
          ? result.downCount
          : sortedStocks.filter((s: any) => s.change < 0).length;

      return NextResponse.json({
        success: true,
        data: {
          sectorName: sector,
          matchedName: result.matchedName || sector,
          changePercent: result.changePercent ?? expectedChange,
          stocks: sortedStocks,
          upCount,
          downCount,
          totalCount: typeof result.totalCount === "number" ? result.totalCount : sortedStocks.length,
          dataSource: result.dataSource || "未知",
        },
        cached: false,
        sourceNote: "多源免费行情接口，已禁用历史缓存",
        timestamp: Date.now(),
      });
    } catch (multiError: any) {
      lastError = multiError.message || String(multiError);
      console.error(`[sector-cons][多源] 多源脚本异常:`, multiError.message || multiError);
      // 多源失败后不再回退到缓存，直接返回错误
      // （严格遵守规范：禁止读取本地缓存、历史隔日行情）
    }

    // ⚠️ 所有数据源全部失败：返回标准错误提示，绝不返回旧缓存数据
    console.error(
      `[sector-cons][多源] 全部 3 个数据源失败，拒绝返回缓存数据。最后错误: ${lastError}`
    );
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGE, sourceNote: "多源免费行情接口，已禁用历史缓存" },
      { status: 200 }
    );
  } catch (error) {
    console.error("[sector-cons][多源] 服务异常:", error);
    return NextResponse.json(
      { success: false, error: ERROR_MESSAGE, sourceNote: "多源免费行情接口，已禁用历史缓存" },
      { status: 200 }
    );
  }
}

// 禁用所有缓存，确保每次请求都重新拉取
export const dynamic = "force-dynamic";
export const revalidate = 0;
