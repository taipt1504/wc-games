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
      .then((j) => { if (j?.data) setRows(j.data); })
      .catch(() => { /* fall back to empty display */ });
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
              <div className="display" style={{ fontSize: 32, color: 'var(--gold)' }}>#{s.me.rank ?? '—'}</div>
              <div><div style={{ fontWeight: 700 }}>Your global rank</div><div className="tiny muted">Top 14% · {s.me.settled} settled bets</div></div>
            </div>
            <div className="row gap-20">
              <div className="stat"><span className="s-val tnum text-green">+{s.me.roi}%</span><span className="s-lbl">ROI</span></div>
              <div className="stat"><span className="s-val tnum">{s.me.won}/{s.me.settled}</span><span className="s-lbl">Won</span></div>
              <TierPill tier="Gold" />
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card card-pad-lg" style={{ textAlign: 'center', marginBottom: 18 }}>
          <p className="muted">Leaderboard is empty — check back once bets have settled.</p>
        </div>
      ) : (
        <>
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
        </>
      )}
    </div>
  );
}

/* ===================== PARLAY BUILDER ===================== */

interface ParlayLegDraft { matchId: string; outcome: 'HOME' | 'DRAW' | 'AWAY' }
interface ParlayRecord {
  id: string;
  stake: string;
  status: string;
  payout: string;
  legs: Array<{ id: string; matchId: string; outcome: string; oddsSnapshot: string; result: string | null }>;
}

