'use client';
/* GOLAZO — Schedule · Match Detail · Bet Slip (ported from docs/design/predict-wc-2026/project/screens-match.jsx) */
import React, { useState, useEffect, useCallback } from 'react';
import { WC, type Pick1X2 } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Pundit, Portal, SecHead } from '@/components/ui';
import { FormationPitch } from '@/components/formation-pitch';

/* ---- Real match shape (GET /api/v1/matches[/:id]) ---- */
interface RealTeam { id: number; name: string; code: string | null; flagUrl: string | null }
export interface RealMatch {
  id: number; round: string; group: string | null; status: string; kickoffAt: string;
  home: RealTeam | null; away: RealTeam | null;
  scoreHome: number | null; scoreAway: number | null; result: string | null;
  odds: { mHome: number; mDraw: number; mAway: number } | null; bettingLocked: boolean;
  venue?: { name: string; city?: string | null; country?: string | null } | null;
}

/* Friendly messages for the predictions API error codes. */
const BET_ERR: Record<string, string> = {
  BET_LOCKED: 'Betting is closed for this match',
  INSUFFICIENT_BALANCE: 'Not enough balance',
  ALREADY_BET_OUTCOME: 'You already bet that outcome',
  ODDS_UNAVAILABLE: 'Odds unavailable',
  INVALID_STAKE: 'Enter a valid stake',
  MATCH_NOT_FOUND: 'Match not found',
};

/* Place a global bet; refresh store (balance + bets) on success. Returns an error code or null. */
async function placeGlobalBet(s: ScreenProps['s'], matchId: number, outcome: Pick1X2, stake: number, exact?: { home: number; away: number }): Promise<string | null> {
  try {
    const res = await fetch('/api/v1/predictions', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId, outcome, stake, exactHome: exact?.home, exactAway: exact?.away }),
    });
    if (res.ok) { s.refreshUser(); return null; }
    const j = await res.json().catch(() => ({}));
    return j?.error?.code ?? 'ERROR';
  } catch { return 'NETWORK'; }
}

/* Global bet slip (real match, multi-outcome) — Portal-rendered so the fade-up page can't trap it. */
function MatchBetSlip({ match, pick, oddsVal, balance, busy, onClose, onConfirm }: { match: RealMatch; pick: Pick1X2; oddsVal: number; balance: number; busy?: boolean; onClose: () => void; onConfirm: (stake: number, exact?: { home: number; away: number }) => void }) {
  const [stake, setStake] = useState(100);
  const [exH, setExH] = useState(0);
  const [exA, setExA] = useState(0);
  const knockout = match.round !== 'GROUP';
  const label = pick === '1' ? (match.home?.name ?? 'Home') : pick === '2' ? (match.away?.name ?? 'Away') : 'Draw';
  const payout = Math.round(stake * (1 + oddsVal));
  const over = stake > balance;
  const quick = [50, 100, 250, 500];
  return (
    <Portal><div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Bet slip</span><button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <div className="row between mt-12 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="small ellip">{match.home?.code ?? '?'} v {match.away?.code ?? '?'}</span>
            <span className="badge badge-sky">{pick} · {label}</span>
          </div>
          <div className="field mt-16">
            <div className="row between"><label className="label">Stake</label><span className="tiny muted">Balance <span className="tnum text-gold">{balance.toLocaleString()}</span></span></div>
            <input className="input input-mono" type="number" min={1} value={stake} onChange={e => setStake(Math.max(1, +e.target.value || 1))} />
            <div className="row gap-8 mt-4">{quick.map(q => <button key={q} className="chip chip-sm" onClick={() => setStake(q)}>{q}</button>)}<button className="chip chip-sm" onClick={() => setStake(Math.max(1, balance))}>Max</button></div>
          </div>
          {knockout && (
            <div className="field mt-12">
              <div className="row between"><label className="label">Exact score</label><span className="tiny muted">optional · knockout bonus</span></div>
              <div className="row gap-8" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <span className="tiny t2">{match.home?.code}</span>
                <input className="input input-mono" type="number" min={0} value={exH} onChange={e => setExH(Math.max(0, +e.target.value || 0))} style={{ width: 64, textAlign: 'center' }} />
                <span className="muted">:</span>
                <input className="input input-mono" type="number" min={0} value={exA} onChange={e => setExA(Math.max(0, +e.target.value || 0))} style={{ width: 64, textAlign: 'center' }} />
                <span className="tiny t2">{match.away?.code}</span>
              </div>
            </div>
          )}
          <div className="card-2 card-pad mt-12" style={{ borderRadius: 'var(--r-sm)' }}>
            <div className="row between small"><span className="t2">Odds</span><span className="tnum">×{(1 + oddsVal).toFixed(2)}</span></div>
            <div className="row between mt-8"><span className="t2">Potential payout</span><span className="tnum text-green" style={{ fontWeight: 700 }}>{payout.toLocaleString()}</span></div>
          </div>
          {over && <p className="tiny text-danger mt-8" style={{ textAlign: 'center' }}>Stake exceeds your balance.</p>}
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={stake <= 0 || over || busy} onClick={() => onConfirm(stake, knockout ? { home: exH, away: exA } : undefined)}>{busy ? 'Placing…' : `Confirm bet · ${stake} pts`}</Btn>
        </div>
      </div>
    </div></Portal>
  );
}

