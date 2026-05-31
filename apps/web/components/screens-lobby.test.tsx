import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Lobbies, LobbyCreate, LobbyView, BorrowModal } from '@/components/screens-lobby';
import type { Store } from '@/lib/store';

const baseMeProfile = {
  name: 'Alex', handle: '@alex', avatar: 'AL', country: 'USA',
  rank: 1, roi: 18.4, won: 9, lost: 5, settled: 14, joined: 'May 2026',
};

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'lobbies', param: {}, me: baseMeProfile,
    points: 3500, tier: 'Silver', role: 'user', bets: [], ledger: [],
    streak: 6, winStreak: 3, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: true,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    refreshUser: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

// Realistic API shapes for fetch stubs
const LOBBY_LIST = [
  { id: 1, name: 'Office League · ABC Corp', scope: 'ALL', members: 5, you: 3, def: 1000, owner: 'alex', borrow: true, pwd: false, hot: false, joined: true, public: true, code: 'ABC12345', matchIds: [1, 2, 3] },
  { id: 2, name: 'Global Pundits Club', scope: 'GROUP', members: 12, you: null, def: 500, owner: 'host2', borrow: false, pwd: false, hot: true, joined: false, public: true, code: 'GPC56789', matchIds: [4, 5] },
];

const LOBBY_DETAIL = {
  id: 1, name: 'Office League · ABC Corp', scope: 'ALL', owner: 'alex', isHost: false,
  members: 5, def: 1000, borrow: true, pwd: false, hot: false, joined: true,
  public: true, code: 'ABC12345', matchIds: [],
  you: 3,
  board: [
    { rank: 1, userId: 10, name: 'Khoa Nguyen', score: 1500, won: 500, def: 1000, borrowed: 0, you: false },
    { rank: 2, userId: 11, name: 'Mai Tran', score: 1200, won: 200, def: 1000, borrowed: 0, you: false },
    { rank: 3, userId: 12, name: 'Alex', score: 1000, won: 0, def: 1000, borrowed: 0, you: true },
  ],
};

const LOBBY_DETAIL_HOST = {
  ...LOBBY_DETAIL,
  id: 2, name: 'Global Pundits Club', owner: 'You', isHost: true, you: 1,
  board: [{ rank: 1, userId: 99, name: 'You', score: 1800, won: 800, def: 1000, borrowed: 0, you: true }],
};

const BORROW_REQUESTS: never[] = [];
const MESSAGES: never[] = [];

function makeFetch(responses: Record<string, unknown>) {
  return vi.fn((url: string) => {
    for (const [pattern, data] of Object.entries(responses)) {
      if (url.includes(pattern)) {
        return Promise.resolve({ ok: true, json: async () => ({ data }) });
      }
    }
    return Promise.resolve({ ok: true, json: async () => ({ data: null }) });
  });
}

beforeEach(() => {
  global.fetch = makeFetch({
    '/api/v1/lobbies/2/borrow-requests': BORROW_REQUESTS,
    '/api/v1/lobbies/1/borrow-requests': BORROW_REQUESTS,
    '/api/v1/lobbies/2/messages': MESSAGES,
    '/api/v1/lobbies/1/messages': MESSAGES,
    // Order matters: more specific patterns first
    '/api/v1/lobbies/2': LOBBY_DETAIL_HOST,
    '/api/v1/lobbies/1': LOBBY_DETAIL,
    '/api/v1/lobbies': LOBBY_LIST,
  }) as typeof fetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Lobbies', () => {
  it('renders section headings for joined and discover lobbies', () => {
    render(<Lobbies s={mockStore()} />);
    expect(screen.getByText(/Your lobbies/)).toBeInTheDocument();
    expect(screen.getByText(/Discover public lobbies/)).toBeInTheDocument();
  });

  it('renders Create lobby button and navigates on click', () => {
    const go = vi.fn();
    render(<Lobbies s={mockStore({ go })} />);
    fireEvent.click(screen.getByRole('button', { name: /Create lobby/i }));
    expect(go).toHaveBeenCalledWith('lobby-create');
  });

  it('shows empty-state initially (before fetch resolves)', () => {
    render(<Lobbies s={mockStore()} />);
    // Before data loads, both sections show empty states
    expect(screen.getByText(/No lobbies yet — create one or join with a code/i)).toBeInTheDocument();
  });

  it('renders joined lobby cards after fetch', async () => {
    render(<Lobbies s={mockStore()} />);
    expect(await screen.findByText('Office League · ABC Corp')).toBeInTheDocument();
  });

  it('renders discover lobby cards for public non-joined lobbies', async () => {
    render(<Lobbies s={mockStore()} />);
    expect(await screen.findByText('Global Pundits Club')).toBeInTheDocument();
  });

  it('Join via code shows toast when code is empty', () => {
    const toastMsg = vi.fn();
    render(<Lobbies s={mockStore({ toastMsg })} />);
    const joinBtns = screen.getAllByRole('button', { name: /^Join$/i });
    fireEvent.click(joinBtns[0]);
    expect(toastMsg).toHaveBeenCalledWith('Paste a code or link first', 'alert', 'var(--gold)');
  });
});

