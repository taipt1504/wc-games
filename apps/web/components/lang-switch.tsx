'use client';
import { useT } from '@/lib/i18n/hooks';
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from '@/lib/i18n/locales';

export function LangSwitch() {
  const { locale, setLocale } = useT();
  return (
    <div className="row gap-4" role="group" aria-label="Language">
      {LOCALES.map((l) => (
        <button key={l} className={`chip chip-sm ${locale === l ? 'active' : ''}`} onClick={() => setLocale(l)} aria-pressed={locale === l}>
          <span aria-hidden>{LOCALE_FLAGS[l]}</span><span className="hide-mobile" style={{ marginLeft: 4 }}>{LOCALE_LABELS[l]}</span>
        </button>
      ))}
    </div>
  );
}
