import type { Locale } from './locales';
import { dictionaries } from './dictionaries';
import { en } from './dictionaries/en';

export function resolve(dict: unknown, path: string): string | undefined {
  const v = path.split('.').reduce<unknown>(
    (o, k) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[k] : undefined), dict);
  return typeof v === 'string' ? v : undefined;
}

export function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_m, k: string) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Resolve a dotted key in the active locale → EN fallback → the key itself; then interpolate {vars}. */
export function translate(locale: Locale, path: string, vars?: Record<string, string | number>): string {
  const hit = resolve(dictionaries[locale], path) ?? resolve(en, path);
  if (hit == null) {
    if (process.env.NODE_ENV !== 'production') console.warn(`[i18n] missing key: ${path}`);
    return path;
  }
  return interpolate(hit, vars);
}
