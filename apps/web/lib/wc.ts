/* ============================================================
   GOLAZO — WC 2026 data layer (typed, DETERMINISTIC mock)
   Ported from docs/design/.../data.js. Random removed → seeded,
   so SSR (server) and client produce identical markup (no hydration mismatch).
   TODO: replace with real API (pipeline/DB per PRD §15).
   ============================================================ */

export type Pick1X2 = '1' | 'X' | '2';
export type MatchStatus = 'SCHEDULED' | 'LIVE' | 'FINISHED';

export interface Team {
  id: number;
  name: string;
  code: string;
  conf: string;
  rank: number;
  colors: [string, string, string];
  group: string;
  w: number; d: number; l: number; gf: number; ga: number;
  pts?: number; gd?: number;
}
export interface Odds { mh: number; md: number; ma: number }
export interface Match {
  id: number; stage: string; round: string; group: string;
  home: number; away: number; venue: string;
  date: Date; kickoff: string; status: MatchStatus;
  hs: number | null; as: number | null; odds: Odds; minute: number | null;
}
export interface Bet { mid: number; pick: Pick1X2; stake: number; odds: number; status: string; payout?: number }

/** Deterministic pseudo-random in [0,1) seeded by n. */
function rng(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// [name, code, confederation, fifaRank, [colors]]
const T: [string, string, string, number, [string, string, string]][] = [
  ['Mexico', 'MEX', 'CONCACAF', 14, ['#006847', '#ffffff', '#ce1126']],
  ['Croatia', 'CRO', 'UEFA', 10, ['#ff0000', '#ffffff', '#171796']],
  ['Ecuador', 'ECU', 'CONMEBOL', 23, ['#ffdd00', '#0033a0', '#ed1c24']],
  ['Cameroon', 'CMR', 'CAF', 42, ['#007a5e', '#ce1126', '#fcd116']],
  ['Canada', 'CAN', 'CONCACAF', 43, ['#ff0000', '#ffffff', '#ff0000']],
  ['Belgium', 'BEL', 'UEFA', 6, ['#111111', '#ffd100', '#ef3340']],
  ['Japan', 'JPN', 'AFC', 18, ['#0b1f6b', '#ffffff', '#bc002d']],
  ['Morocco', 'MAR', 'CAF', 13, ['#c1272d', '#006233', '#c1272d']],
  ['USA', 'USA', 'CONCACAF', 16, ['#0a3161', '#ffffff', '#b31942']],
  ['Netherlands', 'NED', 'UEFA', 7, ['#ae1c28', '#ffffff', '#21468b']],
  ['Senegal', 'SEN', 'CAF', 19, ['#00853f', '#fdef42', '#e31b23']],
  ['Saudi Arabia', 'KSA', 'AFC', 56, ['#006c35', '#ffffff', '#006c35']],
  ['Argentina', 'ARG', 'CONMEBOL', 1, ['#75aadb', '#ffffff', '#75aadb']],
  ['Denmark', 'DEN', 'UEFA', 21, ['#c60c30', '#ffffff', '#c60c30']],
  ['Australia', 'AUS', 'AFC', 24, ['#00843d', '#ffcd00', '#00843d']],
  ['Tunisia', 'TUN', 'CAF', 41, ['#e70013', '#ffffff', '#e70013']],
  ['France', 'FRA', 'UEFA', 2, ['#0055a4', '#ffffff', '#ef4135']],
  ['Switzerland', 'SUI', 'UEFA', 20, ['#d52b1e', '#ffffff', '#d52b1e']],
  ['South Korea', 'KOR', 'AFC', 22, ['#ffffff', '#cd2e3a', '#0047a0']],
  ['Ghana', 'GHA', 'CAF', 68, ['#ce1126', '#fcd116', '#006b3f']],
  ['Brazil', 'BRA', 'CONMEBOL', 5, ['#fedf00', '#009c3b', '#002776']],
  ['Portugal', 'POR', 'UEFA', 8, ['#006600', '#ff0000', '#ffe900']],
  ['Uruguay', 'URU', 'CONMEBOL', 15, ['#7bb3e0', '#ffffff', '#001489']],
  ['Nigeria', 'NGA', 'CAF', 44, ['#008751', '#ffffff', '#008751']],
  ['England', 'ENG', 'UEFA', 4, ['#ffffff', '#cf081f', '#ffffff']],
  ['Italy', 'ITA', 'UEFA', 9, ['#0072bb', '#ffffff', '#009246']],
  ['Iran', 'IRN', 'AFC', 20, ['#239f40', '#ffffff', '#da0000']],
  ['Egypt', 'EGY', 'CAF', 36, ['#ce1126', '#ffffff', '#000000']],
  ['Spain', 'ESP', 'UEFA', 3, ['#aa151b', '#f1bf00', '#aa151b']],
  ['Germany', 'GER', 'UEFA', 12, ['#000000', '#dd0000', '#ffce00']],
  ['Colombia', 'COL', 'CONMEBOL', 17, ['#fcd116', '#003893', '#ce1126']],
  ['Qatar', 'QAT', 'AFC', 37, ['#8a1538', '#ffffff', '#8a1538']],
  ['Scotland', 'SCO', 'UEFA', 39, ['#0065bf', '#ffffff', '#0065bf']],
  ['Austria', 'AUT', 'UEFA', 25, ['#ed2939', '#ffffff', '#ed2939']],
  ['Ivory Coast', 'CIV', 'CAF', 40, ['#f77f00', '#ffffff', '#009e60']],
  ['Jordan', 'JOR', 'AFC', 62, ['#007a3d', '#ffffff', '#ce1126']],
  ['Norway', 'NOR', 'UEFA', 38, ['#ba0c2f', '#ffffff', '#00205b']],
  ['Turkey', 'TUR', 'UEFA', 26, ['#e30a17', '#ffffff', '#e30a17']],
  ['Algeria', 'ALG', 'CAF', 43, ['#006633', '#ffffff', '#d21034']],
  ['New Zealand', 'NZL', 'OFC', 86, ['#00247d', '#ffffff', '#cc142b']],
  ['Peru', 'PER', 'CONMEBOL', 32, ['#d91023', '#ffffff', '#d91023']],
  ['Serbia', 'SRB', 'UEFA', 31, ['#c6363c', '#0c4076', '#ffffff']],
  ['Uzbekistan', 'UZB', 'AFC', 57, ['#1eb53a', '#ffffff', '#0099b5']],
  ['Costa Rica', 'CRC', 'CONCACAF', 54, ['#002b7f', '#ffffff', '#ce1126']],
  ['Poland', 'POL', 'UEFA', 28, ['#ffffff', '#dc143c', '#ffffff']],
  ['Paraguay', 'PAR', 'CONMEBOL', 49, ['#d52b1e', '#ffffff', '#0038a8']],
  ['Panama', 'PAN', 'CONCACAF', 39, ['#005293', '#ffffff', '#d21034']],
  ['Jamaica', 'JAM', 'CONCACAF', 55, ['#009b3a', '#fed100', '#000000']],
];

export const GROUPS = 'ABCDEFGHIJKL'.split('');

export const teams: Team[] = T.map((t, i) => ({
  id: i, name: t[0], code: t[1], conf: t[2], rank: t[3], colors: t[4],
  group: GROUPS[Math.floor(i / 4)],
  w: 0, d: 0, l: 0, gf: 0, ga: 0,
}));

export const byId = (id: number): Team => teams[id];
export const byGroup = (g: string): Team[] => teams.filter((t) => t.group === g);

export const venues = [
  'MetLife Stadium · NJ', 'SoFi Stadium · LA', 'AT&T Stadium · Dallas', 'Mercedes-Benz · Atlanta',
  'Hard Rock · Miami', 'Lincoln Financial · Philly', 'Lumen Field · Seattle', 'Levi’s · SF Bay',
  'NRG Stadium · Houston', 'Arrowhead · KC', 'BMO Field · Toronto', 'BC Place · Vancouver',
  'Estadio Azteca · CDMX', 'Estadio Akron · Guadalajara', 'Estadio BBVA · Monterrey', 'Gillette · Boston',
];

function mkOdds(home: Team, away: Team, seed: number): Odds {
  const gap = (away.rank - home.rank) / 40;
  const r = (x: number) => Math.round(x * 100) / 100;
  const mh = Math.max(0.35, 1.15 - gap * 0.9 + (rng(seed) * 0.2 - 0.1));
  const ma = Math.max(0.45, 1.25 + gap * 1.1 + (rng(seed + 1) * 0.25 - 0.12));
  const md = 0.85 + rng(seed + 2) * 0.5;
  return { mh: r(mh), md: r(md), ma: r(ma) };
}

const RR = [[0, 1], [2, 3], [0, 2], [3, 1], [3, 0], [1, 2]];
export const matches: Match[] = [];
{
  let mid = 1;
  const baseDay = new Date('2026-06-11T00:00:00Z');
  const stadiumKick = ['16:00', '19:00', '22:00', '13:00'];
  GROUPS.forEach((g, gi) => {
    const gt = byGroup(g);
    RR.forEach((pair, mi) => {
      const home = gt[pair[0]];
      const away = gt[pair[1]];
      const dayOffset = (gi % 3) + Math.floor(mi / 2) * 3;
      const d = new Date(baseDay);
      d.setUTCDate(d.getUTCDate() + dayOffset);
      const kick = stadiumKick[(gi + mi) % 4];
      const seed = mid * 7;
      const o = mkOdds(home, away, seed);
      let status: MatchStatus = 'SCHEDULED';
      let hs: number | null = null;
      let as: number | null = null;
      if (mid <= 22) { status = 'FINISHED'; hs = Math.floor(rng(seed + 3) * 4); as = Math.floor(rng(seed + 4) * 4); }
      else if (mid === 23 || mid === 24) { status = 'LIVE'; hs = Math.floor(rng(seed + 3) * 3); as = Math.floor(rng(seed + 4) * 3); }
      matches.push({
        id: mid, stage: 'Group ' + g, round: 'group', group: g,
        home: home.id, away: away.id, venue: venues[(gi + mi) % venues.length],
        date: d, kickoff: kick, status, hs, as, odds: o,
        minute: status === 'LIVE' ? 30 + Math.floor(rng(seed + 5) * 40) : null,
      });
      mid++;
    });
  });
}

// standings from finished matches
matches.forEach((m) => {
  if (m.status !== 'FINISHED') return;
  const h = byId(m.home), a = byId(m.away);
  h.gf += m.hs!; h.ga += m.as!; a.gf += m.as!; a.ga += m.hs!;
  if (m.hs! > m.as!) { h.w++; a.l++; }
  else if (m.hs! < m.as!) { a.w++; h.l++; }
  else { h.d++; a.d++; }
});
teams.forEach((t) => { t.pts = t.w * 3 + t.d; t.gd = t.gf - t.ga; });

export const upcoming = matches.filter((m) => m.status === 'SCHEDULED');
export const live = matches.filter((m) => m.status === 'LIVE');
export const finished = matches.filter((m) => m.status === 'FINISHED');

export const me = {
  name: 'Alex Rivera', handle: '@alexr', avatar: 'AR', country: 'USA',
  points: 2840, rank: 1287, roi: 18.4, won: 9, lost: 5, settled: 14,
  streak: 6, winStreak: 3, tier: 'Gold', joined: 'May 2026',
};

export const myBets: Bet[] = [
  { mid: 23, pick: '1', stake: 200, odds: 0.92, status: 'LIVE' },
  { mid: 27, pick: '2', stake: 150, odds: 1.85, status: 'OPEN' },
  { mid: 31, pick: 'X', stake: 100, odds: 1.10, status: 'OPEN' },
  { mid: 3, pick: '1', stake: 200, odds: 0.80, payout: 360, status: 'WON' },
  { mid: 5, pick: '2', stake: 150, odds: 1.50, payout: 0, status: 'LOST' },
  { mid: 8, pick: '1', stake: 100, odds: 1.30, payout: 230, status: 'WON' },
  { mid: 11, pick: 'X', stake: 120, odds: 1.05, payout: 0, status: 'LOST' },
  { mid: 14, pick: '2', stake: 250, odds: 2.10, payout: 775, status: 'WON' },
];

export const ledger = [
  { type: 'SIGNUP', label: 'Welcome bonus', delta: 1000, when: 'May 24, 09:12', bal: 1000 },
  { type: 'CHECKIN', label: 'Daily check-in · day 1', delta: 200, when: 'May 24, 09:13', bal: 1200 },
  { type: 'BET', label: 'Stake · ARG vs DEN', delta: -200, when: 'May 25, 18:40', bal: 1000 },
  { type: 'SETTLE', label: 'Won · ARG vs DEN', delta: 360, when: 'May 25, 21:05', bal: 1360 },
  { type: 'CHECKIN', label: 'Daily check-in · day 2', delta: 250, when: 'May 26, 08:30', bal: 1610 },
  { type: 'BET', label: 'Stake · GER vs COL', delta: -150, when: 'May 26, 17:20', bal: 1460 },
  { type: 'SETTLE', label: 'Lost · GER vs COL', delta: 0, when: 'May 26, 20:10', bal: 1460 },
  { type: 'REFERRAL', label: 'Referral · @samk joined', delta: 300, when: 'May 27, 11:02', bal: 1760 },
  { type: 'BET', label: 'Stake · ESP vs GER', delta: -250, when: 'May 28, 16:00', bal: 1510 },
  { type: 'SETTLE', label: 'Won · ESP vs GER', delta: 775, when: 'May 28, 19:30', bal: 2285 },
  { type: 'CHECKIN', label: 'Daily check-in · day 6 🔥', delta: 300, when: 'May 30, 08:15', bal: 2585 },
  { type: 'MISSION', label: 'Mission · Place 3 bets', delta: 100, when: 'May 30, 12:40', bal: 2685 },
  { type: 'BET', label: 'Stake · live bets', delta: -350, when: 'May 30, 15:00', bal: 2335 },
  { type: 'SETTLE', label: 'Won · FRA vs SUI', delta: 505, when: 'May 30, 18:00', bal: 2840 },
].reverse();

const lbNames = ['ProphetX', 'TikiTaka_99', 'GegenPress', 'CatenaccioKing', 'TotalFootball',
  'xG_Wizard', 'SetPieceSam', 'OffsideTrap', 'NutmegNina', 'PoacherPete', 'LowBlockLuca', 'TheGaffer'];
export const leaderboard = lbNames.map((n, i) => ({
  rank: i + 1, name: n, roi: +(64 - i * 4.2 + rng(i + 100) * 2).toFixed(1),
  net: Math.round(12000 - i * 850 + rng(i + 200) * 400),
  settled: 38 - i, won: 30 - i,
  tier: i < 2 ? 'Legend' : i < 5 ? 'Diamond' : i < 9 ? 'Platinum' : 'Gold',
  flag: teams[(i * 4) % 48].colors,
}));

export const missions = [
  { id: 1, label: 'Place 3 bets today', reward: 100, done: 3, total: 3, claimed: true, icon: 'target' },
  { id: 2, label: 'Back an underdog (odds ≥ 2.0)', reward: 150, done: 0, total: 1, claimed: false, icon: 'trending' },
  { id: 3, label: 'Read one AI Pundit preview', reward: 50, done: 1, total: 1, claimed: false, icon: 'sparkles' },
  { id: 4, label: 'Invite a friend or share a result', reward: 200, done: 0, total: 1, claimed: false, icon: 'share' },
];

export const achievements = [
  { name: 'First Blood', desc: 'Win your first bet', unlocked: true, icon: 'trophy' },
  { name: 'Giant Killer', desc: 'Win a bet at odds ≥ 2.5', unlocked: true, icon: 'zap' },
  { name: 'Group Sweep', desc: 'Win all 3 bets in one group', unlocked: false, prog: '2/3', icon: 'grid' },
  { name: 'Hot Streak', desc: 'Win 5 bets in a row', unlocked: false, prog: '3/5', icon: 'flame' },
  { name: 'Bracket Master', desc: 'Reach 80 bracket points', unlocked: false, prog: '—', icon: 'bracket' },
  { name: 'Virtual Millionaire', desc: 'Reach 10,000 points', unlocked: false, prog: '2.8K', icon: 'coins' },
];

export interface Lobby {
  id: number; name: string; scope: string; members: number; you: number | null; def: number;
  owner: string; borrow: boolean; pwd: boolean; hot: boolean; joined: boolean; public: boolean;
  code: string; matchIds: number[];
}
export const lobbies: Lobby[] = [
  { id: 1, name: 'Office League · ABC Corp', scope: 'Group Stage', members: 14, you: 2, def: 1000, owner: 'Khoa Nguyen', borrow: true, pwd: true, hot: true, joined: true, public: false, code: 'ABC123', matchIds: [23, 24, 27, 31, 33, 35, 37, 41] },
  { id: 2, name: 'The Lads 🍻', scope: 'Custom · 6 matches', members: 8, you: 1, def: 1500, owner: 'You', borrow: true, pwd: true, hot: false, joined: true, public: false, code: 'LADS26', matchIds: [27, 31, 33, 35, 41, 45] },
  { id: 3, name: 'Final Four Showdown', scope: 'Whole Tournament', members: 22, you: 5, def: 500, owner: 'Trang Le', borrow: false, pwd: false, hot: false, joined: true, public: true, code: 'FINAL4', matchIds: [23, 24, 25, 26, 27, 28, 31, 33, 35, 37, 41, 45] },
  { id: 4, name: 'Global Pundits Club', scope: 'Whole Tournament', members: 312, you: null, def: 1000, owner: 'GolazoHQ', borrow: false, pwd: false, hot: true, joined: false, public: true, code: 'PUNDITS', matchIds: [23, 24, 25, 26, 27, 28, 31, 33] },
  { id: 5, name: 'Group Stage Grinders', scope: 'Group Stage', members: 58, you: null, def: 800, owner: 'Maria S.', borrow: true, pwd: false, hot: false, joined: false, public: true, code: 'GRIND8', matchIds: [23, 24, 27, 31, 33, 35] },
  { id: 6, name: 'Underdog Hunters', scope: 'Custom · 5 matches', members: 41, you: null, def: 1200, owner: 'Diego R.', borrow: true, pwd: false, hot: false, joined: false, public: true, code: 'UNDERD', matchIds: [27, 31, 35, 41, 45] },
];
export function lobbyMatches(l: Lobby): Match[] {
  return (l.matchIds || []).map((id) => matches.find((m) => m.id === id)).filter(Boolean) as Match[];
}
export const lobbyBoard = [
  { rank: 1, name: 'Khoa Nguyen', score: 2240, won: 1240, def: 1000, borrowed: 0, you: false },
  { rank: 2, name: 'Trang Le', score: 1880, won: 880, def: 1000, borrowed: 0, you: false },
  { rank: 3, name: 'You', score: 1410, won: 610, def: 1000, borrowed: 200, you: true },
  { rank: 4, name: 'Sam Kim', score: 1150, won: 150, def: 1000, borrowed: 0, you: false },
  { rank: 5, name: 'Minh Pham', score: 980, won: 180, def: 1000, borrowed: 200, you: false },
  { rank: 6, name: 'Linh Tran', score: 760, won: -240, def: 1000, borrowed: 0, you: false },
  { rank: 7, name: 'David Cole', score: 200, won: -600, def: 1000, borrowed: 200, you: false },
];
export const lobbyChat = [
  { who: 'Khoa Nguyen', text: 'Whoever takes Mexico to win is brave 😅', t: '14:02' },
  { who: 'sys', text: '🔥 Trang just won an underdog bet +250', t: '14:05' },
  { who: 'Trang Le', text: 'Told you. Brazil all day.', t: '14:06' },
  { who: 'You', text: 'I need a comeback, down to 200 pts 💀', t: '14:10' },
  { who: 'sys', text: '⚡ You climbed to #3', t: '14:18' },
  { who: 'Sam Kim', text: 'Borrow request incoming Khoa, be nice', t: '14:20' },
];
export const borrowRequests = [
  { id: 1, who: 'Sam Kim', amount: 200, balance: 40, msg: 'Down bad after the Brazil bet 😭 need a lifeline', t: '2m ago', score: 1150 },
  { id: 2, who: 'Minh Pham', amount: 150, balance: 0, msg: 'Out of points, one more shot at the late game', t: '8m ago', score: 980 },
  { id: 3, who: 'David Cole', amount: 500, balance: 10, msg: 'Going all-in on the upset, trust me', t: '21m ago', score: 200, repeat: true },
];

export const news = [
  { id: 1, tag: 'Match Preview', title: 'Argentina look to seal top spot against Denmark', src: 'GoalWire', time: '2h ago', excerpt: 'Messi rested but Álvarez in red-hot form as the holders eye an early knockout berth.', hot: true, match: 14 },
  { id: 2, tag: 'Squad News', title: 'France confirm Mbappé fit to start Group E opener', src: 'KickReport', time: '4h ago', excerpt: 'A late fitness test cleared the captain after a minor knock in training Thursday.', match: 17 },
  { id: 3, tag: 'Analysis', title: 'Why the 48-team format is reshaping group-stage tactics', src: 'The Tactical', time: '6h ago', excerpt: 'Three-team math is gone — coaches now chase goal difference from minute one.' },
  { id: 4, tag: 'Transfer Buzz', title: 'Breakout star already linked with three European giants', src: 'MercatoDaily', time: '8h ago', excerpt: 'Scouts packed the stands as the 19-year-old ran the show in matchday one.' },
  { id: 5, tag: 'Result', title: 'Spain edge Germany in instant Group H classic', src: 'GoalWire', time: '12h ago', excerpt: 'A late winner settles a six-goal thriller that lit up the tournament.' },
  { id: 6, tag: 'Off-pitch', title: 'Three-nation host buzz: fans flock across the borders', src: 'FanZone', time: '1d ago', excerpt: 'Record cross-border travel as the first multi-host World Cup kicks into gear.' },
];

export const riskLobbies = [
  { id: 91, name: 'private_room_x', members: 2, risk: 'High', score: 87, reasons: ['One-way point flow', 'Shared IP (2/2 accounts)', 'Repeated max borrows'], flagged: '12m ago' },
  { id: 92, name: 'wknd crew', members: 3, risk: 'Medium', score: 61, reasons: ['Unusual borrow volume', 'Two accounts same device'], flagged: '1h ago' },
  { id: 93, name: 'Sunday Stakes', members: 6, risk: 'Low', score: 34, reasons: ['Borrow spike at kickoff'], flagged: '3h ago' },
];
export const adminUsers = [
  { name: 'm.tran', email: 'm.tran@mail.com', pts: 320, ip: '113.161.x.x', status: 'active', flags: 0, joined: 'May 12' },
  { name: 'ghost_07', email: 'ghost07@mail.com', pts: 5, ip: '113.161.x.x', status: 'flagged', flags: 3, joined: 'May 28' },
  { name: 'ghost_08', email: 'ghost08@mail.com', pts: 1410, ip: '113.161.x.x', status: 'flagged', flags: 3, joined: 'May 28' },
  { name: 'sara.l', email: 'sara.l@mail.com', pts: 2210, ip: '24.55.x.x', status: 'active', flags: 0, joined: 'May 9' },
  { name: 'banned_joe', email: 'joe@mail.com', pts: 0, ip: '88.12.x.x', status: 'banned', flags: 5, joined: 'May 2' },
];
export const reviewQueue = [
  { id: 1, title: 'Brazil cruise past Nigeria as Vinícius dazzles', tag: 'Result', src: 'GoalWire', conf: 96, status: 'PENDING' },
  { id: 2, title: 'Rumour: midfielder eyeing summer switch', tag: 'Transfer Buzz', src: 'MercatoDaily', conf: 71, status: 'PENDING', warn: true },
  { id: 3, title: 'England tactical preview vs Italy', tag: 'Analysis', src: 'The Tactical', conf: 88, status: 'PENDING' },
  { id: 4, title: 'Host cities report record attendance', tag: 'Off-pitch', src: 'FanZone', conf: 93, status: 'APPROVED' },
];
export const aiJobs = [
  { name: 'fixtures.ingest', provider: 'API-Football', status: 'ok', last: '2m', latency: '340ms' },
  { name: 'odds.sync', provider: 'The Odds API', status: 'ok', last: '5m', latency: '210ms' },
  { name: 'news.generate', provider: 'Claude · 9router', status: 'ok', last: '8m', latency: '4.2s' },
  { name: 'pundit.preview', provider: 'Claude · 9router', status: 'fallback', last: '1m', latency: '6.8s', note: 'Fell back to OpenAI (quota)' },
  { name: 'news.crawl', provider: 'crawler', status: 'error', last: '22m', latency: '—', note: 'Source 503 — retry queued' },
];

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function matchById(id: number): Match | undefined {
  return matches.find((m) => m.id === id);
}

export const WC = {
  teams, byId, byGroup, GROUPS, venues, matches, upcoming, live, finished,
  me, myBets, ledger, leaderboard, missions, achievements,
  lobbies, lobbyBoard, lobbyChat, borrowRequests, lobbyMatches, news,
  riskLobbies, adminUsers, reviewQueue, aiJobs, fmtDate, matchById,
};
