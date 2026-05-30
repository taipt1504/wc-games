'use client';
/* GOLAZO — Landing · Auth · Home (ported from design screens-core.jsx) */
import React, { useState } from 'react';
import { WC, type Match } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, MatchCard, Pundit, SecHead, Avatar, TIER_C } from '@/components/ui';

/* ===================== LANDING ===================== */
export function Landing({ s }: ScreenProps) {
  const feat = [WC.matchById(23), WC.matchById(27), WC.matchById(31)].filter(Boolean) as Match[];
  return (
    <div className="landing">
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 20px', textAlign: 'center' }}>
        <span className="badge badge-gold fade-up" style={{ fontSize: 12 }}>⚽ World Cup 2026 · 48 teams · 104 matches</span>
        <h1 className="display fade-up" style={{ fontSize: 'clamp(40px,8vw,88px)', marginTop: 18, lineHeight: 0.95 }}>
          PREDICT THE<br /><span style={{ background: 'linear-gradient(100deg,var(--green),var(--sky))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>WHOLE WORLD CUP</span>
        </h1>
        <p className="lead fade-up" style={{ maxWidth: 560, margin: '20px auto 0', fontSize: 19 }}>
          Stake virtual points on every match, ride the odds, and battle friends up the leaderboard. No real money — all bragging rights.
        </p>
        <div className="row center gap-12 wrap fade-up" style={{ marginTop: 28 }}>
          <Btn variant="primary" size="lg" icon="ball" onClick={() => s.go('auth', { mode: 'signup' })}>Claim your 1,000 points</Btn>
          <Btn variant="outline" size="lg" onClick={() => s.go('auth', { mode: 'login' })}>I have an account</Btn>
        </div>
        <div className="row center gap-24 wrap" style={{ marginTop: 26, color: 'var(--muted)', fontSize: 13 }}>
          <span>🔒 Virtual points, never real cash</span><span>·</span><span>🤖 AI Pundit on every match</span><span>·</span><span>👥 Private friend lobbies</span>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '40px auto 0', padding: '0 24px' }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="eyebrow">Up next · place a bet in seconds</span>
          <button className="chip" onClick={() => s.go('schedule')}>All matches →</button>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 16 }}>
          {feat.map((m) => <MatchCard key={m.id} m={m} onOpen={() => s.go('match', { id: m.id })} onPick={(pick, odds) => s.openBet(m, pick, odds)} />)}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '56px auto 0', padding: '0 24px' }}>
        <h2 className="h2" style={{ textAlign: 'center', marginBottom: 28 }}>Three steps to glory</h2>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
          {[
            { n: '01', t: 'Get 1,000 points', d: 'Sign up free and your wallet is instantly loaded. Check in daily for +200 more.', c: 'var(--gold)', i: 'wallet' },
            { n: '02', t: 'Back your calls', d: 'Pick 1 · X · 2 on any match. Win and your stake multiplies by the odds.', c: 'var(--green)', i: 'target' },
            { n: '03', t: 'Climb & flex', d: 'Top the global ROI board, open private lobbies, share your wins.', c: 'var(--sky)', i: 'trophy' },
          ].map((x) => (
            <div key={x.n} className="card card-pad-lg">
              <div className="row between"><span className="display" style={{ fontSize: 30, color: x.c }}>{x.n}</span><Icon name={x.i} size={26} style={{ color: x.c }} /></div>
              <div className="h3" style={{ marginTop: 14 }}>{x.t}</div>
              <p className="t2 small mt-8">{x.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '40px auto 0', padding: '0 24px' }}>
        <div className="panel card-pad-lg row between gap-24 wrap" style={{ background: 'linear-gradient(120deg, var(--sky-soft), transparent)' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className="badge badge-sky">AI Pundit</span>
            <h2 className="h2" style={{ marginTop: 12 }}>Ora reads the game for you</h2>
            <p className="t2 mt-8" style={{ maxWidth: 460 }}>Grounded match previews, form guides, head-to-head history and one smart pick per match — built from real fixture data. Always for fun, never betting advice.</p>
          </div>
          <Pundit size={140} mood="happy" glow />
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '40px auto 0', padding: '0 24px' }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="eyebrow">Explore freely · no account needed</span>
        </div>
        <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 16 }}>
          {[
            { k: 'schedule', t: 'Match schedule', d: '104 fixtures, live & upcoming', i: 'calendar', c: 'var(--green)' },
            { k: 'leaderboard', t: 'Leaderboard', d: 'See who tops the global ROI board', i: 'trophy', c: 'var(--gold)' },
            { k: 'groups', t: 'Group standings', d: '12 groups, live tables', i: 'grid', c: 'var(--sky)' },
            { k: 'bracket', t: 'Knockout bracket', d: 'Round of 32 to the final', i: 'bracket', c: 'var(--magenta)' },
          ].map((x) => (
            <div key={x.k} className="card card-pad card-hover pointer" onClick={() => s.go(x.k)}>
              <div className="row between"><div style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--surface-2)', display: 'grid', placeItems: 'center' }}><Icon name={x.i} size={20} style={{ color: x.c }} /></div><Icon name="arrowR" size={16} className="muted" /></div>
              <div className="h3 mt-12" style={{ fontSize: 17 }}>{x.t}</div>
              <p className="tiny t2 mt-4">{x.d}</p>
            </div>
          ))}
        </div>
      </div>

      <div style={{ textAlign: 'center', padding: '56px 24px 80px' }}>
        <h2 className="display" style={{ fontSize: 'clamp(28px,5vw,48px)' }}>Kickoff is June 11.</h2>
        <p className="lead mt-8">Lock in your predictions before the world does.</p>
        <Btn variant="primary" size="lg" className="mt-16" onClick={() => s.go('auth', { mode: 'signup' })}>Start free →</Btn>
      </div>
    </div>
  );
}

