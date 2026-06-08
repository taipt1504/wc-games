'use client';
/* ============================================================
   GOLAZO — App shell · client router · global store (ported from app.jsx)
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WC, type Bet } from '@/lib/wc';
import { apiFetch } from '@/lib/api';
import { openRealtime, closeRealtime, onRealtime } from '@/lib/realtime';
import type { Store, LedgerEntry, MeProfile } from '@/lib/store';
import { Btn, Icon, Avatar, Pundit, Toast, type ToastData } from '@/components/ui';
import { Landing, Auth, Home } from '@/components/screens-core';
import { Schedule, MatchDetail } from '@/components/screens-match';
import { Leaderboard, MyBets, Wallet, Profile } from '@/components/screens-compete';
import { Teams, TeamDetail, Groups, Bracket } from '@/components/screens-tournament';
import { Lobbies, LobbyCreate, LobbyView, BorrowModal } from '@/components/screens-lobby';
import { News, Article } from '@/components/screens-news';
import { Admin } from '@/components/screens-admin';
import { NotificationBell } from '@/components/notification-bell';
import { LangSwitch } from '@/components/lang-switch';
import { BRAND } from '@/lib/i18n/locales';
import { useT } from '@/lib/i18n/hooks';

const ROUTES: Record<string, React.ComponentType<{ s: Store }>> = {
  landing: Landing, auth: Auth, home: Home, schedule: Schedule, match: MatchDetail,
  leaderboard: Leaderboard, mybets: MyBets, wallet: Wallet, profile: Profile,
  teams: Teams, team: TeamDetail, groups: Groups, bracket: Bracket,
  lobbies: Lobbies, 'lobby-create': LobbyCreate, lobby: LobbyView,
  news: News, article: Article, admin: Admin,
};
const FULLBLEED = ['auth', 'admin'];
const GATED = ['home', 'mybets', 'wallet', 'profile', 'lobbies', 'lobby', 'lobby-create', 'admin'];
// nav arrays store i18n KEYS for labels (resolved via t() at render).
const PUB_NAV: [string, string][] = [['schedule', 'nav.matches'], ['leaderboard', 'nav.leaderboard'], ['teams', 'nav.teams'], ['groups', 'nav.groups'], ['bracket', 'nav.bracket'], ['news', 'nav.news']];
const RAIL: { sec: string | null; items: [string, string, string][] }[] = [
  { sec: null, items: [['home', 'nav.home', 'home'], ['schedule', 'nav.matches', 'calendar'], ['leaderboard', 'nav.leaderboard', 'trophy'], ['lobbies', 'nav.lobbies', 'users']] },
  { sec: 'nav.secTournament', items: [['teams', 'nav.teams', 'flag'], ['groups', 'nav.groups', 'grid'], ['bracket', 'nav.bracket', 'bracket'], ['news', 'nav.news', 'news']] },
  { sec: 'nav.secAccount', items: [['mybets', 'nav.mybets', 'target'], ['wallet', 'nav.wallet', 'wallet'], ['profile', 'nav.profile', 'user']] },
];
const TABS: [string, string, string][] = [['home', 'nav.home', 'home'], ['schedule', 'nav.matches', 'calendar'], ['leaderboard', 'nav.leaderboard', 'trophy'], ['lobbies', 'nav.lobbies', 'users'], ['more', 'nav.more', 'grid']];
const PRIMARY_TABS = new Set(['home', 'schedule', 'leaderboard', 'lobbies']);
const TITLE_KEYS: Record<string, string> = { home: 'nav.home', schedule: 'nav.matches', match: 'nav.match', leaderboard: 'nav.leaderboard', mybets: 'nav.mybets', wallet: 'nav.wallet', profile: 'nav.profile', teams: 'nav.teams', team: 'nav.team', groups: 'nav.groups', bracket: 'nav.bracket', lobbies: 'nav.lobbies', lobby: 'nav.lobby', 'lobby-create': 'nav.lobbyCreate', news: 'nav.news', article: 'nav.article' };

function navKey(r: string): string {
  if (['schedule', 'match'].includes(r)) return 'schedule';
  if (['teams', 'team', 'groups', 'bracket'].includes(r)) return r === 'team' ? 'teams' : r;
  if (['lobbies', 'lobby', 'lobby-create'].includes(r)) return 'lobbies';
  if (['news', 'article'].includes(r)) return 'news';
  return r;
}

const ME_DEFAULT: MeProfile = {
  name: WC.me.name, handle: WC.me.handle, avatar: WC.me.avatar, country: WC.me.country,
  rank: WC.me.rank, roi: WC.me.roi, won: WC.me.won, lost: WC.me.lost, settled: WC.me.settled, joined: WC.me.joined,
};

/* URL <-> route+param sync so reload/back/forward preserve the screen (SPA, single Next page). */
function routeToUrl(route: string, param: Record<string, unknown>): string {
  if (route === 'home' || route === 'landing') return '/';
  const sp = new URLSearchParams({ screen: route });
  for (const [k, v] of Object.entries(param)) if (v != null) sp.set(k, String(v));
  return `/?${sp.toString()}`;
}
function urlToRoute(): { route: string; param: Record<string, unknown> } | null {
  const sp = new URLSearchParams(window.location.search);
  const screen = sp.get('screen');
  if (!screen) return null;
  const param: Record<string, unknown> = {};
  sp.forEach((v, k) => { if (k !== 'screen' && k !== 'auth_error' && k !== 'join') param[k] = v; });
  return { route: screen, param };
}

