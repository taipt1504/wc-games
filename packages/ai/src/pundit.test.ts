import { describe, it, expect, vi } from 'vitest';
import { generateMatchPreview, generateNewsDraft, deterministicPreview } from './pundit';
import { AI_DISCLAIMER, type LlmGateway } from './llm';

function fakeGateway(reply: string) {
  return { complete: vi.fn(async () => reply) } satisfies LlmGateway;
}

describe('generateMatchPreview', () => {
  it('grounds the prompt on the given teams + ranks and returns content + disclaimer', async () => {
    const gw = fakeGateway('France control midfield. Smart pick: France. ' + AI_DISCLAIMER);
    const r = await generateMatchPreview(gw, { home: { name: 'France', rank: 2 }, away: { name: 'Switzerland', rank: 20 } });

    expect(r.content).toContain('Smart pick');
    expect(r.disclaimer).toBe(AI_DISCLAIMER);

    // prompt is grounded on the real facts
    const userMsg = gw.complete.mock.calls[0][0].messages[1].content;
    expect(userMsg).toContain('France');
    expect(userMsg).toContain('#2');
    expect(userMsg).toContain('Switzerland');
    expect(userMsg).toContain('#20');
  });

  it('passes the chosen model through to the gateway', async () => {
    const gw = fakeGateway('x');
    await generateMatchPreview(gw, { home: { name: 'Brazil', rank: 5 }, away: { name: 'Ghana', rank: 68 }, model: 'claude' });
    expect(gw.complete.mock.calls[0][0].model).toBe('claude');
  });
});

describe('deterministicPreview', () => {
  it('is deterministic — two calls with the same input return identical content', () => {
    const input = { home: { name: 'France', rank: 2 }, away: { name: 'Switzerland', rank: 20 } };
    expect(deterministicPreview(input).content).toBe(deterministicPreview(input).content);
  });

  it('contains both team names', () => {
    const r = deterministicPreview({ home: { name: 'Brazil', rank: 5 }, away: { name: 'Ghana', rank: 68 } });
    expect(r.content).toContain('Brazil');
    expect(r.content).toContain('Ghana');
  });

  it('contains "Smart pick:"', () => {
    const r = deterministicPreview({ home: { name: 'Germany', rank: 16 }, away: { name: 'Japan', rank: 17 } });
    expect(r.content).toContain('Smart pick:');
  });

  it('ends the content with the disclaimer', () => {
    const r = deterministicPreview({ home: { name: 'Spain', rank: 8 }, away: { name: 'Morocco', rank: 14 } });
    expect(r.content).toContain(AI_DISCLAIMER);
    expect(r.disclaimer).toBe(AI_DISCLAIMER);
  });

  it('favours the team with the lower (better) FIFA rank', () => {
    // home rank 2 beats away rank 20 → fav is home
    const r1 = deterministicPreview({ home: { name: 'France', rank: 2 }, away: { name: 'Switzerland', rank: 20 } });
    expect(r1.content).toMatch(/Smart pick: France/);

    // away rank 3 beats home rank 15 → fav is away
    const r2 = deterministicPreview({ home: { name: 'USA', rank: 15 }, away: { name: 'Argentina', rank: 3 } });
    expect(r2.content).toMatch(/Smart pick: Argentina/);
  });

  it('favours home team on equal ranks (deterministic tiebreak)', () => {
    const r = deterministicPreview({ home: { name: 'Portugal', rank: 6 }, away: { name: 'Netherlands', rank: 6 } });
    expect(r.content).toMatch(/Smart pick: Portugal/);
  });

  it('sets provider to "rule-based"', () => {
    const r = deterministicPreview({ home: { name: 'Italy', rank: 9 }, away: { name: 'Croatia', rank: 10 } });
    expect(r.provider).toBe('rule-based');
  });
});

describe('generateNewsDraft', () => {
  it('produces a PENDING, AI-assisted draft that cites the source', async () => {
    const gw = fakeGateway('Spain edged Germany in a six-goal classic.');
    const d = await generateNewsDraft(gw, { sourceTitle: 'Spain edge Germany', sourceUrl: 'https://src/x' });
    expect(d.status).toBe('PENDING');
    expect(d.aiAssisted).toBe(true);
    expect(d.sourceUrl).toBe('https://src/x');
    expect(d.body).toContain('Spain');
    // instructed not to copy verbatim + goes to review queue
    const sys = gw.complete.mock.calls[0][0].messages[0].content;
    expect(sys).toMatch(/not copy text verbatim/i);
    expect(sys).toMatch(/review queue/i);
  });
});
