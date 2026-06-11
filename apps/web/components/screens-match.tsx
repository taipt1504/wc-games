'use client';
/* World Cup Games — Schedule · Match Detail · Bet Slip (ported from docs/design/predict-wc-2026/project/screens-match.jsx) */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type Pick1X2 } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Pundit, Portal, SecHead } from '@/components/ui';
import { FormationPitch } from '@/components/formation-pitch';
import { LocalTime } from '@/components/local-time';
import { useRealtime } from '@/lib/realtime';
import { useT } from '@/lib/i18n/hooks';

/* ---- Real match shape (GET /api/v1/matches[/:id]) ---- */
interface RealTeam { id: number; name: string; code: string | null; flagUrl: string | null }
export interface RealMatch {
  id: number; round: string; group: string | null; status: string; kickoffAt: string;
  home: RealTeam | null; away: RealTeam | null;
  scoreHome: number | null; scoreAway: number | null; result: string | null;
  odds: { mHome: number; mDraw: number; mAway: number } | null; bettingLocked: boolean;
  venue?: { name: string; city?: string | null; country?: string | null } | null;
}

/* Maps a predictions API error code → an i18n key (resolved with t() at the call site). */
const BET_ERR: Record<string, string> = {
  BET_LOCKED: 'betslip.errLocked',
  INSUFFICIENT_BALANCE: 'betslip.errBalance',
  ALREADY_BET_OUTCOME: 'betslip.errAlready',
  ODDS_UNAVAILABLE: 'betslip.errOdds',
  INVALID_STAKE: 'betslip.errStake',
  MATCH_NOT_FOUND: 'betslip.errNotFound',
};

