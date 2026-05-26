import type { Article, Concept, Layer } from './types';

const ARTICLES_KEY = 'articles';
const CONCEPTS_KEY = 'concepts';

function read<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function loadArticles(): Article[] {
  return read<Article[]>(ARTICLES_KEY, []);
}

export function saveArticle(article: Article): void {
  const list = loadArticles();
  const next = [article, ...list.filter((a) => a.id !== article.id)];
  write(ARTICLES_KEY, next);
}

export function getArticle(id: string): Article | undefined {
  return loadArticles().find((a) => a.id === id);
}

export function loadConcepts(): Record<string, Concept> {
  return read<Record<string, Concept>>(CONCEPTS_KEY, {});
}

export function upsertConcept(
  c: { name: string; layer: Layer; definition: string },
  articleId: string,
  when: string,
): void {
  const map = loadConcepts();
  const existing = map[c.name];
  if (existing) {
    if (!existing.appearances.includes(articleId)) {
      existing.appearances.push(articleId);
    }
  } else {
    map[c.name] = {
      name: c.name,
      layer: c.layer,
      definition: c.definition,
      first_seen: when,
      appearances: [articleId],
    };
  }
  write(CONCEPTS_KEY, map);
}
