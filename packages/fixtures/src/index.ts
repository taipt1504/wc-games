/* ============================================================
   @wc/fixtures — WC 2026 tournament data (typed, DETERMINISTIC).
   Single source shared by the web UI (display) and the DB seed (ingest),
   so match/team ids and odds align exactly. Seeded RNG -> identical output.
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

function rng(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

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

export function fmtDate(d: Date): string {
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' });
}
export function matchById(id: number): Match | undefined {
  return matches.find((m) => m.id === id);
}
