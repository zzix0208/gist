# 财经新闻学习 Agent

## 1. 是什么

一个帮人建立财经知识体系的 web app。

**给谁用**：对财经感兴趣但缺少持续阅读习惯的成年人。第一用户 = 项目作者本人 (dogfood)。

**解决什么**：
- 看不懂传导链路 (事件如何影响经济/产业)
- 没有历史参照 (不知道现在像不像哪一年的什么 case)
- 概念零散, 没有累积成体系

**怎么解**：每条新闻拆成四段解读 (机制/历史/不确定性/概念) + 概念入库。概念库自动累积, 跨新闻形成知识网络。

输入新闻不限层级 (宏观政策 / 产业新规 / 公司事件 / 数据公布 / 地缘动态都可以), 但解读统一聚焦经济/产业影响。

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
/concepts               概念库 list view (按时间/频次/字母排序)
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

Next.js 16 (App Router, Turbopack) + React 19 + TypeScript 5 + Tailwind v4 / @google/generative-ai (Demo Gemini 3.5 Flash) → 后续切 DeepSeek (兼容 OpenAI API, openai SDK) / localStorage (v0 单用户) / Vercel 部署

### Data schema

```ts
type Layer = '宏观' | '产业' | '微观' | '技术';

type Article = {
  id: string;              // uuid
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

// localStorage keys:
//   'articles' → Article[]
//   'concepts' → Record<string, Concept>
```

### API

```text
POST /api/generate-article
  req: { title: string, raw_text: string }
  res: { 
    mechanism: string, 
    history: string, 
    uncertainty: string, 
    concepts: Array<{ name: string, layer: Layer, definition: string }> 
  }
```

Provider 抽象在 `lib/llm.ts`, 根据 `process.env.LLM_PROVIDER` 切 Gemini / DeepSeek。

Markdown parser 注意点: 已修一次 bug。模型实际输出格式带 markdown bullet + bold 包装 (`* **[名] (层)** - 定义.`), 原 parser 只识别裸格式。当前 parser 含 `stripBulletAndBold()` + 分隔符容错 (`:` / `：` 都接受)。后续遇到新边角情况可能还需修。

### 目录结构

```text
.
├── app/
│   ├── page.tsx                       # / (待做, Step 4)
│   ├── article/[id]/page.tsx          # 待做, Step 5
│   ├── concepts/page.tsx              # 待做, Step 6
│   ├── concepts/[name]/page.tsx       # 待做, Step 6
│   ├── api/generate-article/route.ts  # ✓ Step 3 完成
│   ├── layout.tsx
│   └── globals.css
├── components/                        # 待做 Step 4+
├── lib/
│   ├── prompts.ts                     # ✓ v5 prompt
│   ├── storage.ts                     # ✓ localStorage helpers
│   ├── llm.ts                         # ✓ Provider 抽象 + parser
│   └── types.ts                       # ✓ Article/Concept/Layer
├── .env.local                         # API key, 不上 git
├── .env.example                       # 模板
├── .gitignore
└── package.json
```

---

## 5. 安全注意

API key 是 server-only secret。客户端代码任何情况下都不能看到 key。

```text
1. env 变量命名
   ✓ GEMINI_API_KEY        (server only)
   ✓ DEEPSEEK_API_KEY      (server only)
   ✗ 不允许任何 NEXT_PUBLIC_*_API_KEY 前缀
     (NEXT_PUBLIC_ 会被 webpack 注入到 client bundle, 暴露)

2. LLM SDK 只在 server 端实例化
   - lib/llm.ts 顶部有 'server-only' import 守卫
   - import { generateArticle } 只能在 api/*/route.ts
   - 不能在 'use client' 组件里直接 import LLM SDK

3. LLM 调用必须走 API route
   - 客户端组件: fetch('/api/generate-article')
   - 不允许客户端 import @google/generative-ai 或 openai SDK

4. .env.local 不上 git
   - .gitignore 必须包含 .env.local 和 .env*.local
   - 仓库根有 .env.example (列 key 名无 value)

5. Vercel 部署
   - API key 在 Dashboard > Settings > Environment Variables 配置
   - 不要 hardcode 在代码里, 不要 commit .env.production

6. 错误返回不要泄露 key
   - try/catch 抓 LLM SDK 错误
   - 返回给前端的 error message 只说 "LLM call failed"
   - 不要把 raw error (可能含 key 片段) 返回
```

