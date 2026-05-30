# MIGRATION — localStorage → Supabase Postgres + Prisma

本文件是这次存储迁移的执行清单 + 进度记录。每完成一步,更新对应 Step 的"状态"并勾选 `- [x]`。
**动手前先读这份文件,确认现在在第几步。** 完整设计见 `~/.claude/plans/localstorage-rss-lazy-locket.md`。

## 进度总览

| Step | 内容 | 状态 |
|---|---|---|
| 1 | 建库 / 装 Prisma / 建表 | ✅ 已完成 (2026-05-30) |
| 2 | 写入路径(贴新闻存进数据库) | ✅ 已完成 (2026-05-30) |
| 3 | 文章详情页改读数据库 | ✅ 已完成 (2026-05-30) |
| 4 | 概念库两页改读数据库 | ✅ 已完成 (2026-05-30) |
| 5 | 收尾(代码)+ 部署 | ✅ 代码完成 (2026-05-30) / 部署待办 |

状态图例:⬜ 未开始 / 🔄 进行中 / ✅ 已完成

**代码迁移 Step 1-5 已全部完成 (2026-05-30),读写都在 Postgres;仅剩部署,按要求以后单独做。**

---

## 背景 / 选型

迁移本质:把"存数据 / 读数据"从浏览器搬到服务器。原因是接下来的 RSS 自动抓取和每日邮件都在服务器上跑、没有浏览器,localStorage 撑不住。本次只做存储迁移,RSS / 邮件不在范围内,但表结构一次设计到位。

- 数据库:Supabase(托管 Postgres),自带 auth,对齐 v1 的用户登录规划。
- ORM:Prisma(schema 文件声明表结构、一条命令建表、自带 Studio GUI、类型安全)。

关键概念:浏览器不能直接连数据库,数据库密码是服务端机密(和 API key 一样)。所以存 / 读逻辑必须在服务端。

---

## 环境变量说明(重要,Step 1 会用到)

数据库连接串放在 **`.env`**,不是 `.env.local`。原因:Prisma 命令行默认只读 `.env`;Next.js 两个文件都读。两个文件都被 git 忽略。

| 文件 | 放什么 | 谁读 | 进 git? |
|---|---|---|---|
| `.env` | `DATABASE_URL`、`DIRECT_URL`(数据库) | Prisma CLI + Next.js | 否 |
| `.env.local` | `GEMINI_API_KEY` 等(LLM,已有) | Next.js | 否 |
| `.env.example` | 上述变量名的空模板 | 人看 | 是 |

- `DATABASE_URL`:连接池串(端口 6543,带 `?pgbouncer=true`),应用运行时查询用。
- `DIRECT_URL`:直连串(端口 5432),Prisma 建表 / 迁移用。
- 两个都从 Supabase 控制台 Connect → ORMs → Prisma 直接复制,绝不能加 `NEXT_PUBLIC_` 前缀。

---

## 表结构(`prisma/schema.prisma`)

三张表:两张主表 + 一张连接表。

```prisma
model Article {              // 一篇解读一行,四段拆成三个字段
  id        String   @id @default(cuid())   // 服务端生成 id
  title     String
  sourceUrl String?  @map("source_url")
  rawText   String   @map("raw_text")
  createdAt DateTime @default(now()) @map("created_at")
  mechanism   String
  history     String
  uncertainty String
  concepts ArticleConcept[]
  @@index([createdAt])
  @@map("articles")
}

model Concept {              // 一个概念一行,名字做主键
  name       String   @id
  layer      String          // 宏观 / 产业 / 微观 / 技术(先用字符串)
  definition String
  firstSeen  DateTime @default(now()) @map("first_seen")
  appearances ArticleConcept[]
  @@map("concepts")
}

model ArticleConcept {       // 连接表:哪篇文章用了哪个概念
  articleId   String  @map("article_id")
  conceptName String  @map("concept_name")
  role        String?         // 预留:概念在该文章里的角色(backlog 功能)
  article Article @relation(fields: [articleId], references: [id], onDelete: Cascade)
  concept Concept @relation(fields: [conceptName], references: [name], onDelete: Cascade)
  @@id([articleId, conceptName])   // 复合主键 = 同文章同概念不重复
  @@index([conceptName])
  @@map("article_concepts")
}
```

---

## 文件清单

新增:`prisma/schema.prisma`、`lib/db.ts`(Prisma 单例)、`lib/data.ts`(服务端数据函数,取代 storage.ts)、`app/concepts/_components/SortableConceptList.tsx`(客户端排序小组件)、`.env`(真实连接串)。

