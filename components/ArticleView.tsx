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
        {article.source_url && (
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline mt-1 inline-block"
          >
            查看原文
          </a>
        )}
      </header>

      {article.sections.summary && (
        <p className="text-base font-semibold leading-7">
          {article.sections.summary}
        </p>
      )}

      <Section heading="机制" body={article.sections.mechanism} />

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

      {article.sources && article.sources.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-2">核查来源</h2>
          <ul className="flex flex-col gap-1">
            {article.sources.map((s) => (
              <li key={s.url} className="text-xs leading-6">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

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
        className={`${bodyClass} [&_p]:mb-2 [&_p:last-child]:mb-0 [&_strong]:font-normal [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1`}
      >
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
    </section>
  );
}
