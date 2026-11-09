import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 新浪行情批量接口
// GET /api/stock-quote/realtime?names=传智教育,一鸣食品,高争民爆
// GET /api/stock-quote/realtime?codes=sz003032,sh605179

// 股票名称到新浪代码的映射表（逐步补充）
const nameToCode: Record<string, string> = {
  '传智教育': 'sz003032',
  '一鸣食品': 'sh605179',
  '高争民爆': 'sz002827',
  '泰尔股份': 'sz002347',
  '华控赛格': 'sz000068',
  '莱茵体育': 'sz000558',
  '开开实业': 'sh600272',
  '汉得信息': 'sz300170',
  '国投中鲁': 'sh600962',
  '国芳集团': 'sh601086',
  '宁波中百': 'sh600857',
  '合兴股份': 'sh605005',
  '东方中科': 'sz002819',
  '爱普股份': 'sh603020',
  '广汇汽车': 'sh600297',
  '汉森制药': 'sz002412',
  '深中华A': 'sz000017',
  '华扬联众': 'sh603825',
  '金圆股份': 'sz000546',
  '金健米业': 'sh600127',
  '华升股份': 'sh600156',
  '湖南天雁': 'sh600698',
  '航天晨光': 'sh600501',
  '航发动力': 'sh600893',
  '中航沈飞': 'sh600760',
  '北斗星通': 'sz002151',
  '北方导航': 'sh600435',
  '中国卫星': 'sh600118',
  '航天电子': 'sh600879',
  '中航西飞': 'sz000768',
  '内蒙一机': 'sh600967',
  // 09-02 连板表
  '竞业达': 'sz003005',
  '集泰股份': 'sz002909',
  '龙版传媒': 'sh605577',
  '欢瑞世纪': 'sz000892',
  '大晟文化': 'sh600892',
  '英力特': 'sz000635',
  '恒宝股份': 'sz002104',
  '茂业商业': 'sh600828',
  '香溢融通': 'sh600830',
  '小方制药': 'sh603998',
  '光洋股份': 'sz002708',
  '华昌化工': 'sz002274',
  '建设工业': 'sz002941',
  '贵州燃气': 'sh600903',
  '金帝股份': 'sh603270',
  '北方长龙': 'sz301357',
  '博云新材': 'sz002297',
  '航发控制': 'sz000738',
  '蓝丰生化': 'sz002513',
  '读者传媒': 'sh603999',
  '思美传媒': 'sz002712',
  '新华百货': 'sh600785',
  '中央商场': 'sh600280',
  '联明股份': 'sh603006',
  '水发燃气': 'sh603318',
  '南天信息': 'sz000948',
  '恒银科技': 'sh603106',
  '美迪西': 'sh688202',
  '百花医药': 'sh600721',
  '兴业科技': 'sz002674',
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const names = searchParams.get('names')?.split(',').filter(Boolean) || [];
  const codesParam = searchParams.get('codes')?.split(',').filter(Boolean) || [];

  if (names.length === 0 && codesParam.length === 0) {
    return NextResponse.json({ error: '请指定股票名称或代码' }, { status: 400 });
  }

  // 名称转代码
  const codes = new Set(codesParam);
  for (const name of names) {
    if (nameToCode[name]) {
      codes.add(nameToCode[name]);
    }
  }

  if (codes.size === 0) {
    return NextResponse.json({ error: '未找到匹配的股票代码' }, { status: 404 });
  }

  try {
    // 调用新浪行情接口
    const codeStr = Array.from(codes).join(',');
    const response = await fetch(`https://hq.sinajs.cn/list=${codeStr}`, {
      headers: {
        'Referer': 'https://finance.sina.com.cn',
        'User-Agent': 'Mozilla/5.0',
      },
      cache: 'no-store',
    });

    // 新浪返回 GBK 编码，需要转换
    const buffer = await response.arrayBuffer();
    const decoder = new TextDecoder('gbk');
    const text = decoder.decode(buffer);
    const result: Record<string, {
      name: string;
      code: string;
      price: number;
      open: number;
      prev_close: number;
      high: number;
      low: number;
      volume: number;
      amount: number;
      change: number;
      change_pct: number;
      date: string;
      time: string;
    }> = {};

    // 解析新浪返回的 GBK 格式数据
    const lines = text.split('\n').filter(l => l.trim());
    for (const line of lines) {
      const match = line.match(/var hq_str_(.+)="(.+)"/);
      if (!match) continue;
      const code = match[1];
      const fields = match[2].split(',');
      if (fields.length < 32) continue;

      const name = fields[0];
      const open = parseFloat(fields[1]);
      const prev_close = parseFloat(fields[2]);
      const price = parseFloat(fields[3]);
      const high = parseFloat(fields[4]);
      const low = parseFloat(fields[5]);
      const volume = parseInt(fields[8]) || 0;
      const amount = parseFloat(fields[9]) || 0;
      const date = fields[30];
      const time = fields[31];
      const change = price - prev_close;
      const change_pct = prev_close > 0 ? round2((change / prev_close) * 100) : 0;

      result[code] = {
        name,
        code,
        price: round2(price),
        open: round2(open),
        prev_close: round2(prev_close),
        high: round2(high),
        low: round2(low),
        volume,
        amount: round2(amount),
        change: round2(change),
        change_pct,
        date,
        time,
      };
    }

    // 如果有名称查询，也按名称建立索引
    const byName: Record<string, typeof result[string]> = {};
    for (const name of names) {
      const code = nameToCode[name];
      if (code && result[code]) {
        byName[name] = result[code];
      }
    }

    return NextResponse.json({
      success: true,
      data: result,
      byName,
      count: Object.keys(result).length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: '行情获取失败', detail: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
