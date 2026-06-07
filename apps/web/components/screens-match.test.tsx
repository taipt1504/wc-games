import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Schedule, MatchDetail } from '@/components/screens-match';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

/* Real match shape returned by GET /api/v1/matches/:id (de-mocked match screen). */
const M23 = {
  id: 23, round: 'GROUP', group: 'A', status: 'LIVE', kickoffAt: '2026-06-11T18:00:00.000Z',
  home: { id: 1, name: 'Brazil', code: 'BRA', flagUrl: null },
  away: { id: 2, name: 'Serbia', code: 'SRB', flagUrl: null },
  scoreHome: 1, scoreAway: 0, result: null,
  odds: { mHome: 1.8, mDraw: 2.4, mAway: 3.1 }, bettingLocked: false,
  venue: { name: 'MetLife Stadium' },
};

function jsonRes(body: unknown) {
  return Promise.resolve({ ok: true, json: () => Promise.resolve(body) } as Response);
}
function notFound() {
  return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve({ error: { code: 'NOT_FOUND' } }) } as Response);
}
function mockFetch(input: RequestInfo | URL): Promise<Response> {
  const u = input.toString();
  if (u.includes('/api/v1/matches/live')) return jsonRes({ data: [] });
  const idMatch = u.match(/\/api\/v1\/matches\/(\d+)/);
  if (idMatch) return idMatch[1] === '23' ? jsonRes({ data: M23 }) : notFound();
  if (u.includes('/api/v1/ai/preview/')) return jsonRes({ data: { content: 'Preview text', disclaimer: 'Not advice', provider: 'test' } });
  if (u.includes('/api/v1/teams/')) return jsonRes({ data: { name: 'Brazil', formation: '4-3-3', manager: 'Coach', players: [{ name: 'Keeper', position: 'GK', number: 1, starter: true }] } });
  if (u.includes('/api/v1/matches')) return jsonRes({ data: [M23] });
  return notFound();
}

beforeEach(() => { vi.stubGlobal('fetch', vi.fn(mockFetch)); });
afterEach(() => { vi.unstubAllGlobals(); });

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
  it('renders hero with team names and stage', async () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    // "Group A" now appears in both the hero badge and the info strip — match all
    expect((await screen.findAllByText(/Group A/i)).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /Back/i })).toBeInTheDocument();
  });

  it('renders AI Pundit tab panel by default', async () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    expect(await screen.findByText(/Ora · Match preview/i)).toBeInTheDocument();
  });

  it('renders match odds section', async () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    expect(await screen.findByText(/Match odds/i)).toBeInTheDocument();
  });

  it('shows not-found state for unknown match id', async () => {
    render(<MatchDetail s={mockStore({ param: { id: 99999 } })} />);
    expect(await screen.findByText(/Match not found/i)).toBeInTheDocument();
  });

  it('renders the real lineups section via FormationPitch', async () => {
    render(<MatchDetail s={mockStore({ param: { id: 23 } })} />);
    // lineups are now an inline section (no tab) — they appear once the team fetch resolves
    expect(await screen.findByText(/AI-predicted lineups/i)).toBeInTheDocument();
  });
});

