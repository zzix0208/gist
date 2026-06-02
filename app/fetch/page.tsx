import Link from 'next/link';
import { listArticles } from '@/lib/data';
import FetchRssButton from '@/components/FetchRssButton';
import LocalTime from '@/components/LocalTime';

// 始终读库里最新的，不静态缓存。
export const dynamic = 'force-dynamic';

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

export default async function FetchPage() {
  const articles = await listArticles(20);

  return (
    <main className="max-w-2xl mx-auto px-6 sm:px-10 lg:px-16 py-10 lg:py-16 flex flex-col gap-8">
      <header>
        <h1 className="text-[28px] leading-tight tracking-tight font-semibold">Fetch News</h1>
        <p className="text-sm text-muted mt-1">
          Pull a batch of financial news from RSS feeds and auto-generate interpretations
        </p>
      </header>

      <FetchRssButton />

      <section className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-muted">Latest articles</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-muted">No articles yet. Click the button above to fetch a batch.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-border-default">
            {articles.map((a) => (
              <li key={a.id} className="py-4 -mx-3 px-3 rounded-md hover:bg-surface-hover transition-colors">
                <Link
                  href={`/article/${a.id}`}
                  className="text-base font-medium hover:underline underline-offset-2"
                >
                  {a.title}
                </Link>
                {a.summary && (
                  <p className="text-sm text-muted mt-1 line-clamp-2">
                    {a.summary}
                  </p>
                )}
                <p className="text-xs text-faint mt-1">
                  {a.source_url && <span className="mr-2">{hostOf(a.source_url)}</span>}
                  <LocalTime iso={a.created_at} />
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
