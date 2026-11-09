'use client';

import type { ReportData } from '@/lib/types';
import { dashboardConfig } from '@/config/dashboard.config';
import { IntradaySectorsChart, SectorChart, FundsChart, IndexChangesChart } from './charts';

interface Props {
  data: ReportData;
  section?: 'signals';
}

export function PageStrategy({ data, section }: Props) {
  if (section === 'signals') {
    return (
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-sm text-text-secondary font-semibold mb-1 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-primary rounded-sm" />
            盘中异动板块
          </div>
          <IntradaySectorsChart data={data.charts} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-sm text-text-secondary font-semibold mb-1 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-primary rounded-sm" />
            板块涨跌排行
          </div>
          <SectorChart data={data.charts} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-sm text-text-secondary font-semibold mb-1 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-primary rounded-sm" />
            主力资金流向对比
          </div>
          <FundsChart data={data.charts} />
        </div>
        <div className="bg-surface border border-border rounded-lg p-4">
          <div className="text-sm text-text-secondary font-semibold mb-1 flex items-center gap-1.5">
            <span className="inline-block w-1 h-3 bg-primary rounded-sm" />
            七指数当日涨跌幅对比
          </div>
          <IndexChangesChart data={data.charts} date={data.date} indexDetails={data.charts.indexChanges?.details} />
        </div>
      </div>
    );
  }

  // Default: footer
  return (
    <div className="text-center py-4 text-[10px] text-text-muted">
      {dashboardConfig.site.name} · {data.dateLabel} · {dashboardConfig.site.disclaimer}
    </div>
  );
}
