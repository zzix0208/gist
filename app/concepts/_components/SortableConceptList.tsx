'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { ConceptListItem } from '@/lib/types';

type Sort = 'time' | 'count' | 'alpha';

export default function SortableConceptList({
  concepts,
}: {
  concepts: ConceptListItem[];
}) {
  const [sort, setSort] = useState<Sort>('time');

  const sorted = [...concepts].sort((a, b) => {
    if (sort === 'time') return b.firstSeen.localeCompare(a.firstSeen);
    if (sort === 'count') return b.appearanceCount - a.appearanceCount;
    return a.name.localeCompare(b.name);
  });

  return (
    <main className="max-w-2xl mx-auto px-6 sm:px-10 lg:px-16 py-10 lg:py-16 flex flex-col gap-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
        <h1 className="text-[28px] leading-tight tracking-tight font-semibold">Concepts</h1>
        <div className="flex gap-2 text-xs">
          <SortBtn current={sort} value="time" setSort={setSort} label="Recent" />
          <SortBtn current={sort} value="count" setSort={setSort} label="Count" />
          <SortBtn current={sort} value="alpha" setSort={setSort} label="A-Z" />
        </div>
      </header>

      <ul className="flex flex-col divide-y divide-border-default">
        {sorted.map((c) => (
          <li key={c.name}>
            <Link
              href={`/concepts/${encodeURIComponent(c.name)}`}
              className="flex items-baseline gap-3 py-4 hover:bg-surface-hover -mx-3 px-3 rounded-md"
            >
              <span className="text-faint text-xs">{c.layer}</span>
              <span className="text-sm">{c.name}</span>
              <span className="text-xs text-faint ml-auto">
                {c.appearanceCount}×
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
      className={`px-3 py-1.5 rounded-md border ${
        active
          ? 'bg-accent text-accent-foreground border-accent'
          : 'border-border-strong text-muted hover:bg-surface-hover'
      }`}
    >
      {label}
    </button>
  );
}
