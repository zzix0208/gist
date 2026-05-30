'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Nav() {
  const pathname = usePathname();
  const homeActive = pathname === '/';
  const fetchActive = pathname.startsWith('/fetch');
  const conceptsActive = pathname.startsWith('/concepts');

  return (
    <nav className="flex justify-between items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
      <Link
        href="/"
        className={`text-sm font-semibold ${
          homeActive ? 'underline underline-offset-4 decoration-2' : ''
        }`}
      >
        <span className="hidden sm:inline">财经新闻学习 Agent</span>
        <span className="sm:hidden">财经 Agent</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/fetch"
          className={`text-sm ${
            fetchActive
              ? 'font-semibold underline underline-offset-4 decoration-2'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          抓取
        </Link>
        <Link
          href="/concepts"
          className={`text-sm ${
            conceptsActive
              ? 'font-semibold underline underline-offset-4 decoration-2'
              : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100'
          }`}
        >
          概念库
        </Link>
      </div>
    </nav>
  );
}
