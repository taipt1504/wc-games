/**
 * AI Pundit (Ora) + news generation. Grounded on real data; always tagged with a
 * disclaimer. PRD §08 (AI Pundit), §10 (News review queue), §15 (pipeline).
 */
import { AI_DISCLAIMER, type LlmGateway } from './llm';

export interface PreviewRecord { played: number; won: number; drawn: number; lost: number; gf: number; ga: number }
export interface PreviewTeam { name: string; group: string | null; record: PreviewRecord }
export interface MatchPreview {
  content: string;
  disclaimer: string;
  provider?: string;
}

const points = (r: PreviewRecord) => r.won * 3 + r.drawn;
const goalDiff = (r: PreviewRecord) => r.gf - r.ga;
const recLine = (t: PreviewTeam) => `${t.record.won}W-${t.record.drawn}D-${t.record.lost}L (${points(t.record)} pts, GF ${t.record.gf}/GA ${t.record.ga})`;

/**
 * Pure, deterministic rule-based preview — no network, no randomness. Grounded on group +
 * results-so-far (real data has no FIFA rank). Favourite = more points, then goal difference;
 * before any match is played the favourite is nominal (home).
 */
export function deterministicPreview(input: { home: PreviewTeam; away: PreviewTeam }): MatchPreview {
  const { home, away } = input;
  const played = home.record.played + away.record.played;
  const favHome = played === 0
    || points(home.record) > points(away.record)
    || (points(home.record) === points(away.record) && goalDiff(home.record) >= goalDiff(away.record));
  const fav = favHome ? home : away;
  const grp = home.group ? `Group ${home.group}` : 'the knockout stage';
  const form = played === 0
    ? `Both sides are yet to play in ${grp}, so this is effectively a tournament opener for them.`
    : `Form so far — ${home.name}: ${recLine(home)}; ${away.name}: ${recLine(away)}.`;
  const content = `${home.name} face ${away.name} in ${grp}. ${form} Smart pick: ${fav.name}. ${AI_DISCLAIMER}`;
  return { content, disclaimer: AI_DISCLAIMER, provider: 'rule-based' };
}

/** Generate a grounded match preview + smart pick. Grounding: only the given facts (no rank). */
export async function generateMatchPreview(
  gateway: LlmGateway,
  input: { home: PreviewTeam; away: PreviewTeam; model?: string },
): Promise<MatchPreview> {
  const fmt = (t: PreviewTeam) =>
    `${t.name} (Group ${t.group ?? '—'}; ${t.record.played === 0 ? 'no matches played yet' : recLine(t)})`;
  const messages = [
    {
      role: 'system' as const,
      content:
        'You are Ora, a football match-preview pundit. Use ONLY the facts provided — do not invent stats, ranks or events. ' +
        'If a team has not played yet, treat this as their tournament opener. ' +
        'Write 2-3 sentences, then a one-line "Smart pick:". Always end with the exact disclaimer.',
    },
    {
      role: 'user' as const,
      content:
        `Preview this fixture using only these facts:\n` +
        `Home: ${fmt(input.home)}\n` +
        `Away: ${fmt(input.away)}\n` +
        `Disclaimer to append verbatim: "${AI_DISCLAIMER}"`,
    },
  ];
  const content = await gateway.complete({ messages, model: input.model });
  return { content, disclaimer: AI_DISCLAIMER, provider: input.model ?? 'gateway' };
}

export interface NewsDraft {
  title: string;
  body: string;
  status: 'PENDING';
  sourceUrl?: string;
  aiAssisted: true;
}

/**
 * Generate a PENDING news draft. Both the title AND body are rewritten by the LLM — the source
 * headline is NEVER stored/published verbatim (PRD §10 copyright). The source URL is kept for
 * citation. Output always goes to the human review queue before publishing.
 */
export async function generateNewsDraft(
  gateway: LlmGateway,
  input: { sourceTitle: string; sourceUrl?: string; model?: string },
): Promise<NewsDraft> {
  const messages = [
    {
      role: 'system' as const,
      content:
        'You are a senior football journalist writing a full, original World Cup 2026 news article for a major sports outlet. ' +
        'From the source headline, write a COMPLETELY ORIGINAL article — never copy or closely paraphrase the source wording (copyright). ' +
        'Write it like a real published piece, 5–7 paragraphs (roughly 350–550 words): ' +
        '(1) a punchy lead paragraph that captures the news; ' +
        '(2) the key context / what happened; ' +
        '(3–4) analysis — tactical angle, what it means for the team or the tournament, and the stakes; ' +
        '(5) the broader picture across the 48-team, three-host format; ' +
        '(6) a forward-looking closing paragraph. ' +
        'Confident, authoritative, neutral newsroom tone with varied sentence length. ' +
        'Do NOT invent direct quotes, exact scores, dates or statistics — reason only from what the headline reasonably implies; speak in general analytical terms where specifics are unknown. ' +
        'Separate every paragraph with a blank line. ' +
        'Output ONLY JSON: {"title":"<original, specific headline, max 90 chars>","body":"<the full ~350–550 word article, paragraphs separated by \\n\\n>"}.',
    },
    {
      role: 'user' as const,
      content: `Source headline: ${input.sourceTitle}${input.sourceUrl ? `\nSource URL: ${input.sourceUrl}` : ''}\nWrite the full original article now — multiple paragraphs, official news style.`,
    },
  ];
  const raw = await gateway.complete({ messages, model: input.model });

  // Parse the rewritten {title, body}; on any failure derive both from the raw text so the
  // stored title is never the verbatim source headline.
  let title = '';
  let body = '';
  try {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      const parsed = JSON.parse(raw.slice(start, end + 1)) as { title?: unknown; body?: unknown };
      if (typeof parsed.title === 'string') title = parsed.title.trim();
      if (typeof parsed.body === 'string') body = parsed.body.trim();
    }
  } catch { /* fall through to text fallback */ }
  if (!body) body = raw.trim();
  if (!title) title = body.split(/[.\n]/)[0].slice(0, 80).trim() || 'World Cup news update';

  return { title, body, status: 'PENDING', sourceUrl: input.sourceUrl, aiAssisted: true };
}
