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
    <main className="max-w-2xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold">抓取新闻</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          从 RSS 源抓一批财经新闻，自动生成解读
        </p>
      </header>

      <FetchRssButton />

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold text-zinc-500">最新文章</h2>
        {articles.length === 0 ? (
          <p className="text-sm text-zinc-500">还没有文章，点上面的按钮抓一批。</p>
        ) : (
          <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
            {articles.map((a) => (
              <li key={a.id} className="py-3">
                <Link
                  href={`/article/${a.id}`}
                  className="text-base font-medium hover:underline"
                >
                  {a.title}
                </Link>
                {a.summary && (
                  <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1 line-clamp-2">
                    {a.summary}
                  </p>
                )}
                <p className="text-xs text-zinc-400 mt-1">
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
