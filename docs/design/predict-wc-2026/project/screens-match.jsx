/* ============================================================
   GOLAZO — Schedule · Match Detail · AI Pundit · Bet Slip
   ============================================================ */

/* ===================== SCHEDULE ===================== */
function Schedule({ s }) {
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
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
        {list.map(m => (
          <MatchCard key={m.id} m={m} onOpen={() => s.go('match', { id: m.id })}
            onPick={(pick, odds) => s.openBet(m, pick, odds)} picked={s.pickFor(m.id)} />
        ))}
      </div>
      {!list.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No matches match that filter.</p></div>}
    </div>
  );
}

/* ===================== MATCH DETAIL ===================== */
function MatchDetail({ s }) {
  const m = WC.matchById(s.param.id);
  const [tab, setTab] = useState('preview');
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
          {live ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE {m.minute}'</span>
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
        <OddsRow m={m} selected={myBet?.pick || s.pickFor(m.id)} onPick={(pick, odds) => s.openBet(m, pick, odds)} />
        {myBet
          ? <div className="row between mt-16 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
              <div className="small">Your bet: <b>{myBet.pick}</b> · <span className="tnum">{myBet.stake}</span> pts @ <span className="tnum">{myBet.odds.toFixed(2)}</span></div>
              <span className={`badge badge-${myBet.status === 'WON' ? 'green' : myBet.status === 'LOST' ? 'danger' : 'sky'}`}>{myBet.status}</span>
            </div>
          : open && <Btn variant="primary" className="btn-block mt-16" icon="ball" onClick={() => s.openBet(m, '1', m.odds.mh)}>Place a bet</Btn>}
      </div>

      {/* tabs */}
      <div className="row gap-8 mt-24" style={{ overflowX: 'auto' }}>
        {[['preview', 'AI Pundit'], ['form', 'Form'], ['h2h', 'Head-to-head'], ['lineups', 'Lineups']].map(([k, l]) =>
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

function TeamBig({ t }) {
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
function PunditPanel({ m, home, away }) {
  const pick = m.odds.mh <= m.odds.ma ? '1' : '2';
  const pickTeam = pick === '1' ? home : away;
  return (
    <div className="stack gap-16">
      <div className="panel card-pad" style={{ background: 'linear-gradient(120deg, var(--sky-soft), transparent)' }}>
        <div className="row gap-14" style={{ alignItems: 'flex-start' }}>
          <Pundit size={56} mood="think" glow />
          <div className="grow">
            <div className="row between"><span className="badge badge-sky">Ora · Match preview</span><span className="tiny muted">Grounded on fixture data</span></div>
            <p className="t2 small mt-8" style={{ lineHeight: 1.6 }}>
              {home.name} arrive as FIFA #{home.rank} and have controlled tempo in their opening fixtures, while {away.name} (#{away.rank}) have looked sharpest in transition. Expect {home.name} to see more of the ball; the danger is {away.name} on the counter. Set pieces could decide a tight one.
            </p>
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
          <span>For entertainment only — Ora is not betting advice and never guarantees outcomes.</span>
        </div>
      </div>
    </div>
  );
}

function FormPanel({ home, away }) {
  const form = (seed) => 'WWDLW'.split('').sort(() => seed - .5);
  const Row = ({ t, f }) => (
    <div className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
      <div className="row gap-10"><Flag team={t} size={28} /><span style={{ fontWeight: 600 }}>{t.name}</span></div>
      <div className="row gap-6">{f.map((r, i) => <span key={i} className="badge" style={{ width: 24, justifyContent: 'center', background: r === 'W' ? 'var(--green-soft)' : r === 'L' ? 'var(--danger-soft)' : 'var(--surface-3)', color: r === 'W' ? 'var(--green)' : r === 'L' ? 'var(--danger)' : 'var(--text-2)' }}>{r}</span>)}</div>
    </div>
  );
  return <div className="stack gap-10"><div className="eyebrow">Last 5 matches</div><Row t={home} f={['W', 'W', 'D', 'L', 'W']} /><Row t={away} f={['W', 'D', 'W', 'W', 'L']} /></div>;
}

function H2HPanel({ home, away }) {
  return (
    <div className="card card-pad">
      <div className="row center gap-24" style={{ textAlign: 'center' }}>
        <div className="stack center gap-6"><Flag team={home} size={40} /><div className="display" style={{ fontSize: 30, color: 'var(--green)' }}>3</div><div className="tiny muted">{home.code} wins</div></div>
        <div className="stack center gap-6"><div className="display muted" style={{ fontSize: 22 }}>—</div><div className="display" style={{ fontSize: 30 }}>2</div><div className="tiny muted">Draws</div></div>
        <div className="stack center gap-6"><Flag team={away} size={40} /><div className="display" style={{ fontSize: 30, color: 'var(--sky)' }}>1</div><div className="tiny muted">{away.code} wins</div></div>
      </div>
      <div className="hr" style={{ margin: '16px 0' }}></div>
      <div className="stack gap-8">
        {[['2022', '2-1', home], ['2019', '1-1', null], ['2018', '0-2', away]].map(([y, sc, w], i) => (
          <div key={i} className="row between small"><span className="muted">{y} · Friendly</span><span className="tnum" style={{ fontWeight: 700 }}>{sc}</span></div>
        ))}
      </div>
    </div>
  );
}

function LineupsPanel({ home, away }) {
  // 4-3-3 rows as fractions of each half (from own goal-line outward)
  const F433 = [
    [[50, 6]],                                   // GK
    [[18, 24], [38, 20], [62, 20], [82, 24]],    // DEF
    [[28, 48], [50, 44], [72, 48]],              // MID
    [[22, 74], [50, 80], [78, 74]],              // FWD
  ];
  const labels = ['GK', 'RB', 'CB', 'CB', 'LB', 'CM', 'CM', 'CAM', 'RW', 'ST', 'LW'];
  const flat = F433.flat();

  const Dot = ({ t, x, y, n, top }) => (
    <div className="abs" style={{ left: `${x}%`, top: `${top ? y / 2 : 100 - y / 2}%`, transform: 'translate(-50%,-50%)', textAlign: 'center', width: 56 }}>
      <div style={{ width: 30, height: 30, margin: '0 auto', borderRadius: '50%', background: `linear-gradient(135deg, ${t.colors[0]}, ${t.colors[2]})`,
        border: '2px solid rgba(255,255,255,.85)', display: 'grid', placeItems: 'center', fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: 12, color: '#fff', boxShadow: '0 2px 6px rgba(0,0,0,.5)' }}>{n}</div>
      <div className="tiny" style={{ marginTop: 3, color: '#fff', fontWeight: 600, textShadow: '0 1px 3px rgba(0,0,0,.8)', fontSize: 9.5, lineHeight: 1.1 }}>{t.code} {n}</div>
    </div>
  );

  const Half = ({ t, top }) => flat.map((p, i) => <Dot key={i} t={t} x={p[0]} y={p[1]} n={i + 1} top={top} />);

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
        <Half t={home} top />
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
function BetSlip({ s }) {
  const sel = s.betSlip;
  const [stake, setStake] = useState(100);
  useEffect(() => { setStake(100); }, [sel?.match?.id, sel?.pick]);
  if (!sel) return null;
  const m = sel.match, odds = sel.odds, pick = sel.pick;
  const home = WC.byId(m.home), away = WC.byId(m.away);
  const pickLabel = pick === '1' ? home.name : pick === '2' ? away.name : 'Draw';
  const payout = Math.round(stake * (1 + odds));
  const profit = Math.round(stake * odds);
  const over = stake > s.points;
  const quick = [50, 100, 250, 500];

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
            {[['1', home.code, m.odds.mh], ['X', 'Draw', m.odds.md], ['2', away.code, m.odds.ma]].map(([k, lbl, o]) => (
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

          {/* payout */}
          <div className="card-2 card-pad ticket-notch mt-16" style={{ borderRadius: 'var(--r-sm)' }}>
            <div className="row between small"><span className="t2">Pick</span><span style={{ fontWeight: 700 }}>{pickLabel} ({pick})</span></div>
            <div className="row between small mt-8"><span className="t2">Odds</span><span className="tnum">×{(1 + odds).toFixed(2)}</span></div>
            <div className="hr" style={{ margin: '10px 0' }}></div>
            <div className="row between"><span className="t2">Potential payout</span><span className="tnum text-green" style={{ fontSize: 20, fontWeight: 700 }}>{payout.toLocaleString()}</span></div>
            <div className="row between tiny muted mt-4"><span>Profit if you win</span><span className="tnum">+{profit.toLocaleString()}</span></div>
          </div>

          {over && <p className="tiny text-danger mt-8" style={{ textAlign: 'center' }}>Stake exceeds your balance.</p>}
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={over || stake <= 0} onClick={() => s.confirmBet(stake)}>
            Confirm bet · {stake} pts
          </Btn>
          <p className="tiny muted mt-8" style={{ textAlign: 'center' }}>Bets lock at kickoff and can't be changed after.</p>
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { Schedule, MatchDetail, BetSlip });