function ParlayBuilder({ s }: ScreenProps) {
  const [legs, setLegs] = React.useState<ParlayLegDraft[]>([{ matchId: '', outcome: 'HOME' }, { matchId: '', outcome: 'HOME' }]);
  const [stake, setStake] = React.useState('100');
  const [parlays, setParlays] = React.useState<ParlayRecord[]>([]);
  const [submitting, setSubmitting] = React.useState(false);

  function fetchParlays() {
    if (typeof window === 'undefined') return;
    fetch('/api/v1/parlays')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: ParlayRecord[] } | null) => { if (j?.data) setParlays(j.data); })
      .catch(() => { /* silent */ });
  }

  useEffect(() => { if (s.authed) fetchParlays(); }, [s.authed]);

  function addLeg() { setLegs((prev) => [...prev, { matchId: '', outcome: 'HOME' }]); }
  function removeLeg(i: number) { if (legs.length > 2) setLegs((prev) => prev.filter((_, idx) => idx !== i)); }
  function updateLeg(i: number, field: keyof ParlayLegDraft, value: string) {
    setLegs((prev) => prev.map((l, idx) => idx === i ? { ...l, [field]: value } : l));
  }

  async function handleSubmit() {
    const stakeNum = parseInt(stake, 10);
    if (isNaN(stakeNum) || stakeNum <= 0) { s.toastMsg('Invalid stake', 'alert', 'var(--danger)'); return; }
    if (legs.some((l) => !l.matchId || isNaN(parseInt(l.matchId, 10)))) {
      s.toastMsg('Fill all match IDs', 'alert', 'var(--danger)'); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/v1/parlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          stake: stakeNum,
          legs: legs.map((l) => ({ matchId: parseInt(l.matchId, 10), outcome: l.outcome })),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        s.toastMsg('Parlay placed!', 'check', 'var(--green)');
        void s.refreshUser();
        setLegs([{ matchId: '', outcome: 'HOME' }, { matchId: '', outcome: 'HOME' }]);
        setStake('100');
        fetchParlays();
      } else {
        const code = j?.error?.code;
        const msg = code === 'TOO_FEW_LEGS' ? 'Need ≥ 2 legs'
          : code === 'INSUFFICIENT_BALANCE' ? 'Not enough points'
            : code === 'BET_LOCKED' ? 'A match is locked'
              : code === 'ODDS_UNAVAILABLE' ? 'Odds unavailable for a match'
                : code === 'DUPLICATE_MATCH' ? 'Duplicate match in legs'
                  : 'Parlay failed';
        s.toastMsg(msg, 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
    finally { setSubmitting(false); }
  }

  if (!s.authed) return null;

  return (
    <div>
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Parlay / Combo bets</div>

      {/* builder */}
      <div className="card card-pad">
        <div className="row gap-8" style={{ marginBottom: 12 }}>
          <Icon name="target" size={18} style={{ color: 'var(--magenta)' }} />
          <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Build a combo</span>
          <span className="tiny muted ml-4">All legs must win to pay out</span>
        </div>
        <div className="stack gap-8">
          {legs.map((leg, i) => (
            <div key={i} className="row gap-8 wrap-w">
              <input
                className="input"
                style={{ width: 100, flex: 'none' }}
                placeholder="Match ID"
                value={leg.matchId}
                onChange={(e) => updateLeg(i, 'matchId', e.target.value)}
              />
              <select
                className="input"
                style={{ flex: 1 }}
                value={leg.outcome}
                onChange={(e) => updateLeg(i, 'outcome', e.target.value)}
              >
                <option value="HOME">Home win</option>
                <option value="DRAW">Draw</option>
                <option value="AWAY">Away win</option>
              </select>
              {legs.length > 2 && (
                <Btn variant="ghost" size="sm" onClick={() => removeLeg(i)}>×</Btn>
              )}
            </div>
          ))}
          <Btn variant="ghost" size="sm" onClick={addLeg}>+ Add leg</Btn>
          <div className="field">
            <label className="label">Stake (points)</label>
            <input className="input" type="number" min={1} value={stake} onChange={(e) => setStake(e.target.value)} />
          </div>
          <Btn variant="primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? 'Placing…' : 'Place parlay'}
          </Btn>
        </div>
      </div>

      {/* parlay history */}
      {parlays.length > 0 && (
        <div className="stack gap-8 mt-12">
          {parlays.map((p) => {
            const c = p.status === 'WON' ? 'green' : p.status === 'LOST' ? 'danger' : 'sky';
            const profit = Number(p.payout) - Number(p.stake);
            return (
              <div key={p.id} className="card card-pad">
                <div className="row between wrap gap-8">
                  <div>
                    <div className="small" style={{ fontWeight: 700 }}>Parlay #{p.id} · {p.legs.length} legs</div>
                    <div className="tiny muted">Stake {p.stake} pts</div>
                  </div>
                  <div className="row gap-8">
                    <span className={`badge badge-${c}`}>{p.status}</span>
                    {(p.status === 'WON' || p.status === 'LOST') && (
                      <span className="tnum" style={{ fontWeight: 700, color: profit >= 0 ? 'var(--green)' : 'var(--danger)' }}>
                        {profit >= 0 ? '+' : ''}{profit} pts
                      </span>
                    )}
                  </div>
                </div>
                <div className="row gap-6 wrap-w mt-8">
                  {p.legs.map((l) => {
                    const lc = l.result === 'WON' ? 'green' : l.result === 'LOST' ? 'danger' : 'muted';
                    return (
                      <span key={l.id} className={`badge badge-${lc}`} style={{ fontSize: 11 }}>
                        Match {l.matchId} {l.outcome} @{parseFloat(l.oddsSnapshot).toFixed(2)}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
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
        <div className="card card-pad stat"><span className="s-val tnum text-green">+{s.me.roi}%</span><span className="s-lbl">ROI</span></div>
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
      <ParlayBuilder s={s} />
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
        {s.ledger.length === 0 ? (
          <div className="card-pad" style={{ textAlign: 'center' }}><p className="muted">No transactions yet.</p></div>
        ) : s.ledger.map((tx, i, arr) => {
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

/* ===================== COSMETIC SHOP (AIMETA-02) ===================== */

interface ShopItem {
  id: number | string;
  code: string;
  name: string;
  kind: string;
  price: number | string;
  owned: boolean;
  equipped: boolean;
}

const KIND_ICON: Record<string, string> = { avatar: 'star', frame: 'shield', theme: 'target' };

function CosmeticShop({ s }: ScreenProps) {
  const [items, setItems] = React.useState<ShopItem[]>([]);

  function fetchShop() {
    fetch('/api/v1/shop')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setItems(j.data); })
      .catch(() => { /* empty fallback */ });
  }

  useEffect(() => { if (s.authed) fetchShop(); }, [s.authed]);

  async function handleBuy(code: string) {
    const res = await fetch('/api/v1/shop/buy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    if (res.ok) {
      s.refreshUser();
      fetchShop();
    } else {
      const j = await res.json().catch(() => ({}));
      const code2 = j?.error?.code;
      if (code2 === 'INSUFFICIENT_BALANCE') s.toastMsg('Not enough points', 'alert', 'var(--danger)');
      else if (code2 === 'ALREADY_OWNED')   s.toastMsg('Already owned', 'alert', 'var(--danger)');
      else                                  s.toastMsg('Purchase failed', 'alert', 'var(--danger)');
    }
  }

  async function handleEquip(id: number | string) {
    const res = await fetch('/api/v1/shop/equip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemId: String(id) }),
    });
    if (res.ok) fetchShop();
  }

  if (!s.authed) return null;

  return (
    <div>
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Cosmetic shop</div>
      <div className="stack gap-8">
        {items.length === 0 && <div className="card card-pad"><span className="tiny muted">Loading items…</span></div>}
        {items.map((item) => (
          <div key={item.code} className="card card-pad row between wrap gap-12">
            <div className="row gap-10">
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                <Icon name={KIND_ICON[item.kind] ?? 'star'} size={18} style={{ color: 'var(--gold)' }} />
              </div>
              <div>
                <div className="small" style={{ fontWeight: 700 }}>{item.name}</div>
                <div className="tiny muted">{item.kind} · <span className="tnum">{Number(item.price)} pts</span></div>
              </div>
            </div>
            <div className="row gap-8">
              {item.owned
                ? <Btn variant={item.equipped ? 'primary' : 'ghost'} size="sm" onClick={() => handleEquip(item.id)}>{item.equipped ? 'Equipped' : 'Equip'}</Btn>
                : <Btn variant="gold" size="sm" onClick={() => handleBuy(item.code)}>Buy</Btn>}
            </div>
          </div>
        ))}
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

interface DuelDisplay {
  id: string;
  challengerId: string;
  opponentId: string;
  scope: string;
  status: string;
  winnerId: string | null;
  createdAt: string;
  challengerName: string;
  opponentName: string;
}

export function Profile({ s }: ScreenProps) {
  const me = s.me;
  const [referral, setReferral] = React.useState<{ code: string; count: number } | null>(null);
  const [achievements, setAchievements] = React.useState<AchievementDisplay[]>([]);
  const [notifPrefs, setNotifPrefs] = React.useState<NotifPrefs>(defaultNotifPrefs());
  const [currentPw, setCurrentPw] = React.useState('');
  const [newPw, setNewPw] = React.useState('');
  const [pwLoading, setPwLoading] = React.useState(false);
  const [tierNext, setTierNext] = React.useState<string | null>(null);
  const [tierToNext, setTierToNext] = React.useState<number>(0);
  const [duels, setDuels] = React.useState<DuelDisplay[]>([]);
  const [duelOpponentId, setDuelOpponentId] = React.useState('');
  const [duelScope, setDuelScope] = React.useState('GLOBAL');
  const [meId, setMeId] = React.useState<string | null>(null);
  const [powerUpInventory, setPowerUpInventory] = React.useState<Record<string, number>>({});
  const [buyingPowerUp, setBuyingPowerUp] = React.useState<string | null>(null);

  useEffect(() => {
    fetch('/api/v1/me')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) {
          setTierNext(j.data.tierNext ?? null);
          setTierToNext(j.data.tierToNext ?? 0);
          setMeId(String(j.data.id));
        }
      })
      .catch(() => { /* fall back to defaults */ });
  }, []);
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

  function fetchDuels() {
    if (!s.authed) return;
    fetch('/api/v1/duels')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setDuels(j.data); })
      .catch(() => { /* empty fallback */ });
  }

  useEffect(() => { fetchDuels(); }, [s.authed]);

  function fetchPowerUps() {
    if (!s.authed) return;
    fetch('/api/v1/me/powerups')
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { data?: Record<string, number> } | null) => { if (j?.data) setPowerUpInventory(j.data); })
      .catch(() => { /* empty fallback */ });
  }

  useEffect(() => { fetchPowerUps(); }, [s.authed]);

  async function handleBuyPowerUp(type: string) {
    setBuyingPowerUp(type);
    try {
      const res = await fetch('/api/v1/powerups/buy', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        s.toastMsg(`Bought ${type.replace(/_/g, ' ')}!`, 'star', 'var(--gold)');
        void s.refreshUser(); // sync balance
        fetchPowerUps();
      } else {
        s.toastMsg(j?.error?.code === 'INSUFFICIENT_BALANCE' ? 'Not enough points' : 'Purchase failed', 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
    finally { setBuyingPowerUp(null); }
  }

  async function handleChallenge() {
    if (!duelOpponentId) return;
    const res = await fetch('/api/v1/duels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opponentId: duelOpponentId, scope: duelScope }),
    });
    if (res.ok) {
      setDuelOpponentId('');
      fetchDuels();
    } else {
      const j = await res.json().catch(() => ({}));
      s.toastMsg(j?.error?.code === 'SELF_DUEL' ? 'Cannot duel yourself' : 'Challenge failed', 'alert', 'var(--danger)');
    }
  }

  async function handleRespond(duelId: string, accept: boolean) {
    const res = await fetch(`/api/v1/duels/${duelId}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accept }),
    });
    if (res.ok) fetchDuels();
  }

  async function handleResolve(duelId: string) {
    const res = await fetch(`/api/v1/duels/${duelId}/resolve`, { method: 'POST' });
    if (res.ok) fetchDuels();
  }

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
            <Avatar initials={me.avatar} size={64} color="var(--gold)" ring="var(--gold)" />
            <div>
              <div className="row gap-8"><span className="h3">{me.name}</span><TierPill tier={s.tier} />{tierNext && tierToNext > 0 && <span className="tiny muted">{tierToNext.toLocaleString()} to {tierNext}</span>}</div>
              <div className="tiny muted">{me.handle} · joined {me.joined}</div>
              <div className="row gap-8 mt-8">
                <span className="badge badge-gold"><Icon name="fire" size={12} fill="var(--gold)" />{s.streak}-day streak</span>
                {s.winStreak > 0 && (
                  <span className="badge badge-green">🔥 {s.winStreak} win streak</span>
                )}
              </div>
            </div>
          </div>
          <Btn variant="ghost" size="sm" icon="edit">Edit</Btn>
        </div>
      </div>

      {/* stats */}
      <div className="grid gap-12 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))' }}>
        {([['Balance', s.points.toLocaleString(), 'var(--gold)'], ['ROI', '+' + me.roi + '%', 'var(--green)'], ['Rank', '#' + (me.rank ?? '—'), 'var(--sky)'], ['Settled', String(me.settled), 'var(--text)']] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} className="card card-pad stat"><span className="s-val tnum" style={{ color: c, fontSize: 22 }}>{v}</span><span className="s-lbl">{l}</span></div>
        ))}
      </div>

      {/* power-ups (DEPTH-04) */}
      {s.authed && (
        <div className="card card-pad mt-16">
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            <Icon name="sparkles" size={18} style={{ color: 'var(--gold)' }} />
            <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Power-ups</span>
          </div>
          <div className="grid gap-10" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
            {([
              { type: 'DOUBLE_DOWN', label: 'Double Down', desc: 'Won bet pays 2×', price: 300 },
              { type: 'INSURANCE', label: 'Insurance', desc: 'Refund stake on a loss', price: 200 },
              { type: 'STREAK_SHIELD', label: 'Streak Shield', desc: 'One loss won\'t break your win streak', price: 400 },
            ] as { type: string; label: string; desc: string; price: number }[]).map(({ type, label, desc, price }) => (
              <div key={type} className="card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
                <div className="row between">
                  <span className="small" style={{ fontWeight: 700 }}>{label}</span>
                  <span className="badge badge-gold">{powerUpInventory[type] ?? 0} owned</span>
                </div>
                <div className="tiny muted mt-4">{desc}</div>
                <Btn variant="ghost" size="sm" className="mt-8" disabled={buyingPowerUp === type}
                  onClick={() => handleBuyPowerUp(type)}>
                  Buy · {price} pts
                </Btn>
              </div>
            ))}
          </div>
        </div>
      )}

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
          <p className="tiny t2 mt-8">&quot;I&apos;m +{me.roi}% ROI and {me.won} bets up at the World Cup.&quot; Make a share card.</p>
          <div className="row gap-8 mt-12">
            <Btn variant="ghost" size="sm" icon="share" onClick={() => {
              const params = new URLSearchParams({
                name: me.name,
                roi: String(me.roi),
                won: String(me.won),
                settled: String(me.settled),
                rank: String(me.rank ?? ''),
                tier: s.tier,
                streak: String(s.winStreak),
              });
              const url = typeof window !== 'undefined'
                ? `${window.location.origin}/api/og/share?${params}`
                : `/api/og/share?${params}`;
              if (typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => s.toastMsg('Share link copied!', 'check', 'var(--green)')).catch(() => s.toastMsg('Copy failed', 'alert', 'var(--danger)'));
              } else {
                s.toastMsg('Share link copied!', 'check', 'var(--green)');
              }
            }}>Copy link</Btn>
            <Btn variant="primary" size="sm" onClick={() => {
              const params = new URLSearchParams({
                name: me.name,
                roi: String(me.roi),
                won: String(me.won),
                settled: String(me.settled),
                rank: String(me.rank ?? ''),
                tier: s.tier,
                streak: String(s.winStreak),
              });
              if (typeof window !== 'undefined') {
                window.open(`/api/og/share?${params}`, '_blank');
              }
            }}>Preview</Btn>
          </div>
        </div>
      </div>

      {/* achievements */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Achievements</div>
      {achievements.length === 0 && <div className="card card-pad" style={{ textAlign: 'center' }}><p className="muted">No achievements unlocked yet.</p></div>}
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

      {/* duels */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Duels</div>
      {s.authed && (
        <div className="stack gap-10">
          {/* challenge form */}
          <div className="card card-pad">
            <div className="row gap-8" style={{ marginBottom: 12 }}><Icon name="target" size={18} style={{ color: 'var(--magenta)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Challenge someone</span></div>
            <div className="stack gap-8">
              <div className="field"><label className="label">Opponent user ID</label><input className="input" value={duelOpponentId} onChange={(e) => setDuelOpponentId(e.target.value)} placeholder="e.g. 42" /></div>
              <div className="field"><label className="label">Scope</label><input className="input" value={duelScope} onChange={(e) => setDuelScope(e.target.value)} placeholder="GLOBAL" /></div>
              <Btn variant="primary" size="sm" disabled={!duelOpponentId} onClick={handleChallenge}>Send challenge</Btn>
            </div>
          </div>

          {/* duel list */}
          {duels.length === 0 && <div className="card card-pad"><span className="tiny muted">No duels yet.</span></div>}
          {duels.map((d) => {
            const statusColor = d.status === 'ACTIVE' ? 'var(--green)' : d.status === 'DONE' ? 'var(--muted)' : 'var(--gold)';
            const isIncoming = d.status === 'PENDING' && meId && d.opponentId === meId;
            const isParticipant = meId && (d.challengerId === meId || d.opponentId === meId);
            return (
              <div key={d.id} className="card card-pad">
                <div className="row between wrap gap-8">
                  <div>
                    <div className="small" style={{ fontWeight: 700 }}>{d.challengerName} <span className="muted">vs</span> {d.opponentName}</div>
                    <div className="tiny muted">Scope: {d.scope}</div>
                    {d.status === 'DONE' && d.winnerId && <div className="tiny" style={{ color: 'var(--green)' }}>Winner: {d.winnerId === d.challengerId ? d.challengerName : d.opponentName}</div>}
                    {d.status === 'DONE' && !d.winnerId && <div className="tiny muted">Result: tie</div>}
                  </div>
                  <div className="row gap-8">
                    <span className="badge" style={{ background: 'var(--surface-2)', color: statusColor }}>{d.status}</span>
                    {isIncoming && (
                      <>
                        <Btn variant="primary" size="sm" onClick={() => handleRespond(d.id, true)}>Accept</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => handleRespond(d.id, false)}>Decline</Btn>
                      </>
                    )}
                    {d.status === 'ACTIVE' && isParticipant && (
                      <Btn variant="gold" size="sm" onClick={() => handleResolve(d.id)}>Resolve</Btn>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

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

      {/* cosmetic shop */}
      <CosmeticShop s={s} />

      <Btn variant="ghost" className="btn-block mt-24" icon="logout" onClick={() => s.logout()}>Log out</Btn>
      <Btn variant="outline" className="btn-block mt-12" icon="shield" onClick={() => s.go('admin')}>Open admin console</Btn>
    </div>
  );
}
