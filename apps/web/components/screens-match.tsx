'use client';
/* GOLAZO — Schedule · Match Detail · Bet Slip (ported from docs/design/predict-wc-2026/project/screens-match.jsx) */
import React, { useState, useEffect } from 'react';
import { WC, type Match, type Team, type Pick1X2 } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Pundit, OddsRow, MatchCard, SecHead } from '@/components/ui';

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
  const liveScores = useLiveScores();
  const filters = [
    { k: 'all', label: 'All' }, { k: 'live', label: 'Live' }, { k: 'today', label: 'Today' },
    { k: 'open', label: 'Open' }, { k: 'finished', label: 'Finished' },
  ];
  let list = WC.matches.slice();
  if (filter === 'live') list = list.filter(m => m.status === 'LIVE');
  if (filter === 'finished') list = list.filter(m => m.status === 'FINISHED');
  if (filter === 'open') list = list.filter(m => m.status === 'SCHEDULED');
  if (filter === 'today') list = list.filter(m => m.status !== 'FINISHED');
  if (q) list = list.filter(m => (WC.byId(m.home).name + WC.byId(m.away).name).toLowerCase().includes(q.toLowerCase()));
  list = list.slice(0, 30);

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

      <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))' }}>
        {list.map(m => {
          const lv = liveScores.get(m.id);
          const mm = lv ? ({ ...m, hs: lv.home, as: lv.away, status: 'LIVE' } as Match) : m;
          return (
            <MatchCard key={m.id} m={mm} onOpen={() => s.go('match', { id: m.id })}
              onPick={(pick, odds) => s.openBet(m, pick, odds)} picked={s.pickFor(m.id)} />
          );
        })}
      </div>
      {!list.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No matches match that filter.</p></div>}
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
  const [tab, setTab] = useState('preview');
  const liveScores = useLiveScores();
  const base = WC.matchById(Number(s.param.id));
  const lv = base ? liveScores.get(base.id) : undefined;
  const m = base && lv ? ({ ...base, hs: lv.home, as: lv.away, status: 'LIVE' } as typeof base) : base;
  if (!m) return null;
  const home = WC.byId(m.home), away = WC.byId(m.away);
  const live = m.status === 'LIVE', fin = m.status === 'FINISHED', open = m.status === 'SCHEDULED';
  const myBet = s.authed && s.bets.find(b => b.mid === m.id);

  return (
    <div className="page page-narrow fade-up">
      <button className="chip mt-4" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back</button>

      {/* hero */}
      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between">
          <span className="badge badge-muted">{m.stage}</span>
          {live ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE {m.minute}&apos;</span>
            : fin ? <span className="badge badge-muted">Full time</span>
              : <span className="badge badge-sky">{WC.fmtDate(m.date)} · {m.kickoff}</span>}
        </div>
        <div className="row between" style={{ marginTop: 20 }}>
          <TeamBig t={home} />
          <div style={{ textAlign: 'center' }}>
            {(live || fin)
              ? <div className="display tnum" style={{ fontSize: 48 }}>{m.hs}<span className="muted" style={{ fontSize: 28, padding: '0 8px' }}>:</span>{m.as}</div>
              : <div className="display muted" style={{ fontSize: 32 }}>VS</div>}
            <div className="tiny muted mt-4">{m.venue}</div>
          </div>
          <TeamBig t={away} />
        </div>
      </div>

      {/* odds + bet */}
      <div className="card card-pad mt-16">
        <div className="row between" style={{ marginBottom: 12 }}>
          <span className="eyebrow">Match odds</span>
          {open ? <span className="tiny muted">Locks at kickoff</span> : <span className="tiny text-danger row gap-4"><Icon name="lock" size={12} /> Betting closed</span>}
        </div>
        <OddsRow m={m} selected={myBet ? myBet.pick : s.pickFor(m.id)} onPick={(pick, odds) => s.openBet(m, pick, odds)} />
        {myBet
          ? <div className="row between mt-16 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
              <div className="small">Your bet: <b>{myBet.pick}</b> · <span className="tnum">{myBet.stake}</span> pts @ <span className="tnum">{myBet.odds.toFixed(2)}</span></div>
              <span className={`badge badge-${myBet.status === 'WON' ? 'green' : myBet.status === 'LOST' ? 'danger' : 'sky'}`}>{myBet.status}</span>
            </div>
          : open && <Btn variant="primary" className="btn-block mt-16" icon="ball" onClick={() => s.openBet(m, '1', m.odds.mh)}>Place a bet</Btn>}
      </div>

      {/* in-play micro-bet widget (DEPTH-06) — LIVE + authed only */}
      {live && s.authed && <MicroBetWidget matchId={m.id} />}
      {live && !s.authed && (
        <div className="card card-pad mt-16" style={{ textAlign: 'center' }}>
          <p className="small muted">Sign in to place in-play bets on this match.</p>
        </div>
      )}

      {/* tabs */}
      <div className="row gap-8 mt-24" style={{ overflowX: 'auto' }}>
        {([['preview', 'AI Pundit'], ['form', 'Form'], ['h2h', 'Head-to-head'], ['lineups', 'Lineups']] as [string, string][]).map(([k, l]) =>
          <button key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{l}</button>)}
      </div>

      <div className="mt-16">
        {tab === 'preview' && <PunditPanel m={m} home={home} away={away} />}
        {tab === 'form' && <FormPanel home={home} away={away} />}
        {tab === 'h2h' && <H2HPanel home={home} away={away} />}
        {tab === 'lineups' && <LineupsPanel home={home} away={away} />}
      </div>
    </div>
  );
}

