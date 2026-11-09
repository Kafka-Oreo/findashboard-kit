import { NextRequest, NextResponse } from 'next/server';

interface QARequest {
  question: string;
  date: string;
}

interface QAResponse {
  success: boolean;
  data?: {
    answer: string;
  };
  error?: string;
}

// 产业链知识库（简化版，实际应使用向量数据库或外部 API）
const INDUSTRY_KNOWLEDGE: Record<string, {
  upstream: string[];
  midstream: string[];
  downstream: string[];
  beneficiaries: string[];
  followUp: string[];
}> = {
  '光刻机': {
    upstream: ['光学镜头（茂莱光学、福晶科技）', '光源系统（科益虹源）', '工件台（华卓精科）', '双工件台系统'],
    midstream: ['光刻机整机（上海微电子 SMEE）', 'ASML（荷兰）', 'Canon（日本）', 'Nikon（日本）'],
    downstream: ['晶圆代工（中芯国际、华虹半导体）', '芯片设计（华为海思、韦尔股份）'],
    beneficiaries: ['茂莱光学', '福晶科技', '张江高科（持有上海微电子股权）'],
    followUp: ['上海微电子 IPO 进展', '国产光刻机验证进度', '28nm 工艺突破情况'],
  },
  'CRO': {
    upstream: ['实验动物（药明康德、昭衍新药）', '试剂耗材（皓元医药、阿拉丁）', '科研仪器'],
    midstream: ['临床前 CRO（药明康德、康龙化成、美迪西）', '临床 CRO（泰格医药、博济医药）', 'SMO（药明津石）'],
    downstream: ['创新药企（百济神州、信达生物、恒瑞医药）', 'Biotech 公司'],
    beneficiaries: ['药明康德', '康龙化成', '泰格医药', '美迪西'],
    followUp: ['FDA 审批政策变化', '国内创新药融资环境', 'CXO 订单恢复情况'],
  },
  'AI 服务器': {
    upstream: ['GPU（英伟达、AMD、海光信息）', 'CPU（英特尔、AMD）', '内存（三星、海力士、长鑫存储）', 'PCB（沪电股份、深南电路）'],
    midstream: ['服务器整机（浪潮信息、中科曙光、工业富联）', 'ODM（广达、纬创）', '散热（英维克、高澜股份）'],
    downstream: ['云计算（阿里云、腾讯云、华为云）', 'AI 大模型（百度文心、字节豆包）', '数据中心运营商'],
    beneficiaries: ['浪潮信息', '中科曙光', '沪电股份', '深南电路', '英维克'],
    followUp: ['英伟达新品发布', '国内 AI 算力需求', '服务器出货量数据'],
  },
  '机器人': {
    upstream: ['减速器（绿的谐波、双环传动）', '伺服电机（汇川技术、禾川科技）', '控制器（新松机器人）', '传感器'],
    midstream: ['工业机器人（埃斯顿、新松机器人、埃夫特）', '人形机器人（特斯拉 Optimus、优必选）', '协作机器人（节卡、遨博）'],
    downstream: ['汽车制造', '3C 电子', '物流仓储', '医疗手术'],
    beneficiaries: ['绿的谐波', '汇川技术', '埃斯顿', '双环传动'],
    followUp: ['特斯拉 Optimus 进展', '人形机器人政策扶持', '工业机器人月度产量'],
  },
};

// 默认回答模板
function getDefaultAnswer(question: string): string {
  return `关于"${question}"的产业链分析：

 产业链结构
• 上游：核心原材料/零部件供应商
• 中游：主要制造商/集成商
• 下游：应用领域/终端客户

💡 投资要点
• 关注产业链中技术壁垒最高的环节
• 优先选择具有国产替代逻辑的公司
• 注意估值与业绩的匹配度

🔍 后续跟踪方向
• 行业政策变化
• 龙头企业订单情况
• 技术突破进展

（注：以上为通用分析框架，具体产业链数据正在完善中）`;
}

export async function POST(request: NextRequest): Promise<NextResponse<QAResponse>> {
  try {
    const body: QARequest = await request.json();
    const { question, date } = body;

    if (!question || !question.trim()) {
      return NextResponse.json({
        success: false,
        error: '问题不能为空',
      });
    }

    // 匹配产业链关键词
    let matchedKey = '';
    for (const key of Object.keys(INDUSTRY_KNOWLEDGE)) {
      if (question.includes(key)) {
        matchedKey = key;
        break;
      }
    }

    let answer: string;

    if (matchedKey && INDUSTRY_KNOWLEDGE[matchedKey]) {
      const knowledge = INDUSTRY_KNOWLEDGE[matchedKey];
      answer = `【${matchedKey}产业链深度分析】

🔺 上游环节
${knowledge.upstream.map((item, i) => `${i + 1}. ${item}`).join('\n')}

🔶 中游环节
${knowledge.midstream.map((item, i) => `${i + 1}. ${item}`).join('\n')}

🔻 下游环节
${knowledge.downstream.map((item, i) => `${i + 1}. ${item}`).join('\n')}

⭐ 真正受益公司
${knowledge.beneficiaries.map((item, i) => `${i + 1}. ${item}`).join('\n')}

 后续跟踪方向
${knowledge.followUp.map((item, i) => `${i + 1}. ${item}`).join('\n')}

💡 投资逻辑
• 上游：关注技术壁垒高、国产替代空间大的环节
• 中游：选择市占率提升、订单确定性强的龙头
• 下游：跟踪需求景气度、渗透率变化

️ 风险提示
• 产业链数据仅供参考，不构成投资建议
• 投资有风险，入市需谨慎`;
    } else {
      answer = getDefaultAnswer(question);
    }

    return NextResponse.json({
      success: true,
      data: {
        answer,
      },
    });
  } catch (error) {
    console.error('Industry chain QA error:', error);
    return NextResponse.json({
      success: false,
      error: '服务器错误，请重试',
    });
  }
}
