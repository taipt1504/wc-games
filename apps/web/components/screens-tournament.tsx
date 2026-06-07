'use client';
/* GOLAZO — Teams · Team detail · Groups · Bracket — real data from /api/v1 (Phase 2A-2). */
import React, { useState, useEffect, useCallback } from 'react';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Pundit, SecHead } from '@/components/ui';
import { FormationPitch } from '@/components/formation-pitch';

/* ---- API shapes (apps/web/app/api/v1) ---- */
interface ApiTeam { id: number; name: string; code: string | null; flagUrl: string | null; fifaRank: number | null; group: string | null }
interface ApiTeamLite { id: number; name: string; code: string | null; flagUrl: string | null }
interface ApiFixture {
  id: number; round: string; status: string; kickoffAt: string;
  home: ApiTeamLite | null; away: ApiTeamLite | null;
  scoreHome: number | null; scoreAway: number | null; result: string | null;
}
interface ApiPlayer { name: string; position: string | null; number: number | null; starter?: boolean }
interface ApiTeamDetail extends ApiTeam { formation: string | null; manager: string | null; players: ApiPlayer[]; matches: ApiFixture[] }
interface ApiStanding { id: number; name: string; code: string | null; flagUrl: string | null; played: number; won: number; drawn: number; lost: number; gf: number; ga: number; gd: number; pts: number }
interface ApiGroup { name: string; teams: ApiStanding[] }

const GROUPS = 'ABCDEFGHIJKL'.split('');

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

