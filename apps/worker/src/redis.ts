/**
 * BullMQ connection options parsed from REDIS_URL.
 * Use a plain options object (not an IORedis instance) so BullMQ builds its own
 * client with the right settings (maxRetriesPerRequest: null) — and to avoid
 * coupling to a specific ioredis version in the workspace.
 *
 * Supports auth + TLS:
 *   redis://:PASSWORD@host:6379            (password only — note the leading ":")
 *   redis://USER:PASSWORD@host:6379        (ACL user + password)
 *   rediss://:PASSWORD@host:6380           (TLS — managed/cloud Redis)
 *   redis://host:6379/2                    (optional db index)
 * Password/username with special chars must be URL-encoded in REDIS_URL.
 */
const url = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
const db = url.pathname.length > 1 ? Number(url.pathname.slice(1)) : undefined;

export const connection = {
  host: url.hostname,
  port: Number(url.port || 6379),
  ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
  ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
  ...(db != null && !Number.isNaN(db) ? { db } : {}),
  // rediss:// → enable TLS (cloud/managed Redis that requires a password usually does too)
  ...(url.protocol === 'rediss:' ? { tls: {} } : {}),
};
