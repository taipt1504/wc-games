import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { requireAdmin } from '@/lib/session';
import { createGatewayFromEnv } from '@wc/ai';
import type { LlmGateway } from '@wc/ai';
import { generateAndStoreNews, SAMPLE_SOURCES } from '@wc/pipeline';

// Deterministic fallback — works with no LLM gateway configured.
const fallbackGateway: LlmGateway = {
  complete: async ({ messages }) => {
    const last = messages[messages.length - 1]?.content ?? '';
    return `Summary: ${last.slice(0, 120)}`;
  },
};

// POST — trigger AI draft generation into the review queue (admin only). NEWS-01.
export async function POST() {
  const admin = await requireAdmin();
  if (!admin) return NextResponse.json({ error: { code: 'FORBIDDEN' } }, { status: 403 });

  const gw = createGatewayFromEnv(process.env as Record<string, string | undefined>);
  const generated = await generateAndStoreNews(prisma, gw ?? fallbackGateway, SAMPLE_SOURCES);

  return NextResponse.json({ data: { generated } });
}
