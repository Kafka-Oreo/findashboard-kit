'use client';

import ReactECharts from 'echarts-for-react';
import type { ChartData } from '@/lib/types';
import { useMemo, memo, useEffect, useState } from "react";
import { useChartTheme } from "@/lib/ThemeContext";
import { filterLadderHistoryTradingDays, filterThermoTradingDays, filterLimitsTradingDays, filterFundsTradingDays } from '@/lib/utils';

/** Convert a hex color string to rgba with the given alpha */
function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** 成交量格式化（单位：亿股 */
function formatVolume(vol: number | undefined | null): string {
  if (!vol) return '—';
  return (vol / 100000000).toFixed(2) + '亿股';
}

/** 成交额格式化（单位：亿元） */
function formatAmount(amt: number | undefined | null): string {
  if (!amt) return '—';
  return (amt / 100000000).toFixed(2) + '亿元';
}

/** 成交额简称（亿/万亿） */
function formatShortAmount(amt: number | undefined | null): string {
  if (!amt) return '—';
  if (amt >= 1000000000000) {
    return (amt / 1000000000000).toFixed(2) + '万亿';
  }
  return (amt / 100000000).toFixed(0) + '亿';
}

/** 计算近5日累计涨跌幅（复利） */
function calc5dChange(history: { close: number }[]): number {
  if (!history || history.length < 2) return 0;
  const first = history[0].close;
  const last = history[history.length - 1].close;
  if (first === 0) return 0;
  return ((last - first) / first) * 100;
}


export const ThermoChart = memo(function ThermoChart({ data }: { data: ChartData }) {
  const { thermoHistory } = data;
  const theme = useChartTheme();

  // Pure data computation — only recalculates when data changes
  const { dates, temps } = useMemo(() => {
    // 先过滤非交易日
    const filtered = filterThermoTradingDays(thermoHistory);
    return {
      dates: filtered.dates.slice(-5),
      temps: filtered.temps.slice(-5),
    };
  }, [thermoHistory]);

  // Option assembly — recalculates when theme or data changes
  const option = useMemo(() => ({
    animation: false,
    tooltip: {
      trigger: 'axis',
      ...theme.tooltip,
      formatter: (params: any) => {
        const val = params[0]?.value ?? 0;
        const sign = val > 0 ? '+' : '';
        return `${params[0].name}<br/>温度：${sign}${val}°`;
      },
    },
    grid: { left: 40, right: 20, top: 16, bottom: 28 },
    xAxis: { type: 'category', data: dates, ...theme.axis },
    yAxis: {
      type: 'value',
      name: '温度°',
      nameTextStyle: { color: theme.labelColor, fontSize: 10 },
      min: -60,
      max: 60,
      splitLine: theme.split,
      axisLabel: { color: theme.axisColor, fontSize: 10 },
    },
    series: [
      {
        type: 'line',
        data: temps,
        smooth: true,
        symbol: 'circle',
        symbolSize: (val: number) => (val >= 30 || val <= -50 ? 12 : 8),
        lineStyle: {
          width: 3,
          shadowBlur: 10,
          shadowColor: hexToRgba(theme.theme.red, 0.5),
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 1, y2: 0,
            colorStops: [
              { offset: 0, color: theme.theme.blue },
              { offset: 0.5, color: theme.theme.yellow },
              { offset: 0.85, color: theme.theme.blue },
              { offset: 1, color: theme.theme.red },
            ],
          },
        },
        itemStyle: {
          color: (p: { value: number }) =>
            p.value >= 25 ? theme.theme.red : p.value >= 0 ? theme.theme.yellow : p.value >= -25 ? theme.theme.blue : theme.theme.blue,
          shadowBlur: 8,
          shadowColor: (p: { value: number }) =>
            p.value >= 25 ? hexToRgba(theme.theme.red, 0.6) : p.value >= 0 ? hexToRgba(theme.theme.yellow, 0.6) : hexToRgba(theme.theme.blue, 0.6),
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(theme.theme.red, 0.2) },
              { offset: 0.5, color: hexToRgba(theme.theme.yellow, 0.1) },
              { offset: 1, color: hexToRgba(theme.theme.blue, 0.05) },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { type: 'dashed', width: 1 },
          data: [
            { yAxis: -50, lineStyle: { color: theme.theme.blue }, label: { formatter: '冰点 -50°', color: theme.theme.blue, fontSize: 9, position: 'insideEndTop' } },
            { yAxis: 0, lineStyle: { color: theme.axisColor }, label: { formatter: '中性 0°', color: theme.textColor, fontSize: 9, position: 'insideEndTop' } },
          ],
        },
      },
    ],
  }), [theme, dates, temps]);

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 140 }}
      option={option}
    />
  );
});

// 均线偏离率K线图
// 上证指数近10日K线 + MA均线 + 偏离率合并图表
export const KlineVolumeChart = memo(function KlineVolumeChart({ data, ma60 }: { data: ChartData; ma60?: number }) {
  const theme = useChartTheme();
  const { kline } = data;

  // Pure data computation — MA, deviation, slicing
  const computed = useMemo(() => {
    if (!kline || !kline.data || kline.data.length === 0) return null;

    const closes = kline.data.map(d => d[2]);
    const ma5: (number | null)[] = [];
    const ma10: (number | null)[] = [];
    const ma20: (number | null)[] = [];

    for (let i = 0; i < closes.length; i++) {
      if (i >= 4) {
        const sum = closes.slice(i - 4, i + 1).reduce((a, b) => a + b, 0);
        ma5.push(+(sum / 5).toFixed(2));
      } else {
        ma5.push(null);
      }
      if (i >= 9) {
        const sum = closes.slice(i - 9, i + 1).reduce((a, b) => a + b, 0);
        ma10.push(+(sum / 10).toFixed(2));
      } else {
        ma10.push(null);
      }
      if (i >= 19) {
        const sum = closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0);
        ma20.push(+(sum / 20).toFixed(2));
      } else {
        ma20.push(null);
      }
    }

    const deviationMA5 = closes.map((c, i) => ma5[i] ? +(((c - ma5[i]!) / ma5[i]!) * 100).toFixed(2) : null);
    const deviationMA10 = closes.map((c, i) => ma10[i] ? +(((c - ma10[i]!) / ma10[i]!) * 100).toFixed(2) : null);
    const deviationMA20 = closes.map((c, i) => ma20[i] ? +(((c - ma20[i]!) / ma20[i]!) * 100).toFixed(2) : null);

    const displayCount = 10;
    const ma60Value = ma60 ?? 3623;

    return {
      displayDates: kline.dates.slice(-displayCount),
      displayKlineData: kline.data.slice(-displayCount),
      displayMA5: ma5.slice(-displayCount),
      displayMA10: ma10.slice(-displayCount),
      displayMA20: ma20.slice(-displayCount),
      displayDeviationMA5: deviationMA5.slice(-displayCount),
      displayDeviationMA10: deviationMA10.slice(-displayCount),
      displayDeviationMA20: deviationMA20.slice(-displayCount),
      closesLen: closes.length,
      ma60Value,
    };
  }, [kline, ma60]);

  // Option assembly — depends on theme + computed data
  const option = useMemo(() => {
    if (!computed) return null;
    const {
      displayDates, displayKlineData, displayMA5, displayMA10, displayMA20,
      displayDeviationMA5, displayDeviationMA10, displayDeviationMA20,
      closesLen, ma60Value,
    } = computed;

    return {
      animation: false,
      tooltip: { trigger: 'axis', ...theme.tooltip },
      legend: {
        data: ['K线', 'MA5', 'MA10', 'MA20'],
        textStyle: { color: theme.textColor, fontSize: 11 },
        top: 0,
      },
      grid: [
        { left: 50, right: 50, top: 35, height: '55%' },
        { left: 50, right: 50, top: '65%', height: '25%' },
      ],
      xAxis: [
        { type: 'category', data: displayDates, ...theme.axis, gridIndex: 0, axisLabel: { show: false } },
        { type: 'category', data: displayDates, ...theme.axis, gridIndex: 1 },
      ],
      yAxis: [
        {
          type: 'value',
          name: '指数',
          nameTextStyle: { color: theme.labelColor, fontSize: 10 },
          splitLine: theme.split,
          axisLabel: { color: theme.axisColor, fontSize: 10 },
          gridIndex: 0,
        },
        {
          type: 'value',
          name: '偏离率(%)',
          nameTextStyle: { color: theme.labelColor, fontSize: 10 },
          splitLine: theme.split,
          axisLabel: {
            color: theme.axisColor,
            fontSize: 10,
            formatter: '{value}%',
          },
          gridIndex: 1,
        },
      ],
      series: [
        {
          name: 'K线',
          type: 'candlestick',
          data: displayKlineData,
          xAxisIndex: 0,
          yAxisIndex: 0,
          itemStyle: { color: theme.theme.red, color0: theme.theme.green, borderColor: theme.theme.red, borderColor0: theme.theme.green },
        },
        {
          name: 'MA5',
          type: 'line',
          data: displayMA5,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: theme.theme.yellow, width: 1.5 },
          connectNulls: false,
        },
        {
          name: 'MA10',
          type: 'line',
          data: displayMA10,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: theme.theme.blue, width: 1.5 },
          connectNulls: false,
        },
        {
          name: 'MA20',
          type: 'line',
          data: displayMA20,
          xAxisIndex: 0,
          yAxisIndex: 0,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: theme.theme.purple, width: 1.5 },
          connectNulls: false,
        },
        {
          name: 'MA5偏离率',
          type: 'line',
          data: displayDeviationMA5,
          xAxisIndex: 1,
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: theme.theme.yellow, width: 1.5, type: 'dashed' },
          itemStyle: { color: theme.theme.yellow },
          connectNulls: false,
        },
        {
          name: 'MA10偏离率',
          type: 'line',
          data: displayDeviationMA10,
          xAxisIndex: 1,
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: theme.theme.blue, width: 1.5, type: 'dashed' },
          itemStyle: { color: theme.theme.blue },
          connectNulls: false,
        },
        {
          name: 'MA20偏离率',
          type: 'line',
          data: displayDeviationMA20,
          xAxisIndex: 1,
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 4,
          lineStyle: { color: theme.theme.purple, width: 1.5, type: 'dashed' },
          itemStyle: { color: theme.theme.purple },
          connectNulls: false,
        },
        {
          name: 'MA60压力位',
          type: 'line',
          data: Array.from({ length: closesLen }, () => ma60Value),
          xAxisIndex: 0,
          yAxisIndex: 0,
          symbol: 'none',
          lineStyle: { color: theme.axisColor, width: 1, type: 'dotted' },
          tooltip: { show: false },
        },
      ],
      graphic: ma60Value ? [
        {
          type: 'text',
          left: 'right',
          top: '48%',
          style: {
            text: `MA60(${ma60Value})压力位`,
            fill: theme.axisColor,
            fontSize: 10,
          },
        },
      ] : [],
    };
  }, [theme, computed]);

  if (!computed) return null;

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 280 }}
      option={option!}
    />
  );
});

