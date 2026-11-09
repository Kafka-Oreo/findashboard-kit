import { NextResponse } from 'next/server';
import { getLatestMarketData } from '@/lib/db';

export async function GET() {
  try {
    const data = await getLatestMarketData();
    
    if (!data) {
      return NextResponse.json(
        { success: false, error: 'No market data found' },
        { status: 404 }
      );
    }
    
    // 转换字段名为驼峰格式
    const result = {
      ...data,
      ma60Deviation: data.ma60_deviation,
      wandeMa60Deviation: data.wande_ma60_deviation ?? data.ma60_deviation,
      shMa60Deviation: data.sh_ma60_deviation,
      cybMa60Deviation: data.cyb_ma60_deviation,
      kcbMa60Deviation: data.kcb_ma60_deviation,
      limitUp: data.limit_up,
      limitDown: data.limit_down,
      limitUpRate: data.limit_up_rate,
      mainFundFlow: data.main_fund_flow,
      northFundFlow: data.north_fund_flow,
      sectorRanking: data.sector,
      isRealData: data.is_real_data,
      updateTime: data.update_time,
    };
    
    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error in market/latest API:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
