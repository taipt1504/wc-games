import { NextResponse } from 'next/server';
import { z } from 'zod';
import { publishEvent, channels } from '@wc/realtime';
import { prisma } from '@/lib/db';
import { getSessionUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

// GET — recent messages for the lobby (members only).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  const membership = await prisma.lobbyMembership.findUnique({
    where: { lobbyId_userId: { lobbyId, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const messages = await prisma.lobbyMessage.findMany({
    where: { lobbyId },
    orderBy: { createdAt: 'asc' },
    take: 100,
  });

  const userIds = [...new Set(messages.map((m) => m.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true, email: true },
  });
  const userById = new Map(users.map((u) => [u.id, u]));

  const data = messages.map((m) => {
    const u = userById.get(m.userId);
    const who = m.kind === 'SYSTEM'
      ? 'sys'
      : (u?.username || u?.email.split('@')[0] || 'member');
    const t = m.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    return { id: Number(m.id), who, text: m.body, t };
  });

  return NextResponse.json({ data });
}

const SendSchema = z.object({ text: z.string().min(1).max(500) });

// POST — send a chat message (members only).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: { code: 'UNAUTHORIZED' } }, { status: 401 });

  const { id } = await params;
  const lobbyId = BigInt(id);

  const membership = await prisma.lobbyMembership.findUnique({
    where: { lobbyId_userId: { lobbyId, userId: user.id } },
  });
  if (!membership) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const body = await req.json().catch(() => null);
  const parsed = SendSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: { code: 'VALIDATION_ERROR', details: parsed.error.issues } }, { status: 422 });
  }

  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { username: true, email: true } });
  const who = u?.username || u?.email.split('@')[0] || 'member';

  const message = await prisma.lobbyMessage.create({
    data: { lobbyId, userId: user.id, body: parsed.data.text, kind: 'TEXT' },
  });

  const t = message.createdAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  const payload = { id: Number(message.id), who, text: message.body, t };
  // Realtime: broadcast to everyone in the lobby (best-effort).
  await publishEvent(channels.lobby(id), { type: 'chat', lobbyId: Number(lobbyId), message: payload });
  return NextResponse.json({ data: payload }, { status: 201 });
}
