import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Admin } from '@/components/screens-admin';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'admin', param: {}, points: WC.me.points, bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: true,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('Admin', () => {
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
    // desktop rail nav button (first occurrence)
    const tourBtn = screen.getAllByRole('button', { name: /Tournament/i })[0];
    fireEvent.click(tourBtn);
    expect(screen.getByText('Tournament management')).toBeInTheDocument();
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

  it('clicking Review queue tab shows News review queue heading', () => {
    render(<Admin s={mockStore()} />);
    const reviewBtn = screen.getAllByRole('button', { name: /Review queue/i })[0];
    fireEvent.click(reviewBtn);
    expect(screen.getByText('News review queue')).toBeInTheDocument();
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
    // nav button label + view heading both read "Audit log" after switching tab
    expect(screen.getAllByText('Audit log').length).toBeGreaterThanOrEqual(2);
  });

  it('Back to app button calls s.go with home', () => {
    const go = vi.fn();
    render(<Admin s={mockStore({ go })} />);
    fireEvent.click(screen.getByRole('button', { name: /Back to app/i }));
    expect(go).toHaveBeenCalledWith('home');
  });

  it('clicking a risk lobby row opens risk detail view', () => {
    render(<Admin s={mockStore()} />);
    // navigate to risk tab
    const riskBtn = screen.getAllByRole('button', { name: /Lobby risk/i })[0];
    fireEvent.click(riskBtn);
    // click the first Investigate button
    const investigateBtn = screen.getAllByRole('button', { name: /Investigate/i })[0];
    fireEvent.click(investigateBtn);
    expect(screen.getByText(/Back to risk queue/i)).toBeInTheDocument();
  });

  it('clicking a user row opens user detail view', () => {
    render(<Admin s={mockStore()} />);
    const usersBtn = screen.getAllByRole('button', { name: /^Users$/i })[0];
    fireEvent.click(usersBtn);
    // click first row in the table (first user)
    const rows = screen.getAllByRole('row');
    // rows[0] is header, rows[1] is first data row
    fireEvent.click(rows[1]);
    expect(screen.getByText(/Back to users/i)).toBeInTheDocument();
  });

  it('overview shows risk queue rows from WC.riskLobbies', () => {
    render(<Admin s={mockStore()} />);
    // first risk lobby name should appear
    expect(screen.getByText(WC.riskLobbies[0].name)).toBeInTheDocument();
  });

  it('overview shows pipeline job names', () => {
    render(<Admin s={mockStore()} />);
    expect(screen.getByText(WC.aiJobs[0].name)).toBeInTheDocument();
  });
});