### 部署后自检

```text
DevTools Network tab:
  1. 触发"生成解读"
  2. 看 /api/generate-article 的 request headers + body
  3. 不该出现 GEMINI_API_KEY 字符串
  4. View Page Source → Ctrl+F "API_KEY" 应该完全无结果
```

---

## 6. 进度

### 当前

```text
代码实现: Step 1-3 完成
最新 commit: efb9bc1 (branch: main, 共 4 个 commit)
项目目录: ~/Desktop/finews-agent/
开发环境: Claude Code (desktop app)
```

具体已完成:

```text
Phase A (prompt 验证, Gemini AI Studio 手工跑):
  v5 prompt 通过 4.5+/5, 已 freeze 在 lib/prompts.ts

Phase B 代码实现:
  Step 1: Next.js 16 + TypeScript + Tailwind v4 项目初始化
          dev server 跑通
  Step 2: lib/ scaffolding (types/storage/prompts/llm.ts)
          v5 prompt 已嵌入 lib/prompts.ts
  Step 3: api/generate-article/route.ts 跑通
          真实 Gemini API 调用 verified (gemini-3.5-flash 可用)
          端到端测试通过: HTTP 200, ~14s 一条 article
          markdown parser 修了一次 bug (stripBulletAndBold)
```

### 下一步 (剩余 Step 4-8)

```text
Step 4: 首页 + InputForm 组件 (粘新闻 → 调 API)
Step 5: article/[id] 页 + ArticleView 组件 (四段 + concepts link)
Step 6: /concepts 列表页 + /concepts/[name] 详情页
        (cross-article 关联通过 appearances[] 自然体现)
Step 7: 样式打磨 + responsive
Step 8: Vercel deploy + 自己跑 3 条新闻 verify

预计剩余 2-3 小时.
```

### 已知风险/注意

```text
- markdown parser 是 v0 实现, 后续遇到新边角情况可能要继续修
- Vercel 部署时需要在 Dashboard 配置 GEMINI_API_KEY 环境变量
- 跑 LLM 会消耗 Gemini free tier quota, 一条约 $0.005, 
  调试时注意不要无限制重试
- dev 环境下切走应用 (Chrome 进入后台) 等 LLM 响应,
  偶现 "LLM call failed". 怀疑是 dev server hot
  reload / Mac sleep / Chrome tab throttling. 
  deploy 到 Vercel 后大概率消失 (serverless 不依
  赖本地状态). 真要修需要复现时抓 dev server log
  定位.
- 历史 case 缺少 "那次后来发生了什么" (影响 / 结果):
  当前 prompt 只要求 "哪里像 / 哪里不像", 缺时间上
  的延伸. 后续 prompt 优化时加约束: 历史段除了对比,
  还要说那次后续 6-24 个月的关键发展.
- 历史 case 段格式不一致: 不同新闻输出可能用 "像/
  不像"、"相似点/不同点"、"同/异" 等不同标签, 且
  markdown 排版 (bold / bullet / 缩进) 也有差异.
  原因: prompt 没强制固定格式. 后续 prompt 优化时
  统一: 强制用 2 个固定标签 (建议 "**相似点**:" /
  "**不同点**:"), 强制用统一的 markdown bullet 格式.
```
1. 落脚点空泛, "与我无关"
   → prompt 问题
   → 加约束: 链路终点要量化 (涨幅/金额) 或落到
     "对个人意味着什么"
   
2. 术语解释没出现
   → prompt 第 7 条本来要求了, 模型没执行到位
   → 加强约束或加 few-shot example
   
3. 不确定性版面太大
   → 双重问题:
     - prompt: 信息密度可以再压 (限字数)
     - UI: 视觉权重 Step 7 调 (小字号 / 折叠 / 
       页面下移)
     
4. concept 没解释
   → 先想清楚要的形态再说:
     - 段落里 inline 解释 → 改 prompt
     - 鼠标悬停 tooltip → UI 工作
     - 底部 chip 点开看 (现在的样子)

### Phase A 评分历史 (供参考)

```text
v1 原版            3.5 - 3.75
v2 加机制视角约束  4.25
v3 加概念层级标签  4.25 - 4.50
v4 删"关联" section 4.50
v5 换 user 身份 + 加链路具体性 + 加术语解释 4.75 (final)
```