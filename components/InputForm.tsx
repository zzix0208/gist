'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

// 单篇生成约 15-20s（联网核查 + 定稿）。提交后用骨架 + 阶段文案占位，替代长时白屏。
// 文案按 agent 真实节奏定时切换，是近似进度（单请求拿不到内部进度，本档不上 SSE）。
const PHASES = ['联网核查原文…', '梳理机制与概念…', '即将完成…'];

export default function InputForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [phase, setPhase] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && rawText.trim().length > 0 && !submitting;

  // 提交期间推进阶段文案：0-7s / 7-14s / 14s+。完成或卸载时清理定时器。
  // phase 的重置放在 handleSubmit 开头，避免在 effect body 里同步 setState。
  useEffect(() => {
    if (!submitting) return;
    const t1 = setTimeout(() => setPhase(1), 7000);
    const t2 = setTimeout(() => setPhase(2), 14000);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [submitting]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setPhase(0);
    setError(null);
    try {
      const res = await fetch('/api/generate-article', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), raw_text: rawText.trim() }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { id } = (await res.json()) as { id: string };
      router.push(`/article/${id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'unknown error');
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-8 w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="新闻标题"
          className="border border-border-strong rounded-md px-3 py-2.5 bg-paper transition-colors placeholder:text-faint focus:border-foreground"
          disabled={submitting}
        />
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          placeholder="粘贴新闻原文 / 摘要"
          rows={10}
          className="border border-border-strong rounded-md px-3 py-2.5 font-mono text-sm bg-paper transition-colors placeholder:text-faint focus:border-foreground"
          disabled={submitting}
        />
        <button
          type="submit"
          disabled={!canSubmit}
          className="bg-accent text-accent-foreground px-4 py-2.5 rounded-md disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:opacity-80"
        >
          {submitting ? '生成中…' : '生成解读'}
        </button>
        {error && <p className="text-danger text-sm">{error}</p>}
      </form>

      {submitting && (
        <div className="flex flex-col gap-6" aria-live="polite">
          <p className="text-sm text-muted">{PHASES[phase]}</p>
          {['summary', 'mechanism', 'uncertainty'].map((key) => (
            <div key={key} className="flex flex-col gap-2">
              <div className="h-4 w-16 rounded bg-surface-hover animate-pulse" />
              <div className="h-3 w-full rounded bg-surface-hover animate-pulse" />
              <div className="h-3 w-11/12 rounded bg-surface-hover animate-pulse" />
              <div className="h-3 w-4/5 rounded bg-surface-hover animate-pulse" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
