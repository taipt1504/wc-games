'use client';
/* World Cup Games — Leaderboard · My Bets · Wallet · Profile (ported from design screens-compete.jsx) */
import React, { useState, useEffect } from 'react';
import { WC } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Avatar, SecHead, TierPill, TIER_C, Portal } from '@/components/ui';
import { useT } from '@/lib/i18n/hooks';

/* Signed formatters — show a real minus for negatives (never "+-6.3%") + sign-aware colour. */
const sgnPct = (n: number) => `${n >= 0 ? '+' : ''}${n}%`;
const sgnNum = (n: number) => `${n >= 0 ? '+' : ''}${n.toLocaleString()}`;
const sgnCol = (n: number) => (n >= 0 ? 'var(--green)' : 'var(--danger)');

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
  const { t } = useT();
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
    ? [['global', t('leaderboard.scopeGlobal')], ['week', t('leaderboard.scopeWeek')]]
    : [['global', t('leaderboard.scopeGlobal')], ['week', t('leaderboard.scopeWeek')], ['tier', t('leaderboard.scopeTier')]];

  return (
    <div className="page fade-up">
      <SecHead title={t('leaderboard.title')} sub={t('leaderboard.sub')} />
      <div className="row gap-8 wrap-w" style={{ marginBottom: 18 }}>
        {scopes.map(([k, l]) => (
          <button key={k} className={`chip ${scope === k ? 'active' : ''}`} onClick={() => setScope(k)}>{l}</button>
        ))}
      </div>

      {guest ? (
        /* guest conversion card */
        <div className="panel card-pad-lg row between wrap wrap-w gap-16" style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.25)', marginBottom: 18 }}>
          <div className="row gap-14">
            <Icon name="trophy" size={28} style={{ color: 'var(--gold)' }} />
            <div>
              <div className="h3">{t('leaderboard.guestTitle')}</div>
              <div className="small t2 mt-4">{t('leaderboard.guestDesc')}</div>
            </div>
          </div>
          <Btn variant="gold" size="lg" onClick={() => s.go('auth', { mode: 'signup' })}>{t('leaderboard.guestCta')}</Btn>
        </div>
      ) : (
        /* your rank card */
        <div className="panel card-pad mt-4" style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.25)', marginBottom: 18 }}>
          <div className="row between wrap wrap-w gap-12">
            <div className="row gap-14">
              <div className="display" style={{ fontSize: 32, color: 'var(--gold)' }}>#{s.me.rank ?? '—'}</div>
              <div><div style={{ fontWeight: 700 }}>{t('leaderboard.yourRank')}</div><div className="tiny muted">{t('leaderboard.topPct', { n: s.me.settled })}</div></div>
            </div>
            <div className="row gap-20">
              <div className="stat"><span className="s-val tnum" style={{ color: sgnCol(s.me.roi) }}>{sgnPct(s.me.roi)}</span><span className="s-lbl">{t('leaderboard.roi')}</span></div>
              <div className="stat"><span className="s-val tnum">{s.me.won}/{s.me.settled}</span><span className="s-lbl">{t('leaderboard.won')}</span></div>
              <TierPill tier={s.tier || 'Bronze'} />
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card card-pad-lg" style={{ textAlign: 'center', marginBottom: 18 }}>
          <p className="muted">{t('leaderboard.empty')}</p>
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
                <div className="tnum" style={{ fontWeight: 700, fontSize: 18, color: sgnCol(p.roi) }}>{sgnPct(p.roi)}</div>
                <div className="tiny muted">{sgnNum(p.net)} {t('leaderboard.net')}</div>
              </div>
            ))}
          </div>

          {/* table */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div className="scroll-x">
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>{t('leaderboard.colPlayer')}</th>
                    <th>{t('leaderboard.colTier')}</th>
                    <th style={{ textAlign: 'right' }}>{t('leaderboard.roi')}</th>
                    <th style={{ textAlign: 'right' }} className="hide-mobile">{t('leaderboard.colNet')}</th>
                    <th style={{ textAlign: 'right' }} className="hide-mobile">{t('leaderboard.colWonSettled')}</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.rank}>
                      <td className="tnum muted">{p.rank}</td>
                      <td><div className="row gap-10"><Avatar initials={p.name.slice(0, 2).toUpperCase()} size={28} color={TIER_C[p.tier]} /><span style={{ fontWeight: 600 }}>{p.name}</span></div></td>
                      <td><TierPill tier={p.tier} /></td>
                      <td style={{ textAlign: 'right', color: sgnCol(p.roi) }} className="tnum">{sgnPct(p.roi)}</td>
                      <td style={{ textAlign: 'right' }} className="tnum t2 hide-mobile">{sgnNum(p.net)}</td>
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
  const { t } = useT();
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
    if (isNaN(stakeNum) || stakeNum <= 0) { s.toastMsg(t('bets.invalidStake'), 'alert', 'var(--danger)'); return; }
    if (legs.some((l) => !l.matchId || isNaN(parseInt(l.matchId, 10)))) {
      s.toastMsg(t('bets.fillIds'), 'alert', 'var(--danger)'); return;
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
        s.toastMsg(t('bets.parlayPlaced'), 'check', 'var(--green)');
        void s.refreshUser();
        setLegs([{ matchId: '', outcome: 'HOME' }, { matchId: '', outcome: 'HOME' }]);
        setStake('100');
        fetchParlays();
      } else {
        const code = j?.error?.code;
        const msg = code === 'TOO_FEW_LEGS' ? t('bets.errFewLegs')
          : code === 'INSUFFICIENT_BALANCE' ? t('bets.errBalance')
            : code === 'BET_LOCKED' ? t('bets.errLocked')
              : code === 'ODDS_UNAVAILABLE' ? t('bets.errOdds')
                : code === 'DUPLICATE_MATCH' ? t('bets.errDup')
                  : t('bets.errGeneric');
        s.toastMsg(msg, 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg(t('bets.network'), 'alert', 'var(--danger)'); }
    finally { setSubmitting(false); }
  }

  if (!s.authed) return null;

  return (
    <div>
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>{t('bets.parlayHeader')}</div>

      {/* builder */}
      <div className="card card-pad">
        <div className="row gap-8" style={{ marginBottom: 12 }}>
          <Icon name="target" size={18} style={{ color: 'var(--magenta)' }} />
          <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{t('bets.buildCombo')}</span>
          <span className="tiny muted ml-4">{t('bets.allMustWin')}</span>
        </div>
        <div className="stack gap-8">
          {legs.map((leg, i) => (
            <div key={i} className="row gap-8 wrap-w">
              <input
                className="input"
                style={{ width: 100, flex: 'none' }}
                placeholder={t('bets.matchIdPh')}
                value={leg.matchId}
                onChange={(e) => updateLeg(i, 'matchId', e.target.value)}
              />
              <select
                className="input"
                style={{ flex: 1 }}
                value={leg.outcome}
                onChange={(e) => updateLeg(i, 'outcome', e.target.value)}
              >
                <option value="HOME">{t('bets.homeWin')}</option>
                <option value="DRAW">{t('bets.draw')}</option>
                <option value="AWAY">{t('bets.awayWin')}</option>
              </select>
              {legs.length > 2 && (
                <Btn variant="ghost" size="sm" onClick={() => removeLeg(i)}>×</Btn>
              )}
            </div>
          ))}
          <Btn variant="ghost" size="sm" onClick={addLeg}>{t('bets.addLeg')}</Btn>
          <div className="field">
            <label className="label">{t('bets.stakePoints')}</label>
            <input className="input" type="number" min={1} value={stake} onChange={(e) => setStake(e.target.value)} />
          </div>
          <Btn variant="primary" disabled={submitting} onClick={handleSubmit}>
            {submitting ? t('bets.placing') : t('bets.placeParlay')}
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
                <div className="row between wrap wrap-w gap-8">
                  <div>
                    <div className="small" style={{ fontWeight: 700 }}>{t('bets.parlayN', { id: p.id, n: p.legs.length })}</div>
                    <div className="tiny muted">{t('bets.stakeN', { stake: p.stake })}</div>
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
                        {t('bets.matchLeg', { id: l.matchId, outcome: l.outcome, odds: parseFloat(l.oddsSnapshot).toFixed(2) })}
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
interface BetMatchLite { name: string; code: string | null; flagUrl: string | null }
export function MyBets({ s }: ScreenProps) {
  const { t } = useT();
  const [f, setF] = useState('all');
  const [mmap, setMmap] = useState<Map<number, { home: BetMatchLite | null; away: BetMatchLite | null }>>(new Map());
  useEffect(() => {
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => setMmap(new Map(((j?.data ?? []) as { id: number; home: BetMatchLite | null; away: BetMatchLite | null }[]).map(m => [m.id, { home: m.home, away: m.away }]))))
      .catch(() => {});
  }, []);
  let list = s.bets.slice().reverse();
  if (f === 'open') list = list.filter((b) => b.status === 'OPEN' || b.status === 'LIVE');
  if (f === 'won') list = list.filter((b) => b.status === 'WON');
  if (f === 'lost') list = list.filter((b) => b.status === 'LOST');
  const settled = s.bets.filter((b) => b.status === 'WON' || b.status === 'LOST');
  const won = settled.filter((b) => b.status === 'WON').length;
  const net = settled.reduce((a, b) => a + ((b.payout || 0) - b.stake), 0);

  return (
    <div className="page fade-up">
      <SecHead title={t('bets.title')} sub={t('bets.sub')} />
      <div className="grid-auto" style={{ '--col-min': '140px', '--gap': '12px', marginBottom: 18 } as React.CSSProperties}>
        <div className="card card-pad stat"><span className="s-val tnum" style={{ color: sgnCol(s.me.roi) }}>{sgnPct(s.me.roi)}</span><span className="s-lbl">{t('bets.roi')}</span></div>
        <div className="card card-pad stat"><span className="s-val tnum">{Math.round(won / (settled.length || 1) * 100)}%</span><span className="s-lbl">{t('bets.winRate')}</span></div>
        <div className="card card-pad stat"><span className="s-val tnum">{settled.length}</span><span className="s-lbl">{t('bets.settled')}</span></div>
        <div className="card card-pad stat"><span className="s-val tnum" style={{ color: net >= 0 ? 'var(--green)' : 'var(--danger)' }}>{net >= 0 ? '+' : ''}{net}</span><span className="s-lbl">{t('bets.netPoints')}</span></div>
      </div>

      <div className="row gap-8 wrap-w" style={{ marginBottom: 16 }}>
        {([['all', t('bets.fAll')], ['open', t('bets.fOpen')], ['won', t('bets.fWon')], ['lost', t('bets.fLost')]] as [string, string][]).map(([k, l]) => (
          <button key={k} className={`chip ${f === k ? 'active' : ''}`} onClick={() => setF(k)}>{l}</button>
        ))}
      </div>

      <div className="stack gap-10">
        {list.map((b, i) => {
          const mm = mmap.get(b.mid);
          const c = b.status === 'WON' ? 'green' : b.status === 'LOST' ? 'danger' : b.status === 'LIVE' ? 'magenta' : 'sky';
          const profit = (b.payout || 0) - b.stake;
          return (
            <div key={i} className="card card-pad card-hover pointer" onClick={() => s.go('match', { id: b.mid })}>
              <div className="row between">
                <div className="row gap-10" style={{ minWidth: 0 }}>
                  {mm?.home && <Flag flagUrl={mm.home.flagUrl ?? undefined} name={mm.home.name} code={mm.home.code ?? undefined} size={24} />}
                  <span className="small ellip">{mm?.home?.code ?? '?'} v {mm?.away?.code ?? '?'}</span>
                  <span className="badge badge-muted">{b.pick}</span>
                </div>
                <span className={`badge badge-${c}`}>{b.status === 'LIVE' ? <><span className="live-dot"></span>{t('bets.live')}</> : b.status}</span>
              </div>
              <div className="row between mt-12">
                <span className="tiny muted">{t('bets.stake')} <span className="tnum">{b.stake}</span> @ <span className="tnum">{b.odds.toFixed(2)}</span></span>
                {(b.status === 'WON' || b.status === 'LOST')
                  ? <span className="tnum" style={{ fontWeight: 700, color: profit >= 0 ? 'var(--green)' : 'var(--danger)' }}>{profit >= 0 ? '+' : ''}{profit} pts</span>
                  : <span className="tiny t2">{t('bets.potential')} <span className="tnum text-green">+{Math.round(b.stake * b.odds)}</span></span>}
              </div>
            </div>
          );
        })}
        {!list.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">{t('bets.empty')}</p></div>}
      </div>
      <ParlayBuilder s={s} />
    </div>
  );
}

/* ===================== WALLET ===================== */
export function Wallet({ s }: ScreenProps) {
  const { t } = useT();
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
      <SecHead title={t('wallet.title')} sub={t('wallet.sub')} />
      {/* balance hero */}
      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(150deg, var(--gold-soft), var(--surface))', borderColor: 'rgba(255,200,61,.25)' }}>
        <div className="row between">
          <div>
            <div className="eyebrow">{t('wallet.avail')}</div>
            <div className="display tnum" style={{ fontSize: 48, color: 'var(--gold)', marginTop: 6 }}>{s.points.toLocaleString()}</div>
          </div>
          <Icon name="wallet" size={40} style={{ color: 'var(--gold)', opacity: .5 }} />
        </div>
        <div className="row gap-12 mt-16">
          <Btn variant="ghost" size="sm" icon="ball" onClick={() => s.go('schedule')}>{t('wallet.placeBet')}</Btn>
          <Btn variant="ghost" size="sm" icon="users" onClick={() => s.go('profile')}>{t('wallet.refer')}</Btn>
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>{t('wallet.txHistory')}</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {s.ledger.length === 0 ? (
          <div className="card-pad" style={{ textAlign: 'center' }}><p className="muted">{t('wallet.noTx')}</p></div>
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

const SHOP_ACCENTS = ['var(--gold)', 'var(--sky)', 'var(--green)', 'var(--magenta)', 'var(--purple)'];
function accentFor(code: string): string {
  let h = 0;
  for (let i = 0; i < code.length; i++) h = (h + code.charCodeAt(i)) % 997;
  return SHOP_ACCENTS[h % SHOP_ACCENTS.length];
}
function initialsOf(name: string): string {
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('') || '?';
}
// [kind, i18n label key]
const SHOP_SECTIONS: [string, string][] = [['avatar', 'shop.secAvatars'], ['frame', 'shop.secFrames'], ['theme', 'shop.secThemes']];

function ShopPreview({ kind, code, name }: { kind: string; code: string; name: string }) {
  const accent = accentFor(code);
  if (kind === 'theme') return <div style={{ width: 52, height: 52, borderRadius: 12, background: `linear-gradient(135deg, ${accent}, var(--bg-2))`, border: '1px solid var(--line-strong)' }} />;
  if (kind === 'frame') return <Avatar initials={initialsOf(name)} color="var(--surface-2)" ring={accent} size={52} />;
  return <Avatar initials={initialsOf(name)} color={accent} size={52} />;
}

export function CosmeticShop({ s }: ScreenProps) {
  const { t } = useT();
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
      if (code2 === 'INSUFFICIENT_BALANCE') s.toastMsg(t('shop.notEnough'), 'alert', 'var(--danger)');
      else if (code2 === 'ALREADY_OWNED')   s.toastMsg(t('shop.alreadyOwned'), 'alert', 'var(--danger)');
      else                                  s.toastMsg(t('shop.purchaseFailed'), 'alert', 'var(--danger)');
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

  const sections: [string, ShopItem[]][] = [];
  for (const [k, labelKey] of SHOP_SECTIONS) {
    const list = items.filter((i) => i.kind === k);
    if (list.length) sections.push([t(labelKey), list]);
  }
  const other = items.filter((i) => !['avatar', 'frame', 'theme'].includes(i.kind));
  if (other.length) sections.push([t('shop.secMore'), other]);

  return (
    <div>
      <div className="row between mt-24" style={{ marginBottom: 12 }}>
        <span className="eyebrow">{t('shop.title')}</span>
        <span className="badge badge-gold tnum">◇ {t('shop.pts', { n: s.points.toLocaleString() })}</span>
      </div>
      {items.length === 0 && <div className="card card-pad"><span className="tiny muted">{t('shop.loading')}</span></div>}
      <div className="stack gap-18">
        {sections.map(([label, list]) => (
          <div key={label}>
            <div className="tiny muted" style={{ fontWeight: 700, letterSpacing: '.06em', marginBottom: 8 }}>{label.toUpperCase()}</div>
            <div className="grid-fill" style={{ '--col-min': '150px', '--gap': '12px' } as React.CSSProperties}>
              {list.map((item) => {
                const price = Number(item.price);
                const afford = s.points >= price;
                return (
                  <div key={item.code} className="card card-pad stack center gap-8" style={{ textAlign: 'center', borderColor: item.equipped ? 'rgba(43,224,138,.4)' : 'var(--line)' }}>
                    <ShopPreview kind={item.kind} code={item.code} name={item.name} />
                    <div className="small" style={{ fontWeight: 700 }}>{item.name}</div>
                    <span className="badge badge-gold tnum">★ {t('shop.pts', { n: price })}</span>
                    {item.owned
                      ? <Btn variant={item.equipped ? 'primary' : 'ghost'} size="sm" className="btn-block" disabled={item.equipped} onClick={() => handleEquip(item.id)}>{item.equipped ? t('shop.equipped') : t('shop.equip')}</Btn>
                      : (
                        <>
                          <Btn variant="gold" size="sm" className="btn-block" disabled={!afford} onClick={() => handleBuy(item.code)}>{t('shop.buy')}</Btn>
                          {!afford && <span className="tiny muted">{t('shop.needMore', { n: (price - s.points).toLocaleString() })}</span>}
                        </>
                      )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== PROFILE ===================== */
type AchievementDisplay = { name: string; desc: string; icon: string; unlocked: boolean; prog?: string };

// Notification rows: [i18n label key, api-type-key, default]
const NOTIF_ROWS: [string, string, boolean][] = [
  ['profile.nrBetLock', 'betLock', true],
  ['profile.nrResults', 'results', true],
  ['profile.nrStreak', 'streakAtRisk', true],
  ['profile.nrLobby', 'lobbyAlerts', false],
  ['profile.nrNews', 'news', false],
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
  const { t } = useT();
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
  const [editing, setEditing] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [savingName, setSavingName] = React.useState(false);

  const saveName = async () => {
    const username = editName.trim();
    if (!username || savingName) return;
    setSavingName(true);
    try {
      const res = await fetch('/api/v1/me', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username }) });
      setSavingName(false);
      if (res.ok) { s.toastMsg(t('profile.updated'), 'check', 'var(--green)'); setEditing(false); s.refreshUser(); }
      else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.code === 'USERNAME_TAKEN' ? t('profile.nameTaken') : t('profile.updateFailed'), 'alert', 'var(--danger)'); }
    } catch { setSavingName(false); s.toastMsg(t('profile.network'), 'alert', 'var(--danger)'); }
  };

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
        s.toastMsg(t('profile.puBought', { name: type.replace(/_/g, ' ') }), 'star', 'var(--gold)');
        void s.refreshUser(); // sync balance
        fetchPowerUps();
      } else {
        s.toastMsg(j?.error?.code === 'INSUFFICIENT_BALANCE' ? t('shop.notEnough') : t('shop.purchaseFailed'), 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg(t('profile.network'), 'alert', 'var(--danger)'); }
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
      s.toastMsg(j?.error?.code === 'SELF_DUEL' ? t('profile.selfDuel') : t('profile.challengeFailed'), 'alert', 'var(--danger)');
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
    if (res.ok) {
      const j = await res.json().catch(() => ({}));
      const d = j?.data;
      if (d) s.toastMsg(t('profile.roiRace', { a: sgnPct(d.challengerRoi ?? 0), b: sgnPct(d.opponentRoi ?? 0) }), 'trophy', 'var(--gold)');
      fetchDuels();
    } else s.toastMsg(t('profile.resolveFailed'), 'alert', 'var(--danger)');
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
        if (code === 'INVALID_CREDENTIALS') s.toastMsg(t('profile.pwWrong'), 'alert', 'var(--danger)');
        else if (code === 'WEAK_PASSWORD') s.toastMsg(t('profile.pwWeak'), 'alert', 'var(--danger)');
        else s.toastMsg(t('profile.pwFailed'), 'alert', 'var(--danger)');
      } else {
        s.toastMsg(t('profile.pwChanged'), 'check', 'var(--green)');
        setCurrentPw('');
        setNewPw('');
      }
    } catch {
      s.toastMsg(t('profile.network'), 'alert', 'var(--danger)');
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
        <div className="row between wrap wrap-w gap-16">
          <div className="row gap-16">
            <Avatar initials={me.avatar} size={64} color="var(--gold)" ring="var(--gold)" />
            <div>
              <div className="row gap-8"><span className="h3">{me.name}</span><TierPill tier={s.tier} />{tierNext && tierToNext > 0 && <span className="tiny muted">{t('profile.toNextTier', { n: tierToNext.toLocaleString(), tier: tierNext })}</span>}</div>
              <div className="tiny muted">{me.handle} · {t('profile.joinedPrefix')} {me.joined}</div>
              <div className="row gap-8 mt-8">
                <span className="badge badge-gold"><Icon name="fire" size={12} fill="var(--gold)" />{t('profile.dayStreak', { n: s.streak })}</span>
                {s.winStreak > 0 && (
                  <span className="badge badge-green">{t('profile.winStreak', { n: s.winStreak })}</span>
                )}
              </div>
            </div>
          </div>
          <Btn variant="ghost" size="sm" icon="edit" onClick={() => { setEditName(me.name); setEditing(true); }}>{t('profile.edit')}</Btn>
        </div>
      </div>

      {editing && (
        <Portal><div className="overlay" onClick={() => setEditing(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 380 }}>
            <div className="card-pad-lg">
              <div className="row between"><span className="eyebrow">{t('profile.editProfile')}</span><button className="btn-icon" onClick={() => setEditing(false)}><Icon name="x" size={18} /></button></div>
              <div className="field mt-16"><label className="label">{t('profile.displayName')}</label><input className="input" value={editName} maxLength={30} onChange={(e) => setEditName(e.target.value)} /></div>
              <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={!editName.trim() || savingName} onClick={saveName}>{savingName ? t('profile.saving') : t('profile.save')}</Btn>
            </div>
          </div>
        </div></Portal>
      )}

      {/* stats */}
      <div className="grid-auto mt-16" style={{ '--col-min': '110px', '--gap': '12px' } as React.CSSProperties}>
        {([[t('profile.statBalance'), s.points.toLocaleString(), 'var(--gold)'], [t('profile.statRoi'), sgnPct(me.roi), sgnCol(me.roi)], [t('profile.statRank'), '#' + (me.rank ?? '—'), 'var(--sky)'], [t('profile.statSettled'), String(me.settled), 'var(--text)']] as [string, string, string][]).map(([l, v, c]) => (
          <div key={l} className="card card-pad stat"><span className="s-val tnum" style={{ color: c, fontSize: 22 }}>{v}</span><span className="s-lbl">{l}</span></div>
        ))}
      </div>

      {/* power-ups (DEPTH-04) */}
      {s.authed && (
        <div className="card card-pad mt-16">
          <div className="row gap-8" style={{ marginBottom: 12 }}>
            <Icon name="sparkles" size={18} style={{ color: 'var(--gold)' }} />
            <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{t('profile.powerups')}</span>
          </div>
          <div className="grid-auto" style={{ '--col-min': '180px', '--gap': '10px' } as React.CSSProperties}>
            {([
              { type: 'DOUBLE_DOWN', label: t('profile.puDoubleDown'), desc: t('profile.puDoubleDownDesc'), price: 300 },
              { type: 'INSURANCE', label: t('profile.puInsurance'), desc: t('profile.puInsuranceDesc'), price: 200 },
              { type: 'STREAK_SHIELD', label: t('profile.puStreakShield'), desc: t('profile.puStreakShieldDesc'), price: 400 },
            ] as { type: string; label: string; desc: string; price: number }[]).map(({ type, label, desc, price }) => (
              <div key={type} className="card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
                <div className="row between">
                  <span className="small" style={{ fontWeight: 700 }}>{label}</span>
                  <span className="badge badge-gold">{t('profile.puOwned', { n: powerUpInventory[type] ?? 0 })}</span>
                </div>
                <div className="tiny muted mt-4">{desc}</div>
                <Btn variant="ghost" size="sm" className="mt-8" disabled={buyingPowerUp === type}
                  onClick={() => handleBuyPowerUp(type)}>
                  {t('profile.puBuy', { price })}
                </Btn>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* referral / share */}
      <div className="grid-auto mt-16" style={{ '--col-min': '240px', '--gap': '12px' } as React.CSSProperties}>
        <div className="card card-pad">
          <div className="row gap-8"><Icon name="users" size={18} style={{ color: 'var(--sky)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{t('profile.referTitle')}</span></div>
          <p className="tiny t2 mt-8">{t('profile.referIntro')} {referral ? t('profile.referCount', { n: referral.count }) : t('profile.referNudge')}</p>
          <div className="row gap-8 mt-12 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="tnum small grow ellip">{referral && typeof window !== 'undefined' ? `${window.location.origin}/?ref=${referral.code}` : t('profile.genInvite')}</span>
            <Btn variant="primary" size="sm" disabled={!referral} onClick={() => {
              const url = referral && typeof window !== 'undefined' ? `${window.location.origin}/?ref=${referral.code}` : '';
              if (url && typeof navigator !== 'undefined' && navigator.clipboard) {
                navigator.clipboard.writeText(url).then(() => s.toastMsg(t('profile.inviteCopied'), 'check', 'var(--green)')).catch(() => s.toastMsg(t('profile.copyFail'), 'alert', 'var(--danger)'));
              } else s.toastMsg(t('profile.noLink'), 'alert', 'var(--gold)');
            }}>{t('profile.copy')}</Btn>
          </div>
        </div>
        <div className="card card-pad" style={{ background: 'linear-gradient(120deg,var(--green-soft),transparent)' }}>
          <div className="row gap-8"><Icon name="share" size={18} style={{ color: 'var(--green)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{t('profile.shareTitle')}</span></div>
          <p className="tiny t2 mt-8">{t('profile.shareDesc', { roi: sgnPct(me.roi), won: me.won })}</p>
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
                navigator.clipboard.writeText(url).then(() => s.toastMsg(t('profile.shareCopied'), 'check', 'var(--green)')).catch(() => s.toastMsg(t('profile.copyFail'), 'alert', 'var(--danger)'));
              } else {
                s.toastMsg(t('profile.shareCopied'), 'check', 'var(--green)');
              }
            }}>{t('profile.copyLink')}</Btn>
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
            }}>{t('profile.preview')}</Btn>
          </div>
        </div>
      </div>

      {/* achievements */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>{t('profile.achievements')}</div>
      {achievements.length === 0 && <div className="card card-pad" style={{ textAlign: 'center' }}><p className="muted">{t('profile.achEmpty')}</p></div>}
      <div className="grid-auto" style={{ '--col-min': '150px', '--gap': '12px' } as React.CSSProperties}>
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
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>{t('profile.duels')}</div>
      {s.authed && (
        <div className="stack gap-10">
          {/* challenge form */}
          <div className="card card-pad">
            <div className="row gap-8" style={{ marginBottom: 8 }}><Icon name="target" size={18} style={{ color: 'var(--magenta)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{t('profile.challengeSomeone')}</span></div>
            <p className="tiny muted" style={{ marginBottom: 12 }}>{t('profile.duelExplain')}</p>
            <div className="stack gap-8">
              <div className="field"><label className="label">{t('profile.opponentId')}</label><input className="input" value={duelOpponentId} onChange={(e) => setDuelOpponentId(e.target.value)} placeholder={t('profile.opponentIdPh')} /></div>
              <div className="field"><label className="label">{t('profile.labelField')} <span className="muted tiny">{t('profile.optional')}</span></label><input className="input" value={duelScope} onChange={(e) => setDuelScope(e.target.value)} placeholder={t('profile.labelPh')} /></div>
              <Btn variant="primary" size="sm" disabled={!duelOpponentId} onClick={handleChallenge}>{t('profile.sendChallenge')}</Btn>
            </div>
          </div>

          {/* duel list */}
          {duels.length === 0 && <div className="card card-pad"><span className="tiny muted">{t('profile.noDuels')}</span></div>}
          {duels.map((d) => {
            const statusColor = d.status === 'ACTIVE' ? 'var(--green)' : d.status === 'DONE' ? 'var(--muted)' : 'var(--gold)';
            const isIncoming = d.status === 'PENDING' && meId && d.opponentId === meId;
            const isParticipant = meId && (d.challengerId === meId || d.opponentId === meId);
            return (
              <div key={d.id} className="card card-pad">
                <div className="row between wrap wrap-w gap-8">
                  <div>
                    <div className="small" style={{ fontWeight: 700 }}>{d.challengerName} <span className="muted">{t('profile.vs')}</span> {d.opponentName}</div>
                    {d.scope && d.scope !== 'GLOBAL' && <div className="tiny muted">{d.scope}</div>}
                    <div className="tiny muted">{t('profile.higherRoi')}</div>
                    {d.status === 'DONE' && d.winnerId && <div className="tiny" style={{ color: 'var(--green)' }}>{t('profile.winner', { name: d.winnerId === d.challengerId ? d.challengerName : d.opponentName })}</div>}
                    {d.status === 'DONE' && !d.winnerId && <div className="tiny muted">{t('profile.tie')}</div>}
                  </div>
                  <div className="row gap-8">
                    <span className="badge" style={{ background: 'var(--surface-2)', color: statusColor }}>{d.status}</span>
                    {isIncoming && (
                      <>
                        <Btn variant="primary" size="sm" onClick={() => handleRespond(d.id, true)}>{t('profile.accept')}</Btn>
                        <Btn variant="ghost" size="sm" onClick={() => handleRespond(d.id, false)}>{t('profile.decline')}</Btn>
                      </>
                    )}
                    {d.status === 'ACTIVE' && isParticipant && (
                      <Btn variant="gold" size="sm" onClick={() => handleResolve(d.id)}>{t('profile.resolve')}</Btn>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* notifications */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>{t('profile.notifications')}</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {NOTIF_ROWS.map(([labelKey, key], i) => (
          <div key={key} className="row between" style={{ padding: '14px 18px', borderBottom: i < NOTIF_ROWS.length - 1 ? '1px solid var(--line)' : 0 }}>
            <span className="small">{t(labelKey)}</span>
            <Toggle on={notifPrefs[key] ?? false} onChange={(v) => handleNotifToggle(key, v)} />
          </div>
        ))}
      </div>

      {/* change password */}
      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>{t('profile.security')}</div>
      <div className="card card-pad">
        <div className="row gap-8" style={{ marginBottom: 16 }}><Icon name="shield" size={18} style={{ color: 'var(--sky)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{t('profile.changePw')}</span></div>
        <div className="stack gap-12">
          <div className="field"><label className="label">{t('profile.currentPw')}</label><input className="input" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} placeholder={t('profile.currentPwPh')} /></div>
          <div className="field"><label className="label">{t('profile.newPw')}</label><input className="input" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder={t('profile.newPwPh')} /></div>
          <Btn variant="primary" size="sm" disabled={pwLoading || !currentPw || !newPw} onClick={handleChangePassword}>{pwLoading ? t('profile.saving') : t('profile.updatePw')}</Btn>
        </div>
      </div>

      {/* cosmetic shop */}
      <CosmeticShop s={s} />

      <Btn variant="ghost" className="btn-block mt-24" icon="logout" onClick={() => s.logout()}>{t('profile.logout')}</Btn>
      <Btn variant="outline" className="btn-block mt-12" icon="shield" onClick={() => s.go('admin')}>{t('profile.openAdmin')}</Btn>
    </div>
  );
}
