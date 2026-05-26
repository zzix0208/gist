'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { saveArticle, upsertConcept } from '@/lib/storage';
import type { Article, GenerateArticleResult } from '@/lib/types';

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
      const result = (await res.json()) as GenerateArticleResult;

      const id = crypto.randomUUID();
      const createdAt = new Date().toISOString();
      const article: Article = {
        id,
        title: title.trim(),
        raw_text: rawText.trim(),
        created_at: createdAt,
        sections: {
          mechanism: result.mechanism,
          history: result.history,
          uncertainty: result.uncertainty,
        },
        concepts: result.concepts.map((c) => ({ name: c.name, layer: c.layer })),
      };
      saveArticle(article);
      for (const c of result.concepts) {
        upsertConcept(
          { name: c.name, layer: c.layer, definition: c.definition },
          id,
          createdAt,
        );
      }
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
        className="border rounded px-3 py-2"
        disabled={submitting}
      />
      <textarea
        value={rawText}
        onChange={(e) => setRawText(e.target.value)}
        placeholder="粘贴新闻原文 / 摘要"
        rows={10}
        className="border rounded px-3 py-2 font-mono text-sm"
        disabled={submitting}
      />
      <button
        type="submit"
        disabled={!canSubmit}
        className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
      >
        {submitting ? '生成中...' : '生成解读'}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
    </form>
  );
}
