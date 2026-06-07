import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Teams, TeamDetail, Groups, Bracket } from '@/components/screens-tournament';
import type { Store } from '@/lib/store';

const GROUPS = 'ABCDEFGHIJKL'.split('');
// 48 mock teams (4 per group) shaped like /api/v1/teams.
const TEAMS = GROUPS.flatMap((g, gi) =>
  [0, 1, 2, 3].map((k) => {
    const id = gi * 4 + k + 1;
    return { id, name: `Team ${id}`, code: `T${id}`, flagUrl: `https://flag/${id}.png`, fifaRank: null, group: g };
  }),
);
const GROUPS_DATA = GROUPS.map((g) => ({
  name: g,
  teams: TEAMS.filter((t) => t.group === g).map((t) => ({
    id: t.id, name: t.name, code: t.code, flagUrl: t.flagUrl, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, pts: 0,
  })),
}));
const TEAM_DETAIL = {
  id: 1, name: 'Mexico', code: 'MEX', flagUrl: 'https://flag/1.png', fifaRank: null, group: 'A',
  formation: '4-3-3', manager: 'Javier Aguirre',
  players: [
    { name: 'Guillermo Ochoa', position: 'GK', number: 13, starter: true },
    { name: 'Hirving Lozano', position: 'LW', number: 22, starter: true },
    { name: 'Raul Jimenez', position: 'ST', number: 9, starter: false },
  ],
  matches: [],
};

function routeFetch(url: string) {
  const body = url.includes('/teams/') ? TEAM_DETAIL
    : url.includes('/teams') ? TEAMS
      : url.includes('/groups') ? GROUPS_DATA
        : url.includes('/me/bracket') ? { picks: {}, lockedAt: null, score: 0 }
          : null;
  return Promise.resolve({ ok: true, json: async () => ({ data: body }) } as Response);
}

let fetchSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => { fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((u) => routeFetch(String(u))); });
afterEach(() => { fetchSpy.mockRestore(); });

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'teams', param: {}, points: 3500, tier: 'Silver', bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: false,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  } as Store;
}

describe('Teams', () => {
  it('renders heading and the fetched team cards', async () => {
    render(<Teams s={mockStore()} />);
    expect(screen.getByText('Teams')).toBeInTheDocument();
    expect(await screen.findByText('Team 1')).toBeInTheDocument();
    expect(screen.getByText('Team 48')).toBeInTheDocument();
  });

  it('renders group filter chips (A–L), not confederations', () => {
    render(<Teams s={mockStore()} />);
    expect(screen.getByRole('button', { name: 'Grp A' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Grp L' })).toBeInTheDocument();
  });
});

describe('TeamDetail', () => {
  it('renders team name, W-D-L, and the formation pitch (manager + XI + bench)', async () => {
    render(<TeamDetail s={mockStore({ param: { id: 1 } })} />);
    expect(await screen.findByRole('heading', { name: 'Mexico' })).toBeInTheDocument();
    expect(screen.getByText('W-D-L')).toBeInTheDocument();
    expect(screen.getByText('Squad')).toBeInTheDocument();
    // FormationPitch: manager + formation badge + starters by surname + bench
    expect(screen.getByText('Javier Aguirre')).toBeInTheDocument();
    expect(screen.getByText('4-3-3')).toBeInTheDocument();
    expect(screen.getByText('Guillermo Ochoa')).toBeInTheDocument(); // GK starter (full name on pitch)
    expect(screen.getByText('Hirving Lozano')).toBeInTheDocument(); // LW starter (full name on pitch)
    expect(screen.getByText('BENCH')).toBeInTheDocument();
    expect(screen.getByText('Raul Jimenez')).toBeInTheDocument(); // bench (full name)
  });

  it('back button calls s.back', async () => {
    const back = vi.fn();
    render(<TeamDetail s={mockStore({ param: { id: 1 }, back })} />);
    (await screen.findByRole('button', { name: /Back/i })).click();
    expect(back).toHaveBeenCalled();
  });
});

describe('Groups', () => {
  it('renders standings heading and all 12 group tables', async () => {
    render(<Groups s={mockStore()} />);
    expect(screen.getByText('Group standings')).toBeInTheDocument();
    const headings = await screen.findAllByText(/^Group [A-L]$/);
    expect(headings.length).toBe(12);
  });

  it('renders Pts column headers for each group', async () => {
    render(<Groups s={mockStore()} />);
    await screen.findAllByText(/^Group [A-L]$/);
    expect(screen.getAllByText('Pts').length).toBe(12);
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

  it('Open predictor: authed user → predictor panel opens', async () => {
    render(<Bracket s={mockStore({ authed: true })} />);
    screen.getByRole('button', { name: /Open predictor/i }).click();
    expect(await screen.findByLabelText('Bracket predictor panel')).toBeInTheDocument();
  });

  it('Open predictor: guest → redirects to auth signup', () => {
    const go = vi.fn();
    render(<Bracket s={mockStore({ authed: false, go })} />);
    screen.getByRole('button', { name: /Open predictor/i }).click();
    expect(go).toHaveBeenCalledWith('auth', { mode: 'signup' });
  });
});