/* GROUP → "Group A"; knockout → raw round code (matches the original card/detail display). */
function roundShort(round: string, group: string | null, groupPrefix: string): string {
  return round === 'GROUP' ? `${groupPrefix} ${group ?? ''}` : round;
}

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
  const { t } = useT();
  const [stake, setStake] = useState(100);
  const [exH, setExH] = useState(0);
  const [exA, setExA] = useState(0);
  const knockout = match.round !== 'GROUP';
  const label = pick === '1' ? (match.home?.name ?? t('betslip.home')) : pick === '2' ? (match.away?.name ?? t('betslip.away')) : t('betslip.draw');
  const payout = Math.round(stake * oddsVal); // decimal odds: total return = stake × odds
  const over = stake > balance;
  const quick = [50, 100, 250, 500];
  return (
    <Portal><div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">{t('betslip.title')}</span><button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <div className="row between mt-12 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="small ellip">{match.home?.code ?? '?'} v {match.away?.code ?? '?'}</span>
            <span className="badge badge-sky">{pick} · {label}</span>
          </div>
          <div className="field mt-16">
            <div className="row between"><label className="label">{t('betslip.stake')}</label><span className="tiny muted">{t('betslip.balance')} <span className="tnum text-gold">{balance.toLocaleString()}</span></span></div>
            <input className="input input-mono" type="number" min={1} value={stake} onChange={e => setStake(Math.max(1, +e.target.value || 1))} />
            <div className="row gap-8 mt-4">{quick.map(q => <button key={q} className="chip chip-sm" onClick={() => setStake(q)}>{q}</button>)}<button className="chip chip-sm" onClick={() => setStake(Math.max(1, balance))}>{t('betslip.max')}</button></div>
          </div>
          {knockout && (
            <div className="field mt-12">
              <div className="row between"><label className="label">{t('betslip.exactScore')}</label><span className="tiny muted">{t('betslip.exactHint')}</span></div>
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
            <div className="row between small"><span className="t2">{t('betslip.odds')}</span><span className="tnum">×{oddsVal.toFixed(2)}</span></div>
            <div className="row between mt-8"><span className="t2">{t('betslip.potentialPayout')}</span><span className="tnum text-green" style={{ fontWeight: 700 }}>{payout.toLocaleString()}</span></div>
          </div>
          {over && <p className="tiny text-danger mt-8" style={{ textAlign: 'center' }}>{t('betslip.overBalance')}</p>}
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={stake <= 0 || over || busy} onClick={() => onConfirm(stake, knockout ? { home: exH, away: exA } : undefined)}>{busy ? t('betslip.placing') : t('betslip.confirm', { stake })}</Btn>
        </div>
      </div>
    </div></Portal>
  );
}

/* Real match card with 1·X·2 betting — self-contained (owns its slip). Used by Schedule + Home/Landing. */
export function MatchBetCard({ m, s }: { m: RealMatch; s: ScreenProps['s'] }) {
  const { t, fmt } = useT();
  const [slip, setSlip] = useState<{ pick: Pick1X2; oddsVal: number } | null>(null);
  const [sending, setSending] = useState(false);
  const open = m.status === 'SCHEDULED' && !m.bettingLocked;
  const myBets = s.bets.filter(b => b.mid === m.id);
  const betFor = (k: Pick1X2) => myBets.find(b => b.pick === k);
  const cells: [Pick1X2, string, number][] = m.odds
    ? [['1', m.home?.code ?? 'H', m.odds.mHome], ['X', t('betslip.draw'), m.odds.mDraw], ['2', m.away?.code ?? 'A', m.odds.mAway]]
    : [];
  const onBet = (k: Pick1X2, v: number) => { if (!s.authed) { s.go('auth', { mode: 'signup' }); return; } setSlip({ pick: k, oddsVal: v }); };
  const confirm = async (stake: number, exact?: { home: number; away: number }) => {
    if (!slip || sending) return;
    setSending(true);
    const err = await placeGlobalBet(s, m.id, slip.pick, stake, exact);
    setSending(false);
    if (err) { s.toastMsg(t(BET_ERR[err] ?? 'betslip.errGeneric'), 'alert', 'danger'); return; }
    s.toastMsg(t('betslip.betPlaced'), 'check', 'green');
    setSlip(null);
  };
  return (
    <div className="card card-pad">
      <div className="row between" style={{ marginBottom: 10 }}>
        <span className="badge badge-muted">{roundShort(m.round, m.group, t('round.groupPrefix'))}</span>
        {m.status === 'LIVE' ? <span className="badge badge-magenta"><span className="live-dot"></span>{t('match.live')}</span>
          : m.status === 'FINISHED' ? <span className="badge badge-muted">{t('match.ft', { score: `${m.scoreHome}-${m.scoreAway}` })}</span>
            : m.bettingLocked ? <span className="badge badge-danger"><Icon name="lock" size={11} /> {t('match.bettingClosedBadge')}</span>
              : <span className="tiny muted"><LocalTime value={m.kickoffAt} opts={{ day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }} withTz /></span>}
      </div>
      <div className="row between gap-12" style={{ marginBottom: 10 }} onClick={() => s.go('match', { id: m.id })}>
        {[m.home, m.away].map((tm, i) => (
          <div key={i} className="row gap-8 pointer" style={{ flex: 1, minWidth: 0, justifyContent: i ? 'flex-end' : 'flex-start' }}>
            {i === 0 && tm && <Flag flagUrl={tm.flagUrl ?? undefined} name={tm.name} code={tm.code ?? undefined} size={26} />}
            <span className="ellip small" style={{ fontWeight: 600 }}>{tm?.name ?? t('match.tbd')}</span>
            {i === 1 && tm && <Flag flagUrl={tm.flagUrl ?? undefined} name={tm.name} code={tm.code ?? undefined} size={26} />}
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
  const { t } = useT();
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [matches, setMatches] = useState<RealMatch[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => setMatches((j?.data ?? []) as RealMatch[]))
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  }, []);
  useEffect(() => { load(); }, [load]);

  // Realtime: any match update silently re-fetches the list (debounced to coalesce bursts).
  const debRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useRealtime('match.update', () => {
    clearTimeout(debRef.current);
    debRef.current = setTimeout(() => load(true), 500);
  });

  const filters = [
    { k: 'all', label: t('schedule.filterAll') }, { k: 'live', label: t('schedule.filterLive') }, { k: 'today', label: t('schedule.filterToday') },
    { k: 'open', label: t('schedule.filterOpen') }, { k: 'finished', label: t('schedule.filterFinished') },
  ];
  const today = new Date().toDateString();
  let list = matches.slice();
  if (filter === 'live') list = list.filter(m => m.status === 'LIVE');
  if (filter === 'finished') list = list.filter(m => m.status === 'FINISHED');
  if (filter === 'open') list = list.filter(m => m.status === 'SCHEDULED' && !m.bettingLocked);
  if (filter === 'today') list = list.filter(m => new Date(m.kickoffAt).toDateString() === today);
  if (q) list = list.filter(m => `${m.home?.name ?? ''} ${m.away?.name ?? ''}`.toLowerCase().includes(q.toLowerCase()));

  // group fixtures by Group / knockout round so the section a match belongs to is obvious
  const sectionOf = (m: RealMatch) => m.round === 'GROUP' ? `${t('round.groupPrefix')} ${m.group ?? '?'}` : t(`round.${m.round}`);
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
      <SecHead title={t('schedule.title')} sub={t('schedule.sub')} />
      <div className="row between wrap wrap-w gap-12" style={{ marginBottom: 18 }}>
        <div className="row gap-8 wrap-w">
          {filters.map(f => <button key={f.k} className={`chip ${filter === f.k ? 'active' : ''}`} onClick={() => setFilter(f.k)}>{f.label}</button>)}
        </div>
        <div className="row gap-8 card" style={{ padding: '6px 12px', borderRadius: 'var(--r-pill)' }}>
          <Icon name="search" size={16} className="muted" />
          <input className="input" style={{ border: 0, background: 'transparent', padding: '4px 0', flex: 1, minWidth: 0 }} placeholder={t('schedule.searchPh')} value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {loading
        ? <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">{t('schedule.loading')}</p></div>
        : list.length === 0
          ? <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">{t('schedule.empty')}</p></div>
          : sections.map(([label, ms]) => (
            <div key={label} style={{ marginBottom: 22 }}>
              <div className="row between" style={{ marginBottom: 10 }}>
                <span className="eyebrow">{label}</span>
                <span className="tiny muted">{ms.length} {ms.length === 1 ? t('schedule.matchOne') : t('schedule.matchMany')}</span>
              </div>
              <div className="grid-fill" style={{ '--col-min': '300px', '--gap': '14px' } as React.CSSProperties}>
                {ms.map(m => <MatchBetCard key={m.id} m={m} s={s} />)}
              </div>
            </div>
          ))}
    </div>
  );
}

/* ===================== MATCH DETAIL ===================== */

const NEXT_GOAL_PICKS: { pick: string; labelKey: string; odds: number }[] = [
  { pick: 'HOME', labelKey: 'match.nextGoalHome', odds: 1.8 },
  { pick: 'AWAY', labelKey: 'match.nextGoalAway', odds: 2.2 },
  { pick: 'NONE', labelKey: 'match.nextGoalNone', odds: 3.0 },
];

function MicroBetWidget({ matchId }: { matchId: number }) {
  const { t } = useT();
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
          if (j?.data?.id) setDone(t('betslip.betPlaced'));
          else setDone(t('match.error'));
        })
        .catch(() => setDone(t('match.error')))
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
        <span className="eyebrow">{t('match.inplayNextGoal')}</span>
        <span className="badge badge-magenta"><span className="live-dot"></span>{t('match.live')}</span>
      </div>
      <div className="row gap-8 mt-4">
        {NEXT_GOAL_PICKS.map(({ pick, labelKey, odds }) => (
          <button key={pick} className={`odds ${selected === pick ? 'sel' : ''}`} style={{ flex: 1 }} onClick={() => setSelected(pick)}>
            <span className="o-label">{t(labelKey)}</span><span className="o-val">×{(1 + odds).toFixed(1)}</span>
          </button>
        ))}
      </div>
      <div className="field mt-10">
        <div className="row between"><label className="label">{t('betslip.stake')}</label></div>
        <input className="input input-mono" type="number" value={stake} min={1} onChange={e => setStake(Math.max(1, +e.target.value || 1))} />
      </div>
      <Btn variant="primary" className="btn-block mt-10" disabled={!selected || sending} onClick={handleConfirm}>
        {sending ? t('betslip.placing') : t('match.placeInplay')}
      </Btn>
    </div>
  );
}

