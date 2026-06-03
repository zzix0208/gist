'use client';

import InputForm from '@/components/InputForm';

export default function Home() {
  return (
    <main className="max-w-2xl mx-auto px-6 sm:px-10 lg:px-16 py-10 lg:py-16 flex flex-col gap-8">
      <header className="w-full max-w-2xl">
        <h1 className="text-[28px] leading-tight tracking-tight font-semibold">财经新闻学习</h1>
        <p className="text-sm text-muted mt-1">
          理解机制，积累概念
        </p>
      </header>
      <InputForm />
    </main>
  );
}
