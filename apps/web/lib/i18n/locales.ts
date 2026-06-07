export type Locale = 'en' | 'vi';
export const LOCALES: Locale[] = ['en', 'vi'];
export const DEFAULT_LOCALE: Locale = 'en';
export const LOCALE_COOKIE = 'wcg_locale';
export const LOCALE_LABELS: Record<Locale, string> = { en: 'EN', vi: 'VI' };
export const LOCALE_FLAGS: Record<Locale, string> = { en: '🇬🇧', vi: '🇻🇳' };
export const BRAND = 'World Cup Games';

export function normalizeLocale(v: string | undefined | null): Locale {
  return v === 'vi' ? 'vi' : 'en';
}

export function detectBrowserLocale(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  return navigator.language?.toLowerCase().startsWith('vi') ? 'vi' : 'en';
}
