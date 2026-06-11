'use client';
/* World Cup Games — Landing · Auth · Home (ported from design screens-core.jsx) */
import React, { useState, useEffect } from 'react';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Pundit, SecHead, Avatar, TIER_C } from '@/components/ui';
import { MatchBetCard, type RealMatch } from '@/components/screens-match';
import { BRAND } from '@/lib/i18n/locales';
import { useT } from '@/lib/i18n/hooks';
import { pctSigned } from '@/lib/format';
import { checkinReward } from '@wc/core';

/* ===================== LANDING ===================== */
export function Landing({ s }: ScreenProps) {
  const { t } = useT();
  const [feat, setFeat] = useState<RealMatch[]>([]);
  useEffect(() => {
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => { const all = (j?.data ?? []) as RealMatch[]; setFeat(all.filter(mm => mm.status === 'SCHEDULED' && mm.odds).slice(0, 3)); })
      .catch(() => {});
  }, []);
  return (
    <div className="landing">
      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '40px 24px 20px', textAlign: 'center' }}>
        <span className="badge badge-gold fade-up" style={{ fontSize: 12 }}>{t('landing.badge')}</span>
        <h1 className="display fade-up" style={{ fontSize: 'clamp(40px,8vw,88px)', marginTop: 18, lineHeight: 0.95 }}>
          {t('landing.heroLine1')}<br /><span style={{ background: 'linear-gradient(100deg,var(--green),var(--sky))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{t('landing.heroLine2')}</span>
        </h1>
        <p className="lead fade-up" style={{ maxWidth: 560, margin: '20px auto 0', fontSize: 19 }}>
          {t('landing.lead')}
        </p>
        <div className="row center gap-12 wrap wrap-w fade-up" style={{ marginTop: 28 }}>
          <Btn variant="primary" size="lg" icon="ball" onClick={() => s.go('auth', { mode: 'signup' })}>{t('landing.ctaClaim')}</Btn>
          <Btn variant="outline" size="lg" onClick={() => s.go('auth', { mode: 'login' })}>{t('landing.ctaHaveAccount')}</Btn>
        </div>
        <div className="row center gap-24 wrap wrap-w" style={{ marginTop: 26, color: 'var(--muted)', fontSize: 13 }}>
          <span>{t('landing.trust1')}</span><span>·</span><span>{t('landing.trust2')}</span><span>·</span><span>{t('landing.trust3')}</span>
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '40px auto 0', padding: '0 24px' }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="eyebrow">{t('landing.upNext')}</span>
          <button className="chip" onClick={() => s.go('schedule')}>{t('landing.allMatches')}</button>
        </div>
        <div className="grid-auto" style={{ '--col-min': '280px', '--gap': '16px' } as React.CSSProperties}>
          {feat.map((m) => <MatchBetCard key={m.id} m={m} s={s} />)}
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '56px auto 0', padding: '0 24px' }}>
        <h2 className="h2" style={{ textAlign: 'center', marginBottom: 28 }}>{t('landing.stepsTitle')}</h2>
        <div className="grid-auto" style={{ '--col-min': '240px', '--gap': '16px' } as React.CSSProperties}>
          {[
            { n: '01', t: t('landing.step1Title'), d: t('landing.step1Desc'), c: 'var(--gold)', i: 'wallet' },
            { n: '02', t: t('landing.step2Title'), d: t('landing.step2Desc'), c: 'var(--green)', i: 'target' },
            { n: '03', t: t('landing.step3Title'), d: t('landing.step3Desc'), c: 'var(--sky)', i: 'trophy' },
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
        <div className="panel card-pad-lg row between gap-24 wrap wrap-w" style={{ background: 'linear-gradient(120deg, var(--sky-soft), transparent)' }}>
          <div style={{ flex: 1, minWidth: 260 }}>
            <span className="badge badge-sky">{t('common.aiPundit')}</span>
            <h2 className="h2" style={{ marginTop: 12 }}>{t('landing.punditTitle')}</h2>
            <p className="t2 mt-8" style={{ maxWidth: 460 }}>{t('landing.punditDesc')}</p>
          </div>
          <Pundit size={140} mood="happy" glow />
        </div>
      </div>

      <div style={{ maxWidth: 1080, margin: '40px auto 0', padding: '0 24px' }}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <span className="eyebrow">{t('landing.exploreHead')}</span>
        </div>
        <div className="grid-auto" style={{ '--col-min': '220px', '--gap': '16px' } as React.CSSProperties}>
          {[
            { k: 'schedule', t: t('landing.exploreSchedule'), d: t('landing.exploreScheduleD'), i: 'calendar', c: 'var(--green)' },
            { k: 'leaderboard', t: t('landing.exploreLeaderboard'), d: t('landing.exploreLeaderboardD'), i: 'trophy', c: 'var(--gold)' },
            { k: 'groups', t: t('landing.exploreGroups'), d: t('landing.exploreGroupsD'), i: 'grid', c: 'var(--sky)' },
            { k: 'bracket', t: t('landing.exploreBracket'), d: t('landing.exploreBracketD'), i: 'bracket', c: 'var(--magenta)' },
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
        <h2 className="display" style={{ fontSize: 'clamp(28px,5vw,48px)' }}>{t('landing.kickoffTitle')}</h2>
        <p className="lead mt-8">{t('landing.kickoffSub')}</p>
        <Btn variant="primary" size="lg" className="mt-16" onClick={() => s.go('auth', { mode: 'signup' })}>{t('landing.startFree')}</Btn>
      </div>
    </div>
  );
}

/* Password input with a show/hide toggle (PRD review §auth). */
function PasswordInput({ value, onChange, placeholder, autoComplete }: {
  value: string; onChange: (v: string) => void; placeholder?: string; autoComplete?: string;
}) {
  const { t } = useT();
  const [show, setShow] = useState(false);
  return (
    <div className="rel">
      <input
        className="input"
        type={show ? 'text' : 'password'}
        value={value}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        style={{ paddingRight: 44 }}
      />
      <button
        type="button"
        aria-label={show ? t('auth.hidePassword') : t('auth.showPassword')}
        onClick={() => setShow((v) => !v)}
        style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--muted)', display: 'grid', placeItems: 'center', padding: 6 }}
      >
        <Icon name={show ? 'eye-off' : 'eye'} size={18} />
      </button>
    </div>
  );
}

/* ===================== AUTH ===================== */
export function Auth({ s }: ScreenProps) {
  const { t } = useT();
  const [mode, setMode] = useState<string>((s.param?.mode as string) || 'signup');
  const signup = mode === 'signup';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  function handleSubmit() {
    if (signup && password !== confirm) {
      s.toastMsg(t('auth.toastPwMismatch'), 'alert', 'var(--danger)');
      return;
    }
    s.login(email, password, mode);
  }

  // Forgot-password inline flow state
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  async function handleForgot() {
    setForgotLoading(true);
    try {
      const res = await fetch('/api/v1/auth/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      });
      const json = await res.json();
      // In dev/no-email mode the token is returned in the response
      setResetToken(json?.data?.resetToken ?? null);
    } catch {
      s.toastMsg(t('auth.toastNetwork'), 'alert', 'var(--danger)');
    } finally {
      setForgotLoading(false);
    }
  }

  async function handleReset() {
    if (!resetToken) return;
    setResetLoading(true);
    try {
      const res = await fetch('/api/v1/auth/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        const code = json?.error?.code;
        if (code === 'INVALID_TOKEN') s.toastMsg(t('auth.toastResetInvalid'), 'alert', 'var(--danger)');
        else if (code === 'WEAK_PASSWORD') s.toastMsg(t('auth.toastResetWeak'), 'alert', 'var(--danger)');
        else s.toastMsg(t('auth.toastResetFailed'), 'alert', 'var(--danger)');
      } else {
        s.toastMsg(t('auth.toastResetOk'), 'check', 'var(--green)');
        setForgotOpen(false);
        setResetToken(null);
        setNewPassword('');
        setForgotEmail('');
        setMode('login');
      }
    } catch {
      s.toastMsg(t('auth.toastNetwork'), 'alert', 'var(--danger)');
    } finally {
      setResetLoading(false);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'grid', gridTemplateColumns: '1fr', placeItems: 'center', padding: 20 }}>
      <div className="row" style={{ width: '100%', maxWidth: 920, gap: 0, borderRadius: 'var(--r-xl)', overflow: 'hidden', boxShadow: 'var(--sh-3)' }}>
        <div className="hide-mobile" style={{ flex: 1, alignSelf: 'stretch', padding: 40, background: 'linear-gradient(160deg, var(--surface-2), var(--bg-2))', borderRight: '1px solid var(--line)', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div className="display" style={{ fontSize: 28, background: 'linear-gradient(100deg,var(--green),var(--sky))', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{BRAND}</div>
          <div>
            <Pundit size={88} mood="happy" glow />
            <div className="h2" style={{ marginTop: 18 }}>{t('auth.heroHeading')}</div>
            <div className="row gap-10 mt-16">
              <span className="badge badge-gold">{t('auth.badgeSignup')}</span>
              <span className="badge badge-green">{t('auth.badgeDaily')}</span>
            </div>
          </div>
          <div className="small muted">{t('auth.virtualNote')}</div>
        </div>
        <div style={{ flex: 1, background: 'var(--surface)', padding: 'clamp(28px,5vw,44px)', alignSelf: 'stretch' }}>
          <div className="row gap-8" style={{ marginBottom: 24 }}>
            <button className={`chip ${signup ? 'active' : ''}`} onClick={() => { setMode('signup'); setForgotOpen(false); }}>{t('auth.tabSignup')}</button>
            <button className={`chip ${!signup ? 'active' : ''}`} onClick={() => { setMode('login'); setForgotOpen(false); }}>{t('auth.tabLogin')}</button>
          </div>
          <h2 className="h2">{signup ? t('auth.headingSignup') : t('auth.headingLogin')}</h2>
          <p className="small muted mt-4">{signup ? t('auth.subSignup') : t('auth.subLogin')}</p>
          <div className="stack gap-16" style={{ marginTop: 24 }}>
            {signup && <div className="field"><label className="label">{t('auth.username')}</label><input className="input" placeholder={t('auth.usernamePh')} /></div>}
            <div className="field"><label className="label">{t('auth.email')}</label><input className="input" placeholder={t('auth.emailPh')} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="field"><label className="label">{t('auth.password')}</label><PasswordInput value={password} onChange={setPassword} placeholder={t('auth.passwordPh')} autoComplete={signup ? 'new-password' : 'current-password'} /></div>
            {signup && <div className="field"><label className="label">{t('auth.confirmPassword')}</label><PasswordInput value={confirm} onChange={setConfirm} placeholder={t('auth.confirmPasswordPh')} autoComplete="new-password" /></div>}
            {!signup && (
              <div className="row between">
                <label className="row gap-8 small t2"><input type="checkbox" defaultChecked /> {t('auth.rememberMe')}</label>
                <button className="small text-sky" style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0 }} onClick={() => setForgotOpen((v) => !v)}>{t('auth.forgot')}</button>
              </div>
            )}
            {/* Inline forgot-password flow (dev mode: token returned in response; wire to email in prod) */}
            {!signup && forgotOpen && (
              <div className="card card-pad stack gap-12" style={{ background: 'var(--surface-2)' }}>
                {!resetToken ? (
                  <>
                    <p className="small t2">{t('auth.forgotPrompt')}</p>
                    <div className="field"><label className="label">{t('auth.yourEmail')}</label><input className="input" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder={t('auth.emailPh')} /></div>
                    <Btn variant="primary" size="sm" disabled={forgotLoading || !forgotEmail} onClick={handleForgot}>{forgotLoading ? t('auth.sending') : t('auth.sendReset')}</Btn>
                  </>
                ) : (
                  <>
                    <p className="small t2">{t('auth.resetSent')}</p>
                    <div className="field"><label className="label">{t('auth.newPassword')}</label><PasswordInput value={newPassword} onChange={setNewPassword} placeholder={t('auth.newPasswordPh')} autoComplete="new-password" /></div>
                    <Btn variant="primary" size="sm" disabled={resetLoading || !newPassword} onClick={handleReset}>{resetLoading ? t('auth.resetting') : t('auth.resetBtn')}</Btn>
                  </>
                )}
              </div>
            )}
            <Btn variant="primary" size="lg" className="btn-block" onClick={handleSubmit}>{signup ? t('auth.submitSignup') : t('auth.submitLogin')}</Btn>
            <div className="row center gap-12"><div className="hr grow" /><span className="tiny muted">{t('auth.or')}</span><div className="hr grow" /></div>
            <Btn variant="ghost" className="btn-block" onClick={() => { window.location.href = '/api/v1/auth/google'; }}>{t('auth.google')}</Btn>
            <p className="tiny muted" style={{ textAlign: 'center' }}>{t('auth.terms')}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ===================== HOME ===================== */
export function Home({ s }: ScreenProps) {
  const { t, fmt } = useT();
  const me = s.me;
  const [today, setToday] = useState<RealMatch[]>([]);
  useEffect(() => {
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => { const all = (j?.data ?? []) as RealMatch[]; setToday(all.filter(mm => mm.status === 'SCHEDULED' && mm.odds).slice(0, 5)); })
      .catch(() => {});
  }, []);
  return (
    <div className="page fade-up">
      <div className="row between wrap wrap-w gap-16" style={{ marginBottom: 22 }}>
        <div>
          <div className="eyebrow">{t('home.matchday')}{today[0] ? ` · ${fmt.date(today[0].kickoffAt)}` : ''}</div>
          <h1 className="h1" style={{ marginTop: 6 }}>{t('home.greeting', { name: me.name.split(' ')[0] })}</h1>
        </div>
        <CheckinCard s={s} />
      </div>

      <div className="grid-auto" style={{ '--col-min': '136px', '--gap': '12px', marginBottom: 26 } as React.CSSProperties}>
        <Stat val={s.points.toLocaleString()} lbl={t('home.statBalance')} c="var(--gold)" i="wallet" onClick={() => s.go('wallet')} />
        <Stat val={pctSigned(me.roi)} lbl={t('home.statRoi')} c="var(--green)" i="trending" onClick={() => s.go('mybets')} />
        <Stat val={me.rank == null ? '—' : `#${me.rank.toLocaleString()}`} lbl={t('home.statRank')} c="var(--sky)" i="trophy" onClick={() => s.go('leaderboard')} />
        <Stat val={`${me.won}-${me.lost}`} lbl={t('home.statWl')} c="var(--text)" i="target" onClick={() => s.go('mybets')} />
      </div>

      <div className="grid gap-20" style={{ gridTemplateColumns: 'minmax(0,1.6fr) minmax(0,1fr)' }} id="home-grid">
        <div>
          <SecHead title={t('home.todayTitle')} sub={t('home.todaySub')} action={<button className="chip" onClick={() => s.go('schedule')}>{t('home.fullSchedule')}</button>} />
          <div className="stack gap-12">
            {today.map((m) => <MatchBetCard key={m.id} m={m} s={s} />)}
            {today.length === 0 && <div className="card card-pad" style={{ textAlign: 'center' }}><p className="muted small">{t('home.noUpcoming')}</p></div>}
          </div>
        </div>
        <div className="stack gap-20">
          <Missions s={s} />
          <MiniBoard s={s} />
          <PunditPromo s={s} />
          <ActivityFeed />
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
  const { t } = useT();
  // s.streak is the pre-check-in streak; checking in today increments it by 1
  const todayReward = checkinReward(s.streak + 1);
  const milestoneBadge = s.streak < 3
    ? t('home.streakMilestone3', { n: checkinReward(3) })
    : s.streak < 7
      ? t('home.streakMilestone7', { n: checkinReward(7) })
      : s.streak < 14
        ? t('home.streakMilestone14', { n: checkinReward(14) })
        : t('home.streakMax', { n: checkinReward(14) });
  return (
    <div className="card card-pad" style={{ background: 'linear-gradient(120deg, var(--gold-soft), transparent)', borderColor: 'rgba(255,200,61,.25)', minWidth: 248 }}>
      <div className="row between">
        <div className="row gap-8"><Icon name="fire" size={20} fill="var(--gold)" /><span style={{ fontFamily: 'var(--f-display)', fontWeight: 800 }}>{t('home.streakLabel', { n: s.streak })}</span></div>
        <span className="badge badge-gold">{milestoneBadge}</span>
      </div>
      <div className="row gap-4 mt-12">
        {[1, 2, 3, 4, 5, 6, 7].map((d) => (
          <div key={d} style={{ flex: 1, height: 6, borderRadius: 4, background: d <= s.streak ? 'var(--gold)' : 'var(--surface-2)' }} />
        ))}
      </div>
      <Btn variant={s.checkedIn ? 'ghost' : 'gold'} size="sm" className="btn-block mt-12" disabled={s.checkedIn} onClick={() => s.checkin()}>
        {s.checkedIn ? t('home.checkedIn') : t('home.checkin', { n: todayReward })}
      </Btn>
    </div>
  );
}

interface ApiMission {
  code: string;
  label: string;
  reward: number;
  progress: number;
  target: number;
  complete: boolean;
  claimed: boolean;
  icon: string;
}

function Missions({ s }: ScreenProps) {
  const { t } = useT();
  const [missions, setMissions] = useState<ApiMission[]>([]);

  const fetchMissions = () => {
    fetch('/api/v1/me/missions')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.data) setMissions(j.data as ApiMission[]); })
      .catch(() => { /* keep fallback */ });
  };

  useEffect(() => { fetchMissions(); }, []);

  const handleClaim = async (code: string) => {
    await s.claimMission(code);
    fetchMissions();
  };

  const complete = missions.filter((m) => m.complete).length;
  return (
    <div className="card card-pad">
      <SecHead title={t('home.missionsTitle')} sub={missions.length > 0 ? t('home.missionsProgress', { complete, total: missions.length }) : undefined} />
      {missions.length === 0 ? (
        <p className="small muted" style={{ marginTop: 8 }}>{t('home.noMissions')}</p>
      ) : (
        <div className="stack gap-12">
          {missions.map((m) => (
            <div key={m.code} className="row between gap-12">
              <div className="row gap-10" style={{ minWidth: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--surface-2)', display: 'grid', placeItems: 'center', flex: 'none' }}>
                  <Icon name={m.icon} size={17} style={{ color: m.complete ? 'var(--green)' : 'var(--text-2)' }} />
                </div>
                <div style={{ minWidth: 0 }}>
                  <div className="small" style={{ fontWeight: 600 }}>{m.label}</div>
                  <div className="tiny muted">{m.progress}/{m.target} · +{m.reward} pts</div>
                </div>
              </div>
              {m.claimed ? <span className="badge badge-muted">{t('home.claimed')}</span>
                : m.complete ? <Btn variant="gold" size="sm" onClick={() => handleClaim(m.code)}>{t('home.claim')}</Btn>
                  : <span className="tnum small muted">{m.progress}/{m.target}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MiniBoard({ s }: ScreenProps) {
  const { t } = useT();
  const [rows, setRows] = useState<import('@/lib/wc').LeaderRow[]>([]);

  useEffect(() => {
    fetch('/api/v1/leaderboard')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { setRows(j?.data ?? []); })
      .catch(() => { /* keep empty */ });
  }, []);

  const top = rows.slice(0, 4);
  return (
    <div className="card card-pad">
      <SecHead title={t('home.leaderboardTitle')} action={<button className="chip" onClick={() => s.go('leaderboard')}>{t('home.seeAll')}</button>} />
      {top.length === 0 ? (
        <p className="small muted" style={{ marginTop: 8 }}>{t('home.leaderboardEmpty')}</p>
      ) : (
        <div className="stack gap-10">
          {top.map((p) => (
            <div key={p.rank} className="row between">
              <div className="row gap-10"><span className="tnum muted" style={{ width: 18 }}>{p.rank}</span><Avatar initials={p.name.slice(0, 2).toUpperCase()} size={28} color={TIER_C[p.tier]} /><span className="small" style={{ fontWeight: 600 }}>{p.name}</span></div>
              <span className="tnum" style={{ fontWeight: 700, color: p.roi >= 0 ? 'var(--green)' : 'var(--danger)' }}>{pctSigned(p.roi)}</span>
            </div>
          ))}
          <div className="hr" style={{ margin: '4px 0' }} />
          <div className="row between">
            <div className="row gap-10"><span className="tnum text-gold" style={{ width: 18, fontWeight: 700 }}>{s.me.rank ?? '—'}</span><Avatar initials={s.me.avatar} size={28} color="var(--gold)" /><span className="small" style={{ fontWeight: 700 }}>{t('home.you')}</span></div>
            <span className="tnum" style={{ fontWeight: 700, color: s.me.roi >= 0 ? 'var(--green)' : 'var(--danger)' }}>{pctSigned(s.me.roi)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function PunditPromo({ s }: ScreenProps) {
  const { t } = useT();
  return (
    <div className="card card-pad pointer card-hover" onClick={() => s.go('schedule')} style={{ background: 'linear-gradient(120deg, var(--sky-soft), transparent)' }}>
      <div className="row gap-14">
        <Pundit size={64} mood="think" glow />
        <div>
          <div className="row gap-8"><span className="badge badge-sky">{t('common.aiPundit')}</span></div>
          <div className="h3" style={{ marginTop: 8, fontSize: 17 }}>{t('home.punditPromoTitle')}</div>
          <p className="tiny t2 mt-4">{t('home.punditPromoDesc')}</p>
        </div>
      </div>
    </div>
  );
}

interface FeedItem {
  who: string;
  action: 'bet' | 'won' | 'lost';
  matchId: string;
  detail: string;
  when: string;
}

function ActivityFeed() {
  const { t, fmt } = useT();
  const [items, setItems] = useState<FeedItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    fetch('/api/v1/feed')
      .then((r) => r.ok ? r.json() : null)
      .then((j) => { if (j?.data) setItems(j.data as FeedItem[]); })
      .catch(() => { /* keep empty */ })
      .finally(() => setLoaded(true));
  }, []);

  const actionColor = (action: FeedItem['action']) =>
    action === 'won' ? 'var(--green)' : action === 'lost' ? 'var(--danger)' : 'var(--sky)';

  const actionLabel = (action: FeedItem['action']) =>
    action === 'won' ? t('home.actionWon') : action === 'lost' ? t('home.actionLost') : t('home.actionBet');

  return (
    <div className="card card-pad">
      <SecHead title={t('home.feedTitle')} />
      {loaded && items.length === 0 ? (
        <p className="small muted" style={{ marginTop: 8 }}>{t('home.feedEmpty')}</p>
      ) : (
        <div className="stack gap-10" style={{ marginTop: 8 }}>
          {items.map((item, i) => (
            <div key={i} className="row between gap-8">
              <div className="row gap-8" style={{ minWidth: 0 }}>
                <span className="small" style={{ fontWeight: 600, color: actionColor(item.action) }}>{actionLabel(item.action)}</span>
                <span className="small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {item.who} · {item.detail}
                </span>
              </div>
              <span className="tiny muted" style={{ flexShrink: 0 }}>
                {fmt.date(item.when)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