function TeamBig({ t }: { t: Team }) {
  return (
    <div className="stack center gap-8" style={{ width: 110 }}>
      <Flag team={t} size={56} />
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{t.name}</div>
        <div className="tiny muted">FIFA #{t.rank}</div>
      </div>
    </div>
  );
}

/* ---- AI Pundit panel ---- */
function PunditPanel({ m, home, away }: { m: Match; home: Team; away: Team }) {
  const pick: Pick1X2 = m.odds.mh <= m.odds.ma ? '1' : '2';
  const pickTeam = pick === '1' ? home : away;

  const mockContent = `${home.name} arrive as FIFA #${home.rank} and have controlled tempo in their opening fixtures, while ${away.name} (#${away.rank}) have looked sharpest in transition. Expect ${home.name} to see more of the ball; the danger is ${away.name} on the counter. Set pieces could decide a tight one.`;
  const mockDisclaimer = 'For entertainment only — Ora is not betting advice and never guarantees outcomes.';

  const [content, setContent] = useState<string>(mockContent);
  const [disclaimer, setDisclaimer] = useState<string>(mockDisclaimer);
  const [provider, setProvider] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    try {
      fetch(`/api/v1/ai/preview/${m.id}`)
        .then(r => r.json())
        .then((body: { data?: { content?: string; disclaimer?: string; provider?: string } }) => {
          if (cancelled) return;
          if (body?.data?.content) setContent(body.data.content);
          if (body?.data?.disclaimer) setDisclaimer(body.data.disclaimer);
          if (body?.data?.provider) setProvider(body.data.provider);
        })
        .catch(() => { /* keep mock on error */ });
    } catch {
      // fetch may not exist in test environments — keep mock
    }
    return () => { cancelled = true; };
  }, [m.id]);

  return (
    <div className="stack gap-16">
      <div className="panel card-pad" style={{ background: 'linear-gradient(120deg, var(--sky-soft), transparent)' }}>
        <div className="row gap-14" style={{ alignItems: 'flex-start' }}>
          <Pundit size={56} mood="think" glow />
          <div className="grow">
            <div className="row between">
              <span className="badge badge-sky">Ora · Match preview</span>
              <span className="tiny muted">
                {provider ? `AI-assisted · ${provider}` : 'Grounded on fixture data'}
              </span>
            </div>
            <p className="t2 small mt-8" style={{ lineHeight: 1.6 }}>{content}</p>
          </div>
        </div>
      </div>

      <div className="card card-pad" style={{ borderColor: 'rgba(43,224,138,.3)' }}>
        <div className="row between">
          <div className="row gap-8"><Icon name="sparkles" size={18} style={{ color: 'var(--green)' }} /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>Smart Pick</span></div>
          <span className="badge badge-green">Lean: {pickTeam.code}</span>
        </div>
        <div className="row gap-12 mt-12">
          <Flag team={pickTeam} size={34} />
          <div><div style={{ fontWeight: 700 }}>{pickTeam.name} to win</div><div className="tiny muted">Confidence 62% · value also on the draw</div></div>
        </div>
        <div className="card-2 card-pad mt-12 small t2" style={{ borderRadius: 'var(--r-sm)', display: 'flex', gap: 8 }}>
          <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none', marginTop: 2 }} />
          <span>{disclaimer}</span>
        </div>
      </div>
    </div>
  );
}