// 上证/深证成交量折线图
export const IndexVolumesChart = memo(function IndexVolumesChart({ data }: { data: ChartData }) {
  const { indexVolumes } = data;
  const theme = useChartTheme();

  const computed = useMemo(() => {
    if (!indexVolumes) return null;
    return {
      dates: indexVolumes.dates,
      shanghai: indexVolumes.shanghai,
      shenzhen: indexVolumes.shenzhen,
    };
  }, [indexVolumes]);

  const option = useMemo(() => {
    if (!computed) return null;
    const { dates, shanghai, shenzhen } = computed;
    return {
      animation: false,
      tooltip: { trigger: 'axis', ...theme.tooltip },
      legend: { data: ['上证指数', '深证成指'], textStyle: { color: theme.textColor, fontSize: 11 }, top: 0 },
      grid: { left: 50, right: 20, top: 30, bottom: 28 },
      xAxis: { type: 'category', data: dates, ...theme.axis },
      yAxis: {
        type: 'value',
        name: '成交量(亿)',
        nameTextStyle: { color: theme.labelColor, fontSize: 10 },
        splitLine: theme.split,
        axisLabel: { color: theme.axisColor, fontSize: 10 },
      },
      series: [
        {
          name: '上证指数',
          type: 'line',
          data: shanghai,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: theme.theme.red, width: 2 },
          itemStyle: { color: theme.theme.red },
        },
        {
          name: '深证成指',
          type: 'line',
          data: shenzhen,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { color: theme.theme.blue, width: 2 },
          itemStyle: { color: theme.theme.blue },
        },
      ],
    };
  }, [theme, computed]);

  if (!computed) return null;

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 180 }}
      option={option!}
    />
  );
});

export const KlineChart = memo(function KlineChart({ data }: { data: ChartData }) {
  const { kline } = data;

  const theme = useChartTheme();

  const computed = useMemo(() => ({
    dates: kline.dates,
    klineData: kline.data,
  }), [kline]);

  const option = useMemo(() => ({
    animation: false,
    tooltip: {
      trigger: 'axis',
      ...theme.tooltip,
      formatter: (params: Array<{ seriesName: string; value: number; marker: string }>) => {
        if (!Array.isArray(params)) return '';
        return params
          .map((p) => {
            const val = p.seriesName === '情绪温度' && p.value > 0 ? `+${p.value}` : `${p.value}`;
            return `${p.marker} ${p.seriesName}：${val}`;
          })
          .join('<br/>');
      },
    },
    grid: { left: 50, right: 10, top: 10, bottom: 24 },
    xAxis: { type: 'category', data: computed.dates, ...theme.axis },
    yAxis: { type: 'value', min: 3600, max: 3950, splitLine: theme.split, axisLabel: { color: theme.axisColor, fontSize: 10 } },
    series: [
      {
        type: 'candlestick',
        data: computed.klineData,
        itemStyle: { color: theme.theme.red, color0: theme.theme.green, borderColor: theme.theme.red, borderColor0: theme.theme.green },
      },
    ],
  }), [theme, computed]);

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 130 }}
      option={option}
    />
  );
});

export const IntradayChart = memo(function IntradayChart({ data }: { data: ChartData }) {
  const { intraday } = data;
  const theme = useChartTheme();

  const computed = useMemo(() => ({
    times: intraday.times,
    prices: intraday.prices,
    yMin: Math.min(...intraday.prices) - 30,
    yMax: Math.max(...intraday.prices) + 20,
    prevClose: intraday.prevClose,
  }), [intraday]);

  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis', ...theme.tooltip },
    grid: { left: 48, right: 10, top: 10, bottom: 24 },
    xAxis: { type: 'category', data: computed.times, ...theme.axis },
    yAxis: { type: 'value', min: computed.yMin, max: computed.yMax, splitLine: theme.split, axisLabel: { color: theme.axisColor, fontSize: 9 } },
    series: [
      {
        type: 'line',
        data: computed.prices,
        smooth: true,
        lineStyle: { color: theme.theme.red, width: 2 },
        itemStyle: { color: theme.theme.red },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: hexToRgba(theme.theme.red, 0.15) },
              { offset: 1, color: hexToRgba(theme.theme.red, 0) },
            ],
          },
        },
        markLine: {
          silent: true,
          symbol: 'none',
          data: [
            {
              yAxis: computed.prevClose,
              lineStyle: { color: theme.axisColor, type: 'dashed' },
              label: { formatter: `昨收 ${computed.prevClose}`, color: theme.labelColor, fontSize: 9 },
            },
          ],
        },
      },
    ],
  }), [theme, computed]);

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 160 }}
      option={option}
    />
  );
});

