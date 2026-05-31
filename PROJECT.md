# 财经新闻学习 Agent

## 1. 是什么

一个帮人建立财经知识体系的 web app。

**给谁用**：对财经感兴趣但缺少持续阅读习惯的成年人。第一用户 = 项目作者本人 (dogfood)。

**解决什么**：
- 看不懂传导链路 (事件如何影响经济 / 产业)
- 没有历史参照 (不知道现在像不像哪一年的什么 case)
- 概念零散, 没有累积成体系

**怎么解**：每条新闻拆成四段解读 (机制 / 历史 / 不确定性 / 概念) + 概念入库。概念库自动累积, 跨新闻形成知识网络。

输入新闻不限层级 (宏观政策 / 产业新规 / 公司事件 / 数据公布 / 地缘动态都可以), 但解读统一聚焦经济 / 产业影响。

---

## 2. 怎么用

User flow:

1. 首页粘新闻标题 + 原文 → 点"生成解读"
2. 5-10 秒后跳到解读页, 显示四段 + 抽取的概念
3. 抽取的概念可点击 → 该概念详情页 (定义 + 出现过的 article 列表)
4. 顶部 nav 可主动打开"概念库" list view

Sitemap:

```text
/                       粘新闻, 输入
/article/[id]           单条解读 (四段 + 概念)
/concepts               概念库 list view (按时间 / 频次 / 字母排序)
/concepts/[name]        单概念详情 (定义 + 出现过的 article 列表)
```

---

## 3. 核心 prompt (v5)

```text
你是宏观财经/产业新闻助教.
服务对象是对财经感兴趣但缺少持续阅读习惯的成年人.
他们对 GDP / 利率 / 通胀 / CPI 等基本概念有印象,
但不熟悉这些概念在新闻里的具体运用, 也不熟悉宏观
传导链路.

# 输入
新闻标题: {{标题}}
新闻原文/摘要: {{原文}}

# 任务
基于这条新闻, 生成以下结构:

## 机制 (传导链路)
聚焦事件对经济/产业/市场的影响链路, 
不是技术细节或操作流程本身.

如新闻原文是技术、公司或产品叙事, 必须跳出技术层,
讨论以下至少 2 项的影响:
- 产业格局 / 竞争关系
- 上下游供应链
- 价格 / 成本结构
- 政策 / 监管 / 地缘
- 资本市场预期

用 "X → 中间步骤 → Y" 链路结构, Y 必须落在经济/
产业层面, 不能停在技术指标 (如"密度提升 53.5%").

【重要】链路里至少有一步必须具体到 行业 / 产品 /
价格水平 (如"钢铁/化工/水泥的资本开支"、"建材
价格上行"、"猪肉零售价"), 不能只停在抽象指标
(如"制造业资本开支""通胀压力""产业格局变化").

每步给出具体机制, 不跳步, 不写空话.
80-150 字.

## 历史 (类似 case)
找一个历史上相似事件.
说明现在情境跟当时哪里像、哪里不像.
若找不到强类比, 直接说 "没有强类比, 本次情境特殊在 X".
60-120 字.

## 不确定性标注
明确指出 3 件事:
- 这条新闻里不确定的事实 / 数据
- 解读中你做的关键假设
- 建议读者自己 verify 的 claim

## 抽取概念
列出 1-3 个本条新闻涉及的关键概念.

格式:
[概念名] (宏观 / 产业 / 微观 / 技术) - 一句话定义.
(本新闻中的角色)

要求:
- 至少 1 个落在经济/产业层 (即"宏观"或"产业"标签),
  不能 1-3 个全是"技术"标签
- 优先选有累积价值的 (跨新闻反复遇到的概念),
  不是仅本新闻独有的术语

# 输出规则
1. 必须解释因果链路, 不跳步
2. 避免空话 ("影响深远""值得关注"等不写)
3. 必须给出历史参照 (或明确说找不到)
4. 必须标注不确定性
5. 简单中文, 短句, 不卖弄术语
6. 整篇 250-400 字内
7. 新闻里出现术语 (除最基础的 GDP/通胀外), 
   首次提及给括号内一句话解释 (≤15 字).
   例: "PPI (工业品出厂价, 反映工厂端价格变动)"
```

