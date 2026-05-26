'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadConcepts } from '@/lib/storage';
import type { Concept } from '@/lib/types';

type Sort = 'time' | 'count' | 'alpha';

export default function ConceptsPage() {
  const [concepts, setConcepts] = useState<Concept[]>([]);
  const [mounted, setMounted] = useState(false);
  const [sort, setSort] = useState<Sort>('time');

  useEffect(() => {
    // localStorage is client-only; read once on mount to avoid hydration mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setConcepts(Object.values(loadConcepts()));
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-sm text-zinc-500">加载中...</p>
      </main>
    );
  }

  if (concepts.length === 0) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-600 dark:text-zinc-400">还没有概念.</p>
        <Link href="/" className="text-sm text-blue-600 hover:underline">
          去首页粘一条新闻试试
        </Link>
      </main>
    );
  }

  const sorted = [...concepts].sort((a, b) => {
    if (sort === 'time') return b.first_seen.localeCompare(a.first_seen);
    if (sort === 'count') return b.appearances.length - a.appearances.length;
    return a.name.localeCompare(b.name);
  });

  return (
    <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">概念库</h1>
        <div className="flex gap-2 text-xs">
          <SortBtn current={sort} value="time" setSort={setSort} label="时间" />
          <SortBtn current={sort} value="count" setSort={setSort} label="频次" />
          <SortBtn current={sort} value="alpha" setSort={setSort} label="字母" />
        </div>
      </header>

      <ul className="flex flex-col divide-y divide-zinc-200 dark:divide-zinc-800">
        {sorted.map((c) => (
          <li key={c.name}>
            <Link
              href={`/concepts/${encodeURIComponent(c.name)}`}
              className="flex items-baseline gap-2 py-3 hover:bg-zinc-50 dark:hover:bg-zinc-900 -mx-2 px-2 rounded"
            >
              <span className="text-zinc-500 text-xs">{c.layer}</span>
              <span className="text-sm">{c.name}</span>
              <span className="text-xs text-zinc-400 ml-auto">
                出现 {c.appearances.length} 次
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}

function SortBtn({
  current,
  value,
  setSort,
  label,
}: {
  current: Sort;
  value: Sort;
  setSort: (s: Sort) => void;
  label: string;
}) {
  const active = current === value;
  return (
    <button
      onClick={() => setSort(value)}
      className={`px-2 py-1 rounded border ${
        active
          ? 'bg-zinc-900 text-white border-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:border-zinc-100'
          : 'border-zinc-300 dark:border-zinc-700'
      }`}
    >
      {label}
    </button>
  );
}