// 盘中异动板块图表
export const IntradaySectorsChart = memo(function IntradaySectorsChart({ data }: { data: ChartData }) {
  const { intradaySectors } = data;
  const theme = useChartTheme();
  const [selectedSector, setSelectedSector] = useState<{
    name: string;
    time: string;
    change: number;
    upCount: number;
    downCount: number;
  } | null>(null);

  // Pure data computation — structural scatter data without theme colors
  const computed = useMemo(() => {
    if (!intradaySectors || !intradaySectors.sectors || intradaySectors.sectors.length === 0) return null;

    const { times, sectors } = intradaySectors;

    // Build raw scatter data (theme-independent)
    const rawScatter = sectors.map((s) => ({
      x: times.indexOf(s.time),
      y: s.change,
      name: s.name,
      isPositive: s.change >= 0,
      upCount: s.upCount ?? 0,
      downCount: s.downCount ?? 0,
      totalCount: (s.upCount ?? 0) + (s.downCount ?? 0),
    }));

    return { times, rawScatter };
  }, [intradaySectors]);

  // Option assembly — applies theme colors to pre-computed structural data
  const option = useMemo(() => {
    if (!computed) return null;
    const { times, rawScatter } = computed;

    const maxTotal = Math.max(...rawScatter.map((s) => s.totalCount), 1);

    const scatterData = rawScatter.map((s) => ({
      value: [s.x, s.y, s.name, s.upCount, s.downCount, s.totalCount] as [number, number, string, number, number, number],
      itemStyle: {
        color: s.isPositive ? theme.theme.red : theme.theme.green,
      },
    }));

    return {
      animation: false,
      tooltip: {
        ...theme.tooltip,
        formatter: (params: any) => {
          const [x, y, name, upCount, downCount] = params.value;
          return `${name}<br/>${times[x]}<br/>涨跌幅: ${y > 0 ? '+' : ''}${y.toFixed(2)}%<br/>上涨: ${upCount}家 / 下跌: ${downCount}家`;
        },
      },
      grid: { left: 50, right: 10, top: 20, bottom: 30 },
      xAxis: {
        type: 'category',
        data: times,
        ...theme.axis,
        axisLabel: { color: theme.axisColor, fontSize: 9, rotate: 0 },
      },
      yAxis: {
        type: 'value',
        name: '涨跌幅%',
        nameTextStyle: { color: theme.labelColor, fontSize: 9 },
        splitLine: theme.split,
        axisLabel: { color: theme.axisColor, fontSize: 9, formatter: '{value}%' },
      },
      series: [
        {
          type: 'scatter',
          data: scatterData,
          symbolSize: (val: number[]) => {
            const totalCount = val[5] || 1;
            const ratio = totalCount / maxTotal;
            return Math.max(12, Math.min(35, ratio * 25 + 10));
          },
          label: {
            show: true,
            position: 'top',
            formatter: (params: any) => params.value[2],
            color: theme.textColor,
            fontSize: 9,
            fontWeight: 600,
          },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowColor: hexToRgba(theme.textColor, 0.3),
            },
          },
        },
      ],
    };
  }, [theme, computed]);

  const handleChartClick = (params: any) => {
    if (params.componentType === 'series' && computed) {
      const [, , name, upCount, downCount] = params.value;
      const sector = computed.rawScatter.find((s) => s.name === name);
      if (sector) {
        setSelectedSector({
          name: sector.name,
          time: computed.times[sector.x],
          change: sector.y,
          upCount: sector.upCount,
          downCount: sector.downCount,
        });
      }
    }
  };

  if (!computed) {
    return (
      <div className="flex h-[160px] items-center justify-center text-xs" style={{ color: theme.labelColor }}>
        暂无盘中异动数据
      </div>
    );
  }

  return (
    <div className="relative">
      <ReactECharts
        opts={{ renderer: "canvas" }}
        notMerge={true}
        lazyUpdate={false}
        style={{ height: 160 }}
        option={option!}
        onEvents={{ click: handleChartClick }}
      />
      {selectedSector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setSelectedSector(null)}
        >
          <div
            className="rounded-lg p-5 text-center max-w-sm w-full"
            style={{ backgroundColor: theme.isDark ? '#1d1d1f' : '#ffffff', border: `1px solid ${theme.isDark ? '#424245' : '#d2d2d7'}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-sm font-bold" style={{ color: theme.textColor }}>
              {selectedSector.name}
            </div>
            <div className="mt-1 text-xs" style={{ color: theme.labelColor }}>
              {selectedSector.time} · 涨跌幅 {selectedSector.change > 0 ? '+' : ''}{selectedSector.change.toFixed(2)}%
            </div>
            
            {/* 上涨/下跌 比例条 */}
            <div className="mt-4">
              <div className="text-xs mb-2" style={{ color: theme.labelColor }}>
                上涨/下跌 比例
              </div>
              <div className="flex h-6 rounded-full overflow-hidden" style={{ backgroundColor: theme.isDark ? '#2a2a2c' : '#f0f0f0' }}>
                <div
                  className="flex items-center justify-center text-xs font-bold text-white transition-all"
                  style={{
                    width: `${(selectedSector.upCount / (selectedSector.upCount + selectedSector.downCount)) * 100}%`,
                    backgroundColor: theme.theme.red,
                  }}
                >
                  {selectedSector.upCount}
                </div>
                <div
                  className="flex items-center justify-center text-xs font-bold text-white transition-all"
                  style={{
                    width: `${(selectedSector.downCount / (selectedSector.upCount + selectedSector.downCount)) * 100}%`,
                    backgroundColor: theme.theme.green,
                  }}
                >
                  {selectedSector.downCount}
                </div>
              </div>
            </div>

            <div className="mt-4 flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: theme.theme.red }}>
                  {selectedSector.upCount}
                </div>
                <div className="text-xs" style={{ color: theme.labelColor }}>
                  上涨家数
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold" style={{ color: theme.theme.green }}>
                  {selectedSector.downCount}
                </div>
                <div className="text-xs" style={{ color: theme.labelColor }}>
                  下跌家数
                </div>
              </div>
            </div>
            
            <div className="mt-3 text-xs" style={{ color: theme.labelColor }}>
              涨跌比 {selectedSector.upCount}:{selectedSector.downCount} · 共 {selectedSector.upCount + selectedSector.downCount} 家
            </div>
            
            <div className="mt-2 text-xs" style={{ color: theme.labelColor }}>
              点击空白处关闭
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export const SectorChart = memo(function SectorChart({ data }: { data: ChartData }) {
  const theme = useChartTheme();
  const { sectors } = data;
  const [selectedSector, setSelectedSector] = useState<string | null>(null);
  const [sectorCons, setSectorCons] = useState<any>(null);
  const [sectorChange, setSectorChange] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const computed = useMemo(() => {
    // 分离涨跌板块并排序
    const rising = sectors.names
      .map((name, i) => ({ name, change: sectors.changes[i] }))
      .filter((s) => s.change > 0)
      .sort((a, b) => b.change - a.change);

    const falling = sectors.names
      .map((name, i) => ({ name, change: sectors.changes[i] }))
      .filter((s) => s.change < 0)
      .sort((a, b) => a.change - b.change);

    // 合并：涨幅靠前在上，跌幅靠前在下
    const sorted = [...rising, ...falling];

    return {
      names: sorted.map((s) => s.name),
      changes: sorted.map((s) => s.change),
    };
  }, [sectors]);

  const handleBarClick = async (params: { name: string; change?: number }) => {
    const sectorName = params.name;
    const change = params.change;
    setSelectedSector(sectorName);
    setSectorChange(change ?? null);
    setLoading(true);
    // 重置旧数据，避免展示上一次的缓存内容
    setSectorCons(null);
    try {
      // 强制刷新：添加时间戳跳过浏览器缓存，后端也会禁用本地历史缓存，直连实时接口
      const sectorChangeParam = change !== undefined && change !== null ? `&sectorChange=${change}` : '';
      const res = await fetch(`/api/sector-cons?sector=${encodeURIComponent(sectorName)}&force=1&_t=${Date.now()}${sectorChangeParam}`);
      const result = await res.json();
      if (result.success && result.data && Array.isArray(result.data.stocks) && result.data.stocks.length > 0) {
        setSectorCons(result.data);
      } else {
        setSectorCons({ error: result.error || '板块个股行情加载失败，请刷新页面' });
      }
    } catch (err) {
      console.error('获取板块成份股失败:', err);
      setSectorCons({ error: '板块个股行情加载失败，请刷新页面' });
    } finally {
      setLoading(false);
    }
  };

  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis', ...theme.tooltip },
    grid: { left: 90, right: 60, top: 10, bottom: 24 },
    xAxis: {
      type: 'value',
      splitLine: theme.split,
      axisLabel: { color: theme.axisColor, fontSize: 9, formatter: '{value}%' },
      min: -3,
      max: 5,
      interval: 1,
    },
    yAxis: {
      type: 'category',
      data: computed.names,
      ...theme.axis,
      axisLabel: {
        color: theme.axisColor,
        fontSize: 10,
        interval: 0,
      },
    },
    series: [
      {
        type: 'bar',
        data: computed.changes.map((v) => ({
          value: v,
          itemStyle: { color: v >= 0 ? theme.theme.red : theme.theme.green },
          label: {
            show: true,
            position: 'right',
            color: v >= 0 ? theme.theme.red : theme.theme.green,
            fontSize: 10,
            fontWeight: 700,
            formatter: () => (v > 0 ? '+' : '') + v.toFixed(2) + '%',
          },
        })),
        barWidth: '55%',
        label: { show: false },
      },
    ],
  }), [theme, computed]);

  const chartHeight = Math.max(160, computed.names.length * 20 + 40);

  // 成分股：领涨/领跌各取前 10，避免只显示涨幅榜造成的幸存者偏差
  const consStocks: any[] = Array.isArray(sectorCons?.stocks) ? sectorCons.stocks : [];
  const topGainers = [...consStocks].sort((a, b) => b.change - a.change).slice(0, 10);
  const topLosers = [...consStocks].sort((a, b) => a.change - b.change).slice(0, 10);
  const consUpCount: number =
    typeof sectorCons?.upCount === "number"
      ? sectorCons.upCount
      : consStocks.filter((s) => s.change > 0).length;
  const consDownCount: number =
    typeof sectorCons?.downCount === "number"
      ? sectorCons.downCount
      : consStocks.filter((s) => s.change < 0).length;
  const consTotalCount: number =
    typeof sectorCons?.totalCount === "number" ? sectorCons.totalCount : consStocks.length;

  const renderConsStock = (stock: any, idx: number) => (
    <div
      key={`${stock.code}-${idx}`}
      className="flex items-center justify-between py-1.5 px-2 rounded"
      style={{ backgroundColor: theme.isDark ? "#2a2a2c" : "#f5f5f7" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-medium" style={{ color: theme.textColor }}>
          {stock.name}
        </span>
        <span className="text-[10px]" style={{ color: theme.axisColor }}>
          {stock.code}
        </span>
      </div>
      <div className="flex items-center gap-3">
        {stock.change !== null && stock.change !== undefined && (
          <span
            className="text-[11px] font-bold"
            style={{ color: stock.change >= 0 ? theme.theme.red : theme.theme.green }}
          >
            {stock.change >= 0 ? "+" : ""}{Number(stock.change).toFixed(2)}%
          </span>
        )}
        {stock.price !== null && stock.price !== undefined && (
          <span className="text-[10px]" style={{ color: theme.axisColor }}>
            ¥{Number(stock.price).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <>
      <ReactECharts
        opts={{ renderer: "canvas" }}
        notMerge={true}
        lazyUpdate={false}
        style={{ height: chartHeight }}
        option={option}
        onEvents={{
          click: (params: { name: string; value?: number }) => {
            if (params.name) {
              const idx = computed.names.indexOf(params.name);
              const change = idx >= 0 ? computed.changes[idx] : undefined;
              handleBarClick({ name: params.name, change });
            }
          },
        }}
      />
      {selectedSector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setSelectedSector(null)}
        >
          <div
            className="rounded-lg p-6 max-w-md w-full"
            style={{ backgroundColor: theme.isDark ? '#1d1d1f' : '#ffffff', border: `1px solid ${theme.isDark ? '#424245' : '#d2d2d7'}` }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* 顶部：板块名称 + 当日涨幅（弹窗打开立刻展示） */}
            <div className="text-center mb-4">
              <div className="text-[28px] font-bold tracking-tight" style={{ color: theme.textColor }}>
                {selectedSector}
              </div>
              {sectorChange !== null && sectorChange !== undefined && (
                <div className="text-[20px] mt-2 font-bold" style={{ color: sectorChange >= 0 ? theme.theme.red : theme.theme.green }}>
                  板块当日涨幅：{sectorChange >= 0 ? '+' : ''}{sectorChange.toFixed(2)}%
                </div>
              )}
            </div>

            {/* 内容区：加载中 / 失败 / 个股列表 */}
            <div className="min-h-[120px]">
              {loading ? (
                <div className="text-center py-10">
                  <div className="text-[12px]" style={{ color: theme.axisColor }}>
                    成分股加载中...
                  </div>
                </div>
              ) : sectorCons && sectorCons.error ? (
                <div className="text-center py-8">
                  <div className="text-[22px] font-medium" style={{ color: theme.theme.red }}>
                    {sectorCons.error}
                  </div>
                  <div className="text-[16px] mt-4" style={{ color: theme.axisColor }}>
                    数据源：多源免费行情接口，已禁用历史缓存
                  </div>
                </div>
              ) : consStocks.length > 0 ? (
                <div className="max-h-[46vh] overflow-y-auto">
                  {/* 涨跌家数摘要：真实反映板块内部结构 */}
                  <div
                    className="flex items-center justify-center gap-3 mb-3 py-2 rounded-lg"
                    style={{ backgroundColor: theme.isDark ? "#2a2a2c" : "#f5f5f7" }}
                  >
                    <span className="text-[13px] font-bold" style={{ color: theme.theme.red }}>
                      上涨 {consUpCount} 家
                    </span>
                    <span className="text-[11px]" style={{ color: theme.axisColor }}>
                      /
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: theme.theme.green }}>
                      下跌 {consDownCount} 家
                    </span>
                    <span className="text-[11px]" style={{ color: theme.axisColor }}>
                      （共 {consTotalCount} 只成分股）
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* 领涨 */}
                    <div>
                      <div className="text-[11px] font-bold mb-1.5" style={{ color: theme.theme.red }}>
                        领涨
                      </div>
                      <div className="space-y-1">{topGainers.map(renderConsStock)}</div>
                    </div>
                    {/* 领跌 */}
                    <div>
                      <div className="text-[11px] font-bold mb-1.5" style={{ color: theme.theme.green }}>
                        领跌
                      </div>
                      <div className="space-y-1">{topLosers.map(renderConsStock)}</div>
                    </div>
                  </div>

                  <div className="text-center mt-3 text-[10px] pt-2 border-t" style={{ color: theme.axisColor, borderColor: theme.isDark ? '#424245' : '#d2d2d7' }}>
                    {sectorCons?.matchedName ? `${sectorCons.matchedName} · ` : ""}
                    数据源：
                    {sectorCons?.dataSource === "东方财富一级行业"
                      ? "东方财富行业板块实时行情"
                      : sectorCons?.dataSource === "申万一级-腾讯行情"
                        ? "申万行业成分 + 实时行情"
                        : "多源免费行情接口"}
                    ，已禁用历史缓存
                  </div>
                </div>
              ) : null}
            </div>

            {/* 底部关闭提示 */}
            <div className="text-center mt-5 text-[16px]" style={{ color: theme.axisColor }}>
              点击空白处关闭弹窗
            </div>
          </div>
        </div>
      )}
    </>
  );
});

export const FundsChart = memo(function FundsChart({ data }: { data: ChartData }) {
  const theme = useChartTheme();
  const { funds } = data;
  const [showModal, setShowModal] = useState(false);
  const [modalDate, setModalDate] = useState('');
  const [lhbData, setLhbData] = useState<any[]>([]);
  const [seatDetails, setSeatDetails] = useState<any[]>([]);
  const [blockData, setBlockData] = useState<any[]>([]);
  const [totalSeatDeals, setTotalSeatDeals] = useState(0);
  const [loading, setLoading] = useState(false);
  const [sectorFundsExpanded, setSectorFundsExpanded] = useState(false);

  const computed = useMemo(() => {
    const filtered = filterFundsTradingDays(funds);
    // 只展示最近 N 个交易日（避免横轴被历史数据拉长）
    const LAST_N = 7;
    const start = Math.max(0, filtered.dates.length - LAST_N);
    return {
      dates: filtered.dates.slice(start),
      values: filtered.values.slice(start),
    };
  }, [funds]);

  const handleChartClick = async (params: any) => {
    setShowModal(true);
    setLoading(true);
    try {
      // 根据点击的柱形索引获取对应日期
      const dateIndex = params?.dataIndex;
      const dateStr = dateIndex !== undefined ? computed.dates[dateIndex] : null;
      // 将日期格式从 "7/28" 转换为 "20260728"
      let apiDate = '';
      if (dateStr) {
        const parts = dateStr.split('/');
        const month = parts[0].padStart(2, '0');
        const day = parts[1].padStart(2, '0');
        apiDate = `2026${month}${day}`;
        setModalDate(`${parts[0]}月${parseInt(parts[1])}日`);
      } else {
        setModalDate('');
      }
      
      const dateParam = apiDate ? `&date=${apiDate}` : '';
      
      // 获取龙虎榜数据
      const lhbRes = await fetch(`/api/lhb-data?type=lhb${dateParam}`);
      const lhbJson = await lhbRes.json();
      if (lhbJson.success) {
        setLhbData(lhbJson.data.items || []);
        setSeatDetails(lhbJson.data.seat_details || []);
        setTotalSeatDeals(lhbJson.data.total_seat_deals || 0);
      }
      
      // 获取大宗交易数据
      const blockRes = await fetch(`/api/lhb-data?type=block${dateParam}`);
      const blockJson = await blockRes.json();
      if (blockJson.success) {
        // 大宗交易行去重：按"代码+成交价+成交量+买方营业部+卖方营业部"为唯一键
        const rawBlocks = blockJson.data.items || [];
        const seenBlocks = new Set<string>();
        const dedupedBlocks = rawBlocks.filter((b: any) => {
          const key = `${b.代码 || ''}_${b.成交价 || ''}_${b.成交量 || ''}_${b.买方营业部 || ''}_${b.卖方营业部 || ''}`;
          if (seenBlocks.has(key)) return false;
          seenBlocks.add(key);
          return true;
        });
        setBlockData(dedupedBlocks);
      }
    } catch (error) {
      console.error('Failed to fetch lhb data:', error);
    } finally {
      setLoading(false);
    }
  };

  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis', ...theme.tooltip },
    legend: { data: ['主力净流入'], textStyle: { color: theme.textColor, fontSize: 10 }, top: 0 },
    grid: { left: 50, right: 10, top: 28, bottom: 24 },
    xAxis: { type: 'category', data: computed.dates, ...theme.axis },
    yAxis: { type: 'value', name: '亿', nameTextStyle: { color: theme.labelColor, fontSize: 9 }, splitLine: theme.split, axisLabel: { color: theme.axisColor, fontSize: 9 } },
    series: [
      {
        name: '主力净流入',
        type: 'bar',
        data: computed.values.map((v) => ({
          value: v,
          itemStyle: { color: v >= 0 ? theme.theme.red : theme.theme.green, borderRadius: v >= 0 ? [3, 3, 0, 0] : [0, 0, 3, 3] },
        })),
        barWidth: '35%',
      },
    ],
  }), [theme, computed]);

  return (
    <>
      <div className="relative">
        <ReactECharts
          opts={{ renderer: "canvas" }}
          notMerge={true}
          lazyUpdate={false}
          style={{ height: 200, cursor: 'pointer' }}
          option={option}
          onEvents={{ click: handleChartClick }}
        />
      </div>
      
      {/* 行业资金净流入排行（默认折叠） */}
      {data.sectorFunds && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setSectorFundsExpanded(!sectorFundsExpanded)}
            className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-[var(--color-bg-muted)]"
          >
            <h4 className="text-xs font-semibold text-[var(--color-text-primary)] flex items-center gap-1.5">
              <span
                className="inline-block transition-transform duration-200"
                style={{ transform: sectorFundsExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 1.5L7 5L3 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </span>
              申万一级行业资金净流入排行
            </h4>
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              {sectorFundsExpanded
                ? `合计: ${data.sectorFunds.total >= 0 ? '+' : ''}${data.sectorFunds.total.toFixed(2)}亿 · 点击收起`
                : '点击展开'}
            </span>
          </button>
          {sectorFundsExpanded && (
            <div className="mt-2 space-y-2">
              <div>
                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">主力净流入 TOP5</div>
                {data.sectorFunds.inflow.slice(0, 5).map((item: { name: string; amount: number; change: number }) => (
                  <div key={item.name} className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--color-text-secondary)] w-20 truncate">{item.name}</span>
                    <div className="flex-1 mx-2 h-2 bg-[var(--color-bg-muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#dc2626]"
                        style={{ width: `${Math.min(Math.abs(item.amount) / 80 * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-14 text-right tabular-nums text-[#dc2626]">
                      +{item.amount.toFixed(2)}亿
                    </span>
                  </div>
                ))}
              </div>
              <div>
                <div className="text-xs text-[var(--color-text-tertiary)] mb-1">主力净流出 TOP5</div>
                {data.sectorFunds.outflow.slice(0, 5).map((item: { name: string; amount: number; change: number }) => (
                  <div key={item.name} className="flex items-center justify-between py-1">
                    <span className="text-xs text-[var(--color-text-secondary)] w-20 truncate">{item.name}</span>
                    <div className="flex-1 mx-2 h-2 bg-[var(--color-bg-muted)] rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#16a34a] ml-auto"
                        style={{ width: `${Math.min(Math.abs(item.amount) / 400 * 100, 100)}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium w-14 text-right tabular-nums text-[#16a34a]">
                      -{Math.abs(item.amount).toFixed(2)}亿
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-1 text-[10px] text-[var(--color-text-tertiary)] text-right">
                数据来源: {data.sectorFunds.source}
              </div>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: 'rgba(0, 0, 0, 0.7)' }}
          onClick={() => setShowModal(false)}
        >
          <div
            className="w-full max-w-4xl max-h-[80vh] overflow-y-auto rounded-xl p-6"
            style={{ backgroundColor: theme.isDark ? '#1d1d1f' : '#ffffff', border: `1px solid ${theme.isDark ? '#424245' : '#d2d2d7'}` }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold" style={{ color: theme.textColor }}>
                龙虎榜 & 大宗交易明细{modalDate ? `（${modalDate}）` : ''}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-2xl leading-none hover:opacity-70"
                style={{ color: theme.labelColor }}
              >
                ×
              </button>
            </div>
            
            {loading ? (
              <div className="text-center py-8" style={{ color: theme.labelColor }}>
                加载中...
              </div>
            ) : (
              <>
                {/* 龙虎榜数据 */}
                <div className="mb-6">
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: theme.textColor }}>
                    <span className="inline-block w-1 h-3 bg-primary rounded-sm" />
                    龙虎榜明细 ({lhbData.length} 只)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.isDark ? '#424245' : '#d2d2d7'}` }}>
                          <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>代码</th>
                          <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>名称</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>涨跌幅</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>净买额 (亿)</th>
                          <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>上榜原因</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          // 按股票代码去重，一只股票只展示一条记录
                          const seenCodes = new Set<string>();
                          const uniqueItems = lhbData.filter((item: any) => {
                            if (seenCodes.has(item.代码)) return false;
                            seenCodes.add(item.代码);
                            return true;
                          });
                          return uniqueItems.slice(0, 20).map((item: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: `1px solid ${theme.isDark ? '#2a2a2c' : '#f0f0f0'}` }}>
                            <td className="py-2 px-2" style={{ color: theme.textColor }}>{item.代码}</td>
                            <td className="py-2 px-2 font-medium" style={{ color: theme.textColor }}>
                              <div className="flex items-center gap-1.5">
                                <span>{item.名称}</span>
                                {item.三日上榜 && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] bg-primary/20 text-primary whitespace-nowrap">
                                    三日累计
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-2 px-2 text-right" style={{ color: item.涨跌幅 >= 0 ? theme.theme.red : theme.theme.green }}>
                              {item.涨跌幅 >= 0 ? '+' : ''}{item.涨跌幅.toFixed(2)}%
                            </td>
                            <td className="py-2 px-2 text-right" style={{ color: item.龙虎榜净买额 >= 0 ? theme.theme.red : theme.theme.green }}>
                              {(item.龙虎榜净买额 / 100000000).toFixed(2)}
                            </td>
                            <td className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>
                              <div className="flex flex-wrap gap-1">
                                {(item.上榜原因 || '').split(/、|，/).filter(Boolean).map((r: string, i: number) => (
                                  <span key={i} className="text-[11px] px-1.5 py-0.5 rounded whitespace-nowrap"
                                    style={{ background: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', color: theme.labelColor }}>
                                    {r}
                                  </span>
                                ))}
                              </div>
                            </td>
                          </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>
                
                {/* 席位明细数据 */}
                {seatDetails.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: theme.textColor }}>
                      <span className="inline-block w-1 h-3 bg-primary rounded-sm" />
                      席位明细（{totalSeatDeals} 笔）
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${theme.isDark ? '#424245' : '#d2d2d7'}` }}>
                            <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>代码</th>
                            <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>名称</th>
                            <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>营业部名称</th>
                            <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>买入 (万)</th>
                            <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>卖出 (万)</th>
                            <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>净额 (万)</th>
                            <th className="py-2 px-2 text-center" style={{ color: theme.labelColor }}>方向</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(() => {
                            // 按"股票代码+营业部名称"去重，确保同一股票下相同营业部只展示一条合并记录
                            const seenSeats = new Set<string>();
                            const uniqueSeats = seatDetails.filter((seat: any) => {
                              const key = `${seat.代码}_${seat.交易营业部名称}`;
                              if (seenSeats.has(key)) return false;
                              seenSeats.add(key);
                              return true;
                            });
                            return uniqueSeats.slice(0, 30).map((seat: any, idx: number) => (
                            <tr key={idx} style={{ borderBottom: `1px solid ${theme.isDark ? '#2a2a2c' : '#f0f0f0'}` }}>
                              <td className="py-2 px-2" style={{ color: theme.textColor }}>{seat.代码}</td>
                              <td className="py-2 px-2 font-medium" style={{ color: theme.textColor }}>{seat.名称}</td>
                              <td className="py-2 px-2 text-xs" style={{ color: theme.textColor }} title={seat.交易营业部名称}>
                                {seat.交易营业部名称}
                              </td>
                              <td className="py-2 px-2 text-right" style={{ color: theme.textColor }}>
                                {(seat.买入金额 / 10000).toFixed(0)}
                              </td>
                              <td className="py-2 px-2 text-right" style={{ color: theme.textColor }}>
                                {(seat.卖出金额 / 10000).toFixed(0)}
                              </td>
                              <td className="py-2 px-2 text-right" style={{ color: (seat.净额 || 0) >= 0 ? theme.theme.red : theme.theme.green }}>
                                {seat.净额 >= 0 ? '+' : ''}{(seat.净额 / 10000).toFixed(0)}
                              </td>
                              <td className="py-2 px-2 text-center" style={{ color: theme.labelColor }}>
                                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                  seat.方向 === '买入'
                                    ? 'bg-red-500/15 text-red-500'
                                    : 'bg-green-500/15 text-green-500'
                                }`}>
                                  {seat.方向}
                                </span>
                              </td>
                            </tr>
                            ));
                          })()}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                
                {/* 大宗交易数据 */}
                <div>
                  <h4 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ color: theme.textColor }}>
                    <span className="inline-block w-1 h-3 bg-primary rounded-sm" />
                    大宗交易明细 ({blockData.length} 条)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${theme.isDark ? '#424245' : '#d2d2d7'}` }}>
                          <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>代码</th>
                          <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>名称</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>成交价</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>收盘价</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>涨跌幅</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>溢折率</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>成交量 (万)</th>
                          <th className="py-2 px-2 text-right" style={{ color: theme.labelColor }}>成交额 (万)</th>
                          <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>买方营业部</th>
                          <th className="py-2 px-2 text-left" style={{ color: theme.labelColor }}>卖方营业部</th>
                        </tr>
                      </thead>
                      <tbody>
                        {blockData.slice(0, 30).map((item: any, idx: number) => (
                          <tr key={idx} style={{ borderBottom: `1px solid ${theme.isDark ? '#2a2a2c' : '#f0f0f0'}` }}>
                            <td className="py-2 px-2" style={{ color: theme.textColor }}>{item.证券代码}</td>
                            <td className="py-2 px-2 font-medium" style={{ color: theme.textColor }}>{item.证券简称}</td>
                            <td className="py-2 px-2 text-right font-mono" style={{ color: theme.textColor }}>{item.成交价?.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right font-mono" style={{ color: theme.textColor }}>{item.收盘价?.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right font-mono" style={{ color: (item.涨跌幅 ?? 0) >= 0 ? theme.theme.red : theme.theme.green }}>
                              {(item.涨跌幅 ?? 0) >= 0 ? '+' : ''}{item.涨跌幅?.toFixed(2)}%
                            </td>
                            <td className="py-2 px-2 text-right font-mono" style={{ color: (item.溢折率 ?? 0) >= 0 ? theme.theme.red : theme.theme.green }}>
                              {(item.溢折率 ?? 0) >= 0 ? '+' : ''}{item.溢折率?.toFixed(2)}%
                            </td>
                            <td className="py-2 px-2 text-right font-mono" style={{ color: theme.textColor }}>{item.成交量万股?.toFixed(2)}</td>
                            <td className="py-2 px-2 text-right font-mono font-semibold" style={{ color: theme.textColor }}>{item.成交额万元?.toFixed(2)}</td>
                            <td className="py-2 px-2 text-xs max-w-[160px]" style={{ color: theme.labelColor }} title={item.买方营业部}>{item.买方营业部}</td>
                            <td className="py-2 px-2 text-xs max-w-[160px]" style={{ color: theme.labelColor }} title={item.卖方营业部}>{item.卖方营业部}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {blockData.length > 30 && (
                    <p className="text-[10px] mt-2 text-center" style={{ color: theme.labelColor }}>
                      共 {blockData.length} 条，仅展示前 30 条
                    </p>
                  )}
                </div>
                
                {/* 风险提示 */}
                <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${theme.isDark ? '#424245' : '#d2d2d7'}` }}>
                  <p className="text-[10px] leading-relaxed" style={{ color: theme.labelColor }}>
                    <strong>风险提示：</strong>龙虎榜复盘仅用作工作素材，不构成任何交易建议。数据来源于东方财富官方，净买额严格区分「当日单日净额」与「三日周期累计净额」，上榜原因与交易所公示保持一致。
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
});

