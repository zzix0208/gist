'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Result = { fetched: number; skipped: number; created: number; failed: number };

export default function FetchRssButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFetch() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/fetch-rss', { method: 'POST' });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const data = (await res.json()) as Result;
      setResult(data);
      router.refresh(); // 刷新下面的服务端"最新文章"列表
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        onClick={handleFetch}
        disabled={loading}
        className="bg-accent text-accent-foreground px-4 py-2.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:opacity-80 self-start"
      >
        {loading ? '抓取中...' : '抓取新闻'}
      </button>
      {result && (
        <p className="text-sm text-muted">
          抓取 {result.fetched}，新增 {result.created}，跳过 {result.skipped}
          {result.failed > 0 ? `，失败 ${result.failed}` : ''}
        </p>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
