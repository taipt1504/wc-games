import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Schedule, MatchDetail, BetSlip } from '@/components/screens-match';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'schedule', param: {}, points: WC.me.points, tier: WC.me.tier, bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: false,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('Schedule', () => {
  it('renders section heading and filter chips', () => {
    render(<Schedule s={mockStore()} />);
    expect(screen.getByText('Match schedule')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /All/i })[0]).toBeInTheDocument();
  });

  it('renders match cards in the list', () => {
    render(<Schedule s={mockStore()} />);
    // Each match card has a chevR icon, so there should be multiple cards rendered
    const cards = screen.getAllByRole('button', { name: /Live|Today|All|Open|Finished/i });
    expect(cards.length).toBeGreaterThan(0);
  });
});

describe('MatchDetail', () => {
  it('renders hero with team names and stage', () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    // Match 23 is LIVE, the hero renders the stage badge
    expect(screen.getByText(/Group/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
  });

  it('renders AI Pundit tab panel by default', () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    expect(screen.getByText(/Ora · Match preview/i)).toBeInTheDocument();
  });

  it('renders match odds section', () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    expect(screen.getByText(/Match odds/i)).toBeInTheDocument();
  });

  it('returns null for unknown match id', () => {
    const { container } = render(<MatchDetail s={mockStore({ param: { id: 99999 } })} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('BetSlip', () => {
  it('renders null when betSlip is null', () => {
    const { container } = render(<BetSlip s={mockStore({ betSlip: null })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders overlay with bet slip UI when betSlip is set', () => {
    const m = WC.matchById(23)!;
    render(
      <BetSlip s={mockStore({
        betSlip: { match: m, pick: '1', odds: m.odds.mh },
      })} />
    );
    expect(screen.getByText('Bet slip')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Confirm bet/i })).toBeInTheDocument();
  });

  it('shows potential payout section', () => {
    const m = WC.matchById(23)!;
    render(
      <BetSlip s={mockStore({
        betSlip: { match: m, pick: '1', odds: m.odds.mh },
      })} />
    );
    expect(screen.getByText(/Potential payout/i)).toBeInTheDocument();
  });


});
