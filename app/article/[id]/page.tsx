'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { getArticle } from '@/lib/storage';
import ArticleView from '@/components/ArticleView';
import type { Article } from '@/lib/types';

export default function ArticlePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [article, setArticle] = useState<Article | undefined>(undefined);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // localStorage is client-only; reading it during render would cause
    // a hydration mismatch, so we set state once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setArticle(getArticle(id));
    setMounted(true);
  }, [id]);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-zinc-500">加载中...</p>
      </main>
    );
  }

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
