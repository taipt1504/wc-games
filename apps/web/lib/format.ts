/** Signed percent for ROI/growth display. +24.1% · -6.5% · 0% (never a "+-" double sign).
 *  Rounds to one decimal; only strictly-positive values get a leading '+'. */
export function pctSigned(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : ''}${r}%`;
}

/** "GMT+7" · "GMT-5" · "GMT+5:30" · "GMT+0" from minutes-ahead-of-UTC. Pure. */
export function formatGmtOffset(minsAheadOfUtc: number): string {
  const sign = minsAheadOfUtc < 0 ? '-' : '+';
  const abs = Math.abs(minsAheadOfUtc);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `GMT${sign}${h}${m ? ':' + String(m).padStart(2, '0') : ''}`;
}

/** The client's GMT offset label for a given instant (DST-correct via the runtime tz). */
export function tzOffsetLabel(d: Date | string | number): string {
  return formatGmtOffset(-new Date(d).getTimezoneOffset());
}
