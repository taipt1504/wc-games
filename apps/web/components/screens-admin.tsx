'use client';
/* GOLAZO — Admin console (ported from screens-admin.jsx) */
import React, { useState, useEffect } from 'react';
import { WC } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Avatar, SecHead } from '@/components/ui';

/* -------- local types -------- */
type DetailKind = 'user' | 'risk' | 'match' | 'team' | 'news';
type Detail = { kind: DetailKind; id: number } | null;

type AdminUser = typeof WC.adminUsers[number];
type RiskLobby = typeof WC.riskLobbies[number];
type ReviewItem = typeof WC.reviewQueue[number];
type AiJob = typeof WC.aiJobs[number];

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
      .then((j) => { if (j?.data?.length) setUsers(j.data); })
      .catch(() => {});
  useEffect(() => { void loadUsers(); }, []);

  const open = (kind: DetailKind, id: number) => { setDetail({ kind, id }); window.scrollTo(0, 0); };
  const closeDetail = () => setDetail(null);
  const nav: [string, string, string][] = [
    ['overview', 'Overview', 'gauge'],
    ['tourney', 'Tournament', 'calendar'],
    ['users', 'Users', 'users'],
    ['risk', 'Lobby risk', 'shield'],
    ['review', 'Review queue', 'news'],
    ['pipeline', 'AI pipeline', 'database'],
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
            <span className="small muted hide-mobile">Signed in as Hằng · Moderator</span>
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
          {!detail && tab === 'users' && <AdmUsers users={users} open={open} />}
          {!detail && tab === 'risk' && <AdmRisk open={open} />}
          {!detail && tab === 'review' && <AdmReview open={open} />}
          {!detail && tab === 'pipeline' && <AdmPipeline />}
          {!detail && tab === 'audit' && <AdmAudit />}
        </div>
      </div>
    </div>
  );
}

/* ===================== OVERVIEW ===================== */
function AdmOverview({ s, setTab, open }: { s: ScreenProps['s']; setTab: (k: string) => void; open: (kind: DetailKind, id: number) => void }) {
  return (
    <div>
      <SecHead title="Operations overview" sub="Matchday · live platform health" />
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))' }}>
        <KPI v="48.2K" l="Active users (24h)" c="var(--text)" sub="▲ 12% vs yesterday" />
        <KPI v="11,940" l="Bets placed today" c="var(--green)" />
        <KPI v="3" l="Open risk flags" c="var(--danger)" sub="1 high priority" />
        <KPI v="6" l="Articles pending" c="var(--gold)" />
        <KPI v="99.9%" l="Settle accuracy" c="var(--sky)" />
      </div>

      <div className="grid gap-16 mt-24" style={{ gridTemplateColumns: 'minmax(0,1.3fr) minmax(0,1fr)' }}>
        <div>
          <SecHead title="Risk queue" sub="Lobbies auto-flagged for review" action={<button className="chip" onClick={() => setTab('risk')}>Open all →</button>} />
          <div className="stack gap-10">
            {WC.riskLobbies.map(r => <RiskRow key={r.id} r={r} open={open} />)}
          </div>
        </div>
        <div>
          <SecHead title="Pipeline status" action={<button className="chip" onClick={() => setTab('pipeline')}>Details →</button>} />
          <div className="card" style={{ overflow: 'hidden' }}>
            {WC.aiJobs.map((j, i) => (
              <div key={i} className="row between" style={{ padding: '12px 16px', borderBottom: i < WC.aiJobs.length - 1 ? '1px solid var(--line)' : 0 }}>
                <div className="row gap-10"><JobDot st={j.status} /><span className="small mono">{j.name}</span></div>
                <span className="tiny muted">{j.last} ago</span>
              </div>
            ))}
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
type LocalMatch = typeof WC.matches[number] & { locked: boolean };