export const LimitsChart = memo(function LimitsChart({ data }: { data: ChartData }) {
  const theme = useChartTheme();
  const { limits } = data;

  const computed = useMemo(() => {
    // 先过滤非交易日
    const filtered = filterLimitsTradingDays(limits);
    // 只取最近 7 个交易日
    const len = filtered.dates.length;
    const start = Math.max(0, len - 7);
    const dates = filtered.dates.slice(start);
    const up = filtered.up.slice(start);
    const down = filtered.down.slice(start);
    const temps = filtered.temps.slice(start);

    const maxTemp = Math.max(...temps);
    const minTemp = Math.min(...temps);
    const padding = 10;
    const yMax = 100;
    const yMin = Math.floor((minTemp - padding) / 20) * 20;
    return {
      dates,
      up,
      down,
      temps,
      yMax,
      yMin,
    };
  }, [limits]);

  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis', ...theme.tooltip },
    legend: [
      { data: ['涨停'], textStyle: { color: theme.textColor, fontSize: 9 }, top: 0, left: 50 },
      { data: ['跌停'], textStyle: { color: theme.textColor, fontSize: 9 }, top: 0, left: 110 },
      { data: ['情绪温度'], textStyle: { color: theme.textColor, fontSize: 9 }, top: 0, right: 50 },
    ],
    grid: { left: 40, right: 40, top: 28, bottom: 24 },
    xAxis: { type: 'category', data: computed.dates, ...theme.axis },
    yAxis: [
      { type: 'value', name: '只', nameLocation: 'end', nameGap: 8, nameTextStyle: { color: theme.labelColor, fontSize: 9 }, splitLine: theme.split, axisLabel: { color: theme.axisColor, fontSize: 9 } },
      {
        type: 'value',
        name: '温度',
        nameLocation: 'end',
        nameGap: 8,
        nameTextStyle: { color: theme.labelColor, fontSize: 9 },
        min: computed.yMin,
        max: computed.yMax,
        interval: 20,
        splitLine: { show: false },
        axisLabel: {
          color: theme.axisColor,
          fontSize: 9,
          formatter: (value: number) => (value > 0 ? `+${value}` : `${value}`),
        },
      },
    ],
    series: [
      { name: '涨停', type: 'bar', data: computed.up, itemStyle: { color: theme.theme.red, borderRadius: [3, 3, 0, 0] }, barWidth: '25%' },
      { name: '跌停', type: 'bar', data: computed.down, itemStyle: { color: theme.theme.green, borderRadius: [0, 0, 3, 3] }, barWidth: '25%' },
      {
        name: '情绪温度',
        type: 'line',
        yAxisIndex: 1,
        data: computed.temps,
        smooth: true,
        lineStyle: { color: theme.theme.yellow, width: 2, type: 'dashed' },
        itemStyle: { color: theme.theme.yellow },
        symbol: 'circle',
        symbolSize: 6,
      },
    ],
  }), [theme, computed]);

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 160 }}
      option={option}
    />
  );
});

