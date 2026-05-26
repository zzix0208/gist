'use client';

import Link from 'next/link';
import type { Article } from '@/lib/types';

export default function ArticleView({ article }: { article: Article }) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">{article.title}</h1>
        <p className="text-xs text-zinc-500 mt-1">
          {new Date(article.created_at).toLocaleString()}
        </p>
      </header>

      <Section heading="机制 (传导链路)" body={article.sections.mechanism} />
      <Section heading="历史 (类似 case)" body={article.sections.history} />
      <Section heading="不确定性" body={article.sections.uncertainty} />

      <section>
        <h2 className="text-lg font-semibold mb-2">概念</h2>
        <div className="flex flex-wrap gap-2">
          {article.concepts.map((c) => (
            <Link
              key={c.name}
              href={`/concepts/${encodeURIComponent(c.name)}`}
              className="border rounded px-2 py-1 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              <span className="text-zinc-500 text-xs mr-1">{c.layer}</span>
              {c.name}
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}

function Section({ heading, body }: { heading: string; body: string }) {
  return (
    <section>
      <h2 className="text-lg font-semibold mb-2">{heading}</h2>
      <p className="whitespace-pre-wrap text-sm leading-7">{body}</p>
    </section>
  );
}
