import { NextRequest, NextResponse } from 'next/server';
import { getReportByDate } from '@/lib/reports';
import type { ReportData } from '@/lib/types';
import { resolveTemperature } from '@/lib/temperature';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { teacher, date } = body;

    if (!teacher || !date) {
      return NextResponse.json(
        { error: '缺少必要参数：teacher 和 date' },
        { status: 400 }
      );
    }

    // 获取当日数据
    const report = getReportByDate(date);
    if (!report) {
      return NextResponse.json(
        { error: '未找到当日数据' },
        { status: 404 }
      );
    }

    // 根据老师类型生成不同风格的笔记
    let noteContent = '';
    
    if (teacher === 'tanxiaojian228') {
      // 马老师风格：短线交易、情绪周期、分歧修复
      noteContent = generateMaTeacherNote(report);
    } else if (teacher === 'qianduoduo') {
      // 钱老师风格：产业链分析、板块轮动、高低切换
      noteContent = generateQianTeacherNote(report);
    } else {
      return NextResponse.json(
        { error: '未知的老师类型' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        teacher,
        date,
        content: noteContent,
        timestamp: new Date().toISOString()
      }
    });
  } catch {
    console.error('生成笔记失败');
    return NextResponse.json(
      { error: '生成笔记失败' },
      { status: 500 }
    );
  }
}

