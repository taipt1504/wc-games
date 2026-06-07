import { describe, it, expect } from 'vitest';
import { en } from './dictionaries/en';
import { vi } from './dictionaries/vi';

function leaves(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v as object, `${prefix}${k}.`) : [`${prefix}${k}`]);
}
function flat(o: object, p = ''): [string, unknown][] {
  return Object.entries(o).flatMap(([k, v]) =>
    v && typeof v === 'object' ? flat(v as object, `${p}${k}.`) : [[`${p}${k}`, v]]);
}

describe('catalog parity', () => {
  it('vi covers every en key', () => expect(leaves(vi).sort()).toEqual(leaves(en).sort()));
  it('no empty vi values', () => {
    for (const [k, v] of flat(vi)) expect(v, k).toBeTruthy();
  });
});
