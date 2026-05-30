import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Teams, TeamDetail, Groups, Bracket } from '@/components/screens-tournament';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'teams', param: {}, points: WC.me.points, bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: false,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('Teams', () => {
  it('renders heading and all 48 team cards', () => {
    render(<Teams s={mockStore()} />);
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(screen.getAllByText(/Grp [A-L]/).length).toBeGreaterThanOrEqual(48);
  });

  it('renders confederation filter chips', () => {
    render(<Teams s={mockStore()} />);
    expect(screen.getByRole('button', { name: 'UEFA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CONMEBOL' })).toBeInTheDocument();
  });
});

describe('TeamDetail', () => {
  it('renders team name, group badge, and squad for team 0 (Mexico)', () => {
    render(<TeamDetail s={mockStore({ param: { id: 0 } })} />);
    expect(screen.getByRole('heading', { name: 'Mexico' })).toBeInTheDocument();
    expect(screen.getByText('W-D-L')).toBeInTheDocument();
    expect(screen.getByText(/Squad/i)).toBeInTheDocument();
  });

  it('back button calls s.back', () => {
    const back = vi.fn();
    render(<TeamDetail s={mockStore({ param: { id: 0 }, back })} />);
    screen.getByRole('button', { name: /Back/i }).click();
    expect(back).toHaveBeenCalled();
  });
});

describe('Groups', () => {
  it('renders group standings heading and all 12 group tables', () => {
    render(<Groups s={mockStore()} />);
    expect(screen.getByText('Group standings')).toBeInTheDocument();
    // Each group has a "Group X" heading cell
    const groupHeadings = screen.getAllByText(/^Group [A-L]$/);
    expect(groupHeadings.length).toBe(12);
  });

  it('renders Pts column headers', () => {
    render(<Groups s={mockStore()} />);
    const ptsCols = screen.getAllByText('Pts');
    expect(ptsCols.length).toBe(12);
  });
});

describe('Bracket', () => {
  it('renders knockout bracket heading and round labels', () => {
    render(<Bracket s={mockStore()} />);
    expect(screen.getByText('Knockout bracket')).toBeInTheDocument();
    expect(screen.getByText('Round of 32')).toBeInTheDocument();
    expect(screen.getByText('Final')).toBeInTheDocument();
    expect(screen.getByText('Champion')).toBeInTheDocument();
  });

  it('Open predictor button fires toastMsg', () => {
    const toastMsg = vi.fn();
    render(<Bracket s={mockStore({ toastMsg })} />);
    screen.getByRole('button', { name: /Open predictor/i }).click();
    expect(toastMsg).toHaveBeenCalledWith(
      'Bracket predictor opening soon!',
      'bracket',
      'var(--sky)',
    );
  });
});
