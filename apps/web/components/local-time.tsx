'use client';
import { useEffect, useState } from 'react';
import { useT } from '@/lib/i18n/hooks';
import { tzOffsetLabel } from '@/lib/format';

/** Render an instant in the CLIENT's timezone. SSR-safe: the visible value is computed after mount
 *  (browser tz); `suppressHydrationWarning` avoids a hydration mismatch flash. `withTz` appends "· GMT+7". */
export function LocalTime({ value, opts, withTz = false }: {
  value: string | number | Date;
  opts?: Intl.DateTimeFormatOptions;
  withTz?: boolean;
}) {
  const { fmt } = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const base = fmt.date(value, opts);
  if (!mounted) return <span suppressHydrationWarning>{base}</span>;
  return <span>{withTz ? `${base} · ${tzOffsetLabel(value)}` : base}</span>;
}