---

## 4. 技术参考

### 技术栈

Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 5 + Tailwind v4 / LLM: DeepSeek 默认 (openai SDK; 批处理 deepseek-v4-flash, 搜索 Agent deepseek-v4-pro), Gemini (@google/generative-ai) 备用, 由 `LLM_PROVIDER` 切 / 搜索: Tavily (事实核查 Agent 的 search 工具) / Supabase Postgres + Prisma (服务端读写, 取代 localStorage) / Vercel 部署。

### Data schema

```ts
type Layer = '宏观' | '产业' | '微观' | '技术';

type Article = {
  id: string;              // cuid, 服务端生成
  title: string;
  source_url?: string;
  raw_text: string;
  created_at: string;      // ISO datetime
  sections: {
    mechanism: string;
    history: string;
    uncertainty: string;
  };
  concepts: Array<{ name: string; layer: Layer }>;
};

type Concept = {
  name: string;
  layer: Layer;
  definition: string;      // 第一次抽到时的定义
  first_seen: string;
  appearances: string[];   // article id 列表
};

// 持久化在 Postgres, 经 Prisma (见 prisma/schema.prisma):
//   表: articles / concepts / article_concepts (多对多连接表)
//   id + created_at 服务端生成; 概念↔文章为多对多
//   服务端数据层在 lib/data.ts (取代旧的 lib/storage.ts)
```

### API

```text
POST /api/generate-article
  req: { title: string, raw_text: string }
  res: { id: string }   // 生成后即在服务端存库, 返回新 article 的 id, 客户端据此跳转
```

Provider 抽象在 `lib/llm.ts`, 根据 `process.env.LLM_PROVIDER` 切 Gemini / DeepSeek。

Markdown parser 注意点: 已修一次 bug。模型实际输出格式带 markdown bullet + bold 包装 (`* **[名] (层)** - 定义.`), 原 parser 只识别裸格式。当前 parser 含 `stripBulletAndBold()` + 分隔符容错 (`:` / `：` 都接受)。后续遇到新边角情况可能还需修。

### 目录结构

```text
.
├── app/
│   ├── page.tsx                       # 首页 (粘新闻)
│   ├── article/[id]/page.tsx          # 单条解读
│   ├── concepts/page.tsx              # 概念库列表 (服务端查库)
│   ├── concepts/[name]/page.tsx       # 单概念详情 (服务端查库)
│   ├── concepts/_components/SortableConceptList.tsx  # 列表排序 (客户端)
│   ├── api/generate-article/route.ts  # POST endpoint
│   ├── layout.tsx                     # 全局布局 + Nav
│   └── globals.css
├── components/
│   ├── ArticleView.tsx                # 解读渲染
│   ├── InputForm.tsx                  # 首页表单 (提交→跳转)
│   ├── LocalTime.tsx                  # 本地时区时间戳 (客户端)
│   └── Nav.tsx                        # 顶部导航
├── lib/
│   ├── prompts.ts                     # v5 prompt
│   ├── db.ts                          # Prisma client 单例 (server-only)
│   ├── data.ts                        # 服务端数据层 (取代 storage.ts)
│   ├── llm.ts                         # Provider 抽象 + parser
│   └── types.ts                       # Article / Layer / 视图类型
├── prisma/
│   └── schema.prisma                  # 3 表: articles/concepts/article_concepts
├── .env                               # 数据库连接串, 不上 git
├── .env.local                         # LLM API key, 不上 git
├── .env.example                       # 模板
├── .gitignore
└── package.json
```

---

## 5. 安全注意

API key 是 server-only secret。客户端代码任何情况下都不能看到 key。

**1. env 变量命名**

