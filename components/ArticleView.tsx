'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import type { Article } from '@/lib/types';
import LocalTime from '@/components/LocalTime';

export default function ArticleView({ article }: { article: Article }) {
  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
      <header>
        <h1 className="text-2xl font-semibold">{article.title}</h1>
        <p className="text-xs text-zinc-500 mt-1">
          <LocalTime iso={article.created_at} />
        </p>
      </header>

      <Section heading="机制 (传导链路)" body={article.sections.mechanism} />

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

      <Section
        heading="历史 (类似 case)"
        body={article.sections.history}
        headingClass="text-base font-semibold"
      />

      <Section
        heading="不确定性"
        body={article.sections.uncertainty}
        headingClass="text-base font-semibold"
        bodyClass="text-xs leading-6 text-zinc-500"
      />
    </main>
  );
}

function Section({
  heading,
  body,
  headingClass = 'text-lg font-semibold',
  bodyClass = 'text-sm leading-7',
}: {
  heading: string;
  body: string;
  headingClass?: string;
  bodyClass?: string;
}) {
  return (
    <section>
      <h2 className={`${headingClass} mb-2`}>{heading}</h2>
      <div
        className={`${bodyClass} [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-semibold [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1`}
      >
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
    </section>
  );
}
