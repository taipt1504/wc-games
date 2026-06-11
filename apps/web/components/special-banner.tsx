'use client';
import { useEffect, useState } from 'react';
import type { Store } from '@/lib/store';
import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n/hooks';

interface Mkt { key: string; title: string; titleVi: string | null; status: string; oddsYes: number; oddsNo: number }

export function SpecialBanner({ s, lobbyId }: { s: Store; lobbyId?: number }) {
  const { t, locale } = useT();
  const [mkt, setMkt] = useState<Mkt | null>(null);
  useEffect(() => {
    const q = lobbyId != null ? `?lobbyId=${lobbyId}` : '';
    fetch(`/api/v1/special-markets${q}`).then(r => r.ok ? r.json() : null)
      .then(j => { const list = (j?.data ?? []) as Mkt[]; setMkt(list.find(m => m.status === 'OPEN') ?? list[0] ?? null); })
      .catch(() => {});
  }, [lobbyId]);
  if (!mkt) return null;
  const title = locale === 'vi' && mkt.titleVi ? mkt.titleVi : mkt.title;
  return (
    <div className="card card-pad pointer card-hover" onClick={() => s.go('special', lobbyId != null ? { lobbyId } : {})}
         style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.3)' }}>
      <div className="row between wrap wrap-w gap-12">
        <div className="row gap-12">
          <Icon name="trophy" size={28} style={{ color: 'var(--gold)' }} />
          <div>
            <span className="badge badge-gold">{t('special.tagline')}</span>
            <div className="h3" style={{ marginTop: 6, fontSize: 16 }}>{title}</div>
          </div>
        </div>
        <div className="row gap-8 wrap-w">
          <span className="badge badge-sky">{t('special.yes')} {mkt.oddsYes.toFixed(2)}</span>
          <span className="badge badge-muted">{t('special.no')} {mkt.oddsNo.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
