import 'server-only';

// Tavily web search client. The fact-check agent calls this as a tool; the LLM
// decides when and what to search. Deliberately decoupled from any LLM provider
// — swapping the model never touches this file.
const TAVILY_URL = 'https://api.tavily.com/search';

export type SearchResult = {
  title: string;
  url: string;
  content: string; // snippet Tavily extracted; fed back to the model as context
};

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error('TAVILY_API_KEY not set');

  const res = await fetch(TAVILY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      query,
      // English financial news: 'news' topic + US region returns relevant, recent
      // results. (The old zh setup used general + country:'china' because Tavily's
      // news source skews English and gave off-topic results for Chinese queries.)
      topic: 'news',
      country: 'united states',
      search_depth: 'basic',
      max_results: maxResults,
    }),
    signal: AbortSignal.timeout(15000), // 同 lib/rss.ts / agent 的超时写法
  });
  if (!res.ok) {
    throw new Error(`tavily HTTP ${res.status}: ${await res.text()}`);
  }

  const data = await res.json();
  const results: Array<{ title?: string; url?: string; content?: string }> = Array.isArray(data?.results)
    ? data.results
    : [];
  return results
    .map((r) => ({
      title: (r.title ?? '').trim(),
      url: (r.url ?? '').trim(),
      content: (r.content ?? '').trim(),
    }))
    .filter((r) => r.url.length > 0);
}
