import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Leaderboard, MyBets, Wallet, Profile } from '@/components/screens-compete';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

const ME = {
  name: 'Alex',
  handle: '@alex',
  avatar: 'AL',
  country: 'USA',
  rank: 7,
  roi: 18.4,
  won: 9,
  lost: 5,
  settled: 14,
  joined: 'May 2026',
};

const LEDGER_ENTRY = { type: 'SIGNUP', label: 'Welcome bonus', delta: 1000, when: '1 May 2026', bal: 1000 };

const LEADERBOARD_ROW = { rank: 1, name: 'TopPlayer', roi: 42.5, net: 2000, settled: 20, won: 15, tier: 'Gold' };

const ACHIEVEMENT = { name: 'First Win', desc: 'Win your first bet', icon: 'trophy', unlocked: true };

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'leaderboard',
    param: {},
    me: ME,
    points: 12450,
    role: 'user',
    tier: 'Gold',
    bets: [],
    ledger: [],
    streak: 6,
    winStreak: 3,
    checkedIn: false,
    betSlip: null,
    borrowOpen: false,
    toast: null,
    authed: false,
    go: vi.fn(),
    back: vi.fn(),
    toastMsg: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    refreshUser: vi.fn(),
    checkin: vi.fn(),
    claimMission: vi.fn(),
    pickFor: () => undefined,
    openBet: vi.fn(),
    setSlipPick: vi.fn(),
    closeBet: vi.fn(),
    confirmBet: vi.fn(),
    openBorrow: vi.fn(),
    closeBorrow: vi.fn(),
    ...over,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Leaderboard', () => {
  it('renders guest conversion card when not authed', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<Leaderboard s={mockStore({ authed: false })} />);
    expect(screen.getByText(/Where would you rank/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Join the board/i })).toBeInTheDocument();
  });

  it('renders personal rank card when authed', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<Leaderboard s={mockStore({ authed: true })} />);
    expect(screen.getByText(/Your global rank/i)).toBeInTheDocument();
  });

  it('renders rank from s.me.rank', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<Leaderboard s={mockStore({ authed: true })} />);
    expect(screen.getByText(/#7/)).toBeInTheDocument();
  });

  it('renders empty leaderboard state when rows is empty', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<Leaderboard s={mockStore()} />);
    expect(screen.getByText(/Leaderboard is empty/i)).toBeInTheDocument();
  });

  it('renders fetched leaderboard rows', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [LEADERBOARD_ROW] }),
    } as Response);
    render(<Leaderboard s={mockStore()} />);
    // TopPlayer appears in both podium card and table row
    const matches = await screen.findAllByText('TopPlayer');
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('shows My tier filter chip when authed', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<Leaderboard s={mockStore({ authed: true })} />);
    expect(screen.getByRole('button', { name: /My tier/i })).toBeInTheDocument();
  });

  it('does not show My tier filter chip when guest', () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({ ok: false } as Response);
    render(<Leaderboard s={mockStore({ authed: false })} />);
    expect(screen.queryByRole('button', { name: /My tier/i })).toBeNull();
  });
});

describe('MyBets', () => {
  it('renders empty state when no bets', () => {
    render(<MyBets s={mockStore({ bets: [] })} />);
    expect(screen.getByText(/No bets here yet/i)).toBeInTheDocument();
  });

  it('renders filter chips', () => {
    render(<MyBets s={mockStore({ bets: [], authed: true })} />);
    expect(screen.getByRole('button', { name: /Open & live/i })).toBeInTheDocument();
  });

  it('renders ROI stat from s.me.roi', () => {
    render(<MyBets s={mockStore()} />);
    expect(screen.getByText(/18\.4%/)).toBeInTheDocument();
  });

  it('renders section header', () => {
    render(<MyBets s={mockStore()} />);
    expect(screen.getByText(/My bets/i)).toBeInTheDocument();
    expect(screen.getByText(/Every prediction/i)).toBeInTheDocument();
  });
});

describe('Wallet', () => {
  it('renders point balance from s.points', () => {
    render(<Wallet s={mockStore()} />);
    expect(screen.getByText(/Available balance/i)).toBeInTheDocument();
    expect(screen.getByText((12450).toLocaleString())).toBeInTheDocument();
  });

  it('renders transaction history heading', () => {
    render(<Wallet s={mockStore()} />);
    expect(screen.getByText(/Transaction history/i)).toBeInTheDocument();
  });

  it('renders empty state when ledger is empty', () => {
    render(<Wallet s={mockStore({ ledger: [] })} />);
    expect(screen.getByText(/No transactions yet/i)).toBeInTheDocument();
  });

  it('renders ledger entries from s.ledger', () => {
    render(<Wallet s={mockStore({ ledger: [LEDGER_ENTRY] })} />);
    expect(screen.getByText('Welcome bonus')).toBeInTheDocument();
  });

  it('renders wallet action buttons', () => {
    render(<Wallet s={mockStore()} />);
    expect(screen.getByRole('button', { name: /Place a bet/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Refer a friend/i })).toBeInTheDocument();
  });
});

describe('Profile', () => {
  function setupFetch(achievementsData: unknown[] = []) {
    vi.spyOn(global, 'fetch').mockImplementation((url) => {
      const u = String(url);
      if (u.includes('/me/achievements')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: achievementsData }),
        } as Response);
      }
      return Promise.resolve({ ok: false } as Response);
    });
  }

  it('renders user name and handle from s.me', () => {
    setupFetch();
    render(<Profile s={mockStore()} />);
    expect(screen.getByText('Alex')).toBeInTheDocument();
    expect(screen.getByText(/@alex/)).toBeInTheDocument();
  });

  it('renders achievements section heading', () => {
    setupFetch();
    render(<Profile s={mockStore()} />);
    expect(screen.getByText('Achievements')).toBeInTheDocument();
  });

  it('renders empty achievements state when none', () => {
    setupFetch([]);
    render(<Profile s={mockStore()} />);
    expect(screen.getByText(/No achievements unlocked yet/i)).toBeInTheDocument();
  });

  it('renders fetched achievement', async () => {
    setupFetch([{ code: 'first_win', name: 'First Win', desc: 'Win your first bet', icon: 'trophy', unlocked: true, progress: 1, target: 1 }]);
    render(<Profile s={mockStore()} />);
    expect(await screen.findByText('First Win')).toBeInTheDocument();
  });

  it('renders notifications section', () => {
    setupFetch();
    render(<Profile s={mockStore()} />);
    expect(screen.getByText(/Notifications/i)).toBeInTheDocument();
    expect(screen.getByText(/Bet lock reminders/i)).toBeInTheDocument();
  });

  it('renders log out button', () => {
    setupFetch();
    render(<Profile s={mockStore()} />);
    expect(screen.getByRole('button', { name: /Log out/i })).toBeInTheDocument();
  });

  it('renders refer & earn and share your form cards', () => {
    setupFetch();
    render(<Profile s={mockStore()} />);
    expect(screen.getByText(/Refer/i)).toBeInTheDocument();
    expect(screen.getByText(/Share your form/i)).toBeInTheDocument();
  });
});
