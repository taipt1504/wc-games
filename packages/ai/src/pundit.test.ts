import { describe, it, expect, vi } from 'vitest';
import { generateMatchPreview, generateNewsDraft, deterministicPreview, type PreviewRecord } from './pundit';
import { AI_DISCLAIMER, type LlmGateway } from './llm';

function fakeGateway(reply: string) {
  return { complete: vi.fn(async () => reply) } satisfies LlmGateway;
}
const rec = (played: number, won: number, drawn: number, lost: number, gf: number, ga: number): PreviewRecord => ({ played, won, drawn, lost, gf, ga });
const fresh = rec(0, 0, 0, 0, 0, 0);

describe('generateMatchPreview', () => {
  it('grounds the prompt on group + record and returns content + disclaimer', async () => {
    const gw = fakeGateway('France control midfield. Smart pick: France. ' + AI_DISCLAIMER);
    const r = await generateMatchPreview(gw, {
      home: { name: 'France', group: 'A', record: rec(1, 1, 0, 0, 3, 1) },
      away: { name: 'Switzerland', group: 'A', record: rec(1, 0, 0, 1, 1, 3) },
    });
    expect(r.content).toContain('Smart pick');
    expect(r.disclaimer).toBe(AI_DISCLAIMER);

    const userMsg = gw.complete.mock.calls[0][0].messages[1].content;
    expect(userMsg).toContain('France');
    expect(userMsg).toContain('Group A');
    expect(userMsg).toContain('Switzerland');
    expect(userMsg).not.toContain('#'); // no fake FIFA rank
  });

  it('passes the chosen model through to the gateway', async () => {
    const gw = fakeGateway('x');
    await generateMatchPreview(gw, { home: { name: 'Brazil', group: 'C', record: fresh }, away: { name: 'Ghana', group: 'C', record: fresh }, model: 'claude' });
    expect(gw.complete.mock.calls[0][0].model).toBe('claude');
  });
});

describe('deterministicPreview', () => {
  const A = { name: 'France', group: 'A', record: rec(1, 1, 0, 0, 3, 1) };
  const B = { name: 'Switzerland', group: 'A', record: rec(1, 0, 0, 1, 1, 3) };

  it('is deterministic — identical input → identical content', () => {
    expect(deterministicPreview({ home: A, away: B }).content).toBe(deterministicPreview({ home: A, away: B }).content);
  });

  it('contains both names, "Smart pick:", and ends with the disclaimer', () => {
    const r = deterministicPreview({ home: A, away: B });
    expect(r.content).toContain('France');
    expect(r.content).toContain('Switzerland');
    expect(r.content).toContain('Smart pick:');
    expect(r.content).toContain(AI_DISCLAIMER);
    expect(r.provider).toBe('rule-based');
  });

  it('favours the team with more points', () => {
    expect(deterministicPreview({ home: A, away: B }).content).toMatch(/Smart pick: France/);
    const r2 = deterministicPreview({
      home: { name: 'USA', group: 'D', record: rec(1, 0, 0, 1, 0, 2) },
      away: { name: 'Argentina', group: 'D', record: rec(1, 1, 0, 0, 2, 0) },
    });
    expect(r2.content).toMatch(/Smart pick: Argentina/);
  });

  it('before any match is played, favours home (nominal) and calls it an opener', () => {
    const r = deterministicPreview({ home: { name: 'Mexico', group: 'A', record: fresh }, away: { name: 'South Africa', group: 'A', record: fresh } });
    expect(r.content).toMatch(/Smart pick: Mexico/);
    expect(r.content).toMatch(/opener/i);
  });
});

describe('generateNewsDraft', () => {
  it('rewrites BOTH title and body — never stores the source headline verbatim', async () => {
    const gw = fakeGateway('{"title":"Spain see off Germany in tense affair","body":"Spain edged Germany in a six-goal classic."}');
    const d = await generateNewsDraft(gw, { sourceTitle: 'Spain edge Germany', sourceUrl: 'https://src/x' });
    expect(d.status).toBe('PENDING');
    expect(d.aiAssisted).toBe(true);
    expect(d.sourceUrl).toBe('https://src/x');
    expect(d.title).not.toBe('Spain edge Germany');
    expect(d.title).toBe('Spain see off Germany in tense affair');
    expect(d.body).toContain('Spain');
    const sys = gw.complete.mock.calls[0][0].messages[0].content;
    expect(sys).toMatch(/do NOT copy text verbatim/i);
  });

  it('on non-JSON output, derives a title from the body (still not the verbatim source)', async () => {
    const gw = fakeGateway('Germany bounced back with a convincing win over Japan.');
    const d = await generateNewsDraft(gw, { sourceTitle: 'Japan stun Germany' });
    expect(d.title).not.toBe('Japan stun Germany');
    expect(d.body).toContain('Germany');
  });

  it('parses the Vietnamese translation when present (EN + VI both stored)', async () => {
    const gw = fakeGateway('{"title":"Spain see off Germany","body":"Spain edged Germany.","titleVi":"Tây Ban Nha vượt qua Đức","bodyVi":"Tây Ban Nha thắng sát nút trước Đức."}');
    const d = await generateNewsDraft(gw, { sourceTitle: 'Spain edge Germany' });
    expect(d.title).toBe('Spain see off Germany');
    expect(d.titleVi).toBe('Tây Ban Nha vượt qua Đức');
    expect(d.bodyVi).toContain('Tây Ban Nha');
    // system prompt asks for a Vietnamese translation
    expect(gw.complete.mock.calls[0][0].messages[0].content).toMatch(/vietnamese translation/i);
  });

  it('leaves VI undefined when the model returns EN-only (consumers fall back to EN)', async () => {
    const gw = fakeGateway('{"title":"Brazil cruise past Nigeria","body":"Brazil were comfortable."}');
    const d = await generateNewsDraft(gw, { sourceTitle: 'Brazil beat Nigeria' });
    expect(d.titleVi).toBeUndefined();
    expect(d.bodyVi).toBeUndefined();
  });
});
