'use client';
/* GOLAZO — Lobbies · Create · Lobby view · Borrow modal (stub — ported in fan-out from screens-lobby.jsx) */
import type { ScreenProps } from '@/lib/store';
import { Stub } from '@/components/screen-stub';

export function Lobbies(_: ScreenProps) {
  return <Stub title="Lobbies" />;
}
export function LobbyCreate(_: ScreenProps) {
  return <Stub title="New lobby" />;
}
export function LobbyView(_: ScreenProps) {
  return <Stub title="Lobby" />;
}
/** Borrow-points modal — rendered globally by AppShell. Stub: no UI yet. */
export function BorrowModal(_: ScreenProps) {
  return null;
}
