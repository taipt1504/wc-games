import { describe, it, expect } from 'vitest';
import { deriveLineup, type LineupPlayer } from './formation-pitch';

const P = (name: string, position: string | null, opts: Partial<LineupPlayer> = {}): LineupPlayer =>
  ({ name, position, number: opts.number ?? null, starter: opts.starter });

const band = (b: string, n: number): LineupPlayer[] =>
  Array.from({ length: n }, (_, i) => P(`${b}${i + 1}`, b));

describe('deriveLineup', () => {
  it('real XI: starters split into bands (top→bottom), rest to subs, passed formation', () => {
    const players: LineupPlayer[] = [
      P('GK1', 'GK', { starter: true, number: 1 }),
      P('CB1', 'CB', { starter: true, number: 4 }), P('CB2', 'CB', { starter: true, number: 5 }),
      P('CM1', 'CM', { starter: true, number: 8 }),
      P('ST1', 'ST', { starter: true, number: 9 }),
      P('Sub1', 'DEF', { number: 13 }), P('Sub2', 'MID', { number: 14 }),
    ];
    const r = deriveLineup(players, '4-2-3-1');
    expect(r.formationLabel).toBe('4-2-3-1');
    expect(r.subs.map((p) => p.name)).toEqual(['Sub1', 'Sub2']);
    // lines top→bottom, empty bands dropped: FWD[ST1], DM[CM1], DEF[CB1,CB2], GK[GK1]
    expect(r.lines.flat().map((p) => p.name)).toEqual(['ST1', 'CM1', 'CB1', 'CB2', 'GK1']);
    expect(r.lines[0].map((p) => p.name)).toEqual(['ST1']);
    expect(r.lines[r.lines.length - 1].map((p) => p.name)).toEqual(['GK1']);
  });

  it('no XI: default 4-3-3 from coarse roster, subs = the rest', () => {
    const players = [...band('GK', 3), ...band('DEF', 8), ...band('MID', 8), ...band('FWD', 7)]; // 26
    const r = deriveLineup(players);
    expect(r.formationLabel).toBe('4-3-3');
    expect(r.lines.map((l) => l.length)).toEqual([3, 3, 4, 1]); // FWD, MID, DEF, GK
    expect(r.lines[0][0].name).toBe('FWD1');
    expect(r.lines[r.lines.length - 1][0].name).toBe('GK1');
    expect(r.subs.length).toBe(26 - 11);
  });

  it('no XI short forwards: show fewer, never fabricate', () => {
    const players = [...band('GK', 2), ...band('DEF', 5), ...band('MID', 5), ...band('FWD', 2)]; // 14
    const r = deriveLineup(players);
    expect(r.lines.map((l) => l.length)).toEqual([2, 3, 4, 1]); // FWD only 2
    expect(r.subs.length).toBe(14 - 10);
  });

  it('empty roster → empty result', () => {
    expect(deriveLineup([])).toEqual({ lines: [], subs: [], formationLabel: '' });
  });
});
