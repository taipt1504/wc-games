/**
 * @wc/pipeline — AI odds proposal (admin "Suggest with AI"). The free fixture API has no odds and
 * the LLM gateway has no live web/market access, so this is an AI ESTIMATE — the model is asked to
 * price the line the way a major regulated bookmaker (Pinnacle / Bet365 / William Hill consensus)
 * would, from its training knowledge, NOT a live scrape — the admin reviews + publishes it
 * (source=ADMIN). Values are profit multipliers (payout = stake × (1 + value)), house-line convention.
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
    {
      role: 'system' as const,
      content:
        'You are a senior odds compiler at a major regulated sportsbook. Price 1X2 markets the way the ' +
        'sharp bookmaker consensus does — Pinnacle, Bet365, William Hill — reflecting how those books ' +
        'would currently quote this match. Base it on the most reliable public information you know: each ' +
        'team\'s real strength, recent form, squad quality, FIFA ranking, and World Cup history. Apply a ' +
        'realistic bookmaker margin (overround ~105–108%) and never output arbitrage-free or inverted lines. ' +
        'Output ONLY a JSON object — no prose, no code fences.',
    },
    {
      role: 'user' as const,
      content:
        `Quote the current bookmaker-consensus 1X2 line for ${teams.home} (home) vs ${teams.away} (away) ` +
        `at the 2026 FIFA World Cup, as PROFIT MULTIPLIERS where payout = stake × (1 + value) ` +
        `(i.e. decimal odds − 1). The stronger side gets the lower value. ` +
        `Sanity ranges: clear favourite 0.25–1.0, even match 1.5–2.5, draw 1.9–3.2, big underdog 2.5–8.0. ` +
        `Return JSON: {"mHome":<number>,"mDraw":<number>,"mAway":<number>}.`,
    },
  ];
  const raw = await gateway.complete({ messages, json: true });
  return parseOddsJson(raw);
}
