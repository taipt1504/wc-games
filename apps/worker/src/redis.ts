/**
 * BullMQ connection options parsed from REDIS_URL.
 * Use a plain options object (not an IORedis instance) so BullMQ builds its own
 * client with the right settings (maxRetriesPerRequest: null) — and to avoid
 * coupling to a specific ioredis version in the workspace.
 */
const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');

export const connection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  ...(url.password ? { password: url.password } : {}),
  ...(url.username ? { username: url.username } : {}),
};
