'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/', label: '首页', match: (p: string) => p === '/' },
  { href: '/fetch', label: '抓取', match: (p: string) => p.startsWith('/fetch') },
  { href: '/concepts', label: '概念库', match: (p: string) => p.startsWith('/concepts') },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="shrink-0 border-b border-border-default bg-paper-subtle md:sticky md:top-0 md:h-screen md:w-60 md:self-start md:border-b-0 md:border-r">
      <div className="flex items-center justify-between gap-2 px-3 py-3 md:flex-col md:items-stretch md:justify-start md:gap-1 md:py-6">
        <Link href="/" className="px-3 py-1.5 text-sm font-semibold md:mb-3">
          <span className="hidden sm:inline">财经新闻学习 Agent</span>
          <span className="sm:hidden">财经 Agent</span>
        </Link>
        <nav className="flex items-center gap-1 md:flex-col md:items-stretch">
          {NAV.map((item) => {
            const active = item.match(pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  active
                    ? 'bg-background text-foreground font-medium shadow-sm'
                    : 'text-muted hover:bg-foreground/[0.05] hover:text-foreground'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