export const MatchChart = memo(function MatchChart({ data }: { data: ChartData }) {
  const theme = useChartTheme();
  const { match } = data;

  const computed = useMemo(() => ({
    names: [...match.names].reverse(),
    values: [...match.values].reverse(),
  }), [match]);

  const option = useMemo(() => ({
    animation: false,
    tooltip: { trigger: 'axis', ...theme.tooltip },
    grid: { left: 80, right: 30, top: 10, bottom: 24 },
    xAxis: { type: 'value', max: 100, splitLine: theme.split, axisLabel: { color: theme.axisColor, fontSize: 10, formatter: '{value}%' } },
    yAxis: { type: 'category', data: computed.names, ...theme.axis, axisLabel: { color: theme.textColor, fontSize: 10 } },
    series: [
      {
        type: 'bar',
        data: computed.values.map((v) => ({
          value: v,
          itemStyle: { color: v >= 80 ? theme.theme.red : v >= 50 ? theme.theme.yellow : theme.theme.green },
        })),
        barWidth: '60%',
        label: { show: true, position: 'right', color: theme.textColor, fontSize: 10, formatter: '{c}%' },
      },
    ],
  }), [theme, computed]);

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 180 }}
      option={option}
    />
  );
});

// 高标连板折线图
export const LadderChart = memo(function LadderChart({ data }: { data: ChartData }) {
  const theme = useChartTheme();
  const { ladderHistory } = data;

  const computed = useMemo(() => {
    if (!ladderHistory) return null;
    // 先过滤非交易日（周六/周日），再取最近 7 个交易日
    const filtered = filterLadderHistoryTradingDays(ladderHistory);
    const len = filtered.dates.length;
    const start = Math.max(0, len - 7);
    const dates = filtered.dates.slice(start);
    const heights = filtered.heights.slice(start);
    const stocks = filtered.stocks?.slice(start);
    const maxH = Math.max(...heights, 0);
    // 动态计算 yAxis max，向上取整到最近的 2 的倍数，并留 1-2 格余量
    const yMax = Math.ceil((maxH + 2) / 2) * 2;
    return {
      dates,
      heights,
      stocks,
      yMax,
    };
  }, [ladderHistory]);

  const option = useMemo(() => {
    if (!computed) return null;
    const stocks = computed.stocks;
    return {
      animation: false,
      tooltip: { trigger: 'axis', ...theme.tooltip, formatter: (params: any) => { const stockName = stocks?.[params[0].dataIndex]; return `${params[0].name}<br/>最高连板：${params[0].value}板${stockName ? `<br/>${stockName}` : ''}`; } },
      grid: { left: 40, right: 20, top: 10, bottom: 24 },
      xAxis: { type: 'category', data: computed.dates, ...theme.axis },
      yAxis: { type: 'value', name: '板', nameTextStyle: { color: theme.labelColor, fontSize: 9 }, min: 0, max: computed.yMax, splitLine: theme.split, axisLabel: { color: theme.axisColor, fontSize: 9 } },
      series: [
        {
          type: 'line',
          data: computed.heights,
          lineStyle: { color: theme.theme.yellow, width: 2 },
          itemStyle: { color: theme.theme.yellow },
          symbol: 'circle',
          symbolSize: 6,
          label: {
            show: true,
            position: 'top',
            formatter: '{c}板',
            color: theme.theme.yellow,
            fontSize: 11,
            fontWeight: 'bold',
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: hexToRgba(theme.theme.yellow, 0.3) },
                { offset: 1, color: hexToRgba(theme.theme.yellow, 0) },
              ],
            },
          },
        },
      ],
    };
  }, [theme, computed, data.ladderHistory?.stocks]);

  if (!computed) return null;

  return (
    <ReactECharts
      opts={{ renderer: "canvas" }}
      notMerge={true}
      lazyUpdate={false}
      style={{ height: 160 }}
      option={option!}
    />
  );
});

