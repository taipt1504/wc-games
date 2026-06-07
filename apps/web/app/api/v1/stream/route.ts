import { createSubscriber, channels } from '@wc/realtime';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET /api/v1/stream — SSE: subscribes the authed user to their realtime channels
// (user.{id} + global matches + each joined lobby) and streams events to an EventSource.
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response('unauthorized', { status: 401 });

  const memberships = await prisma.lobbyMembership.findMany({ where: { userId: user.id }, select: { lobbyId: true } });
  const chans = [
    channels.user(String(user.id)),
    channels.matches,
    ...memberships.map((m) => channels.lobby(String(m.lobbyId))),
  ];

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const sub = createSubscriber(chans, (_c, ev) => {
        try { controller.enqueue(enc.encode(`data: ${JSON.stringify(ev)}\n\n`)); } catch { /* stream closed */ }
      });
      const ping = setInterval(() => {
        try { controller.enqueue(enc.encode(': ping\n\n')); } catch { /* stream closed */ }
      }, 25_000);
      const close = () => { clearInterval(ping); sub.close(); try { controller.close(); } catch { /* already closed */ } };
      req.signal.addEventListener('abort', close);
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive' },
  });
}
