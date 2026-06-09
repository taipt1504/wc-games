import { describe, it, expect } from 'vitest';
import { parseLineupJson, applyLineupAssignments, type RosterPlayer } from './squad';

const roster: RosterPlayer[] = [
  { id: 1n, name: 'Romelu Lukaku' },
  { id: 2n, name: 'Kevin De Bruyne' },
  { id: 3n, name: 'José Giménez' },
];

describe('applyLineupAssignments', () => {
  it('matches by normalized name (case + accents), sets position/number/starter', () => {
    const updates = applyLineupAssignments(roster, [
      { name: 'romelu lukaku', position: 'ST', number: 9, starter: true },
      { name: 'Jose Gimenez', position: 'CB', number: 2, starter: true },
    ]);
    expect(updates).toEqual([
      { id: 1n, position: 'ST', number: 9, isStarter: true },
      { id: 3n, position: 'CB', number: 2, isStarter: true },
    ]);
  });

  it('omitted roster players produce no update (stay bench after reset)', () => {
    const updates = applyLineupAssignments(roster, [{ name: 'Romelu Lukaku', position: 'ST', number: 9, starter: true }]);
    expect(updates.map((u) => u.id)).toEqual([1n]);
  });

  it('unmatched assignment names are ignored (never invent rows)', () => {
    const updates = applyLineupAssignments(roster, [{ name: 'Nonexistent Player', position: 'ST', number: 9, starter: true }]);
    expect(updates).toEqual([]);
  });
});


describe('parseLineupJson', () => {
  it('parses a clean lineup object (manager, formation, players + starter)', () => {
    const out = parseLineupJson('{"manager":"Tite","formation":"4-2-3-1","players":[{"number":1,"name":"Alisson","position":"GK","starter":true},{"number":10,"name":"Neymar","position":"CAM","starter":false}]}');
    expect(out.manager).toBe('Tite');
    expect(out.formation).toBe('4-2-3-1');
    expect(out.players).toHaveLength(2);
    expect(out.players[0]).toEqual({ number: 1, name: 'Alisson', position: 'GK', starter: true });
    expect(out.players[1].starter).toBe(false);
  });

  it('tolerates code fences/prose and uppercases positions', () => {
    const out = parseLineupJson('```json\n{"manager":"X","formation":"4-3-3","players":[{"number":"7","name":"Vinicius","position":"lw","starter":true}]}\n```');
    expect(out.players[0]).toEqual({ number: 7, name: 'Vinicius', position: 'LW', starter: true });
  });

  it('drops bad rows (empty name, too-long position), dedupes, clamps numbers', () => {
    const out = parseLineupJson('{"players":[{"name":"A","position":"CB","starter":true},{"name":"A","position":"RB"},{"name":"","position":"GK"},{"name":"B","position":"MIDFIELDER"},{"number":250,"name":"C","position":"ST"}]}');
    expect(out.players.map((p) => p.name)).toEqual(['A', 'C']);
    expect(out.players.find((p) => p.name === 'A')?.starter).toBe(true);
    expect(out.players.find((p) => p.name === 'C')?.number).toBeNull();
  });

  it('missing starter flag defaults to false', () => {
    const out = parseLineupJson('{"players":[{"name":"D","position":"ST"}]}');
    expect(out.players[0].starter).toBe(false);
  });

  it('throws when there is no JSON object', () => {
    expect(() => parseLineupJson('no json here')).toThrow();
  });
});
