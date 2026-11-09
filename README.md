# next-dashboard-kit

> 数据看板 / 日报网站模板 —— Next.js 16 + shadcn/ui + ECharts
> Apple 式极简 × Bloomberg 数据密度，配置驱动、模块可选、数据双模式

由一个真实运行的 **A股短线收盘日报看板** 抽象而来：三页式日报（总览 / 分析 / 策略）、
情绪温度计、连板梯队、板块排行、事件日历、周报聚合、AI 投顾双人格对话、
一键导出 PNG/JPG/PDF。所有模块均可通过配置启停，数据格式全部文档化。

## 内置模块

| 模块 | 说明 | 数据来源 | 开关 |
|------|------|----------|------|
| 日报查看器 | 三页式（总览/分析/策略）+ 目录侧栏 + 日期导航 | `src/lib/reports/*.ts` | 核心常驻 |
| 图表组件库 | ECharts：K线、量价、分时、板块、资金、梯队等 | 报告数据 `charts` 字段 | 核心常驻 |
| 事件日历 | 月历视图 + 事件详情 + 星级 | `public/daily-events/*.json` | `features.eventsCalendar` |
| 周报 | 由日报数据自动聚合生成 | 日报注册表 | `features.weeklyReports` |
| AI 投顾助手 | 双人格入口卡片 + 流式对话，人设来自 `skills/` | LLM API（env 配置） | `features.aiAdvisor` |
| 导出工具 | 报告区域截图导出 PNG/JPG/PDF | — | 核心常驻 |
| 主题 | 亮/暗双模式，design tokens 见 `DESIGN.md` | — | 核心常驻 |

## 快速开始

```bash
# 需要 Node 20+ 和 pnpm 9+
pnpm install
pnpm dev        # http://localhost:3000
pnpm build      # 生产构建
pnpm start      # 生产运行
```

克隆即得一个带 5 份示例日报的完整看板，无需任何环境变量。

## 5 分钟换一个主题

1. **改站点信息**：编辑 [`src/config/dashboard.config.ts`](src/config/dashboard.config.ts)
   —— 站点名、导出文件名前缀、免责声明、顶栏链接、模块开关，全部集中在这一个文件。
2. **换数据**：复制 `src/lib/reports/2026-09-23.ts` 为新日期文件，替换内容，
   再到 `src/lib/reports/index.ts` 注册（文件内有三步说明）。
3. **看效果**：保存后刷新，日期导航栏自动出现新日期。

报告数据的完整结构定义见 [`src/lib/types.ts`](src/lib/types.ts)（`ReportData` 接口，
约 60 个字段全部有中文注释）。

## 数据架构：双模式

### 模式 A：静态 JSON（默认，零依赖）

Python/爬虫把数据落盘到 `public/` 下的静态 JSON，Next.js API 路由读文件返回：

| 目录 | 内容 | 生产 API |
|------|------|----------|
| `public/market-data/` | 指数 K 线、成交量、板块排行 | `/api/market-data` |
| `public/limit-up-data/` | 涨停池（按日） | `/api/limit-up-data?date=` |
| `public/golden-stocks/` | 金股数据（按月） | `/api/golden-stocks` |
| `public/daily-events/` | 每日财经事件（按日） | `/api/daily-events` |
| `public/cls-telegraph/` | 电报资讯（按日） | `/api/cls-telegraph` |
| `public/lhb-data/` | 龙虎榜（按日） | `/api/lhb-data` |
| `public/sector-cons/` | 板块成分股 | `/api/sector-cons` |
| `public/industry-ratings/` | 行业评级 | `/api/industry-ratings` |

每类都保留了 1-2 份示例文件作为格式样例。**换成你自己的数据：照格式写 JSON 即可。**

### 模式 B：Python 采集管线（可选增强）

`scripts/` 目录内置 akshare 系列采集脚本（原为 A 股数据源，可改造成任何领域）：

```bash
pip install akshare
bash scripts/fetch_all_akshare_data.sh          # 全量采集
python3 scripts/fetch_daily_events.py 20260923  # 单日事件
bash scripts/setup_cron_events.sh               # 安装每日 05:00 cron
```

也可启用 Node 内置调度器：设置 `ENABLE_EVENTS_SCHEDULER=1`（见 `.env.example`）。

## AI 能力（可选）

- **LLM 对话**：`.env.local` 中配置任意 OpenAI 兼容接口
  （`LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`），支持 DeepSeek、豆包 Ark、
  通义、Ollama 等。未配置时 AI 路由返回友好提示，看板其余功能不受影响。
- **人设系统**：AI 投顾的人格定义存放在 `skills/` 目录（标准 Skill 包结构：
  SKILL.md + methodology/ + style/ + workflows/）。内置两个人格（MIT 授权），
  想换成自己的人设：复制一份目录改内容，再改 `src/lib/teacher-skills.ts` 的映射表。
- **Wind 行情注入**（可选）：设置 `WIND_API_KEY` 后，AI 对话自动注入当日客观盘面；
  无 key 时静默降级，不影响对话。

## 目录结构

```
├── src/
│   ├── app/                  # Next.js App Router（页面 + API 路由）
│   ├── components/           # 业务组件（report/ 下为看板模块组件）
│   │   └── ui/               # shadcn/ui 基础组件
│   ├── config/
│   │   └── dashboard.config.ts   # ★ 站点级配置（从这里开始定制）
│   ├── hooks/                # use-export-report（导出）等
│   ├── lib/                  # 数据层：types / reports 注册表 / llm / wind / db
│   └── instrumentation.ts    # 可选事件调度器入口
├── public/                   # 静态数据 JSON（模式 A 的数据落盘点）
├── scripts/                  # Python 采集管线（模式 B）
├── skills/                   # AI 人设 Skill 包（MIT，可替换）
├── DESIGN.md                 # ★ 设计系统：design tokens / 布局规则 / 禁忌清单
└── AGENTS.md                 # AI 协作开发规范
```

## 常用命令

```bash
pnpm dev / build / start    # 开发 / 构建 / 生产
pnpm validate               # tsc + eslint + stylelint 全量检查
pnpm ts-check               # 仅类型检查
```

## 部署

- **Vercel / Netlify**：直接导入仓库即可（静态数据随仓库走）。
  AI 功能需在平台环境变量中配置 `LLM_*`。
- **自托管**：`pnpm build && pnpm start`（默认 3000 端口）。

## 设计系统

完整的 design tokens（亮/暗双色板、字体、圆角、间距）、A股红涨绿跌约定、
交互与禁忌清单见 [`DESIGN.md`](DESIGN.md)。改主题色请从 `src/app/globals.css`
的 CSS 变量入手，与 DESIGN.md 保持同步。

## License

MIT。`skills/` 下的人设包为独立授权作品（MIT, © Kafka-Oreo），保留其原 LICENSE。

## 致谢

模板抽取自一个真实运行的 A股短线收盘日报项目；人设方法论来自开源视角 Skill 包。
