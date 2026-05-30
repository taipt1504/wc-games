import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OddsRow, Btn, Pundit, Flag, TierPill } from '@/components/ui';
import { matchById, byId } from '@/lib/wc';

describe('OddsRow', () => {
  it('renders three 1/X/2 odds buttons for a scheduled match', () => {
    const m = matchById(27)!;
    render(<OddsRow m={m} />);
    expect(screen.getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText(/Draw/)).toBeInTheDocument();
    expect(screen.getByText(m.odds.md.toFixed(2))).toBeInTheDocument();
  });
});

describe('Btn', () => {
  it('renders children and variant class', () => {
    render(<Btn variant="primary">Sign up free</Btn>);
    const b = screen.getByRole('button', { name: /Sign up free/ });
    expect(b).toBeInTheDocument();
    expect(b.className).toContain('btn-primary');
  });
});

describe('Pundit (Ora mascot)', () => {
  it('renders an SVG', () => {
    const { container } = render(<Pundit mood="happy" glow />);
    expect(container.querySelector('svg')).toBeTruthy();
  });
});

describe('Flag', () => {
  it('shows team code when requested', () => {
    const t = byId(16); // France
    render(<Flag team={t} showCode />);
    expect(screen.getByText('FRA')).toBeInTheDocument();
  });
});

describe('TierPill', () => {
  it('renders the tier label', () => {
    render(<TierPill tier="Gold" />);
    expect(screen.getByText('Gold')).toBeInTheDocument();
  });
});