/* ===================== AUTH ===================== */
export function Auth({ s }: ScreenProps) {
  const [mode, setMode] = useState<string>((s.param?.mode as string) || 'signup');
  const signup = mode === 'signup';
  const [email, setEmail] = useState('alex@email.com');
  const [password, setPassword] = useState('password');
  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr', placeItems: 'center', padding: 20 }}>
      <div className="row" style={{ width: '100%', maxWidth: 920, gap: 0, borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-3)' }}>
        <div className="hide-mobile" style={{ flex: 1, alignSelf: 'stretch', padding: 40, background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="display" style={{ fontSize: 28, background: 'linear-gradient(100deg,var(--green),var(--sky))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>GOLAZO</div>
          <div>
            <Pundit size={88} mood="happy" glow />
            <div className="h2" style={{ marginTop: 18 }}>Welcome to the<br />biggest game of the<br />summer.</div>
            <div className="row gap-10 mt-16">
              <span className="badge badge-gold">+1,000 pts on signup</span>
              <span className="badge badge-green">+200 daily</span>
            </div>
          </div>
          <div className="small muted">Virtual points only. No real-money wagering, ever.</div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', padding: 'clamp(28px,5vw,44px)', alignSelf: 'stretch' }}>
          <div className="row gap-8" style={{ marginBottom: 24 }}>
            <button className={`chip ${signup ? 'active' : ''}`} onClick={() => setMode('signup')}>Sign up</button>
            <button className={`chip ${!signup ? 'active' : ''}`} onClick={() => setMode('login')}>Log in</button>
          </div>
          <h2 className="h2">{signup ? 'Create your account' : 'Welcome back'}</h2>
          <p className="small muted mt-4">{signup ? 'It takes 30 seconds. 1,000 points are waiting.' : 'Pick up your streak where you left off.'}</p>
          <div className="stack gap-16" style={{ marginTop: 24 }}>
            {signup && <div className="field"><label className="label">Username</label><input className="input" placeholder="midfield_maestro" defaultValue="alexr" /></div>}
            <div className="field"><label className="label">Email</label><input className="input" placeholder="you@email.com" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label className="label">Password</label><input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></div>
            {!signup && <div className="row between"><label className="row gap-8 small t2"><input type="checkbox" defaultChecked /> Remember me</label><a className="small text-sky">Forgot password?</a></div>}
            <Btn variant="primary" size="lg" className="btn-block" onClick={() => s.login(email, password, mode)}>{signup ? 'Claim 1,000 points & play' : 'Log in'}</Btn>
            <div className="row center gap-12"><div className="hr grow" /><span className="tiny muted">OR</span><div className="hr grow" /></div>
            <Btn variant="ghost" className="btn-block" onClick={() => s.toastMsg('Social login coming soon', 'alert', 'var(--sky)')}>Continue with Google</Btn>
            <p className="tiny muted" style={{ textAlign: 'center' }}>By continuing you agree these are virtual points for entertainment, with no cash value.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== HOME ===================== */
export function Home({ s }: ScreenProps) {
  const me = WC.me;
  const today = [WC.matchById(23), WC.matchById(24), WC.matchById(27), WC.matchById(31), WC.matchById(33)].filter(Boolean) as Match[];
  const smart: Record<number, string> = { 23: '1', 27: '2', 31: 'X' };
  return (
    <div className="page fade-up">
      <div className="row between wrap gap-16" style={{ marginBottom: 22 }}>
        <div>
          <div className="eyebrow">Matchday · {WC.fmtDate(new Date('2026-06-13'))}</div>
          <h1 className="h1" style={{ marginTop: 6 }}>Hey {me.name.split(' ')[0]} 👋</h1>
        </div>
        <CheckinCard s={s} />
      </div>

      <div className="grid gap-12" style={{ gridTemplateColumns: 'repeat(auto-fit,minmax(136px,1fr))', marginBottom: 26 }}>
        <Stat val={s.points.toLocaleString()} lbl="Point balance" c="var(--gold)" i="wallet" onClick={() => s.go('wallet')} />
        <Stat val={`+${me.roi}%`} lbl="Your ROI" c="var(--green)" i="trending" onClick={() => s.go('mybets')} />
        <Stat val={`#${me.rank.toLocaleString()}`} lbl="Global rank" c="var(--sky)" i="trophy" onClick={() => s.go('leaderboard')} />
        <Stat val={`${me.won}-${me.lost}`} lbl="Win / loss" c="var(--text)" i="target" onClick={() => s.go('mybets')} />
      </div>

      <div className="grid gap-20" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }} id="home-grid">
        <div>
          <SecHead title="Today's matches" sub="Lock your picks before kickoff" action={<button className="chip" onClick={() => s.go('schedule')}>Full schedule →</button>} />
          <div className="stack gap-12">
            {today.map((m) => (
              <div key={m.id} className="rel">
                {smart[m.id] && <span className="badge badge-sky" style={{ position: 'absolute', top: 14, right: 44, zIndex: 2 }}><Icon name="sparkles" size={12} />Ora: {smart[m.id]}</span>}
                <MatchCard m={m} onOpen={(mm) => s.go('match', { id: mm.id })} onPick={(pick, odds) => s.openBet(m, pick, odds)} picked={s.pickFor(m.id)} />
              </div>
            ))}
          </div>
        </div>
        <div className="stack gap-20">
          <Missions s={s} />
          <MiniBoard s={s} />
          <PunditPromo s={s} />
        </div>
      </div>
    </div>
  );
}

function Stat({ val, lbl, c, i, onClick }: { val: string; lbl: string; c: string; i: string; onClick?: () => void }) {
  return (
    <div className="card card-pad card-hover pointer" onClick={onClick}>
      <div className="row between"><Icon name={i} size={18} style={{ color: c }} /><Icon name="chevR" size={14} className="muted" /></div>
      <div className="stat mt-12"><span className="s-val tnum" style={{ color: c }}>{val}</span><span className="s-lbl">{lbl}</span></div>
    </div>
  );
}

function CheckinCard({ s }: ScreenProps) {
  return (
    <div className="card card-pad" style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.25)', minWidth: 248 }}>
      <div className="row between">
        <div className="row gap-8"><Icon name="fire" size={20} fill="var(--gold)" /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{s.streak}-day streak</span></div>
        <span className="badge badge-gold">Day 7 = +300</span>
      </div>
      <div className="row gap-4 mt-12">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <div key={d} style={{ flex: 1, height: 6, borderRadius: 4, background: d <= s.streak ? 'var(--gold)' : 'var(--surface-2)' }} />
        ))}
      </div>
      <Btn variant={s.checkedIn ? 'ghost' : 'gold'} size="sm" className="btn-block mt-12" disabled={s.checkedIn} onClick={() => s.checkin()}>
        {s.checkedIn ? '✓ Checked in today' : 'Check in · +300 pts'}
      </Btn>
    </div>
  );
}

