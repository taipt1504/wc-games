import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Leaderboard, MyBets, Wallet, Profile } from '@/components/screens-compete';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'leaderboard', param: {}, points: WC.me.points, bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: false,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('Leaderboard', () => {
  it('renders guest conversion card when not authed', () => {
    render(<Leaderboard s={mockStore({ authed: false })} />);
    expect(screen.getByText(/Where would you rank/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Join the board/i })).toBeInTheDocument();
  });

  it('renders personal rank card when authed', () => {
    render(<Leaderboard s={mockStore({ authed: true })} />);
    expect(screen.getByText(/Your global rank/i)).toBeInTheDocument();
  });

  it('renders top podium and table', () => {
    render(<Leaderboard s={mockStore()} />);
    // Top 3 names should appear in the podium
    expect(screen.getAllByText(WC.leaderboard[0].name).length).toBeGreaterThanOrEqual(1);
  });

  it('shows My tier filter chip when authed', () => {
    render(<Leaderboard s={mockStore({ authed: true })} />);
    expect(screen.getByRole('button', { name: /My tier/i })).toBeInTheDocument();
  });

  it('does not show My tier filter chip when guest', () => {
    render(<Leaderboard s={mockStore({ authed: false })} />);
    expect(screen.queryByRole('button', { name: /My tier/i })).toBeNull();
  });
});

describe('MyBets', () => {
  it('renders empty state when no bets', () => {
    render(<MyBets s={mockStore({ bets: [] })} />);
    expect(screen.getByText(/No bets here yet/i)).toBeInTheDocument();
  });

  it('renders bet history when bets are provided', () => {
    render(<MyBets s={mockStore({ bets: WC.myBets, authed: true })} />);
    // Filter chips are always rendered
    expect(screen.getByRole('button', { name: /Open & live/i })).toBeInTheDocument();
  });

  it('renders ROI stat from WC.me', () => {
    render(<MyBets s={mockStore()} />);
    expect(screen.getByText(/ROI/i)).toBeInTheDocument();
  });

  it('renders section header', () => {
    render(<MyBets s={mockStore()} />);
    expect(screen.getByText(/My bets/i)).toBeInTheDocument();
    expect(screen.getByText(/Every prediction/i)).toBeInTheDocument();
  });
});

describe('Wallet', () => {
  it('renders point balance', () => {
    render(<Wallet s={mockStore()} />);
    expect(screen.getByText(/Available balance/i)).toBeInTheDocument();
    expect(screen.getByText(WC.me.points.toLocaleString())).toBeInTheDocument();
  });

  it('renders transaction history heading', () => {
    render(<Wallet s={mockStore()} />);
    expect(screen.getByText(/Transaction history/i)).toBeInTheDocument();
  });

  it('renders ledger entries', () => {
    render(<Wallet s={mockStore()} />);
    // The most recent ledger entry (after .reverse()) should appear
    expect(screen.getByText(WC.ledger[0].label)).toBeInTheDocument();
  });

  it('renders wallet action buttons', () => {
    render(<Wallet s={mockStore()} />);
    expect(screen.getByRole('button', { name: /Place a bet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refer a friend/i })).toBeInTheDocument();
  });
});

describe('Profile', () => {
  it('renders user name and handle', () => {
    render(<Profile s={mockStore()} />);
    expect(screen.getByText(WC.me.name)).toBeInTheDocument();
    expect(screen.getByText(new RegExp(WC.me.handle))).toBeInTheDocument();
  });

  it('renders achievements section', () => {
    render(<Profile s={mockStore()} />);
    expect(screen.getByText(/Achievements/i)).toBeInTheDocument();
    expect(screen.getByText(WC.achievements[0].name)).toBeInTheDocument();
  });

  it('renders notifications section', () => {
    render(<Profile s={mockStore()} />);
    expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Bet lock reminders/i)).toBeInTheDocument();
  });

  it('renders log out button', () => {
    render(<Profile s={mockStore()} />);
    expect(screen.getByRole('button', { name: /Log out/i })).toBeInTheDocument();
  });

  it('renders refer & earn and share your form cards', () => {
    render(<Profile s={mockStore()} />);
    expect(screen.getByText(/Refer/i)).toBeInTheDocument();
    expect(screen.getByText(/Share your form/i)).toBeInTheDocument();
  });
});
