'use client';
import { useEffect, useState } from 'react';
import type { ScreenProps } from '@/lib/store';
import { SecHead, Btn } from '@/components/ui';
import { useT } from '@/lib/i18n/hooks';

interface SMkt { key: string; title: string; titleVi: string | null; subtitle: string | null; subtitleVi: string | null; status: string; resolvedOutcome: 'YES'|'NO'|null; oddsYes: number; oddsNo: number; yourBet: { pick: 'YES'|'NO'; stake: number; oddsSnapshot: number; status: string; payout: number } | null }

export function Specials({ s }: ScreenProps) {
  const { t, locale } = useT();
  const lobbyId = typeof s.param.lobbyId === 'number' ? s.param.lobbyId : undefined;
  const [mkts, setMkts] = useState<SMkt[]>([]);
  const [pick, setPick] = useState<Record<string, 'YES'|'NO'>>({});
  const [stake, setStake] = useState<Record<string, number>>({});
  const load = () => { const q = lobbyId != null ? `?lobbyId=${lobbyId}` : ''; fetch(`/api/v1/special-markets${q}`).then(r => r.ok ? r.json() : null).then(j => setMkts(j?.data ?? [])).catch(() => {}); };
  useEffect(load, [lobbyId]);

  const place = async (m: SMkt) => {
    const p = pick[m.key]; const st = stake[m.key];
    if (!p || !st) return;
    const res = await fetch('/api/v1/special-predictions', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ marketKey: m.key, pick: p, stake: st, lobbyId }) });
    if (res.ok) { s.toastMsg(t('special.place'), 'trophy', 'var(--gold)'); load(); }
    else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.code ?? 'ERROR', 'alert', 'var(--red)'); }
  };

  return (
    <div className="page fade-up">
      <SecHead title={t('special.title')} sub={t('special.tagline')} />
      <div className="stack gap-16">
        {mkts.map((m) => {
          const title = locale === 'vi' && m.titleVi ? m.titleVi : m.title;
          const resolved = m.status === 'RESOLVED';
          return (
            <div key={m.key} className="card card-pad">
              <div className="h3" style={{ fontSize: 17 }}>{title}</div>
              {resolved ? (
                <div className="mt-8"><span className="badge badge-gold">{t('special.resolved')}: {m.resolvedOutcome === 'YES' ? t('special.yes') : t('special.no')}</span></div>
              ) : (
                <>
                  <div className="row gap-8 mt-12">
                    {(['YES', 'NO'] as const).map((k) => (
                      <button key={k} className={`odds ${pick[m.key] === k ? 'sel' : ''}`} style={{ flex: 1 }} onClick={() => setPick(s2 => ({ ...s2, [m.key]: k }))}>
                        <span className="o-label">{k === 'YES' ? t('special.yes') : t('special.no')}</span>
                        <span className="o-val">{(k === 'YES' ? m.oddsYes : m.oddsNo).toFixed(2)}</span>
                      </button>
                    ))}
                  </div>
                  <div className="row gap-8 mt-12 wrap-w">
                    {[50, 100, 250, 500].map(v => <button key={v} className="chip" onClick={() => setStake(s2 => ({ ...s2, [m.key]: v }))}>{v}</button>)}
                  </div>
                  <Btn variant="primary" className="mt-12" disabled={!pick[m.key] || !stake[m.key] || !!m.yourBet} onClick={() => place(m)}>{t('special.place')}{stake[m.key] ? ` · ${stake[m.key]}` : ''}</Btn>
                </>
              )}
              {m.yourBet && <div className="tiny muted mt-8">{t('special.yourPick')}: {m.yourBet.pick === 'YES' ? t('special.yes') : t('special.no')} · {m.yourBet.stake} · {t(`special.${m.yourBet.status === 'WON' ? 'won' : m.yourBet.status === 'LOST' ? 'lost' : 'open'}`)}</div>}
            </div>
          );
        })}
        {mkts.length === 0 && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><span className="muted">{t('special.empty')}</span></div>}
      </div>
    </div>
  );
}
