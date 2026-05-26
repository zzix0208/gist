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

Next.js 14 (App Router) + TypeScript + Tailwind / @google/generative-ai (Demo Gemini 3.5 Flash) → 后续切 DeepSeek (兼容 OpenAI API) / localStorage (v0 单用户) / Vercel 部署

### Data schema

```ts
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
  concepts: Array<{
    name: string;
    layer: '宏观' | '产业' | '微观' | '技术';
  }>;
};

type Concept = {
  name: string;
  layer: '宏观' | '产业' | '微观' | '技术';
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
    concepts: Array<{ name: string, layer: string, definition: string }> 
  }
```

Provider 抽象在 `lib/llm.ts`, 根据 `process.env.LLM_PROVIDER` 切 Gemini / DeepSeek, 切换只改 1 个文件 + 1 个 env 变量。

### 目录结构

```text
.
├── app/
│   ├── page.tsx                       # /
│   ├── article/[id]/page.tsx          # /article/:id
│   ├── concepts/page.tsx              # /concepts
│   ├── concepts/[name]/page.tsx       # /concepts/:name
│   ├── api/generate-article/route.ts  # POST endpoint (server only)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── InputForm.tsx
│   ├── ArticleView.tsx
│   ├── ConceptList.tsx
│   └── Nav.tsx
├── lib/
│   ├── prompts.ts                     # v5 prompt
│   ├── storage.ts                     # localStorage helpers (client only)
│   ├── llm.ts                         # Provider abstraction (server only)
│   └── types.ts
├── .env.local                         # 本地 secret, 不上 git
├── .env.example                       # 模板, 列 key 名无 value
├── .gitignore
├── package.json
└── README.md
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
   - lib/llm.ts 顶部不要写 'use client'
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

**现在**: prompt 已在 Gemini AI Studio 手工验证 (v5, 见第 3 节), 待写代码.

**下一步**:
1. init Next.js + TypeScript + Tailwind 项目
2. 实现 lib/types.ts + storage.ts + prompts.ts (放 v5) + llm.ts
3. 实现 api/generate-article/route.ts, 跑通 curl 测试
4. 实现首页 + InputForm 组件
5. 实现 article/[id] 页 + ArticleView 组件
6. 实现 concepts 列表页 + 单概念详情页
7. 样式打磨 + responsive
8. Vercel deploy + 自己跑 3 条新闻 verify

预计 4-5 小时跑通.