function AdmTourney({ s, open }: { s: ScreenProps['s']; open: (kind: DetailKind, id: number) => void }) {
  const [view, setView] = useState('matches');
  const [matches, setMatches] = useState<LocalMatch[]>(() =>
    WC.matches.map(m => ({ ...m, locked: m.status !== 'SCHEDULED' }))
  );
  const [filter, setFilter] = useState('all');
  const [edit, setEdit] = useState<LocalMatch | null>(null);
  const [editOdds, setEditOdds] = useState<LocalMatch | null>(null);

  const counts: Record<string, number> = {
    all: matches.length,
    LIVE: matches.filter(m => m.status === 'LIVE').length,
    SCHEDULED: matches.filter(m => m.status === 'SCHEDULED').length,
    FINISHED: matches.filter(m => m.status === 'FINISHED').length,
  };
  let list = matches.slice();
  if (filter !== 'all') list = list.filter(m => m.status === filter);
  list = list.slice(0, 24);

  const saveScore = (id: number, hs: number, as_: number) => {
    setMatches(ms => ms.map(m => m.id === id ? { ...m, hs, as: as_ } : m));
    setEdit(null);
    s.toastMsg('Score saved · logged to audit', 'check', 'var(--gold)');
  };
  const settle = (id: number) => {
    setMatches(ms => ms.map(m => m.id === id ? { ...m, status: 'FINISHED', locked: true, hs: m.hs ?? 0, as: m.as ?? 0 } : m));
    s.toastMsg('Match settled · payouts released', 'trophy', 'var(--green)');
  };
  const toggleLock = (id: number) => {
    setMatches(ms => ms.map(m => m.id === id ? { ...m, locked: !m.locked } : m));
  };
  const saveOdds = (id: number, mh: number, md: number, ma: number) => {
    setMatches(ms => ms.map(m => m.id === id ? { ...m, odds: { mh, md, ma } } : m));
    setEditOdds(null);
    s.toastMsg('Odds updated · open bets unaffected', 'check', 'var(--sky)');
  };

  const filterTabs: [string, string][] = [['all', 'All'], ['LIVE', 'Live'], ['SCHEDULED', 'Scheduled'], ['FINISHED', 'Settled']];

  return (
    <div>
      <SecHead title="Tournament management" sub="Fixtures, scores, settlement & betting controls" />

      <div className="row gap-8 mb-12" style={{ marginBottom: 16 }}>
        {([['matches', 'Matches'], ['teams', 'Teams & groups']] as [string, string][]).map(([k, l]) => (
          <button key={k} className={`chip ${view === k ? 'active' : ''}`} onClick={() => setView(k)}>{l}</button>
        ))}
      </div>

      {view === 'matches' && <>
        <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 18 }}>
          <KPI v="104" l="Total fixtures" c="var(--text)" />
          <KPI v={counts.LIVE} l="Live now" c="var(--magenta)" />
          <KPI v={counts.SCHEDULED} l="Scheduled" c="var(--sky)" />
          <KPI v={counts.FINISHED} l="Settled" c="var(--green)" />
        </div>

        <div className="row between wrap gap-12" style={{ marginBottom: 14 }}>
          <div className="row gap-8 wrap-w">
            {filterTabs.map(([k, l]) => (
              <button key={k} className={`chip ${filter === k ? 'active' : ''}`} onClick={() => setFilter(k)}>{l} · {counts[k]}</button>
            ))}
          </div>
          <Btn variant="ghost" size="sm" icon="refresh" onClick={() => s.toastMsg('Re-synced fixtures from API-Football', 'refresh', 'var(--sky)')}>Re-sync feed</Btn>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Match</th>
                  <th className="hide-mobile">Kickoff</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'center' }}>Score</th>
                  <th style={{ textAlign: 'center' }} className="hide-mobile">Odds 1·X·2</th>
                  <th style={{ textAlign: 'center' }}>Betting</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {list.map(m => {
                  const home = WC.byId(m.home), away = WC.byId(m.away);
                  return (
                    <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => open('match', m.id)}>
                      <td>
                        <div className="row gap-8" style={{ minWidth: 0 }}>
                          <Flag team={home} size={20} />
                          <span className="small nowrap">{home.code} v {away.code}</span>
                          <span className="tiny muted hide-mobile">{m.stage}</span>
                        </div>
                      </td>
                      <td className="tiny t2 hide-mobile nowrap">{WC.fmtDate(m.date)} · {m.kickoff}</td>
                      <td style={{ textAlign: 'center' }}>
                        {m.status === 'LIVE'
                          ? <span className="badge badge-magenta"><span className="live-dot"></span>{m.minute}&apos;</span>
                          : m.status === 'FINISHED'
                            ? <span className="badge badge-green">FT</span>
                            : <span className="badge badge-muted">Scheduled</span>}
                      </td>
                      <td style={{ textAlign: 'center' }} className="tnum">{m.hs ?? '–'} : {m.as ?? '–'}</td>
                      <td style={{ textAlign: 'center' }} className="hide-mobile">
                        <span className="tnum tiny t2 nowrap">{m.odds.mh.toFixed(2)} · {m.odds.md.toFixed(2)} · {m.odds.ma.toFixed(2)}</span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button className="chip chip-sm" onClick={(e) => { e.stopPropagation(); toggleLock(m.id); }} style={{ gap: 5 }}>
                          <Icon name={m.locked ? 'lock' : 'check'} size={12} style={{ color: m.locked ? 'var(--danger)' : 'var(--green)' }} />
                          {m.locked ? 'Locked' : 'Open'}
                        </button>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                          <Btn variant="ghost" size="sm" icon="trending" onClick={(e) => { e.stopPropagation(); setEditOdds(m); }}>Odds</Btn>
                          <Btn variant="ghost" size="sm" icon="edit" onClick={(e) => { e.stopPropagation(); setEdit(m); }}>Score</Btn>
                          {m.status !== 'FINISHED' && <Btn variant="primary" size="sm" onClick={(e) => { e.stopPropagation(); settle(m.id); }}>Settle</Btn>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-2 card-pad mt-12 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)' }}>
          <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none' }} />
          <span>Settlement is idempotent — re-running never double-pays. Manual score overrides require a reason and are written to the audit log.</span>
        </div>
      </>}

      {view === 'teams' && <AdmTeams s={s} open={open} />}

      {edit && <ScoreEditModal m={edit} onClose={() => setEdit(null)} onSave={saveScore} />}
      {editOdds && <OddsEditModal m={editOdds} onClose={() => setEditOdds(null)} onSave={saveOdds} />}
    </div>
  );
}

