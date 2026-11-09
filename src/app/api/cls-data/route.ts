import { NextRequest, NextResponse } from 'next/server'
import path from 'path'
import fs from 'fs'

/**
 * 财联社数据 API
 * GET /api/cls-data?date=YYYYMMDD&type=all
 * 
 * 注意：此 API 不执行任何 Python 脚本
 * 数据采集由独立的 Python Scheduler 服务完成
 * 
 * 架构说明：
 * Python Scheduler (独立部署) → 财联社 API → 文件/数据库 → Next.js API → 页面展示
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get('date')
  const type = searchParams.get('type') || 'all'

  if (!date) {
    return NextResponse.json(
      { success: false, error: '缺少日期参数' },
      { status: 400 }
    )
  }

  try {
    // 从静态文件读取数据
    const filePath = path.join(process.cwd(), 'public', 'cls-data', `${date}.json`)
    
    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { success: false, error: '数据文件不存在，请先运行数据采集脚本' },
        { status: 404 }
      )
    }

    const fileContent = fs.readFileSync(filePath, 'utf-8')
    const data = JSON.parse(fileContent)

    return NextResponse.json({
      success: true,
      data,
      source: 'file'
    })
  } catch (error: any) {
    console.error('获取财联社数据失败:', error.message)
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
