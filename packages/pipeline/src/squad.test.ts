import { describe, it, expect } from 'vitest';
import { parseLineupJson } from './squad';

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
