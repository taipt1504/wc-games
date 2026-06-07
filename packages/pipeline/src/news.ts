/**
 * News pipeline service — AI draft generation + scheduled auto-publish.
 * NEWS-01: generateAndStoreNews (generate drafts into review queue)
 * NEWS-04: publishDueNews (auto-publish scheduled articles)
 */
import type { PrismaClient } from '@wc/db';
import { generateNewsDraft } from '@wc/ai';
import type { LlmGateway } from '@wc/ai';

export interface NewsSource {
  sourceTitle: string;
  sourceUrl?: string;
  model?: string;
}

/** Whitelisted football news RSS feeds (syndication-friendly; we take title+link only). */
export const NEWS_FEEDS = [
  'https://feeds.bbci.co.uk/sport/football/rss.xml',
  'https://www.theguardian.com/football/rss',
];

type FetchText = (url: string) => Promise<string>;
const defaultFetchText: FetchText = async (url) => {
  const res = await fetch(url, { headers: { 'user-agent': 'GOLAZO-news-bot' } });
  if (!res.ok) throw new Error(`feed ${url} → ${res.status}`);
  return res.text();
};

function stripTag(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  if (!m) return '';
  return m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').trim();
}

/** Parse an RSS feed into {title, link} items (title+link only — no body, copyright-safe). */
export function parseRss(xml: string): { title: string; link: string }[] {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items
    .map((it) => ({ title: stripTag(it, 'title'), link: stripTag(it, 'link') }))
    .filter((x) => x.title.length > 0);
}

/**
 * Crawl whitelisted feeds → NewsSource[] (title + source URL only). Dead feeds are skipped.
 * Capped to keep the downstream LLM rewrite cheap. PRD §10: rewrite + cite, never copy verbatim.
 */
export async function crawlNewsSources(
  opts: { feeds?: string[]; perFeed?: number; max?: number; fetchText?: FetchText } = {},
): Promise<NewsSource[]> {
  const feeds = opts.feeds ?? NEWS_FEEDS;
  const perFeed = opts.perFeed ?? 3;
  const max = opts.max ?? 6;
  const fetchText = opts.fetchText ?? defaultFetchText;
  const out: NewsSource[] = [];
  for (const feed of feeds) {
    try {
      const items = parseRss(await fetchText(feed)).slice(0, perFeed);
      for (const it of items) out.push({ sourceTitle: it.title, sourceUrl: it.link || feed });
    } catch { /* skip unreachable feed */ }
    if (out.length >= max) break;
  }
  return out.slice(0, max);
}

/** Deterministic seed headlines usable without a live crawl source. */
export const SAMPLE_SOURCES: NewsSource[] = [
  {
    sourceTitle: 'Spain edge Germany in a tactical classic',
    sourceUrl: 'https://goalwire.example/spain-germany',
  },
  {
    sourceTitle: 'Brazil preview: Vinícius set to start against Nigeria',
    sourceUrl: 'https://goalwire.example/brazil-nigeria',
  },
  {
    sourceTitle: 'Transfer buzz: midfielder eyeing a summer switch',
    sourceUrl: 'https://mercato.example/buzz',
  },
];

function inferTags(title: string): string[] {
  const t = title.toLowerCase();
  if (t.includes('transfer') || t.includes('buzz') || t.includes('switch')) return ['Transfer Buzz'];
  if (t.includes('preview') || t.includes('set to')) return ['Match Preview'];
  if (t.includes('result') || t.includes('edge') || t.includes('beat') || t.includes('win')) return ['Result'];
  return ['AI draft'];
}

/**
 * For each source: generate a draft via the gateway, persist a NewsArticle (status PENDING)
 * and an AiJob (type 'news'). Returns the count of articles stored.
 */
export async function generateAndStoreNews(
  prisma: PrismaClient,
  gateway: LlmGateway,
  sources: NewsSource[],
): Promise<number> {
  let stored = 0;
  for (const source of sources) {
    const draft = await generateNewsDraft(gateway, {
      sourceTitle: source.sourceTitle,
      sourceUrl: source.sourceUrl,
      model: source.model,
    });

    const job = await prisma.aiJob.create({
      data: {
        type: 'news',
        providerUsed: source.model ?? 'gateway',
        status: 'ok',
      },
    });

    await prisma.newsArticle.create({
      data: {
        title: draft.title,
        body: draft.body,
        tags: inferTags(draft.title),
        sourceUrl: draft.sourceUrl,
        aiJobId: job.id,
        status: 'PENDING',
      },
    });

    stored++;
  }
  return stored;
}

/**
 * Find all PENDING articles with a past publishedAt and mark them PUBLISHED.
 * Plain review-queue drafts (publishedAt = null) are untouched.
 * Returns the number of articles published.
 */
export async function publishDueNews(prisma: PrismaClient, now = new Date()): Promise<number> {
  const result = await prisma.newsArticle.updateMany({
    where: {
      status: 'PENDING',
      publishedAt: { not: null, lte: now },
    },
    data: { status: 'PUBLISHED' },
  });
  return result.count;
}