- ✓ `GEMINI_API_KEY` (server only)
- ✓ `DEEPSEEK_API_KEY` (server only)
- ✗ 不允许任何 `NEXT_PUBLIC_*_API_KEY` 前缀 (`NEXT_PUBLIC_` 会被 webpack 注入到 client bundle, 暴露)

**2. LLM SDK 只在 server 端实例化**

- `lib/llm.ts` 顶部有 `'server-only'` import 守卫
- `import { generateArticle }` 只能在 `api/*/route.ts`
- 不能在 `'use client'` 组件里直接 import LLM SDK

**3. LLM 调用必须走 API route**

- 客户端组件: `fetch('/api/generate-article')`
- 不允许客户端 import `@google/generative-ai` 或 `openai` SDK

**4. `.env.local` 不上 git**

- `.gitignore` 必须包含 `.env.local` 和 `.env*.local`
- 仓库根有 `.env.example` (列 key 名无 value)

**5. Vercel 部署**

- API key 在 Dashboard > Settings > Environment Variables 配置
- 不要 hardcode 在代码里, 不要 commit `.env.production`

**6. 错误返回不要泄露 key**

- try / catch 抓 LLM SDK 错误
- 返回给前端的 error message 只说 "LLM call failed"
- 不要把 raw error (可能含 key 片段) 返回

### 部署后自检

DevTools Network tab:

1. 触发"生成解读"
2. 看 `/api/generate-article` 的 request headers + body
3. 不该出现 `GEMINI_API_KEY` / `AIza...` 字符串
4. View Page Source → `Cmd + F` 搜 "API_KEY" 应该完全无结果

---

## 6. 进度

### 当前

- 代码实现: Step 1-8 完成, v0 已上线
- 最新 commit: `4a73393` (branch: main, 共 13 个 commit)
- 项目目录: `~/Desktop/finews-agent/`
- 线上 URL: https://finews-agent.vercel.app/
- 开发环境: Claude Code (desktop app)

### 具体已完成

**Phase A (prompt 验证, Gemini AI Studio 手工跑)**:

- v5 prompt 通过 4.5+/5, 已 freeze 在 `lib/prompts.ts`

**Phase B 代码实现**:

- Step 1: Next.js 16 + TypeScript + Tailwind v4 项目初始化, dev server 跑通
- Step 2: `lib/` scaffolding (types / storage / prompts / llm.ts), v5 prompt 已嵌入 `lib/prompts.ts`
- Step 3: `api/generate-article/route.ts` 跑通. 真实 Gemini API 调用 verified (`gemini-3.5-flash`). 端到端测试通过: HTTP 200, ~14s 一条 article. markdown parser 修了一次 bug (`stripBulletAndBold`).
- Step 4: 首页 + InputForm + 提交流程
- Step 5: `/article/[id]` 真渲染 + ArticleView
- Step 6: `/concepts` 列表 + 详情 + 顶部 nav
- Step 7: markdown 渲染 + 视觉重排 + responsive
- Step 8: Vercel deploy + 3 条新闻 verify. 线上 URL: https://finews-agent.vercel.app/

**存储迁移 (localStorage → Supabase Postgres + Prisma, 2026-05-30)**:

代码 Step 1-5 全部完成, 读写都在 Postgres:

| Step | 内容 | 状态 |
|---|---|---|
| 1 | 建库 / 装 Prisma / 建表 (3 表) | ✅ |
| 2 | 写入路径 (API route 存库 + lib/data.ts) | ✅ |
| 3 | 文章详情页改服务端查库 | ✅ |
| 4 | 概念库两页改服务端查库 | ✅ |
| 5 | 收尾 (删 lib/storage.ts) + `npm run build` 通过 | ✅ |

- 期间修了概念 parser (方括号改可选, 兼容模型实际输出), 时间戳改 LocalTime 客户端组件避免 SSR 时区不一致。
- 表: `articles` / `concepts` / `article_concepts` (多对多连接表); id + created_at 服务端生成。

