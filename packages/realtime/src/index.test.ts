import { describe, it, expect } from 'vitest';
import { channels } from './index';

describe('channels', () => {
  it('builds namespaced channel names', () => {
    expect(channels.user(7)).toBe('user.7');
    expect(channels.lobby(3n)).toBe('lobby.3');
    expect(channels.matches).toBe('matches');
  });
});
