'use client';

import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import type { Article } from '@/lib/types';
import LocalTime from '@/components/LocalTime';

export default function ArticleView({ article }: { article: Article }) {
  return (
    <main className="max-w-2xl mx-auto px-6 sm:px-10 lg:px-16 py-10 lg:py-16 flex flex-col gap-10">
      <header>
        <h1 className="text-[28px] leading-tight tracking-tight font-semibold">{article.title}</h1>
        <p className="text-xs text-faint mt-1">
          <LocalTime iso={article.created_at} />
        </p>
        {article.source_url && (
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-link underline underline-offset-2 decoration-faint hover:decoration-foreground mt-1 inline-block"
          >
            View source
          </a>
        )}
      </header>

      {article.sections.summary && (
        <p className="text-base font-semibold leading-7">
          {article.sections.summary}
        </p>
      )}

      <Section heading="Mechanism" body={article.sections.mechanism} />

      <section>
        <h2 className="text-lg font-semibold mb-3">Concepts</h2>
        <div className="flex flex-wrap gap-2.5">
          {article.concepts.map((c) => (
            <Link
              key={c.name}
              href={`/concepts/${encodeURIComponent(c.name)}`}
              className="border border-border-default rounded-md px-2.5 py-1 text-sm hover:bg-surface-hover hover:border-border-strong"
            >
              <span className="text-faint text-xs mr-1">{c.layer}</span>
              {c.name}
            </Link>
          ))}
        </div>
      </section>

      {article.sources && article.sources.length > 0 && (
        <section>
          <h2 className="text-base font-semibold mb-3">Sources checked</h2>
          <ul className="flex flex-col gap-1">
            {article.sources.map((s) => (
              <li key={s.url} className="text-xs leading-6">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link underline underline-offset-2 decoration-faint hover:decoration-foreground"
                >
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Section
        heading="Uncertainty"
        body={article.sections.uncertainty}
        headingClass="text-base font-semibold"
        bodyClass="text-xs leading-6 text-muted"
      />
    </main>
  );
}

function Section({
  heading,
  body,
  headingClass = 'text-lg font-semibold',
  bodyClass = 'text-[15px] leading-7',
}: {
  heading: string;
  body: string;
  headingClass?: string;
  bodyClass?: string;
}) {
  return (
    <section>
      <h2 className={`${headingClass} mb-3`}>{heading}</h2>
      <div
        className={`${bodyClass} [&_p]:mb-3 [&_p:last-child]:mb-0 [&_a]:text-link [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-normal [&_em]:italic [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mb-1`}
      >
        <ReactMarkdown>{body}</ReactMarkdown>
      </div>
    </section>
  );
}
