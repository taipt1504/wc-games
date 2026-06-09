'use client';
/* World Cup Games — FormationPitch: starting XI on a pitch (manager + bench), shared by user + admin. */
import React from 'react';
import { Icon } from '@/components/ui';
import { useT } from '@/lib/i18n/hooks';

export interface LineupPlayer { name: string; position: string | null; number: number | null; starter?: boolean }

type Band = 'FWD' | 'AM' | 'DM' | 'DEF' | 'GK';
const BANDS: Band[] = ['FWD', 'AM', 'DM', 'DEF', 'GK']; // top → bottom (attack → goal)

/** Specific position → pitch band. Tolerates legacy group values (FWD/MID/DEF/GK). */
function bandOf(pos: string | null): Band {
  const p = (pos ?? '').toUpperCase();
  if (p === 'GK') return 'GK';
  if (['ST', 'CF', 'FW', 'SS', 'RF', 'LF'].includes(p)) return 'FWD';
  if (['CAM', 'AM', 'AMF', 'RW', 'LW', 'RM', 'LM', 'RWF', 'LWF'].includes(p)) return 'AM';
  if (['CDM', 'DM', 'DMF', 'CM', 'CMF', 'MID', 'MF'].includes(p)) return 'DM';
  if (['RB', 'LB', 'CB', 'RWB', 'LWB', 'WB', 'DF', 'DEF'].includes(p)) return 'DEF';
  if (p === 'FWD') return 'FWD';
  return 'DEF';
}

/** Left-to-right order within a band: L prefix = left, R prefix = right, else centre. */
function sideRank(pos: string | null): number {
  const c = (pos ?? '').toUpperCase()[0];
  return c === 'L' ? -1 : c === 'R' ? 1 : 0;
}

export interface DerivedLineup { lines: LineupPlayer[][]; subs: LineupPlayer[]; formationLabel: string }

/** Build pitch lines (top→bottom = attack→goal) + substitutes. Real XI (any `starter`) → the 5-band
 *  split of starters with the passed formation. No XI → a default 4-3-3 (1 GK / 4 DEF / 3 MID / 3 FWD)
 *  picked by position bucket; short buckets show fewer (never fabricated), everyone unplaced → subs. */
export function deriveLineup(players: LineupPlayer[], formation?: string | null): DerivedLineup {
  if (players.length === 0) return { lines: [], subs: [], formationLabel: '' };

  const starters = players.filter((p) => p.starter);
  if (starters.length > 0) {
    const lines = BANDS
      .map((b) => starters.filter((p) => bandOf(p.position) === b).sort((x, y) => sideRank(x.position) - sideRank(y.position)))
      .filter((row) => row.length > 0);
    return { lines, subs: players.filter((p) => !p.starter), formationLabel: formation ?? '' };
  }

  // No starting XI: arrange a common 4-3-3 from the squad's coarse buckets.
  const inBands = (bs: Band[]) => players.filter((p) => bs.includes(bandOf(p.position)));
  const gk = inBands(['GK']).slice(0, 1);
  const def = inBands(['DEF']).slice(0, 4);
  const mid = inBands(['DM', 'AM']).slice(0, 3);
  const fwd = inBands(['FWD']).slice(0, 3);
  const onPitch = new Set<LineupPlayer>([...gk, ...def, ...mid, ...fwd]);
  const lines = [fwd, mid, def, gk].filter((row) => row.length > 0); // top→bottom
  return { lines, subs: players.filter((p) => !onPitch.has(p)), formationLabel: '4-3-3' };
}