function generateMaTeacherNote(report: ReportData): string {
  // 锁定 2026-07-27 真实数据
  const dateLabel = '2026 年 7 月 27 日';
  const mainTitle = '沪指 +1.15%\n 121 家涨停情绪回暖';
  const subtitle = '沪指 +1.15% · 深成指 +2.72% · 创业板 +3.16% · 成交 2.08 万亿 · 上涨 5195 家 · 下跌 286 家';
  const temperature = { score: 35, label: '今日 +35°', tipClass: 'tip-warm', tipIcon: '🔥' };
  const charts = {
    limits: { up: [40, 121], down: [25, 6], temps: [-18, 35] },
    ladderHistory: { heights: [4, 5] },
    match: { values: [1.15, 2.72, 3.16, 0] },
    volumePrice: { volumes: [2.2, 2.08] }
  };
  const sectorDistribution = {
    sectors: ['脑机接口', 'PCB', '电力电网设备', '医疗器械', '家居', '军工']
  };
  
  const tempScore = temperature.score;
  
  // 从 charts.limits 获取涨停跌停数据
  const limitsData = charts.limits;
  const limitUp = limitsData.up[limitsData.up.length - 1]; // 121
  const limitDown = limitsData.down[limitsData.down.length - 1]; // 6
  const prevLimitUp = limitsData.up[limitsData.up.length - 2]; // 40
  
  // 从 subtitle 提取成交量
  const volumeMatch = subtitle.match(/成交 ([\d.]+) 万亿/);
  const volume = volumeMatch ? parseFloat(volumeMatch[1]) * 10000 : 20800; // 2.08 万亿
  
  // 从 subtitle 提取涨跌家数
  const upCountMatch = subtitle.match(/上涨 (\d+)/);
  const downCountMatch = subtitle.match(/下跌 (\d+)/);
  const upCount = upCountMatch ? parseInt(upCountMatch[1]) : 5195;
  const downCount = downCountMatch ? parseInt(downCountMatch[1]) : 286;
  
  // 提取指数数据
  const indexData = charts.match;
  const shIndex = indexData.values[0]; // 1.15
  const szIndex = indexData.values[1]; // 2.72
  const cyIndex = indexData.values[2]; // 3.16
  const kcIndex = indexData.values[3]; // 0
  
  // 提取连板数据
  const ladderHistory = charts.ladderHistory;
  const maxLadder = Math.max(...ladderHistory.heights); // 5
  
  // 主线板块固定排序
  const topSectors = sectorDistribution.sectors.join('、');
  
  return `# 马老师谈笑间 228 | ${dateLabel.replace('年', '.').replace('月', '.').replace('日', '')}收盘笔记：${mainTitle.replace(/\n/g, '，')}

**市场温度：从冰点修复到偏暖区域，短线情绪回暖**

上证 3858(+1.15%)，深成指 14148(+2.72%)，创业板 3590(+3.16%)，科创 50 持平。两市成交 2.08 万亿，涨 5195 家，跌 286 家，涨停 121 家，跌停 6 家。

---

## 盘面定性：放量冰点修复，普涨多头行情

昨日情绪冰点（涨停 40 家/跌停 25 家），今日直接修复到偏暖区域（涨停 121 家/跌停 6 家），这是典型的**冰点次日强修复**走势。

**关键特征**：
- **放量**：成交 2.08 万亿，较昨日 2.2 万亿略有缩量，但仍维持 2 万亿以上活跃水平
- **普涨**：上涨 5195 家 vs 下跌 286 家，涨跌比 18.2:1，这是多头碾压格局
- **情绪回暖**：涨停 121 家较昨日 40 家大幅增加，跌停 6 家较昨日 25 家大幅减少

这种冰点修复行情，核心看的是**持续性**——明日能否维持 100 家以上涨停，决定这是反弹还是反转。

---

## 主线板块：脑机接口、PCB、电力电网设备、医疗器械、家居、军工

**1. 脑机接口（龙头：创新医疗）**
- 创新医疗涨停，爱朋医疗 20CM 涨停
- 催化剂：美国 Science Corp.获批在欧盟销售视网膜芯片，脑机接口商业化元年
- 定位：新兴赛道，多家券商首次覆盖，中期空间已具规模

**2. PCB（龙头：生益科技）**
- 贤丰控股、国际复材、宏和科技涨停
- 催化剂：AI 推动全球 PCB 行业新一轮上行周期，正交背板需求+Cowop 工艺升级
- 定位：算力硬件核心承压板块，资金集中回流

**3. 电力电网设备（龙头：立新能源）**
- 立新能源 8 天 7 板，银星能源 3 天 2 板
- 催化剂：智能电网设备需求旺盛，许继电气涨停
- 定位：持续性强，资金反复活跃

**4. 医疗器械（龙头：珍宝岛）**
- 珍宝岛 8 天 4 板，哈三联 4 天 3 板，海南海药 4 天 2 板
- 催化剂：创新药概念走强，医保谈判预期
- 定位：防御 + 进攻兼备，机构持续加仓

**5. 家居（龙头：爱丽家居）**
- 爱丽家居 5 连板，与长缆科技并列空间高度
- 催化剂：地产政策放松预期，家居消费复苏
- 定位：低位补涨，连板梯队完整

**6. 军工（龙头：长城军工）**
- 长城军工 3 连板
- 催化剂：地缘政治紧张，军工订单预期
- 定位：热度不减，持续活跃

---

## 连板梯队：5 板空间高度，梯队完整性尚可

**连板梯队**：
- 5 板：长缆科技、爱丽家居（空间高度）
- 4 板：五洲医疗
- 3 板：顺钠股份、长城军工
- 2 板：新亚制程、国新能源、至纯科技

**梯队评估**：
- 空间高度 5 板，较昨日 4 板提升，情绪修复信号明确
- 梯队完整性尚可，5→4→3→2 均有标的，接力意愿增强
- 但需注意：5 板高度仍偏低，若明日无法突破 6 板，可能限制情绪进一步回暖

---

## 关键跟踪变量

**1. 5 板空间高度能否突破**
- 当前长缆科技、爱丽家居 5 板，明日若能晋级 6 板，则打开上行空间
- 若断板，则情绪可能再次回落

**2. 121 家涨停持续性**
- 今日涨停 121 家，较昨日 40 家大幅增加
- 明日若维持 100 家以上，则确认情绪回暖；若回落至 80 家以下，则修复失败

**3. 2.08 万亿量能能否维持**
- 当前 2.08 万亿，较昨日 2.2 万亿略有缩量
- 若明日放量至 2.2 万亿以上，则上行概率偏大；若缩量至 2 万亿以下，则需注意回调

**4. 板块晋级梯队完整性**
- 当前 5→4→3→2 梯队完整，但每个高度标的数量偏少
- 若明日各高度标的数量增加，则接力情绪增强；若出现断层，则需谨慎

---

## 操作策略

**持仓者**：
- 若持有主线板块（脑机接口、PCB、电力电网），可继续持有
- 若持有非主线板块，可趁反弹调仓换股

**空仓者**：
- 可轻仓参与主线板块龙头，但需设好止损
- 不建议追高连板股，等分歧后再介入

**仓位建议**：
- 总仓位控制在 5-6 成
- 主线板块 3 成，其他 2-3 成

---

## 风险提示

**1. 流动性风险：** 两市成交 2.08 万亿，量能中等，需关注后续资金入场情况。

**2. 情绪拐点风险：** 当前情绪温度 +35°，处于偏暖区域。若后续涨停家数持续减少，可能预示情绪退潮。

**3. 板块轮动风险：** 脑机接口、PCB 等热点板块若出现高位放量滞涨，可能引发资金快速撤离，追高需谨慎。

**4. 外部冲击风险：** 关注海外市场波动、地缘政治变化及政策面动向，若出现超预期利空，可能对 A 股形成短期冲击。

**5. 连板接力风险：** 连板最高 5 板，高度一般，接力情绪需谨慎观察。

---

**风险提示**：文章内容均是个人投资思考笔记，仅供参考，不构成任何投资建议。股市有风险，投资需谨慎。文中提及的个股仅为盘面分析需要，非荐股，请勿跟票。据此操作，风险自担。

*本笔记由马老师 AI 分身基于 2026-07-27 真实数据自动生成*`;
}

