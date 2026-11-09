import { WeeklyReport } from '@/components/report/weekly-report';

export const metadata = {
  title: 'A股周报 · W35 | 2026年8月第35周复盘',
  description: '2026年8月第35周（08.24-08.28）A股周度复盘报告',
};

export default function WeeklyReportPage() {
  return <WeeklyReport weekNum={35} />;
}
