'use client';
/* GOLAZO — Leaderboard · My Bets · Wallet · Profile (ported from design screens-compete.jsx) */
import React, { useState, useEffect } from 'react';
import { WC } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Avatar, SecHead, TierPill, TIER_C } from '@/components/ui';

/* ===================== LOCAL SUB-COMPONENTS ===================== */

function Toggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!on)}
      style={{ width: 44, height: 26, borderRadius: 999, background: on ? 'var(--green)' : 'var(--surface-3)', position: 'relative', transition: '.2s' }}
    >
      <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
    </button>
  );
}

/* ===================== LEADERBOARD ===================== */
export function Leaderboard({ s }: ScreenProps) {
  const [scope, setScope] = useState('global');
  const guest = !s.authed;
  const [rows, setRows] = useState(WC.leaderboard);
  useEffect(() => {
    fetch('/api/v1/leaderboard')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data?.length) setRows(j.data); })
      .catch(() => { /* fall back to seed display */ });
  }, []);
  const scopes: [string, string][] = guest
    ? [['global', 'Global'], ['week', 'This week']]
    : [['global', 'Global'], ['week', 'This week'], ['tier', 'My tier · Gold']];

  return (
    <div className="page fade-up">
      <SecHead title="Leaderboard" sub="Ranked by ROI% on settled bets · minimum 10 settled to qualify" />
      <div className="row gap-8 wrap-w" style={{ marginBottom: 18 }}>
        {scopes.map(([k, l]) => (
          <button key={k} className={`chip ${scope === k ? 'active' : ''}`} onClick={() => setScope(k)}>{l}</button>
        ))}
      </div>

      {guest ? (
        /* guest conversion card */
        <div className="panel card-pad-lg row between wrap gap-16" style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.25)', marginBottom: 18 }}>
          <div className="row gap-14">
            <Icon name="trophy" size={28} style={{ color: 'var(--gold)' }} />
            <div>
              <div className="h3">Where would you rank?</div>
              <div className="small t2 mt-4">Sign up free, get 1,000 points, and start climbing toward the top 1%.</div>
            </div>
          </div>
          <Btn variant="gold" size="lg" onClick={() => s.go('auth', { mode: 'signup' })}>Join the board →</Btn>
        </div>
      ) : (
        /* your rank card */
        <div className="panel card-pad mt-4" style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.25)', marginBottom: 18 }}>
          <div className="row between wrap gap-12">
            <div className="row gap-14">
              <div className="display" style={{ fontSize: 32, color: 'var(--gold)' }}>#{WC.me.rank.toLocaleString()}</div>
              <div><div style={{ fontWeight: 700 }}>Your global rank</div><div className="tiny muted">Top 14% · {WC.me.settled} settled bets</div></div>
            </div>
            <div className="row gap-20">
              <div className="stat"><span className="s-val tnum text-green">+{WC.me.roi}%</span><span className="s-lbl">ROI</span></div>
              <div className="stat"><span className="s-val tnum">{WC.me.won}/{WC.me.settled}</span><span className="s-lbl">Won</span></div>
              <TierPill tier="Gold" />
            </div>
          </div>
        </div>
      )}

      {/* top 3 podium */}
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 18 }}>
        {rows.slice(0, 3).map((p, i) => (
          <div key={p.rank} className="card card-pad" style={{ textAlign: 'center', order: i === 0 ? 2 : i === 1 ? 1 : 3, transform: i === 0 ? 'scale(1.04)' : 'none', borderColor: i === 0 ? 'rgba(255,200,61,.4)' : 'var(--line)' }}>
            <div className="display" style={{ fontSize: 22, color: ['#FFC83D', '#AEB8D0', '#c08457'][i] }}>{['🥇', '🥈', '🥉'][i]}</div>
            <Avatar initials={p.name.slice(0, 2).toUpperCase()} size={48} color={TIER_C[p.tier]} ring={TIER_C[p.tier]} />
            <div className="small" style={{ fontWeight: 700, marginTop: 8 }}>{p.name}</div>
            <div className="tnum text-green" style={{ fontWeight: 700, fontSize: 18 }}>+{p.roi}%</div>
            <div className="tiny muted">+{p.net.toLocaleString()} net</div>
          </div>
        ))}
      </div>

      {/* table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Tier</th>
                <th style={{ textAlign: 'right' }}>ROI</th>
                <th style={{ textAlign: 'right' }} className="hide-mobile">Net</th>
                <th style={{ textAlign: 'right' }} className="hide-mobile">W/Settled</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.rank}>
                  <td className="tnum muted">{p.rank}</td>
                  <td><div className="row gap-10"><Avatar initials={p.name.slice(0, 2).toUpperCase()} size={28} color={TIER_C[p.tier]} /><span style={{ fontWeight: 600 }}>{p.name}</span></div></td>
                  <td><TierPill tier={p.tier} /></td>
                  <td style={{ textAlign: 'right' }} className="tnum text-green">+{p.roi}%</td>
                  <td style={{ textAlign: 'right' }} className="tnum t2 hide-mobile">+{p.net.toLocaleString()}</td>
                  <td style={{ textAlign: 'right' }} className="tnum t2 hide-mobile">{p.won}/{p.settled}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ===================== MY BETS ===================== */
export function MyBets({ s }: ScreenProps) {
  const [f, setF] = useState('all');
  let list = s.bets.slice().reverse();
  if (f === 'open') list = list.filter((b) => b.status === 'OPEN' || b.status === 'LIVE');
  if (f === 'won') list = list.filter((b) => b.status === 'WON');
  if (f === 'lost') list = list.filter((b) => b.status === 'LOST');
  const settled = s.bets.filter((b) => b.status === 'WON' || b.status === 'LOST');
  const won = settled.filter((b) => b.status === 'WON').length;
  const net = settled.reduce((a, b) => a + ((b.payout || 0) - b.stake), 0);

  return (
    <div className="page fade-up">
      <SecHead title="My bets" sub="Every prediction, settled or live" />
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', marginBottom: 18 }}>
        <div className="card card-pad stat"><span className="s-val tnum text-green">+{WC.me.roi}%</span><span className="s-lbl">ROI</span></div>
        <div className="card card-pad stat"><span className="s-val tnum">{Math.round(won / (settled.length || 1) * 100)}%</span><span className="s-lbl">Win rate</span></div>
        <div className="card card-pad stat"><span className="s-val tnum">{settled.length}</span><span className="s-lbl">Settled</span></div>
        <div className="card card-pad stat"><span className="s-val tnum" style={{ color: net >= 0 ? 'var(--green)' : 'var(--danger)' }}>{net >= 0 ? '+' : ''}{net}</span><span className="s-lbl">Net points</span></div>
      </div>

      <div className="row gap-8 wrap-w" style={{ marginBottom: 16 }}>
        {([['all', 'All'], ['open', 'Open & live'], ['won', 'Won'], ['lost', 'Lost']] as [string, string][]).map(([k, l]) => (
          <button key={k} className={`chip ${f === k ? 'active' : ''}`} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>

      <div className="stack gap-10">
        {list.map((b, i) => {
          const m = WC.matchById(b.mid);
          if (!m) return null;
          const home = WC.byId(m.home), away = WC.byId(m.away);
          const c = b.status === 'WON' ? 'green' : b.status === 'LOST' ? 'danger' : b.status === 'LIVE' ? 'magenta' : 'sky';
          const profit = (b.payout || 0) - b.stake;
          return (
            <div key={i} className="card card-pad card-hover pointer" onClick={() => s.go('match', { id: m.id })}>
              <div className="row between">
                <div className="row gap-10" style={{ minWidth: 0 }}>
                  <Flag team={home} size={24} /><span className="small ellip">{home.code} v {away.code}</span>
                  <span className="badge badge-muted">{b.pick}</span>
                </div>
                <span className={`badge badge-${c}`}>{b.status === 'LIVE' ? <><span className="live-dot"></span>LIVE</> : b.status}</span>
              </div>
              <div className="row between mt-12">
                <span className="tiny muted">Stake <span className="tnum">{b.stake}</span> @ <span className="tnum">{b.odds.toFixed(2)}</span></span>
                {(b.status === 'WON' || b.status === 'LOST')
                  ? <span className="tnum" style={{ fontWeight: 700, color: profit >= 0 ? 'var(--green)' : 'var(--danger)' }}>{profit >= 0 ? '+' : ''}{profit} pts</span>
                  : <span className="tiny t2">Potential <span className="tnum text-green">+{Math.round(b.stake * b.odds)}</span></span>}
              </div>
            </div>
          );
        })}
        {!list.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No bets here yet.</p></div>}
      </div>
    </div>
  );
}

/* ===================== WALLET ===================== */
export function Wallet({ s }: ScreenProps) {
  const ICON: Record<string, [string, string]> = {
    SIGNUP: ['star', 'var(--gold)'],
    CHECKIN: ['fire', 'var(--gold)'],
    BET: ['ball', 'var(--text-2)'],
    SETTLE: ['trophy', 'var(--green)'],
    REFERRAL: ['users', 'var(--sky)'],
    MISSION: ['target', 'var(--purple)'],
  };

  return (
    <div className="page page-narrow fade-up">
      <SecHead title="Point wallet" sub="Every point change, fully traceable" />
      {/* balance hero */}
      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(150deg, var(--gold-soft), var(--surface))', borderColor: 'rgba(255,200,61,.25)' }}>
        <div className="row between">
          <div>
            <div className="eyebrow">Available balance</div>
            <div className="display tnum" style={{ fontSize: 48, color: 'var(--gold)', marginTop: 6 }}>{s.points.toLocaleString()}</div>
          </div>
          <Icon name="wallet" size={40} style={{ color: 'var(--gold)', opacity: .5 }} />
        </div>
        <div className="row gap-12 mt-16">
          <Btn variant="ghost" size="sm" icon="ball" onClick={() => s.go('schedule')}>Place a bet</Btn>
          <Btn variant="ghost" size="sm" icon="users" onClick={() => s.go('profile')}>Refer a friend</Btn>
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Transaction history</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {(s.ledger && s.ledger.length ? s.ledger : WC.ledger).map((tx, i, arr) => {
          const [icon, color] = ICON[tx.type] || ['dollar', 'var(--text-2)'];
          return (
            <div key={i} className="row between" style={{ padding: '14px 18px', borderBottom: i < arr.length - 1 ? '1px solid var(--line)' : 0 }}>
              <div className="row gap-12" style={{ minWidth: 0 }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <Icon name={icon} size={17} style={{ color }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="small ellip" style={{ fontWeight: 600 }}>{tx.label}</div>
                  <div className="tiny muted">{tx.when}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="tnum" style={{ fontWeight: 700, color: tx.delta > 0 ? 'var(--green)' : tx.delta < 0 ? 'var(--danger)' : 'var(--muted)' }}>{tx.delta > 0 ? '+' : ''}{tx.delta || '0'}</div>
                <div className="tiny muted tnum">bal {tx.bal.toLocaleString()}</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== PROFILE ===================== */
type AchievementDisplay = { name: string; desc: string; icon: string; unlocked: boolean; prog?: string };

// Notification rows: [label, api-type-key, default]
const NOTIF_ROWS: [string, string, boolean][] = [
  ['Bet lock reminders', 'betLock', true],
  ['Bet results', 'results', true],
  ['Streak at risk', 'streakAtRisk', true],
  ['Lobby & borrow alerts', 'lobbyAlerts', false],
  ['Hot news', 'news', false],
];

type NotifPrefs = Record<string, boolean>;

function defaultNotifPrefs(): NotifPrefs {
  return Object.fromEntries(NOTIF_ROWS.map(([, k, d]) => [k, d]));
}

export function Profile({ s }: ScreenProps) {
  const me = WC.me;
  const [referral, setReferral] = React.useState<{ code: string; count: number } | null>(null);
  const [achievements, setAchievements] = React.useState<AchievementDisplay[]>(WC.achievements);
  const [notifPrefs, setNotifPrefs] = React.useState<NotifPrefs>(defaultNotifPrefs());
  const [currentPw, setCurrentPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [pwLoading, setPwLoading] = React.useState(false);

  useEffect(() => {
    fetch('/api/v1/me/referral')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setReferral(j.data); })
      .catch(() => { /* fall back to mock */ });
  }, []);
  useEffect(() => {
    fetch('/api/v1/me/achievements')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (!j?.data) return;
        setAchievements(
          (j.data as { code: string; name: string; desc: string; icon: string; unlocked: boolean; progress: number; target: number }[]).map((a) => ({
            name: a.name,
            desc: a.desc,
            icon: a.icon,
            unlocked: a.unlocked,
            prog: !a.unlocked ? `${a.progress}/${a.target}` : undefined,
          })),
        );
      })
      .catch(() => { /* fall back to mock */ });
  }, []);
  useEffect(() => {
    fetch('/api/v1/me/notifications')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setNotifPrefs(j.data); })
      .catch(() => { /* fall back to defaults */ });
  }, []);

  async function handleChangePassword() {
    setPwLoading(true);
    try {
      const res = await fetch('/api/v1/me/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json?.error?.code;
        if (code === 'INVALID_CREDENTIALS') s.toastMsg('Current password is incorrect', 'alert', 'var(--danger)');
        else if (code === 'WEAK_PASSWORD') s.toastMsg('New password must be at least 8 characters', 'alert', 'var(--danger)');
        else s.toastMsg('Failed to change password', 'alert', 'var(--danger)');
      } else {
        s.toastMsg('Password changed successfully', 'check', 'var(--green)');
        setCurrentPw('');
        setNewPw('');
      }
    } catch {
      s.toastMsg('Network error', 'alert', 'var(--danger)');
    } finally {
      setPwLoading(false);
    }
  }

  function handleNotifToggle(key: string, value: boolean) {
    // Optimistic update
    setNotifPrefs((prev) => ({ ...prev, [key]: value }));
    fetch('/api/v1/me/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [key]: value }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setNotifPrefs(j.data); })
      .catch(() => { /* optimistic value stays */ });
  }

  return (
    <div className="page page-narrow fade-up">
      {/* header */}
      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between wrap gap-16">
          <div className="row gap-16">
            <Avatar initials="AR" size={64} color="var(--gold)" ring="var(--gold)" />
            <div>
              <div className="row gap-8"><span className="h3">{me.name}</span><TierPill tier="Gold" /></div>
              <div className="tiny muted">{me.handle} · joined {me.joined}</div>
              <div className="row gap-8 mt-8">
                <span className="badge badge-gold"><Icon name="fire" size={12} fill="var(--gold)" />{me.streak}-day streak</span>
                <span className="badge badge-green">🔥 {me.winStreak} win streak</span>
              </div>
            </div>
          </div>
          <Btn variant="ghost" size="sm" icon="edit">Edit</Btn>
        </div>
      </div>

      {/* stats */}
      <div className="grid gap-12 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))' }}>
        {([['Balance', s.points.toLocaleString(), 'var(--gold)'], ['ROI', '+' + me.roi + '%', 'var(--green)'], ['Rank', '#' + me.rank, 'var(--sky)'], ['Settled', String(me.settled), 'var(--text)']] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} className="card card-pad stat"><span className="s-val tnum" style={{ color: c, fontSize: 22 }}>{v}</span><span className="s-lbl">{l}</span></div>
        ))}
      </div>

      {/* referral / share */}
      <div className="grid gap-12 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))' }}>
        <div className="card card-pad">
          <div className="row gap-8"><Icon name="users" size={18} style={{ color: 'var(--sky)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Refer &amp; earn</span></div>
          <p className="tiny t2 mt-8">Invite a friend — you both get +300 points. {referral ? `${referral.count} friend${referral.count !== 1 ? 's' : ''} referred so far.` : 'You both get +300 points when they place their first bet.'}</p>
          <div className="row gap-8 mt-12 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="tnum small grow ellip">{referral && typeof window !== 'undefined' ? `${window.location.origin}/?ref=${referral.code}` : 'golazo.gg/r/alexr'}</span>
            <Btn variant="primary" size="sm" onClick={() => s.toastMsg('Invite link copied!', 'check')}>Copy</Btn>
          </div>
        </div>
        <div className="card card-pad" style={{ background: 'linear-gradient(120deg,var(--green-soft),transparent)' }}>
          <div className="row gap-8"><Icon name="share" size={18} style={{ color: 'var(--green)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Share your form</span></div>
          <p className="tiny t2 mt-8">&quot;I&apos;m +18.4% ROI and {me.won} bets up at the World Cup.&quot; Make a share card.</p>
          <Btn variant="ghost" size="sm" className="mt-12" icon="share" onClick={() => s.toastMsg('Share card generated!', 'share', 'var(--green)')}>Generate card</Btn>
        </div>
      </div>

      {/* achievements */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Achievements</div>
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        {achievements.map((a) => (
          <div key={a.name} className="card card-pad" style={{ opacity: a.unlocked ? 1 : .55, borderColor: a.unlocked ? 'rgba(255,200,61,.25)' : 'var(--line)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: a.unlocked ? 'var(--gold-soft)' : 'var(--surface-2)', display: 'grid', placeItems: 'center' }}>
              <Icon name={a.icon} size={20} style={{ color: a.unlocked ? 'var(--gold)' : 'var(--muted)' }} />
            </div>
            <div className="small mt-12" style={{ fontWeight: 700 }}>{a.name}</div>
            <div className="tiny muted">{a.desc}</div>
            {!a.unlocked && a.prog && <div className="tiny mt-4" style={{ color: 'var(--gold)' }}>{a.prog}</div>}
          </div>
        ))}
      </div>

      {/* notifications */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Notifications</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {NOTIF_ROWS.map(([label, key], i) => (
          <div key={key} className="row between" style={{ padding: '14px 18px', borderBottom: i < NOTIF_ROWS.length - 1 ? '1px solid var(--line)' : 0 }}>
            <span className="small">{label}</span>
            <Toggle on={notifPrefs[key] ?? false} onChange={(v) => handleNotifToggle(key, v)} />
          </div>
        ))}
      </div>

      {/* change password */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Security</div>
      <div className="card card-pad">
        <div className="row gap-8" style={{ marginBottom: 16 }}><Icon name="shield" size={18} style={{ color: 'var(--sky)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Change password</span></div>
        <div className="stack gap-12">
          <div className="field"><label className="label">Current password</label><input className="input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder="Enter current password" /></div>
          <div className="field"><label className="label">New password</label><input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="At least 8 characters" /></div>
          <Btn variant="primary" size="sm" disabled={pwLoading || !currentPw || !newPw} onClick={handleChangePassword}>{pwLoading ? 'Saving…' : 'Update password'}</Btn>
        </div>
      </div>

      <Btn variant="ghost" className="btn-block mt-24" icon="logout" onClick={() => s.logout()}>Log out</Btn>
      <Btn variant="outline" className="btn-block mt-12" icon="shield" onClick={() => s.go('admin')}>Open admin console</Btn>
    </div>
  );
}
