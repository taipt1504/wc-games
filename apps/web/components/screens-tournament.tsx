'use client';
/* GOLAZO — Teams · Team detail · Groups · Bracket (ported from screens-tournament.jsx) */
import React, { useState, useEffect, useCallback } from 'react';
import { WC, type Team } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Pundit, MatchCard, SecHead } from '@/components/ui';

/* ===================== TEAMS ===================== */
export function Teams({ s }: ScreenProps) {
  const [conf, setConf] = useState('all');
  const confs = ['all', 'UEFA', 'CONMEBOL', 'CONCACAF', 'CAF', 'AFC', 'OFC'];
  let list = WC.teams.slice();
  if (conf !== 'all') list = list.filter((t) => t.conf === conf);
  list.sort((a, b) => a.rank - b.rank);
  return (
    <div className="page fade-up">
      <SecHead title="Teams" sub="All 48 nations at World Cup 2026" />
      <div className="row gap-8 wrap-w" style={{ marginBottom: 18 }}>
        {confs.map((c) => (
          <button key={c} className={`chip ${conf === c ? 'active' : ''}`} onClick={() => setConf(c)}>
            {c === 'all' ? 'All' : c}
          </button>
        ))}
      </div>
      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(168px,1fr))' }}>
        {list.map((t) => (
          <div key={t.id} className="card card-pad card-hover pointer" onClick={() => s.go('team', { id: t.id })}>
            <div className="row between"><Flag team={t} size={40} /><span className="badge badge-muted">Grp {t.group}</span></div>
            <div className="h3 mt-12" style={{ fontSize: 16 }}>{t.name}</div>
            <div className="row between mt-4">
              <span className="tiny muted">FIFA #{t.rank}</span>
              <span className="tiny muted">{t.conf}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== TEAM DETAIL ===================== */
export function TeamDetail({ s }: ScreenProps) {
  const t = WC.byId(Number(s.param.id));
  const fixtures = WC.matches.filter((m) => m.home === t.id || m.away === t.id).slice(0, 3);
  const squad = WC.squadFor(t.code);
  return (
    <div className="page page-narrow fade-up">
      <button className="chip" onClick={() => s.back()} style={{ marginBottom: 16 }}>
        <Icon name="chevL" size={14} /> Back
      </button>
      <div className="panel card-pad-lg" style={{ background: `linear-gradient(150deg, ${t.colors[0]}22, var(--bg-2))` }}>
        <div className="row gap-16">
          <Flag team={t} size={72} />
          <div>
            <h1 className="h2">{t.name}</h1>
            <div className="row gap-8 mt-8">
              <span className="badge badge-muted">Group {t.group}</span>
              <span className="badge badge-sky">FIFA #{t.rank}</span>
              <span className="badge badge-muted">{t.conf}</span>
            </div>
          </div>
        </div>
        <div className="row gap-20 mt-16">
          <div className="stat"><span className="s-val tnum">{t.w}-{t.d}-{t.l}</span><span className="s-lbl">W-D-L</span></div>
          <div className="stat"><span className="s-val tnum">{t.pts}</span><span className="s-lbl">Points</span></div>
          <div className="stat"><span className="s-val tnum">{(t.gd ?? 0) > 0 ? '+' : ''}{t.gd ?? 0}</span><span className="s-lbl">Goal diff</span></div>
        </div>
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Group {t.group} fixtures</div>
      <div className="stack gap-12">
        {fixtures.map((m) => (
          <MatchCard key={m.id} m={m} compact onOpen={() => s.go('match', { id: m.id })} />
        ))}
      </div>

      <div className="eyebrow mt-24" style={{ marginBottom: 12, display: 'block' }}>Squad</div>
      <div className="card card-pad">
        {(['GK', 'DEF', 'MID', 'FWD'] as const).map((pos) => {
          const group = squad.filter((p) => p.pos === pos);
          return (
            <div key={pos} style={{ marginBottom: 12 }}>
              <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>{pos}</div>
              <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(140px,1fr))', gap: 6 }}>
                {group.map((p) => (
                  <div key={p.num} className="row gap-8 small">
                    <span className="tnum muted" style={{ width: 18 }}>{p.num}</span>
                    <span className="t2 ellip">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== GROUPS ===================== */
export function Groups({ s }: ScreenProps) {
  return (
    <div className="page fade-up">
      <SecHead title="Group standings" sub="12 groups · top 2 plus best thirds advance" />
      <div className="grid gap-16" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))' }}>
        {WC.GROUPS.map((g) => {
          const rows = WC.byGroup(g)
            .slice()
            .sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || (b.gd ?? 0) - (a.gd ?? 0) || b.gf - a.gf);
          return (
            <div key={g} className="card" style={{ overflow: 'hidden' }}>
              <div className="row between card-pad" style={{ paddingBottom: 10 }}>
                <span className="h3">Group {g}</span>
                <span className="tiny muted">Matchday 1–3</span>
              </div>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th style={{ textAlign: 'center' }}>P</th>
                    <th style={{ textAlign: 'center' }}>GD</th>
                    <th style={{ textAlign: 'center' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((t, i) => (
                    <tr
                      key={t.id}
                      className={i < 2 ? 'hl' : ''}
                      style={{ cursor: 'pointer' }}
                      onClick={() => s.go('team', { id: t.id })}
                    >
                      <td className="tnum" style={{ color: i < 2 ? 'var(--green)' : 'var(--muted)' }}>{i + 1}</td>
                      <td>
                        <div className="row gap-8">
                          <Flag team={t} size={22} />
                          <span className="small ellip" style={{ fontWeight: 600 }}>{t.code}</span>
                        </div>
                      </td>
                      <td className="tnum t2" style={{ textAlign: 'center' }}>{t.w + t.d + t.l}</td>
                      <td className="tnum t2" style={{ textAlign: 'center' }}>{(t.gd ?? 0) > 0 ? '+' : ''}{t.gd ?? 0}</td>
                      <td className="tnum" style={{ textAlign: 'center', fontWeight: 700 }}>{t.pts ?? 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ===================== BRACKET ===================== */

type BracketMatchProps = { a: Team; b: Team; score?: [number, number] | null; hot?: boolean };
type ColProps = { title: string; count: number; start: number; score?: [number, number] | null };

interface BracketPicks {
  CHAMPION?: number;
  FINALISTS?: number[];
  SEMIS?: number[];
}

export function Bracket({ s }: ScreenProps) {
  // Projected qualifiers (top of each group) for a clean knockout view
  const winners = WC.GROUPS.map((g) =>
    WC.byGroup(g).slice().sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || (b.gd ?? 0) - (a.gd ?? 0))[0]
  );
  const seconds = WC.GROUPS.map((g) =>
    WC.byGroup(g).slice().sort((a, b) => (b.pts ?? 0) - (a.pts ?? 0) || (b.gd ?? 0) - (a.gd ?? 0))[1]
  );
  const pool: Team[] = [...winners, ...seconds];
  const pick = (i: number): Team => pool[i % pool.length];

  const [panelOpen, setPanelOpen] = useState(false);
  const [picks, setPicks] = useState<BracketPicks>({});
  const [saving, setSaving] = useState(false);

  const fetchPicks = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/me/bracket');
      if (res.ok) {
        const json = await res.json();
        setPicks(json.data?.picks ?? {});
      }
    } catch {
      // ignore fetch errors in static shell
    }
  }, []);

  useEffect(() => {
    if (panelOpen && s.authed) fetchPicks();
  }, [panelOpen, s.authed, fetchPicks]);

  function toggleChip(field: 'CHAMPION', id: number): void;
  function toggleChip(field: 'FINALISTS', id: number, max: number): void;
  function toggleChip(field: 'SEMIS', id: number, max: number): void;
  function toggleChip(field: keyof BracketPicks, id: number, max?: number): void {
    if (field === 'CHAMPION') {
      setPicks((p) => ({ ...p, CHAMPION: p.CHAMPION === id ? undefined : id }));
    } else {
      setPicks((p) => {
        const arr: number[] = (p[field] as number[] | undefined) ?? [];
        if (arr.includes(id)) return { ...p, [field]: arr.filter((x) => x !== id) };
        if (arr.length >= (max ?? 99)) return p;
        return { ...p, [field]: [...arr, id] };
      });
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/v1/me/bracket', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ picks }),
      });
      if (res.ok) {
        s.toastMsg('Bracket saved!', 'trophy', 'var(--gold)');
        setPanelOpen(false);
      } else {
        const json = await res.json().catch(() => ({}));
        const code = json?.error?.code ?? 'ERROR';
        if (code === 'BRACKET_LOCKED') s.toastMsg('Bracket is locked', 'lock', 'var(--muted)');
        else s.toastMsg('Could not save bracket', 'alert', 'var(--red)');
      }
    } catch {
      s.toastMsg('Could not save bracket', 'alert', 'var(--red)');
    } finally {
      setSaving(false);
    }
  }

  function BracketMatch({ a, b, score, hot }: BracketMatchProps) {
    return (
      <div
        className="card card-pad"
        style={{ padding: '10px 12px', minWidth: 180, borderColor: hot ? 'rgba(255,77,141,.35)' : 'var(--line)' }}
      >
        {([a, b] as Team[]).map((t, i) => (
          <div key={i} className="row between" style={{ padding: '3px 0' }}>
            <div className="row gap-8" style={{ minWidth: 0 }}>
              <Flag team={t} size={20} />
              <span className="small ellip" style={{ fontWeight: i === 0 ? 700 : 500 }}>{t.code}</span>
            </div>
            <span className="tnum tiny" style={{ color: i === 0 ? 'var(--green)' : 'var(--muted)' }}>
              {score ? score[i] : '–'}
            </span>
          </div>
        ))}
      </div>
    );
  }

  function Col({ title, count, start, score }: ColProps) {
    return (
      <div className="stack" style={{ justifyContent: 'space-around', gap: 14, minWidth: 196 }}>
        <div className="eyebrow" style={{ textAlign: 'center' }}>{title}</div>
        {Array.from({ length: count }).map((_, i) => (
          <BracketMatch
            key={i}
            a={pick(start + i * 2)}
            b={pick(start + i * 2 + 1)}
            score={i === 0 && score ? score : null}
            hot={i === 0 && title === 'Final'}
          />
        ))}
      </div>
    );
  }

  const champion = winners[0];

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
            <div
              className="card card-pad"
              style={{
                textAlign: 'center',
                background: 'linear-gradient(150deg,var(--gold-soft),transparent)',
                borderColor: 'rgba(255,200,61,.4)',
              }}
            >
              <Icon name="trophy" size={28} style={{ color: 'var(--gold)' }} />
              {champion && <Flag team={champion} size={40} />}
              <div className="small mt-8" style={{ fontWeight: 700 }}>{champion?.name}</div>
            </div>
          </div>
        </div>
      </div>
      <div
        className="card card-pad mt-16 row between wrap gap-12"
        style={{ background: 'linear-gradient(120deg,var(--sky-soft),transparent)' }}
      >
        <div className="row gap-12">
          <Pundit size={48} mood="idle" />
          <div>
            <div style={{ fontWeight: 700 }}>Predict the whole bracket</div>
            <div className="tiny t2">Fill every knockout tie and earn bonus points for each correct round.</div>
          </div>
        </div>
        <Btn
          variant="primary"
          size="sm"
          onClick={() => {
            if (!s.authed) { s.go('auth', { mode: 'signup' }); return; }
            setPanelOpen((o) => !o);
          }}
        >
          Open predictor
        </Btn>
      </div>

      {panelOpen && s.authed && (
        <div className="card card-pad mt-16 fade-up" aria-label="Bracket predictor panel">
          <div className="row between" style={{ marginBottom: 16 }}>
            <span className="h3">Your bracket picks</span>
            <button className="chip" onClick={() => setPanelOpen(false)}>
              <Icon name="x" size={14} /> Close
            </button>
          </div>

          <PickSection
            label="Champion"
            subtitle="Pick 1 team"
            selected={picks.CHAMPION !== undefined ? [picks.CHAMPION] : []}
            onToggle={(id) => toggleChip('CHAMPION', id)}
          />
          <PickSection
            label="Finalists"
            subtitle="Pick up to 2 teams"
            selected={picks.FINALISTS ?? []}
            onToggle={(id) => toggleChip('FINALISTS', id, 2)}
          />
          <PickSection
            label="Semi-finalists"
            subtitle="Pick up to 4 teams"
            selected={picks.SEMIS ?? []}
            onToggle={(id) => toggleChip('SEMIS', id, 4)}
          />

          <div className="row" style={{ marginTop: 20, justifyContent: 'flex-end' }}>
            <Btn variant="primary" size="sm" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : 'Save picks'}
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function PickSection({
  label, subtitle, selected, onToggle,
}: {
  label: string; subtitle: string; selected: number[]; onToggle: (id: number) => void;
}) {
  const teams = WC.teams.slice().sort((a, b) => a.rank - b.rank);
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="eyebrow" style={{ marginBottom: 4 }}>{label}</div>
      <div className="tiny muted" style={{ marginBottom: 10 }}>{subtitle}</div>
      <div className="row gap-8 wrap-w">
        {teams.map((t) => {
          const active = selected.includes(t.id);
          return (
            <button
              key={t.id}
              className={`chip ${active ? 'active' : ''}`}
              onClick={() => onToggle(t.id)}
              title={t.name}
            >
              <Flag team={t} size={16} />
              <span style={{ marginLeft: 4 }}>{t.code}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