export function MatchDetail({ s }: ScreenProps) {
  const { t, fmt } = useT();
  const id = Number(s.param.id);
  const [m, setM] = useState<RealMatch | null>(null);
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<{ home: TeamDetail | null; away: TeamDetail | null }>({ home: null, away: null });
  const [slip, setSlip] = useState<{ pick: Pick1X2; oddsVal: number } | null>(null);
  const [sending, setSending] = useState(false);
  const liveScores = useLiveScores();

  const load = useCallback((silent = false) => {
    if (!id) { setLoading(false); return; }
    if (!silent) setLoading(true);
    fetch(`/api/v1/matches/${id}`).then(r => (r.ok ? r.json() : null))
      .then(j => setM((j?.data ?? null) as RealMatch | null))
      .catch(() => {})
      .finally(() => { if (!silent) setLoading(false); });
  }, [id]);
  useEffect(() => { load(); }, [load]);

  // Realtime: re-fetch this match silently when it changes (lineup/odds/score/lock/settle).
  useRealtime('match.update', (ev) => { if (Number(ev.matchId) === id) load(true); });

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

  if (loading) return <div className="page fade-up"><div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">{t('match.loading')}</p></div></div>;
  if (!m) return (
    <div className="page fade-up">
      <button className="chip mt-4" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> {t('common.back')}</button>
      <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">{t('match.notFound')}</p></div>
    </div>
  );

  const lv = liveScores.get(m.id);
  const live = m.status === 'LIVE', fin = m.status === 'FINISHED', open = m.status === 'SCHEDULED' && !m.bettingLocked;
  const hs = lv ? lv.home : m.scoreHome;
  const as = lv ? lv.away : m.scoreAway;
  const myBets = s.bets.filter(b => b.mid === m.id);
  const betFor = (k: Pick1X2) => myBets.find(b => b.pick === k);
  const cells: [Pick1X2, string, number][] = m.odds
    ? [['1', m.home?.code ?? 'H', m.odds.mHome], ['X', t('betslip.draw'), m.odds.mDraw], ['2', m.away?.code ?? 'A', m.odds.mAway]]
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
    if (err) { s.toastMsg(t(BET_ERR[err] ?? 'betslip.errGeneric'), 'alert', 'danger'); return; }
    s.toastMsg(t('betslip.betPlaced'), 'check', 'green');
    setSlip(null);
  };

  const statusLabel = (s: string) =>
    s === 'LIVE' ? t('match.statusLive')
    : s === 'FINISHED' ? t('match.statusFinished')
    : s === 'POSTPONED' ? t('match.statusPostponed')
    : s === 'CANCELLED' ? t('match.statusCancelled')
    : t('match.statusScheduled');

  const lineupTeams = [teams.home, teams.away].filter((t): t is TeamDetail => !!t && Array.isArray(t.players) && t.players.length > 0);
  const homeForm = teams.home ? formFor(teams.home.id, teams.home.matches ?? []) : [];
  const awayForm = teams.away ? formFor(teams.away.id, teams.away.matches ?? []) : [];

  return (
    <div className="page fade-up">
      {/* reading content constrained for legibility; lineups grid below goes full width */}
      <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <button className="chip mt-4" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> {t('common.back')}</button>

      {/* hero */}
      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between">
          <span className="badge badge-muted">{roundShort(m.round, m.group, t('round.groupPrefix'))}</span>
          {live ? <span className="badge badge-magenta"><span className="live-dot"></span>{t('match.live')}</span>
            : fin ? <span className="badge badge-muted">{t('match.fullTime')}</span>
              : <span className="badge badge-sky"><LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz /></span>}
        </div>
        <div className="row between" style={{ marginTop: 20, alignItems: 'flex-start' }}>
          <TeamHero t={m.home} rank={teams.home?.fifaRank} />
          <div style={{ textAlign: 'center', paddingTop: 10 }}>
            {(live || fin) && hs != null
              ? <div className="display tnum" style={{ fontSize: 48 }}>{hs}<span className="muted" style={{ fontSize: 28, padding: '0 8px' }}>:</span>{as}</div>
              : <div className="display muted" style={{ fontSize: 32 }}>{t('match.vs')}</div>}
            {fin && m.result && <div className="tiny mt-4 text-gold">{t('match.resultPrefix')} {m.result === '1' ? m.home?.code : m.result === '2' ? m.away?.code : t('betslip.draw')}</div>}
          </div>
          <TeamHero t={m.away} rank={teams.away?.fifaRank} />
        </div>
      </div>

      {/* info strip (real) */}
      <div className="card card-pad mt-16">
        <div className="grid-auto" style={{ '--col-min': '150px', '--gap': '12px' } as React.CSSProperties}>
          <InfoCell label={t('match.kickoff')} value={<LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz />} />
          <InfoCell label={t('match.roundLabel')} value={roundShort(m.round, m.group, t('round.groupPrefix'))} />
          <InfoCell label={t('match.venue')} value={m.venue?.name ? `${m.venue.name}${m.venue.city ? `, ${m.venue.city}` : ''}${m.venue.country ? `, ${m.venue.country}` : ''}` : '—'} />
          <InfoCell label={t('match.status')} value={statusLabel(m.status)} />
        </div>
      </div>

      {/* odds + bet */}
      {cells.length > 0 && (
        <div className="card card-pad mt-16">
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="eyebrow">{t('match.matchOdds')}</span>
            {open ? <span className="tiny muted">{t('match.locksAtKickoff')}</span> : <span className="tiny text-danger row gap-4"><Icon name="lock" size={12} /> {t('match.bettingClosed')}</span>}
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
                  <div className="small">{t('match.yourBet')} <b>{b.pick}</b> · <span className="tnum">{b.stake}</span> pts @ <span className="tnum">{b.odds.toFixed(2)}</span></div>
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
          <p className="small muted">{t('match.signInInplay')}</p>
        </div>
      )}

      {/* recent form (real — last finished results) */}
      {(homeForm.length > 0 || awayForm.length > 0) && (
        <div className="card card-pad mt-16">
          <span className="eyebrow">{t('match.recentForm')}</span>
          <div className="stack gap-10 mt-12">
            <FormRow name={m.home?.name ?? t('betslip.home')} form={homeForm} />
            <FormRow name={m.away?.name ?? t('betslip.away')} form={awayForm} />
          </div>
        </div>
      )}

      {/* AI Pundit (inline section) */}
      <div className="mt-16"><PunditPanel m={m} /></div>
      </div>{/* end constrained reading content */}

      {/* Lineups — both teams side-by-side (same as admin), full page width */}
      <div className="mt-16">
        <div className="eyebrow" style={{ marginBottom: 12 }}>{t('match.lineups')}</div>
        {lineupTeams.length > 0
          ? (
            <>
              <p className="tiny muted" style={{ marginBottom: 12 }}>{t('match.lineupsHint')}</p>
              <div className="grid-auto" style={{ '--col-min': '300px', '--gap': '16px' } as React.CSSProperties}>
                {lineupTeams.map((tm, i) => (
                  <div key={i}>
                    <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{tm.name}</div>
                    <FormationPitch players={tm.players} formation={tm.formation} manager={tm.manager} />
                  </div>
                ))}
              </div>
            </>
          )
          : <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">{t('match.lineupsEmpty')}</p></div>}
      </div>

      {slip && <MatchBetSlip match={m} pick={slip.pick} oddsVal={slip.oddsVal} balance={s.points} busy={sending} onClose={() => setSlip(null)} onConfirm={confirm} />}
    </div>
  );
}