describe('LobbyCreate', () => {
  it('renders lobby creation form fields', () => {
    render(<LobbyCreate s={mockStore()} />);
    expect(screen.getByText('Create a lobby')).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Office League/)).toBeInTheDocument();
  });

  it('renders tournament stage scope chips', () => {
    render(<LobbyCreate s={mockStore()} />);
    expect(screen.getByRole('button', { name: /Whole tournament/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Group stage/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Final' })).toBeInTheDocument();
  });

  it('selecting a future stage shows bracket info notice', () => {
    render(<LobbyCreate s={mockStore()} />);
    fireEvent.click(screen.getByRole('button', { name: /Round of 32/i }));
    expect(screen.getByText(/fixtures lock after the group draw/i)).toBeInTheDocument();
  });

  it('Back button calls s.back()', () => {
    const back = vi.fn();
    render(<LobbyCreate s={mockStore({ back })} />);
    fireEvent.click(screen.getByRole('button', { name: /Back/i }));
    expect(back).toHaveBeenCalled();
  });

  it('borrowing toggle is rendered', () => {
    render(<LobbyCreate s={mockStore()} />);
    expect(screen.getByText(/Allow point borrowing/)).toBeInTheDocument();
  });
});

describe('LobbyView', () => {
  it('shows loading state initially', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    expect(screen.getByText(/Loading lobby/i)).toBeInTheDocument();
  });

  it('renders lobby name and tab navigation after fetch', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    expect(await screen.findByText('Office League · ABC Corp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Standings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
  });

  it('renders lobby header wallet stats after fetch', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    expect(screen.getByText('Lobby wallet')).toBeInTheDocument();
    expect(screen.getByText('Your rank')).toBeInTheDocument();
  });

  it('host lobby (id=2) shows "You host" badge', async () => {
    render(<LobbyView s={mockStore({ param: { id: 2 } })} />);
    expect(await screen.findByText('You host')).toBeInTheDocument();
  });

  it('non-host lobby shows Borrow button', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    expect(screen.getByRole('button', { name: /Borrow/i })).toBeInTheDocument();
  });

  it('Standings tab renders score table headers', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    fireEvent.click(screen.getByRole('button', { name: /Standings/i }));
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('Standings tab renders board rows from fetched data', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    fireEvent.click(screen.getByRole('button', { name: /Standings/i }));
    expect(await screen.findByText('Khoa Nguyen')).toBeInTheDocument();
    expect(screen.getByText('Mai Tran')).toBeInTheDocument();
  });

  it('Chat tab renders message input', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    expect(screen.getByPlaceholderText(/Talk trash/i)).toBeInTheDocument();
  });

  it('Chat tab shows empty-state when no messages', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    expect(await screen.findByText(/No messages yet/i)).toBeInTheDocument();
  });

  it('Requests tab renders borrow requests heading', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    fireEvent.click(screen.getByRole('button', { name: /Requests/i }));
    expect(screen.getByText(/Borrow requests/i)).toBeInTheDocument();
  });

  it('Requests tab shows empty-state when no pending requests', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    fireEvent.click(screen.getByRole('button', { name: /Requests/i }));
    expect(screen.getByText(/No pending requests/i)).toBeInTheDocument();
  });

  it('Members tab renders member list from board data', async () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    await screen.findByText('Office League · ABC Corp');
    fireEvent.click(screen.getByRole('button', { name: /Members/i }));
    expect(await screen.findByText('Khoa Nguyen')).toBeInTheDocument();
  });

  it('All lobbies nav button calls s.go', async () => {
    const go = vi.fn();
    render(<LobbyView s={mockStore({ param: { id: 1 }, go })} />);
    fireEvent.click(screen.getByRole('button', { name: /All lobbies/i }));
    expect(go).toHaveBeenCalledWith('lobbies');
  });
});

describe('BorrowModal', () => {
  it('renders null when borrowOpen is false', () => {
    const { container } = render(<BorrowModal s={mockStore({ borrowOpen: false })} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders borrow overlay when borrowOpen is true', () => {
    render(<BorrowModal s={mockStore({ borrowOpen: true })} />);
    expect(screen.getByText('Borrow points')).toBeInTheDocument();
    expect(screen.getByText(/Request points from the host/i)).toBeInTheDocument();
  });

  it('renders quick-pick amount buttons', () => {
    render(<BorrowModal s={mockStore({ borrowOpen: true })} />);
    expect(screen.getByRole('button', { name: /^100$/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^500$/ })).toBeInTheDocument();
  });

  it('Request button submits and closes modal', () => {
    const closeBorrow = vi.fn();
    const toastMsg = vi.fn();
    render(<BorrowModal s={mockStore({ borrowOpen: true, closeBorrow, toastMsg })} />);
    fireEvent.click(screen.getByRole('button', { name: /Request \d+ points/i }));
    expect(closeBorrow).toHaveBeenCalled();
    expect(toastMsg).toHaveBeenCalledWith('Borrow request sent to host', 'check');
  });

  it('close icon button calls s.closeBorrow', () => {
    const closeBorrow = vi.fn();
    render(<BorrowModal s={mockStore({ borrowOpen: true, closeBorrow })} />);
    const closeBtns = screen.getAllByRole('button');
    const closeBtn = closeBtns.find(btn => btn.className.includes('btn-icon'));
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(closeBorrow).toHaveBeenCalled();
  });
});
