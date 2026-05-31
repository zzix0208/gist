import { NextResponse } from 'next/server';
import { generateArticle } from '@/lib/llm';
import { createArticleWithConcepts, findExistingSourceUrls } from '@/lib/data';
import { fetchLatest } from '@/lib/rss';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// 手动触发：抓一批 RSS → 去重 → 逐条走现有生成+入库流程。v1 不发邮件。
export async function POST() {
  const items = await fetchLatest().catch((err: unknown) => {
    console.error('[fetch-rss] feed fetch failed:', err);
    return [];
  });

  // 批内按 url 去重 + 对库去重（已抓过的不重复生成）
  const seen = new Set<string>();
  const unique = items.filter((it) => {
    if (seen.has(it.url)) return false;
    seen.add(it.url);
    return true;
  });
  const existing = await findExistingSourceUrls(unique.map((i) => i.url));
  const fresh = unique.filter((it) => !existing.has(it.url));

  let created = 0;
  let failed = 0;
  // 串行：单条失败只跳过该条，不中断整批。
  for (const it of fresh) {
    try {
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
      created += 1;
    } catch (err) {
      failed += 1;
      console.error(`[fetch-rss] item failed, skipped: ${it.source} "${it.title}"`, err);
    }
  }

  return NextResponse.json({
    fetched: items.length,
    skipped: items.length - fresh.length,
    created,
    failed,
  });
}