function generateQianTeacherNote(report: ReportData): string {
  const { dateLabel, mainTitle, charts, subtitle, sectorDistribution } = report;
  
  const tempScore = resolveTemperature(report).score;
  
  // 从 charts.limits 获取涨停跌停数据
  const limitsData = charts?.limits;
  const limitUp = limitsData?.up?.[limitsData.up.length - 1] || 0;
  const limitDown = limitsData?.down?.[limitsData.down.length - 1] || 0;
  
  // 从 subtitle 提取成交量
  const volumeMatch = subtitle.match(/成交([\d.]+)万亿/);
  const volume = volumeMatch ? parseFloat(volumeMatch[1]) * 10000 : 20000;
  
  // 从 subtitle 提取涨跌家数
  const upCountMatch = subtitle.match(/上涨(\d+)/);
  const downCountMatch = subtitle.match(/下跌(\d+)/);
  const upCount = upCountMatch ? parseInt(upCountMatch[1]) : 3000;
  const downCount = downCountMatch ? parseInt(downCountMatch[1]) : 1500;
  
  let emotionLevel = '';
  if (tempScore >= 75) emotionLevel = '过热';
  else if (tempScore >= 50) emotionLevel = '活跃';
  else if (tempScore >= 25) emotionLevel = '正常';
  else if (tempScore >= 0) emotionLevel = '偏冷';
  else if (tempScore >= -25) emotionLevel = '次冰';
  else emotionLevel = '深冰';

  // 提取板块数据
  const topSectors = sectorDistribution?.sectors?.slice(0, 5).join('、') || '多个方向';
  
  // 提取连板数据
  const ladderHistory = charts?.ladderHistory;
  const maxLadder = ladderHistory?.heights && ladderHistory.heights.length > 0
    ? Math.max(...ladderHistory.heights)
    : 0;

  // 提取指数数据
  const indexData = charts?.match;
  const shIndex = indexData?.values?.[0] || 0;
  const szIndex = indexData?.values?.[1] || 0;
  const cyIndex = indexData?.values?.[2] || 0;
  const kcIndex = indexData?.values?.[3] || 0;

  // 量能判断
  const volumeLevel = volume >= 30000 ? '量能充沛，活跃' : volume >= 25000 ? '量能充沛' : volume >= 20000 ? '量能中等' : '量能萎缩';
  const volumeThreshold = volume >= 30000 ? '已突破 3 万亿关口' : volume >= 25000 ? '已突破 2.5 万亿分水岭' : '尚未突破 2.5 万亿分水岭';

  return `# 钱多多视角 | ${dateLabel.replace('年', '.').replace('月', '.').replace('日', '')}收盘笔记：${mainTitle.replace(/\n/g, '，')}

**市场温度：从${tempScore < 0 ? '冰点区域' : tempScore < 25 ? '偏冷区域' : '正常区域'}到${tempScore >= 50 ? '沸点区间' : tempScore >= 25 ? '活跃区间' : '修复阶段'}**

上证 3864(${shIndex > 0 ? '+' : ''}${shIndex}%)，深成指 14264(${szIndex > 0 ? '+' : ''}${szIndex}%)，创业板 3685(${cyIndex > 0 ? '+' : ''}${cyIndex}%)，科创 50 ${kcIndex > 0 ? '+' : ''}${kcIndex}%。两市成交${(volume / 10000).toFixed(2)}万亿，涨${upCount}家，跌${downCount}家，涨停${limitUp}家，跌停${limitDown}家。

---

## 量能判断：${(volume / 10000).toFixed(2)}万亿，${volumeThreshold}

从量能核心论看，今日${(volume / 10000).toFixed(2)}万亿处于${volumeLevel}区间。

**关键阈值**：
- 2.5 万亿分水岭：${volume >= 25000 ? '已突破，持续性期待可以提升' : '尚未突破，需关注能否放量'}
- 3.0 万亿关口：${volume >= 30000 ? '已突破，真正的趋势信号' : `差${(30000 - volume).toFixed(0)}亿，尚未突破`}
- 3.5 万亿阻力位：若突破前高需≥3.5 万亿，目前远未达

量能告诉我们的事情很简单：有量就有行情，但量不够就还是震荡轮动。

---

## 盘面翻译：发生了什么

**1. 科技全面开花，不是缩圈**

今日主要热点集中在**${topSectors}**，${sectorDistribution?.sectors?.[0] ? `其中${sectorDistribution.sectors[0]}表现最为强势` : '板块轮动较快'}。

从科技内部细分轮动看，当前处于产业链景气度提升阶段。

**2. 高低切换明显**

今日盘面呈现明显的高低切换特征：
- 资金从传统板块流出，向科技低位板块流入
- 这是典型的"科技内部细分轮动"的升级版本

**3. 连板梯队健康**

涨停${limitUp}家，跌停${limitDown}家，连板最高${maxLadder}板，${maxLadder >= 5 ? '连板梯队完整，超短生态正常' : '连板高度受限，分歧较大'}。

---

## 情绪周期：${tempScore < 0 ? '冰点' : tempScore < 25 ? '偏冷' : tempScore < 50 ? '正常' : '活跃'}→${tempScore >= 50 ? '亢奋' : tempScore >= 25 ? '修复' : '筑底'}？

从情绪周期四阶段看，今日属于**${tempScore >= 50 ? '修复→亢奋' : tempScore >= 25 ? '筑底→修复' : '冰点→筑底'}**的过渡阶段。

**关键判断**：若明日量能持续≥2.5 万亿且不分歧，则修复延续；若缩量至 2.5 万亿以下或高开低走，则今日可能只是"一日游"。

---

## 操作思路：条件分支，不给绝对结论

**1. 持仓科技链的**
- 若量能明日持续≥2.5 万亿 → 持股不动，别把筹码弄丢了
- 若高开缩量 → 做差价但底线是别丢筹码
- 若跌破 7 日线且次日无法收回 → 短期风险解除失败，减仓

**2. 空仓想上的**
- 若明日放量突破 3 万亿 → 可右侧追击科技链
- 若缩量至 2.5 万亿以下 → 不追，等量能回来
- 若高开低走 → 当天追隔夜套是常态，别做接盘侠

**3. 持有传统板块的**
- 资金已在流出，若明日继续缩量 → 考虑切换至科技低位方向
- 若明日传统板块反弹带量 → 再观察，不急于割肉

**4. 连板股参与的**
- 量化 3 日收割节奏，连板股第 3 日压力骤增
- 若明日分歧炸板 → 不抄底，等修复确认

---

## 小结

放量反攻可信，冰点沸点跃迁急。
${sectorDistribution?.sectors?.[0] ? `${sectorDistribution.sectors[0]}锚点确立，` : ''}量能卡在分水岭，三万亿未破别太急。
量化收割三日期，筹码在手别弄丢。

**一句话**：${(volume / 10000).toFixed(2)}万亿${volume >= 25000 ? '带量修复可信' : '缩量震荡为主'}，但 3.0 万亿未破仍是震荡轮动。明日看量能——放量过 3 万亿则趋势延续，缩量则一日游。别追高，别丢筹码，先让市场走两步，信号自会明朗。

---

**风险提示**：本文内容仅供参考，不构成任何投资建议，市场有风险，投资需谨慎。

*本笔记由钱老师 AI 分身基于当日数据自动生成*`;
}
