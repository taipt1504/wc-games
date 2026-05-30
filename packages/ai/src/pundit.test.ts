import { describe, it, expect, vi } from 'vitest';
import { generateMatchPreview, generateNewsDraft } from './pundit';
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