**部署待办 (留待以后单独做)**:
- [ ] Vercel 配 `DATABASE_URL` + `DIRECT_URL` (Production + Preview)
- [ ] 对生产库跑 `prisma migrate deploy`
- [ ] 线上贴新闻验证持久化; DevTools 搜不到数据库串 / 密码
- [ ] 确认 LocalTime 消除时区 hydration 警告 (线上才显现)

迁移风险备忘: `DATABASE_URL` 池串 (6543) 给应用、`DIRECT_URL` 直连 (5432) 给迁移, 两个都要配; `postinstall: prisma generate` 必须加 (否则 Vercel 构建失败); Supabase 免费项目闲置约一周会暂停, 首次访问要唤醒。

### RSS 自动抓取 (v0.5, 已落地)

手动触发抓取已跑通 (2026-05-31)。关键文件: `lib/rss.ts` (3 个源: 华尔街见闻 / 第一财经走 RSSHub 镜像, 人民网财经原生; rss-parser + HTML 转纯文本), `app/api/fetch-rss/route.ts` (POST: 抓取 → 批内 + 对库去重 → 逐条 generateArticle 入库, 批处理不开搜索省额度), `components/FetchRssButton.tsx` (触发按钮)。
实测: 一次抓 6 条、去重后用 deepseek-v4-flash 串行生成入库, 零失败 (单条约几秒)。
待做: 每天定时 push headline + Vercel Cron schedule; 部署后批处理串行耗时需注意函数超时 (改并发或换队列)。

### 下一步

v0 完成, v0.5 进行中 (RSS 抓取已落地; 邮件 push + 定时待做)。短期 backlog 见下面"已知风险 / Backlog"。
v0.5: RSSHub 自动拉 ✓; 待做 每天 push headline + schedule (Vercel Cron)
v1:   存储迁 Postgres + Prisma (✓ 代码完成, 待部署); 加 user auth
v1.5: 加 critic agent (二次 LLM 调用自检)
v2:   引入 LangGraph 重构 agent loop (Python
      microservice, deploy 到 Railway)
v2.5: Agentic RAG (Wikipedia 财经 / FRED / 央行
      声明做 KB, vector DB Pinecone/Qdrant)
v3:   真 KG 图可视化 + 关系类型识别
v3.5: Eval pipeline + LangSmith observability
v4:   Spaced repetition / quiz / adaptive curriculum

### 已知风险 / Backlog

**技术 / 部署**:

- markdown parser 是 v0 实现, 后续遇到新边角情况可能要继续修
- 跑 LLM 会消耗 Gemini free tier quota, 一条约 $0.005, 调试时注意不要无限制重试
- dev 环境下切走应用 (Chrome 进入后台) 等 LLM 响应, 偶现 "LLM call failed". 怀疑是 dev server hot reload / Mac sleep / Chrome tab throttling. deploy 到 Vercel 后大概率消失. 真要修需要复现时抓 dev server log 定位.

**Prompt + 产品 backlog** (deploy 跑更多样本后回头处理):

- **落脚点空泛 / 与我无关**: 机制链路终点抽象, 读者感觉跟自己没关系. 加约束: 链路终点要量化 (涨幅 / 金额) 或落到 "对个人意味着什么".
- **术语解释没出现**: prompt 第 7 条本来要求了, 模型没执行. 加强约束或加 few-shot example.
- **历史 case 缺 "后来发生了什么"**: 当前 prompt 只要求 "哪里像 / 哪里不像", 缺时间延伸. 加约束: 还要说那次后续 6-24 个月的关键发展.
- **历史 case 格式不一致**: 不同新闻输出可能用 "像 / 不像"、"相似点 / 不同点"、"同 / 异" 等不同标签, markdown 排版也有差异. 加约束: 强制用固定 2 个标签 (建议 `**相似点**:` / `**不同点**:`) + 统一 bullet 格式.
- **concept definition 含 "本新闻"**: 在 concept 详情页 cross-article 视图下 misleading ("本新闻" 实际只指首次抽到时那条). 短期: prompt 让 definition 只写通用定义, 不带 "本新闻...". 长期 (v1 schema): 每条 article 记录用到的 concept 的具体角色, concept 详情页展示所有出现新闻各自的角色 list.
- **concept name 嵌入括号解释**: LLM 偶尔输出 `[业绩指引 (公司对未来业绩的官方预测)]` 这种 name 字段含括号的格式, 导致 concept 列表不一致, 且会让"同 concept 不同表述"无法 merge. 短期: prompt 加约束 name 纯净. 长期: parser 也加防御 (检测 name 含 `(` 时截断或拒绝).
- **concept 在正文是否解释**: 当前底部 chip 点开看. 备选: 段落里 inline 解释 (改 prompt) / 鼠标悬停 tooltip (UI 工作). 先决定形态再定改哪里.