function Chip({ p }: { p: LineupPlayer }) {
  return (
    <div style={{ textAlign: 'center', width: 'clamp(52px, 16vw, 84px)', minWidth: 0 }}>
      <div style={{ width: 32, height: 32, margin: '0 auto', borderRadius: '50%', background: 'linear-gradient(135deg, var(--green), var(--sky))', border: '2px solid rgba(255,255,255,.9)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 12, color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.55)' }}>{p.number ?? ''}</div>
      <div className="tiny" style={{ marginTop: 3, color: '#fff', fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,.95)', fontSize: 10, lineHeight: 1.15, wordBreak: 'break-word' }} title={p.name}>{p.name}</div>
      {p.position && <div className="tiny" style={{ color: 'rgba(255,255,255,.65)', fontSize: 8.5, fontWeight: 600 }}>{p.position}</div>}
    </div>
  );
}

const BAND_LABELS: Record<Band, string> = { GK: 'Goalkeepers', DEF: 'Defenders', DM: 'Midfielders', AM: 'Midfielders', FWD: 'Forwards' };

function RosterGroup({ band, players }: { band: Band; players: LineupPlayer[] }) {
  return (
    <div>
      <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>{BAND_LABELS[band]}</div>
      <div className="grid-fill" style={{ '--col-min': '170px', '--gap': '8px' } as React.CSSProperties}>
        {players.map((p, i) => (
          <div key={i} className="card-2" style={{ borderRadius: 'var(--r-xs)', padding: '8px 12px', textAlign: 'center' }}>
            <div className="row center gap-8 small" style={{ minWidth: 0 }}>
              <span className="tnum muted" style={{ flex: 'none' }}>{p.number ?? ''}</span>
              <span className="t2" style={{ fontWeight: 600 }}>{p.name}</span>
            </div>
            {p.position && <span className="tiny muted" style={{ display: 'block', marginTop: 2 }}>{p.position}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormationPitch({ players, formation, manager }: { players: LineupPlayer[]; formation?: string | null; manager?: string | null }) {
  const { t } = useT();
  const starters = players.filter((p) => p.starter);
  const hasXI = starters.length > 0;
  const bench = hasXI ? players.filter((p) => !p.starter) : [];

  return (
    <div className="stack gap-12">
      {(manager || (hasXI && formation)) && (
        <div className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
          <div className="row gap-8">{manager && <><Icon name="user" size={16} className="muted" /><span className="small" style={{ fontWeight: 700 }}>{manager}</span></>}</div>
          {hasXI && formation && <span className="badge badge-sky">{formation}</span>}
        </div>
      )}

      {hasXI ? (
        <>
          <div className="card" style={{ position: 'relative', aspectRatio: '3 / 4', maxWidth: 560, margin: '0 auto', width: '100%', overflow: 'hidden', background: 'repeating-linear-gradient(0deg, #0f3a26 0 10%, #11402b 10% 20%)', border: '1px solid var(--line-strong)' }}>
            <svg viewBox="0 0 300 400" preserveAspectRatio="none" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.5 }}>
              <g fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5">
                <rect x="8" y="8" width="284" height="384" rx="2" />
                <line x1="8" y1="200" x2="292" y2="200" />
                <circle cx="150" cy="200" r="40" />
                <rect x="90" y="8" width="120" height="50" /><rect x="90" y="342" width="120" height="50" />
              </g>
            </svg>
            <div className="stack" style={{ position: 'relative', height: '100%', padding: '12px 4px', justifyContent: 'space-around' }}>
              {BANDS.map((b) => {
                const row = starters.filter((p) => bandOf(p.position) === b).sort((x, y) => sideRank(x.position) - sideRank(y.position));
                if (row.length === 0) return null;
                return (
                  <div key={b} className="row" style={{ justifyContent: 'space-around', alignItems: 'center', gap: 2 }}>
                    {row.map((p, i) => <Chip key={i} p={p} />)}
                  </div>
                );
              })}
            </div>
          </div>

          {bench.length > 0 && (
            <div>
              <div className="tiny muted" style={{ fontWeight: 700, marginBottom: 6, letterSpacing: '0.05em' }}>{t('tournament.bench')}</div>
              <div className="grid-fill" style={{ '--col-min': '170px', '--gap': '8px' } as React.CSSProperties}>
                {bench.map((p, i) => (
                  <div key={i} className="card-2" style={{ borderRadius: 'var(--r-xs)', padding: '8px 12px', textAlign: 'center' }}>
                    <div className="row center gap-8 small" style={{ minWidth: 0 }}>
                      <span className="tnum muted" style={{ flex: 'none' }}>{p.number ?? ''}</span>
                      <span className="t2" style={{ fontWeight: 600 }}>{p.name}</span>
                    </div>
                    {p.position && <span className="tiny muted" style={{ display: 'block', marginTop: 2 }}>{p.position}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="stack gap-16">
          {BANDS.map((b) => {
            const group = players.filter((p) => bandOf(p.position) === b);
            if (group.length === 0) return null;
            return <RosterGroup key={b} band={b} players={group} />;
          })}
        </div>
      )}
    </div>
  );
}