修改:`.env.example`、`package.json`(加 prisma 依赖 + `postinstall: prisma generate`)、`app/article/[id]/page.tsx`、`app/concepts/[name]/page.tsx`、`components/InputForm.tsx`、`app/concepts/page.tsx`、`app/api/generate-article/route.ts`、`lib/types.ts`。

删除(最后):`lib/storage.ts`。

不碰(保护现有功能):`lib/prompts.ts`(v5 prompt 未动)、`components/ArticleView.tsx`、`Nav.tsx`、`layout.tsx`、首页。
注:`lib/llm.ts` 原定不动,Step 2 经批准只修了概念 parser(`parseConceptsBlock`),Gemini 调用与 prompt 未变。

---

## Step 1 — 建库 / 装 Prisma / 建表

状态:✅ 已完成 (2026-05-30)。Supabase 项目 eu-west-1,迁移 `20260530064121_init`,池串 + 直连串均验证可连,三张表为空。

代码部分(我做):
- [x] 创建 `prisma/schema.prisma`(上面那份)
- [x] 创建 `lib/db.ts`(Prisma 单例)
- [x] 安装 `prisma` + `@prisma/client`(v6.19.3),加 `postinstall` 脚本
- [x] 更新 `.env.example`,创建 `.env` 占位
- [x] `npx prisma generate` 通过

手动部分(你做,我给指引):
- [x] supabase.com 注册 + 建项目(记住数据库密码)
- [x] Connect → ORMs → Prisma 复制两个连接串,填进 `.env`

建表(我做,等你填好 `.env` 后):
- [x] `npx prisma migrate dev --name init` 成功,建出三张表

验证标准:
- [x] `npx prisma studio` 打开,能看到 `articles`、`concepts`、`article_concepts` 三张空表(待你浏览器确认)
- [x] app 仍跑在 localStorage 上,功能没变(本步未改任何 app 运行代码,`lib/db.ts` 还没被任何地方 import)

**Step 1 做完到此停下,等确认后再进 Step 2。**

---

## Step 2 — 写入路径(贴新闻存进数据库)

状态:✅ 已完成 (2026-05-30)。文章 + 概念 + 连接行均正确入库;parser 已修(经批准,仅动解析)。

任务:
- [x] 写 `lib/data.ts`:`createArticleWithConcepts`(服务端生成 id/时间;按 name 去重概念;一个事务里建 article → createMany 概念(skipDuplicates,首次定义为准)→ 建连接行)+ 读函数 `getArticle` / `listConcepts` / `getConcept`
- [x] 改 `app/api/generate-article/route.ts`:生成后调存库,返回 `{ id }`(LLM 错误与 DB 错误分开处理)
- [x] 给 `components/InputForm.tsx` 瘦身:删掉客户端 id/时间/存储,改成提交后跳转到返回的 id

验证标准(看数据库,不看页面):
- [x] 文章入库:POST 一条 CPI 新闻 → HTTP 200,`articles` 出现一行,四段完整,`id` 为服务端 cuid、时间为服务端时间
- [x] 写入逻辑(含概念去重 + 连接行):合成数据测试通过(3 概念含 1 重复 → 入库 2 + 连接 2,跑完已清理)
- [x] 真实 LLM 概念入库:parser 修复后通过。重 POST CPI 新闻 → article=1、concepts=2(核心CPI/宏观、猪周期/产业)、joins=2。
- 注意:文章详情页还是旧的,跳转过去会显示"找不到文章",属正常中间态,Step 3 才修

### 已解决(2026-05-30):概念 parser 格式不匹配
- 现象:`gemini-3.5-flash` 输出概念为 `* **核心CPI** (宏观) - 定义`(加粗、无方括号),旧 parser 只认 `[名]` 方括号 → 0 概念。
- 处理(经批准,选项 1):改 `lib/llm.ts` 的 `parseConceptsBlock` —— 方括号变可选,且"含 `(层)` 标记"的行也识别为一条概念。只动解析,未碰 Gemini 调用和 v5 prompt。
- 验证:离线用真实输出测得 2 概念;端到端重 POST 后 concepts=2、joins=2。

---

## Step 3 — 文章详情页改读数据库(端到端跑通)

状态:✅ 已完成 (2026-05-30)。article/[id] 改为 async 服务端组件 + `dynamic='force-dynamic'`,查 `getArticle` 渲染。

任务:
- [x] 把 `app/article/[id]/page.tsx` 改成 `async` 服务端组件:查库 → 查不到显示原"找不到"块 → 查到渲染 `ArticleView`(去掉 'use client'/useEffect/mounted)

