'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { TrendingUp, TrendingDown, Newspaper } from 'lucide-react'

interface CLSDataProps {
  date: string
}

interface CLSReview {
  url: string
  content: string
  indices: {
    sh: number
    sz: number
    cyb: number
  }
  volume: string
  hot_sectors: string[]
  weak_sectors: string[]
}

interface CLSData {
  review: CLSReview
}

export function CLSReviewCard({ date }: CLSDataProps) {
  const [data, setData] = useState<CLSData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchData() {
      try {
        const response = await fetch(`/api/cls-data?date=${date}&type=review`)
        const result = await response.json()
        
        if (result.success) {
          setData(result.data)
        } else {
          setError(result.error)
        }
      } catch (err) {
        setError('获取数据失败')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [date])

  if (loading) {
    return (
      <Card className="bg-surface border-border">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-surface rounded w-1/3"></div>
            <div className="h-3 bg-surface rounded w-full"></div>
            <div className="h-3 bg-surface rounded w-5/6"></div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !data?.review) {
    return (
      <Card className="bg-surface border-border">
        <CardContent className="p-6">
          <p className="text-text-muted text-sm">暂无财联社数据</p>
        </CardContent>
      </Card>
    )
  }

  const { review } = data
  const { indices, volume, hot_sectors, weak_sectors, content, url } = review

  return (
    <Card className="bg-surface border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-medium text-text-primary flex items-center gap-2">
            <Newspaper className="w-4 h-4 text-warning" />
            财联社每日收评
          </CardTitle>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-text-muted hover:text-warning transition-colors"
          >
            查看原文 →
          </a>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 指数表现 */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <div className="text-xs text-text-muted mb-1">上证指数</div>
            <div className={`text-sm font-semibold font-data ${indices.sh >= 0 ? 'text-danger' : 'text-success'}`}>
              {indices.sh >= 0 ? '+' : ''}{indices.sh}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-text-muted mb-1">深证成指</div>
            <div className={`text-sm font-semibold font-data ${indices.sz >= 0 ? 'text-danger' : 'text-success'}`}>
              {indices.sz >= 0 ? '+' : ''}{indices.sz}%
            </div>
          </div>
          <div className="text-center">
            <div className="text-xs text-text-muted mb-1">创业板指</div>
            <div className={`text-sm font-semibold font-data ${indices.cyb >= 0 ? 'text-danger' : 'text-success'}`}>
              {indices.cyb >= 0 ? '+' : ''}{indices.cyb}%
            </div>
          </div>
        </div>

        {/* 成交额 */}
        <div className="text-center py-2 border-t border-b border-border">
          <span className="text-xs text-text-muted">成交额：</span>
          <span className="text-sm font-medium font-data text-text-primary">{volume}</span>
        </div>

        {/* 热点板块 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-3 h-3 text-danger" />
            <span className="text-xs text-text-muted">强势板块</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {hot_sectors.map((sector) => (
              <Badge
                key={sector}
                variant="secondary"
                className="bg-danger/10 text-danger border-danger/20 text-xs"
              >
                {sector}
              </Badge>
            ))}
          </div>
        </div>

        {/* 弱势板块 */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-3 h-3 text-success" />
            <span className="text-xs text-text-muted">弱势板块</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {weak_sectors.map((sector) => (
              <Badge
                key={sector}
                variant="secondary"
                className="bg-success/10 text-success border-success/20 text-xs"
              >
                {sector}
              </Badge>
            ))}
          </div>
        </div>

        {/* 收评摘要 */}
        <div className="pt-2 border-t border-border">
          <p className="text-xs text-text-secondary leading-relaxed line-clamp-4">
            {content}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
