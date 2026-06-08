'use client';
/* World Cup Games — Teams · Team detail · Groups · Bracket — real data from /api/v1 (Phase 2A-2). */
import React, { useState, useEffect, useCallback } from 'react';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Pundit, SecHead } from '@/components/ui';
import { FormationPitch } from '@/components/formation-pitch';
import { useT } from '@/lib/i18n/hooks';

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
  const { t } = useT();
  const [group, setGroup] = useState('all');
  const { data: teams, loading } = useJson<ApiTeam[]>('/api/v1/teams');
  const list = (teams ?? []).filter((tm) => group === 'all' || tm.group === group);

  return (
    <div className="page fade-up">
      <SecHead title={t('tournament.teamsTitle')} sub={t('tournament.teamsSub')} />
      <div className="row gap-8 wrap-w" style={{ marginBottom: 18 }}>
        <button className={`chip ${group === 'all' ? 'active' : ''}`} onClick={() => setGroup('all')}>{t('tournament.all')}</button>
        {GROUPS.map((g) => (
          <button key={g} className={`chip ${group === g ? 'active' : ''}`} onClick={() => setGroup(g)}>{t('tournament.grp', { g })}</button>
        ))}
      </div>
      {loading ? <p className="muted small">{t('tournament.loadingTeams')}</p>
        : list.length === 0 ? <p className="muted small">{t('tournament.noTeams')}</p>
          : (
            <div className="grid-fill" style={{ '--col-min': '168px', '--gap': '12px' } as React.CSSProperties}>
              {list.map((tm) => (
                <div key={tm.id} className="card card-pad card-hover pointer" onClick={() => s.go('team', { id: tm.id })}>
                  <div className="row between"><Flag flagUrl={tm.flagUrl ?? undefined} name={tm.name} code={tm.code ?? undefined} size={40} /><span className="badge badge-muted">{t('tournament.grp', { g: tm.group ?? '—' })}</span></div>
                  <div className="h3 mt-12" style={{ fontSize: 16 }}>{tm.name}</div>
                  <div className="row between mt-4">
                    <span className="tiny muted">{tm.fifaRank ? t('tournament.fifaShort', { n: tm.fifaRank }) : tm.code}</span>
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
  const { t, fmt } = useT();
  const id = Number(s.param.id);
  const { data: tm, loading } = useJson<ApiTeamDetail>(`/api/v1/teams/${id}`);

  if (loading) return <div className="page page-narrow fade-up"><p className="muted small">{t('common.loading')}</p></div>;
  if (!tm) return <div className="page page-narrow fade-up"><button className="chip" onClick={() => s.back()}><Icon name="chevL" size={14} /> {t('common.back')}</button><p className="muted small mt-16">{t('tournament.teamNotFound')}</p></div>;

  // Record from this team's FINISHED group matches (PRD §15: derived from results).
  let w = 0, d = 0, l = 0, gf = 0, ga = 0;
  for (const m of tm.matches) {
    if (m.round !== 'GROUP' || m.status !== 'FINISHED' || m.scoreHome == null || m.scoreAway == null) continue;
    const isHome = m.home?.id === tm.id;
    const own = isHome ? m.scoreHome : m.scoreAway;
    const opp = isHome ? m.scoreAway : m.scoreHome;
    gf += own; ga += opp;
    if (own > opp) w++; else if (own < opp) l++; else d++;
  }
  const pts = w * 3 + d, gd = gf - ga;
  const fixtures = tm.matches.slice(0, 6);

  return (
    <div className="page page-narrow fade-up">
      <button className="chip" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> {t('common.back')}</button>
      <div className="panel card-pad-lg">
        <div className="row gap-16">
          <Flag flagUrl={tm.flagUrl ?? undefined} name={tm.name} code={tm.code ?? undefined} size={72} />
          <div>
            <h1 className="h2">{tm.name}</h1>
            <div className="row gap-8 mt-8">
              <span className="badge badge-muted">{t('tournament.group', { g: tm.group ?? '—' })}</span>
              {tm.fifaRank && <span className="badge badge-sky">{t('tournament.fifaShort', { n: tm.fifaRank })}</span>}
              {tm.code && <span className="badge badge-muted">{tm.code}</span>}
            </div>
          </div>
        </div>
        <div className="row gap-20 mt-16">
          <div className="stat"><span className="s-val tnum">{w}-{d}-{l}</span><span className="s-lbl">{t('tournament.wdl')}</span></div>
          <div className="stat"><span className="s-val tnum">{pts}</span><span className="s-lbl">{t('tournament.points')}</span></div>
          <div className="stat"><span className="s-val tnum">{gd > 0 ? '+' : ''}{gd}</span><span className="s-lbl">{t('tournament.goalDiff')}</span></div>
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>{t('tournament.fixtures')}</div>
      <div className="stack gap-8">
        {fixtures.length === 0 ? <p className="muted small">{t('tournament.noFixtures')}</p> : fixtures.map((m) => (
          <div key={m.id} className="card card-pad row between" style={{ padding: '10px 14px' }}>
            <div className="row gap-10" style={{ minWidth: 0 }}>
              <span className="badge badge-muted" style={{ minWidth: 52, justifyContent: 'center' }}>{m.round === 'GROUP' ? t('round.groupPrefix') : m.round}</span>
              <span className="small ellip">{m.home?.code ?? m.home?.name ?? t('match.tbd')} <span className="muted">v</span> {m.away?.code ?? m.away?.name ?? t('match.tbd')}</span>
            </div>
            <span className="tnum tiny muted">
              {m.status === 'FINISHED' ? `${m.scoreHome}–${m.scoreAway}` : fmt.date(m.kickoffAt)}
            </span>
          </div>
        ))}
      </div>

      <div className="row between mt-24" style={{ marginBottom: 12 }}>
        <span className="eyebrow">{t('tournament.squad')}</span>
        {tm.players.length > 0 && <span className="badge badge-sky" title={t('tournament.squadTitle')}>{t('tournament.aiAssisted')}</span>}
      </div>
      {tm.players.length === 0 ? (
        <div className="card card-pad row gap-10"><Icon name="users" size={18} className="muted" /><p className="small muted" style={{ margin: 0 }}>{t('tournament.squadSoon')}</p></div>
      ) : (
        <FormationPitch players={tm.players} formation={tm.formation} manager={tm.manager} />
      )}
    </div>
  );
}

/* ===================== GROUPS ===================== */
export function Groups({ s }: ScreenProps) {
  const { t } = useT();
  const { data: groups, loading } = useJson<ApiGroup[]>('/api/v1/groups');
  return (
    <div className="page fade-up">
      <SecHead title={t('tournament.groupsTitle')} sub={t('tournament.groupsSub')} />
      {loading ? <p className="muted small">{t('tournament.loadingStandings')}</p> : (
        <div className="grid-fill" style={{ '--col-min': '320px', '--gap': '16px' } as React.CSSProperties}>
          {(groups ?? []).map((g) => (
            <div key={g.name} className="card" style={{ overflow: 'hidden' }}>
              <div className="row between card-pad" style={{ paddingBottom: 10 }}>
                <span className="h3">{t('tournament.group', { g: g.name })}</span>
                <span className="tiny muted">{t('tournament.matchday')}</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr><th>{t('tournament.colRank')}</th><th>{t('tournament.colTeam')}</th><th style={{ textAlign: 'center' }}>{t('tournament.colP')}</th><th style={{ textAlign: 'center' }}>{t('tournament.colGD')}</th><th style={{ textAlign: 'center' }}>{t('tournament.colPts')}</th></tr>
                </thead>
                <tbody>
                  {g.teams.map((tm, i) => (
                    <tr key={tm.id} className={i < 2 ? 'hl' : ''} style={{ cursor: 'pointer' }} onClick={() => s.go('team', { id: tm.id })}>
                      <td className="tnum" style={{ color: i < 2 ? 'var(--green)' : 'var(--muted)' }}>{i + 1}</td>
                      <td><div className="row gap-8"><Flag flagUrl={tm.flagUrl ?? undefined} name={tm.name} code={tm.code ?? undefined} size={22} /><span className="small ellip" style={{ fontWeight: 600 }}>{tm.code ?? tm.name}</span></div></td>
                      <td className="tnum t2" style={{ textAlign: 'center' }}>{tm.played}</td>
                      <td className="tnum t2" style={{ textAlign: 'center' }}>{tm.gd > 0 ? '+' : ''}{tm.gd}</td>
                      <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>{tm.pts}</td>
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
  const { t } = useT();
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
      if (res.ok) { s.toastMsg(t('tournament.bracketSaved'), 'trophy', 'var(--gold)'); setPanelOpen(false); }
      else {
        const json = await res.json().catch(() => ({}));
        const code = json?.error?.code ?? 'ERROR';
        if (code === 'BRACKET_LOCKED') s.toastMsg(t('tournament.bracketLocked'), 'lock', 'var(--muted)');
        else s.toastMsg(t('tournament.bracketSaveFail'), 'alert', 'var(--red)');
      }
    } catch { s.toastMsg(t('tournament.bracketSaveFail'), 'alert', 'var(--red)'); }
    finally { setSaving(false); }
  }

  function BracketMatch({ a, b, hot }: { a: ApiStanding | null; b: ApiStanding | null; hot?: boolean }) {
    return (
      <div className="card card-pad" style={{ padding: '10px 12px', minWidth: 180, borderColor: hot ? 'rgba(255,77,141,.35)' : 'var(--line)' }}>
        {[a, b].map((tm, i) => (
          <div key={i} className="row between" style={{ padding: '3px 0' }}>
            <div className="row gap-8" style={{ minWidth: 0 }}>
              {tm ? <Flag flagUrl={tm.flagUrl ?? undefined} name={tm.name} code={tm.code ?? undefined} size={20} /> : <span style={{ width: 20 }} />}
              <span className="small ellip" style={{ fontWeight: i === 0 ? 700 : 500 }}>{tm?.code ?? t('match.tbd')}</span>
            </div>
            <span className="tnum tiny" style={{ color: 'var(--muted)' }}>–</span>
          </div>
        ))}
      </div>
    );
  }

  function Col({ title, count, start, final }: { title: string; count: number; start: number; final?: boolean }) {
    return (
      <div className="stack" style={{ justifyContent: 'space-around', gap: 14, minWidth: 196 }}>
        <div className="eyebrow" style={{ textAlign: 'center' }}>{title}</div>
        {Array.from({ length: count }).map((_, i) => (
          <BracketMatch key={i} a={pick(start + i * 2)} b={pick(start + i * 2 + 1)} hot={i === 0 && final} />
        ))}
      </div>
    );
  }

  const champion = winners[0] ?? null;

  return (
    <div className="page fade-up">
      <SecHead title={t('tournament.bracketTitle')} sub={t('tournament.bracketSub')} />
      <div className="card card-pad scroll-x">
        <div className="row" style={{ gap: 28, alignItems: 'stretch', minWidth: 1100, padding: '8px 0' }}>
          <Col title={t('round.R32')} count={8} start={0} />
          <Col title={t('round.R16')} count={4} start={4} />
          <Col title={t('round.QF')} count={2} start={8} />
          <Col title={t('round.SF')} count={2} start={2} />
          <Col title={t('round.FINAL')} count={1} start={0} final />
          <div className="stack center" style={{ minWidth: 140, justifyContent: 'center' }}>
            <div className="eyebrow" style={{ marginBottom: 10 }}>{t('tournament.champion')}</div>
            <div className="card card-pad" style={{ textAlign: 'center', background: 'linear-gradient(150deg,var(--gold-soft),transparent)', borderColor: 'rgba(255,200,61,.4)' }}>
              <Icon name="trophy" size={28} style={{ color: 'var(--gold)' }} />
              {champion && <Flag flagUrl={champion.flagUrl ?? undefined} name={champion.name} code={champion.code ?? undefined} size={40} />}
              <div className="small mt-8" style={{ fontWeight: 700 }}>{champion?.name ?? t('match.tbd')}</div>
            </div>
          </div>
        </div>
      </div>
      <div className="card card-pad mt-16 row between wrap wrap-w gap-12" style={{ background: 'linear-gradient(120deg,var(--sky-soft),transparent)' }}>
        <div className="row gap-12">
          <Pundit size={48} mood="idle" />
          <div>
            <div style={{ fontWeight: 700 }}>{t('tournament.predictWhole')}</div>
            <div className="tiny t2">{t('tournament.predictSub')}</div>
          </div>
        </div>
        <Btn variant="primary" size="sm" onClick={() => { if (!s.authed) { s.go('auth', { mode: 'signup' }); return; } setPanelOpen((o) => !o); }}>{t('tournament.openPredictor')}</Btn>
      </div>

      {panelOpen && s.authed && (
        <div className="card card-pad mt-16 fade-up" aria-label={t('tournament.predictorPanel')}>
          <div className="row between" style={{ marginBottom: 16 }}>
            <span className="h3">{t('tournament.yourPicks')}</span>
            <button className="chip" onClick={() => setPanelOpen(false)}><Icon name="x" size={14} /> {t('common.close')}</button>
          </div>
          <PickSection label={t('tournament.champion')} subtitle={t('tournament.championSub')} teams={allTeams ?? []} selected={picks.CHAMPION !== undefined ? [picks.CHAMPION] : []} onToggle={(id) => toggleChip('CHAMPION', id)} />
          <PickSection label={t('tournament.finalists')} subtitle={t('tournament.finalistsSub')} teams={allTeams ?? []} selected={picks.FINALISTS ?? []} onToggle={(id) => toggleChip('FINALISTS', id, 2)} />
          <PickSection label={t('tournament.semis')} subtitle={t('tournament.semisSub')} teams={allTeams ?? []} selected={picks.SEMIS ?? []} onToggle={(id) => toggleChip('SEMIS', id, 4)} />
          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving}>{saving ? t('tournament.saving') : t('tournament.savePicks')}</Btn>
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
        {teams.map((tm) => (
          <button key={tm.id} className={`chip ${selected.includes(tm.id) ? 'active' : ''}`} onClick={() => onToggle(tm.id)} title={tm.name}>
            <Flag flagUrl={tm.flagUrl ?? undefined} name={tm.name} code={tm.code ?? undefined} size={16} />
            <span style={{ marginLeft: 4 }}>{tm.code ?? tm.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