/* Real match card with 1·X·2 betting — self-contained (owns its slip). Used by Schedule + Home/Landing. */
export function MatchBetCard({ m, s }: { m: RealMatch; s: ScreenProps['s'] }) {
  const [slip, setSlip] = useState<{ pick: Pick1X2; oddsVal: number } | null>(null);
  const [sending, setSending] = useState(false);
  const open = m.status === 'SCHEDULED' && !m.bettingLocked;
  const myBets = s.bets.filter(b => b.mid === m.id);
  const betFor = (k: Pick1X2) => myBets.find(b => b.pick === k);
  const cells: [Pick1X2, string, number][] = m.odds
    ? [['1', m.home?.code ?? 'H', m.odds.mHome], ['X', 'Draw', m.odds.mDraw], ['2', m.away?.code ?? 'A', m.odds.mAway]]
    : [];
  const onBet = (k: Pick1X2, v: number) => { if (!s.authed) { s.go('auth', { mode: 'signup' }); return; } setSlip({ pick: k, oddsVal: v }); };
  const confirm = async (stake: number, exact?: { home: number; away: number }) => {
    if (!slip || sending) return;
    setSending(true);
    const err = await placeGlobalBet(s, m.id, slip.pick, stake, exact);
    setSending(false);
    if (err) { s.toastMsg(BET_ERR[err] ?? 'Could not place bet', 'alert', 'danger'); return; }
    s.toastMsg('Bet placed!', 'check', 'green');
    setSlip(null);
  };
  return (
    <div className="card card-pad">
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="badge badge-muted">{m.round === 'GROUP' ? `Group ${m.group ?? ''}` : m.round}</span>
        {m.status === 'LIVE' ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE</span>
          : m.status === 'FINISHED' ? <span className="badge badge-muted">FT {m.scoreHome}-{m.scoreAway}</span>
            : m.bettingLocked ? <span className="badge badge-danger"><Icon name="lock" size={11} /> Betting closed</span>
              : <span className="tiny muted">{new Date(m.kickoffAt).toLocaleDateString()}</span>}
      </div>
      <div className="row between gap-12" style={{ marginBottom: 10 }} onClick={() => s.go('match', { id: m.id })}>
        {[m.home, m.away].map((t, i) => (
          <div key={i} className="row gap-8 pointer" style={{ flex: 1, minWidth: 0, justifyContent: i ? 'flex-end' : 'flex-start' }}>
            {i === 0 && t && <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={26} />}
            <span className="ellip small" style={{ fontWeight: 600 }}>{t?.name ?? 'TBD'}</span>
            {i === 1 && t && <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={26} />}
          </div>
        ))}
      </div>
      {cells.length > 0 && (
        <div className="row gap-8 full">
          {cells.map(([k, lbl, v]) => {
            const bet = betFor(k);
            return (
              <button key={k} className={`odds ${bet ? 'sel' : ''}`} disabled={!open || !!bet}
                onClick={() => open && !bet && onBet(k, v)} style={!open ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>
                <span className="o-label">{k} · {lbl}</span><span className="o-val">{v.toFixed(2)}</span>
              </button>
            );
          })}
        </div>
      )}
      {myBets.length > 0 && (
        <div className="tiny text-green mt-8 row gap-8 wrap-w">
          {myBets.map((b, i) => <span key={i} className="row gap-4"><Icon name="check" size={13} /> {b.pick} · {b.stake}{b.status !== 'OPEN' ? ` (${b.status})` : ''}</span>)}
        </div>
      )}
      {slip && <MatchBetSlip match={m} pick={slip.pick} oddsVal={slip.oddsVal} balance={s.points} busy={sending} onClose={() => setSlip(null)} onConfirm={confirm} />}
    </div>
  );
}

/* live-score polling (DATA-07) — overlays LIVE scores from /api/v1/matches/live */
function useLiveScores() {
  const [scores, setScores] = useState<Map<number, { home: number; away: number }>>(new Map());
  useEffect(() => {
    let active = true;
    const poll = () => {
      fetch('/api/v1/matches/live')
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (active && j?.data) {
            setScores(new Map((j.data as { id: number; home: number; away: number }[]).map((x) => [x.id, { home: x.home, away: x.away }])));
          }
        })
        .catch(() => {});
    };
    poll();
    const t = setInterval(poll, 15000);
    return () => { active = false; clearInterval(t); };
  }, []);
  return scores;
}

