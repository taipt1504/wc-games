/**
 * AI Pundit (Ora) + news generation. Grounded on real data; always tagged with a
 * disclaimer. PRD §08 (AI Pundit), §10 (News review queue), §15 (pipeline).
 */
import { AI_DISCLAIMER, type LlmGateway, type LlmMessage } from './llm';

export interface PreviewTeam { name: string; rank: number }
export interface MatchPreview {
  content: string;
  disclaimer: string;
  provider?: string;
}

/**
 * Pure, deterministic rule-based preview — no network, no randomness.
 * Favourite = team with lower FIFA rank number (better rank wins tiebreak: home favoured).
 */
export function deterministicPreview(input: { home: PreviewTeam; away: PreviewTeam }): MatchPreview {
  const { home, away } = input;
  const fav = home.rank <= away.rank ? home : away;
  const dog = fav === home ? away : home;
  const content =
    `${home.name} (FIFA #${home.rank}) host ${away.name} (FIFA #${away.rank}) in what promises to be a competitive fixture. ` +
    `${fav.name} enter as the higher-ranked side and will look to control proceedings, while ${dog.name} will rely on a disciplined defensive shape and swift transitions. ` +
    `Smart pick: ${fav.name}. ${AI_DISCLAIMER}`;
  return { content, disclaimer: AI_DISCLAIMER, provider: 'rule-based' };
}

/** Generate a grounded match preview + smart pick. Grounding: only the given facts. */
export async function generateMatchPreview(
  gateway: LlmGateway,
  input: { home: PreviewTeam; away: PreviewTeam; model?: string },
): Promise<MatchPreview> {
  const messages = [
    {
      role: 'system' as const,
      content:
        'You are Ora, a football match-preview pundit. Use ONLY the facts provided — do not invent stats or events. ' +
        'Write 2-3 sentences, then a one-line "Smart pick:". Always end with the exact disclaimer.',
    },
    {
      role: 'user' as const,
      content:
        `Preview this fixture using only these facts:\n` +
        `Home: ${input.home.name} (FIFA #${input.home.rank})\n` +
        `Away: ${input.away.name} (FIFA #${input.away.rank})\n` +
        `Disclaimer to append verbatim: "${AI_DISCLAIMER}"`,
    },
  ];
  const content = await gateway.complete({ messages, model: input.model });
  return { content, disclaimer: AI_DISCLAIMER, provider: input.model };
}

export interface NewsDraft {
  title: string;
  body: string;
  status: 'PENDING';
  sourceUrl?: string;
  aiAssisted: true;
}

/** Generate a PENDING news draft (rewritten/summarized, never verbatim; cites source). */
export async function generateNewsDraft(
  gateway: LlmGateway,
  input: { sourceTitle: string; sourceUrl?: string; model?: string },
): Promise<NewsDraft> {
  const messages = [
    {
      role: 'system' as const,
      content:
        'Rewrite and summarize the source headline into a short, neutral football news draft. ' +
        'Do NOT copy text verbatim. Keep it factual. Output goes to a human review queue before publishing.',
    },
    {
      role: 'user' as const,
      content: `Source headline: ${input.sourceTitle}${input.sourceUrl ? `\nSource URL: ${input.sourceUrl}` : ''}`,
    },
  ];
  const body = await gateway.complete({ messages, model: input.model });
  return { title: input.sourceTitle, body, status: 'PENDING', sourceUrl: input.sourceUrl, aiAssisted: true };
}
