'use client';
/* ============================================================
   GOLAZO — App shell · client router · global store (ported from app.jsx)
   ============================================================ */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { WC, type Match, type Bet, type Pick1X2 } from '@/lib/wc';
import type { Store, BetSlipState, LedgerEntry, MeProfile } from '@/lib/store';
import { Btn, Icon, Avatar, Pundit, Toast, type ToastData } from '@/components/ui';
import { Landing, Auth, Home } from '@/components/screens-core';
import { Schedule, MatchDetail, BetSlip } from '@/components/screens-match';
import { Leaderboard, MyBets, Wallet, Profile } from '@/components/screens-compete';
import { Teams, TeamDetail, Groups, Bracket } from '@/components/screens-tournament';
import { Lobbies, LobbyCreate, LobbyView, BorrowModal } from '@/components/screens-lobby';
import { News, Article } from '@/components/screens-news';
import { Admin } from '@/components/screens-admin';

const ROUTES: Record<string, React.ComponentType<{ s: Store }>> = {
  landing: Landing, auth: Auth, home: Home, schedule: Schedule, match: MatchDetail,
  leaderboard: Leaderboard, mybets: MyBets, wallet: Wallet, profile: Profile,
  teams: Teams, team: TeamDetail, groups: Groups, bracket: Bracket,
  lobbies: Lobbies, 'lobby-create': LobbyCreate, lobby: LobbyView,
  news: News, article: Article, admin: Admin,
};
const FULLBLEED = ['auth', 'admin'];
const GATED = ['home', 'mybets', 'wallet', 'profile', 'lobbies', 'lobby', 'lobby-create', 'admin'];
const PUB_NAV: [string, string][] = [['schedule', 'Matches'], ['leaderboard', 'Leaderboard'], ['teams', 'Teams'], ['groups', 'Groups'], ['bracket', 'Bracket'], ['news', 'News']];
const RAIL: { sec: string | null; items: [string, string, string][] }[] = [
  { sec: null, items: [['home', 'Home', 'home'], ['schedule', 'Matches', 'calendar'], ['leaderboard', 'Leaderboard', 'trophy'], ['lobbies', 'Lobbies', 'users']] },
  { sec: 'Tournament', items: [['teams', 'Teams', 'flag'], ['groups', 'Groups', 'grid'], ['bracket', 'Bracket', 'bracket'], ['news', 'News', 'news']] },
  { sec: 'Account', items: [['mybets', 'My bets', 'target'], ['wallet', 'Wallet', 'wallet'], ['profile', 'Profile', 'user']] },
];
const TABS: [string, string, string][] = [['home', 'Home', 'home'], ['schedule', 'Matches', 'calendar'], ['leaderboard', 'Board', 'trophy'], ['lobbies', 'Lobbies', 'users'], ['profile', 'You', 'user']];

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

