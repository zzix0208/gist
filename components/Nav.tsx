import Link from 'next/link';

export default function Nav() {
  return (
    <nav className="flex justify-between items-center px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
      <Link href="/" className="font-semibold text-sm">
        财经新闻学习 Agent
      </Link>
      <Link
        href="/concepts"
        className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
      >
        概念库
      </Link>
    </nav>
  );
}
