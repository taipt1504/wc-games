import { verifySecret } from '@wc/auth';

export type PasswordCheck = 'OK' | 'PASSWORD_REQUIRED' | 'WRONG_PASSWORD';

/** Gate a join on the lobby's optional password. Public lobby (no hash) → OK. */
export async function verifyLobbyPassword(lobby: { passwordHash: string | null }, password?: string): Promise<PasswordCheck> {
  if (!lobby.passwordHash) return 'OK';
  if (!password) return 'PASSWORD_REQUIRED';
  return (await verifySecret(password, lobby.passwordHash)) ? 'OK' : 'WRONG_PASSWORD';
}

/**
 * Extract a lobby invite token from raw input — a pasted full link (`?join=CODE` or trailing
 * path segment) or the bare code. Returns the trimmed, upper-cased token.
 */
export function parseInviteCode(raw: string): string {
  const s = (raw ?? '').trim();
  if (!s) return '';
  // ?join=CODE anywhere in the string
  const q = s.match(/[?&]join=([^&\s]+)/i);
  if (q) return decodeURIComponent(q[1]).trim().toUpperCase();
  // full URL with the code as the last path segment
  if (/^https?:\/\//i.test(s)) {
    const seg = s.split(/[/?#]/).filter(Boolean).pop() ?? '';
    return seg.trim().toUpperCase();
  }
  return s.toUpperCase();
}
