'use client';
/* GOLAZO — Lobbies · Create · Lobby view · Borrow modal (ported from design screens-lobby.jsx) */
import React, { useState, useEffect } from 'react';
import { WC, type Match, type Lobby, type Pick1X2, type Odds } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Avatar, SecHead } from '@/components/ui';

/* ---- Scope preset type ---- */
interface Scope {
  k: string;
  label: string;
  future?: boolean;
  pick?: () => number[];
}

/* ---- Borrow request type (repeat is optional) ---- */
interface Req {
  id: number;
  who: string;
  amount: number;
  balance: number;
  msg?: string;
  t: string;
  score: number;
  repeat?: boolean;
  state: string;
}

/* ===================== LOBBY CARD (helper) ===================== */
function LobbyCard({ l, s, joined }: { l: Lobby; s: ScreenProps['s']; joined?: boolean }) {
  return (
    <div className="card card-pad card-hover pointer" onClick={() => s.go('lobby', { id: l.id })}>
      <div className="row between">
        <span className="badge badge-sky">{l.scope}</span>
        {l.hot && <span className="badge badge-magenta">🔥 Active</span>}
      </div>
      <div className="h3 mt-12">{l.name}</div>
      <div className="row gap-12 mt-8 small muted wrap-w">
        <span className="row gap-4"><Icon name="calendar" size={14} />{(l.matchIds || []).length} matches</span>
        <span className="row gap-4"><Icon name="users" size={14} />{l.members}</span>
        <span className="row gap-4"><Icon name="wallet" size={14} />{l.def}</span>
        {l.pwd && <span className="row gap-4"><Icon name="lock" size={14} />Locked</span>}
      </div>
      <div className="hr" style={{ margin: '14px 0' }}></div>
      <div className="row between">
        <span className="tiny muted">Host · {l.owner}</span>
        {joined
          ? <span className="badge badge-gold">You: #{l.you}</span>
          : <Btn variant="primary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); s.toastMsg(`Joined ${l.name}!`, 'check', 'var(--green)'); s.go('lobby', { id: l.id }); }}>Join</Btn>}
      </div>
    </div>
  );
}

/* ===================== LOBBIES LIST ===================== */
export function Lobbies({ s }: ScreenProps) {
  const [q, setQ] = useState('');
  const [code, setCode] = useState('');
  const [allLobbies, setAllLobbies] = useState<Lobby[]>(WC.lobbies);
  useEffect(() => {
    fetch('/api/v1/lobbies')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data?.length) setAllLobbies(j.data); })
      .catch(() => { /* fall back to seed display */ });
  }, []);
  const match = (l: Lobby) => (l.name + l.owner + l.scope).toLowerCase().includes(q.toLowerCase());
  const joined = allLobbies.filter(l => l.joined && match(l));
  const discover = allLobbies.filter(l => !l.joined && match(l));

  return (
    <div className="page fade-up">
      <SecHead title="Lobbies" sub="Your private leagues — each one its own isolated game"
        action={<Btn variant="primary" size="sm" icon="plus" onClick={() => s.go('lobby-create')}>Create lobby</Btn>} />

      {/* search + join */}
      <div className="grid gap-12" style={{ gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', marginBottom: 22 }}>
        <div className="card card-pad row gap-10" style={{ borderRadius: 'var(--r-pill)' }}>
          <Icon name="search" size={18} className="muted" />
          <input className="input" style={{ border: 0, background: 'transparent', padding: '4px 0' }} placeholder="Search public lobbies by name or host" value={q} onChange={e => setQ(e.target.value)} />
        </div>
        <div className="card card-pad row gap-8" style={{ borderRadius: 'var(--r-pill)' }}>
          <Icon name="lock" size={16} className="muted" />
          <input className="input" style={{ border: 0, background: 'transparent', padding: '4px 0', minWidth: 0 }} placeholder="Invite code or link" value={code} onChange={e => setCode(e.target.value)} />
          <Btn variant="ghost" size="sm" onClick={() => code.trim() ? s.toastMsg('Joining via code…', 'check', 'var(--green)') : s.toastMsg('Paste a code or link first', 'alert', 'var(--gold)')}>Join</Btn>
        </div>
      </div>

      {/* joined */}
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Your lobbies · {joined.length}</span>
      </div>
      {joined.length
        ? <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>{joined.map(l => <LobbyCard key={l.id} l={l} s={s} joined />)}</div>
        : <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">You haven&apos;t joined any lobbies yet.</p></div>}

      {/* discover */}
      <div className="row between" style={{ margin: '28px 0 12px' }}>
        <span className="eyebrow">Discover public lobbies · {discover.length}</span>
        <span className="tiny muted">Open to anyone — no invite needed</span>
      </div>
      {discover.length
        ? <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>{discover.map(l => <LobbyCard key={l.id} l={l} s={s} />)}</div>
        : <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No public lobbies match your search.</p></div>}
    </div>
  );
}

/* ===================== CREATE LOBBY ===================== */
export function LobbyCreate({ s }: ScreenProps) {
  const [borrow, setBorrow] = useState(true);
  const [def, setDef] = useState(1000);
  const pool = [...WC.live, ...WC.upcoming].slice(0, 20);
  const [sel, setSel] = useState<Set<number>>(() => new Set(pool.slice(0, 6).map(m => m.id)));
  const [scope, setScope] = useState('custom');
  const [name, setName] = useState('The Lads 🍻');

  const create = async () => {
    try {
      const res = await fetch('/api/v1/lobbies', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, scope: scope === 'whole' ? 'all' : scope, defaultPoints: def }),
      });
      if (res.ok) { s.toastMsg('Lobby created — invite link copied!', 'check'); s.go('lobbies'); }
      else {
        const j = await res.json().catch(() => ({}));
        s.toastMsg(j?.error?.code === 'UNAUTHORIZED' ? 'Sign in to create a lobby' : 'Could not create lobby', 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const toggle = (id: number) => {
    setScope('custom');
    setSel(s0 => { const n = new Set(s0); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const stages: Scope[] = [
    { k: 'whole', label: 'Whole tournament', pick: () => pool.map(m => m.id) },
    { k: 'group', label: 'Group stage', pick: () => pool.filter(m => m.round === 'group').map(m => m.id) },
    { k: 'r32', label: 'Round of 32', future: true },
    { k: 'r16', label: 'Round of 16', future: true },
    { k: 'qf', label: 'Quarter-finals', future: true },
    { k: 'sf', label: 'Semi-finals', future: true },
    { k: 'final', label: 'Final', future: true },
  ];
  const utils: Scope[] = [
    { k: 'today', label: 'Live + today', pick: () => [...WC.live, ...WC.upcoming.slice(0, 6)].map(m => m.id) },
    { k: 'top', label: 'Top teams', pick: () => pool.filter(m => WC.byId(m.home).rank <= 12 || WC.byId(m.away).rank <= 12).map(m => m.id) },
    { k: 'clear', label: 'Clear', pick: () => [] },
  ];

  const applyScope = (p: Scope) => {
    setScope(p.k);
    if (p.future) {
      setSel(new Set());
    } else {
      setSel(new Set(p.pick ? p.pick() : []));
    }
  };

  const activeStage = stages.find(p => p.k === scope);
  const future = activeStage?.future;
  const count = sel.size;
  const scopeLabel = future
    ? (activeStage?.label ?? scope)
    : scope !== 'custom' && [...stages, ...utils].find(p => p.k === scope)?.label
    || (count === pool.length ? 'Whole tournament' : count === 0 ? 'No matches' : `Custom · ${count} matches`);

  return (
    <div className="page page-narrow fade-up">
      <button className="chip" onClick={() => s.back()} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> Back</button>
      <SecHead title="Create a lobby" sub="Set the rules, pick the matches, invite your crew" />
      <div className="card card-pad-lg stack gap-18">
        <div className="field"><label className="label">Lobby name</label><input className="input" placeholder="Office League · ABC Corp" value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div className="field"><label className="label">Password <span className="muted tiny">(optional)</span></label><input className="input" placeholder="Set a join password" type="password" defaultValue="goal2026" /></div>

        {/* SCOPE = stage presets + match picker */}
        <div className="field">
          <div className="row between">
            <label className="label">Scope</label>
            <span className={`badge badge-${count === 0 && !future ? 'muted' : future ? 'sky' : 'green'}`}>{scopeLabel}</span>
          </div>
          <div className="tiny muted" style={{ marginTop: -2 }}>Quick-pick a tournament stage, or hand-pick matches below.</div>
          <div className="row gap-8 wrap-w" style={{ marginTop: 8 }}>
            {stages.map(p => <button key={p.k} className={`chip ${scope === p.k ? 'active' : ''}`} onClick={() => applyScope(p)}>{p.label}</button>)}
          </div>

          {future ? (
            <div className="card-2 card-pad mt-12 row gap-10" style={{ borderRadius: 'var(--r-md)' }}>
              <Icon name="bracket" size={20} style={{ color: 'var(--sky)', flex: 'none' }} />
              <div><div className="small" style={{ fontWeight: 600 }}>{activeStage?.label} fixtures lock after the group draw</div><div className="tiny muted">Matches are added automatically once the bracket is set — your lobby will scope to every {activeStage?.label} tie.</div></div>
            </div>
          ) : (
            <>
              <div className="row between" style={{ marginTop: 12, marginBottom: 4 }}>
                <span className="tiny muted">Or hand-pick · {count} selected</span>
                <div className="row gap-6">{utils.map(p => <button key={p.k} className="chip chip-sm" onClick={() => applyScope(p)}>{p.label}</button>)}</div>
              </div>
              <div className="card-2" style={{ borderRadius: 'var(--r-md)', maxHeight: 280, overflowY: 'auto' }}>
                {pool.map(m => {
                  const home = WC.byId(m.home), away = WC.byId(m.away), on = sel.has(m.id);
                  return (
                    <button key={m.id} onClick={() => toggle(m.id)} className="row between full"
                      style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)', background: on ? 'var(--green-soft)' : 'transparent', textAlign: 'left' }}>
                      <div className="row gap-10" style={{ minWidth: 0 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 6, flex: 'none', border: `2px solid ${on ? 'var(--green)' : 'var(--line-strong)'}`, background: on ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center' }}>
                          {on && <Icon name="check" size={12} style={{ color: 'var(--on-accent)' }} />}
                        </span>
                        <Flag team={home} size={20} /><span className="small nowrap" style={{ fontWeight: 600 }}>{home.code} v {away.code}</span>
                        <span className="tiny muted hide-mobile">{m.stage}</span>
                      </div>
                      <span className="tiny muted nowrap">{m.status === 'LIVE' ? <span className="text-magenta">● LIVE</span> : `${WC.fmtDate(m.date)}`}</span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
          <div className="tiny muted">Members will only see and bet on these matches inside the lobby.</div>
        </div>

        <div className="field">
          <div className="row between"><label className="label">Starting points per member</label><span className="tnum text-gold" style={{ fontWeight: 700 }}>{def.toLocaleString()}</span></div>
          <input type="range" min="100" max="5000" step="100" value={def} onChange={e => setDef(+e.target.value)} style={{ width: '100%', accentColor: 'var(--green)' }} />
        </div>

        <div className="row between card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
          <div><div className="small" style={{ fontWeight: 600 }}>Allow point borrowing</div><div className="tiny muted">Members can request points from you when they run out</div></div>
          <button onClick={() => setBorrow(!borrow)} style={{ width: 44, height: 26, borderRadius: 999, background: borrow ? 'var(--green)' : 'var(--surface-3)', position: 'relative', transition: '.2s', flex: 'none' }}>
            <span style={{ position: 'absolute', top: 3, left: borrow ? 21 : 3, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: '.2s' }} />
          </button>
        </div>

        <div className="card-2 card-pad small t2" style={{ borderRadius: 'var(--r-sm)', display: 'flex', gap: 8 }}>
          <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none', marginTop: 2 }} />
          <span>This lobby is its own isolated game: separate wallet, {future ? `every ${activeStage?.label} tie` : `its own ${count} matches`}, and odds you can fine-tune as host. <span className="mono nowrap">score = winnings + default − borrowed</span>.</span>
        </div>

        <Btn variant="primary" size="lg" className="btn-block" disabled={!count && !future} onClick={create}>Create lobby &amp; get invite link</Btn>
      </div>
    </div>
  );
}

/* ---- Host: adjust lobby odds for one match ---- */
function LobbyOddsModal({ m, odds, onClose, onSave }: { m: Match; odds: Odds; onClose: () => void; onSave: (id: number, mh: number, md: number, ma: number) => void }) {
  const home = WC.byId(m.home), away = WC.byId(m.away);
  const [mh, setMh] = useState(odds.mh);
  const [md, setMd] = useState(odds.md);
  const [ma, setMa] = useState(odds.ma);
  const numInput = (v: number, set: (n: number) => void) => (
    <input className="input input-mono" type="number" step="0.01" min="0.1" value={v} onChange={e => set(Math.max(0.1, +e.target.value || 0.1))} style={{ textAlign: 'center', fontSize: 18 }} />
  );
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Set lobby odds</span><button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <div className="row gap-8 mt-8"><Flag team={home} size={22} /><span className="small">{home.code} v {away.code}</span><span className="tiny muted">· {m.stage}</span></div>
          <div className="row gap-10 mt-16">
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>1 · {home.code}</label>{numInput(mh, setMh)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>X · Draw</label>{numInput(md, setMd)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>2 · {away.code}</label>{numInput(ma, setMa)}</div>
          </div>
          <div className="card-2 card-pad mt-16 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)' }}>
            <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none' }} /><span>These odds apply only inside this lobby. Higher odds = bigger payouts for your members.</span>
          </div>
          <Btn variant="primary" size="lg" className="btn-block mt-16" onClick={() => onSave(m.id, mh, md, ma)}>Save odds</Btn>
        </div>
      </div>
    </div>
  );
}

/* ---- Lobby workspace: matches with lobby-specific odds ---- */
function LobbyMatches({ l, matches, isHost, odds, bets, onEdit, onBet }: {
  l: Lobby;
  matches: Match[];
  isHost: boolean;
  odds: Record<number, Odds>;
  bets: Record<number, Pick1X2>;
  onEdit: (m: Match) => void;
  onBet: (m: Match, pick: Pick1X2) => void;
}) {
  return (
    <div>
      <div className="card card-pad row between wrap gap-12" style={{ marginBottom: 14, background: isHost ? 'linear-gradient(120deg,var(--sky-soft),transparent)' : 'transparent' }}>
        <div className="row gap-10">
          <Icon name={isHost ? 'gauge' : 'calendar'} size={18} style={{ color: isHost ? 'var(--sky)' : 'var(--muted)' }} />
          <div>
            <div className="small" style={{ fontWeight: 700 }}>{isHost ? 'You set the odds for this lobby' : 'Bet on the host’s selected matches'}</div>
            <div className="tiny muted">{isHost ? 'Tap "Odds" on any match to fine-tune 1 · X · 2 for your members.' : `Host ${l.owner} picked these ${matches.length} matches · uses your lobby wallet`}</div>
          </div>
        </div>
      </div>

      <div className="stack gap-12">
        {matches.map(m => {
          const home = WC.byId(m.home), away = WC.byId(m.away), o = odds[m.id] || m.odds;
          const live = m.status === 'LIVE', fin = m.status === 'FINISHED', open = m.status === 'SCHEDULED';
          const myPick = bets[m.id];
          const cells: [Pick1X2, string, number][] = [['1', home.code, o.mh], ['X', 'Draw', o.md], ['2', away.code, o.ma]];
          return (
            <div key={m.id} className="card card-pad">
              <div className="row between" style={{ marginBottom: 12 }}>
                <div className="row gap-8"><span className="badge badge-muted">{m.stage}</span>
                  {live ? <span className="badge badge-magenta"><span className="live-dot"></span>{m.minute}&apos;</span>
                    : fin ? <span className="badge badge-muted">FT {m.hs}-{m.as}</span>
                      : <span className="small muted">{WC.fmtDate(m.date)} · {m.kickoff}</span>}
                </div>
                {isHost && <Btn variant="ghost" size="sm" icon="trending" onClick={() => onEdit(m)}>Odds</Btn>}
              </div>
              <div className="row between gap-12" style={{ marginBottom: 12 }}>
                {[home, away].map((t, i) => (
                  <div key={t.id} className="row gap-8" style={{ flex: 1, minWidth: 0, justifyContent: i ? 'flex-end' : 'flex-start' }}>
                    {i === 0 && <Flag team={t} size={26} />}
                    <span className="ellip small" style={{ fontWeight: 600 }}>{t.name}</span>
                    {i === 1 && <Flag team={t} size={26} />}
                  </div>
                ))}
              </div>
              <div className="row gap-8 full">
                {cells.map(([k, lbl, v]) => (
                  <button key={k} className={`odds ${myPick === k ? 'sel' : ''}`} disabled={!open || isHost}
                    onClick={() => open && !isHost && onBet(m, k)}
                    style={(!open || isHost) ? { opacity: isHost ? 1 : 0.5, cursor: isHost ? 'default' : 'not-allowed' } : undefined}>
                    <span className="o-label">{k} · {lbl}</span><span className="o-val">{v.toFixed(2)}</span>
                  </button>
                ))}
              </div>
              {myPick && <div className="tiny text-green mt-8 row gap-6"><Icon name="check" size={13} /> Your lobby bet: {myPick}</div>}
            </div>
          );
        })}
        {!matches.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No matches in this lobby yet.</p></div>}
      </div>
    </div>
  );
}

function LobbyBoard() {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead><tr><th>#</th><th>Member</th><th style={{ textAlign: 'right' }} className="hide-mobile">Default</th><th style={{ textAlign: 'right' }} className="hide-mobile">Winnings</th><th style={{ textAlign: 'right' }} className="hide-mobile">Borrowed</th><th style={{ textAlign: 'right' }}>Score</th></tr></thead>
          <tbody>
            {WC.lobbyBoard.map(p => (
              <tr key={p.rank} className={p.you ? 'hl' : ''}>
                <td className="tnum muted">{p.rank}</td>
                <td><div className="row gap-10"><Avatar initials={p.name.slice(0, 2).toUpperCase()} size={28} color={p.you ? 'var(--gold)' : 'var(--sky)'} /><span style={{ fontWeight: p.you ? 700 : 600 }}>{p.name}</span></div></td>
                <td className="tnum t2 hide-mobile" style={{ textAlign: 'right' }}>{p.def}</td>
                <td className="tnum hide-mobile" style={{ textAlign: 'right', color: p.won >= 0 ? 'var(--green)' : 'var(--danger)' }}>{p.won >= 0 ? '+' : ''}{p.won}</td>
                <td className="tnum t2 hide-mobile" style={{ textAlign: 'right', color: p.borrowed ? 'var(--gold)' : 'var(--muted)' }}>−{p.borrowed}</td>
                <td className="tnum" style={{ textAlign: 'right', fontWeight: 700, color: p.score >= 0 ? 'var(--text)' : 'var(--danger)' }}>{p.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="card-pad tiny muted" style={{ borderTop: '1px solid var(--line)' }}>Score = winnings + default − borrowed. Borrowing lets you keep playing but pulls your score down.</div>
    </div>
  );
}

function LobbyChat() {
  const [msgs, setMsgs] = useState(WC.lobbyChat);
  const [text, setText] = useState('');
  const send = () => {
    if (!text.trim()) return;
    setMsgs(m => [...m, { who: 'You', text: text.trim(), t: '14:24' }]);
    setText('');
  };
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 460 }}>
      <div className="stack gap-12" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {msgs.map((m, i) => m.who === 'sys'
          ? <div key={i} className="row center"><span className="badge badge-muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>{m.text}</span></div>
          : (
            <div key={i} className="row gap-10" style={{ flexDirection: m.who === 'You' ? 'row-reverse' : 'row', textAlign: m.who === 'You' ? 'right' : 'left' }}>
              <Avatar initials={m.who.slice(0, 2).toUpperCase()} size={30} color={m.who === 'You' ? 'var(--gold)' : 'var(--sky)'} />
              <div style={{ maxWidth: '74%' }}>
                <div className="tiny muted" style={{ marginBottom: 3 }}>{m.who} · {m.t}</div>
                <div className="card-pad" style={{ background: m.who === 'You' ? 'var(--green-soft)' : 'var(--surface-2)', borderRadius: 'var(--r-md)', padding: '9px 13px', display: 'inline-block', fontSize: 14 }}>{m.text}</div>
              </div>
            </div>
          ))}
      </div>
      <div className="row gap-8" style={{ padding: 12, borderTop: '1px solid var(--line)' }}>
        <div className="row gap-6">{['👍', '😂', '😮', '💀'].map(e => <button key={e} className="chip chip-sm" onClick={() => setMsgs(m => [...m, { who: 'You', text: e, t: '14:24' }])} style={{ fontSize: 16, padding: '4px 8px' }}>{e}</button>)}</div>
        <input className="input grow" placeholder="Talk trash…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <Btn variant="primary" className="btn-icon" onClick={send}><Icon name="send" size={18} /></Btn>
      </div>
    </div>
  );
}

function LobbyMembers({ l, isHost, s }: { l: Lobby; isHost: boolean; s: ScreenProps['s'] }) {
  const [members, setMembers] = useState(WC.lobbyBoard);

  const handleKick = async (userId: number) => {
    try {
      const res = await fetch(`/api/v1/lobbies/${l.id}/kick`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setMembers(ms => ms.filter(m => m.userId !== userId));
        s.toastMsg('Member kicked', 'check', 'var(--green)');
      } else {
        const j = await res.json().catch(() => ({}));
        s.toastMsg(j?.error?.code ?? 'Could not kick member', 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  const handleMakeHost = async (userId: number) => {
    try {
      const res = await fetch(`/api/v1/lobbies/${l.id}/transfer`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ toUserId: userId }),
      });
      if (res.ok) {
        s.toastMsg('Host transferred', 'check', 'var(--sky)');
      } else {
        const j = await res.json().catch(() => ({}));
        s.toastMsg(j?.error?.code ?? 'Could not transfer host', 'alert', 'var(--danger)');
      }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

  return (
    <div className="stack gap-10">
      {members.map(p => (
        <div key={p.rank} className="card card-pad row between">
          <div className="row gap-12"><Avatar initials={p.name.slice(0, 2).toUpperCase()} size={36} color={p.you ? 'var(--gold)' : 'var(--sky)'} />
            <div><div style={{ fontWeight: 600 }}>{p.name}{p.you && <span className="badge badge-gold" style={{ marginLeft: 8 }}>You</span>}</div><div className="tiny muted tnum">Score {p.score} {p.borrowed ? `· borrowed ${p.borrowed}` : ''}</div></div>
          </div>
          {isHost && !p.you
            ? <div className="row gap-6">
                <Btn variant="ghost" size="sm">Set points</Btn>
                <Btn variant="ghost" size="sm" onClick={() => handleMakeHost(p.userId)}>Make host</Btn>
                <button className="btn-icon btn-ghost" onClick={() => handleKick(p.userId)}><Icon name="x" size={15} /></button>
              </div>
            : p.borrowed > 0 && !isHost ? <span className="badge badge-muted">Owes {p.borrowed}</span> : null}
        </div>
      ))}
    </div>
  );
}

/* ---- Host: pending borrow-request approval queue ---- */
function LobbyRequests({ s, l, isHost }: { s: ScreenProps['s']; l: Lobby; isHost: boolean }) {
  const [reqs, setReqs] = useState<Req[]>(WC.borrowRequests.map(r => ({ ...r, state: 'pending' })));
  const resolve = (id: number, state: string, amt?: number) => {
    setReqs(rs => rs.map(r => r.id === id ? { ...r, state } : r));
    const r = reqs.find(x => x.id === id);
    if (!r) return;
    if (state === 'approved') s.toastMsg(`Approved ${amt} pts for ${r.who}`, 'check', 'var(--green)');
    else s.toastMsg(`Declined ${r.who}'s request`, 'x', 'var(--danger)');
  };
  const pending = reqs.filter(r => r.state === 'pending');

  return (
    <div className="stack gap-12">
      <div className="card card-pad row between wrap gap-12" style={{ background: 'linear-gradient(120deg,var(--gold-soft),transparent)', borderColor: 'rgba(255,200,61,.25)' }}>
        <div className="row gap-10">
          <Icon name="wallet" size={18} style={{ color: 'var(--gold)' }} />
          <div>
            <div className="small" style={{ fontWeight: 700 }}>{isHost ? 'Borrow requests to approve' : 'Borrow requests'}</div>
            <div className="tiny muted">{pending.length} pending · {isHost ? 'as host you decide who gets points' : `host ${l.owner} reviews these`}</div>
          </div>
        </div>
        {isHost && pending.length > 0 &&
          <Btn variant="ghost" size="sm" onClick={() => { pending.forEach(r => resolve(r.id, 'approved', r.amount)); }}>Approve all</Btn>}
      </div>

      {reqs.map(r => {
        const decided = r.state !== 'pending';
        return (
          <div key={r.id} className="card card-pad" style={{ opacity: decided ? 0.6 : 1, borderColor: r.repeat && !decided ? 'rgba(255,200,61,.3)' : 'var(--line)' }}>
            <div className="row between wrap gap-12">
              <div className="row gap-12" style={{ minWidth: 0 }}>
                <Avatar initials={r.who.slice(0, 2).toUpperCase()} size={40} color="var(--sky)" />
                <div style={{ minWidth: 0 }}>
                  <div className="row gap-8">
                    <span style={{ fontWeight: 700 }}>{r.who}</span>
                    {r.repeat && <span className="badge badge-gold">⚠ Frequent borrower</span>}
                  </div>
                  <div className="tiny muted">Balance <span className="tnum">{r.balance}</span> · lobby score <span className="tnum">{r.score}</span> · {r.t}</div>
                </div>
              </div>
              <div className="row gap-8" style={{ textAlign: 'right' }}>
                <div className="stat" style={{ alignItems: 'flex-end' }}>
                  <span className="s-val tnum text-gold" style={{ fontSize: 22 }}>{r.amount}</span>
                  <span className="s-lbl">requested</span>
                </div>
              </div>
            </div>

            {r.msg && <div className="card-2 card-pad mt-12 small t2" style={{ borderRadius: 'var(--r-sm)', fontStyle: 'italic' }}>&quot;{r.msg}&quot;</div>}

            <div className="row between mt-12 gap-8 wrap">
              <span className="tiny muted">Approving moves {r.amount} pts from your host pool → their lobby wallet (raises their borrowed total).</span>
              {decided
                ? <span className={`badge badge-${r.state === 'approved' ? 'green' : 'danger'}`}>{r.state === 'approved' ? '✓ Approved' : '✕ Declined'}</span>
                : isHost
                  ? <div className="row gap-8">
                      <Btn variant="ghost" size="sm" icon="x" onClick={() => resolve(r.id, 'declined')}>Decline</Btn>
                      <Btn variant="gold" size="sm" icon="check" onClick={() => resolve(r.id, 'approved', r.amount)}>Approve {r.amount}</Btn>
                    </div>
                  : <span className="badge badge-muted">Awaiting host</span>}
            </div>
          </div>
        );
      })}

      {!reqs.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No pending borrow requests.</p></div>}
    </div>
  );
}

/* ===================== LOBBY DETAIL (isolated workspace) ===================== */
export function LobbyView({ s }: ScreenProps) {
  const lid = typeof s.param.id === 'number' ? s.param.id : Number(s.param.id);
  const l = WC.lobbies.find(x => x.id === lid) || WC.lobbies[0];
  const isHost = l.owner === 'You';
  const [tab, setTab] = useState('matches');
  const lobbyMatchList = WC.lobbyMatches(l);
  const [odds, setOdds] = useState<Record<number, Odds>>(() => {
    const o: Record<number, Odds> = {};
    lobbyMatchList.forEach(m => { o[m.id] = { ...m.odds }; });
    return o;
  });
  const [editM, setEditM] = useState<Match | null>(null);
  const [bets, setBets] = useState<Record<number, Pick1X2>>({});

  const saveOdds = (id: number, mh: number, md: number, ma: number) => {
    setOdds(p => ({ ...p, [id]: { mh, md, ma } }));
    setEditM(null);
    s.toastMsg('Lobby odds updated for this match', 'check', 'var(--sky)');
  };
  const placeBet = (m: Match, pick: Pick1X2) => {
    setBets(b => ({ ...b, [m.id]: pick }));
    s.toastMsg(`Lobby bet: ${pick} · uses your lobby wallet`, 'check', 'var(--green)');
  };

  const tabs: [string, string][] = [
    ['matches', `Matches · ${lobbyMatchList.length}`],
    ['board', 'Standings'],
    ['chat', 'Chat'],
    ['requests', 'Requests'],
    ['members', 'Members'],
  ];

  return (
    <div className="page fade-up">
      <button className="chip" onClick={() => s.go('lobbies')} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> All lobbies</button>

      <div className="panel card-pad-lg" style={{ background: 'linear-gradient(150deg, var(--surface-2), var(--bg-2))' }}>
        <div className="row between wrap gap-12">
          <div>
            <div className="row gap-8 wrap-w"><span className="badge badge-sky">{l.scope}</span>{l.borrow && <span className="badge badge-gold">Borrow on</span>}{isHost && <span className="badge badge-green">You host</span>}</div>
            <h1 className="h2 mt-8">{l.name}</h1>
            <div className="tiny muted mt-4">Host · {l.owner} · {l.members} members · {l.def} start · code <span className="mono">{l.code}</span></div>
          </div>
          <div className="row gap-8">
            <Btn variant="ghost" size="sm" icon="share" onClick={() => s.toastMsg('Invite link copied!', 'check')}>Invite</Btn>
            {!isHost && <Btn variant="gold" size="sm" icon="wallet" onClick={() => s.openBorrow()}>Borrow</Btn>}
          </div>
        </div>
        {/* lobby wallet strip */}
        <div className="row gap-20 mt-16 wrap-w">
          <div className="stat"><span className="s-val tnum text-gold" style={{ fontSize: 22 }}>1,410</span><span className="s-lbl">Lobby wallet</span></div>
          <div className="stat"><span className="s-val tnum" style={{ fontSize: 22 }}>#3</span><span className="s-lbl">Your rank</span></div>
          <div className="stat"><span className="s-val tnum text-sky" style={{ fontSize: 22 }}>{lobbyMatchList.length}</span><span className="s-lbl">Matches</span></div>
        </div>
      </div>

      <div className="row gap-8 mt-16" style={{ overflowX: 'auto' }}>
        {tabs.map(([k, lbl]) =>
          <button key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {lbl}
            {k === 'requests' && isHost && WC.borrowRequests.length > 0 &&
              <span className="badge badge-gold" style={{ padding: '1px 7px', marginLeft: 2 }}>{WC.borrowRequests.length}</span>}
          </button>)}
      </div>

      <div className="mt-16">
        {tab === 'matches' && <LobbyMatches l={l} matches={lobbyMatchList} isHost={isHost} odds={odds} bets={bets} onEdit={setEditM} onBet={placeBet} />}
        {tab === 'board' && <LobbyBoard />}
        {tab === 'chat' && <LobbyChat />}
        {tab === 'requests' && <LobbyRequests s={s} l={l} isHost={isHost} />}
        {tab === 'members' && <LobbyMembers l={l} isHost={isHost} s={s} />}
      </div>

      {editM && <LobbyOddsModal m={editM} odds={odds[editM.id] || editM.odds} onClose={() => setEditM(null)} onSave={saveOdds} />}
    </div>
  );
}

/* ===================== BORROW MODAL ===================== */
export function BorrowModal({ s }: ScreenProps) {
  const [amt, setAmt] = useState(200);
  if (!s.borrowOpen) return null;
  return (
    <div className="overlay" onClick={s.closeBorrow}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Borrow points</span><button className="btn-icon" onClick={s.closeBorrow}><Icon name="x" size={18} /></button></div>
          <p className="t2 small mt-12">Request points from the host to keep betting. The host must approve.</p>
          <div className="field mt-16">
            <div className="row between"><label className="label">Amount</label><span className="tnum text-gold" style={{ fontWeight: 700 }}>{amt}</span></div>
            <input type="range" min="50" max="1000" step="50" value={amt} onChange={e => setAmt(+e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
            <div className="row gap-8 mt-4">{[100, 200, 500].map(q => <button key={q} className="chip chip-sm" onClick={() => setAmt(q)}>{q}</button>)}</div>
          </div>
          <div className="card-2 card-pad mt-16 small" style={{ borderRadius: 'var(--r-sm)' }}>
            <div className="row between t2"><span>New stake power</span><span className="tnum">+{amt}</span></div>
            <div className="row between t2 mt-8"><span>Lobby score impact</span><span className="tnum text-danger">−{amt}</span></div>
          </div>
          <Btn variant="gold" size="lg" className="btn-block mt-16" onClick={() => { s.closeBorrow(); s.toastMsg('Borrow request sent to host', 'check'); }}>Request {amt} points</Btn>
        </div>
      </div>
    </div>
  );
}
