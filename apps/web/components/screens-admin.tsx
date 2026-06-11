'use client';
/* GOLAZO — Admin console (ported from screens-admin.jsx) */
import React, { useState, useEffect, useCallback } from 'react';
import { WC } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Avatar, SecHead, Portal } from '@/components/ui';
import { FormationPitch } from '@/components/formation-pitch';
import { LocalTime } from '@/components/local-time';

/* -------- real match shape for tournament admin (GET /api/v1/matches) -------- */
interface AdmMatchTeam { id: number; name: string; code: string | null; flagUrl: string | null }
interface AdmMatch {
  id: number; round: string; group: string | null; status: string; kickoffAt: string;
  home: AdmMatchTeam | null; away: AdmMatchTeam | null;
  scoreHome: number | null; scoreAway: number | null; result: string | null;
  odds: { mHome: number; mDraw: number; mAway: number } | null; bettingLocked: boolean;
}

/* -------- admin team management (real /api/v1 data) -------- */
interface AdmTeamRow { id: number; name: string; code: string | null; flagUrl: string | null; group: string | null; playerCount: number }
interface AdmTeamPlayer { name: string; position: string | null; number: number | null; starter?: boolean }
interface AdmTeamDetailData { id: number; name: string; code: string | null; flagUrl: string | null; group: string | null; formation: string | null; manager: string | null; players: AdmTeamPlayer[] }

/* -------- local types -------- */
type DetailKind = 'user' | 'risk' | 'match' | 'team' | 'news';
type Detail = { kind: DetailKind; id: number } | null;

type AdminUser = typeof WC.adminUsers[number];
type RiskLobby = typeof WC.riskLobbies[number];
type ReviewItem = typeof WC.reviewQueue[number];

