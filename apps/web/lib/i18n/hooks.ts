'use client';
import { useContext } from 'react';
import { I18nContext } from './provider';
import { DEFAULT_LOCALE, type Locale } from './locales';
import { translate } from './translate';

/** Works WITHOUT a provider (falls back to EN) so standalone-rendered components/tests keep rendering English. */
export function useT() {
  const ctx = useContext(I18nContext);
  const locale: Locale = ctx?.locale ?? DEFAULT_LOCALE;
  const t = (path: string, vars?: Record<string, string | number>) => translate(locale, path, vars);
  const fmt = {
    date: (d: Date | string | number, opts?: Intl.DateTimeFormatOptions) =>
      new Intl.DateTimeFormat(locale, opts).format(new Date(d)),
    num: (n: number, opts?: Intl.NumberFormatOptions) => new Intl.NumberFormat(locale, opts).format(n),
  };
  return { t, locale, setLocale: ctx?.setLocale ?? (() => { /* no-op outside provider */ }), fmt };
}
