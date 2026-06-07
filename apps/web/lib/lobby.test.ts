import { describe, it, expect } from 'vitest';
import { parseInviteCode, verifyLobbyPassword } from './lobby';

describe('parseInviteCode', () => {
  it('returns the bare code upper-cased', () => {
    expect(parseInviteCode('0f051de7')).toBe('0F051DE7');
    expect(parseInviteCode('  ABC123 ')).toBe('ABC123');
  });
  it('extracts the token from a ?join= link', () => {
    expect(parseInviteCode('https://app.example/?join=0F051DE7')).toBe('0F051DE7');
    expect(parseInviteCode('http://localhost:3000/?foo=1&join=abc123')).toBe('ABC123');
  });
  it('extracts the last path segment from a plain URL', () => {
    expect(parseInviteCode('https://app.example/join/XY99')).toBe('XY99');
  });
  it('returns empty for blank input', () => {
    expect(parseInviteCode('   ')).toBe('');
  });
});

describe('verifyLobbyPassword', () => {
  it('public lobby (no hash) → OK regardless of password', async () => {
    expect(await verifyLobbyPassword({ passwordHash: null })).toBe('OK');
  });
  it('protected lobby, no password supplied → PASSWORD_REQUIRED', async () => {
    expect(await verifyLobbyPassword({ passwordHash: '$2a$10$fakehash' })).toBe('PASSWORD_REQUIRED');
  });
});
