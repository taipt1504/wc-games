import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Lobbies, LobbyCreate, LobbyView, BorrowModal } from '@/components/screens-lobby';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'lobbies', param: {}, points: WC.me.points, bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: true,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

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

  it('renders joined lobby cards', () => {
    render(<Lobbies s={mockStore()} />);
    // WC.lobbies has lobbies with joined=true; at least one should appear
    expect(screen.getByText('Office League · ABC Corp')).toBeInTheDocument();
  });

  it('renders discover lobby cards for public non-joined lobbies', () => {
    render(<Lobbies s={mockStore()} />);
    expect(screen.getByText('Global Pundits Club')).toBeInTheDocument();
  });

  it('Join via code shows toast when code is empty', () => {
    const toastMsg = vi.fn();
    render(<Lobbies s={mockStore({ toastMsg })} />);
    // The second Join button is the code-join one (first is in LobbyCard)
    const joinBtns = screen.getAllByRole('button', { name: /^Join$/i });
    // The code-join button is the FIRST Join (search/join bar, before lobby cards)
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
  it('renders lobby name and tab navigation', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    expect(screen.getByText('Office League · ABC Corp')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Standings/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Chat/i })).toBeInTheDocument();
  });

  it('renders lobby header wallet stats', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    expect(screen.getByText('Lobby wallet')).toBeInTheDocument();
    expect(screen.getByText('Your rank')).toBeInTheDocument();
  });

  it('host lobby (id=2) shows "You host" badge and Odds button in matches tab', () => {
    render(<LobbyView s={mockStore({ param: { id: 2 } })} />);
    expect(screen.getByText('You host')).toBeInTheDocument();
    // Matches tab is default; host should see Odds buttons
    const oddsBtns = screen.getAllByRole('button', { name: /^Odds$/i });
    expect(oddsBtns.length).toBeGreaterThan(0);
  });

  it('non-host lobby shows Borrow button', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    expect(screen.getByRole('button', { name: /Borrow/i })).toBeInTheDocument();
  });

  it('Standings tab renders score table', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Standings/i }));
    expect(screen.getByText('Member')).toBeInTheDocument();
    expect(screen.getByText('Score')).toBeInTheDocument();
  });

  it('Chat tab renders message input', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Chat/i }));
    expect(screen.getByPlaceholderText(/Talk trash/i)).toBeInTheDocument();
  });

  it('Requests tab renders borrow requests heading', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Requests/i }));
    expect(screen.getByText(/Borrow requests/i)).toBeInTheDocument();
  });

  it('Members tab renders member list', () => {
    render(<LobbyView s={mockStore({ param: { id: 1 } })} />);
    fireEvent.click(screen.getByRole('button', { name: /Members/i }));
    // Khoa Nguyen is rank 1 in lobbyBoard
    expect(screen.getByText('Khoa Nguyen')).toBeInTheDocument();
  });

  it('All lobbies nav button calls s.go', () => {
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
    // The x icon button in the modal header
    const closeBtns = screen.getAllByRole('button');
    // Find close btn (btn-icon with no text)
    const closeBtn = closeBtns.find(btn => btn.className.includes('btn-icon'));
    expect(closeBtn).toBeDefined();
    fireEvent.click(closeBtn!);
    expect(closeBorrow).toHaveBeenCalled();
  });
});