function FormPanel({ home, away }: { home: Team; away: Team }) {
  const FormRow = ({ t, f }: { t: Team; f: string[] }) => (
    <div className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
      <div className="row gap-10"><Flag team={t} size={28} /><span style={{ fontWeight: 600 }}>{t.name}</span></div>
      <div className="row gap-6">{f.map((r, i) => <span key={i} className="badge" style={{ width: 24, justifyContent: 'center', background: r === 'W' ? 'var(--green-soft)' : r === 'L' ? 'var(--danger-soft)' : 'var(--surface-3)', color: r === 'W' ? 'var(--green)' : r === 'L' ? 'var(--danger)' : 'var(--text-2)' }}>{r}</span>)}</div>
    </div>
  );
  return (
    <div className="stack gap-10">
      <div className="eyebrow">Last 5 matches</div>
      <FormRow t={home} f={['W', 'W', 'D', 'L', 'W']} />
      <FormRow t={away} f={['W', 'D', 'W', 'W', 'L']} />
    </div>
  );
}

function H2HPanel({ home, away }: { home: Team; away: Team }) {
  const history: [string, string][] = [['2022', '2-1'], ['2019', '1-1'], ['2018', '0-2']];
  return (
    <div className="card card-pad">
      <div className="row center gap-24" style={{ textAlign: 'center' }}>
        <div className="stack center gap-6"><Flag team={home} size={40} /><div className="display" style={{ fontSize: 30, color: 'var(--green)' }}>3</div><div className="tiny muted">{home.code} wins</div></div>
        <div className="stack center gap-6"><div className="display muted" style={{ fontSize: 22 }}>—</div><div className="display" style={{ fontSize: 30 }}>2</div><div className="tiny muted">Draws</div></div>
        <div className="stack center gap-6"><Flag team={away} size={40} /><div className="display" style={{ fontSize: 30, color: 'var(--sky)' }}>1</div><div className="tiny muted">{away.code} wins</div></div>
      </div>
      <div className="hr" style={{ margin: '16px 0' }}></div>
      <div className="stack gap-8">
        {history.map(([y, sc], i) => (
          <div key={i} className="row between small"><span className="muted">{y} · Friendly</span><span className="tnum" style={{ fontWeight: 700 }}>{sc}</span></div>
        ))}
      </div>
    </div>
  );
}

