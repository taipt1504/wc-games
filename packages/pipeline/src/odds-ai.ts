/**
 * @wc/pipeline — AI odds proposal (admin "Suggest with AI"). The free fixture API has no odds and
 * the LLM gateway has no live-market access, so this is an AI ESTIMATE from team strength, not real
 * bookmaker odds — the admin reviews + publishes it (source=ADMIN). Values are profit multipliers
 * (payout = stake × (1 + value)), matching the house-line convention.
 */
import type { LlmGateway } from '@wc/ai';

export interface ProposedOdds { mHome: number; mDraw: number; mAway: number }

const clampOdd = (v: unknown): number => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0.2 || n > 20) throw new Error('ODDS_OUT_OF_RANGE');
  return Math.round(n * 100) / 100;
};

/** Parse + validate an LLM odds response (object). Tolerates fences/wrappers. */
export function parseOddsJson(raw: string): ProposedOdds {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < 0 || end < start) throw new Error('no JSON object in response');
  const o = JSON.parse(raw.slice(start, end + 1));
  return { mHome: clampOdd(o?.mHome), mDraw: clampOdd(o?.mDraw), mAway: clampOdd(o?.mAway) };
}

/** Ask the gateway to estimate a fair 1X2 line for a fixture. Grounded prompt; JSON-object output. */
export async function proposeOdds(gateway: LlmGateway, teams: { home: string; away: string }): Promise<ProposedOdds> {
  const messages = [
    { role: 'system' as const, content: 'You are a football odds modeler. Output ONLY a JSON object — no prose, no code fences.' },
    {
      role: 'user' as const,
      content:
        `Estimate fair 1X2 odds for ${teams.home} (home) vs ${teams.away} (away) at the 2026 World Cup, ` +
        `as PROFIT MULTIPLIERS where payout = stake × (1 + value). The stronger side gets the lower value. ` +
        `Typical ranges: favourite 1.3–2.0, draw 2.0–3.0, underdog 1.8–4.0. ` +
        `Return JSON: {"mHome":<number>,"mDraw":<number>,"mAway":<number>}.`,
    },
  ];
  const raw = await gateway.complete({ messages, json: true });
  return parseOddsJson(raw);
}