function ScoreEditModal({ m, onClose, onSave }: { m: LocalMatch; onClose: () => void; onSave: (id: number, hs: number, as_: number) => void }) {
  const home = WC.byId(m.home), away = WC.byId(m.away);
  const [hs, setHs] = useState(m.hs ?? 0);
  const [as, setAs] = useState(m.as ?? 0);
  const [reason, setReason] = useState('');
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between">
            <span className="eyebrow">Override score</span>
            <button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button>
          </div>
          <div className="tiny muted mt-4">{m.stage} · {WC.fmtDate(m.date)}</div>
          <div className="row between center gap-12 mt-16">
            <div className="stack center gap-8" style={{ flex: 1 }}>
              <Flag team={home} size={40} />
              <span className="small" style={{ fontWeight: 700 }}>{home.code}</span>
              <input className="input input-mono" type="number" min="0" value={hs}
                onChange={e => setHs(Math.max(0, +e.target.value || 0))}
                style={{ textAlign: 'center', fontSize: 22, width: 70 }} />
            </div>
            <span className="display muted" style={{ fontSize: 24 }}>:</span>
            <div className="stack center gap-8" style={{ flex: 1 }}>
              <Flag team={away} size={40} />
              <span className="small" style={{ fontWeight: 700 }}>{away.code}</span>
              <input className="input input-mono" type="number" min="0" value={as}
                onChange={e => setAs(Math.max(0, +e.target.value || 0))}
                style={{ textAlign: 'center', fontSize: 22, width: 70 }} />
            </div>
          </div>
          <div className="field mt-16">
            <label className="label">Reason (required for audit)</label>
            <input className="input" placeholder="e.g. API mismatch / VAR correction" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <Btn variant="gold" size="lg" className="btn-block mt-16" disabled={!reason.trim()} onClick={() => onSave(m.id, hs, as)}>Save score & re-settle</Btn>
        </div>
      </div>
    </div>
  );
}

