'use client';

import type { ReportData } from '@/lib/types';
import { TeacherAvatar } from '@/components/report/teacher-avatar';

interface AnalystViewsProps {
  data: ReportData;
}

export function AnalystViews({ data }: AnalystViewsProps) {
  return (
    <div className="space-y-3">
      {/* 马老师视角 */}
      <div className="rounded-lg p-4 bg-danger/10 border-l-[3px] border-red-500">
        <div className="text-sm font-bold text-danger mb-3 flex items-center gap-2">
          <TeacherAvatar src="/avatars/ma-laoshi.png" alt="马老师" size={26} />
          <span>马老师 · {data.maView.title.replace('🐴 马老师视角 · ', '')}</span>
        </div>
        <div
          className="text-[13px] text-text-secondary leading-[1.8] [&_b]:text-text-primary [&_b]:font-semibold [&_.text-yellow-400]:text-yellow-400 [&_.font-bold]:font-bold"
          dangerouslySetInnerHTML={{ __html: data.maView.body }}
        />
      </div>

      {/* 钱老师视角 */}
      <div className="rounded-lg p-4 bg-warning/10 border-l-[3px] border-yellow-500">
        <div className="text-sm font-bold text-warning mb-3 flex items-center gap-2">
          <TeacherAvatar src="/avatars/qian-duoduo.png" alt="钱多多" size={26} />
          <span>钱老师 · {data.qianView.title.replace('💰 钱老师视角 · ', '')}</span>
        </div>
        <div
          className="text-[13px] text-text-secondary leading-[1.8] [&_b]:text-text-primary [&_b]:font-semibold [&_.text-yellow-400]:text-yellow-400 [&_.font-bold]:font-bold"
          dangerouslySetInnerHTML={{ __html: data.qianView.body }}
        />
      </div>
    </div>
  );
}
