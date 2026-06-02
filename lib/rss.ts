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
  // 单源超时上限。8s（原 15s）让卡住的镜像源更快放弃，配合 fetchLatest 的并行抓取，
  // 坏源不再把整批拖到 15s；稳的人民网源远快于此，不受影响。
  timeout: 8000,
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
