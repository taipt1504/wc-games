import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Admin } from '@/components/screens-admin';
import type { Store } from '@/lib/store';

/* -------- stub data shapes -------- */
const STUB_USER = {
  id: 1, name: 'TestUser', email: 'test@test.com', ip: '1.2.3.4',
  pts: 1000, flags: 0, status: 'active', joined: '2024-01-01',
};
const STUB_RISK = {
  id: 42, name: 'lobby-alpha', members: 3, risk: 'High', score: 85,
  reasons: ['Suspicious pattern'], flagged: '2d ago',
};
const STUB_NEWS = {
  id: 7, title: 'WC Draft Story', tag: 'Match', status: 'PENDING',
  src: 'BBC', conf: 90, warn: false,
};

/* -------- fetch stub -------- */
function makeFetch(overrides: Record<string, unknown> = {}) {
  return vi.fn((url: string) => {
    const data = overrides[url as string] ?? [];
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ data }),
    });
  });
}

/* -------- mockStore -------- */
function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'admin', param: {}, points: 500, tier: 'gold',
    role: 'admin',
    bets: [], ledger: [], streak: 0, winStreak: 0, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: true,
    me: { name: 'Admin', handle: 'admin', avatar: '', country: 'VN', rank: null, roi: 0, won: 0, lost: 0, settled: 0, joined: '2024-01-01' },
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    refreshUser: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('Admin', () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = makeFetch({
      '/api/v1/admin/users': [STUB_USER],
      '/api/v1/admin/risk-flags': [STUB_RISK],
      '/api/v1/admin/news': [STUB_NEWS],
      '/api/v1/admin/ai-jobs': { jobs: [], kpis: null },
    });
    global.fetch = fetchSpy as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the admin console with the topbar badge', () => {
    render(<Admin s={mockStore()} />);
    expect(screen.getByText('Admin Console')).toBeInTheDocument();
  });

  it('default tab shows Operations overview heading', () => {
    render(<Admin s={mockStore()} />);
    expect(screen.getByText('Operations overview')).toBeInTheDocument();
  });

  it('clicking Tournament tab shows Tournament management', () => {
    render(<Admin s={mockStore()} />);
    const tourBtn = screen.getAllByRole('button', { name: /Tournament/i })[0];
    fireEvent.click(tourBtn);
    expect(screen.getByText('Tournament management')).toBeInTheDocument();
  });

  it('clicking a match row opens the real match detail page', async () => {
    const M = {
      id: 1, round: 'GROUP', group: 'A', status: 'SCHEDULED', kickoffAt: '2026-06-11T18:00:00.000Z',
      home: { id: 1, name: 'Mexico', code: 'MEX', flagUrl: null },
      away: { id: 2, name: 'South Africa', code: 'RSA', flagUrl: null },
      scoreHome: null, scoreAway: null, result: null,
      odds: { mHome: 1.6, mDraw: 2.3, mAway: 2.08 }, bettingLocked: false, venue: { name: 'Estadio Azteca' },
    };
    global.fetch = makeFetch({ '/api/v1/matches': [M], '/api/v1/matches/1': M, '/api/v1/admin/users': [STUB_USER] }) as unknown as typeof fetch;
    render(<Admin s={mockStore()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Tournament/i })[0]);
    fireEvent.click(await screen.findByText(/MEX v RSA/i)); // open match detail
    expect(await screen.findByText(/Back to fixtures/i)).toBeInTheDocument();
    expect(await screen.findByText(/Estadio Azteca/i)).toBeInTheDocument(); // real /matches/:id data
    expect(screen.getByText(/House odds/i)).toBeInTheDocument();
  });

  it('match detail shows the data-sync panel', async () => {
    const M = {
      id: 1, round: 'GROUP', group: 'A', status: 'SCHEDULED', kickoffAt: '2026-06-11T18:00:00.000Z',
      home: { id: 1, name: 'Mexico', code: 'MEX', flagUrl: null }, away: { id: 2, name: 'South Africa', code: 'RSA', flagUrl: null },
      scoreHome: null, scoreAway: null, result: null, odds: { mHome: 1.6, mDraw: 2.3, mAway: 2.08 }, bettingLocked: false, venue: { name: 'Azteca' },
    };
    global.fetch = makeFetch({ '/api/v1/matches': [M], '/api/v1/matches/1': M, '/api/v1/admin/users': [STUB_USER] }) as unknown as typeof fetch;
    render(<Admin s={mockStore()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /Tournament/i })[0]);
    fireEvent.click(await screen.findByText(/MEX v RSA/i));
    expect(await screen.findByText(/Data sync/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync result/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sync lineup/i })).toBeInTheDocument();
  });

  it('clicking Users tab shows User management heading', () => {
    render(<Admin s={mockStore()} />);
    const usersBtn = screen.getAllByRole('button', { name: /^Users$/i })[0];
    fireEvent.click(usersBtn);
    expect(screen.getByText('User management')).toBeInTheDocument();
  });

  it('clicking Lobby risk tab shows Lobby risk queue heading', () => {
    render(<Admin s={mockStore()} />);
    const riskBtn = screen.getAllByRole('button', { name: /Lobby risk/i })[0];
    fireEvent.click(riskBtn);
    expect(screen.getByText('Lobby risk queue')).toBeInTheDocument();
  });

  it('clicking News tab shows the news management heading', () => {
    render(<Admin s={mockStore()} />);
    const reviewBtn = screen.getAllByRole('button', { name: /^News$/i })[0];
    fireEvent.click(reviewBtn);
    expect(screen.getByText(/AI-drafted stories/i)).toBeInTheDocument();
  });

  it('clicking AI pipeline tab shows AI & data pipeline heading', () => {
    render(<Admin s={mockStore()} />);
    const pipeBtn = screen.getAllByRole('button', { name: /AI pipeline/i })[0];
    fireEvent.click(pipeBtn);
    expect(screen.getByText('AI & data pipeline')).toBeInTheDocument();
  });

  it('clicking Audit log tab shows Audit log heading', () => {
    render(<Admin s={mockStore()} />);
    const auditBtn = screen.getAllByRole('button', { name: /Audit log/i })[0];
    fireEvent.click(auditBtn);
    expect(screen.getAllByText('Audit log').length).toBeGreaterThanOrEqual(2);
  });

  it('Back to app button calls s.go with home', () => {
    const go = vi.fn();
    render(<Admin s={mockStore({ go })} />);
    fireEvent.click(screen.getByRole('button', { name: /Back to app/i }));
    expect(go).toHaveBeenCalledWith('home');
  });

  it('clicking a risk lobby row opens risk detail view', async () => {
    render(<Admin s={mockStore()} />);
    const riskBtn = screen.getAllByRole('button', { name: /Lobby risk/i })[0];
    fireEvent.click(riskBtn);
    // wait for fetch to resolve and the Investigate button to appear
    const investigateBtn = await screen.findByRole('button', { name: /Investigate/i });
    fireEvent.click(investigateBtn);
    expect(screen.getByText(/Back to risk queue/i)).toBeInTheDocument();
  });

  it('clicking a user row opens user detail view', async () => {
    render(<Admin s={mockStore()} />);
    const usersBtn = screen.getAllByRole('button', { name: /^Users$/i })[0];
    fireEvent.click(usersBtn);
    // wait for fetch to populate the table
    await screen.findByText('TestUser');
    const rows = screen.getAllByRole('row');
    // rows[0] is header, rows[1] is first data row
    fireEvent.click(rows[1]);
    expect(screen.getByText(/Back to users/i)).toBeInTheDocument();
  });

  it('user detail shows real ledger + balance from the endpoint', async () => {
    const DETAIL = {
      id: 1, email: 'test@test.com', name: 'TestUser', role: 'USER', status: 'active', joined: '2024-01-01',
      balance: 1450, winRate: 60, roi: 12, settled: 5, won: 3,
      ledger: [{ type: 'SETTLE', amount: 283, balanceAfter: 1450, when: '2026-06-07T10:00:00Z' }],
      bets: [{ matchId: 1, pick: '1', stake: 100, odds: 1.8, status: 'WON' }],
    };
    global.fetch = makeFetch({ '/api/v1/admin/users': [STUB_USER], '/api/v1/admin/users/1': DETAIL, '/api/v1/matches': [] }) as unknown as typeof fetch;
    render(<Admin s={mockStore()} />);
    fireEvent.click(screen.getAllByRole('button', { name: /^Users$/i })[0]);
    await screen.findByText('TestUser');
    fireEvent.click(screen.getAllByRole('row')[1]);
    expect(await screen.findByText(/SETTLE/)).toBeInTheDocument(); // real ledger entry
    expect(screen.getByText('1,450')).toBeInTheDocument(); // real balance KPI
  });

  it('overview shows empty risk flag state when no flags fetched', async () => {
    fetchSpy = makeFetch(); // all endpoints return [] by default
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<Admin s={mockStore()} />);
    await waitFor(() => {
      expect(screen.getByText('No open risk flags.')).toBeInTheDocument();
    });
  });

  it('overview shows stubbed risk lobby name after fetch', async () => {
    render(<Admin s={mockStore()} />);
    await screen.findByText(STUB_RISK.name);
    expect(screen.getByText(STUB_RISK.name)).toBeInTheDocument();
  });

  it('pipeline tab shows empty state when no jobs', async () => {
    render(<Admin s={mockStore()} />);
    const pipeBtn = screen.getAllByRole('button', { name: /AI pipeline/i })[0];
    fireEvent.click(pipeBtn);
    await screen.findByText('No jobs yet.');
    expect(screen.getByText('No jobs yet.')).toBeInTheDocument();
  });

  it('users tab shows empty state when no users fetched', async () => {
    fetchSpy = makeFetch(); // all endpoints return []
    global.fetch = fetchSpy as unknown as typeof fetch;
    render(<Admin s={mockStore()} />);
    const usersBtn = screen.getAllByRole('button', { name: /^Users$/i })[0];
    fireEvent.click(usersBtn);
    await waitFor(() => {
      expect(screen.getByText('No users.')).toBeInTheDocument();
    });
  });
});
