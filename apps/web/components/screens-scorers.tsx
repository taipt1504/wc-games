'use client';
/* Top Scorers (Golden Boot) — real data from /api/v1/scorers */
import React, { useState, useEffect } from 'react';
import type { ScreenProps } from '@/lib/store';
import { useT } from '@/lib/i18n/hooks';

interface ApiScorer {
  rank: number;
  id: number;
  name: string;
  teamId: number | null;
  teamName: string | null;
  goals: number;
  assists: number;
  penalties: number;
}

function useJson<T>(url: string | null): { data: T | null; loading: boolean } {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!url) return;
    let active = true;
    setLoading(true);
    fetch(url)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (active) setData(j?.data ?? null); })
      .catch(() => { /* keep null */ })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [url]);
  return { data, loading };
}

export function Scorers({ s }: ScreenProps) {
  const { t } = useT();
  const { data: scorers, loading } = useJson<ApiScorer[]>('/api/v1/scorers');
  const list = scorers ?? [];

  return (
    <div className="page fade-up">
      <h1 className="h2" style={{ marginBottom: 20 }}>{t('scorers.title')}</h1>
      {loading ? null : list.length === 0 ? (
        <div className="card card-pad" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <p className="muted small" style={{ margin: 0 }}>{t('scorers.empty')}</p>
        </div>
      ) : (
        <div className="scroll-x">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('scorers.colRank')}</th>
                <th>{t('scorers.colPlayer')}</th>
                <th>{t('scorers.colTeam')}</th>
                <th style={{ textAlign: 'center' }}>{t('scorers.colGoals')}</th>
                <th style={{ textAlign: 'center' }}>{t('scorers.colAssists')}</th>
                <th style={{ textAlign: 'center' }}>{t('scorers.colPens')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((sc) => (
                <tr key={sc.id}>
                  <td className="tnum" style={{ color: 'var(--muted)' }}>{sc.rank}</td>
                  <td><span className="small" style={{ fontWeight: 600 }}>{sc.name}</span></td>
                  <td><span className="small">{sc.teamName ?? '—'}</span></td>
                  <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>{sc.goals}</td>
                  <td className="tnum" style={{ textAlign: 'center' }}>{sc.assists}</td>
                  <td className="tnum" style={{ textAlign: 'center' }}>{sc.penalties}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
