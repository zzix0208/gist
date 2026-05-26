import { NextResponse } from 'next/server';
import { generateArticle } from '@/lib/llm';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  try {
    const result = await generateArticle(title, raw_text);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[generate-article] LLM call failed:', err);
    return NextResponse.json({ error: 'LLM call failed' }, { status: 500 });
  }
}
