import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseRss, crawlNewsSources } from './news';

const bbc = readFileSync(join(__dirname, '__fixtures__', 'bbc-football-rss.xml'), 'utf8');

describe('parseRss (captured BBC football feed)', () => {
  it('extracts title + link items from a real feed', () => {
    const items = parseRss(bbc);
    expect(items.length).toBeGreaterThan(10);
    expect(items[0].title.length).toBeGreaterThan(0);
    expect(items[0].link).toMatch(/^https?:\/\//);
  });

  it('strips CDATA/markup and decodes &amp; in titles', () => {
    const items = parseRss('<rss><item><title><![CDATA[A & B <b>x</b>]]></title><link>https://x/1</link></item></rss>');
    expect(items[0].title).toBe('A & B x');
  });

  it('returns [] on non-RSS input', () => {
    expect(parseRss('<html>no items</html>')).toEqual([]);
  });
});

describe('crawlNewsSources', () => {
  it('caps results and uses an injected fetch (no network)', async () => {
    const fetchText = async () => bbc;
    const sources = await crawlNewsSources({ feeds: ['f1', 'f2', 'f3'], perFeed: 3, max: 6, fetchText });
    expect(sources.length).toBe(6);
    expect(sources[0].sourceTitle.length).toBeGreaterThan(0);
    expect(sources[0].sourceUrl).toMatch(/^https?:\/\//);
  });

  it('skips unreachable feeds without throwing', async () => {
    const fetchText = async (u: string) => { if (u === 'bad') throw new Error('down'); return bbc; };
    const sources = await crawlNewsSources({ feeds: ['bad', 'ok'], perFeed: 2, max: 5, fetchText });
    expect(sources.length).toBe(2);
  });
});
