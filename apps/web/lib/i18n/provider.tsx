'use client';
import React, { createContext, useCallback, useEffect, useState } from 'react';
import { DEFAULT_LOCALE, LOCALE_COOKIE, detectBrowserLocale, normalizeLocale, type Locale } from './locales';

export const I18nContext = createContext<{ locale: Locale; setLocale: (l: Locale) => void } | null>(null);

export function I18nProvider({ initialLocale, children }: { initialLocale?: Locale; children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale ?? DEFAULT_LOCALE);

  // Reconcile the SSR cookie seed with localStorage / browser detect on mount.
  useEffect(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(LOCALE_COOKIE) : null;
    const next: Locale = stored ? normalizeLocale(stored) : (initialLocale ?? detectBrowserLocale());
    setLocaleState(next);
    if (typeof document !== 'undefined') document.documentElement.lang = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try { localStorage.setItem(LOCALE_COOKIE, l); } catch { /* private mode */ }
    document.cookie = `${LOCALE_COOKIE}=${l};path=/;max-age=31536000;samesite=lax`;
    document.documentElement.lang = l;
  }, []);

  return <I18nContext.Provider value={{ locale, setLocale }}>{children}</I18nContext.Provider>;
}
