'use client';
/* GOLAZO — Schedule · Match detail · Bet slip (stub — ported in fan-out from screens-match.jsx) */
import type { ScreenProps } from '@/lib/store';
import { Stub } from '@/components/screen-stub';

export function Schedule(_: ScreenProps) {
  return <Stub title="Matches" />;
}

export function MatchDetail(_: ScreenProps) {
  return <Stub title="Match detail" />;
}

/** Bet slip overlay — rendered globally by AppShell. Stub: no UI yet. */
export function BetSlip(_: ScreenProps) {
  return null;
}
