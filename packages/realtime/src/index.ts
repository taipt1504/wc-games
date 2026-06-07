import Redis from 'ioredis';

export type RealtimeEvent =
  | { type: 'notification'; notification: unknown }
  | { type: 'chat'; lobbyId: number; message: unknown }
  | { type: 'match.update'; matchId: number }
  | { type: 'match.settled'; matchId: number }
  | { type: 'refresh'; what: 'me' }
  | { type: 'job.trigger'; key: string };

export const channels = {
  user: (id: number | bigint | string) => `user.${id}`,
  lobby: (id: number | bigint | string) => `lobby.${id}`,
  matches: 'matches',
  control: 'job.control', // admin "Run now" → worker ControlWorker (not forwarded to browsers)
};

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';

let pub: Redis | null = null;
function publisher(): Redis {
  if (!pub) pub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  return pub;
}

/** Best-effort publish — never throws (realtime is non-critical; the DB write already succeeded). */
export async function publishEvent(channel: string, event: RealtimeEvent): Promise<void> {
  try { await publisher().publish(channel, JSON.stringify(event)); }
  catch { /* swallow — clients fall back to fetch-on-action */ }
}

/** Dedicated subscriber for one SSE connection. */
export function createSubscriber(
  chans: string[],
  onMessage: (channel: string, event: RealtimeEvent) => void,
): { close: () => void } {
  const sub = new Redis(REDIS_URL, { maxRetriesPerRequest: null });
  sub.on('message', (channel, payload) => {
    try { onMessage(channel, JSON.parse(payload) as RealtimeEvent); } catch { /* ignore bad frame */ }
  });
  if (chans.length) void sub.subscribe(...chans);
  return { close: () => { void sub.quit().catch(() => sub.disconnect()); } };
}
