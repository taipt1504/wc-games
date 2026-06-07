/**
 * fetch wrapper that transparently re-authenticates once on a 401.
 * The access JWT is short-lived; on expiry this calls /api/v1/auth/refresh to rotate the
 * refresh token + mint a new access cookie, then retries the original request exactly once.
 */

// Single-flight: concurrent 401s (e.g. the three parallel calls in refreshUser) share ONE
// refresh request, so the refresh token is rotated only once. Firing it N times would replay
// an already-rotated token and trip reuse-detection → spurious logout.
let refreshing: Promise<boolean> | null = null;

function refreshOnce(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', { method: 'POST' })
      .then((r) => r.ok)
      .catch(() => false)
      .finally(() => { refreshing = null; });
  }
  return refreshing;
}

export async function apiFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  let res = await fetch(input, init);
  if (res.status === 401) {
    const ok = await refreshOnce();
    if (ok) res = await fetch(input, init);
  }
  return res;
}