验证标准:
- [x] GET /article/<id> → 200,服务端 HTML 含标题 / 机制 / 核心CPI / 猪周期 / 不确定性(直接从 DB 渲染)
- [x] 不存在的 id → 显示 "Article not found"
- [x] 核心"生成 → 存 → 渲染"全链路已在数据库上
- 注意:概念 chip 和顶部"概念库"指向的 `/concepts` 仍是旧页(localStorage),Step 4 前点进去会空/找不到,属正常中间态

---

## Step 4 — 概念库两页改读数据库

状态:✅ 已完成 (2026-05-30)。两页改服务端组件查库,排序拆成客户端 SortableConceptList。自动验证通过;排序点击待浏览器确认。

任务:
- [x] 拆出 `app/concepts/_components/SortableConceptList.tsx`(客户端排序;视图类型 `ConceptListItem` 放 `lib/types.ts`,避免把 server-only 的 data 模块打进客户端)
- [x] `app/concepts/page.tsx` 改成服务端组件 `listConcepts()`,空态服务端处理,列表交客户端组件
- [x] `app/concepts/[name]/page.tsx` 改成服务端组件 `getConcept()`,出现过的文章已在服务端 join 好

验证标准:
- [x] `/concepts` → 200,列出 5 个概念,排序按钮 时间/频次/字母 都渲染(点击交互待浏览器确认)
- [x] 概念详情 → 200,显示定义 + 出现过的文章列表
- [x] 共享概念计数:两条 CPI 新闻 → `核心CPI` appearances=2,挂在两篇文章下
- 备注:期间在浏览器贴的"货币政策执行报告"也正常入库,印证浏览器完整流程可用

---

## Step 5 — 收尾(代码)+ 部署(以后单独做)

状态:✅ 代码收尾完成 (2026-05-30);部署按要求留待以后单独做。

代码收尾(本次完成):
- [x] 删 `lib/storage.ts`(并移除 `types.ts` 里旧的 `Concept` 类型)
- [x] 处理时间显示的时区 / hydration 问题:新增 `components/LocalTime.tsx`,文章页 + 概念详情页时间戳改用它(SSR 输出稳定值、挂载后切本地时区,无 hydration 警告)
- [x] 更新 `PROJECT.md`(技术栈 / schema / API / 目录 / 进度);`.env.example` 已在 Step 1 更新

代码收尾验证:
- [x] `npm run build` 通过,无残留 storage import 报错;4 个读写路由标为 ƒ Dynamic
- [x] 全局搜 `@/lib/storage` / `loadConcepts` / `saveArticle` 等无残留引用

部署(以后单独做,不在本次范围):
- [ ] Vercel 后台配 `DATABASE_URL` + `DIRECT_URL`(Production 和 Preview 都配)
- [ ] 部署;对生产库跑 `prisma migrate deploy`
- [ ] 线上贴新闻,刷新还在,换浏览器也在(localStorage 限制消失)
- [ ] DevTools Network / Page Source 搜不到数据库串或密码
- [ ] 部署后确认 `LocalTime` 已消除时区 hydration 警告(本地同机不显现,线上才显现)

---

## 风险备忘

- Supabase 连接池:`DATABASE_URL`(池,6543)给应用,`DIRECT_URL`(直连,5432)给迁移,两个都要配。
- `postinstall: prisma generate` 必须加,否则 Vercel 部署常因客户端没生成而构建失败。
- 开发热重载泄漏数据库连接:靠 `lib/db.ts` 单例解决。
- 概念重复:模型偶尔把同一概念列两遍,复合主键会拒绝;`createArticleWithConcepts` 先按 name 去重。
- Supabase 免费项目闲置约一周会暂停,第一次访问要恢复 / 会慢(以官网为准)。
- 旧的 localStorage 测试数据不自动迁移,迁移后从数据库重新开始;想留就手动重贴。
- 生成流程(`lib/llm.ts` 的 Gemini 调用 / prompt)和前端渲染(`ArticleView`)外观零改动,改的只是数据从哪来。
- 时间显示(部署后才显现,本地同机不显现):文章页 `ArticleView` 是客户端组件、现由服务端 SSR,`toLocaleString()` 在服务器(Vercel 默认 UTC)和浏览器(本地时区)可能不一致 → 生产环境有 hydration 警告;概念详情页是纯服务端组件,时间按服务器时区(UTC)显示。Step 5 部署前处理:给 `ArticleView` 的时间加 `suppressHydrationWarning`,或统一时间格式 / 时区。