/* -------- helpers -------- */
function KPI({ v, l, c, sub }: { v: React.ReactNode; l: string; c: string; sub?: string }) {
  return (
    <div className="card card-pad">
      <div className="display tnum" style={{ fontSize: 30, color: c }}>{v}</div>
      <div className="s-lbl" style={{ marginTop: 4 }}>{l}</div>
      {sub && <div className="tiny" style={{ color: c, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function JobDot({ st }: { st: string }) {
  const c = st === 'ok' ? 'var(--green)' : st === 'fallback' ? 'var(--gold)' : 'var(--danger)';
  return <span className="dot" style={{ background: c, boxShadow: `0 0 8px ${c}` }} />;
}

/* ===================== ADMIN (main export) ===================== */
export function Admin({ s }: ScreenProps) {
  const [tab, setTab] = useState('overview');
  const [detail, setDetail] = useState<Detail>(null);
  const [users, setUsers] = useState<AdminUser[]>(WC.adminUsers);
  const loadUsers = () =>
    fetch('/api/v1/admin/users')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setUsers(j.data); })
      .catch(() => {});
  useEffect(() => { void loadUsers(); }, []);

  const open = (kind: DetailKind, id: number) => { setDetail({ kind, id }); window.scrollTo(0, 0); };
  const closeDetail = () => setDetail(null);
  const nav: [string, string, string][] = [
    ['overview', 'Overview', 'gauge'],
    ['tourney', 'Tournament', 'calendar'],
    ['teams', 'Teams & groups', 'flag'],
    ['users', 'Users', 'users'],
    ['risk', 'Lobby risk', 'shield'],
    ['review', 'News', 'news'],
    ['pipeline', 'AI pipeline', 'database'],
    ['jobs', 'Schedule jobs', 'clock'],
    ['audit', 'Audit log', 'lock'],
  ];
  const goTab = (k: string) => { setTab(k); setDetail(null); };

  return (
    <div style={{ minHeight: '100vh', position: 'relative', zIndex: 1, display: 'flex' }}>
      {/* admin rail */}
      <div className="hide-mobile" style={{ width: 230, borderRight: '1px solid var(--line)', background: 'var(--bg-2)', padding: 18, position: 'sticky', top: 0, height: '100vh' }}>
        <div className="row gap-8" style={{ marginBottom: 20 }}>
          <Icon name="shield" size={22} style={{ color: 'var(--green)' }} />
          <span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Admin</span>
        </div>
        <div className="stack gap-4">
          {nav.map(([k, l, ic]) => (
            <button key={k} className={`nav-i ${tab === k ? 'active' : ''}`} onClick={() => goTab(k)}>
              <Icon name={ic} size={18} />{l}
            </button>
          ))}
        </div>
        <div style={{ marginTop: 'auto', position: 'absolute', bottom: 18, left: 18, right: 18 }}>
          <Btn variant="ghost" size="sm" className="btn-block" icon="chevL" onClick={() => s.go('home')}>Back to app</Btn>
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="topbar">
          <div className="row gap-12">
            <span className="badge badge-green">Admin Console</span>
            <span className="small muted hide-mobile">Signed in as {s.me.name} · {s.role === 'MOD' ? 'Moderator' : s.role === 'SUPER' ? 'Super admin' : 'Admin'}</span>
          </div>
          <button className="chip only-mobile" onClick={() => s.go('home')}>Exit</button>
        </div>
        {/* mobile tab strip */}
        <div className="only-mobile row gap-8" style={{ padding: 12, overflowX: 'auto', borderBottom: '1px solid var(--line)' }}>
          {nav.map(([k, l]) => (
            <button key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => goTab(k)}>{l}</button>
          ))}
        </div>

        <div className="page fade-up" key={detail ? detail.kind + detail.id : tab}>
          {detail?.kind === 'user' && <AdmUserDetail id={detail.id} users={users} reload={loadUsers} onBack={closeDetail} s={s} />}
          {detail?.kind === 'risk' && <AdmRiskDetail id={detail.id} onBack={closeDetail} s={s} />}
          {detail?.kind === 'match' && <AdmMatchDetail id={detail.id} onBack={closeDetail} s={s} />}
          {detail?.kind === 'team' && <AdmTeamDetail id={detail.id} onBack={closeDetail} s={s} />}
          {detail?.kind === 'news' && <AdmNewsDetail id={detail.id} onBack={closeDetail} s={s} />}
          {!detail && tab === 'overview' && <AdmOverview s={s} setTab={goTab} open={open} />}
          {!detail && tab === 'tourney' && <AdmTourney s={s} open={open} />}
          {!detail && tab === 'teams' && <AdmTeams s={s} open={open} />}
          {!detail && tab === 'users' && <AdmUsers users={users} open={open} />}
          {!detail && tab === 'risk' && <AdmRisk open={open} />}
          {!detail && tab === 'review' && <AdmReview open={open} />}
          {!detail && tab === 'pipeline' && <AdmPipeline />}
          {!detail && tab === 'jobs' && <AdmJobs s={s} />}
          {!detail && tab === 'audit' && <AdmAudit />}
        </div>
      </div>
    </div>
  );
}

/* ===================== OVERVIEW ===================== */
interface OpsMetrics { betsToday: number; articlesPending: number; settled: number; totalUsers: number }

function AdmOverview({ s, setTab, open }: { s: ScreenProps['s']; setTab: (k: string) => void; open: (kind: DetailKind, id: number) => void }) {
  const [riskLobbies, setRiskLobbies] = useState<RiskLobby[]>([]);
  const [metrics, setMetrics] = useState<OpsMetrics | null>(null);
  useEffect(() => {
    fetch('/api/v1/admin/risk-flags')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setRiskLobbies(j.data); })
      .catch(() => {});
    fetch('/api/v1/admin/metrics')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data && typeof j.data.betsToday === 'number') setMetrics(j.data); })
      .catch(() => {});
  }, []);

  return (
    <div>
      <SecHead title="Operations overview" sub="Matchday · live platform health" />
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <KPI v={metrics ? metrics.betsToday.toLocaleString() : '—'} l="Bets placed today" c="var(--green)" />
        <KPI v={riskLobbies.length} l="Open risk flags" c="var(--danger)" />
        <KPI v={metrics ? metrics.articlesPending : '—'} l="Articles pending" c="var(--gold)" />
        <KPI v={metrics ? metrics.settled.toLocaleString() : '—'} l="Bets settled" c="var(--sky)" />
      </div>

      <div className="grid gap-16 mt-24" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        <div>
          <SecHead title="Risk queue" sub="Lobbies auto-flagged for review" action={<button className="chip" onClick={() => setTab('risk')}>Open all →</button>} />
          <div className="stack gap-10">
            {riskLobbies.length === 0
              ? <p className="tiny muted">No open risk flags.</p>
              : riskLobbies.map(r => <RiskRow key={r.id} r={r} open={open} />)}
          </div>
        </div>
        <div>
          <SecHead title="Pipeline status" action={<button className="chip" onClick={() => setTab('pipeline')}>Details →</button>} />
          <div className="card card-pad">
            <p className="tiny muted">No jobs yet.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskRow({ r, open }: { r: RiskLobby; open?: (kind: DetailKind, id: number) => void }) {
  const c = r.risk === 'High' ? 'danger' : r.risk === 'Medium' ? 'gold' : 'muted';
  return (
    <div className="card card-pad" style={{ borderColor: r.risk === 'High' ? 'rgba(255,90,101,.35)' : 'var(--line)' }}>
      <div className="row between">
        <div className="row gap-10">
          <Icon name="alert" size={18} style={{ color: `var(--${c === 'muted' ? 'muted' : c})` }} />
          <span className="mono small" style={{ fontWeight: 700 }}>{r.name}</span>
          <span className="tiny muted">{r.members} members</span>
        </div>
        <span className={`badge badge-${c}`}>{r.risk} · {r.score}</span>
      </div>
      <div className="row gap-6 wrap-w mt-12">
        {r.reasons.map((x, i) => <span key={i} className="chip chip-sm">{x}</span>)}
      </div>
      <div className="row gap-8 mt-12">
        <Btn variant="ghost" size="sm" icon="eye" onClick={() => open && open('risk', r.id)}>Investigate</Btn>
        <span className="tiny muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>Flagged {r.flagged}</span>
      </div>
    </div>
  );
}

/* ===================== TOURNAMENT MANAGEMENT ===================== */

function AdmTourney({ s, open }: { s: ScreenProps['s']; open: (kind: DetailKind, id: number) => void }) {
  const [matches, setMatches] = useState<AdmMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState<AdmMatch | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetText, setResetText] = useState('');
  const [resetting, setResetting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [view, setView] = useState<'groups' | 'knockouts'>('groups');
  const [q, setQ] = useState('');

  const doSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/v1/admin/matches/sync', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      setSyncing(false);
      if (res.ok) { s.toastMsg(`Matches synced · ${j.data?.created ?? 0} new, ${j.data?.updated ?? 0} updated, ${j.data?.skipped ?? 0} skipped`, 'refresh', 'var(--green)'); load(); }
      else s.toastMsg('Match sync failed', 'alert', 'var(--danger)');
    } catch { setSyncing(false); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const doReset = async () => {
    if (resetText !== 'RESET' || resetting) return;
    setResetting(true);
    try {
      const res = await fetch('/api/v1/admin/reset', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ confirm: 'RESET' }) });
      const j = await res.json().catch(() => ({}));
      setResetting(false);
      if (res.ok) { s.toastMsg(`Reset done · ${j.data?.matchesReset ?? 0} matches, ${j.data?.predictionsCleared ?? 0} bets cleared`, 'refresh', 'var(--green)'); setResetOpen(false); setResetText(''); load(); }
      else s.toastMsg('Reset failed', 'alert', 'var(--danger)');
    } catch { setResetting(false); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null)).then(j => setMatches(j?.data ?? [])).catch(() => { /* keep */ }).finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts: Record<string, number> = {
    all: matches.length,
    LIVE: matches.filter(m => m.status === 'LIVE').length,
    SCHEDULED: matches.filter(m => m.status === 'SCHEDULED').length,
    FINISHED: matches.filter(m => m.status === 'FINISHED').length,
  };
  const ql = q.trim().toLowerCase();
  const matchText = (m: AdmMatch) => `${m.home?.code ?? ''} ${m.home?.name ?? ''} ${m.away?.code ?? ''} ${m.away?.name ?? ''}`.toLowerCase();
  const filtered = matches.filter(m => (filter === 'all' || m.status === filter) && (!ql || matchText(m).includes(ql)));
  const byKickoff = (a: AdmMatch, b: AdmMatch) => new Date(a.kickoffAt).getTime() - new Date(b.kickoffAt).getTime();

  // Group view: GROUP-stage matches bucketed by group letter (A–L).
  const groupLetters = [...new Set(filtered.filter(m => m.round === 'GROUP' && m.group).map(m => m.group as string))].sort();
  const groupBuckets = groupLetters.map(g => ({ key: g, label: `Group ${g}`, items: filtered.filter(m => m.round === 'GROUP' && m.group === g).sort(byKickoff) }));
  // Knockout view: non-GROUP matches bucketed by round, in bracket order.
  const KO_ROUNDS: [string, string][] = [['R32', 'Round of 32'], ['R16', 'Round of 16'], ['QF', 'Quarter-finals'], ['SF', 'Semi-finals'], ['THIRD', 'Third place'], ['FINAL', 'Final']];
  const koBuckets = KO_ROUNDS.map(([k, label]) => ({ key: k, label, items: filtered.filter(m => m.round === k).sort(byKickoff) })).filter(b => b.items.length);
  const buckets = view === 'groups' ? groupBuckets : koBuckets;

  const toggleLock = async (m: AdmMatch) => {
    try {
      const res = await fetch(`/api/v1/admin/matches/${m.id}/lock-betting`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locked: !m.bettingLocked }) });
      if (res.ok) { s.toastMsg(m.bettingLocked ? 'Betting re-opened' : 'Betting blocked', m.bettingLocked ? 'check' : 'lock', m.bettingLocked ? 'var(--green)' : 'var(--danger)'); load(); }
      else s.toastMsg('Could not change betting', 'alert', 'var(--danger)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  const confirmResult = async (id: number, hs: number, as_: number, reason: string) => {
    try {
      const res = await fetch(`/api/v1/admin/matches/${id}/resettle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ home: hs, away: as_, reason }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { s.toastMsg(`Result confirmed · ${j.data.settledCount} bets settled`, 'trophy', 'var(--green)'); setEdit(null); load(); }
      else s.toastMsg('Could not confirm result', 'alert', 'var(--danger)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const filterTabs: [string, string][] = [['all', 'All'], ['LIVE', 'Live'], ['SCHEDULED', 'Scheduled'], ['FINISHED', 'Settled']];

  const statusBadge = (m: AdmMatch) =>
    m.status === 'LIVE' ? <span className="badge badge-magenta"><span className="live-dot" />LIVE</span>
      : m.status === 'FINISHED' ? <span className="badge badge-green">FT</span>
        : <span className="badge badge-muted">Scheduled</span>;

  const renderCard = (m: AdmMatch) => (
    <div key={m.id} className="card card-pad pointer" onClick={() => open('match', m.id)} title="Open match detail">
      <div className="row between gap-8">
        <div className="row gap-6" style={{ minWidth: 0 }}>
          {m.home && <Flag flagUrl={m.home.flagUrl ?? undefined} name={m.home.name} code={m.home.code ?? undefined} size={18} />}
          <span className="small nowrap" style={{ fontWeight: 600 }}>{m.home?.code ?? 'TBD'} v {m.away?.code ?? 'TBD'}</span>
          {m.away && <Flag flagUrl={m.away.flagUrl ?? undefined} name={m.away.name} code={m.away.code ?? undefined} size={18} />}
        </div>
        {statusBadge(m)}
      </div>
      <div className="row center mt-8"><span className="tnum h3">{m.scoreHome ?? '–'} : {m.scoreAway ?? '–'}</span></div>
      {m.status === 'SCHEDULED' && <div className="row center tiny muted mt-4"><LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz /></div>}
      <div className="row center tiny t2 tnum mt-4">{m.odds ? `${m.odds.mHome.toFixed(2)} · ${m.odds.mDraw.toFixed(2)} · ${m.odds.mAway.toFixed(2)}` : '—'}</div>
      <div className="row between mt-12" onClick={e => e.stopPropagation()}>
        <button className="chip chip-sm" onClick={() => toggleLock(m)} style={{ gap: 5 }}>
          <Icon name={m.bettingLocked ? 'lock' : 'check'} size={12} style={{ color: m.bettingLocked ? 'var(--danger)' : 'var(--green)' }} />
          {m.bettingLocked ? 'Blocked' : 'Open'}
        </button>
        <Btn variant="primary" size="sm" icon="check" onClick={() => setEdit(m)}>{m.status === 'FINISHED' ? 'Re-settle' : 'Confirm'}</Btn>
      </div>
    </div>
  );

  return (
    <div>
      <SecHead title="Tournament management" sub="Fixtures, scores, settlement & betting controls" action={<div className="row gap-8">
        <Btn variant="primary" size="sm" icon="refresh" onClick={doSync} disabled={syncing}>{syncing ? 'Syncing…' : 'Sync matches'}</Btn>
        <Btn variant="danger" size="sm" icon="refresh" onClick={() => { setResetText(''); setResetOpen(true); }}>Reset data</Btn>
      </div>} />

      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 18 }}>
          <KPI v={counts.all} l="Total fixtures" c="var(--text)" />
          <KPI v={counts.LIVE} l="Live now" c="var(--magenta)" />
          <KPI v={counts.SCHEDULED} l="Scheduled" c="var(--sky)" />
          <KPI v={counts.FINISHED} l="Settled" c="var(--green)" />
        </div>

        <div className="row between wrap-w gap-12" style={{ marginBottom: 16 }}>
          <div className="row gap-8 wrap-w">
            <button className={`chip ${view === 'groups' ? 'active' : ''}`} onClick={() => setView('groups')}>Groups</button>
            <button className={`chip ${view === 'knockouts' ? 'active' : ''}`} onClick={() => setView('knockouts')}>Knockouts</button>
            <span style={{ width: 1, alignSelf: 'stretch', background: 'var(--line)', margin: '0 4px' }} />
            {filterTabs.map(([k, l]) => (
              <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>
            ))}
          </div>
          <input className="input" style={{ maxWidth: 220 }} placeholder="Search team…" value={q} onChange={e => setQ(e.target.value)} />
        </div>

        {loading ? <p className="small muted" style={{ padding: 16 }}>Loading fixtures…</p>
          : buckets.length === 0 ? <p className="tiny muted" style={{ padding: 16 }}>No matches{ql ? ' match your search' : ' in this view'}.</p>
            : <div className="stack gap-20">
                {buckets.map(b => (
                  <div key={b.key}>
                    <div className="row gap-8" style={{ marginBottom: 10 }}>
                      <span className="eyebrow">{b.label}</span>
                      <span className="tiny muted">{b.items.length} {b.items.length === 1 ? 'match' : 'matches'}</span>
                    </div>
                    <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))' }}>
                      {b.items.map(m => renderCard(m))}
                    </div>
                  </div>
                ))}
              </div>}
        <div className="card-2 card-pad mt-12 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)' }}>
          <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none' }} />
          <span>Confirming a result settles all bets (global + lobby) and is idempotent — re-confirming never double-pays. Blocking betting takes effect server-side immediately.</span>
        </div>

      {edit && <ScoreEditModal id={edit.id} homeLabel={edit.home?.code ?? 'Home'} awayLabel={edit.away?.code ?? 'Away'} sub={`${edit.round} · ${new Date(edit.kickoffAt).toLocaleDateString()}`} hs={edit.scoreHome ?? 0} as={edit.scoreAway ?? 0} onClose={() => setEdit(null)} onSave={confirmResult} />}

      {resetOpen && (
        <Portal><div className="overlay" onClick={() => setResetOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="card-pad-lg">
              <div className="row between"><span className="eyebrow text-danger">Reset tournament data</span><button className="btn-icon" onClick={() => setResetOpen(false)}><Icon name="x" size={18} /></button></div>
              <div className="card-2 card-pad mt-12 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)', borderColor: 'rgba(255,90,101,.35)' }}>
                <Icon name="alert" size={16} style={{ color: 'var(--danger)', flex: 'none', marginTop: 2 }} />
                <span>Wipes <b>all bets, settlements, point history, stats, parlays & duels</b>, returns every match to SCHEDULED (scores cleared, betting reopened), and resets every global wallet to 1,000 pts. Users, teams, lobbies & news are kept. <b>This cannot be undone.</b></span>
              </div>
              <div className="field mt-16"><label className="label">Type <b>RESET</b> to confirm</label><input className="input" value={resetText} onChange={(e) => setResetText(e.target.value)} placeholder="RESET" /></div>
              <Btn variant="danger" size="lg" className="btn-block mt-16" disabled={resetText !== 'RESET' || resetting} onClick={doReset}>{resetting ? 'Resetting…' : 'Reset all tournament data'}</Btn>
            </div>
          </div>
        </div></Portal>
      )}
    </div>
  );
}

function ScoreEditModal({ id, homeLabel, awayLabel, sub, hs: hs0, as: as0, onClose, onSave }: { id: number; homeLabel: string; awayLabel: string; sub: string; hs: number; as: number; onClose: () => void; onSave: (id: number, hs: number, as_: number, reason: string) => void }) {
  const [hs, setHs] = useState(hs0);
  const [as, setAs] = useState(as0);
  const [reason, setReason] = useState('');
  return (
    <Portal><div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between">
            <span className="eyebrow">Confirm / override result</span>
            <button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button>
          </div>
          <div className="tiny muted mt-4">{sub}</div>
          <div className="row between center gap-12 mt-16">
            <div className="stack center gap-8" style={{ flex: 1 }}>
              <span className="small" style={{ fontWeight: 700 }}>{homeLabel}</span>
              <input className="input input-mono" type="number" min="0" value={hs} onChange={e => setHs(Math.max(0, +e.target.value || 0))} style={{ textAlign: 'center', fontSize: 22, width: 70 }} />
            </div>
            <span className="display muted" style={{ fontSize: 24 }}>:</span>
            <div className="stack center gap-8" style={{ flex: 1 }}>
              <span className="small" style={{ fontWeight: 700 }}>{awayLabel}</span>
              <input className="input input-mono" type="number" min="0" value={as} onChange={e => setAs(Math.max(0, +e.target.value || 0))} style={{ textAlign: 'center', fontSize: 22, width: 70 }} />
            </div>
          </div>
          <div className="field mt-16">
            <label className="label">Reason (required for audit)</label>
            <input className="input" placeholder="e.g. final score / VAR correction" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <Btn variant="gold" size="lg" className="btn-block mt-16" disabled={!reason.trim()} onClick={() => onSave(id, hs, as, reason)}>Confirm result & settle bets</Btn>
        </div>
      </div>
    </div></Portal>
  );
}

function AdmTeams({ s, open }: { s: ScreenProps['s']; open: (kind: DetailKind, id: number) => void }) {
  const [teams, setTeams] = useState<AdmTeamRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncingAll, setSyncingAll] = useState(false);
  useEffect(() => {
    fetch('/api/v1/teams').then((r) => (r.ok ? r.json() : null)).then((j) => setTeams(j?.data ?? [])).catch(() => { /* keep [] */ }).finally(() => setLoading(false));
  }, []);

  async function syncAllSquads() {
    setSyncingAll(true);
    try {
      const res = await fetch('/api/v1/admin/teams/sync-all', { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        const { teams: t, players: p, unmatched: u } = j.data ?? {};
        const note = u?.length ? ` · ${u.length} unmatched` : '';
        s.toastMsg(`Squads synced · teams ${t ?? 0} / players ${p ?? 0}${note}`, 'refresh', 'var(--green)');
      } else {
        s.toastMsg(j?.error?.code === 'NO_API_KEY' ? 'Football-data API key not configured' : 'Sync failed', 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
    finally { setSyncingAll(false); }
  }

  async function enrichAllLineups() {
    try {
      await fetch('/api/v1/admin/schedule-jobs/enrich_lineups/trigger', { method: 'POST' });
      s.toastMsg('Lineup enrichment started (runs in the worker)', 'refresh', 'var(--green)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  }

  const groupCount = new Set(teams.map((t) => t.group).filter(Boolean)).size;
  const squadsLoaded = teams.filter((t) => t.playerCount > 0).length;
  const totalPlayers = teams.reduce((n, t) => n + t.playerCount, 0);

  // organise teams by their group so membership is obvious (instead of a flat 48-row table)
  const byGroup = new Map<string, AdmTeamRow[]>();
  for (const t of teams) { const g = t.group ?? '—'; const arr = byGroup.get(g) ?? (byGroup.set(g, []), byGroup.get(g)!); arr.push(t); }
  const groupSections = [...byGroup.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div>
      <SecHead title="Teams & groups" sub="48 teams · squads AI-crawled · tap a team to edit info or re-crawl its squad" action={<div className="row gap-8"><Btn variant="primary" size="sm" icon="refresh" onClick={syncAllSquads} disabled={syncingAll}>{syncingAll ? 'Syncing…' : 'Sync all squads (API)'}</Btn><Btn variant="ghost" size="sm" onClick={enrichAllLineups}>Assign roles & XI — all teams</Btn></div>} />
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 18 }}>
        <KPI v={teams.length} l="Teams" c="var(--text)" />
        <KPI v={groupCount} l="Groups" c="var(--sky)" />
        <KPI v={`${squadsLoaded}/${teams.length || 0}`} l="Squads loaded" c="var(--gold)" />
        <KPI v={totalPlayers} l="Players" c="var(--green)" />
      </div>
      {loading
        ? <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Loading teams…</p></div>
        : (
          <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
            {groupSections.map(([g, ts]) => (
              <div key={g} className="card card-pad">
                <div className="row between" style={{ marginBottom: 10 }}>
                  <span className="eyebrow">{g === '—' ? 'No group' : `Group ${g}`}</span>
                  <span className="tiny muted">{ts.length} teams</span>
                </div>
                <div className="stack gap-4">
                  {ts.map((t) => (
                    <button key={t.id} className="row between full pointer" onClick={() => open('team', t.id)}
                      style={{ background: 'transparent', textAlign: 'left', padding: '7px 4px', borderRadius: 'var(--r-sm)' }}>
                      <div className="row gap-8" style={{ minWidth: 0 }}>
                        <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={20} />
                        <span className="small ellip" style={{ fontWeight: 600 }}>{t.name}</span>
                      </div>
                      <div className="row gap-6">
                        {t.playerCount > 0 ? <span className="badge badge-green">{t.playerCount}</span> : <span className="badge badge-muted">—</span>}
                        <Icon name="chevR" size={14} className="muted" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

/* ===================== USERS (list) ===================== */
function AdmUsers({ users, open }: { users: AdminUser[]; open: (kind: DetailKind, id: number) => void }) {
  return (
    <div>
      <SecHead title="User management" sub="Search, inspect sessions, ban abusers" />
      <div className="row gap-8 card card-pad" style={{ marginBottom: 14, borderRadius: 'var(--r-pill)', maxWidth: 360 }}>
        <Icon name="search" size={16} className="muted" />
        <input className="input" style={{ border: 0, background: 'transparent', padding: '4px 0' }} placeholder="Search email, username, IP" />
      </div>
      {users.length === 0
        ? <p className="tiny muted">No users.</p>
        : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>User</th>
                  <th className="hide-mobile">IP</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                  <th style={{ textAlign: 'center' }}>Flags</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((u, i) => (
                  <tr key={i} style={{ cursor: 'pointer' }} onClick={() => open('user', i)}>
                    <td>
                      <div className="row gap-10">
                        <Avatar initials={u.name.slice(0, 2).toUpperCase()} size={28} color={u.status === 'banned' ? 'var(--danger)' : 'var(--sky)'} />
                        <div>
                          <div className="small" style={{ fontWeight: 600 }}>{u.name}</div>
                          <div className="tiny muted">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="tnum tiny t2 hide-mobile">{u.ip}</td>
                    <td className="tnum" style={{ textAlign: 'right' }}>{u.pts.toLocaleString()}</td>
                    <td style={{ textAlign: 'center' }}>
                      {u.flags ? <span className="badge badge-danger">{u.flags}</span> : <span className="muted">—</span>}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span className={`badge badge-${u.status === 'active' ? 'green' : u.status === 'banned' ? 'danger' : 'gold'}`}>{u.status}</span>
                    </td>
                    <td style={{ textAlign: 'right' }}><Icon name="chevR" size={16} className="muted" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <p className="tiny muted mt-12">Note: 3 accounts share IP 113.161.x.x — auto-grouped as a possible multi-account cluster. Tap any row to inspect.</p>
    </div>
  );
}

/* ===================== USER DETAIL ===================== */
interface UserDetailData {
  id: number; email: string; name: string; role: string; status: string; joined: string;
  balance: number; winRate: number | null; roi: number | null; settled: number; won: number;
  ledger: { type: string; amount: number; balanceAfter: number; when: string }[];
  bets: { matchId: number; pick: string; stake: number; odds: number; status: string }[];
}

function AdmUserDetail({ id, users, reload, onBack, s }: { id: number; users: AdminUser[]; reload: () => void | Promise<void>; onBack: () => void; s: ScreenProps['s'] }) {
  const u = users[id];
  const [status, setStatus] = useState(u?.status);
  const realId = (u as { id?: number } | undefined)?.id;
  const [detail, setDetail] = useState<UserDetailData | null>(null);
  const [bmap, setBmap] = useState<Map<number, { home: { code: string | null; name: string; flagUrl: string | null } | null; away: { code: string | null; name: string; flagUrl: string | null } | null }>>(new Map());

  useEffect(() => {
    if (realId == null) return;
    fetch(`/api/v1/admin/users/${realId}`).then(r => (r.ok ? r.json() : null)).then(j => setDetail(j?.data ?? null)).catch(() => {});
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => setBmap(new Map(((j?.data ?? []) as { id: number; home: { code: string | null; name: string; flagUrl: string | null } | null; away: { code: string | null; name: string; flagUrl: string | null } | null }[]).map(m => [m.id, { home: m.home, away: m.away }]))))
      .catch(() => {});
  }, [realId]);

  if (!u) {
    return (
      <div>
        <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to users</button>
        <p className="small muted">User not found.</p>
      </div>
    );
  }
  const flagged = u.flags > 0;
  // Real users carry no captured IP yet ('—'); only cluster on a concrete shared IP.
  const cluster = u.ip && u.ip !== '—' ? users.filter((x, i) => i !== id && x.ip === u.ip) : [];
  const initials = u.name.slice(0, 2).toUpperCase();

  const act = (msg: string, icon: string, color: string) => s.toastMsg(msg, icon, color);
  const banUser = async () => {
    if (realId != null) {
      try { await fetch(`/api/v1/admin/users/${realId}/ban`, { method: 'POST' }); await reload(); }
      catch { /* keep optimistic state */ }
    }
    setStatus('banned');
    act(`${u.name} banned`, 'ban', 'var(--danger)');
  };

  return (
    <div>
      <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to users</button>

      {flagged && (
        <div className="card card-pad mb-12 row gap-10" style={{ background: 'var(--danger-soft)', borderColor: 'rgba(255,90,101,.35)', marginBottom: 16 }}>
          <Icon name="alert" size={18} style={{ color: 'var(--danger)' }} />
          <span className="small"><b>{u.flags} active flags</b> · part of a {cluster.length + 1}-account cluster on shared IP {u.ip}. Review before taking action.</span>
        </div>
      )}

      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between wrap gap-16">
          <div className="row gap-16">
            <Avatar initials={initials} size={60} color={status === 'banned' ? 'var(--danger)' : 'var(--sky)'} />
            <div>
              <div className="row gap-8">
                <span className="h3">{u.name}</span>
                <span className={`badge badge-${status === 'active' ? 'green' : status === 'banned' ? 'danger' : 'gold'}`}>{status}</span>
              </div>
              <div className="tiny muted mt-4">{u.email} · joined {u.joined}</div>
              <div className="row gap-8 mt-8">
                <span className="badge badge-muted mono">{u.ip}</span>
                <span className="badge badge-muted">Chrome / Win</span>
              </div>
            </div>
          </div>
          <div className="row gap-8 wrap-w">
            <Btn variant="ghost" size="sm" icon="dollar" onClick={() => act('Point adjustment dialog', 'wallet', 'var(--gold)')}>Adjust points</Btn>
            <Btn variant="ghost" size="sm" icon="alert" onClick={() => act(`Warning sent to ${u.name}`, 'check', 'var(--gold)')}>Warn</Btn>
            {status === 'banned'
              ? <Btn variant="primary" size="sm" icon="refresh" onClick={() => { setStatus('active'); act('User reinstated', 'check', 'var(--green)'); }}>Unban</Btn>
              : <Btn variant="danger" size="sm" icon="ban" onClick={banUser}>Ban user</Btn>}
          </div>
        </div>
      </div>

      <div className="grid gap-12 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
        <KPI v={detail ? detail.balance.toLocaleString() : '—'} l="Point balance" c="var(--gold)" />
        <KPI v={detail?.winRate != null ? `${detail.winRate}%` : '—'} l="Win rate" c="var(--green)" />
        <KPI v={detail?.roi != null ? `${detail.roi >= 0 ? '+' : ''}${detail.roi}%` : '—'} l="ROI" c={detail && detail.roi != null && detail.roi < 0 ? 'var(--danger)' : 'var(--green)'} />
        <KPI v={detail ? detail.settled : '—'} l="Settled bets" c="var(--text)" />
      </div>

      <div className="grid gap-16 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <div className="card card-pad">
          <span className="eyebrow">Recent point activity</span>
          <div className="stack gap-10 mt-12">
            {(detail?.ledger ?? []).length === 0 && <p className="tiny muted">No point activity yet.</p>}
            {(detail?.ledger ?? []).map((x, i) => (
              <div key={i} className="row between small">
                <div><div className="t2">{x.type}</div><div className="tiny muted">{new Date(x.when).toLocaleString()}</div></div>
                <span className="tnum" style={{ fontWeight: 700, color: x.amount > 0 ? 'var(--green)' : 'var(--danger)' }}>{x.amount > 0 ? '+' : ''}{x.amount}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <span className="eyebrow">Recent bets</span>
          <div className="stack gap-10 mt-12">
            {(detail?.bets ?? []).length === 0 && <p className="tiny muted">No bets yet.</p>}
            {(detail?.bets ?? []).map((b, i) => {
              const mm = bmap.get(b.matchId);
              const bc = b.status === 'WON' ? 'green' : b.status === 'LOST' ? 'danger' : b.status === 'LIVE' ? 'magenta' : 'sky';
              return (
                <div key={i} className="row between">
                  <div className="row gap-8">
                    {mm?.home && <Flag flagUrl={mm.home.flagUrl ?? undefined} name={mm.home.name} code={mm.home.code ?? undefined} size={18} />}
                    <span className="small">{mm?.home?.code ?? '?'} v {mm?.away?.code ?? '?'}</span>
                    <span className="badge badge-muted">{b.pick}</span>
                  </div>
                  <div className="row gap-8">
                    <span className="tnum tiny t2">{b.stake}</span>
                    <span className={`badge badge-${bc}`}>{b.status}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="card card-pad" style={{ borderColor: cluster.length ? 'rgba(255,90,101,.3)' : 'var(--line)' }}>
          <span className="eyebrow">Linked accounts (same IP)</span>
          {cluster.length ? (
            <div className="stack gap-10 mt-12">
              {cluster.map((cx, i) => (
                <div key={i} className="row between">
                  <div className="row gap-8">
                    <Avatar initials={cx.name.slice(0, 2).toUpperCase()} size={26} color="var(--danger)" />
                    <span className="small">{cx.name}</span>
                  </div>
                  <span className="badge badge-danger">{cx.flags} flags</span>
                </div>
              ))}
              <span className="badge badge-danger" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Possible multi-account ring</span>
            </div>
          ) : <p className="tiny muted mt-12">No other accounts share this IP. Clean.</p>}
        </div>
      </div>
    </div>
  );
}

/* ===================== LOBBY RISK (list) ===================== */
function AdmRisk({ open }: { open: (kind: DetailKind, id: number) => void }) {
  const [flags, setFlags] = useState<RiskLobby[]>(WC.riskLobbies);
  const [scanning, setScanning] = useState(false);
  const loadFlags = () =>
    fetch('/api/v1/admin/risk-flags')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setFlags(j.data); })
      .catch(() => {});
  useEffect(() => { void loadFlags(); }, []);
  const runScan = async () => {
    setScanning(true);
    try { await fetch('/api/v1/admin/risk/scan', { method: 'POST' }); await loadFlags(); }
    catch { /* keep current flags */ }
    finally { setScanning(false); }
  };
  return (
    <div>
      <SecHead
        title="Lobby risk queue"
        sub="Lobbies auto-flagged by the abuse detector · tap to investigate"
        action={<Btn variant="ghost" size="sm" icon="search" onClick={runScan} disabled={scanning}>{scanning ? 'Scanning…' : 'Run scan'}</Btn>}
      />
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 18 }}>
        <KPI v={flags.length} l="Open cases" c="var(--danger)" />
        <KPI v={flags.filter(r => r.risk === 'High').length} l="High priority" c="var(--danger)" />
        <KPI v="14" l="Resolved (7d)" c="var(--green)" />
        <KPI v="2.1%" l="Flag rate" c="var(--sky)" />
      </div>
      <div className="stack gap-10">
        {flags.length === 0
          ? <p className="tiny muted">No open risk flags.</p>
          : flags.map(r => <RiskRow key={r.id} r={r} open={open} />)}
      </div>
    </div>
  );
}

/* ===================== LOBBY RISK DETAIL ===================== */
type InvestigationData = {
  lobby: { id: number; name: string; status: string; ownerId: number };
  flags: { id: number; rule: string; severity: string; status: string; reasons: string[] }[];
  members: { id: number; userId: number; email: string; username: string; role: string; borrowed: number; defaultPoints: number }[];
  pointFlow: { totalBorrowed: number; recentEntries: { userId: number; type: string; amount: number; createdAt: string }[] };
};

function AdmRiskDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const r = WC.riskLobbies.find(x => x.id === id) ?? null;
  const [resolved, setResolved] = useState<string | null>(null);
  const [inv, setInv] = useState<InvestigationData | null>(null);

  useEffect(() => {
    fetch(`/api/v1/admin/lobbies/${id}/investigation`)
      .then((res) => (res.ok ? res.json() : null))
      .then((j) => { if (j?.data) setInv(j.data); })
      .catch(() => {});
  }, [id]);

  if (!r && !inv) {
    return (
      <div>
        <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to risk queue</button>
        <p className="small muted">Lobby not found.</p>
      </div>
    );
  }

  const risk = r?.risk ?? 'Low';
  const score = r?.score ?? 0;
  const flagged = r?.flagged ?? '—';
  const rc = risk === 'High' ? 'danger' : risk === 'Medium' ? 'gold' : 'muted';

  // Use real data when available, fall back to mock
  const lobbyName = inv?.lobby.name ?? r?.name ?? 'Lobby';
  const memberCount = inv?.members.length ?? r?.members ?? 0;
  const reasons = inv?.flags[0]?.reasons ?? r?.reasons ?? [];
  const primaryFlagId = inv?.flags[0]?.id ?? null;
  const displayMembers = inv
    ? inv.members.map((m) => ({ name: m.username, role: m.role.toLowerCase(), borrowed: m.borrowed, flag: m.borrowed > 0 }))
    : [];

  const downloadEvidence = async () => {
    try {
      const res = await fetch(`/api/v1/admin/lobbies/${id}/case-file`, { method: 'POST' });
      if (!res.ok) { s.toastMsg('Could not export evidence', 'alert', 'var(--danger)'); return; }
      const j = await res.json();
      const evidence = j?.data?.evidence;
      if (evidence && typeof window !== 'undefined' && typeof Blob !== 'undefined') {
        const blob = new Blob([JSON.stringify(evidence, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `case-lobby-${id}.json`; a.click();
        URL.revokeObjectURL(url);
      }
      s.toastMsg('Evidence bundle exported', 'share', 'var(--sky)');
    } catch { s.toastMsg('Export failed', 'alert', 'var(--danger)'); }
  };

  const closeLobby = async () => {
    try {
      const res = await fetch(`/api/v1/admin/lobbies/${id}/close`, { method: 'POST' });
      if (res.ok) { setResolved('ban'); s.toastMsg('Lobby closed · flags resolved · logged', 'ban', 'var(--danger)'); }
      else s.toastMsg('Close failed', 'alert', 'var(--danger)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const escalateFlag = async () => {
    if (!primaryFlagId) { s.toastMsg('No open flag to escalate', 'alert', 'var(--gold)'); return; }
    try {
      const res = await fetch(`/api/v1/admin/risk-flags/${primaryFlagId}/escalate`, { method: 'POST' });
      if (res.ok) s.toastMsg('Flag escalated · logged', 'check', 'var(--gold)');
      else s.toastMsg('Escalate failed', 'alert', 'var(--danger)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const totalBorrowed = inv?.pointFlow.totalBorrowed ?? 0;
  const recentFlow = inv?.pointFlow.recentEntries ?? [];

  return (
    <div>
      <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to risk queue</button>

      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between wrap gap-12">
          <div>
            <div className="row gap-8">
              <Icon name="shield" size={18} style={{ color: `var(--${rc === 'muted' ? 'muted' : rc})` }} />
              <span className="mono h3">{lobbyName}</span>
            </div>
            <div className="tiny muted mt-4">{memberCount} members · flagged {flagged}</div>
          </div>
          <span className={`badge badge-${rc}`} style={{ fontSize: 13 }}>{risk} risk · {score}/100</span>
        </div>
        {resolved && (
          <div className="row gap-8 mt-12">
            <span className={`badge badge-${resolved === 'ban' ? 'danger' : resolved === 'warn' ? 'gold' : 'green'}`}>
              Resolved · {resolved === 'ban' ? 'Closed & banned' : resolved === 'warn' ? 'Warned' : 'Dismissed'}
            </span>
          </div>
        )}
      </div>

      <div className="grid gap-16 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <div className="card card-pad" style={{ borderColor: 'rgba(255,90,101,.35)' }}>
          <div className="row between"><span className="eyebrow">Risk score</span><span className={`badge badge-${rc}`}>{risk}</span></div>
          <div className="display tnum mt-8" style={{ fontSize: 40, color: `var(--${rc === 'muted' ? 'text' : rc})` }}>
            {score}<span className="muted" style={{ fontSize: 18 }}>/100</span>
          </div>
          <div className="stack gap-8 mt-12">
            {reasons.map((x, i) => (
              <div key={i} className="row gap-8 small t2"><Icon name="alert" size={14} style={{ color: 'var(--danger)' }} />{x}</div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <span className="eyebrow">Point flow</span>
          <div className="stack gap-10 mt-12">
            <div className="row between small">
              <span className="t2 mono">Total borrowed</span>
              <span className="tnum text-danger">{totalBorrowed.toLocaleString()}</span>
            </div>
            {recentFlow.slice(0, 5).map((e, i) => (
              <div key={i} className="row between small">
                <span className="t2 mono">user {e.userId} · {e.type}</span>
                <span className={`tnum ${e.amount >= 0 ? 'text-green' : 'text-danger'}`}>{e.amount >= 0 ? '+' : ''}{e.amount}</span>
              </div>
            ))}
            {recentFlow.length === 0 && <span className="tiny muted">No recent borrow/settle entries</span>}
          </div>
        </div>
        <div className="card card-pad">
          <span className="eyebrow">Sessions (IP / device)</span>
          <div className="stack gap-8 mt-12">
            {['ghost_07 · 113.161.x.x · Chrome/Win', 'ghost_08 · 113.161.x.x · Chrome/Win'].map((x, i) => (
              <div key={i} className="row gap-8 small t2"><Icon name="alert" size={14} style={{ color: 'var(--gold)' }} /><span className="mono tiny">{x}</span></div>
            ))}
            <span className="badge badge-danger" style={{ alignSelf: 'flex-start', marginTop: 4 }}>Same device, 2/2 accounts</span>
          </div>
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Members</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <table className="tbl">
          <thead>
            <tr>
              <th>Member</th>
              <th style={{ textAlign: 'center' }}>Role</th>
              <th style={{ textAlign: 'right' }}>Borrowed</th>
              <th style={{ textAlign: 'center' }}>Flag</th>
            </tr>
          </thead>
          <tbody>
            {displayMembers.map((mem, i) => (
              <tr key={i}>
                <td>
                  <div className="row gap-8">
                    <Avatar initials={mem.name.slice(0, 2).toUpperCase()} size={26} color={mem.flag ? 'var(--danger)' : 'var(--sky)'} />
                    <span className="small mono">{mem.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}><span className="badge badge-muted">{mem.role}</span></td>
                <td className="tnum t2" style={{ textAlign: 'right' }}>{mem.borrowed || '—'}</td>
                <td style={{ textAlign: 'center' }}>
                  {mem.flag ? <Icon name="alert" size={15} style={{ color: 'var(--danger)' }} /> : <span className="muted">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card card-pad mt-16 row between wrap gap-12">
        <span className="small t2">Confirm verdict — every action is written to the immutable audit trail.</span>
        <div className="row gap-8">
          <Btn variant="ghost" size="sm" icon="share" onClick={downloadEvidence}>Export evidence</Btn>
          <Btn variant="ghost" size="sm" disabled={!!resolved} onClick={escalateFlag}>Escalate</Btn>
          <Btn variant="ghost" size="sm" disabled={!!resolved} onClick={() => { setResolved('dismiss'); s.toastMsg('Case dismissed as false positive', 'check', 'var(--green)'); }}>Dismiss</Btn>
          <Btn variant="danger" size="sm" icon="ban" disabled={!!resolved} onClick={closeLobby}>Close & ban</Btn>
        </div>
      </div>
    </div>
  );
}

/* ===================== REVIEW QUEUE ===================== */
function AdmReview({ open }: { open: (kind: DetailKind, id: number) => void }) {
  const [queue, setQueue] = useState<ReviewItem[]>(WC.reviewQueue);
  const [generating, setGenerating] = useState(false);
  const load = () =>
    fetch('/api/v1/admin/news')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setQueue(j.data); })
      .catch(() => {});
  useEffect(() => { void load(); }, []);
  const decide = async (id: number, action: 'approve' | 'reject') => {
    try { await fetch(`/api/v1/admin/news/${id}/${action}`, { method: 'POST' }); await load(); }
    catch { /* keep current queue */ }
  };
  const generateDrafts = async () => {
    setGenerating(true);
    try { await fetch('/api/v1/admin/news/generate', { method: 'POST' }); await load(); }
    catch { /* keep current queue */ }
    finally { setGenerating(false); }
  };
  const badge = (st: string) => (st === 'PUBLISHED' || st === 'APPROVED' ? 'green' : st === 'REJECTED' ? 'danger' : 'muted');
  return (
    <div>
      <SecHead title="News" sub="AI-drafted stories — review &amp; publish, or generate new drafts" action={<Btn variant="ghost" size="sm" icon="refresh" onClick={generateDrafts} disabled={generating}>{generating ? 'Generating…' : 'Generate drafts'}</Btn>} />
      <div className="stack gap-12">
        {queue.length === 0 && <p className="tiny muted">Queue empty.</p>}
        {queue.map((a: ReviewItem) => (
          <div key={a.id} className="card card-pad card-hover pointer" onClick={() => open('news', a.id)}>
            <div className="row between wrap gap-10">
              <div style={{ minWidth: 0 }}>
                <div className="row gap-8">
                  <span className="badge badge-sky">{a.tag}</span>
                  {a.warn && <span className="badge badge-gold">⚠ Verify claims</span>}
                  <span className={`badge badge-${badge(a.status)}`}>{a.status}</span>
                </div>
                <div className="h3 mt-8" style={{ fontSize: 16 }}>{a.title}</div>
                <div className="tiny muted mt-4">
                  Source · {a.src} · grounding confidence{' '}
                  <span className="tnum" style={{ color: a.conf > 85 ? 'var(--green)' : 'var(--gold)' }}>{a.conf}%</span>
                </div>
              </div>
              <div className="row gap-8" style={{ alignSelf: 'center' }}>
                {a.status === 'PENDING' && (
                  <>
                    <Btn variant="primary" size="sm" icon="check" onClick={(e) => { e.stopPropagation(); void decide(a.id, 'approve'); }}>Approve</Btn>
                    <Btn variant="ghost" size="sm" icon="ban" onClick={(e) => { e.stopPropagation(); void decide(a.id, 'reject'); }}>Reject</Btn>
                  </>
                )}
                <Icon name="chevR" size={16} className="muted" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== AI PIPELINE ===================== */
type PipelineKpis = {
  total: number; last24h: number; byProvider: Record<string, number>;
  fallbackCount: number; avgLatencyMs: number; totalCost: number;
};
type PipelineJob = {
  id: number; type: string; providerUsed: string; status: string;
  tokens: number | null; cost: number | null; latencyMs: number | null;
  error: string | null; createdAt: string;
};

function AdmPipeline() {
  const [jobs, setJobs] = useState<PipelineJob[]>([]);
  const [kpis, setKpis] = useState<PipelineKpis | null>(null);

  useEffect(() => {
    fetch('/api/v1/admin/ai-jobs')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) { setJobs(j.data.jobs); setKpis(j.data.kpis); }
      })
      .catch(() => {});
  }, []);

  // Derive active provider from kpis (most used provider)
  const activeProvider = kpis
    ? Object.entries(kpis.byProvider).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'claude'
    : 'Claude';

  const avgLatencyStr = kpis
    ? kpis.avgLatencyMs >= 1000 ? `${(kpis.avgLatencyMs / 1000).toFixed(1)}s` : `${kpis.avgLatencyMs}ms`
    : '—';

  return (
    <div>
      <SecHead title="AI & data pipeline" sub="9router · Claude primary → OpenAI fallback" />
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 20 }}>
        <KPI v={kpis ? activeProvider : 'Claude'} l="Active provider" c="var(--green)" sub="9router primary" />
        <KPI v={kpis ? kpis.fallbackCount : '—'} l="Fallbacks (24h)" c="var(--gold)" sub="non-primary provider" />
        <KPI v={kpis ? `$${kpis.totalCost.toFixed(2)}` : '—'} l="LLM spend" c="var(--text)" />
        <KPI v={kpis ? avgLatencyStr : '—'} l="Avg latency" c="var(--sky)" />
      </div>
      {jobs.length === 0
        ? <p className="tiny muted">No jobs yet.</p>
        : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Provider</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }} className="hide-mobile">Latency</th>
                  <th style={{ textAlign: 'right' }}>When</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => {
                  const latStr = j.latencyMs != null
                    ? j.latencyMs >= 1000 ? `${(j.latencyMs / 1000).toFixed(1)}s` : `${j.latencyMs}ms`
                    : '—';
                  const when = new Date(j.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={j.id}>
                      <td className="mono small">{j.type}</td>
                      <td className="small t2">{j.providerUsed}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span className="row gap-6 center">
                          <JobDot st={j.status} />
                          <span className="tiny" style={{ textTransform: 'capitalize' }}>{j.status}</span>
                        </span>
                      </td>
                      <td className="tnum tiny t2 hide-mobile" style={{ textAlign: 'right' }}>{latStr}</td>
                      <td className="tiny muted" style={{ textAlign: 'right' }}>{when}</td>
                      <td style={{ textAlign: 'right' }}>{j.error && <Icon name="alert" size={14} style={{ color: 'var(--danger)' }} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {jobs.some((j) => j.status === 'error') && (
        <div className="card-2 card-pad mt-12 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)' }}>
          <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none' }} />
          <span>{jobs.filter((j) => j.status === 'error').length} job(s) failed in the last batch — check the rows flagged above.</span>
        </div>
      )}
    </div>
  );
}

/* ===================== SCHEDULE JOBS ===================== */
interface SchedJob { key: string; label: string; enabled: boolean; config: Record<string, number>; lastRunAt: string | null; lastRunStatus: string | null; lastRunNote: string | null }

function AdmJobs({ s }: { s: ScreenProps['s'] }) {
  const [jobs, setJobs] = useState<SchedJob[]>([]);
  const [draft, setDraft] = useState<Record<string, Record<string, number>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch('/api/v1/admin/schedule-jobs').then(r => (r.ok ? r.json() : null))
      .then(j => { if (j?.data) { setJobs(j.data); setDraft(Object.fromEntries(j.data.map((x: SchedJob) => [x.key, { ...x.config }]))); } })
      .catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (key: string, body: object) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/v1/admin/schedule-jobs/${key}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      setBusy(null);
      if (res.ok) { s.toastMsg('Job updated', 'check', 'var(--green)'); load(); }
      else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.message || 'Update failed', 'alert', 'var(--danger)'); }
    } catch { setBusy(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  const trigger = async (key: string) => {
    setBusy(key);
    try {
      const res = await fetch(`/api/v1/admin/schedule-jobs/${key}/trigger`, { method: 'POST' });
      setBusy(null);
      s.toastMsg(res.ok ? 'Triggered' : 'Trigger failed', res.ok ? 'refresh' : 'alert', res.ok ? 'var(--green)' : 'var(--danger)');
    } catch { setBusy(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  return (
    <div>
      <SecHead title="Schedule jobs" sub="Worker job thresholds, enable/disable, last run & manual trigger" />
      <div className="stack gap-12">
        {jobs.map(j => {
          const d = draft[j.key] ?? j.config;
          return (
            <div key={j.key} className="card card-pad">
              <div className="row between">
                <div className="row gap-8"><span className="h4">{j.label}</span><span className="tiny muted">{j.key}</span></div>
                <label className="row gap-6 tiny"><input type="checkbox" checked={j.enabled} onChange={e => save(j.key, { enabled: e.target.checked })} /> Enabled</label>
              </div>
              <div className="row gap-12 wrap-w mt-12">
                {Object.keys(j.config).map(f => (
                  <div key={f} className="field" style={{ minWidth: 150 }}>
                    <label className="label tiny">{f}</label>
                    <input className="input input-mono" type="number" value={d[f]}
                      onChange={e => setDraft(p => ({ ...p, [j.key]: { ...d, [f]: +e.target.value } }))} />
                  </div>
                ))}
              </div>
              <div className="row between mt-12">
                <span className="tiny muted">{j.lastRunAt
                  ? <><JobDot st={j.lastRunStatus === 'OK' ? 'ok' : j.lastRunStatus === 'ERROR' ? 'err' : 'fallback'} /> {new Date(j.lastRunAt).toLocaleString()} · {j.lastRunNote ?? ''}</>
                  : 'never run'}</span>
                <div className="row gap-8">
                  <Btn variant="ghost" size="sm" icon="refresh" disabled={busy === j.key} onClick={() => trigger(j.key)}>Run now</Btn>
                  <Btn variant="primary" size="sm" disabled={busy === j.key} onClick={() => save(j.key, { config: d })}>Save</Btn>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== AUDIT ===================== */
function AdmAudit() {
  const [log, setLog] = useState<[string, string, string, string, string][]>([]);
  useEffect(() => {
    fetch('/api/v1/admin/audit')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data?.length) {
          setLog(j.data.map((e: { action: string; desc: string; reason: string; when: string; sev: string }) => [e.action, e.desc, e.reason, e.when, e.sev]));
        }
      })
      .catch(() => {});
  }, []);
  return (
    <div>
      <SecHead title="Audit log" sub="Immutable record of every sensitive action" action={<Btn variant="ghost" size="sm" icon="share">Export</Btn>} />
      <div className="card" style={{ overflow: 'hidden' }}>
        {log.length === 0 && <p className="tiny muted" style={{ padding: 16, textAlign: 'center' }}>No audit entries yet.</p>}
        {log.map((l, i) => (
          <div key={i} className="row between" style={{ padding: '14px 16px', borderBottom: i < log.length - 1 ? '1px solid var(--line)' : 0 }}>
            <div className="row gap-12" style={{ minWidth: 0 }}>
              <span className={`badge badge-${l[4]}`}>{l[0]}</span>
              <div style={{ minWidth: 0 }}>
                <div className="small ellip">{l[1]}</div>
                {l[2] !== '—' && <div className="tiny muted">reason · {l[2]}</div>}
              </div>
            </div>
            <span className="tiny muted tnum">{l[3]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== ADMIN MATCH DETAIL ===================== */
type AdmMatchFull = AdmMatch & { venue?: { name: string } | null };
interface ExposureRow { outcome: string; count: number; staked: number; liability: number }
interface AuditRow { id: number; actorType: string; action: string; metadata: unknown; createdAt: string }
interface LineupTeam { code: string | null; name: string; formation: string | null; manager: string | null; players: { name: string; position: string | null; number: number | null; starter?: boolean }[] }

function OddsEditModal({ m, onClose, onSaved, s }: { m: AdmMatchFull; onClose: () => void; onSaved: () => void; s: ScreenProps['s'] }) {
  const [mh, setMh] = useState(m.odds?.mHome ?? 1.8);
  const [md, setMd] = useState(m.odds?.mDraw ?? 2.3);
  const [ma, setMa] = useState(m.odds?.mAway ?? 2.0);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [suggesting, setSuggesting] = useState(false);
  const num = (v: number, set: (n: number) => void) => (
    <input className="input input-mono" type="number" step="0.01" min="0.1" value={v}
      onChange={e => set(Math.max(0.1, +e.target.value || 0.1))} style={{ textAlign: 'center', fontSize: 18 }} />
  );
  const margin = ((1 / (1 + mh)) + (1 / (1 + md)) + (1 / (1 + ma))) * 100 - 100;
  const suggest = async () => {
    setSuggesting(true);
    try {
      const res = await fetch(`/api/v1/admin/matches/${m.id}/odds/propose`, { method: 'POST' });
      setSuggesting(false);
      if (res.ok) { const j = await res.json(); setMh(j.data.mHome); setMd(j.data.mDraw); setMa(j.data.mAway); s.toastMsg('AI suggested a line — review & publish', 'sparkles', 'var(--sky)'); }
      else s.toastMsg('AI suggestion failed (gateway?)', 'alert', 'var(--danger)');
    } catch { setSuggesting(false); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  const save = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/matches/${m.id}/odds`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ mHome: mh, mDraw: md, mAway: ma, reason }) });
      setBusy(false);
      if (res.ok) { s.toastMsg('Odds updated', 'check', 'var(--sky)'); onSaved(); }
      else s.toastMsg('Could not update odds', 'alert', 'var(--danger)');
    } catch { setBusy(false); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  return (
    <Portal><div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Adjust odds</span><button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <div className="row between mt-8">
            <span className="small">{m.home?.code} v {m.away?.code}</span>
            <Btn variant="ghost" size="sm" icon="sparkles" disabled={suggesting} onClick={suggest}>{suggesting ? 'Thinking…' : 'Suggest with AI'}</Btn>
          </div>
          <div className="row gap-10 mt-16">
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>1 · {m.home?.code}</label>{num(mh, setMh)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>X · Draw</label>{num(md, setMd)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>2 · {m.away?.code}</label>{num(ma, setMa)}</div>
          </div>
          <div className="card-2 card-pad mt-16 row between small" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="t2">Implied book margin</span>
            <span className="tnum" style={{ fontWeight: 700, color: Math.abs(margin) > 12 ? 'var(--gold)' : 'var(--green)' }}>{margin.toFixed(1)}%</span>
          </div>
          <div className="field mt-12"><label className="label">Reason (audit)</label><input className="input" placeholder="e.g. injury news / sharp money" value={reason} onChange={e => setReason(e.target.value)} /></div>
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={!reason.trim() || busy} onClick={save}>{busy ? 'Saving…' : 'Publish new odds'}</Btn>
          <p className="tiny muted mt-8" style={{ textAlign: 'center' }}>Existing open bets keep the odds they were placed at.</p>
        </div>
      </div>
    </div></Portal>
  );
}

function AdmMatchDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const [m, setM] = useState<AdmMatchFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [editOdds, setEditOdds] = useState(false);
  const [exposure, setExposure] = useState<{ outcomes: ExposureRow[]; total: number; settled: number } | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [lineups, setLineups] = useState<LineupTeam[]>([]);
  const [syncing, setSyncing] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/matches/${id}`).then(r => (r.ok ? r.json() : null))
      .then(j => setM((j?.data ?? null) as AdmMatchFull | null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  const loadExtras = useCallback(() => {
    fetch(`/api/v1/admin/matches/${id}/bets`).then(r => (r.ok ? r.json() : null)).then(j => setExposure(j?.data ?? null)).catch(() => {});
    fetch(`/api/v1/admin/matches/${id}/audit`).then(r => (r.ok ? r.json() : null)).then(j => setAudit(j?.data ?? [])).catch(() => {});
  }, [id]);
  useEffect(() => { loadExtras(); }, [loadExtras]);

  const loadLineups = useCallback((homeId?: number, awayId?: number) => {
    const ids = [homeId, awayId].filter((x): x is number => typeof x === 'number');
    Promise.all(ids.map(tid => fetch(`/api/v1/teams/${tid}`).then(r => (r.ok ? r.json() : null))))
      .then(rs => setLineups(
        rs.filter((j): j is { data: LineupTeam } => Array.isArray(j?.data?.players))
          .map(j => ({ code: j.data.code, name: j.data.name, formation: j.data.formation, manager: j.data.manager, players: j.data.players })),
      ))
      .catch(() => {});
  }, []);
  useEffect(() => { if (m?.home && m?.away) loadLineups(m.home.id, m.away.id); }, [m, loadLineups]);

  const syncResult = async () => {
    setSyncing('result');
    try {
      const res = await fetch(`/api/v1/admin/matches/${id}/sync-result`, { method: 'POST' });
      setSyncing(null);
      if (res.ok) { s.toastMsg('Result synced from feed', 'check', 'var(--green)'); load(); loadExtras(); }
      else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.code === 'ALREADY_SETTLED' ? 'Already settled — use Re-settle to correct' : 'Feed sync failed', 'alert', 'var(--danger)'); }
    } catch { setSyncing(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  const syncLineup = async () => {
    setSyncing('lineup');
    try {
      const res = await fetch(`/api/v1/admin/matches/${id}/sync-lineup`, { method: 'POST' });
      setSyncing(null);
      if (res.ok && m?.home && m?.away) { s.toastMsg('Lineups re-crawled (AI)', 'check', 'var(--green)'); loadLineups(m.home.id, m.away.id); loadExtras(); }
      else s.toastMsg('Lineup sync failed (gateway?)', 'alert', 'var(--danger)');
    } catch { setSyncing(null); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const toggleLock = async () => {
    if (!m) return;
    try {
      const res = await fetch(`/api/v1/admin/matches/${id}/lock-betting`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ locked: !m.bettingLocked }) });
      if (res.ok) { s.toastMsg(m.bettingLocked ? 'Betting re-opened' : 'Betting blocked', m.bettingLocked ? 'check' : 'lock', m.bettingLocked ? 'var(--green)' : 'var(--danger)'); load(); }
      else s.toastMsg('Could not change betting', 'alert', 'var(--danger)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };
  const confirmResult = async (mid: number, hs: number, as_: number, reason: string) => {
    try {
      const res = await fetch(`/api/v1/admin/matches/${mid}/resettle`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ home: hs, away: as_, reason }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { s.toastMsg(`Result confirmed · ${j.data?.settledCount ?? 0} bets settled`, 'trophy', 'var(--green)'); setEdit(false); load(); }
      else s.toastMsg('Could not confirm result', 'alert', 'var(--danger)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const back = <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to fixtures</button>;
  if (loading) return <div>{back}<div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Loading match…</p></div></div>;
  if (!m) return <div>{back}<div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Match not found.</p></div></div>;

  const live = m.status === 'LIVE', fin = m.status === 'FINISHED';
  const cells: [string, string, number][] = m.odds
    ? [['1', m.home?.code ?? 'H', m.odds.mHome], ['X', 'Draw', m.odds.mDraw], ['2', m.away?.code ?? 'A', m.odds.mAway]]
    : [];
  const resultLabel = m.result === '1' ? m.home?.code : m.result === '2' ? m.away?.code : m.result === 'X' ? 'Draw' : null;

  return (
    <div>
      {back}

      {/* hero — real /api/v1/matches/:id */}
      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between">
          <span className="badge badge-muted">{m.round === 'GROUP' ? `Group ${m.group ?? ''}` : m.round}</span>
          {live ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE</span>
            : fin ? <span className="badge badge-green">Full time</span>
              : <span className="badge badge-sky"><LocalTime value={m.kickoffAt} opts={{ dateStyle: 'medium', timeStyle: 'short' }} withTz /></span>}
        </div>
        <div className="row between center" style={{ marginTop: 18 }}>
          <div className="stack center gap-8" style={{ width: 110 }}>
            <Flag flagUrl={m.home?.flagUrl ?? undefined} name={m.home?.name} code={m.home?.code ?? undefined} size={52} />
            <span className="small" style={{ fontWeight: 700, textAlign: 'center' }}>{m.home?.name ?? 'TBD'}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            {(live || fin) && m.scoreHome != null
              ? <div className="display tnum" style={{ fontSize: 44 }}>{m.scoreHome}<span className="muted" style={{ fontSize: 24, padding: '0 8px' }}>:</span>{m.scoreAway}</div>
              : <div className="display muted" style={{ fontSize: 28 }}>VS</div>}
            {m.venue?.name && <div className="tiny muted mt-4">{m.venue.name}</div>}
            {fin && resultLabel && <div className="tiny mt-4 text-gold">Result: {resultLabel}</div>}
          </div>
          <div className="stack center gap-8" style={{ width: 110 }}>
            <Flag flagUrl={m.away?.flagUrl ?? undefined} name={m.away?.name} code={m.away?.code ?? undefined} size={52} />
            <span className="small" style={{ fontWeight: 700, textAlign: 'center' }}>{m.away?.name ?? 'TBD'}</span>
          </div>
        </div>
      </div>

      {/* data sync — on-demand from trusted sources (result=feed, lineup=AI, odds=admin) */}
      <div className="card card-pad mt-16">
        <span className="eyebrow">Data sync</span>
        <div className="row gap-8 wrap-w mt-12">
          <Btn variant="ghost" size="sm" icon="refresh" disabled={syncing === 'result'} onClick={syncResult}>{syncing === 'result' ? 'Syncing…' : 'Sync result (feed)'}</Btn>
          <Btn variant="ghost" size="sm" icon="trending" onClick={() => setEditOdds(true)}>Edit odds</Btn>
          <Btn variant="ghost" size="sm" icon="refresh" disabled={syncing === 'lineup'} onClick={syncLineup}>{syncing === 'lineup' ? 'Crawling…' : 'Sync lineup (AI)'}</Btn>
        </div>
      </div>

      {/* admin actions — server-enforced (lock-betting + resettle) */}
      <div className="card card-pad mt-16 row between wrap gap-12">
        <button className="chip" onClick={toggleLock}>
          <Icon name={m.bettingLocked ? 'lock' : 'check'} size={14} style={{ color: m.bettingLocked ? 'var(--danger)' : 'var(--green)' }} />
          {m.bettingLocked ? 'Betting blocked' : 'Betting open'}
        </button>
        <Btn variant="primary" size="sm" icon={fin ? 'check' : 'trophy'} onClick={() => setEdit(true)}>{fin ? 'Re-settle result' : 'Confirm result'}</Btn>
      </div>

      {/* house odds (read-only — no admin odds feed) */}
      {cells.length > 0 && (
        <div className="card card-pad mt-16">
          <span className="eyebrow">House odds (1 · X · 2)</span>
          <div className="row gap-8 mt-12">
            {cells.map(([k, l, v]) => (
              <div key={k} className="odds" style={{ cursor: 'default' }}>
                <span className="o-label">{k} · {l}</span>
                <span className="o-val">{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* match state */}
      <div className="card card-pad mt-16 stack gap-10 small">
        <div className="row between"><span className="t2">Status</span><span style={{ fontWeight: 700 }}>{m.status}</span></div>
        <div className="row between"><span className="t2">Betting</span><span className={`badge ${m.bettingLocked ? 'badge-danger' : 'badge-green'}`}>{m.bettingLocked ? 'Blocked' : 'Open'}</span></div>
        <div className="row between"><span className="t2">Settlement</span><span className="badge badge-muted">{fin ? 'Settled · idempotent' : 'Pending admin confirm'}</span></div>
      </div>

      {/* bet exposure (real aggregation) */}
      {exposure && exposure.total > 0 && (
        <div className="card card-pad mt-16">
          <div className="row between"><span className="eyebrow">Bet exposure</span><span className="tiny muted">{exposure.total} bets · {exposure.settled} settled</span></div>
          <div className="stack gap-10 mt-12">
            {exposure.outcomes.map(o => (
              <div key={o.outcome} className="row between small">
                <span className="t2">{o.outcome} · {o.count} bets</span>
                <span className="tnum">staked {o.staked.toLocaleString()} · liability <span className="text-gold">{o.liability.toLocaleString()}</span></span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* projected lineups (AI) — both teams */}
      {lineups.length > 0 && (
        <div className="card card-pad mt-16">
          <span className="eyebrow">Projected lineups (AI)</span>
          <div className="grid gap-16 mt-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
            {lineups.map((t, i) => (
              <div key={i}>
                <div className="small" style={{ fontWeight: 700, marginBottom: 8 }}>{t.name}</div>
                <FormationPitch players={t.players} formation={t.formation} manager={t.manager} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* audit trail */}
      {audit.length > 0 && (
        <div className="card card-pad mt-16">
          <span className="eyebrow">Audit trail</span>
          <div className="stack gap-8 mt-12">
            {audit.map(a => (
              <div key={a.id} className="row between tiny">
                <span className="t2">{a.action}</span>
                <span className="muted">{a.actorType} · {new Date(a.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {edit && <ScoreEditModal id={m.id} homeLabel={m.home?.code ?? 'Home'} awayLabel={m.away?.code ?? 'Away'} sub={`${m.round} · ${new Date(m.kickoffAt).toLocaleDateString()}`} hs={m.scoreHome ?? 0} as={m.scoreAway ?? 0} onClose={() => setEdit(false)} onSave={confirmResult} />}
      {editOdds && <OddsEditModal m={m} onClose={() => setEditOdds(false)} onSaved={() => { setEditOdds(false); load(); }} s={s} />}
    </div>
  );
}

/* ===================== ADMIN TEAM DETAIL ===================== */
function AdmTeamDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const [t, setT] = useState<AdmTeamDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', code: '', flagUrl: '' });
  const [saving, setSaving] = useState(false);
  const [recrawling, setRecrawling] = useState(false);
  const [syncingFd, setSyncingFd] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetch(`/api/v1/teams/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.data) { setT(j.data); setForm({ name: j.data.name ?? '', code: j.data.code ?? '', flagUrl: j.data.flagUrl ?? '' }); }
      })
      .catch(() => { /* keep null */ })
      .finally(() => setLoading(false));
  }, [id]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch(`/api/v1/admin/teams/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(form) });
      if (res.ok) { s.toastMsg('Team updated · logged to audit', 'check', 'var(--green)'); load(); }
      else { s.toastMsg('Update failed', 'alert', 'var(--danger)'); }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
    finally { setSaving(false); }
  }

  async function recrawl() {
    setRecrawling(true);
    try {
      const res = await fetch(`/api/v1/admin/teams/${id}/recrawl`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { s.toastMsg(`Squad re-crawled · ${j.data.count} players`, 'refresh', 'var(--green)'); load(); }
      else { s.toastMsg(j?.error?.code === 'NO_GATEWAY' ? 'AI gateway not configured' : 'Re-crawl failed', 'alert', 'var(--danger)'); }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
    finally { setRecrawling(false); }
  }

  async function syncFd() {
    setSyncingFd(true);
    try {
      const res = await fetch(`/api/v1/admin/teams/${id}/sync-fd`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) { s.toastMsg(`Squad synced · ${j.data?.players?.length ?? 0} players`, 'refresh', 'var(--green)'); load(); }
      else { s.toastMsg(j?.error?.code === 'NO_API_KEY' ? 'Football-data API key not configured' : 'Sync failed', 'alert', 'var(--danger)'); }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
    finally { setSyncingFd(false); }
  }

  async function enrichLineup() {
    setEnriching(true);
    try {
      const res = await fetch(`/api/v1/admin/teams/${id}/enrich-lineup`, { method: 'POST' });
      const j = await res.json().catch(() => ({}));
      if (res.ok) {
        if (j.data?.status === 'no-roster') { s.toastMsg('Sync squad (API) first', 'alert', 'var(--danger)'); }
        else { s.toastMsg(`Lineup enriched · ${j.data?.matched ?? 0} matched / ${j.data?.starters ?? 0} starters`, 'refresh', 'var(--green)'); load(); }
      } else {
        s.toastMsg(j?.error?.code === 'LLM_NOT_CONFIGURED' ? 'LLM gateway not configured' : 'Enrich failed', 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
    finally { setEnriching(false); }
  }

  if (loading) return <div><button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to teams</button><p className="small muted">Loading…</p></div>;
  if (!t) return <div><button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to teams</button><p className="small muted">Team not found.</p></div>;

  return (
    <div>
      <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to teams</button>

      <div className="panel card-pad-lg">
        <div className="row gap-16">
          <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={60} />
          <div>
            <h1 className="h2">{t.name}</h1>
            <div className="row gap-8 mt-8">
              <span className="badge badge-muted">Group {t.group ?? '—'}</span>
              {t.code && <span className="badge badge-muted">{t.code}</span>}
              <span className="badge badge-sky">{t.players.length} players</span>
            </div>
          </div>
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Edit team info</div>
      <div className="card card-pad stack gap-12">
        <div className="field"><label className="label">Name</label><input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} /></div>
        <div className="row gap-12">
          <div className="field" style={{ flex: 1 }}><label className="label">Code</label><input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))} /></div>
          <div className="field" style={{ flex: 2 }}><label className="label">Flag URL</label><input className="input" value={form.flagUrl} onChange={(e) => setForm((f) => ({ ...f, flagUrl: e.target.value }))} placeholder="https://…" /></div>
        </div>
        <div className="row gap-8">
          <Btn variant="primary" size="sm" icon="check" disabled={saving} onClick={save}>{saving ? 'Saving…' : 'Save changes'}</Btn>
          <Btn variant="primary" size="sm" icon="refresh" disabled={syncingFd} onClick={syncFd}>{syncingFd ? 'Syncing…' : 'Sync squad (API)'}</Btn>
          <Btn variant="ghost" size="sm" icon="refresh" disabled={recrawling} onClick={recrawl}>{recrawling ? 'Re-crawling…' : 'Re-crawl squad (AI)'}</Btn>
          <Btn variant="ghost" size="sm" icon="refresh" disabled={enriching} onClick={enrichLineup}>{enriching ? 'Enriching…' : 'Assign roles & XI (AI)'}</Btn>
        </div>
      </div>

      <div className="row between mt-24" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Squad ({t.players.length})</span>
        {t.players.length > 0 && <span className="badge badge-sky">AI-assisted</span>}
      </div>
      {t.players.length === 0 ? <div className="card card-pad"><p className="small muted" style={{ margin: 0 }}>No squad yet — use “Re-crawl squad”.</p></div>
        : <FormationPitch players={t.players} formation={t.formation} manager={t.manager} />}
    </div>
  );
}

/* ===================== ADMIN NEWS REVIEW DETAIL ===================== */
interface NewsDetailData { id: number; title: string; body: string; tag: string; src: string; sourceUrl: string | null; status: string }

function AdmNewsDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const [a, setA] = useState<NewsDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/v1/admin/news/${id}`).then(r => (r.ok ? r.json() : null))
      .then(j => setA((j?.data ?? null) as NewsDetailData | null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const back = <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to news</button>;
  if (loading) return <div>{back}<div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Loading draft…</p></div></div>;
  if (!a) return <div>{back}<div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Article not found.</p></div></div>;

  const decide = async (action: 'approve' | 'reject') => {
    setBusy(true);
    try {
      const res = await fetch(`/api/v1/admin/news/${id}/${action}`, { method: 'POST' });
      setBusy(false);
      if (res.ok) { s.toastMsg(action === 'approve' ? 'Story approved & published' : 'Story rejected', action === 'approve' ? 'check' : 'x', action === 'approve' ? 'var(--green)' : 'var(--danger)'); onBack(); }
      else s.toastMsg('Action failed', 'alert', 'var(--danger)');
    } catch { setBusy(false); s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const paras = (a.body || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);

  return (
    <div>
      {back}
      <div className="grid gap-16" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="panel card-pad-lg">
          <div className="row between">
            <span className="badge badge-sky">{a.tag}</span>
            <span className={`badge badge-${a.status === 'PUBLISHED' ? 'green' : a.status === 'REJECTED' ? 'danger' : 'muted'}`}>{a.status}</span>
          </div>
          <h1 className="h2 mt-12">{a.title}</h1>
          <div className="row gap-12 mt-12 tiny muted">
            <span>Source · {a.src}</span><span>·</span>
            <span className="badge badge-muted">✨ AI draft</span>
          </div>
          <div className="stack gap-14 mt-18" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-2)' }}>
            {paras.length > 0 ? paras.map((p, i) => <p key={i}>{p}</p>) : <p className="muted">(empty draft)</p>}
          </div>
        </div>

        <div className="stack gap-16">
          <div className="card card-pad">
            <span className="eyebrow">Source</span>
            <div className="stack gap-8 mt-12 small">
              {a.sourceUrl
                ? <a className="text-sky ellip" href={a.sourceUrl} target="_blank" rel="noreferrer">{a.sourceUrl}</a>
                : <span className="t2">No source URL</span>}
              <p className="tiny muted">Original rewrite — the source headline is never published verbatim.</p>
            </div>
          </div>

          <div className="card card-pad">
            <span className="eyebrow">Decision</span>
            <div className="stack gap-8 mt-12">
              <Btn variant="primary" className="btn-block" icon="check" disabled={busy || a.status !== 'PENDING'} onClick={() => decide('approve')}>{a.status === 'PUBLISHED' ? 'Published' : 'Approve & publish'}</Btn>
              <Btn variant="danger" className="btn-block" icon="x" disabled={busy || a.status !== 'PENDING'} onClick={() => decide('reject')}>Reject</Btn>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
