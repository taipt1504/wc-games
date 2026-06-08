'use client';
import { useState, useEffect } from 'react';
import { Icon } from '@/components/ui';
import { useRealtime } from '@/lib/realtime';
import { useT } from '@/lib/i18n/hooks';

interface Notif { id: number; type: string; payload: Record<string, unknown>; readAt: string | null; createdAt: string }

function notifText(n: Notif, t: (k: string, v?: Record<string, string | number>) => string): string {
  const p = (n.payload ?? {}) as Record<string, unknown>;
  if (n.type === 'settle') return p.result === 'WON' ? t('notif.settleWon', { payout: p.payout as number }) : t('notif.settleLost');
  if (n.type === 'duel') {
    const e = p.event;
    return e === 'challenged' ? t('notif.duelChallenged') : e === 'accepted' ? t('notif.duelAccepted')
      : e === 'declined' ? t('notif.duelDeclined') : t('notif.duelResolved');
  }
  if (n.type === 'borrow') return p.event === 'approved' ? t('notif.borrowApproved') : t('notif.borrowDeclined');
  return n.type;
}

export function NotificationBell() {
  const { t, fmt } = useT();
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    fetch('/api/v1/me/notifications/feed').then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) { setItems(j.data.items); setUnread(j.data.unread); } })
      .catch(() => {});
  }, []);

  useRealtime('notification', (ev) => {
    const n = ev.notification as Notif;
    setItems((prev) => [n, ...prev].slice(0, 30));
    setUnread((u) => u + 1);
  });

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) { fetch('/api/v1/me/notifications/read', { method: 'POST' }).catch(() => {}); setUnread(0); }
  };

  return (
    <div className="rel">
      <button className="btn-icon btn-ghost rel" onClick={toggle} aria-label={t('notif.title')}>
        <Icon name="bell" size={18} />
        {unread > 0 && (
          <span className="abs" style={{ top: 2, right: 2, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--magenta)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
          <div className="card" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 'min(300px, calc(100vw - 24px))', maxHeight: 380, overflowY: 'auto', zIndex: 50, padding: 6 }}>
            <div className="eyebrow" style={{ padding: '6px 8px' }}>{t('notif.title')}</div>
            {items.length === 0 && <p className="tiny muted" style={{ padding: 8 }}>{t('notif.empty')}</p>}
            {items.map((n) => (
              <div key={n.id} style={{ padding: '8px', borderTop: '1px solid var(--line)', opacity: n.readAt ? 0.6 : 1 }}>
                <div className="small">{notifText(n, t)}</div>
                <div className="tiny muted">{fmt.date(n.createdAt, { dateStyle: 'medium', timeStyle: 'short' })}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
