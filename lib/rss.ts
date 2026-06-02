import 'server-only';
import Parser from 'rss-parser';

// 抓取层：唯一换源点就是下面的 FEEDS。换源 / 加源 = 改一行 URL，别处不动。
// 三个都是原生 RSS，无需 RSSHub 中转（比镜像稳）：BBC 综合商业、CNBC 宏观经济、
// CNBC 市场。三家/板块覆盖 综合 + 宏观 + 市场，喂给 LLM 做机制解读。
const FEEDS: { url: string; source: string }[] = [
  { url: 'https://feeds.bbci.co.uk/news/business/rss.xml', source: 'BBC Business' },
  { url: 'https://www.cnbc.com/id/20910258/device/rss/rss.html', source: 'CNBC Economy' },
  { url: 'https://www.cnbc.com/id/15839135/device/rss/rss.html', source: 'CNBC Markets' },
];

export type RssItem = {
  title: string;
  url: string;
  text: string;
  publishedAt: string | null;
  source: string;
};

type ParsedItem = {
  title?: string;
  link?: string;
  content?: string;
  contentSnippet?: string;
  contentEncoded?: string;
  isoDate?: string;
  pubDate?: string;
};

const parser = new Parser({
  // 单源超时上限。原生源（BBC / CNBC）通常 1-3s 返回；给 12s 容网络波动。
  timeout: 12000,
  headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) FinewsBot/0.1' },
  customFields: { item: [['content:encoded', 'contentEncoded']] },
});

// feed 正文常是 HTML，剥成纯文本喂 LLM，跟手动粘贴的格式一致。
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function pickText(it: ParsedItem): string {
  const text = htmlToText(it.contentEncoded || it.content || '');
  if (text.length >= 40) return text;
  return (it.contentSnippet || '').trim(); // 正文太短时退回纯文本摘要
}

// 每源取最新 perFeed 条并归一化。三源并行抓取(allSettled），单源失败只跳过该源、
// 不炸整批；输出按 FEEDS 顺序拼接，与原串行顺序一致。
export async function fetchLatest(perFeed = 2): Promise<RssItem[]> {
  const settled = await Promise.allSettled(
    FEEDS.map(async (feed): Promise<RssItem[]> => {
      const parsed = await parser.parseURL(feed.url);
      const items: RssItem[] = [];
      for (const it of (parsed.items ?? []).slice(0, perFeed) as ParsedItem[]) {
        const title = (it.title ?? '').trim();
        const url = (it.link ?? '').trim();
        const text = pickText(it);
        if (!title || !url || !text) continue;
        items.push({
          title,
          url,
          text,
          publishedAt: it.isoDate ?? it.pubDate ?? null,
          source: feed.source,
        });
      }
      return items;
    }),
  );

  const out: RssItem[] = [];
  settled.forEach((res, i) => {
    if (res.status === 'fulfilled') {
      out.push(...res.value);
      return;
    }
    const feed = FEEDS[i];
    console.warn(
      `[rss] feed failed, skipped: ${feed.source} ${feed.url} —`,
      res.reason instanceof Error ? res.reason.message : res.reason,
    );
  });
  return out;
}