function AdmTeams({ s, open }: { s: ScreenProps['s']; open: (kind: DetailKind, id: number) => void }) {
  return (
    <div>
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', marginBottom: 18 }}>
        <KPI v="48" l="Teams" c="var(--text)" />
        <KPI v="12" l="Groups" c="var(--sky)" />
        <KPI v="6" l="Confederations" c="var(--gold)" />
        <KPI v="0" l="Data conflicts" c="var(--green)" />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Team</th>
                <th style={{ textAlign: 'center' }}>Group</th>
                <th className="hide-mobile">Confederation</th>
                <th style={{ textAlign: 'center' }}>FIFA</th>
                <th style={{ textAlign: 'center' }}>Squad</th>
                <th style={{ textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {WC.teams.slice(0, 16).map(t => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => open('team', t.id)}>
                  <td>
                    <div className="row gap-8">
                      <Flag team={t} size={20} />
                      <span className="small" style={{ fontWeight: 600 }}>{t.name}</span>
                    </div>
                  </td>
                  <td style={{ textAlign: 'center' }}><span className="badge badge-muted">{t.group}</span></td>
                  <td className="small t2 hide-mobile">{t.conf}</td>
                  <td className="tnum t2" style={{ textAlign: 'center' }}>#{t.rank}</td>
                  <td style={{ textAlign: 'center' }}><span className="badge badge-green">26 ✓</span></td>
                  <td style={{ textAlign: 'right' }}><Icon name="chevR" size={16} className="muted" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <p className="tiny muted mt-12">Showing 16 of 48 teams. Tap a team to manage its squad & data. Group assignments sync nightly; conflicts surface here for manual resolution.</p>
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
      <p className="tiny muted mt-12">Note: 3 accounts share IP 113.161.x.x — auto-grouped as a possible multi-account cluster. Tap any row to inspect.</p>
    </div>
  );
}

/* ===================== USER DETAIL ===================== */
function AdmUserDetail({ id, users, reload, onBack, s }: { id: number; users: AdminUser[]; reload: () => void | Promise<void>; onBack: () => void; s: ScreenProps['s'] }) {
  const u = users[id] ?? WC.adminUsers[0];
  const [status, setStatus] = useState(u.status);
  const flagged = u.flags > 0;
  // Real users carry no captured IP yet ('—'); only cluster on a concrete shared IP.
  const cluster = u.ip && u.ip !== '—' ? users.filter((x, i) => i !== id && x.ip === u.ip) : [];
  const initials = u.name.slice(0, 2).toUpperCase();
  const realId = (u as { id?: number }).id;

  const ledger = [
    { l: 'Daily check-in', d: +200, w: 'today 08:12' },
    { l: 'Stake · live bet', d: -150, w: 'today 14:02' },
    { l: flagged ? 'Borrow ×3 (maxed)' : 'Won · group bet', d: flagged ? +600 : +275, w: 'today 14:20' },
    { l: 'Referral bonus', d: +300, w: 'yesterday' },
  ];
  const bets: { m: number; pick: string; stake: number; status: string }[] = [
    { m: 23, pick: '1', stake: 150, status: 'LIVE' },
    { m: 3, pick: '1', stake: 200, status: 'WON' },
    { m: 11, pick: 'X', stake: 120, status: 'LOST' },
  ];

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
        <KPI v={u.pts.toLocaleString()} l="Point balance" c="var(--gold)" />
        <KPI v="34" l="Lifetime bets" c="var(--text)" />
        <KPI v={flagged ? '21%' : '58%'} l="Win rate" c={flagged ? 'var(--danger)' : 'var(--green)'} />
        <KPI v={u.flags} l="Active flags" c={u.flags ? 'var(--danger)' : 'var(--muted)'} />
      </div>

      <div className="grid gap-16 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))' }}>
        <div className="card card-pad">
          <span className="eyebrow">Recent point activity</span>
          <div className="stack gap-10 mt-12">
            {ledger.map((x, i) => (
              <div key={i} className="row between small">
                <div><div className="t2">{x.l}</div><div className="tiny muted">{x.w}</div></div>
                <span className="tnum" style={{ fontWeight: 700, color: x.d > 0 ? 'var(--green)' : 'var(--danger)' }}>{x.d > 0 ? '+' : ''}{x.d}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <span className="eyebrow">Recent bets</span>
          <div className="stack gap-10 mt-12">
            {bets.map((b, i) => {
              const match = WC.matchById(b.m)!;
              const home = WC.byId(match.home), away = WC.byId(match.away);
              const bc = b.status === 'WON' ? 'green' : b.status === 'LOST' ? 'danger' : 'magenta';
              return (
                <div key={i} className="row between">
                  <div className="row gap-8">
                    <Flag team={home} size={18} />
                    <span className="small">{home.code} v {away.code}</span>
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
      .then((j) => { if (j?.data?.length) setFlags(j.data); })
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
        {flags.map(r => <RiskRow key={r.id} r={r} open={open} />)}
      </div>
    </div>
  );
}

/* ===================== LOBBY RISK DETAIL ===================== */
function AdmRiskDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const r = WC.riskLobbies.find(x => x.id === id) || WC.riskLobbies[0];
  const [resolved, setResolved] = useState<string | null>(null);
  const rc = r.risk === 'High' ? 'danger' : r.risk === 'Medium' ? 'gold' : 'muted';
  const members: { name: string; role: string; net: number; borrowed: number; flag: boolean }[] = [
    { name: 'ghost_07', role: 'owner', net: -1200, borrowed: 600, flag: true },
    { name: 'ghost_08', role: 'member', net: +1200, borrowed: 0, flag: true },
  ];
  if (r.members > 2) members.push({ name: 'casual_max', role: 'member', net: -40, borrowed: 0, flag: false });

  const act = (verdict: string) => {
    setResolved(verdict);
    if (verdict === 'ban') s.toastMsg('Lobby closed · accounts banned · logged', 'ban', 'var(--danger)');
    else if (verdict === 'warn') s.toastMsg('Warning issued to lobby owner', 'check', 'var(--gold)');
    else s.toastMsg('Case dismissed as false positive', 'check', 'var(--green)');
  };

  const pointFlowRows: [string, string, string][] = [
    ['ghost_07 → ghost_08', '−1,200', 'one-way'],
    ['ghost_08 → ghost_07', '0', ''],
    ['borrow ×6', '+1,200', 'maxed'],
  ];

  return (
    <div>
      <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to risk queue</button>

      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between wrap gap-12">
          <div>
            <div className="row gap-8">
              <Icon name="shield" size={18} style={{ color: `var(--${rc === 'muted' ? 'muted' : rc})` }} />
              <span className="mono h3">{r.name}</span>
            </div>
            <div className="tiny muted mt-4">{r.members} members · flagged {r.flagged}</div>
          </div>
          <span className={`badge badge-${rc}`} style={{ fontSize: 13 }}>{r.risk} risk · {r.score}/100</span>
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
          <div className="row between"><span className="eyebrow">Risk score</span><span className={`badge badge-${rc}`}>{r.risk}</span></div>
          <div className="display tnum mt-8" style={{ fontSize: 40, color: `var(--${rc === 'muted' ? 'text' : rc})` }}>
            {r.score}<span className="muted" style={{ fontSize: 18 }}>/100</span>
          </div>
          <div className="stack gap-8 mt-12">
            {r.reasons.map((x, i) => (
              <div key={i} className="row gap-8 small t2"><Icon name="alert" size={14} style={{ color: 'var(--danger)' }} />{x}</div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <span className="eyebrow">Point flow</span>
          <div className="stack gap-10 mt-12">
            {pointFlowRows.map(([a, b, tag], i) => (
              <div key={i} className="row between small">
                <span className="t2 mono">{a}</span>
                <div className="row gap-8">
                  <span className="tnum text-danger">{b}</span>
                  {tag && <span className="badge badge-danger">{tag}</span>}
                </div>
              </div>
            ))}
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
              <th style={{ textAlign: 'right' }}>Net flow</th>
              <th style={{ textAlign: 'right' }}>Borrowed</th>
              <th style={{ textAlign: 'center' }}>Flag</th>
            </tr>
          </thead>
          <tbody>
            {members.map((mem, i) => (
              <tr key={i}>
                <td>
                  <div className="row gap-8">
                    <Avatar initials={mem.name.slice(0, 2).toUpperCase()} size={26} color={mem.flag ? 'var(--danger)' : 'var(--sky)'} />
                    <span className="small mono">{mem.name}</span>
                  </div>
                </td>
                <td style={{ textAlign: 'center' }}><span className="badge badge-muted">{mem.role}</span></td>
                <td className="tnum" style={{ textAlign: 'right', color: mem.net >= 0 ? 'var(--green)' : 'var(--danger)' }}>{mem.net >= 0 ? '+' : ''}{mem.net}</td>
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
          <Btn variant="ghost" size="sm" icon="share" onClick={() => s.toastMsg('Evidence bundle exported', 'share', 'var(--sky)')}>Export evidence</Btn>
          <Btn variant="ghost" size="sm" disabled={!!resolved} onClick={() => act('dismiss')}>Dismiss</Btn>
          <Btn variant="ghost" size="sm" disabled={!!resolved} onClick={() => act('warn')}>Warn</Btn>
          <Btn variant="danger" size="sm" icon="ban" disabled={!!resolved} onClick={() => act('ban')}>Close & ban</Btn>
        </div>
      </div>
    </div>
  );
}

/* ===================== REVIEW QUEUE ===================== */
function AdmReview({ open }: { open: (kind: DetailKind, id: number) => void }) {
  const [queue, setQueue] = useState<ReviewItem[]>(WC.reviewQueue);
  const load = () =>
    fetch('/api/v1/admin/news')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data?.length) setQueue(j.data); })
      .catch(() => {});
  useEffect(() => { void load(); }, []);
  const decide = async (id: number, action: 'approve' | 'reject') => {
    try { await fetch(`/api/v1/admin/news/${id}/${action}`, { method: 'POST' }); await load(); }
    catch { /* keep current queue */ }
  };
  const badge = (st: string) => (st === 'PUBLISHED' || st === 'APPROVED' ? 'green' : st === 'REJECTED' ? 'danger' : 'muted');
  return (
    <div>
      <SecHead title="News review queue" sub="Tap a story to read the full draft before approving" />
      <div className="stack gap-12">
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
function AdmPipeline() {
  return (
    <div>
      <SecHead title="AI & data pipeline" sub="9router · Claude primary → OpenAI fallback" />
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', marginBottom: 20 }}>
        <KPI v="Claude" l="Active provider" c="var(--green)" sub="9router primary" />
        <KPI v="1" l="Fallbacks (24h)" c="var(--gold)" sub="OpenAI · quota" />
        <KPI v="$42.10" l="LLM spend today" c="var(--text)" />
        <KPI v="4.4s" l="Avg preview latency" c="var(--sky)" />
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Job</th>
                <th>Provider</th>
                <th style={{ textAlign: 'center' }}>Status</th>
                <th style={{ textAlign: 'right' }} className="hide-mobile">Latency</th>
                <th style={{ textAlign: 'right' }}>Last run</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {WC.aiJobs.map((j: AiJob, i: number) => (
                <tr key={i}>
                  <td className="mono small">{j.name}</td>
                  <td className="small t2">{j.provider}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span className="row gap-6 center">
                      <JobDot st={j.status} />
                      <span className="tiny" style={{ textTransform: 'capitalize' }}>{j.status}</span>
                    </span>
                  </td>
                  <td className="tnum tiny t2 hide-mobile" style={{ textAlign: 'right' }}>{j.latency}</td>
                  <td className="tiny muted" style={{ textAlign: 'right' }}>{j.last} ago</td>
                  <td style={{ textAlign: 'right' }}><button className="btn-icon btn-ghost"><Icon name="refresh" size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="card-2 card-pad mt-12 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)' }}>
        <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none' }} />
        <span><b>pundit.preview</b> fell back to OpenAI after Claude hit its quota. <b>news.crawl</b> failed (source 503) — retry queued.</span>
      </div>
    </div>
  );
}

/* ===================== AUDIT ===================== */
const MOCK_AUDIT: [string, string, string, string, string][] = [
  ['admin.ban', 'Hằng banned banned_joe', 'real-money abuse', '14:32', 'danger'],
  ['data.override', 'Tú corrected score ESP 3-2 GER', 'API mismatch', '13:50', 'gold'],
  ['news.approve', 'Hằng published "Host cities…"', '—', '13:21', 'green'],
  ['auth.login', 'ghost_08 login · 113.161.x.x', 'flagged cluster', '12:58', 'muted'],
  ['point.revoke', 'Hằng revoked 1,200 pts · ghost_07', 'fraud', '12:40', 'danger'],
  ['settle.run', 'Auto-settled FRA 2-1 SUI', 'idempotent', '12:05', 'sky'],
];

function AdmAudit() {
  const [log, setLog] = useState<[string, string, string, string, string][]>(MOCK_AUDIT);
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

/* ===================== ODDS EDIT MODAL ===================== */
function OddsEditModal({ m, onClose, onSave }: { m: LocalMatch; onClose: () => void; onSave: (id: number, mh: number, md: number, ma: number) => void }) {
  const home = WC.byId(m.home), away = WC.byId(m.away);
  const [mh, setMh] = useState(m.odds.mh);
  const [md, setMd] = useState(m.odds.md);
  const [ma, setMa] = useState(m.odds.ma);
  const [reason, setReason] = useState('');
  const num = (v: number, set: (n: number) => void) => (
    <input className="input input-mono" type="number" step="0.01" min="0.1" value={v}
      onChange={e => set(Math.max(0.1, +e.target.value || 0.1))}
      style={{ textAlign: 'center', fontSize: 18 }} />
  );
  const marginNum = ((1 / mh) + (1 / md) + (1 / ma)) * 100 - 100;
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between">
            <span className="eyebrow">Adjust prediction odds</span>
            <button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button>
          </div>
          <div className="row gap-8 mt-8">
            <Flag team={home} size={22} />
            <span className="small">{home.code} v {away.code}</span>
            <span className="tiny muted">· {m.stage}</span>
          </div>
          <div className="row gap-10 mt-16">
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>1 · {home.code}</label>{num(mh, setMh)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>X · Draw</label>{num(md, setMd)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>2 · {away.code}</label>{num(ma, setMa)}</div>
          </div>
          <div className="card-2 card-pad mt-16 row between small" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="t2">Implied book margin</span>
            <span className="tnum" style={{ fontWeight: 700, color: Math.abs(marginNum) > 12 ? 'var(--gold)' : 'var(--green)' }}>{marginNum.toFixed(1)}%</span>
          </div>
          <div className="field mt-12">
            <label className="label">Reason (audit)</label>
            <input className="input" placeholder="e.g. injury news / sharp money" value={reason} onChange={e => setReason(e.target.value)} />
          </div>
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={!reason.trim()} onClick={() => onSave(m.id, mh, md, ma)}>Publish new odds</Btn>
          <p className="tiny muted mt-8" style={{ textAlign: 'center' }}>Existing open bets keep the odds they were placed at.</p>
        </div>
      </div>
    </div>
  );
}

/* ===================== ADMIN MATCH DETAIL ===================== */
function AdmMatchDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const base = WC.matchById(id)!;
  const [m, setM] = useState<LocalMatch>({ ...base, locked: base.status !== 'SCHEDULED' });
  const [edit, setEdit] = useState<LocalMatch | null>(null);
  const [editOdds, setEditOdds] = useState<LocalMatch | null>(null);
  const home = WC.byId(m.home), away = WC.byId(m.away);
  const live = m.status === 'LIVE', fin = m.status === 'FINISHED';
  const dist: Record<string, number> = { '1': 58, 'X': 17, '2': 25 };
  const vol = 184200;

  const distRows: [string, string, number, string][] = [
    ['1', home.code, dist['1'], 'var(--green)'],
    ['X', 'Draw', dist['X'], 'var(--sky)'],
    ['2', away.code, dist['2'], 'var(--magenta)'],
  ];

  return (
    <div>
      <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to fixtures</button>

      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between">
          <span className="badge badge-muted">{m.stage}</span>
          {live
            ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE {m.minute}&apos;</span>
            : fin
              ? <span className="badge badge-green">Full time</span>
              : <span className="badge badge-sky">{WC.fmtDate(m.date)} · {m.kickoff}</span>}
        </div>
        <div className="row between center" style={{ marginTop: 18 }}>
          <div className="stack center gap-8" style={{ width: 110 }}>
            <Flag team={home} size={52} />
            <span className="small" style={{ fontWeight: 700 }}>{home.name}</span>
            <span className="tiny muted">#{home.rank}</span>
          </div>
          <div style={{ textAlign: 'center' }}>
            {(live || fin)
              ? <div className="display tnum" style={{ fontSize: 44 }}>{m.hs}<span className="muted" style={{ fontSize: 24, padding: '0 8px' }}>:</span>{m.as}</div>
              : <div className="display muted" style={{ fontSize: 28 }}>VS</div>}
            <div className="tiny muted mt-4">{m.venue}</div>
          </div>
          <div className="stack center gap-8" style={{ width: 110 }}>
            <Flag team={away} size={52} />
            <span className="small" style={{ fontWeight: 700 }}>{away.name}</span>
            <span className="tiny muted">#{away.rank}</span>
          </div>
        </div>
      </div>

      <div className="card card-pad mt-16 row between wrap gap-12">
        <div className="row gap-8 wrap-w">
          <Btn variant="ghost" size="sm" icon="trending" onClick={() => setEditOdds(m)}>Adjust odds</Btn>
          <Btn variant="ghost" size="sm" icon="edit" onClick={() => setEdit(m)}>Edit score</Btn>
          <button className="chip" onClick={() => setM(x => ({ ...x, locked: !x.locked }))}>
            <Icon name={m.locked ? 'lock' : 'check'} size={14} style={{ color: m.locked ? 'var(--danger)' : 'var(--green)' }} />
            {m.locked ? 'Betting locked' : 'Betting open'}
          </button>
        </div>
        {m.status !== 'FINISHED' && (
          <Btn variant="primary" size="sm" icon="trophy" onClick={() => {
            setM(x => ({ ...x, status: 'FINISHED', locked: true, hs: x.hs ?? 0, as: x.as ?? 0 }));
            s.toastMsg('Match settled · payouts released', 'trophy', 'var(--green)');
          }}>Settle match</Btn>
        )}
      </div>

      <div className="grid gap-16 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))' }}>
        <div className="card card-pad">
          <span className="eyebrow">Current odds (1 · X · 2)</span>
          <div className="row gap-8 mt-12">
            {([['1', home.code, m.odds.mh], ['X', 'Draw', m.odds.md], ['2', away.code, m.odds.ma]] as [string, string, number][]).map(([k, l, v]) => (
              <div key={k} className="odds" style={{ cursor: 'default' }}>
                <span className="o-label">{k} · {l}</span>
                <span className="o-val">{v.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <Btn variant="ghost" size="sm" className="btn-block mt-12" icon="trending" onClick={() => setEditOdds(m)}>Adjust</Btn>
        </div>
        <div className="card card-pad">
          <div className="row between">
            <span className="eyebrow">Bet distribution</span>
            <span className="tiny muted tnum">{vol.toLocaleString()} pts</span>
          </div>
          <div className="stack gap-10 mt-12">
            {distRows.map(([k, l, pct, c]) => (
              <div key={k}>
                <div className="row between tiny">
                  <span className="t2">{k} · {l}</span>
                  <span className="tnum" style={{ color: c }}>{pct}%</span>
                </div>
                <div className="bar mt-4"><span style={{ width: pct + '%', background: c }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="card card-pad">
          <span className="eyebrow">Data source</span>
          <div className="stack gap-10 mt-12 small">
            <div className="row between"><span className="t2">Fixture feed</span><span className="row gap-6"><JobDot st="ok" />API-Football</span></div>
            <div className="row between"><span className="t2">Odds feed</span><span className="row gap-6"><JobDot st="ok" />The Odds API</span></div>
            <div className="row between"><span className="t2">Last sync</span><span className="tnum t2">2m ago</span></div>
            <div className="row between"><span className="t2">Settlement</span><span className="badge badge-muted">{fin ? 'Done · idempotent' : 'Pending'}</span></div>
          </div>
        </div>
      </div>

      {edit && <ScoreEditModal m={edit} onClose={() => setEdit(null)} onSave={(mid, hs, as_) => {
        setM(x => ({ ...x, hs, as: as_ }));
        setEdit(null);
        s.toastMsg('Score saved · logged to audit', 'check', 'var(--gold)');
      }} />}
      {editOdds && <OddsEditModal m={m} onClose={() => setEditOdds(null)} onSave={(mid, mh_, md_, ma_) => {
        setM(x => ({ ...x, odds: { mh: mh_, md: md_, ma: ma_ } }));
        setEditOdds(null);
        s.toastMsg('Odds updated', 'check', 'var(--sky)');
      }} />}
    </div>
  );
}

/* ===================== ADMIN TEAM DETAIL ===================== */
function AdmTeamDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const t = WC.byId(id);
  const fixtures = WC.matches.filter(m => m.home === t.id || m.away === t.id).slice(0, 4);
  const POS = ['GK', 'GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW', 'FW', 'FW', 'FW', 'FW'];
  return (
    <div>
      <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to teams</button>

      <div className="panel card-pad-lg" style={{ background: `linear-gradient(150deg, ${t.colors[0]}22, var(--bg-2))` }}>
        <div className="row between wrap gap-12">
          <div className="row gap-16">
            <Flag team={t} size={60} />
            <div>
              <h1 className="h2">{t.name}</h1>
              <div className="row gap-8 mt-8">
                <span className="badge badge-muted">Group {t.group}</span>
                <span className="badge badge-sky">FIFA #{t.rank}</span>
                <span className="badge badge-muted">{t.conf}</span>
              </div>
            </div>
          </div>
          <div className="row gap-8">
            <Btn variant="ghost" size="sm" icon="edit" onClick={() => s.toastMsg('Editing team metadata', 'edit', 'var(--sky)')}>Edit info</Btn>
            <Btn variant="ghost" size="sm" icon="refresh" onClick={() => s.toastMsg(`${t.code} squad re-synced`, 'refresh', 'var(--green)')}>Re-sync</Btn>
          </div>
        </div>
      </div>

      <div className="grid gap-12 mt-16" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))' }}>
        <KPI v="26" l="Squad size" c="var(--text)" />
        <KPI v={`${t.w}-${t.d}-${t.l}`} l="W-D-L" c="var(--green)" />
        <KPI v={t.pts ?? 0} l="Group points" c="var(--gold)" />
        <KPI v="0" l="Data conflicts" c="var(--green)" />
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Squad (26) · synced from feed</div>
      <div className="card card-pad">
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(150px,1fr))', gap: 8 }}>
          {POS.map((p, i) => (
            <div key={i} className="row between card-2" style={{ borderRadius: 'var(--r-xs)', padding: '7px 10px' }}>
              <div className="row gap-8 small">
                <span className="tnum muted" style={{ width: 18 }}>{i + 1}</span>
                <span className="t2 ellip">{t.code} Player {i + 1}</span>
              </div>
              <span className="tiny muted">{p}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Fixtures</div>
      <div className="card" style={{ overflow: 'hidden' }}>
        {fixtures.map((fix, i) => {
          const h = WC.byId(fix.home), a = WC.byId(fix.away);
          return (
            <div key={fix.id} className="row between" style={{ padding: '12px 16px', borderBottom: i < fixtures.length - 1 ? '1px solid var(--line)' : 0 }}>
              <div className="row gap-8">
                <Flag team={h} size={18} />
                <span className="small">{h.code} v {a.code}</span>
                <span className="tiny muted">{fix.stage}</span>
              </div>
              <div className="row gap-8">
                {fix.status === 'FINISHED'
                  ? <span className="tnum small">{fix.hs}-{fix.as}</span>
                  : <span className="tiny muted">{WC.fmtDate(fix.date)}</span>}
                <span className={`badge badge-${fix.status === 'FINISHED' ? 'green' : fix.status === 'LIVE' ? 'magenta' : 'muted'}`}>
                  {fix.status === 'FINISHED' ? 'FT' : fix.status === 'LIVE' ? 'LIVE' : 'Sched'}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== ADMIN NEWS REVIEW DETAIL ===================== */
function AdmNewsDetail({ id, onBack, s }: { id: number; onBack: () => void; s: ScreenProps['s'] }) {
  const a = WC.reviewQueue.find(x => x.id === id) || WC.reviewQueue[0];
  const [status, setStatus] = useState(a.status);
  const act = (st: string, msg: string, icon: string, color: string) => { setStatus(st); s.toastMsg(msg, icon, color); };
  return (
    <div>
      <button className="chip" onClick={onBack} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back to review queue</button>

      <div className="grid gap-16" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)', alignItems: 'start' }}>
        <div className="panel card-pad-lg">
          <div className="row between">
            <span className="badge badge-sky">{a.tag}</span>
            <span className={`badge badge-${status === 'APPROVED' ? 'green' : status === 'REJECTED' ? 'danger' : 'muted'}`}>{status}</span>
          </div>
          <h1 className="h2 mt-12">{a.title}</h1>
          <div className="row gap-12 mt-12 tiny muted">
            <span>Source · {a.src}</span><span>·</span>
            <span className="badge badge-muted">✨ AI draft · Claude</span>
          </div>
          <div style={{ height: 160, borderRadius: 'var(--r-md)', background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', display: 'grid', placeItems: 'center', margin: '18px 0' }}>
            <Icon name="news" size={36} className="muted" />
          </div>
          <div className="stack gap-14" style={{ fontSize: 15, lineHeight: 1.7, color: 'var(--text-2)' }}>
            <p>{a.title}. As the first multi-host World Cup heats up across the United States, Canada and Mexico, every result is reshaping the projected knockout picture.</p>
            <p>Analysts point to squad depth and the new 48-team math, where goal difference matters from the very first whistle. The draft below was generated from the cited source and is awaiting editorial sign-off.</p>
            <p>Coaches managing minutes through the longer group stage look best placed for the gauntlet ahead, with set pieces likely to decide the tightest ties.</p>
          </div>
        </div>

        <div className="stack gap-16">
          <div className="card card-pad">
            <span className="eyebrow">Grounding check</span>
            <div className="row between mt-12">
              <span className="small t2">Confidence</span>
              <span className="tnum" style={{ fontWeight: 700, color: a.conf > 85 ? 'var(--green)' : 'var(--gold)' }}>{a.conf}%</span>
            </div>
            <div className="bar mt-8"><span style={{ width: a.conf + '%', background: a.conf > 85 ? 'var(--green)' : 'var(--gold)' }} /></div>
            {a.warn && (
              <div className="card-2 card-pad mt-12 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)' }}>
                <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none' }} />
                <span>Contains an unverified transfer claim — confirm against a second source before approving.</span>
              </div>
            )}
          </div>

          <div className="card card-pad">
            <span className="eyebrow">Sources</span>
            <div className="stack gap-8 mt-12 small">
              <div className="row gap-8"><Icon name="news" size={14} className="muted" /><a className="text-sky ellip">{a.src.toLowerCase()}.com/wc26/…</a></div>
              <div className="row between"><span className="t2">Verbatim overlap</span><span className="tnum text-green">3%</span></div>
              <div className="row between"><span className="t2">Citations linked</span><span className="badge badge-green">Yes</span></div>
            </div>
          </div>

          <div className="card card-pad">
            <span className="eyebrow">Decision</span>
            <div className="stack gap-8 mt-12">
              <Btn variant="primary" className="btn-block" icon="check" disabled={status !== 'PENDING'} onClick={() => act('APPROVED', 'Story approved & published', 'check', 'var(--green)')}>Approve & publish</Btn>
              <Btn variant="ghost" className="btn-block" icon="edit" onClick={() => s.toastMsg('Opening inline editor', 'edit', 'var(--sky)')}>Edit draft</Btn>
              <div className="row gap-8">
                <Btn variant="ghost" size="sm" className="grow" onClick={() => s.toastMsg('Sent back for changes', 'refresh', 'var(--gold)')}>Request changes</Btn>
                <Btn variant="danger" size="sm" className="grow" icon="x" disabled={status !== 'PENDING'} onClick={() => act('REJECTED', 'Story rejected', 'x', 'var(--danger)')}>Reject</Btn>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
