import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// 数据库连接配置
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'market_data',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// 创建数据库连接池（延迟初始化）
let pool: Pool | null = null;

export function getPool(): Pool | null {
  if (!pool) {
    try {
      pool = new Pool(dbConfig);
    } catch (error) {
      console.error('Failed to create database pool:', error);
      return null;
    }
  }
  return pool;
}

/**
 * 通用查询函数
 */
export async function query(text: string, params?: any[]): Promise<any> {
  const dbPool = getPool();
  if (!dbPool) {
    throw new Error('数据库连接不可用');
  }
  return dbPool.query(text, params);
}

// 市场数据类型
export interface MarketDataRecord {
  id: number;
  trade_date: string;
  turnover: number | null;
  advance: number | null;
  decline: number | null;
  limit_up: number | null;
  limit_down: number | null;
  limit_up_rate: number | null;
  ma60_deviation: number | null;
  wande_ma60_deviation: number | null; // 万得全A MA60 乖离率
  sh_ma60_deviation: number | null;
  cyb_ma60_deviation: number | null;
  kcb_ma60_deviation: number | null;
  main_fund_flow: number | null;
  north_fund_flow: number | null;
  sector: any;
  source: string | null;
  update_time: string;
  is_real_data: boolean | null;
}

/**
 * 获取最新的市场数据
 * 优先从数据库读取，如果数据库不可用则降级到文件
 */
export async function getLatestMarketData(): Promise<MarketDataRecord | null> {
  // 尝试从数据库读取
  const dbPool = getPool();
  if (dbPool) {
    try {
      const result = await dbPool.query(
        'SELECT * FROM market_data ORDER BY trade_date DESC LIMIT 1'
      );
      
      if (result.rows.length > 0) {
        return result.rows[0];
      }
    } catch (error) {
      console.error('Error fetching from database, falling back to file:', error);
    }
  }
  
  // 降级到文件读取
  return getLatestMarketDataFromFile();
}

/**
 * 从文件读取最新的市场数据（降级方案）
 */
function getLatestMarketDataFromFile(): MarketDataRecord | null {
  try {
    // 优先读取用户输入的数据
    const userInputPath = path.join(process.cwd(), 'public/market-data/user-input.json');
    if (fs.existsSync(userInputPath)) {
      const content = fs.readFileSync(userInputPath, 'utf-8');
      const data = JSON.parse(content);
      return {
        id: 0,
        trade_date: data.trade_date || data.date || new Date().toISOString().split('T')[0],
        turnover: data.turnover,
        advance: data.advance,
        decline: data.decline,
        limit_up: data.limit_up ?? data.limitUp,
        limit_down: data.limit_down ?? data.limitDown,
        limit_up_rate: data.limit_up_rate ?? data.limitUpRate ?? data.seal_rate,
        ma60_deviation: data.ma60_deviation ?? data.ma60Deviation,
        wande_ma60_deviation: data.wande_ma60_deviation ?? data.wandeMa60Deviation ?? data.ma60_deviation ?? data.ma60Deviation,
        sh_ma60_deviation: data.sh_ma60_deviation ?? data.shMa60Deviation,
        cyb_ma60_deviation: data.cyb_ma60_deviation ?? data.cybMa60Deviation,
        kcb_ma60_deviation: data.kcb_ma60_deviation ?? data.kcbMa60Deviation,
        main_fund_flow: data.main_fund_flow ?? data.mainFundFlow,
        north_fund_flow: data.north_fund_flow ?? data.northFundFlow,
        sector: data.sector_rank ?? data.sectorRanking ?? data.sector ?? [],
        source: data.source || 'user-input',
        update_time: (data.update_time ?? data.updateTime) || new Date().toISOString(),
        is_real_data: data.is_real_data ?? data.isRealData ?? true,
      };
    }
    
    // 尝试读取 akshare 数据
    const aksharePath = path.join(process.cwd(), 'public/market-data/latest.json');
    if (fs.existsSync(aksharePath)) {
      const content = fs.readFileSync(aksharePath, 'utf-8');
      const data = JSON.parse(content);
      // akshare 数据是 K 线数据，需要转换
      return null;
    }
    
    return null;
  } catch (error) {
    console.error('Error reading market data from file:', error);
    return null;
  }
}