// 七指数涨跌幅对比图
interface IndexHistoryItem {
  date: string;
  open: number;
  close: number;
  high: number;
  low: number;
  volume?: number;
  amount?: number;
  change_pct?: number;
}

export const IndexChangesChart = memo(function IndexChangesChart({ data, date, indexDetails }: { data: ChartData; date: string; indexDetails?: { name: string; open: number; close: number; high: number; low: number; volume: number; turnover: number; change: number; date?: string }[] }) {
  const theme = useChartTheme();
  const { indexChanges } = data;
  const [selectedIndex, setSelectedIndex] = useState<string | null>(null);
  const [selectedChange, setSelectedChange] = useState<number | null>(null);
  const [indexDetail, setIndexDetail] = useState<any>(null);
  const [indexHistory, setIndexHistory] = useState<IndexHistoryItem[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailSource, setDetailSource] = useState<'live' | null>(null);
  // 批量拉取的真实七指数行情
  const [liveIndices, setLiveIndices] = useState<{
    names: string[];
    changes: number[];
    details: { name: string; open: number; close: number; high: number; low: number; volume: number; turnover: number; change: number; date?: string }[];
  } | null>(null);
  const [liveLoading, setLiveLoading] = useState(true);
  const [liveFailed, setLiveFailed] = useState(false);

  // 组件加载时自动拉取当日七个指数真实行情
  useEffect(() => {
    let cancelled = false;
    const fetchBatch = async () => {
      try {
        const res = await fetch(
          `/api/index-detail/batch?date=${date}&_t=${Date.now()}`
        );
        const json = await res.json();
        if (!cancelled && json.success && json.names?.length > 0) {
          setLiveIndices({
            names: json.names,
            changes: json.changes,
            details: json.details || [],
          });
          setLiveFailed(false);
        } else if (!cancelled) {
          setLiveFailed(true);
        }
      } catch {
        if (!cancelled) setLiveFailed(true);
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    };
    fetchBatch();
    return () => { cancelled = true; };
  }, [date]);

  // 优先用真实行情，fallback 到日报硬编码数据
  const effectiveChanges = liveIndices || indexChanges;

  const computed = useMemo(() => {
    if (!effectiveChanges) return null;
    return {
      names: [...effectiveChanges.names].reverse(),
      changes: [...effectiveChanges.changes].reverse(),
    };
  }, [effectiveChanges]);

  const fetchIndexDetail = async (indexName: string, indexChange: number) => {
    setDetailLoading(true);
    setDetailError(null);
    setIndexDetail(null);
    setIndexHistory([]);
    setDetailSource(null);
    try {
      const res = await fetch(
        `/api/index-detail?index=${encodeURIComponent(indexName)}&date=${date}&indexChange=${indexChange.toFixed(2)}&force=1&_t=${Date.now()}`
      );
      const json = await res.json();
      if (json.success) {
        setIndexDetail(json.data);
        if (json.history && Array.isArray(json.history)) {
          setIndexHistory(json.history);
        }
        setDetailSource('live');
      } else {
        setDetailError('接口暂未返回真实行情');
      }
    } catch (e) {
      setDetailError('接口暂未返回真实行情');
    } finally {
      setDetailLoading(false);
    }
  };

  const onEvents = useMemo(() => ({
    click: (params: any) => {
      if (params.componentType !== 'series') return;
      const indexName = params.name;
      const idx = computed?.names.indexOf(indexName);
      const change = idx !== undefined && idx >= 0 && computed ? computed.changes[idx] : 0;
      setSelectedIndex(indexName);
      setSelectedChange(change ?? 0);
      fetchIndexDetail(indexName, change ?? 0);
    },
  }), [computed, date]);

  const option = useMemo(() => {
    if (!computed) return null;
    return {
      animation: false,
      tooltip: {
        trigger: 'axis',
        ...theme.tooltip,
        formatter: (params: any) => {
          const item = params[0];
          const value = item.value;
          return `${item.name}<br/>涨跌幅: ${value >= 0 ? '+' : ''}${value.toFixed(2)}%<br/><span style="opacity:.6;font-size:11px">点击查看详情</span>`;
        },
      },
      grid: { left: 70, right: 50, top: 10, bottom: 24 },
      xAxis: {
        type: 'value',
        splitLine: theme.split,
        axisLabel: {
          color: theme.axisColor,
          fontSize: 10,
          formatter: (value: number) => `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`,
        },
      },
      yAxis: {
        type: 'category',
        data: computed.names,
        ...theme.axis,
        axisLabel: { color: theme.textColor, fontSize: 11, cursor: 'pointer' },
      },
      series: [
        {
          type: 'bar',
          data: computed.changes.map((v) => ({
            value: v,
            itemStyle: {
              color: v >= 0 ? theme.theme.red : theme.theme.green,
              borderRadius: v >= 0 ? [0, 3, 3, 0] : [3, 0, 0, 3],
              cursor: 'pointer',
            },
            label: {
              show: true,
              position: 'right',
              color: v >= 0 ? theme.theme.red : theme.theme.green,
              fontSize: 11,
              fontWeight: 'bold',
              formatter: () => `${v >= 0 ? '+' : ''}${v.toFixed(2)}%`,
            },
          })),
          barWidth: '55%',
          label: { show: false },
        },
      ],
    };
  }, [theme, computed]);

  if (!computed || !option) return null;

  return (
    <>
      <div className="relative">
        {liveLoading && (
          <div className="absolute top-1 right-1 z-10 flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            实时行情加载中
          </div>
        )}
        {!liveLoading && liveIndices && !liveFailed && (
          <div className="absolute top-1 right-1 z-10 flex items-center gap-1 text-[10px] text-emerald-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            实时行情 · AKShare
          </div>
        )}
        {!liveLoading && liveFailed && indexChanges && (
          <div className="absolute top-1 right-1 z-10 flex items-center gap-1 text-[10px] text-text-muted">
            <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
            日报数据
          </div>
        )}
      <ReactECharts
        opts={{ renderer: "canvas" }}
        notMerge={true}
        lazyUpdate={false}
        style={{ height: 160, cursor: 'pointer' }}
        option={option}
        onEvents={onEvents}
      />
      </div>

      {/* 指数详情弹窗 */}
      {selectedIndex && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setSelectedIndex(null)}
        >
          <div
            className="w-[480px] max-w-[90vw] rounded-xl border border-white/10 bg-[#16181d] p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div
                  className={`text-base font-bold ${
                    (selectedChange ?? 0) >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'
                  }`}
                >
                  {selectedIndex}
                </div>
                <div
                  className={`text-sm font-semibold ${
                    (selectedChange ?? 0) >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'
                  }`}
                >
                  {(selectedChange ?? 0) >= 0 ? '+' : ''}
                  {(selectedChange ?? 0).toFixed(2)}%
                </div>
              </div>
              <button
                className="text-gray-500 hover:text-gray-300 text-sm"
                onClick={() => setSelectedIndex(null)}
              >
                ✕
              </button>
            </div>

            {detailLoading && (
              <div className="py-8 text-center text-sm text-gray-400">加载中...</div>
            )}

            {detailError && !detailLoading && (
              <div className="py-10 text-center space-y-3">
                <div className="text-2xl">📡</div>
                <div className="text-base text-gray-200 font-medium">接口暂未返回真实行情</div>
                <div className="text-[11px] text-gray-500">
                  请稍后再试，或检查网络连接
                </div>
              </div>
            )}

            {indexDetail && !detailLoading && !detailError && (
              <div className="space-y-4">
                {/* 当日详情 - 双列4行布局 */}
                <div className="grid grid-cols-2 gap-1.5">
                  {(() => {
                    const changeVal = indexDetail.change ?? indexDetail.change_pct ?? 0;
                    const volVal = indexDetail.volume;
                    const amtVal = indexDetail.amount ?? indexDetail.turnover;
                    const dateVal = indexDetail.date || date || '—';
                    const fields: [string, string | number, string][] = [
                      ['开盘点位', indexDetail.open, 'num'],
                      ['收盘点位', indexDetail.close, 'num'],
                      ['最高价', indexDetail.high, 'num'],
                      ['最低价', indexDetail.low, 'num'],
                      ['涨跌幅', `${changeVal >= 0 ? '+' : ''}${changeVal.toFixed(2)}%`, 'change'],
                      ['交易日期', dateVal, 'text'],
                    ];
                    return fields.map(([label, value, type]) => (
                      <div
                        key={label as string}
                        className="flex items-center justify-between rounded-md bg-white/[0.06] px-3 py-2"
                      >
                        <span className="text-gray-400 text-[11px]">{label}</span>
                        <span
                          className={`font-mono font-semibold text-[11px] ${
                            type === 'change'
                              ? (changeVal >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]')
                              : 'text-gray-200'
                          }`}
                        >
                          {type === 'num' && typeof value === 'number' ? value.toFixed(2) : value}
                        </span>
                      </div>
                    ));
                  })()}
                </div>

                {/* 近5日历史数据 */}
                {indexHistory && indexHistory.length > 0 && (
                  <div className="border-t border-white/5 pt-3">
                    <div className="text-[11px] text-gray-400 mb-2 font-medium">最近5个交易日</div>
                    <div className="space-y-1">
                      {/* 表头 */}
                      <div className="grid grid-cols-7 gap-1 text-[9px] text-gray-500 px-1 pb-1 border-b border-white/5">
                        <span className="text-left">日期</span>
                        <span className="text-right">开盘</span>
                        <span className="text-right">收盘</span>
                        <span className="text-right">最高</span>
                        <span className="text-right">最低</span>
                        <span className="text-right">涨跌</span>
                      </div>
                      {/* 数据行 */}
                      {indexHistory.map((h, i) => {
                        const chg = h.change_pct ?? 0;
                        return (
                          <div key={i} className="grid grid-cols-6 gap-1 text-[10px] px-1 py-1 font-mono">
                            <span className="text-left text-gray-300">{h.date.slice(5)}</span>
                            <span className="text-right text-gray-300">{h.open.toFixed(0)}</span>
                            <span className={`text-right font-medium ${chg >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>{h.close.toFixed(0)}</span>
                            <span className="text-right text-gray-300">{h.high.toFixed(0)}</span>
                            <span className="text-right text-gray-300">{h.low.toFixed(0)}</span>
                            <span className={`text-right ${chg >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                              {chg >= 0 ? '+' : ''}{chg.toFixed(2)}%
                            </span>
                          </div>
                        );
                      })}
                      {/* 近5日累计涨跌幅 */}
                      <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5 px-1">
                        <span className="text-[10px] text-gray-400">近5日累计涨跌幅</span>
                        <span className={`text-[11px] font-mono font-bold ${calc5dChange(indexHistory) >= 0 ? 'text-[#dc2626]' : 'text-[#16a34a]'}`}>
                          {calc5dChange(indexHistory) >= 0 ? '+' : ''}{calc5dChange(indexHistory).toFixed(2)}%
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-white/5 text-center text-[10px] text-gray-500">
              数据源：东方财富-AKShare
            </div>
          </div>
        </div>
      )}
    </>
  );
});
