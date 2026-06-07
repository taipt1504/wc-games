import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Btn, Pundit, Flag, TierPill } from '@/components/ui';
import { byId } from '@/lib/wc';

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
