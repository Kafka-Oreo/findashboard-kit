import { NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { getLatestMarketData } from '@/lib/db';

/**
 * 市场数据 API
 * GET /api/market-data
 * 
 * 优先从数据库读取市场数据
 * 如果数据库不可用，则从静态文件读取
 * 
 * 注意：此 API 不执行任何 Python 脚本或 AkShare 调用
 * 数据采集由独立的 Python Scheduler 服务完成
 */
export async function GET() {
  try {
    // 尝试从数据库读取数据
    const dbData = await getLatestMarketData();
    
    if (dbData) {
      return NextResponse.json({
        success: true,
        data: dbData,
        source: 'database'
      });
    }
    
    // 如果数据库不可用，从静态文件读取
    const filePath = path.join(process.cwd(), 'public', 'market-data', 'user-input.json');
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: '市场数据文件不存在，请先运行数据采集脚本' },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    return NextResponse.json({
      success: true,
      data: data,
      source: 'file'
    });
  } catch (error) {
    console.error('Market data API error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch market data' },
      { status: 500 }
    );
  }
}