/* ===================== TEAMS ===================== */
export function Teams({ s }: ScreenProps) {
  const [group, setGroup] = useState('all');
  const { data: teams, loading } = useJson<ApiTeam[]>('/api/v1/teams');
  const list = (teams ?? []).filter((t) => group === 'all' || t.group === group);

  return (
    <div className="page fade-up">
      <SecHead title="Teams" sub="All 48 nations at World Cup 2026" />
      <div className="row gap-8 wrap-w" style={{ marginBottom: 18 }}>
        <button className={`chip ${group === 'all' ? 'active' : ''}`} onClick={() => setGroup('all')}>All</button>
        {GROUPS.map((g) => (
          <button key={g} className={`chip ${group === g ? 'active' : ''}`} onClick={() => setGroup(g)}>Grp {g}</button>
        ))}
      </div>
      {loading ? <p className="muted small">Loading teams…</p>
        : list.length === 0 ? <p className="muted small">No teams found.</p>
          : (
            <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))' }}>
              {list.map((t) => (
                <div key={t.id} className="card card-pad card-hover pointer" onClick={() => s.go('team', { id: t.id })}>
                  <div className="row between"><Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={40} /><span className="badge badge-muted">Grp {t.group ?? '—'}</span></div>
                  <div className="h3 mt-12" style={{ fontSize: 16 }}>{t.name}</div>
                  <div className="row between mt-4">
                    <span className="tiny muted">{t.fifaRank ? `FIFA #${t.fifaRank}` : t.code}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}

/* ===================== TEAM DETAIL ===================== */
export function TeamDetail({ s }: ScreenProps) {
  const id = Number(s.param.id);
  const { data: t, loading } = useJson<ApiTeamDetail>(`/api/v1/teams/${id}`);

  if (loading) return <div className="page page-narrow fade-up"><p className="muted small">Loading…</p></div>;
  if (!t) return <div className="page page-narrow fade-up"><button className="chip" onClick={() => s.back()}><Icon name="chevL" size={14} /> Back</button><p className="muted small mt-16">Team not found.</p></div>;

  // Record from this team's FINISHED group matches (PRD §15: derived from results).
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (const m of t.matches) {
    if (m.round !== 'GROUP' || m.status !== 'FINISHED' || m.scoreHome == null || m.scoreAway == null) continue;
    const isHome = m.home?.id === t.id;
    const own = isHome ? m.scoreHome : m.scoreAway;
    const opp = isHome ? m.scoreAway : m.scoreHome;
    gf += own; ga += opp;
    if (own > opp) w++; else if (own < opp) l++; else d++;
  }
  const pts = w * 3 + d, gd = gf - ga;
  const fixtures = t.matches.slice(0, 6);

  return (
    <div className="page page-narrow fade-up">
      <button className="chip" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back</button>
      <div className="panel card-pad-lg">
        <div className="row gap-16">
          <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={72} />
          <div>
            <h1 className="h2">{t.name}</h1>
            <div className="row gap-8 mt-8">
              <span className="badge badge-muted">Group {t.group ?? '—'}</span>
              {t.fifaRank && <span className="badge badge-sky">FIFA #{t.fifaRank}</span>}
              {t.code && <span className="badge badge-muted">{t.code}</span>}
            </div>
          </div>
        </div>
        <div className="row gap-20 mt-16">
          <div className="stat"><span className="s-val tnum">{w}-{d}-{l}</span><span className="s-lbl">W-D-L</span></div>
          <div className="stat"><span className="s-val tnum">{pts}</span><span className="s-lbl">Points</span></div>
          <div className="stat"><span className="s-val tnum">{gd > 0 ? '+' : ''}{gd}</span><span className="s-lbl">Goal diff</span></div>
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Fixtures</div>
      <div className="stack gap-8">
        {fixtures.length === 0 ? <p className="muted small">No fixtures yet.</p> : fixtures.map((m) => (
          <div key={m.id} className="card card-pad row between" style={{ padding: '10px 14px' }}>
            <div className="row gap-10" style={{ minWidth: 0 }}>
              <span className="badge badge-muted" style={{ minWidth: 52, justifyContent: 'center' }}>{m.round === 'GROUP' ? 'Group' : m.round}</span>
              <span className="small ellip">{m.home?.code ?? m.home?.name ?? 'TBD'} <span className="muted">v</span> {m.away?.code ?? m.away?.name ?? 'TBD'}</span>
            </div>
            <span className="tnum tiny muted">
              {m.status === 'FINISHED' ? `${m.scoreHome}–${m.scoreAway}` : new Date(m.kickoffAt).toLocaleDateString()}
            </span>
          </div>
        ))}
      </div>

      <div className="row between mt-24" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Squad</span>
        {t.players.length > 0 && <span className="badge badge-sky" title="Squad compiled by AI from public sources">AI-assisted</span>}
      </div>
      {t.players.length === 0 ? (
        <div className="card card-pad row gap-10"><Icon name="users" size={18} className="muted" /><p className="small muted" style={{ margin: 0 }}>Squad coming soon.</p></div>
      ) : (
        <FormationPitch players={t.players} formation={t.formation} manager={t.manager} />
      )}
    </div>
  );
}

/* ===================== GROUPS ===================== */
export function Groups({ s }: ScreenProps) {
  const { data: groups, loading } = useJson<ApiGroup[]>('/api/v1/groups');
  return (
    <div className="page fade-up">
      <SecHead title="Group standings" sub="12 groups · top 2 plus best thirds advance" />
      {loading ? <p className="muted small">Loading standings…</p> : (
        <div className="grid gap-16" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
          {(groups ?? []).map((g) => (
            <div key={g.name} className="card" style={{ overflow: 'hidden' }}>
              <div className="row between card-pad" style={{ paddingBottom: 10 }}>
                <span className="h3">Group {g.name}</span>
                <span className="tiny muted">Matchday 1–3</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr><th>#</th><th>Team</th><th style={{ textAlign: 'center' }}>P</th><th style={{ textAlign: 'center' }}>GD</th><th style={{ textAlign: 'center' }}>Pts</th></tr>
                </thead>
                <tbody>
                  {g.teams.map((t, i) => (
                    <tr key={t.id} className={i < 2 ? 'hl' : ''} style={{ cursor: 'pointer' }} onClick={() => s.go('team', { id: t.id })}>
                      <td className="tnum" style={{ color: i < 2 ? 'var(--green)' : 'var(--muted)' }}>{i + 1}</td>
                      <td><div className="row gap-8"><Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={22} /><span className="small ellip" style={{ fontWeight: 600 }}>{t.code ?? t.name}</span></div></td>
                      <td className="tnum t2" style={{ textAlign: 'center' }}>{t.played}</td>
                      <td className="tnum t2" style={{ textAlign: 'center' }}>{t.gd > 0 ? '+' : ''}{t.gd}</td>
                      <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>{t.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ===================== BRACKET ===================== */
interface BracketPicks { CHAMPION?: number; FINALISTS?: number[]; SEMIS?: number[] }

export function Bracket({ s }: ScreenProps) {
  const { data: groups } = useJson<ApiGroup[]>('/api/v1/groups');
  const { data: allTeams } = useJson<ApiTeam[]>('/api/v1/teams');

  // Projected qualifiers (top 2 of each group) from current standings — pre-tournament these
  // tie at 0 and fall back to group order. Honest "projected" view; real draw fills in later.
  const winners = (groups ?? []).map((g) => g.teams[0]).filter(Boolean) as ApiStanding[];
  const seconds = (groups ?? []).map((g) => g.teams[1]).filter(Boolean) as ApiStanding[];
  const pool = [...winners, ...seconds];
  const pick = (i: number): ApiStanding | null => (pool.length ? pool[i % pool.length] : null);

  const [panelOpen, setPanelOpen] = useState(false);
  const [picks, setPicks] = useState<BracketPicks>({});
  const [saving, setSaving] = useState(false);

  const fetchPicks = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/me/bracket');
      if (res.ok) { const json = await res.json(); setPicks(json.data?.picks ?? {}); }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => { if (panelOpen && s.authed) fetchPicks(); }, [panelOpen, s.authed, fetchPicks]);

  function toggleChip(field: keyof BracketPicks, id: number, max?: number): void {
    if (field === 'CHAMPION') { setPicks((p) => ({ ...p, CHAMPION: p.CHAMPION === id ? undefined : id })); return; }
    setPicks((p) => {
      const arr: number[] = (p[field] as number[] | undefined) ?? [];
      if (arr.includes(id)) return { ...p, [field]: arr.filter((x) => x !== id) };
      if (arr.length >= (max ?? 99)) return p;
      return { ...p, [field]: [...arr, id] };
    });
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/me/bracket', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ picks }) });
      if (res.ok) { s.toastMsg('Bracket saved!', 'trophy', 'var(--gold)'); setPanelOpen(false); }
      else {
        const json = await res.json().catch(() => ({}));
        const code = json?.error?.code ?? 'ERROR';
        if (code === 'BRACKET_LOCKED') s.toastMsg('Bracket is locked', 'lock', 'var(--muted)');
        else s.toastMsg('Could not save bracket', 'alert', 'var(--red)');
      }
    } catch { s.toastMsg('Could not save bracket', 'alert', 'var(--red)'); }
    finally { setSaving(false); }
  }

  function BracketMatch({ a, b, hot }: { a: ApiStanding | null; b: ApiStanding | null; hot?: boolean }) {
    return (
      <div className="card card-pad" style={{ padding: '10px 12px', minWidth: 180, borderColor: hot ? 'rgba(255,77,141,.35)' : 'var(--line)' }}>
        {[a, b].map((t, i) => (
          <div key={i} className="row between" style={{ padding: '3px 0' }}>
            <div className="row gap-8" style={{ minWidth: 0 }}>
              {t ? <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={20} /> : <span style={{ width: 20 }} />}
              <span className="small ellip" style={{ fontWeight: i === 0 ? 700 : 500 }}>{t?.code ?? 'TBD'}</span>
            </div>
            <span className="tnum tiny" style={{ color: 'var(--muted)' }}>–</span>
          </div>
        ))}
      </div>
    );
  }

  function Col({ title, count, start }: { title: string; count: number; start: number }) {
    return (
      <div className="stack" style={{ justifyContent: 'space-around', gap: 14, minWidth: 196 }}>
        <div className="eyebrow" style={{ textAlign: 'center' }}>{title}</div>
        {Array.from({ length: count }).map((_, i) => (
          <BracketMatch key={i} a={pick(start + i * 2)} b={pick(start + i * 2 + 1)} hot={i === 0 && title === 'Final'} />
        ))}
      </div>
    );
  }

  const champion = winners[0] ?? null;

  return (
    <div className="page fade-up">
      <SecHead title="Knockout bracket" sub="Round of 32 → Final · projected from current standings" />
      <div className="card card-pad" style={{ overflowX: 'auto' }}>
        <div className="row" style={{ gap: 28, alignItems: 'stretch', minWidth: 1100, padding: '8px 0' }}>
          <Col title="Round of 32" count={8} start={0} />
          <Col title="Round of 16" count={4} start={4} />
          <Col title="Quarter-finals" count={2} start={8} />
          <Col title="Semi-finals" count={2} start={2} />
          <Col title="Final" count={1} start={0} />
          <div className="stack center" style={{ minWidth: 140, justifyContent: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Champion</div>
            <div className="card card-pad" style={{ textAlign: 'center', background: 'linear-gradient(150deg,var(--gold-soft),transparent)', borderColor: 'rgba(255,200,61,.4)' }}>
              <Icon name="trophy" size={28} style={{ color: 'var(--gold)' }} />
              {champion && <Flag flagUrl={champion.flagUrl ?? undefined} name={champion.name} code={champion.code ?? undefined} size={40} />}
              <div className="small mt-8" style={{ fontWeight: 700 }}>{champion?.name ?? 'TBD'}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card card-pad mt-16 row between wrap gap-12" style={{ background: 'linear-gradient(120deg,var(--sky-soft),transparent)' }}>
        <div className="row gap-12">
          <Pundit size={48} mood="idle" />
          <div>
            <div style={{ fontWeight: 700 }}>Predict the whole bracket</div>
            <div className="tiny t2">Fill every knockout tie and earn bonus points for each correct round.</div>
          </div>
        </div>
        <Btn variant="primary" size="sm" onClick={() => { if (!s.authed) { s.go('auth', { mode: 'signup' }); return; } setPanelOpen((o) => !o); }}>Open predictor</Btn>
      </div>

      {panelOpen && s.authed && (
        <div className="card card-pad mt-16 fade-up" aria-label="Bracket predictor panel">
          <div className="row between" style={{ marginBottom: 16 }}>
            <span className="h3">Your bracket picks</span>
            <button className="chip" onClick={() => setPanelOpen(false)}><Icon name="x" size={14} /> Close</button>
          </div>
          <PickSection label="Champion" subtitle="Pick 1 team" teams={allTeams ?? []} selected={picks.CHAMPION !== undefined ? [picks.CHAMPION] : []} onToggle={(id) => toggleChip('CHAMPION', id)} />
          <PickSection label="Finalists" subtitle="Pick up to 2 teams" teams={allTeams ?? []} selected={picks.FINALISTS ?? []} onToggle={(id) => toggleChip('FINALISTS', id, 2)} />
          <PickSection label="Semi-finalists" subtitle="Pick up to 4 teams" teams={allTeams ?? []} selected={picks.SEMIS ?? []} onToggle={(id) => toggleChip('SEMIS', id, 4)} />
          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save picks'}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function PickSection({ label, subtitle, teams, selected, onToggle }: {
  label: string; subtitle: string; teams: ApiTeam[]; selected: number[]; onToggle: (id: number) => void;
}) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="tiny muted" style={{ marginBottom: 10 }}>{subtitle}</div>
      <div className="row gap-8 wrap-w">
        {teams.map((t) => (
          <button key={t.id} className={`chip ${selected.includes(t.id) ? 'active' : ''}`} onClick={() => onToggle(t.id)} title={t.name}>
            <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={16} />
            <span style={{ marginLeft: 4 }}>{t.code ?? t.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
