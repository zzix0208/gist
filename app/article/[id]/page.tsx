import Link from 'next/link';
import { getArticle } from '@/lib/data';
import ArticleView from '@/components/ArticleView';

// Always read the latest from the DB (no static caching of this route).
export const dynamic = 'force-dynamic';

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const article = await getArticle(id);

  if (!article) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">Article not found.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          回首页
        </Link>
      </main>
    );
  }

  return <ArticleView article={article} />;
}