/* ===================== SCHEDULE ===================== */
export function Schedule({ s }: ScreenProps) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<RealMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => setMatches((j?.data ?? []) as RealMatch[]))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const filters = [
    { k: 'all', label: 'All' }, { k: 'live', label: 'Live' }, { k: 'today', label: 'Today' },
    { k: 'open', label: 'Open' }, { k: 'finished', label: 'Finished' },
  ];
  const today = new Date().toDateString();
  let list = matches.slice();
  if (filter === 'live') list = list.filter(m => m.status === 'LIVE');
  if (filter === 'finished') list = list.filter(m => m.status === 'FINISHED');
  if (filter === 'open') list = list.filter(m => m.status === 'SCHEDULED' && !m.bettingLocked);
  if (filter === 'today') list = list.filter(m => new Date(m.kickoffAt).toDateString() === today);
  if (q) list = list.filter(m => `${m.home?.name ?? ''} ${m.away?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  // group fixtures by Group / knockout round so the section a match belongs to is obvious
  const ROUND_LABEL: Record<string, string> = { R32: 'Round of 32', R16: 'Round of 16', QF: 'Quarter-finals', SF: 'Semi-finals', THIRD: 'Third place', FINAL: 'Final' };
  const sectionOf = (m: RealMatch) => m.round === 'GROUP' ? `Group ${m.group ?? '?'}` : (ROUND_LABEL[m.round] ?? m.round);
  const sections: [string, RealMatch[]][] = [];
  const secIdx = new Map<string, number>();
  for (const m of list) {
    const lbl = sectionOf(m);
    let i = secIdx.get(lbl);
    if (i == null) { i = sections.length; secIdx.set(lbl, i); sections.push([lbl, []]); }
    sections[i][1].push(m);
  }

  return (
    <div className="page fade-up">
      <SecHead title="Match schedule" sub="48 teams · 12 groups · 104 matches across USA, Canada & Mexico" />
      <div className="row between wrap gap-12" style={{ marginBottom: 18 }}>
        <div className="row gap-8 wrap-w">
          {filters.map(f => <button key={f.k} className={`chip ${filter === f.k ? 'active' : ''}`} onClick={() => setFilter(f.k)}>{f.label}</button>)}
        </div>
        <div className="row gap-8 card" style={{ padding: '6px 12px', borderRadius: 'var(--r-pill)' }}>
          <Icon name="search" size={16} className="muted" />
          <input className="input" style={{ border: 0, background: 'transparent', padding: '4px 0', width: 160 }} placeholder="Search teams" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {loading
        ? <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Loading fixtures…</p></div>
        : list.length === 0
          ? <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No matches match that filter.</p></div>
          : sections.map(([label, ms]) => (
            <div key={label} style={{ marginBottom: 22 }}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span className="eyebrow">{label}</span>
                <span className="tiny muted">{ms.length} {ms.length === 1 ? 'match' : 'matches'}</span>
              </div>
              <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
                {ms.map(m => <MatchBetCard key={m.id} m={m} s={s} />)}
              </div>
            </div>
          ))}
    </div>
  );
}

/* ===================== MATCH DETAIL ===================== */

const NEXT_GOAL_PICKS: { pick: string; label: string; odds: number }[] = [
  { pick: 'HOME', label: 'Home', odds: 1.8 },
  { pick: 'AWAY', label: 'Away', odds: 2.2 },
  { pick: 'NONE', label: 'None', odds: 3.0 },
];

function MicroBetWidget({ matchId }: { matchId: number }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [stake, setStake] = useState(50);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  function handleConfirm() {
    if (!selected || sending) return;
    setSending(true);
    try {
      fetch('/api/v1/micro', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, market: 'NEXT_GOAL', pick: selected, stake }),
      })
        .then(r => r.json())
        .then((j: { data?: { id: string }; error?: { code: string } }) => {
          if (j?.data?.id) setDone('Bet placed!');
          else setDone(j?.error?.code ?? 'Error');
        })
        .catch(() => setDone('Error'))
        .finally(() => setSending(false));
    } catch {
      setSending(false);
    }
  }

  if (done) {
    return (
      <div className="card card-pad mt-16" style={{ borderColor: 'rgba(43,224,138,.4)' }}>
        <div className="row gap-8"><Icon name="ball" size={16} style={{ color: 'var(--green)' }} /><span className="small" style={{ fontWeight: 700 }}>{done}</span></div>
      </div>
    );
  }

  return (
    <div className="card card-pad mt-16" style={{ borderColor: 'rgba(255,180,0,.3)' }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="eyebrow">In-play · Next Goal</span>
        <span className="badge badge-magenta"><span className="live-dot"></span>LIVE</span>
      </div>
      <div className="row gap-8 mt-4">
        {NEXT_GOAL_PICKS.map(({ pick, label, odds }) => (
          <button key={pick} className={`odds ${selected === pick ? 'sel' : ''}`} style={{ flex: 1 }} onClick={() => setSelected(pick)}>
            <span className="o-label">{label}</span><span className="o-val">×{(1 + odds).toFixed(1)}</span>
          </button>
        ))}
      </div>
      <div className="field mt-10">
        <div className="row between"><label className="label">Stake</label></div>
        <input className="input input-mono" type="number" value={stake} min={1} onChange={e => setStake(Math.max(1, +e.target.value || 1))} />
      </div>
      <Btn variant="primary" className="btn-block mt-10" disabled={!selected || sending} onClick={handleConfirm}>
        {sending ? 'Placing…' : 'Place in-play bet'}
      </Btn>
    </div>
  );
}

export function MatchDetail({ s }: ScreenProps) {
  const id = Number(s.param.id);
  const [m, setM] = useState<RealMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<{ home: TeamDetail | null; away: TeamDetail | null }>({ home: null, away: null });
  const [slip, setSlip] = useState<{ pick: Pick1X2; oddsVal: number } | null>(null);
  const [sending, setSending] = useState(false);
  const liveScores = useLiveScores();

  const load = useCallback(() => {
    if (!id) { setLoading(false); return; }
    setLoading(true);
    fetch(`/api/v1/matches/${id}`).then(r => (r.ok ? r.json() : null))
      .then(j => setM((j?.data ?? null) as RealMatch | null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const homeId = m?.home?.id, awayId = m?.away?.id;
  useEffect(() => {
    const pairs: [('home' | 'away'), number | undefined][] = [['home', homeId], ['away', awayId]];
    const toFetch = pairs.filter((p): p is ['home' | 'away', number] => typeof p[1] === 'number');
    if (!toFetch.length) return;
    let cancelled = false;
    Promise.all(toFetch.map(([k, tid]) => fetch(`/api/v1/teams/${tid}`).then(r => (r.ok ? r.json() : null)).then(j => [k, (j?.data ?? null) as TeamDetail | null] as const)))
      .then(rs => { if (!cancelled) setTeams(prev => { const next = { ...prev }; for (const [k, d] of rs) next[k] = d; return next; }); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [homeId, awayId]);

  if (loading) return <div className="page fade-up"><div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Loading match…</p></div></div>;
  if (!m) return (
    <div className="page fade-up">
      <button className="chip mt-4" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back</button>
      <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Match not found.</p></div>
    </div>
  );

  const lv = liveScores.get(m.id);
  const live = m.status === 'LIVE', fin = m.status === 'FINISHED', open = m.status === 'SCHEDULED' && !m.bettingLocked;
  const hs = lv ? lv.home : m.scoreHome;
  const as = lv ? lv.away : m.scoreAway;
  const myBets = s.bets.filter(b => b.mid === m.id);
  const betFor = (k: Pick1X2) => myBets.find(b => b.pick === k);
  const cells: [Pick1X2, string, number][] = m.odds
    ? [['1', m.home?.code ?? 'H', m.odds.mHome], ['X', 'Draw', m.odds.mDraw], ['2', m.away?.code ?? 'A', m.odds.mAway]]
    : [];

  const onBet = (pick: Pick1X2, oddsVal: number) => {
    if (!s.authed) { s.go('auth', { mode: 'signup' }); return; }
    setSlip({ pick, oddsVal });
  };
  const confirm = async (stake: number, exact?: { home: number; away: number }) => {
    if (!slip || sending) return;
    setSending(true);
    const err = await placeGlobalBet(s, m.id, slip.pick, stake, exact);
    setSending(false);
    if (err) { s.toastMsg(BET_ERR[err] ?? 'Could not place bet', 'alert', 'danger'); return; }
    s.toastMsg('Bet placed!', 'check', 'green');
    setSlip(null);
  };

  const lineupTeams = [teams.home, teams.away].filter((t): t is TeamDetail => !!t && Array.isArray(t.players) && t.players.length > 0);
  const homeForm = teams.home ? formFor(teams.home.id, teams.home.matches ?? []) : [];
  const awayForm = teams.away ? formFor(teams.away.id, teams.away.matches ?? []) : [];

  return (
    <div className="page fade-up">
      {/* reading content constrained for legibility; lineups grid below goes full width */}
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <button className="chip mt-4" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back</button>

      {/* hero */}
      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between">
          <span className="badge badge-muted">{m.round === 'GROUP' ? `Group ${m.group ?? ''}` : m.round}</span>
          {live ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE</span>
            : fin ? <span className="badge badge-muted">Full time</span>
              : <span className="badge badge-sky">{new Date(m.kickoffAt).toLocaleString()}</span>}
        </div>
        <div className="row between" style={{ marginTop: 20, alignItems: 'flex-start' }}>
          <TeamHero t={m.home} rank={teams.home?.fifaRank} />
          <div style={{ textAlign: 'center', paddingTop: 10 }}>
            {(live || fin) && hs != null
              ? <div className="display tnum" style={{ fontSize: 48 }}>{hs}<span className="muted" style={{ fontSize: 28, padding: '0 8px' }}>:</span>{as}</div>
              : <div className="display muted" style={{ fontSize: 32 }}>VS</div>}
            {fin && m.result && <div className="tiny mt-4 text-gold">Result: {m.result === '1' ? m.home?.code : m.result === '2' ? m.away?.code : 'Draw'}</div>}
          </div>
          <TeamHero t={m.away} rank={teams.away?.fifaRank} />
        </div>
      </div>

      {/* info strip (real) */}
      <div className="card card-pad mt-16">
        <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
          <InfoCell label="Kickoff" value={new Date(m.kickoffAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })} />
          <InfoCell label="Round" value={m.round === 'GROUP' ? `Group ${m.group ?? ''}` : m.round} />
          <InfoCell label="Venue" value={m.venue?.name ? `${m.venue.name}${m.venue.city ? `, ${m.venue.city}` : ''}${m.venue.country ? `, ${m.venue.country}` : ''}` : '—'} />
          <InfoCell label="Status" value={m.status} />
        </div>
      </div>

      {/* odds + bet */}
      {cells.length > 0 && (
        <div className="card card-pad mt-16">
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="eyebrow">Match odds</span>
            {open ? <span className="tiny muted">Locks at kickoff</span> : <span className="tiny text-danger row gap-4"><Icon name="lock" size={12} /> Betting closed</span>}
          </div>
          <div className="row gap-8 full">
            {cells.map(([k, lbl, v]) => {
              const bet = betFor(k);
              return (
                <button key={k} className={`odds ${bet ? 'sel' : ''}`} disabled={!open || !!bet}
                  onClick={() => open && !bet && onBet(k, v)} style={!open ? { opacity: 0.55, cursor: 'not-allowed' } : undefined}>
                  <span className="o-label">{k} · {lbl}</span><span className="o-val">{v.toFixed(2)}</span>
                </button>
              );
            })}
          </div>
          {myBets.length > 0 && (
            <div className="stack gap-8 mt-16">
              {myBets.map((b, i) => (
                <div key={i} className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
                  <div className="small">Your bet: <b>{b.pick}</b> · <span className="tnum">{b.stake}</span> pts @ <span className="tnum">{b.odds.toFixed(2)}</span></div>
                  <span className={`badge badge-${b.status === 'WON' ? 'green' : b.status === 'LOST' ? 'danger' : 'sky'}`}>{b.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* in-play micro-bet widget (DEPTH-06) — LIVE + authed only */}
      {live && s.authed && <MicroBetWidget matchId={m.id} />}
      {live && !s.authed && (
        <div className="card card-pad mt-16" style={{ textAlign: 'center' }}>
          <p className="small muted">Sign in to place in-play bets on this match.</p>
        </div>
      )}

      {/* recent form (real — last finished results) */}
      {(homeForm.length > 0 || awayForm.length > 0) && (
        <div className="card card-pad mt-16">
          <span className="eyebrow">Recent form</span>
          <div className="stack gap-10 mt-12">
            <FormRow name={m.home?.name ?? 'Home'} form={homeForm} />
            <FormRow name={m.away?.name ?? 'Away'} form={awayForm} />
          </div>
        </div>
      )}

      {/* AI Pundit (inline section) */}
      <div className="mt-16"><PunditPanel m={m} /></div>
      </div>{/* end constrained reading content */}

      {/* Lineups — both teams side-by-side (same as admin), full page width */}
      <div className="mt-16">
        <div className="eyebrow" style={{ marginBottom: 12 }}>Lineups</div>
        {lineupTeams.length > 0
          ? (
            <>
              <p className="tiny muted" style={{ marginBottom: 12 }}>AI-predicted lineups · updated ~15 min before kickoff.</p>
              <div className="grid gap-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))' }}>
                {lineupTeams.map((t, i) => (
                  <div key={i}>
                    <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{t.name}</div>
                    <FormationPitch players={t.players} formation={t.formation} manager={t.manager} />
                  </div>
                ))}
              </div>
            </>
          )
          : <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Lineups not available yet.</p></div>}
      </div>

      {slip && <MatchBetSlip match={m} pick={slip.pick} oddsVal={slip.oddsVal} balance={s.points} busy={sending} onClose={() => setSlip(null)} onConfirm={confirm} />}
    </div>
  );
}

function TeamHero({ t, rank }: { t: RealTeam | null; rank?: number | null }) {
  return (
    <div className="stack center gap-8" style={{ width: 120 }}>
      <Flag flagUrl={t?.flagUrl ?? undefined} name={t?.name} code={t?.code ?? undefined} size={56} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{t?.name ?? 'TBD'}</div>
        {rank != null ? <div className="tiny muted">FIFA #{rank}</div> : t?.code ? <div className="tiny muted">{t.code}</div> : null}
      </div>
    </div>
  );
}

/* ---- Team detail (GET /api/v1/teams/:id) — powers ranks, lineups + real recent form ---- */
interface TeamMatchLite { id: number; status: string; kickoffAt: string; home: { id: number; code: string | null } | null; away: { id: number; code: string | null } | null; result: string | null }
interface TeamDetail {
  id: number; name: string; code: string | null; fifaRank: number | null;
  formation: string | null; manager: string | null;
  players: { name: string; position: string | null; number: number | null; starter?: boolean }[];
  matches: TeamMatchLite[];
}

/* Real recent form (last finished results) for a team → W/D/L, newest first. */
function formFor(teamId: number, matches: TeamMatchLite[]): ('W' | 'D' | 'L')[] {
  return matches
    .filter(mm => mm.status === 'FINISHED' && mm.result)
    .sort((a, b) => new Date(b.kickoffAt).getTime() - new Date(a.kickoffAt).getTime())
    .slice(0, 5)
    .map(mm => {
      if (mm.result === 'X') return 'D';
      const isHome = mm.home?.id === teamId;
      const win = (isHome && mm.result === '1') || (!isHome && mm.result === '2');
      return win ? 'W' : 'L';
    });
}

function InfoCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="tiny muted">{label}</div>
      <div className="small" style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function FormRow({ name, form }: { name: string; form: ('W' | 'D' | 'L')[] }) {
  const color = (r: string) => r === 'W' ? 'var(--green)' : r === 'L' ? 'var(--danger)' : 'var(--text-2)';
  const bg = (r: string) => r === 'W' ? 'var(--green-soft)' : r === 'L' ? 'var(--danger-soft)' : 'var(--surface-3)';
  return (
    <div className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
      <span className="small ellip" style={{ fontWeight: 600 }}>{name}</span>
      {form.length > 0
        ? <div className="row gap-6">{form.map((r, i) => <span key={i} className="badge" style={{ width: 24, justifyContent: 'center', background: bg(r), color: color(r) }}>{r}</span>)}</div>
        : <span className="tiny muted">no results yet</span>}
    </div>
  );
}

/* ---- AI Pundit panel ---- */
function PunditPanel({ m }: { m: RealMatch }) {
  const [content, setContent] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [err, setErr] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setContent(null); setErr(false);
    fetch(`/api/v1/ai/preview/${m.id}`)
      .then(r => (r.ok ? r.json() : null))
      .then((body: { data?: { content?: string; disclaimer?: string; provider?: string } } | null) => {
        if (cancelled) return;
        if (body?.data?.content) {
          setContent(body.data.content);
          setDisclaimer(body.data.disclaimer ?? null);
          setProvider(body.data.provider ?? null);
        } else setErr(true);
      })
      .catch(() => { if (!cancelled) setErr(true); });
    return () => { cancelled = true; };
  }, [m.id]);

  return (
    <div className="panel card-pad" style={{ background: 'linear-gradient(120deg, var(--sky-soft), transparent)' }}>
      <div className="row gap-14" style={{ alignItems: 'flex-start' }}>
        <Pundit size={56} mood="think" glow />
        <div className="grow">
          <div className="row between">
            <span className="badge badge-sky">Ora · Match preview</span>
            {provider && <span className="tiny muted">AI-assisted · {provider}</span>}
          </div>
          {content
            ? (
              <>
                <p className="t2 small mt-8" style={{ lineHeight: 1.6 }}>{content}</p>
                {disclaimer && (
                  <div className="card-2 card-pad mt-12 small t2" style={{ borderRadius: 'var(--r-sm)', display: 'flex', gap: 8 }}>
                    <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none', marginTop: 2 }} />
                    <span>{disclaimer}</span>
                  </div>
                )}
              </>
            )
            : err ? <p className="t2 small mt-8 muted">Preview unavailable right now.</p>
              : <p className="t2 small mt-8 muted">Generating preview…</p>}
        </div>
      </div>
    </div>
  );
}
