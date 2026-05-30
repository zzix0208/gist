import 'server-only';
import Parser from 'rss-parser';

// 抓取层：唯一换源点就是下面的 FEEDS。换源 / 加源 = 改一行 URL，别处不动。
// 前两个走第三方 RSSHub 镜像（比原生脆）；镜像挂了把 MIRROR 换成备用 host
// （如 https://hub.slarker.me）即可。人民网是原生源，最稳，当兜底锚。
const MIRROR = 'https://rsshub.rssforever.com';

const FEEDS: { url: string; source: string }[] = [
  { url: `${MIRROR}/wallstreetcn/news/global`, source: '华尔街见闻' },
  { url: `${MIRROR}/yicai/headline`, source: '第一财经' },
  { url: 'http://www.people.com.cn/rss/finance.xml', source: '人民网财经' },
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
  timeout: 15000,
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

// 每源取最新 perFeed 条并归一化。单源失败只跳过该源，不炸整批。
export async function fetchLatest(perFeed = 2): Promise<RssItem[]> {
  const out: RssItem[] = [];
  for (const feed of FEEDS) {
    try {
      const parsed = await parser.parseURL(feed.url);
      for (const it of (parsed.items ?? []).slice(0, perFeed) as ParsedItem[]) {
        const title = (it.title ?? '').trim();
        const url = (it.link ?? '').trim();
        const text = pickText(it);
        if (!title || !url || !text) continue;
        out.push({
          title,
          url,
          text,
          publishedAt: it.isoDate ?? it.pubDate ?? null,
          source: feed.source,
        });
      }
    } catch (err) {
      console.warn(
        `[rss] feed failed, skipped: ${feed.source} ${feed.url} —`,
        err instanceof Error ? err.message : err,
      );
    }
  }
  return out;
}