function LineupsPanel({ home, away }: { home: Team; away: Team }) {
  const F433: [number, number][][] = [
    [[50, 6]],
    [[18, 24], [38, 20], [62, 20], [82, 24]],
    [[28, 48], [50, 44], [72, 48]],
    [[22, 74], [50, 80], [78, 74]],
  ];
  const labels = ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'CAM', 'RW', 'ST', 'LW'];
  const flat = F433.flat();

  const Dot = ({ t, x, y, n, top }: { t: Team; x: number; y: number; n: number; top: boolean }) => (
    <div className="abs" style={{ left: `${x}%`, top: `${top ? y / 2 : 100 - y / 2}%`, transform: 'translate(-50%,-50%)', textAlign: 'center', width: 56 }}>
      <div style={{ width: 30, height: 30, margin: '0 auto', borderRadius: '50%', background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[2]})`,
        border: '2px solid rgba(255,255,255,.85)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 12, color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.5)' }}>{n}</div>
      <div className="tiny" style={{ marginTop: 3, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.8)', fontSize: 9.5, lineHeight: 1.1 }}>{t.code} {n}</div>
    </div>
  );

  const Half = ({ t, top }: { t: Team; top: boolean }) => (
    <>
      {flat.map((p, i) => <Dot key={i} t={t} x={p[0]} y={p[1]} n={i + 1} top={top} />)}
    </>
  );

  return (
    <div>
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Predicted XI</span>
        <div className="row gap-8"><span className="badge badge-muted">{home.code} 4-3-3</span><span className="badge badge-muted">{away.code} 4-3-3</span></div>
      </div>

      {/* PITCH */}
      <div className="card" style={{ position: 'relative', aspectRatio: '3 / 4', maxWidth: 460, margin: '0 auto', overflow: 'hidden',
        background: 'repeating-linear-gradient(0deg, #0f3a26 0 9.09%, #11402b 9.09% 18.18%)', border: '1px solid var(--line-strong)' }}>
        {/* markings */}
        <svg viewBox="0 0 300 400" preserveAspectRatio="none" className="abs" style={{ inset: 0, width: '100%', height: '100%', opacity: .55 }}>
          <g fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.5">
            <rect x="8" y="8" width="284" height="384" rx="2" />
            <line x1="8" y1="200" x2="292" y2="200" />
            <circle cx="150" cy="200" r="42" />
            <circle cx="150" cy="200" r="2.5" fill="rgba(255,255,255,.6)" />
            <rect x="82" y="8" width="136" height="58" /><rect x="118" y="8" width="64" height="24" />
            <rect x="82" y="334" width="136" height="58" /><rect x="118" y="368" width="64" height="24" />
          </g>
        </svg>
        {/* team tags */}
        <div className="abs row gap-6" style={{ top: 10, left: 10 }}><Flag team={home} size={20} /><span className="tiny" style={{ color: '#fff', fontWeight: 700, textShadow: '0 1px 3px #000' }}>{home.name}</span></div>
        <div className="abs row gap-6" style={{ bottom: 10, right: 10 }}><span className="tiny" style={{ color: '#fff', fontWeight: 700, textShadow: '0 1px 3px #000' }}>{away.name}</span><Flag team={away} size={20} /></div>
        <Half t={home} top={true} />
        <Half t={away} top={false} />
      </div>

      {/* position key */}
      <div className="card card-pad mt-12">
        <div className="grid gap-x-16" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(120px,1fr))', gap: 8 }}>
          {labels.map((l, i) => (
            <div key={i} className="row gap-8 small"><span className="tnum muted" style={{ width: 18 }}>{i + 1}</span><span className="t2">{l}</span></div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================== BET SLIP (overlay) ===================== */
export function BetSlip({ s }: ScreenProps) {
  const sel = s.betSlip;
  const [stake, setStake] = useState(100);
  const [exH, setExH] = useState(0);
  const [exA, setExA] = useState(0);
  const [powerUp, setPowerUp] = useState<string>('');
  const [inventory, setInventory] = useState<Record<string, number>>({});

  useEffect(() => { setStake(100); setExH(0); setExA(0); setPowerUp(''); }, [sel?.match?.id, sel?.pick]);

  useEffect(() => {
    if (!sel || !s.authed) return;
    let cancelled = false;
    fetch('/api/v1/me/powerups')
      .then(r => r.ok ? r.json() : null)
      .then((j: { data?: Record<string, number> } | null) => {
        if (!cancelled && j?.data) setInventory(j.data);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [sel?.match?.id, s.authed]);

  if (!sel) return null;
  const m = sel.match, odds = sel.odds, pick = sel.pick;
  const home = WC.byId(m.home), away = WC.byId(m.away);
  const pickLabel = pick === '1' ? home.name : pick === '2' ? away.name : 'Draw';
  const payout = Math.round(stake * (1 + odds));
  const profit = Math.round(stake * odds);
  const over = stake > s.points;
  const knockout = !!m.round && m.round.toLowerCase() !== 'group';
  const quick = [50, 100, 250, 500];
  const picks: [Pick1X2, string, number][] = [
    ['1', home.code, m.odds.mh],
    ['X', 'Draw', m.odds.md],
    ['2', away.code, m.odds.ma],
  ];

  return (
    <div className="overlay" onClick={s.closeBet}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Bet slip</span><button className="btn-icon" onClick={s.closeBet}><Icon name="x" size={18} /></button></div>

          {/* match */}
          <div className="row between mt-12 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
            <div className="row gap-8" style={{ minWidth: 0 }}><Flag team={home} size={22} /><span className="ellip small">{home.code} v {away.code}</span></div>
            <span className="tiny muted">{m.stage}</span>
          </div>

          {/* pick selector */}
          <div className="row gap-8 mt-12">
            {picks.map(([k, lbl, o]) => (
              <button key={k} className={`odds ${pick === k ? 'sel' : ''}`} onClick={() => s.setSlipPick(k, o)}>
                <span className="o-label">{k} · {lbl}</span><span className="o-val">{o.toFixed(2)}</span>
              </button>
            ))}
          </div>

          {/* stake */}
          <div className="field mt-16">
            <div className="row between"><label className="label">Stake</label><span className="tiny muted">Balance <span className="tnum text-gold">{s.points.toLocaleString()}</span></span></div>
            <input className="input input-mono" type="number" value={stake} onChange={e => setStake(Math.max(0, +e.target.value || 0))} />
            <div className="row gap-8 mt-4">
              {quick.map(q => <button key={q} className="chip chip-sm" onClick={() => setStake(q)}>{q}</button>)}
              <button className="chip chip-sm" onClick={() => setStake(s.points)}>Max</button>
            </div>
          </div>

          {/* power-up selector (DEPTH-04) — shown when user owns any */}
          {s.authed && Object.values(inventory).some(q => q > 0) && (
            <div className="field mt-12">
              <label className="label">Power-up</label>
              <div className="row gap-8 mt-4">
                {[
                  { key: '', label: 'None' },
                  { key: 'DOUBLE_DOWN', label: 'Double Down' },
                  { key: 'INSURANCE', label: 'Insurance' },
                ].map(({ key, label }) => {
                  const qty = key ? (inventory[key] ?? 0) : null;
                  const disabled = !!key && qty === 0;
                  return (
                    <button
                      key={key}
                      disabled={disabled}
                      className={`chip ${powerUp === key ? 'active' : ''}`}
                      onClick={() => setPowerUp(key)}
                      style={{ opacity: disabled ? 0.4 : 1 }}
                    >
                      {label}{qty !== null ? ` (${qty})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* exact score — knockout bonus (FR-SCORE-03) */}
          {knockout && (
            <div className="field mt-12">
              <div className="row between"><label className="label">Exact score</label><span className="tiny muted">optional · knockout bonus</span></div>
              <div className="row gap-8" style={{ alignItems: 'center', justifyContent: 'center' }}>
                <span className="tiny t2">{home.code}</span>
                <input className="input input-mono" type="number" min={0} value={exH} onChange={e => setExH(Math.max(0, +e.target.value || 0))} style={{ width: 64, textAlign: 'center' }} />
                <span className="muted">:</span>
                <input className="input input-mono" type="number" min={0} value={exA} onChange={e => setExA(Math.max(0, +e.target.value || 0))} style={{ width: 64, textAlign: 'center' }} />
                <span className="tiny t2">{away.code}</span>
              </div>
              <p className="tiny muted mt-4">Nail the 90&apos; score and your pick wins → bonus payout.</p>
            </div>
          )}

          {/* payout */}
          <div className="card-2 card-pad ticket-notch mt-16" style={{ borderRadius: 'var(--r-sm)' }}>
            <div className="row between small"><span className="t2">Pick</span><span style={{ fontWeight: 700 }}>{pickLabel} ({pick})</span></div>
            <div className="row between small mt-8"><span className="t2">Odds</span><span className="tnum">×{(1 + odds).toFixed(2)}</span></div>
            <div className="hr" style={{ margin: '10px 0' }}></div>
            <div className="row between"><span className="t2">Potential payout</span><span className="tnum text-green" style={{ fontSize: 20, fontWeight: 700 }}>{payout.toLocaleString()}</span></div>
            <div className="row between tiny muted mt-4"><span>Profit if you win</span><span className="tnum">+{profit.toLocaleString()}</span></div>
          </div>

          {over && <p className="tiny text-danger mt-8" style={{ textAlign: 'center' }}>Stake exceeds your balance.</p>}
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={over || stake <= 0} onClick={() => s.confirmBet(stake, knockout ? { home: exH, away: exA } : undefined, powerUp || undefined)}>
            Confirm bet · {stake} pts
          </Btn>
          <p className="tiny muted mt-8" style={{ textAlign: 'center' }}>Bets lock at kickoff and can&apos;t be changed after.</p>
        </div>
      </div>
    </div>
  );
}
