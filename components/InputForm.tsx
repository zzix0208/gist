'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function InputForm() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [rawText, setRawText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && rawText.trim().length > 0 && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 w-full max-w-2xl">
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
        {submitting ? '生成中...' : '生成解读'}
      </button>
      {error && <p className="text-danger text-sm">{error}</p>}
    </form>
  );
}
