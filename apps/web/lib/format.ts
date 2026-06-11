/** Signed percent for ROI/growth display. +24.1% · -6.5% · 0% (never a "+-" double sign).
 *  Rounds to one decimal; only strictly-positive values get a leading '+'. */
export function pctSigned(n: number): string {
  const r = Math.round(n * 10) / 10;
  return `${r > 0 ? '+' : ''}${r}%`;
}
