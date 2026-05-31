import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { News, Article } from '@/components/screens-news';
import type { Store } from '@/lib/store';

// Realistic stub feed — id 1 is hot+has match, id 3 has no match
const STUB_NEWS = [
  { id: 1, tag: 'Match Preview', title: 'Argentina look to seal top spot in Group A', src: 'GolazoFeed', time: '2h ago', excerpt: 'La Albiceleste need a point.', hot: true, match: 14 },
  { id: 2, tag: 'Squad News', title: 'France confirm Mbappé fit to start', src: 'KickReport', time: '3h ago', excerpt: 'The star forward passed a fitness test.' },
  { id: 3, tag: 'Analysis', title: 'Morocco defy the odds again', src: 'TacticsToday', time: '5h ago', excerpt: 'Atlas Lions continue to impress.' },
];

function makeFetch(data: typeof STUB_NEWS) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data }),
  });
}

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'news', param: {}, points: 0, tier: 'Bronze', role: 'user',
    bets: [], ledger: [], streak: 6, winStreak: 0, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: false,
    me: { name: 'Guest', handle: '@guest', avatar: 'GA', country: '—', rank: null, roi: 0, won: 0, lost: 0, settled: 0, joined: '—' },
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    refreshUser: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('News', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetch(STUB_NEWS));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders section heading and tag filter chips', () => {
    render(<News s={mockStore()} />);
    expect(screen.getByText('World Cup wire')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match Preview' })).toBeInTheDocument();
  });

  it('renders the lead article (stub[0]) as a hero card after fetch', async () => {
    render(<News s={mockStore()} />);
    expect(await screen.findByText(/Argentina look to seal top spot/i)).toBeInTheDocument();
  });

  it('navigates to article on lead card click', async () => {
    const go = vi.fn();
    render(<News s={mockStore({ go })} />);
    const lead = await screen.findByText(/Argentina look to seal top spot/i);
    lead.click();
    expect(go).toHaveBeenCalledWith('article', { id: 1 });
  });

  it('shows Trending badge for hot articles', async () => {
    render(<News s={mockStore()} />);
    expect(await screen.findByText('Trending')).toBeInTheDocument();
  });

  it('shows empty-state message when feed returns empty array', async () => {
    vi.stubGlobal('fetch', makeFetch([]));
    render(<News s={mockStore()} />);
    expect(await screen.findByText(/No news yet — check back soon/i)).toBeInTheDocument();
  });
});

describe('Article', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', makeFetch(STUB_NEWS));
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders article title when id param matches stub', async () => {
    render(<Article s={mockStore({ param: { id: 2 } })} />);
    expect(await screen.findByRole('heading', { name: /France confirm Mbappé fit to start/i })).toBeInTheDocument();
  });

  it('renders AI-assisted label and source attribution', async () => {
    render(<Article s={mockStore({ param: { id: 2 } })} />);
    await screen.findByRole('heading', { name: /France confirm Mbappé fit to start/i });
    expect(screen.getByText('✨ AI-assisted')).toBeInTheDocument();
    expect(screen.getByText(/Source · KickReport/i)).toBeInTheDocument();
  });

  it('renders Back button and calls s.back() on click', async () => {
    const back = vi.fn();
    render(<Article s={mockStore({ param: { id: 3 }, back })} />);
    // Back button is present immediately (before fetch resolves)
    screen.getByRole('button', { name: /Back to wire/i }).click();
    expect(back).toHaveBeenCalled();
  });

  it('shows Bet match CTA for articles with a match link', async () => {
    render(<Article s={mockStore({ param: { id: 1 } })} />);
    expect(await screen.findByRole('button', { name: /Bet this match/i })).toBeInTheDocument();
  });

  it('does not show Bet match CTA for articles without a match link', async () => {
    render(<Article s={mockStore({ param: { id: 3 } })} />);
    await screen.findByRole('heading', { name: /Morocco defy the odds again/i });
    expect(screen.queryByRole('button', { name: /Bet this match/i })).not.toBeInTheDocument();
  });

  it('shows Article not found when param.id does not match any item', async () => {
    render(<Article s={mockStore({ param: { id: 9999 } })} />);
    expect(await screen.findByText(/Article not found/i)).toBeInTheDocument();
  });

  it('Back button present even when article is not found', async () => {
    const back = vi.fn();
    render(<Article s={mockStore({ param: { id: 9999 }, back })} />);
    await screen.findByText(/Article not found/i);
    screen.getByRole('button', { name: /Back to wire/i }).click();
    expect(back).toHaveBeenCalled();
  });
});