### 事实核查 Agent: DeepSeek tool-calling 自主循环 + Tavily

已落地 (2026-05-31, 取代原 Gemini grounding 版): 单篇生成 (useSearch:true) 时, 把 search 当工具交给 DeepSeek, 模型在多轮循环里**自己决定要不要搜、搜什么、搜几次、何时停** (真 agent, 非代码写死的流水线)。两阶段: 检索阶段带 tools 自由调用, 收尾不带 tools 出干净 JSON; 搜索结果与原文一起喂模型, 用到的来源去重后 (上限 8 条) 落库展示。

关键文件: `lib/agent.ts` (runSearchAgent, tool-calling 循环 + MAX_STEPS=4 上限), `lib/search.ts` (Tavily 客户端), `lib/prompts.ts` (buildAgentSystemPrompt / buildAgentFinalizePrompt), `lib/llm.ts` (generateArticle 的 opts.useSearch 派发), prisma Article.sources 列, `components/ArticleView.tsx` (来源区块), `app/api/generate-article/route.ts` (useSearch:true + maxDuration=45)。

模型分配: 批处理 / 无搜索生成用 deepseek-v4-flash (快省), 搜索 Agent 用 deepseek-v4-pro (`DEEPSEEK_MODEL` / `DEEPSEEK_MODEL_AGENT` 覆盖)。注意 deepseek-chat 已下架, 用 deepseek-v4 系列。

踩坑:
- Tavily 中文检索必须用 `topic:'general'` + `country:'china'`; `topic:'news'` 实测对中文查询返回无关英文新闻 (news 源偏英文)。
- 模型会引用搜来的数字 (如原文未给的往年营收), 准确性依赖搜索源, 靠诚实原则 + uncertainty 段兜底。

实测 (汇金股份收购库珀新能): 模型自主搜 3 次、1 轮收敛, 用搜来的 "汇金 2024 全年营收" 论证是否构成重大资产重组; sources 全为相关中文财经源。

**评测 (2026-05-31, 开 / 关搜索对照)**

方法: 6 条 news-samples 真实新闻, 输入截断到"标题 + 导语"制造信息缺口; 每条跑 useSearch false (纯生成) / true (agent + Tavily), 两组都 deepseek-v4-pro (只变搜索这一个变量)。临时入口 `/api/eval` 跑完已删, 原始结果曾存 `/tmp/eval-results.json`。

结论 (与"编造下降"的预期不同, 如实记):
- 纯生成版几乎不硬编数字:「诚实优于完整」prompt 已让模型在信息不足时用"原文未提"/"(推测)"回避, 故"编造数"≈0, **"编造从 a 降到 b"不成立**。
- Agent 真实价值 = **补全可溯源数据**: 平均每篇补全约 5 个带来源的关键数据点 (无搜索版为 0), 把空泛解读升级为可溯源、可核查的分析。
- Agent 新风险: 会采信个别不准的第三方来源 (如"证监会"那条搜出"业务加分前 20 扩至前 30"的存疑说法) → 改进方向: 来源质量过滤 / 多源交叉。

简历 result (数字待人工核验): "经开 / 关搜索对照测试, Agent 将解读的可溯源数据点从每篇 0 提升至约 5 个, 增强可信度"。


