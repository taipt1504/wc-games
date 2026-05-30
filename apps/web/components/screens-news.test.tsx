import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { News, Article } from '@/components/screens-news';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'news', param: {}, points: WC.me.points, bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: false,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('News', () => {
  it('renders section heading and tag filter chips', () => {
    render(<News s={mockStore()} />);
    expect(screen.getByText('World Cup wire')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Match Preview' })).toBeInTheDocument();
  });

  it('renders the lead article (news[0]) as a hero card', () => {
    render(<News s={mockStore()} />);
    // news[0] title
    expect(screen.getByText(/Argentina look to seal top spot/i)).toBeInTheDocument();
  });

  it('navigates to article on lead card click', () => {
    const go = vi.fn();
    render(<News s={mockStore({ go })} />);
    // Click the lead panel (the hero card)
    screen.getByText(/Argentina look to seal top spot/i).click();
    expect(go).toHaveBeenCalledWith('article', { id: 1 });
  });

  it('shows Trending badge for hot articles', () => {
    render(<News s={mockStore()} />);
    expect(screen.getByText('Trending')).toBeInTheDocument();
  });
});

describe('Article', () => {
  it('renders article title when id param is set', () => {
    render(<Article s={mockStore({ param: { id: 2 } })} />);
    expect(screen.getByRole('heading', { name: /France confirm Mbappé fit to start/i })).toBeInTheDocument();
  });

  it('renders AI-assisted label and source attribution', () => {
    render(<Article s={mockStore({ param: { id: 2 } })} />);
    expect(screen.getByText('✨ AI-assisted')).toBeInTheDocument();
    expect(screen.getByText(/Source · KickReport/i)).toBeInTheDocument();
  });

  it('renders Back button and calls s.back() on click', () => {
    const back = vi.fn();
    render(<Article s={mockStore({ param: { id: 3 }, back })} />);
    screen.getByRole('button', { name: /Back to wire/i }).click();
    expect(back).toHaveBeenCalled();
  });

  it('shows Bet match CTA for articles with a match link', () => {
    // news id 1 has match: 14
    render(<Article s={mockStore({ param: { id: 1 } })} />);
    expect(screen.getByRole('button', { name: /Bet this match/i })).toBeInTheDocument();
  });

  it('does not show Bet match CTA for articles without a match link', () => {
    // news id 3 has no match property
    render(<Article s={mockStore({ param: { id: 3 } })} />);
    expect(screen.queryByRole('button', { name: /Bet this match/i })).not.toBeInTheDocument();
  });

  it('falls back to news[0] when param.id does not match', () => {
    render(<Article s={mockStore({ param: { id: 9999 } })} />);
    // news[0] title
    expect(screen.getByRole('heading', { name: /Argentina look to seal top spot/i })).toBeInTheDocument();
  });
});