export default function AppShell() {
  const { t } = useT();
  const [route, setRoute] = useState('landing');
  const skipPush = useRef(false);
  const [param, setParam] = useState<Record<string, unknown>>({});
  const [authed, setAuthed] = useState(false);
  const authedRef = useRef(false);
  const [me, setMe] = useState<MeProfile>(ME_DEFAULT);
  const [points, setPoints] = useState(WC.me.points);
  const [role, setRole] = useState<string>('USER');
  const [tier, setTier] = useState<string>(WC.me.tier);
  const [bets, setBets] = useState<Bet[]>(WC.myBets.map((b) => ({ ...b })));
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [streak, setStreak] = useState(WC.me.streak);
  const [winStreak, setWinStreak] = useState(WC.me.winStreak);
  const [checkedIn, setCheckedIn] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const [booting, setBooting] = useState(true);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [route, param]);

  // Push the current screen into the URL so reload/back/forward restore it.
  useEffect(() => {
    if (booting) return;
    if (skipPush.current) { skipPush.current = false; return; }
    const url = routeToUrl(route, param);
    if (url !== window.location.pathname + window.location.search) window.history.pushState({}, '', url);
  }, [route, param, booting]);

  // Browser back/forward → restore screen from the URL (without re-pushing).
  useEffect(() => {
    const onPop = () => {
      const r = urlToRoute();
      skipPush.current = true;
      if (r && (!GATED.includes(r.route) || authedRef.current)) { setRoute(r.route); setParam(r.param); }
      else { setRoute(authedRef.current ? 'home' : 'landing'); setParam({}); }
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const toastMsg = useCallback((msg: string, icon?: string, color?: string) => {
    setToast({ msg, icon, color });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const go = useCallback((r: string, p: Record<string, unknown> = {}) => {
    if (!authedRef.current && GATED.includes(r)) { setRoute('auth'); setParam({ mode: 'signup' }); return; }
    setRoute(r); setParam(p);
  }, []);

  // Single history model: in-app Back = browser Back (popstate restores the screen from the URL).
  const back = useCallback(() => { window.history.back(); }, []);

  const refreshUser = useCallback(async () => {
    try {
      const [meR, betsR, ledR] = await Promise.all([
        apiFetch('/api/v1/me'), apiFetch('/api/v1/me/predictions'), apiFetch('/api/v1/me/ledger'),
      ]);
      if (meR.ok) {
        const j = await meR.json(); const d = j.data;
        setPoints(Number(d.balance)); setRole(d.role ?? 'USER'); setWinStreak(d.winStreak ?? 0); setTier(d.tier ?? WC.me.tier);
        setStreak(d.streak ?? 0); setCheckedIn(d.checkedIn ?? false);
        setMe({
          name: d.name ?? ME_DEFAULT.name, handle: d.handle ?? ME_DEFAULT.handle, avatar: d.avatar ?? ME_DEFAULT.avatar,
          country: d.country ?? ME_DEFAULT.country, rank: d.rank ?? null, roi: d.roi ?? 0,
          won: d.won ?? 0, lost: d.lost ?? 0, settled: d.settled ?? 0, joined: ME_DEFAULT.joined,
        });
      }
      if (betsR.ok) { const j = await betsR.json(); setBets(j.data as Bet[]); }
      if (ledR.ok) { const j = await ledR.json(); setLedger(j.data as LedgerEntry[]); }
    } catch { /* keep current state on network error */ }
  }, []);

  // Realtime → keep wallet/bets fresh on settlement (notifications/chat/match handled by screens).
  useEffect(() => {
    const offRefresh = onRealtime('refresh', () => { void refreshUser(); });
    const offSettled = onRealtime('match.settled', () => { void refreshUser(); });
    return () => { offRefresh(); offSettled(); };
  }, [refreshUser]);

  // Rehydrate the session on load: the access JWT cookie persists (apiFetch silently rotates
  // the refresh token when it has expired), so a valid /me means the user is still logged in
  // after a refresh (F5 must not log them out). Also surfaces any OAuth redirect error.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const params = new URLSearchParams(window.location.search);
      const authError = params.get('auth_error');
      const joinCode = params.get('join'); // invite link → auto-join after auth
      const fromUrl = urlToRoute(); // deep link to a screen (captured before we clean the URL)
      if (authError) {
        const msg = authError === 'google_not_configured' ? t('toast.googleNotConfigured')
          : authError === 'banned' ? t('toast.accountBanned')
            : t('toast.googleFailed');
        toastMsg(msg, 'alert', 'var(--danger)');
      }
      const setTarget = (r: string, p: Record<string, unknown>) => {
        skipPush.current = true; setRoute(r); setParam(p);
        window.history.replaceState({}, '', routeToUrl(r, p));
      };
      try {
        const res = await apiFetch('/api/v1/me');
        if (!cancelled && res.ok) {
          authedRef.current = true;
          setAuthed(true);
          openRealtime();
          if (joinCode) setTarget('lobbies', { join: joinCode });
          else setTarget(fromUrl?.route ?? 'home', fromUrl?.param ?? {});
          void refreshUser();
        } else if (!cancelled) {
          // guest: restore a public deep link; gated screens fall back to the landing page
          if (fromUrl && !GATED.includes(fromUrl.route)) setTarget(fromUrl.route, fromUrl.param);
          else setTarget('landing', {});
          if (joinCode) toastMsg(t('toast.signInToJoin'), 'lock', 'var(--gold)');
        }
      } catch { /* stay logged out on network error */ }
      finally { if (!cancelled) setBooting(false); }
    })();
    return () => { cancelled = true; };
  }, [refreshUser, toastMsg]);

  const store: Store = {
    route, param, me, points, role, tier, bets, ledger, streak, winStreak, checkedIn, borrowOpen, toast, authed,
    go, back, toastMsg, refreshUser,
    login: async (email?: string, password?: string, mode?: string) => {
      const endpoint = mode === 'login' ? 'login' : 'register';
      try {
        const res = await fetch(`/api/v1/auth/${endpoint}`, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          const code = j?.error?.code;
          toastMsg(
            code === 'EMAIL_TAKEN' ? t('toast.emailTaken')
              : code === 'INVALID_CREDENTIALS' ? t('toast.invalidCreds')
                : t('toast.authFailed'),
            'alert', 'var(--danger)',
          );
          return;
        }
        authedRef.current = true; setAuthed(true); openRealtime(); setRoute('home'); setParam({}); void refreshUser();
        toastMsg(endpoint === 'register' ? t('toast.welcomeNew') : t('toast.welcomeBack'), 'star', 'var(--gold)');
      } catch {
        toastMsg(t('toast.networkRetry'), 'alert', 'var(--danger)');
      }
    },
    logout: () => {
      void fetch('/api/v1/auth/logout', { method: 'POST' });
      closeRealtime();
      authedRef.current = false; setAuthed(false);
      setRole('USER'); setMe(ME_DEFAULT); setPoints(0); setBets([]); setLedger([]); setStreak(0); setWinStreak(0); setTier(WC.me.tier); setCheckedIn(false);
      setRoute('landing'); setParam({});
    },
    checkin: async () => {
      if (checkedIn) return;
      try {
        const res = await fetch('/api/v1/checkin', { method: 'POST' });
        const j = await res.json().catch(() => ({}));
        if (res.ok) { setPoints(Number(j.data.balance)); setStreak(Number(j.data.streak)); setCheckedIn(true); toastMsg(t('toast.checkedIn', { reward: j.data.reward }), 'fire', 'var(--gold)'); }
        else { setCheckedIn(true); toastMsg(j?.error?.code === 'ALREADY_CHECKED_IN' ? t('toast.alreadyCheckedIn') : t('toast.checkinFailed'), 'alert', 'var(--gold)'); }
      } catch { toastMsg(t('toast.network'), 'alert', 'var(--danger)'); }
    },
    claimMission: async (code: string) => {
      try {
        const res = await fetch(`/api/v1/me/missions/${code}/claim`, { method: 'POST' });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          const { reward, balance } = j.data as { reward: number; balance: number };
          setPoints(balance);
          toastMsg(t('toast.missionComplete', { reward }), 'target', 'var(--purple)');
          void refreshUser();
        } else {
          const code_ = j?.error?.code;
          toastMsg(code_ === 'ALREADY_CLAIMED' ? t('toast.alreadyClaimed') : code_ === 'NOT_COMPLETE' ? t('toast.missionNotComplete') : t('toast.claimFailed'), 'alert', 'var(--danger)');
        }
      } catch { toastMsg(t('toast.network'), 'alert', 'var(--danger)'); }
    },
    openBorrow: () => setBorrowOpen(true),
    closeBorrow: () => setBorrowOpen(false),
  };

  if (booting) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}><span className="rail-logo" style={{ padding: 0, fontSize: 28 }}>{BRAND}</span></div>;
  }

  const Screen = ROUTES[route] || Home;
  const full = FULLBLEED.includes(route);
  const active = navKey(route);

  if (full) {
    return (<><Screen s={store} /><Toast toast={toast} /></>);
  }

  if (!authed) {
    return (
      <div>
        <header className="pubbar">
          <div className="pubbar-inner">
            <span className="rail-logo pointer ellip" style={{ padding: 0, fontSize: 'clamp(14px, 4vw, 24px)', flex: 1, minWidth: 0 }} onClick={() => { setRoute('landing'); setParam({}); }}>{BRAND}</span>
            <nav className="pub-nav">
              {PUB_NAV.map(([k, l]) => <span key={k} className={`pub-link ${active === k ? 'active' : ''}`} onClick={() => go(k)}>{t(l)}</span>)}
            </nav>
            <div className="row gap-10" style={{ flexShrink: 0 }}>
              <LangSwitch />
              <Btn className="hide-mobile" variant="ghost" size="sm" onClick={() => go('auth', { mode: 'login' })}>{t('shell.login')}</Btn>
              <Btn variant="primary" size="sm" onClick={() => go('auth', { mode: 'signup' })}>{t('shell.signupFree')}</Btn>
            </div>
          </div>
          <div className="pub-substrip">
            {PUB_NAV.map(([k, l]) => <button key={k} className={`chip ${active === k ? 'active' : ''}`} onClick={() => go(k)}>{t(l)}</button>)}
          </div>
        </header>
        {route !== 'landing' && <div style={{ height: 8 }} />}
        <main><div key={route + JSON.stringify(param)}><Screen s={store} /></div></main>
        {route !== 'landing' && (
          <div className="wrap" style={{ paddingBottom: 48 }}>
            <div className="panel card-pad-lg row between wrap wrap-w gap-16" style={{ background: 'linear-gradient(120deg, var(--green-soft), transparent)' }}>
              <div className="row gap-16">
                <Pundit size={64} mood="happy" glow />
                <div>
                  <div className="h3">{t('shell.promoTitle')}</div>
                  <p className="t2 small mt-4">{t('shell.promoDesc')}</p>
                </div>
              </div>
              <Btn variant="primary" size="lg" onClick={() => go('auth', { mode: 'signup' })}>{t('shell.promoCta')}</Btn>
            </div>
          </div>
        )}
        <Toast toast={toast} />
      </div>
    );
  }

  const title = TITLE_KEYS[route] ? t(TITLE_KEYS[route]) : '';

  return (
    <div className="with-rail">
      <aside className="rail">
        <div className="rail-logo pointer" onClick={() => go('home')}>{BRAND}</div>
        <div className="stack gap-2" style={{ overflowY: 'auto', flex: 1 }}>
          {RAIL.map((grp, gi) => (
            <div key={gi} style={{ marginTop: grp.sec ? 14 : 0 }}>
              {grp.sec && <div className="eyebrow" style={{ padding: '0 12px 6px' }}>{t(grp.sec)}</div>}
              {grp.items.map(([k, l, ic]) => (
                <button key={k} className={`nav-i ${active === k ? 'active' : ''}`} onClick={() => go(k)}><Icon name={ic} size={19} />{t(l)}</button>
              ))}
            </div>
          ))}
        </div>
        {['ADMIN', 'SUPER', 'MOD'].includes(role) && (
          <button className="nav-i" onClick={() => go('admin')} style={{ marginTop: 8 }}><Icon name="shield" size={19} />{t('nav.admin')}</button>
        )}
        <div className="card card-pad row gap-10" style={{ marginTop: 8 }}>
          <Avatar initials={me.avatar} size={34} color="var(--gold)" />
          <div style={{ minWidth: 0 }}><div className="small ellip" style={{ fontWeight: 700 }}>{me.name}</div><div className="tiny text-gold tnum">{points.toLocaleString()} pts</div></div>
        </div>
      </aside>

      <div className="topbar">
        <div className="row gap-12" style={{ minWidth: 0, flex: 1 }}>
          <span className="only-mobile rail-logo ellip" style={{ padding: 0, fontSize: 'clamp(15px, 4.5vw, 22px)' }} onClick={() => go('home')}>{BRAND}</span>
          <span className="h3 hide-mobile">{title}</span>
        </div>
        <div className="row gap-10" style={{ flexShrink: 0 }}>
          <LangSwitch />
          <button className="points-pill" onClick={() => go('wallet')}>
            <Icon name="wallet" size={16} style={{ color: 'var(--gold)' }} />
            <span className="tnum" style={{ fontWeight: 700, color: 'var(--gold)' }}>{points.toLocaleString()}</span>
          </button>
          <NotificationBell />
        </div>
      </div>

      <main className="main"><div key={route + JSON.stringify(param)}><Screen s={store} /></div></main>

      <nav className="tabs">
        {TABS.map(([k, l, ic]) => {
          const isMore = k === 'more';
          const act = isMore ? !PRIMARY_TABS.has(active) : active === k;
          return (
            <button key={k} className={`tab-i ${act ? 'active' : ''}`} onClick={() => (isMore ? setMoreOpen(true) : go(k))}><Icon name={ic} size={21} />{t(l)}</button>
          );
        })}
      </nav>
      {moreOpen && (
        <div className="overlay" style={{ zIndex: 100 }} onClick={() => setMoreOpen(false)}>
          <div className="modal scale-in" style={{ padding: 14 }} onClick={(e) => e.stopPropagation()}>
            {RAIL.slice(1).map((grp) => (
              <div key={grp.sec ?? ''} style={{ marginBottom: 8 }}>
                {grp.sec && <div className="eyebrow" style={{ padding: '6px 8px' }}>{t(grp.sec)}</div>}
                {grp.items.map(([rk, rl, ic]) => (
                  <button key={rk} className={`nav-i ${active === rk ? 'active' : ''}`} style={{ width: '100%' }} onClick={() => { setMoreOpen(false); go(rk); }}><Icon name={ic} size={18} />{t(rl)}</button>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <BorrowModal s={store} />
      <Toast toast={toast} />
    </div>
  );
}
