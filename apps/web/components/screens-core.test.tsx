import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Landing, Home } from '@/components/screens-core';
import type { Store } from '@/lib/store';
import { WC } from '@/lib/wc';

function mockStore(over: Partial<Store> = {}): Store {
  return {
    route: 'landing', param: {}, points: WC.me.points, tier: WC.me.tier, bets: [], streak: 6, checkedIn: false,
    betSlip: null, borrowOpen: false, toast: null, authed: false,
    go: vi.fn(), back: vi.fn(), toastMsg: vi.fn(), login: vi.fn(), logout: vi.fn(),
    checkin: vi.fn(), claimMission: vi.fn(), pickFor: () => undefined, openBet: vi.fn(),
    setSlipPick: vi.fn(), closeBet: vi.fn(), confirmBet: vi.fn(), openBorrow: vi.fn(), closeBorrow: vi.fn(),
    ...over,
  };
}

describe('Landing', () => {
  it('renders hero headline + primary CTA', () => {
    render(<Landing s={mockStore()} />);
    expect(screen.getByText(/WHOLE WORLD CUP/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Claim your 1,000 points/i })).toBeInTheDocument();
  });
  it('CTA navigates to signup', () => {
    const go = vi.fn();
    render(<Landing s={mockStore({ go })} />);
    fireEvent.click(screen.getByRole('button', { name: /Claim your 1,000 points/i }));
    expect(go).toHaveBeenCalledWith('auth', { mode: 'signup' });
  });
});

describe('Home', () => {
  it('renders greeting + check-in card', () => {
    render(<Home s={mockStore()} />);
    expect(screen.getByText(/Hey Alex/)).toBeInTheDocument();
    expect(screen.getByText(/day streak/)).toBeInTheDocument();
  });
  it('check-in button triggers store.checkin', () => {
    const checkin = vi.fn();
    render(<Home s={mockStore({ checkin })} />);
    fireEvent.click(screen.getByRole('button', { name: /Check in/i }));
    expect(checkin).toHaveBeenCalled();
  });
});