/**
 * 根据日期获取市场数据
 */
export async function getMarketDataByDate(date: string): Promise<MarketDataRecord | null> {
  const dbPool = getPool();
  if (!dbPool) {
    return null;
  }
  
  try {
    const result = await dbPool.query(
      'SELECT * FROM market_data WHERE trade_date = $1',
      [date]
    );
    
    if (result.rows.length === 0) {
      return null;
    }
    
    return result.rows[0];
  } catch (error) {
    console.error('Error fetching market data by date:', error);
    return null;
  }
}

/**
 * 根据日期范围获取市场数据
 */
export async function getMarketDataByDateRange(
  startDate: string,
  endDate: string
): Promise<MarketDataRecord[]> {
  const dbPool = getPool();
  if (!dbPool) {
    return [];
  }
  
  try {
    const result = await dbPool.query(
      'SELECT * FROM market_data WHERE trade_date >= $1 AND trade_date <= $2 ORDER BY trade_date ASC',
      [startDate, endDate]
    );
    return result.rows;
  } catch (error) {
    console.error('Error fetching market data by date range:', error);
    return [];
  }
}

/**
 * 保存市场数据到数据库
 */
export async function saveMarketData(data: {
  trade_date: string;
  turnover?: number | null;
  advance?: number | null;
  decline?: number | null;
  limit_up?: number | null;
  limit_down?: number | null;
  limit_up_rate?: number | null;
  ma60_deviation?: number | null;
  main_fund_flow?: number | null;
  north_fund_flow?: number | null;
  sector?: any;
  source?: string | null;
  update_time?: string;
  is_real_data?: boolean | null;
}): Promise<boolean> {
  const dbPool = getPool();
  if (!dbPool) {
    console.error('Database pool not available');
    return false;
  }
  
  try {
    await dbPool.query(
      `INSERT INTO market_data (
        trade_date, turnover, advance, decline, limit_up, limit_down,
        limit_up_rate, ma60_deviation, main_fund_flow, north_fund_flow,
        sector, source, update_time, is_real_data
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
      )
      ON CONFLICT (trade_date) DO UPDATE SET
        turnover = EXCLUDED.turnover,
        advance = EXCLUDED.advance,
        decline = EXCLUDED.decline,
        limit_up = EXCLUDED.limit_up,
        limit_down = EXCLUDED.limit_down,
        limit_up_rate = EXCLUDED.limit_up_rate,
        ma60_deviation = EXCLUDED.ma60_deviation,
        main_fund_flow = EXCLUDED.main_fund_flow,
        north_fund_flow = EXCLUDED.north_fund_flow,
        sector = EXCLUDED.sector,
        source = EXCLUDED.source,
        update_time = EXCLUDED.update_time,
        is_real_data = EXCLUDED.is_real_data`,
      [
        data.trade_date,
        data.turnover || null,
        data.advance || null,
        data.decline || null,
        data.limit_up || null,
        data.limit_down || null,
        data.limit_up_rate || null,
        data.ma60_deviation || null,
        data.main_fund_flow || null,
        data.north_fund_flow || null,
        data.sector ? JSON.stringify(data.sector) : null,
        data.source || null,
        data.update_time || new Date().toISOString(),
        data.is_real_data ?? true,
      ]
    );
    
    return true;
  } catch (error) {
    console.error('Error saving market data:', error);
    return false;
  }
}

/**
 * 关闭数据库连接池
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

/**
 * 批量插入事件数据
 */
export async function insertEvents(events: Array<{
  event_date: string;
  event_type: string;
  title: string;
  summary?: string;
}>): Promise<void> {
  const dbPool = getPool();
  if (!dbPool) {
    throw new Error('数据库连接不可用');
  }
  
  for (const event of events) {
    await dbPool.query(
      `INSERT INTO investment_events (event_date, event_type, title, summary)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT DO NOTHING`,
      [event.event_date, event.event_type, event.title, event.summary || null]
    );
  }
}
