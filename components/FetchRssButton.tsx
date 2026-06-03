'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

type Result = { fetched: number; skipped: number; created: number; failed: number };

// 抓取（并行三源 ~10s）+ 并行生成整批（~10s），合计约 20s。抓取期间用阶段文案 +
// 占位条替代白屏。文案按真实节奏定时切换（单请求拿不到内部进度）。
const PHASES = ['正在抓取新闻源…', '正在生成解读…'];

export default function FetchRssButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 抓取期间推进阶段文案：0-10s 抓源 / 10s+ 生成。完成或卸载时清理定时器。
  // phase 的重置放在 handleFetch 开头，避免在 effect body 里同步 setState。
  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setPhase(1), 10000);
    return () => clearTimeout(t);
  }, [loading]);

  async function handleFetch() {
    setLoading(true);
    setPhase(0);
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
      router.refresh(); // 刷新下面的服务端“最新文章”列表
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={handleFetch}
        disabled={loading}
        className="bg-accent text-accent-foreground px-4 py-2.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:opacity-80 self-start"
      >
        {loading ? '抓取中…' : '抓取新闻'}
      </button>

      {loading && (
        <div className="flex flex-col gap-3" aria-live="polite">
          <p className="text-sm text-muted">{PHASES[phase]}</p>
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex flex-col gap-2 py-2">
              <div className="h-4 w-3/4 rounded bg-surface-hover animate-pulse" />
              <div className="h-3 w-full rounded bg-surface-hover animate-pulse" />
            </div>
          ))}
        </div>
      )}

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