function TeamHero({ t, rank }: { t: RealTeam | null; rank?: number | null }) {
  const { t: tr } = useT();
  return (
    <div className="stack center gap-8" style={{ width: 120 }}>
      <Flag flagUrl={t?.flagUrl ?? undefined} name={t?.name} code={t?.code ?? undefined} size={56} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{t?.name ?? tr('match.tbd')}</div>
        {rank != null ? <div className="tiny muted">{tr('match.fifaRank', { rank })}</div> : t?.code ? <div className="tiny muted">{t.code}</div> : null}
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

function InfoCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="tiny muted">{label}</div>
      <div className="small" style={{ fontWeight: 600, marginTop: 2 }}>{value}</div>
    </div>
  );
}

function FormRow({ name, form }: { name: string; form: ('W' | 'D' | 'L')[] }) {
  const { t } = useT();
  const color = (r: string) => r === 'W' ? 'var(--green)' : r === 'L' ? 'var(--danger)' : 'var(--text-2)';
  const bg = (r: string) => r === 'W' ? 'var(--green-soft)' : r === 'L' ? 'var(--danger-soft)' : 'var(--surface-3)';
  return (
    <div className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
      <span className="small ellip" style={{ fontWeight: 600 }}>{name}</span>
      {form.length > 0
        ? <div className="row gap-6">{form.map((r, i) => <span key={i} className="badge" style={{ width: 24, justifyContent: 'center', background: bg(r), color: color(r) }}>{r}</span>)}</div>
        : <span className="tiny muted">{t('match.noResults')}</span>}
    </div>
  );
}

/* ---- AI Pundit panel ---- */
function PunditPanel({ m }: { m: RealMatch }) {
  const { t } = useT();
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
            <span className="badge badge-sky">{t('match.oraPreview')}</span>
            {provider && <span className="tiny muted">{t('match.aiAssisted', { provider })}</span>}
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
            : err ? <p className="t2 small mt-8 muted">{t('match.previewUnavailable')}</p>
              : <p className="t2 small mt-8 muted">{t('match.generatingPreview')}</p>}
        </div>
      </div>
    </div>
  );
}
