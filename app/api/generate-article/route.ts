import { NextResponse } from 'next/server';
import { generateArticle } from '@/lib/llm';
import { createArticleWithConcepts } from '@/lib/data';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// 核查 agent 比单次调用慢（要联网检索）；给足函数执行时间（部署平台据此设上限）。
// 用满 Vercel Hobby 的 60s 上限（同 fetch-rss）；agent 内部另有 ~50s 软预算兜底。
export const maxDuration = 60;

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'body must be an object' }, { status: 400 });
  }
  const { title, raw_text } = body as { title?: unknown; raw_text?: unknown };
  if (typeof title !== 'string' || !title.trim()) {
    return NextResponse.json({ error: 'title is required' }, { status: 400 });
  }
  if (typeof raw_text !== 'string' || !raw_text.trim()) {
    return NextResponse.json({ error: 'raw_text is required' }, { status: 400 });
  }

  // 单篇生成开启事实核查 agent（联网检索 + 收集来源）。
  const out = await generateArticle(title, raw_text, { useSearch: true }).catch((err: unknown) => {
    console.error('[generate-article] LLM call failed:', err);
    return null;
  });
  if (!out) {
    return NextResponse.json({ error: 'LLM call failed' }, { status: 500 });
  }

  try {
    const { id } = await createArticleWithConcepts({
      title: title.trim(),
      rawText: raw_text.trim(),
      sections: {
        summary: out.result.summary,
        mechanism: out.result.mechanism,
        uncertainty: out.result.uncertainty,
      },
      concepts: out.result.concepts,
      sources: out.sources,
    });
    return NextResponse.json({ id });
  } catch (err) {
    console.error('[generate-article] DB save failed:', err);
    return NextResponse.json({ error: 'DB save failed' }, { status: 500 });
  }
}