function Missions({ s }: ScreenProps) {
  return (
    <div className="card card-pad">
      <SecHead title="Daily missions" sub={`${WC.missions.filter((m) => m.done >= m.total).length}/${WC.missions.length} complete`} />
      <div className="stack gap-12">
        {WC.missions.map((m) => {
          const done = m.done >= m.total;
          return (
            <div key={m.id} className="row between gap-12">
              <div className="row gap-10" style={{ minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <Icon name={m.icon} size={17} style={{ color: done ? 'var(--green)' : 'var(--text-2)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600 }}>{m.label}</div>
                  <div className="tiny muted">{m.done}/{m.total} · +{m.reward} pts</div>
                </div>
              </div>
              {m.claimed ? <span className="badge badge-muted">Claimed</span>
                : done ? <Btn variant="gold" size="sm" onClick={() => s.claimMission(m.id)}>Claim</Btn>
                  : <span className="tnum small muted">{m.done}/{m.total}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MiniBoard({ s }: ScreenProps) {
  const top = WC.leaderboard.slice(0, 4);
  return (
    <div className="card card-pad">
      <SecHead title="Global leaderboard" action={<button className="chip" onClick={() => s.go('leaderboard')}>See all →</button>} />
      <div className="stack gap-10">
        {top.map((p) => (
          <div key={p.rank} className="row between">
            <div className="row gap-10"><span className="tnum muted" style={{ width: 18 }}>{p.rank}</span><Avatar initials={p.name.slice(0, 2).toUpperCase()} size={28} color={TIER_C[p.tier]} /><span className="small" style={{ fontWeight: 600 }}>{p.name}</span></div>
            <span className="tnum text-green" style={{ fontWeight: 700 }}>+{p.roi}%</span>
          </div>
        ))}
        <div className="hr" style={{ margin: '4px 0' }} />
        <div className="row between">
          <div className="row gap-10"><span className="tnum text-gold" style={{ width: 18, fontWeight: 700 }}>{WC.me.rank}</span><Avatar initials="AR" size={28} color="var(--gold)" /><span className="small" style={{ fontWeight: 700 }}>You</span></div>
          <span className="tnum text-green" style={{ fontWeight: 700 }}>+{WC.me.roi}%</span>
        </div>
      </div>
    </div>
  );
}

function PunditPromo({ s }: ScreenProps) {
  return (
    <div className="card card-pad pointer card-hover" onClick={() => s.go('match', { id: 23 })} style={{ background: 'linear-gradient(120deg, var(--sky-soft), transparent)' }}>
      <div className="row gap-14">
        <Pundit size={64} mood="think" glow />
        <div>
          <div className="row gap-8"><span className="badge badge-sky">AI Pundit</span></div>
          <div className="h3" style={{ marginTop: 8, fontSize: 17 }}>Ora&apos;s pick of the day</div>
          <p className="tiny t2 mt-4">&quot;France&apos;s press is overwhelming Switzerland&apos;s build-up. I lean home — but value sits on the draw.&quot;</p>
        </div>
      </div>
    </div>
  );
}
