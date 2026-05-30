/* ============================================================
   GOLAZO — App shell · router · global store
   ============================================================ */
const { useState, useEffect, useCallback } = React;

const ROUTES = {
  landing: Landing, auth: Auth, home: Home, schedule: Schedule, match: MatchDetail,
  leaderboard: Leaderboard, mybets: MyBets, wallet: Wallet, profile: Profile,
  teams: Teams, team: TeamDetail, groups: Groups, bracket: Bracket,
  lobbies: Lobbies, 'lobby-create': LobbyCreate, lobby: LobbyView,
  news: News, article: Article, admin: Admin,
};
const FULLBLEED = ['auth', 'admin'];
// Routes a guest may browse without an account
const PUBLIC = ['schedule', 'match', 'teams', 'team', 'groups', 'bracket', 'news', 'article', 'leaderboard'];
// Routes that require sign-in
const GATED = ['home', 'mybets', 'wallet', 'profile', 'lobbies', 'lobby', 'lobby-create', 'admin'];
const PUB_NAV = [['schedule', 'Matches'], ['leaderboard', 'Leaderboard'], ['teams', 'Teams'], ['groups', 'Groups'], ['bracket', 'Bracket'], ['news', 'News']];

const RAIL = [
  { sec: null, items: [['home', 'Home', 'home'], ['schedule', 'Matches', 'calendar'], ['leaderboard', 'Leaderboard', 'trophy'], ['lobbies', 'Lobbies', 'users']] },
  { sec: 'Tournament', items: [['teams', 'Teams', 'flag'], ['groups', 'Groups', 'grid'], ['bracket', 'Bracket', 'bracket'], ['news', 'News', 'news']] },
  { sec: 'Account', items: [['mybets', 'My bets', 'target'], ['wallet', 'Wallet', 'wallet'], ['profile', 'Profile', 'user']] },
];
const TABS = [['home', 'Home', 'home'], ['schedule', 'Matches', 'calendar'], ['leaderboard', 'Board', 'trophy'], ['lobbies', 'Lobbies', 'users'], ['profile', 'You', 'user']];

// route → active nav key
function navKey(r) {
  if (['schedule', 'match'].includes(r)) return 'schedule';
  if (['teams', 'team', 'groups', 'bracket'].includes(r)) return r === 'team' ? 'teams' : r;
  if (['lobbies', 'lobby', 'lobby-create'].includes(r)) return 'lobbies';
  if (['news', 'article'].includes(r)) return 'news';
  return r;
}

