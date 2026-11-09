import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

/**
 * 行业研报评级明细 API
 * GET /api/industry-ratings?industry=金融服务&date=2026-08-14
 * 数据来源：东方财富券商研报（akshare）
 * 
 * 匹配策略（行业名称粒度不一致时自动模糊匹配）：
 * 1. 精确匹配
 * 2. 行业包含关系（大行业名包含小行业名）
 * 3. 关键词映射表（如"金融服务"→银行/保险/证券等）
 */

// 大行业 → 细分行业映射表（东方财富行业关注度 与 研报行业字段 间的对应关系）
const INDUSTRY_KEYWORDS: Record<string, string[]> = {
  '金融服务': ['银行', '保险', '证券', '多元金融', '期货', '信托'],
  '银行': ['银行', '股份制银行', '国有大型银行', '城商行', '农商行'],
  '房地产': ['房地产开发', '房地产服务', '园区开发', '物业管理'],
  '房地产开发': ['房地产开发', '房地产服务', '园区开发'],
  '采掘': ['煤炭开采', '石油开采', '油气开采', '贵金属', '小金属', '有色金属', '铁矿石', '锂矿'],
  '煤炭开采': ['煤炭开采', '焦炭', '煤化工'],
  '化工': ['化学原料', '化学制品', '化学纤维', '农化制品', '化肥', '化学制药', '化工合成材料', '化工新材料'],
  '化学制品': ['化学制品', '化学原料', '化学纤维'],
  '食品饮料': ['饮料制造', '白酒', '啤酒', '调味品', '乳业', '食品加工', '休闲食品', '饮料乳品', '黄酒', '食品饮料'],
  '饮料制造': ['白酒', '啤酒', '饮料制造', '乳业', '调味品', '饮料乳品'],
  '机械设备': ['专用设备', '通用设备', '自动化设备', '工程机械', '工业母机', '机器人', '高端装备', '仪器仪表', '金属制品'],
  '交运设备': ['汽车整车', '汽车零部件', '汽车服务', '摩托车', '船舶制造', '航空装备', '航天装备', '地面兵装', '铁路设备'],
  '有色金属': ['有色金属', '贵金属', '小金属', '稀土永磁', '锂矿', '铜', '铝', '铅锌', '黄金'],
  '有色金属冶炼与加工': ['有色金属', '小金属', '贵金属', '铜', '铝', '铅锌'],
  '医药生物': ['医疗服务', '生物制品', '中药', '医疗器械', '医药商业', '化学制药', 'CRO', '创新药', '医美', '生物疫苗'],
  '电力': ['电力', '火电', '水电', '风电', '光伏', '核电', '新能源发电'],
  '公用事业': ['电力', '燃气', '水务', '环保', '热力'],
  '计算机': ['软件开发', 'IT服务', '计算机设备', '云计算', '大数据', '人工智能', '信息安全'],
  '电子': ['半导体', '光学光电子', '消费电子', '元件', '电子化学品', '通信设备', 'PCB'],
  '半导体': ['半导体', '半导体设备', '半导体材料', '集成电路', '芯片'],
  '通信': ['通信设备', '通信服务', '运营商', '光模块', '5G'],
  '传媒': ['传媒', '游戏', '影视院线', '出版', '广告营销', '元宇宙'],
  '汽车': ['汽车整车', '汽车零部件', '汽车服务', '新能源汽车'],
  '家电': ['白色家电', '小家电', '家电', '照明设备'],
  '建筑装饰': ['建筑装饰', '基础建设', '专业工程', '装修装饰', '园林'],
  '建筑材料': ['建筑材料', '水泥', '玻璃玻纤', '瓷砖', '防水材料'],
  '农林牧渔': ['种植业', '养殖业', '渔业', '畜禽养殖', '农业', '林业', '饲料', '动物保健'],
  '纺织服饰': ['纺织服饰', '服装家纺', '纺织制造'],
  '轻工制造': ['轻工制造', '造纸', '包装印刷', '家用轻工', '家具'],
  '商贸零售': ['一般零售', '百货', '超市', '贸易', '专业连锁', '电商'],
  '社会服务': ['旅游', '酒店餐饮', '教育', '美容护理', '体育'],
  '环保': ['环保', '环境治理', '水务', '固废处理', '碳中和'],
  '交通运输': ['物流', '快递', '港口', '航运', '航空', '机场', '高速公路', '铁路运输'],
  '钢铁': ['钢铁', '普钢', '特钢'],
  '国防军工': ['航空装备', '航天装备', '地面兵装', '船舶制造', '军工电子', '军工材料'],
  '美容护理': ['美容护理', '化妆品', '医美'],
  '石油石化': ['石油开采', '油气开采', '炼化', '石油贸易'],
  '煤炭': ['煤炭开采', '焦炭', '煤化工'],
  '非银金融': ['证券', '保险', '多元金融', '期货', '信托'],
  '综合': ['综合'],
};

