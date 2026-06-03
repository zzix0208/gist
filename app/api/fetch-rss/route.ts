import { NextResponse } from 'next/server';
import { generateArticle } from '@/lib/llm';
import { createArticleWithConcepts, findExistingSourceUrls } from '@/lib/data';
import { fetchLatest } from '@/lib/rss';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 批量串行生成耗时长；给足函数时间（Vercel Hobby 上限 60s），配合下面的每批上限兜底。
export const maxDuration = 60;

// 每次最多生成的篇数。单篇无搜索约 5-10s，5 篇留足余量不超 60s；超出的留到下次触发。
const MAX_PER_RUN = 5;

// 手动触发：抓一批 RSS → 去重 → 逐条走现有生成+入库流程。v1 不发邮件。
export async function POST() {
  const items = await fetchLatest().catch((err: unknown) => {
    console.error('[fetch-rss] feed fetch failed:', err);
    return [];
  });

  // 批内去重：按 url + 标准化标题。同一条新闻常出现在多个源、url 不同，
  // 靠标题（去空白/标点、转小写）兜住完全同名的重复。注：不同源用不同措辞
  // 写同一事件（标题不一样）无法靠此命中，那需要语义去重，暂不做。
  const seenUrl = new Set<string>();
  const seenTitle = new Set<string>();
  const normTitle = (s: string) =>
    s.trim().toLowerCase().replace(/[\s，。、；：！？""''（）()【】《》〈〉\-—~·.,!?;:'"]/g, '');
  const unique = items.filter((it) => {
    const t = normTitle(it.title);
    if (seenUrl.has(it.url) || (t && seenTitle.has(t))) return false;
    seenUrl.add(it.url);
    if (t) seenTitle.add(t);
    return true;
  });
  const existing = await findExistingSourceUrls(unique.map((i) => i.url));
  const fresh = unique.filter((it) => !existing.has(it.url));

  // 控制单次处理量，避免串行生成超过函数时间上限；超出的留到下次触发。
  const batch = fresh.slice(0, MAX_PER_RUN);

  // 并行生成整批（allSettled）：单条失败只跳过该条、不中断整批；并发写库安全
  // （createArticleWithConcepts 内 concept.createMany skipDuplicates → ON CONFLICT DO NOTHING）。
  const settled = await Promise.allSettled(
    batch.map(async (it) => {
      // RSS 批处理不开搜索（避免串行 × 多轮检索拖慢、耗额度）。
      const { result } = await generateArticle(it.title, it.text);
      await createArticleWithConcepts({
        title: it.title,
        rawText: it.text,
        sourceUrl: it.url,
        sections: {
          summary: result.summary,
          mechanism: result.mechanism,
          uncertainty: result.uncertainty,
        },
        concepts: result.concepts,
      });
    }),
  );

  let created = 0;
  let failed = 0;
  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      created += 1;
      return;
    }
    failed += 1;
    const it = batch[i];
    console.error(`[fetch-rss] item failed, skipped: ${it.source} "${it.title}"`, res.reason);
  });

  return NextResponse.json({
    fetched: items.length,
    skipped: items.length - fresh.length,
    created,
    failed,
    deferred: fresh.length - batch.length, // 因每批上限本次未处理、留到下次的条数
  });
}
