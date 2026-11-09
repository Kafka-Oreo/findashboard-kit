import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

/**
 * 连板数据 API
 * GET /api/limit-up-data?date=20260723
 * 
 * 从预生成的静态文件读取连板数据
 * 数据文件位置：public/limit-up-data/{date}.json
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: '请提供日期参数，格式：YYYYMMDD' },
        { status: 400 }
      );
    }

    // 验证日期格式
    if (!/^\d{8}$/.test(date)) {
      return NextResponse.json(
        { error: '日期格式错误，应为 YYYYMMDD' },
        { status: 400 }
      );
    }

    // 从静态文件读取数据
    const filePath = path.join(process.cwd(), 'public', 'limit-up-data', `${date}.json`);
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `未找到${date}的连板数据` },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(fileContent);

    return NextResponse.json({
      success: true,
      date: date,
      data: data,
      total: data.length,
    });
  } catch (error) {
    console.error('获取连板数据失败:', error);
    return NextResponse.json(
      { error: '获取连板数据失败' },
      { status: 500 }
    );
  }
}