// 反向映射：细分行业名 → 大行业关注度名
function findMatchingIndustries(focusIndustry: string, allIndustries: string[]): string[] {
  const lower = focusIndustry.toLowerCase();
  
  // 1. 精确匹配
  const exact = allIndustries.filter(i => i.toLowerCase() === lower);
  if (exact.length > 0) return exact;
  
  // 2. 包含关系：关注度名包含研报行业名，或反之
  const partial = allIndustries.filter(i => {
    const il = i.toLowerCase();
    return il.includes(lower) || lower.includes(il);
  });
  if (partial.length > 0) return partial;
  
  // 3. 关键词映射表
  const keywords = INDUSTRY_KEYWORDS[focusIndustry] || [];
  if (keywords.length === 0) return [];
  
  const matched: string[] = [];
  for (const kw of keywords) {
    for (const ind of allIndustries) {
      if (ind.includes(kw) || kw.includes(ind)) {
        if (!matched.includes(ind)) matched.push(ind);
      }
    }
  }
  return matched;
}

export async function GET(request: NextRequest) {
  const industry = request.nextUrl.searchParams.get('industry');
  const date = request.nextUrl.searchParams.get('date');

  if (!industry) {
    return NextResponse.json(
      { success: false, error: '缺少 industry 参数' },
      { status: 400 }
    );
  }

  try {
    const dataDir = path.join(process.cwd(), 'public', 'industry-ratings');
    let detailsPath: string;

    if (date) {
      detailsPath = path.join(dataDir, `${date}-details.json`);
    } else {
      detailsPath = path.join(dataDir, 'latest-details.json');
    }

    if (!fs.existsSync(detailsPath)) {
      detailsPath = path.join(dataDir, 'latest-details.json');
      if (!fs.existsSync(detailsPath)) {
        return NextResponse.json(
          { success: false, error: '行业研报数据不存在' },
          { status: 404 }
        );
      }
    }

    const detailsData = JSON.parse(fs.readFileSync(detailsPath, 'utf-8'));
    const allIndustries = Object.keys(detailsData);

    const matchedIndustryNames = findMatchingIndustries(industry, allIndustries);

    if (matchedIndustryNames.length === 0) {
      // 没有匹配到也返回成功但空数据，避免前端展示错误
      return NextResponse.json({
        success: true,
        data: [],
        industry,
        matchedIndustries: [],
        count: 0,
        buyCount: 0,
        increaseCount: 0,
        note: `未找到"${industry}"相关研报数据，可能当日暂无该行业新发布研报`,
      });
    }

    // 合并所有匹配行业的研报，去重（按股票代码+评级机构+评级日期）
    const seen = new Set<string>();
    const allItems: Array<{
      code: string;
      name: string;
      rating: string;
      org: string;
      analyst: string;
      title: string;
      date: string;
      count: number;
    }> = [];

    for (const indName of matchedIndustryNames) {
      const items = detailsData[indName] || [];
      for (const item of items) {
        const key = `${item.code}_${item.org}_${item.date}`;
        if (seen.has(key)) continue;
        seen.add(key);
        allItems.push(item);
      }
    }

    // 按日期倒序
    allItems.sort((a, b) => b.date.localeCompare(a.date));

    // 统计买入/增持数量
    let buyCount = 0;
    let increaseCount = 0;
    for (const item of allItems) {
      if (item.rating === '买入' || item.rating === '强烈推荐' || item.rating === '推荐') buyCount++;
      else if (item.rating === '增持' || item.rating === '优于大市' || item.rating === '跑赢行业') increaseCount++;
    }

    return NextResponse.json({
      success: true,
      data: allItems.slice(0, 30),
      industry,
      matchedIndustries: matchedIndustryNames,
      count: allItems.length,
      buyCount,
      increaseCount,
    });
  } catch (error) {
    console.error('[industry-ratings] Error:', error);
    return NextResponse.json(
      { success: false, error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
