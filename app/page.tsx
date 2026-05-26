'use client';

import InputForm from '@/components/InputForm';

export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center px-4 py-12 gap-8">
      <header className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold">财经新闻学习</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
          粘新闻 → 生成机制 / 历史 / 不确定性 / 概念
        </p>
      </header>
      <InputForm />
    </main>
  );
}