function App() {
  const [route, setRoute] = useState('landing');
  const [param, setParam] = useState({});
  const [stack, setStack] = useState([]);
  const [authed, setAuthed] = useState(false);
  const authedRef = React.useRef(false);
  const [points, setPoints] = useState(WC.me.points);
  const [bets, setBets] = useState(WC.myBets.map(b => ({ ...b })));
  const [streak, setStreak] = useState(WC.me.streak);
  const [checkedIn, setCheckedIn] = useState(false);
  const [betSlip, setBetSlip] = useState(null);
  const [borrowOpen, setBorrowOpen] = useState(false);
  const [toast, setToast] = useState(null);
  const toastTimer = React.useRef(null);

  useEffect(() => { window.scrollTo(0, 0); const m = document.querySelector('.main'); if (m) m.scrollTop = 0; }, [route, param]);

  const toastMsg = useCallback((msg, icon, color) => {
    setToast({ msg, icon, color });
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2400);
  }, []);

  const go = useCallback((r, p = {}) => {
    // gate: guests trying to reach an account-only route get the signup wall
    if (!authedRef.current && GATED.includes(r)) {
      setStack(st => [...st, { route, param }]);
      setRoute('auth'); setParam({ mode: 'signup' });
      return;
    }
    setStack(st => [...st, { route, param }]);
    setRoute(r); setParam(p);
  }, [route, param]);

  const back = useCallback(() => {
    setStack(st => {
      if (!st.length) { setRoute('home'); setParam({}); return st; }
      const prev = st[st.length - 1];
      setRoute(prev.route); setParam(prev.param);
      return st.slice(0, -1);
    });
  }, []);

  const store = {
    route, param, points, bets, streak, checkedIn, betSlip, borrowOpen, toast, authed,
    go, back, toastMsg,
    login: () => { authedRef.current = true; setAuthed(true); setStack([]); setRoute('home'); setParam({}); toastMsg('Welcome! +1,000 points added 🎉', 'star', 'var(--gold)'); },
    logout: () => { authedRef.current = false; setAuthed(false); setStack([]); setRoute('landing'); setParam({}); },
    checkin: () => { if (checkedIn) return; setPoints(p => p + 300); setStreak(s => s + 1); setCheckedIn(true); toastMsg('Checked in! +300 points', 'fire', 'var(--gold)'); },
    claimMission: (id) => { const m = WC.missions.find(x => x.id === id); if (!m || m.claimed) return; m.claimed = true; setPoints(p => p + m.reward); toastMsg(`Mission complete! +${m.reward}`, 'target', 'var(--purple)'); },
    pickFor: (mid) => { const b = bets.find(x => x.mid === mid && (x.status === 'OPEN')); return b?.pick; },
    openBet: (match, pick, odds) => {
      if (!authedRef.current) { toastMsg('Sign up free to place a bet', 'lock', 'var(--gold)'); go('auth', { mode: 'signup' }); return; }
      setBetSlip({ match, pick, odds });
    },
    setSlipPick: (pick, odds) => setBetSlip(b => ({ ...b, pick, odds })),
    closeBet: () => setBetSlip(null),
    confirmBet: (stake) => {
      const { match, pick, odds } = betSlip;
      setPoints(p => p - stake);
      setBets(bs => {
        const ex = bs.findIndex(b => b.mid === match.id && b.status === 'OPEN');
        const nb = { mid: match.id, pick, stake, odds, status: 'OPEN' };
        if (ex >= 0) { const cp = bs.slice(); cp[ex] = nb; return cp; }
        return [...bs, nb];
      });
      setBetSlip(null);
      toastMsg(`Bet placed · ${stake} pts on ${pick}`, 'check', 'var(--green)');
    },
    openBorrow: () => setBorrowOpen(true),
    closeBorrow: () => setBorrowOpen(false),
  };

  const Screen = ROUTES[route] || Home;
  const full = FULLBLEED.includes(route);
  const active = navKey(route);

  if (full) {
    return (
      <>
        <Screen s={store} />
        <BetSlip s={store} />
        <Toast toast={toast} />
      </>
    );
  }

  // ---- GUEST (public) shell: browse tournament & news without an account ----
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

        {route !== 'landing' && <div style={{ height: 8 }}></div>}

        <main>
          <div key={route + JSON.stringify(param)}><Screen s={store} /></div>
        </main>

        {/* guest conversion banner */}
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

  const title = { home: 'Home', schedule: 'Matches', match: 'Match', leaderboard: 'Leaderboard', mybets: 'My bets', wallet: 'Wallet', profile: 'Profile', teams: 'Teams', team: 'Team', groups: 'Groups', bracket: 'Bracket', lobbies: 'Lobbies', lobby: 'Lobby', 'lobby-create': 'New lobby', news: 'News', article: 'Article' }[route] || '';

  return (
    <div className="with-rail">
      {/* desktop rail */}
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
        <button className="nav-i" onClick={() => go('admin')} style={{ marginTop: 8 }}><Icon name="shield" size={19} />Admin</button>
        <div className="card card-pad row gap-10" style={{ marginTop: 8 }}>
          <Avatar initials="AR" size={34} color="var(--gold)" />
          <div style={{ minWidth: 0 }}><div className="small ellip" style={{ fontWeight: 700 }}>{WC.me.name}</div><div className="tiny text-gold tnum">{points.toLocaleString()} pts</div></div>
        </div>
      </aside>

      {/* topbar */}
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

      <main className="main">
        <div key={route + JSON.stringify(param)}><Screen s={store} /></div>
      </main>

      {/* mobile tabs */}
      <nav className="tabs">
        {TABS.map(([k, l, ic]) => (
          <button key={k} className={`tab-i ${active === k ? 'active' : ''}`} onClick={() => go(k)}>
            <Icon name={ic} size={21} />{l}
          </button>
        ))}
      </nav>

      <BetSlip s={store} />
      <BorrowModal s={store} />
      <Toast toast={toast} />
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