export default function AppShell() {
  const [route, setRoute] = useState('landing');
  const [param, setParam] = useState<Record<string, unknown>>({});
  const [, setStack] = useState<{ route: string; param: Record<string, unknown> }[]>([]);
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
  const [betSlip, setBetSlip] = useState<BetSlipState | null>(null);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [toast, setToast] = useState<ToastData | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { window.scrollTo(0, 0); }, [route, param]);

  const toastMsg = useCallback((msg: string, icon?: string, color?: string) => {
    setToast({ msg, icon, color });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const go = useCallback((r: string, p: Record<string, unknown> = {}) => {
    if (!authedRef.current && GATED.includes(r)) {
      setStack((st) => [...st, { route, param }]);
      setRoute('auth'); setParam({ mode: 'signup' });
      return;
    }
    setStack((st) => [...st, { route, param }]);
    setRoute(r); setParam(p);
  }, [route, param]);

  const back = useCallback(() => {
    setStack((st) => {
      if (!st.length) { setRoute('home'); setParam({}); return st; }
      const prev = st[st.length - 1];
      setRoute(prev.route); setParam(prev.param);
      return st.slice(0, -1);
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const [meR, betsR, ledR] = await Promise.all([
        fetch('/api/v1/me'), fetch('/api/v1/me/predictions'), fetch('/api/v1/me/ledger'),
      ]);
      if (meR.ok) {
        const j = await meR.json(); const d = j.data;
        setPoints(Number(d.balance)); setRole(d.role ?? 'USER'); setWinStreak(d.winStreak ?? 0); setTier(d.tier ?? WC.me.tier);
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

  const store: Store = {
    route, param, me, points, role, tier, bets, ledger, streak, winStreak, checkedIn, betSlip, borrowOpen, toast, authed,
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
            code === 'EMAIL_TAKEN' ? 'Email already registered — log in instead'
              : code === 'INVALID_CREDENTIALS' ? 'Wrong email or password'
                : 'Authentication failed',
            'alert', 'var(--danger)',
          );
          return;
        }
        authedRef.current = true; setAuthed(true); setStack([]); setRoute('home'); setParam({}); void refreshUser();
        toastMsg(endpoint === 'register' ? 'Welcome! +1,000 points added 🎉' : 'Welcome back!', 'star', 'var(--gold)');
      } catch {
        toastMsg('Network error — try again', 'alert', 'var(--danger)');
      }
    },
    logout: () => {
      void fetch('/api/v1/auth/logout', { method: 'POST' });
      authedRef.current = false; setAuthed(false);
      setRole('USER'); setMe(ME_DEFAULT); setPoints(0); setBets([]); setLedger([]); setStreak(0); setWinStreak(0); setTier(WC.me.tier); setCheckedIn(false);
      setStack([]); setRoute('landing'); setParam({});
    },
    checkin: async () => {
      if (checkedIn) return;
      try {
        const res = await fetch('/api/v1/checkin', { method: 'POST' });
        const j = await res.json().catch(() => ({}));
        if (res.ok) { setPoints(Number(j.data.balance)); setStreak((s) => s + 1); setCheckedIn(true); toastMsg(`Checked in! +${j.data.reward} points`, 'fire', 'var(--gold)'); }
        else { setCheckedIn(true); toastMsg(j?.error?.code === 'ALREADY_CHECKED_IN' ? 'Already checked in today' : 'Check-in failed', 'alert', 'var(--gold)'); }
      } catch { toastMsg('Network error', 'alert', 'var(--danger)'); }
    },
    claimMission: async (code: string) => {
      try {
        const res = await fetch(`/api/v1/me/missions/${code}/claim`, { method: 'POST' });
        const j = await res.json().catch(() => ({}));
        if (res.ok) {
          const { reward, balance } = j.data as { reward: number; balance: number };
          setPoints(balance);
          toastMsg(`Mission complete! +${reward} pts`, 'target', 'var(--purple)');
          void refreshUser();
        } else {
          const code_ = j?.error?.code;
          toastMsg(code_ === 'ALREADY_CLAIMED' ? 'Already claimed today' : code_ === 'NOT_COMPLETE' ? 'Mission not complete yet' : 'Claim failed', 'alert', 'var(--danger)');
        }
      } catch { toastMsg('Network error', 'alert', 'var(--danger)'); }
    },
    pickFor: (mid: number) => bets.find((x) => x.mid === mid && x.status === 'OPEN')?.pick,
    openBet: (match: Match, pick: Pick1X2, odds: number) => {
      if (!authedRef.current) { toastMsg('Sign up free to place a bet', 'lock', 'var(--gold)'); go('auth', { mode: 'signup' }); return; }
      setBetSlip({ match, pick, odds });
    },
    setSlipPick: (pick: Pick1X2, odds: number) => setBetSlip((b) => (b ? { ...b, pick, odds } : b)),
    closeBet: () => setBetSlip(null),
    confirmBet: async (stake: number, exact?: { home: number; away: number }, powerUp?: string) => {
      if (!betSlip) return;
      const { match, pick, odds } = betSlip;
      try {
        const res = await fetch('/api/v1/predictions', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ matchId: match.id, outcome: pick, stake, exactHome: exact?.home, exactAway: exact?.away, powerUp: powerUp || undefined }),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setBetSlip(null);
          toastMsg(j?.error?.code ? `Bet failed: ${j.error.code}` : 'Bet failed', 'alert', 'var(--danger)');
          return;
        }
      } catch {
        setBetSlip(null);
        toastMsg('Network error — bet not placed', 'alert', 'var(--danger)');
        return;
      }
      setPoints((p) => p - stake);
      setBets((bs) => {
        const ex = bs.findIndex((b) => b.mid === match.id && b.status === 'OPEN');
        const nb: Bet = { mid: match.id, pick, stake, odds, status: 'OPEN' };
        if (ex >= 0) { const cp = bs.slice(); cp[ex] = nb; return cp; }
        return [...bs, nb];
      });
      setBetSlip(null);
      toastMsg(`Bet placed · ${stake} pts on ${pick}`, 'check', 'var(--green)');
      void refreshUser(); // sync balance + bets + ledger from the DB
    },
    openBorrow: () => setBorrowOpen(true),
    closeBorrow: () => setBorrowOpen(false),
  };

  const Screen = ROUTES[route] || Home;
  const full = FULLBLEED.includes(route);
  const active = navKey(route);

  if (full) {
    return (<><Screen s={store} /><BetSlip s={store} /><Toast toast={toast} /></>);
  }

  if (!authed) {
    return (
      <div>
        <header className="pubbar">
          <div className="pubbar-inner">
            <span className="rail-logo pointer" style={{ padding: 0, fontSize: 24 }} onClick={() => { setStack([]); setRoute('landing'); }}>GOLAZO</span>
            <nav className="pub-nav">
              {PUB_NAV.map(([k, l]) => <span key={k} className={`pub-link ${active === k ? 'active' : ''}`} onClick={() => go(k)}>{l}</span>)}
            </nav>
            <div className="row gap-10">
              <Btn variant="ghost" size="sm" onClick={() => go('auth', { mode: 'login' })}>Log in</Btn>
              <Btn variant="primary" size="sm" onClick={() => go('auth', { mode: 'signup' })}>Sign up free</Btn>
            </div>
          </div>
          <div className="pub-substrip">
            {PUB_NAV.map(([k, l]) => <button key={k} className={`chip ${active === k ? 'active' : ''}`} onClick={() => go(k)}>{l}</button>)}
          </div>
        </header>
        {route !== 'landing' && <div style={{ height: 8 }} />}
        <main><div key={route + JSON.stringify(param)}><Screen s={store} /></div></main>
        {route !== 'landing' && (
          <div className="wrap" style={{ paddingBottom: 48 }}>
            <div className="panel card-pad-lg row between wrap gap-16" style={{ background: 'linear-gradient(120deg, var(--green-soft), transparent)' }}>
              <div className="row gap-16">
                <Pundit size={64} mood="happy" glow />
                <div>
                  <div className="h3">Like what you see?</div>
                  <p className="t2 small mt-4">Create a free account to claim 1,000 points, place bets and climb the leaderboard.</p>
                </div>
              </div>
              <Btn variant="primary" size="lg" onClick={() => go('auth', { mode: 'signup' })}>Claim 1,000 points →</Btn>
            </div>
          </div>
        )}
        <BetSlip s={store} />
        <Toast toast={toast} />
      </div>
    );
  }

  const title = ({ home: 'Home', schedule: 'Matches', match: 'Match', leaderboard: 'Leaderboard', mybets: 'My bets', wallet: 'Wallet', profile: 'Profile', teams: 'Teams', team: 'Team', groups: 'Groups', bracket: 'Bracket', lobbies: 'Lobbies', lobby: 'Lobby', 'lobby-create': 'New lobby', news: 'News', article: 'Article' } as Record<string, string>)[route] || '';

  return (
    <div className="with-rail">
      <aside className="rail">
        <div className="rail-logo pointer" onClick={() => go('home')}>GOLAZO</div>
        <div className="stack gap-2" style={{ overflowY: 'auto', flex: 1 }}>
          {RAIL.map((grp, gi) => (
            <div key={gi} style={{ marginTop: grp.sec ? 14 : 0 }}>
              {grp.sec && <div className="eyebrow" style={{ padding: '0 12px 6px' }}>{grp.sec}</div>}
              {grp.items.map(([k, l, ic]) => (
                <button key={k} className={`nav-i ${active === k ? 'active' : ''}`} onClick={() => go(k)}><Icon name={ic} size={19} />{l}</button>
              ))}
            </div>
          ))}
        </div>
        {['ADMIN', 'SUPER', 'MOD'].includes(role) && (
          <button className="nav-i" onClick={() => go('admin')} style={{ marginTop: 8 }}><Icon name="shield" size={19} />Admin</button>
        )}
        <div className="card card-pad row gap-10" style={{ marginTop: 8 }}>
          <Avatar initials={me.avatar} size={34} color="var(--gold)" />
          <div style={{ minWidth: 0 }}><div className="small ellip" style={{ fontWeight: 700 }}>{me.name}</div><div className="tiny text-gold tnum">{points.toLocaleString()} pts</div></div>
        </div>
      </aside>

      <div className="topbar">
        <div className="row gap-12">
          <span className="only-mobile rail-logo" style={{ padding: 0, fontSize: 22 }} onClick={() => go('home')}>GOLAZO</span>
          <span className="h3 hide-mobile">{title}</span>
        </div>
        <div className="row gap-10">
          <button className="points-pill" onClick={() => go('wallet')}>
            <Icon name="wallet" size={16} style={{ color: 'var(--gold)' }} />
            <span className="tnum" style={{ fontWeight: 700, color: 'var(--gold)' }}>{points.toLocaleString()}</span>
          </button>
          <button className="btn-icon btn-ghost rel" onClick={() => toastMsg('No new notifications', 'bell')}>
            <Icon name="bell" size={18} />
            <span className="abs" style={{ top: 8, right: 8, width: 7, height: 7, borderRadius: '50%', background: 'var(--magenta)' }} />
          </button>
        </div>
      </div>

      <main className="main"><div key={route + JSON.stringify(param)}><Screen s={store} /></div></main>

      <nav className="tabs">
        {TABS.map(([k, l, ic]) => (
          <button key={k} className={`tab-i ${active === k ? 'active' : ''}`} onClick={() => go(k)}><Icon name={ic} size={21} />{l}</button>
        ))}
      </nav>

      <BetSlip s={store} />
      <BorrowModal s={store} />
      <Toast toast={toast} />
    </div>
  );
}
