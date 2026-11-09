/**
 * 看板全局配置 —— 模板唯一的"站点级"开关
 *
 * 克隆模板后从这里开始定制：
 *   - 改站点名 / 导出文件名前缀 / 免责声明
 *   - 增删顶栏外部链接（nav.externalLinks）
 *   - 用 nav.outlookLink 配置"本月展望"跳转地址（设为 null 隐藏该入口）
 *   - 用 features 开关 AI 投顾、事件日历、周报模块
 *
 * 该文件可被客户端组件直接 import（纯数据，无服务端依赖）。
 */

export interface NavExternalLink {
  label: string;
  href: string;
}

export interface DashboardConfig {
  site: {
    /** 站点名：浏览器标签标题、导出页眉主标题 */
    name: string;
    /** 页面描述：SEO metadata */
    description: string;
    /** 导出图片/PDF 的文件名前缀（自动拼接日期） */
    exportPrefix: string;
    /** 页脚免责声明 */
    disclaimer: string;
  };
  nav: {
    /** 顶栏右侧外部链接（新窗口打开） */
    externalLinks: NavExternalLink[];
    /** "本月展望"入口跳转地址；null 表示隐藏该入口与 outlook 视图 */
    outlookLink: string | null;
  };
  features: {
    /** AI 投顾助手（入口卡片 + 人设对话，需配置 LLM 环境变量） */
    aiAdvisor: boolean;
    /** 事件日历页（读取 public/daily-events/*.json） */
    eventsCalendar: boolean;
    /** 周报视图（由日报数据自动聚合生成） */
    weeklyReports: boolean;
  };
}

export const dashboardConfig: DashboardConfig = {
  site: {
    name: 'A股短线日报',
    description:
      'A股每日收盘日报，融合双分析师视角，提供市场情绪温度、板块异动、连板梯队与交易信号。',
    exportPrefix: 'A股每日复盘',
    disclaimer: '仅供参考，不构成投资建议',
  },
  nav: {
    externalLinks: [
      { label: '今日头条', href: 'https://www.cls.cn/depth?id=1000' },
    ],
    outlookLink: null,
  },
  features: {
    aiAdvisor: true,
    eventsCalendar: true,
    weeklyReports: true,
  },
};
