import { describe, it, expect } from 'vitest';
import { resolve, interpolate, translate } from './translate';
import { en } from './dictionaries/en';

describe('resolve', () => {
  it('finds nested', () => expect(resolve(en, 'common.save')).toBe('Save'));
  it('miss → undefined', () => expect(resolve(en, 'common.nope')).toBeUndefined());
});

describe('interpolate', () => {
  it('replaces {var}', () => expect(interpolate('Hi {name}', { name: 'Tai' })).toBe('Hi Tai'));
  it('keeps unknown token', () => expect(interpolate('Hi {name}')).toBe('Hi {name}'));
});

describe('translate', () => {
  it('vi value', () => expect(translate('vi', 'common.save')).toBe('Lưu'));
  it('en value', () => expect(translate('en', 'common.save')).toBe('Save'));
  it('missing key → key string', () => expect(translate('en', 'x.y.z')).toBe('x.y.z'));
});
