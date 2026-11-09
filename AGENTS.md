# 项目上下文（AI 协作开发规范）

### 版本技术栈

- **Framework**: Next.js 16 (App Router)
- **Core**: React 19
- **Language**: TypeScript 5
- **UI 组件**: shadcn/ui (基于 Radix UI)
- **Styling**: Tailwind CSS 4
- **图表**: ECharts 6 (echarts-for-react)
- **包管理**: 仅允许 pnpm（已配置 only-allow 强制）

## 目录结构

```
├── public/                 # 静态资源与数据 JSON（看板数据落盘点）
├── scripts/                # Python 数据采集管线（可选，akshare 系）
├── skills/                 # AI 人设 Skill 包（SKILL.md + methodology + style + workflows）
├── src/
│   ├── app/                # 页面路由与 API 路由
│   ├── components/         # 业务组件；ui/ 为 shadcn 基础组件
│   ├── config/
│   │   └── dashboard.config.ts   # 站点级配置（模块开关/站点信息/导航链接）
│   ├── hooks/              # 自定义 Hooks
│   ├── lib/                # 数据层（types / reports / llm / wind / db）
│   └── instrumentation.ts  # 可选事件调度器（ENABLE_EVENTS_SCHEDULER=1 启用）
├── DESIGN.md               # 设计系统（design tokens / 布局规则 / 禁忌清单）
├── next.config.ts
└── package.json
```

## 编码规范

- TypeScript `strict` 心智；优先复用当前作用域已声明的变量、函数、类型和导入。
- 禁止隐式 `any` 和 `as any`；函数参数、返回值、解构项、事件对象、`catch` 错误
  在使用前应有明确类型或先完成类型收窄，并清理未使用的变量和导入。
- next.config 中不写死绝对路径，用 `path.resolve(__dirname, ...)` / `import.meta.dirname` /
  `process.cwd()` 动态拼接。

### Hydration 防范

1. 严禁在 JSX 渲染逻辑中直接使用 `typeof window`、`Date.now()`、`Math.random()` 等
   动态数据。必须 `'use client'` + `useEffect`/`useState` 确保动态内容仅在客户端渲染；
   严禁非法 HTML 嵌套（如 `<p>` 嵌套 `<div>`）。
2. 禁止使用 `head` 标签，用 metadata API；三方资源在 `globals.css` 顶部 `@import`
   或用 next/font。

## UI 规范

- 默认采用 shadcn/ui 组件、风格和规范（`src/components/ui/`），除非用户另行指定。
- 设计语言遵循 `DESIGN.md`：Apple 式极简 + 金融数据密度；涨红跌绿（中国股市约定）；
  单色蓝强调、无卡片阴影、无装饰性渐变。

## 数据层规范

- **看板数据双模式**：
  - 模式 A（默认）：静态 JSON 落盘 `public/`，API 路由读文件。改数据不动代码。
  - 模式 B（可选）：`scripts/` 下 Python 脚本采集（akshare），cron 或内置调度器更新。
- **新增日报**：复制 `src/lib/reports/` 下任意日期文件 → 改数据 → 在 `index.ts` 注册。
  数据结构以 `src/lib/types.ts` 的 `ReportData` 为唯一契约。
- **站点级定制**：模块开关、站点名、导航链接集中在 `src/config/dashboard.config.ts`，
  不要在组件里散落硬编码。

## LLM / AI 规范

- 所有 AI 路由统一走 `src/lib/llm.ts`（OpenAI 兼容，env 配置），
  禁止引入特定厂商 SDK 或在前端暴露密钥。
- AI 人设（`skills/` 目录）由 `src/lib/teacher-skills.ts` 服务端读取拼接，
  仅服务端，不下发前端；文件缺失回退内置简版人设，不阻断对话。
- `WIND_API_KEY` 等外部数据源 key 仅存于 `.env.local`，缺失时静默降级。

## 命令

```bash
pnpm dev / build / start   # 开发 / 构建 / 生产
pnpm validate              # tsc + eslint + stylelint
python3 scripts/fetch_all_akshare_data.sh   # 可选：数据采集
```
