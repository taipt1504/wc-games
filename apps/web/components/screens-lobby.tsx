'use client';
/* GOLAZO — Lobbies · Create · Lobby view · Borrow modal (ported from design screens-lobby.jsx) */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { type Lobby, type Pick1X2, type Odds } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, Flag, Avatar, SecHead, Portal } from '@/components/ui';
import { type RealMatch } from '@/components/screens-match';

/* ---- Scope preset type ---- */
interface Scope {
  k: string;
  label: string;
  future?: boolean;
  pick?: () => number[];
}

/* ---- Borrow request type ---- */
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

/* ---- Board row type ---- */
interface BoardRow {
  rank: number;
  userId: number;
  name: string;
  score: number;
  balance: number;
  won: number;
  def: number;
  borrowed: number;
  you: boolean;
}

/* ---- Chat message type ---- */
interface ChatMsg { who: string; text: string; t: string }

/* ===================== LOBBY CARD (helper) ===================== */
function LobbyCard({ l, s, joined, onJoin }: { l: Lobby; s: ScreenProps['s']; joined?: boolean; onJoin?: (l: Lobby) => void }) {
  return (
    <div className="card card-pad card-hover pointer" onClick={() => s.go('lobby', { id: l.id })}>
      <div className="row between">
        <span className="badge badge-sky">{l.scope}</span>
        {l.hot && <span className="badge badge-magenta">🔥 Active</span>}
      </div>
      <div className="h3 mt-12">{l.name}</div>
      <div className="row gap-12 mt-8 small muted wrap-w">
        <span className="row gap-4"><Icon name="calendar" size={14} />{(l.matchIds ?? []).length} matches</span>
        <span className="row gap-4"><Icon name="users" size={14} />{l.members}</span>
        <span className="row gap-4"><Icon name="wallet" size={14} />{l.def}</span>
        {l.pwd && <span className="row gap-4"><Icon name="lock" size={14} />Locked</span>}
      </div>
      <div className="hr" style={{ margin: '14px 0' }}></div>
      <div className="row between">
        <span className="tiny muted">Host · {l.owner}</span>
        {joined
          ? <span className="badge badge-gold">You: #{l.you}</span>
          : <Btn variant="primary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onJoin?.(l); }}>{l.pwd ? 'Join 🔒' : 'Join'}</Btn>}
      </div>
    </div>
  );
}

type JoinTarget = { id: number; name: string } | { code: string };

/* ===================== LOBBIES LIST ===================== */
export function Lobbies({ s }: ScreenProps) {
  const [q, setQ] = useState('');
  const [code, setCode] = useState('');
  const [allLobbies, setAllLobbies] = useState<Lobby[]>([]);
  const [pwModal, setPwModal] = useState<{ target: JoinTarget; name: string; password: string; error: string } | null>(null);

  const reload = useCallback(() => {
    fetch('/api/v1/lobbies').then((r) => (r.ok ? r.json() : null)).then((j) => { if (j?.data) setAllLobbies(j.data); }).catch(() => {});
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const join = useCallback(async (target: JoinTarget, password?: string) => {
    const url = 'id' in target ? `/api/v1/lobbies/${target.id}/join` : '/api/v1/lobbies/join-by-code';
    const payload = 'id' in target ? { password } : { code: target.code, password };
    try {
      const res = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const j = await res.json().catch(() => ({}));
      const id = j?.data?.id as number | undefined;
      if (res.ok) { setPwModal(null); s.toastMsg(j?.data?.alreadyMember ? 'Already a member' : 'Joined lobby!', 'check', 'var(--green)'); reload(); if (id) s.go('lobby', { id }); return; }
      const errc = j?.error?.code;
      if (errc === 'PASSWORD_REQUIRED') { setPwModal({ target, name: 'name' in target ? target.name : target.code, password: '', error: '' }); return; }
      if (errc === 'WRONG_PASSWORD') { setPwModal((m) => (m ? { ...m, error: 'Wrong password — try again' } : m)); return; }
      if (errc === 'ALREADY_MEMBER') { setPwModal(null); if (id) s.go('lobby', { id }); return; }
      if (errc === 'INVALID_CODE') { s.toastMsg('Invite code not found', 'alert', 'var(--danger)'); return; }
      if (errc === 'UNAUTHORIZED') { s.toastMsg('Sign in to join a lobby', 'lock', 'var(--gold)'); s.go('auth', { mode: 'signup' }); return; }
      s.toastMsg('Could not join lobby', 'alert', 'var(--danger)');
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  }, [s, reload]);

  // Auto-join from an invite link (?join=CODE → routed here as s.param.join).
  const autoCode = s.param?.join as string | undefined;
  useEffect(() => { if (autoCode) { setCode(autoCode); void join({ code: autoCode }); } }, [autoCode, join]);

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
          <input className="input" style={{ border: 0, background: 'transparent', padding: '4px 0', minWidth: 0 }} placeholder="Invite code or link" value={code} onChange={e => setCode(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && code.trim()) void join({ code: code.trim() }); }} />
          <Btn variant="ghost" size="sm" onClick={() => code.trim() ? void join({ code: code.trim() }) : s.toastMsg('Paste a code or link first', 'alert', 'var(--gold)')}>Join</Btn>
        </div>
      </div>

      {/* joined */}
      <div className="row between" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Your lobbies · {joined.length}</span>
      </div>
      {joined.length
        ? <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>{joined.map(l => <LobbyCard key={l.id} l={l} s={s} joined />)}</div>
        : <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No lobbies yet — create one or join with a code.</p></div>}

      {/* discover */}
      <div className="row between" style={{ margin: '28px 0 12px' }}>
        <span className="eyebrow">Discover public lobbies · {discover.length}</span>
        <span className="tiny muted">Open to anyone — no invite needed</span>
      </div>
      {discover.length
        ? <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>{discover.map(l => <LobbyCard key={l.id} l={l} s={s} onJoin={(lb) => join({ id: lb.id, name: lb.name })} />)}</div>
        : <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No public lobbies match your search.</p></div>}

      {/* password prompt (protected lobby / code) */}
      {pwModal && (
        <Portal><div className="overlay" onClick={() => setPwModal(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="card-pad-lg stack gap-12">
              <div className="row between"><span className="eyebrow">Join lobby</span><button className="btn-icon" onClick={() => setPwModal(null)}><Icon name="x" size={18} /></button></div>
              <p className="small t2" style={{ margin: 0 }}>“{pwModal.name}” is password-protected.</p>
              <div className="field"><label className="label">Lobby password</label>
                <input className="input" type="password" autoFocus value={pwModal.password}
                  onChange={e => setPwModal(m => (m ? { ...m, password: e.target.value, error: '' } : m))}
                  onKeyDown={e => { if (e.key === 'Enter' && pwModal.password) void join(pwModal.target, pwModal.password); }} />
              </div>
              {pwModal.error && <p className="tiny text-danger" style={{ margin: 0 }}>{pwModal.error}</p>}
              <Btn variant="primary" className="btn-block" disabled={!pwModal.password} onClick={() => void join(pwModal.target, pwModal.password)}>Join</Btn>
            </div>
          </div>
        </div></Portal>
      )}
    </div>
  );
}

/* ===================== CREATE LOBBY ===================== */
export function LobbyCreate({ s }: ScreenProps) {
  const [borrow, setBorrow] = useState(true);
  const [def, setDef] = useState(1000);
  const [pool, setPool] = useState<RealMatch[]>([]);
  const initRef = useRef(false);
  useEffect(() => {
    fetch('/api/v1/matches').then(r => (r.ok ? r.json() : null))
      .then(j => setPool(((j?.data ?? []) as RealMatch[]).slice(0, 40)))
      .catch(() => {});
  }, []);
  const [sel, setSel] = useState<Set<number>>(new Set());
  useEffect(() => { if (!initRef.current && pool.length) { initRef.current = true; setSel(new Set(pool.slice(0, 6).map(m => m.id))); } }, [pool]);
  const [scope, setScope] = useState('custom');
  const [name, setName] = useState('The Lads 🍻');
  const [password, setPassword] = useState('');

  const create = async () => {
    try {
      const res = await fetch('/api/v1/lobbies', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, scope: scope === 'whole' ? 'all' : scope, defaultPoints: def, password: password.trim() || undefined }),
      });
      if (res.ok) {
        const j = await res.json().catch(() => ({}));
        if (j?.data?.code) { try { await navigator.clipboard.writeText(`${window.location.origin}/?join=${j.data.code}`); } catch { /* clipboard may be blocked */ } }
        s.toastMsg('Lobby created — invite link copied!', 'check'); s.go('lobbies');
      }
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
    { k: 'group', label: 'Group stage', pick: () => pool.filter(m => m.round === 'GROUP').map(m => m.id) },
    { k: 'r32', label: 'Round of 32', future: true },
    { k: 'r16', label: 'Round of 16', future: true },
    { k: 'qf', label: 'Quarter-finals', future: true },
    { k: 'sf', label: 'Semi-finals', future: true },
    { k: 'final', label: 'Final', future: true },
  ];
  const utils: Scope[] = [
    { k: 'today', label: 'Today', pick: () => pool.filter(m => new Date(m.kickoffAt).toDateString() === new Date().toDateString()).map(m => m.id) },
    { k: 'open', label: 'Open', pick: () => pool.filter(m => m.status === 'SCHEDULED').map(m => m.id) },
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
        <div className="field"><label className="label">Password <span className="muted tiny">(optional)</span></label><input className="input" placeholder="Set a join password (leave blank for public)" type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>

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
                {pool.length === 0 && <div className="small muted" style={{ padding: 14, textAlign: 'center' }}>Loading fixtures…</div>}
                {pool.map(m => {
                  const on = sel.has(m.id);
                  return (
                    <button key={m.id} onClick={() => toggle(m.id)} className="row between full"
                      style={{ padding: '11px 14px', borderBottom: '1px solid var(--line)', background: on ? 'var(--green-soft)' : 'transparent', textAlign: 'left' }}>
                      <div className="row gap-10" style={{ minWidth: 0 }}>
                        <span style={{ width: 20, height: 20, borderRadius: 6, flex: 'none', border: `2px solid ${on ? 'var(--green)' : 'var(--line-strong)'}`, background: on ? 'var(--green)' : 'transparent', display: 'grid', placeItems: 'center' }}>
                          {on && <Icon name="check" size={12} style={{ color: 'var(--on-accent)' }} />}
                        </span>
                        {m.home && <Flag flagUrl={m.home.flagUrl ?? undefined} name={m.home.name} code={m.home.code ?? undefined} size={20} />}<span className="small nowrap" style={{ fontWeight: 600 }}>{m.home?.code ?? 'TBD'} v {m.away?.code ?? 'TBD'}</span>
                        <span className="tiny muted hide-mobile">{m.round === 'GROUP' ? `Group ${m.group ?? ''}` : m.round}</span>
                      </div>
                      <span className="tiny muted nowrap">{m.status === 'LIVE' ? <span className="text-magenta">● LIVE</span> : new Date(m.kickoffAt).toLocaleDateString()}</span>
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

/* ---- Real lobby match shape (from GET /api/v1/lobbies/[id].matches) ---- */
interface LobbyTeamLite { id: number; name: string; code: string | null; flagUrl: string | null }
interface LobbyBetLite { outcome: Pick1X2 | null; stake: number; status: string }
export interface LobbyMatch {
  id: number; round: string; status: string; kickoffAt: string;
  scoreHome: number | null; scoreAway: number | null;
  home: LobbyTeamLite | null; away: LobbyTeamLite | null;
  odds: { mHome: number; mDraw: number; mAway: number } | null;
  bets: LobbyBetLite[];
}

/* ---- Host: adjust lobby odds for one match ---- */
function LobbyOddsModal({ m, odds, onClose, onSave }: { m: LobbyMatch; odds: Odds; onClose: () => void; onSave: (id: number, mh: number, md: number, ma: number) => void }) {
  const [mh, setMh] = useState(odds.mh);
  const [md, setMd] = useState(odds.md);
  const [ma, setMa] = useState(odds.ma);
  const numInput = (v: number, set: (n: number) => void) => (
    <input className="input input-mono" type="number" step="0.01" min="0.1" value={v} onChange={e => set(Math.max(0.1, +e.target.value || 0.1))} style={{ textAlign: 'center', fontSize: 18 }} />
  );
  return (
    <Portal><div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Set lobby odds</span><button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <div className="row gap-8 mt-8"><span className="small" style={{ fontWeight: 600 }}>{m.home?.code ?? '?'} v {m.away?.code ?? '?'}</span><span className="tiny muted">· {m.round}</span></div>
          <div className="row gap-10 mt-16">
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>1 · {m.home?.code ?? 'H'}</label>{numInput(mh, setMh)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>X · Draw</label>{numInput(md, setMd)}</div>
            <div className="field" style={{ flex: 1 }}><label className="label" style={{ textAlign: 'center' }}>2 · {m.away?.code ?? 'A'}</label>{numInput(ma, setMa)}</div>
          </div>
          <div className="card-2 card-pad mt-16 small t2 row gap-8" style={{ borderRadius: 'var(--r-sm)' }}>
            <Icon name="alert" size={15} style={{ color: 'var(--gold)', flex: 'none' }} /><span>These odds apply only inside this lobby. Higher odds = bigger payouts for your members.</span>
          </div>
          <Btn variant="primary" size="lg" className="btn-block mt-16" onClick={() => onSave(m.id, mh, md, ma)}>Save odds</Btn>
        </div>
      </div>
    </div></Portal>
  );
}

/* ---- Lobby bet slip: outcome + stake (multiple outcomes per match allowed) ---- */
function LobbyBetSlip({ match, pick, oddsVal, balance, onClose, onConfirm }: { match: LobbyMatch; pick: Pick1X2; oddsVal: number; balance: number; onClose: () => void; onConfirm: (stake: number) => void }) {
  const [stake, setStake] = useState(100);
  const label = pick === '1' ? (match.home?.name ?? 'Home') : pick === '2' ? (match.away?.name ?? 'Away') : 'Draw';
  const payout = Math.round(stake * (1 + oddsVal));
  const over = stake > balance;
  const quick = [50, 100, 250, 500];
  return (
    <Portal><div className="overlay" onClick={onClose}>
      <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="card-pad-lg">
          <div className="row between"><span className="eyebrow">Lobby bet slip</span><button className="btn-icon" onClick={onClose}><Icon name="x" size={18} /></button></div>
          <div className="row between mt-12 card-2 card-pad" style={{ borderRadius: 'var(--r-sm)' }}>
            <span className="small ellip">{match.home?.code ?? '?'} v {match.away?.code ?? '?'}</span>
            <span className="badge badge-sky">{pick} · {label}</span>
          </div>
          <div className="field mt-16">
            <div className="row between"><label className="label">Stake</label><span className="tiny muted">Lobby wallet <span className="tnum text-gold">{balance.toLocaleString()}</span></span></div>
            <input className="input input-mono" type="number" min={1} value={stake} onChange={e => setStake(Math.max(1, +e.target.value || 1))} />
            <div className="row gap-8 mt-4">{quick.map(q => <button key={q} className="chip chip-sm" onClick={() => setStake(q)}>{q}</button>)}<button className="chip chip-sm" onClick={() => setStake(Math.max(1, balance))}>Max</button></div>
          </div>
          <div className="card-2 card-pad mt-12" style={{ borderRadius: 'var(--r-sm)' }}>
            <div className="row between small"><span className="t2">Odds</span><span className="tnum">×{(1 + oddsVal).toFixed(2)}</span></div>
            <div className="row between mt-8"><span className="t2">Potential payout</span><span className="tnum text-green" style={{ fontWeight: 700 }}>{payout.toLocaleString()}</span></div>
          </div>
          {over && <p className="tiny text-danger mt-8" style={{ textAlign: 'center' }}>Stake exceeds your lobby wallet.</p>}
          <Btn variant="primary" size="lg" className="btn-block mt-16" disabled={stake <= 0 || over} onClick={() => onConfirm(stake)}>Confirm bet · {stake} pts</Btn>
        </div>
      </div>
    </div></Portal>
  );
}

/* ---- Lobby workspace: real matches with lobby-specific odds + multi-outcome betting ---- */
function LobbyMatches({ ownerName, matches, isHost, odds, onEdit, onBet }: {
  ownerName: string;
  matches: LobbyMatch[];
  isHost: boolean;
  odds: Record<number, Odds>;
  onEdit: (m: LobbyMatch) => void;
  onBet: (m: LobbyMatch, pick: Pick1X2, oddsVal: number) => void;
}) {
  return (
    <div>
      <div className="card card-pad row between wrap gap-12" style={{ marginBottom: 14, background: isHost ? 'linear-gradient(120deg,var(--sky-soft),transparent)' : 'transparent' }}>
        <div className="row gap-10">
          <Icon name={isHost ? 'gauge' : 'calendar'} size={18} style={{ color: isHost ? 'var(--sky)' : 'var(--muted)' }} />
          <div>
            <div className="small" style={{ fontWeight: 700 }}>{isHost ? 'You host this lobby — set odds and bet too' : `Host ${ownerName}'s matches`}</div>
            <div className="tiny muted">Tap 1 · X · 2 to bet (you can back more than one outcome). {isHost && 'Tap "Odds" to fine-tune.'} Uses your lobby wallet.</div>
          </div>
        </div>
      </div>

      <div className="stack gap-12">
        {matches.map(m => {
          const o = odds[m.id] || (m.odds ? { mh: m.odds.mHome, md: m.odds.mDraw, ma: m.odds.mAway } : { mh: 0, md: 0, ma: 0 });
          const open = m.status === 'SCHEDULED';
          const live = m.status === 'LIVE', fin = m.status === 'FINISHED';
          const betFor = (k: Pick1X2) => m.bets.find(b => b.outcome === k);
          const cells: [Pick1X2, string, number][] = [['1', m.home?.code ?? 'H', o.mh], ['X', 'Draw', o.md], ['2', m.away?.code ?? 'A', o.ma]];
          return (
            <div key={m.id} className="card card-pad">
              <div className="row between" style={{ marginBottom: 12 }}>
                <div className="row gap-8"><span className="badge badge-muted">{m.round}</span>
                  {live ? <span className="badge badge-magenta"><span className="live-dot"></span>LIVE</span>
                    : fin ? <span className="badge badge-muted">FT {m.scoreHome}-{m.scoreAway}</span>
                      : <span className="small muted">{new Date(m.kickoffAt).toLocaleDateString()}</span>}
                </div>
                {isHost && <Btn variant="ghost" size="sm" icon="trending" onClick={() => onEdit(m)}>Odds</Btn>}
              </div>
              <div className="row between gap-12" style={{ marginBottom: 12 }}>
                {[m.home, m.away].map((t, i) => (
                  <div key={i} className="row gap-8" style={{ flex: 1, minWidth: 0, justifyContent: i ? 'flex-end' : 'flex-start' }}>
                    {i === 0 && t && <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={26} />}
                    <span className="ellip small" style={{ fontWeight: 600 }}>{t?.name ?? 'TBD'}</span>
                    {i === 1 && t && <Flag flagUrl={t.flagUrl ?? undefined} name={t.name} code={t.code ?? undefined} size={26} />}
                  </div>
                ))}
              </div>
              <div className="row gap-8 full">
                {cells.map(([k, lbl, v]) => {
                  const bet = betFor(k);
                  return (
                    <button key={k} className={`odds ${bet ? 'sel' : ''}`} disabled={!open || !!bet}
                      onClick={() => open && !bet && onBet(m, k, v)}
                      style={(!open) ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}>
                      <span className="o-label">{k} · {lbl}</span><span className="o-val">{v.toFixed(2)}</span>
                    </button>
                  );
                })}
              </div>
              {m.bets.length > 0 && (
                <div className="tiny text-green mt-8 row gap-8 wrap-w">
                  {m.bets.map((b, i) => <span key={i} className="row gap-4"><Icon name="check" size={13} /> {b.outcome} · {b.stake} pts{b.status !== 'OPEN' ? ` (${b.status})` : ''}</span>)}
                </div>
              )}
            </div>
          );
        })}
        {!matches.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No matches in this lobby yet.</p></div>}
      </div>
    </div>
  );
}

function LobbyBoard({ board }: { board: BoardRow[] }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ overflowX: 'auto' }}>
        <table className="tbl">
          <thead><tr><th>#</th><th>Member</th><th style={{ textAlign: 'right' }} className="hide-mobile">Default</th><th style={{ textAlign: 'right' }} className="hide-mobile">Winnings</th><th style={{ textAlign: 'right' }} className="hide-mobile">Borrowed</th><th style={{ textAlign: 'right' }}>Score</th></tr></thead>
          <tbody>
            {board.map(p => (
              <tr key={p.rank} className={p.you ? 'hl' : ''}>
                <td className="tnum muted">{p.rank}</td>
                <td><div className="row gap-10"><Avatar initials={p.name.slice(0, 2).toUpperCase()} size={28} color={p.you ? 'var(--gold)' : 'var(--sky)'} /><span style={{ fontWeight: p.you ? 700 : 600 }}>{p.name}</span></div></td>
                <td className="tnum t2 hide-mobile" style={{ textAlign: 'right' }}>{p.def}</td>
                <td className="tnum hide-mobile" style={{ textAlign: 'right', color: p.won >= 0 ? 'var(--green)' : 'var(--danger)' }}>{p.won >= 0 ? '+' : ''}{p.won}</td>
                <td className="tnum t2 hide-mobile" style={{ textAlign: 'right', color: p.borrowed ? 'var(--gold)' : 'var(--muted)' }}>−{p.borrowed}</td>
                <td className="tnum" style={{ textAlign: 'right', fontWeight: 700, color: p.score >= 0 ? 'var(--text)' : 'var(--danger)' }}>{p.score}</td>
              </tr>
            ))}
            {!board.length && (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24 }}><span className="muted">No members yet.</span></td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="card-pad tiny muted" style={{ borderTop: '1px solid var(--line)' }}>Score = winnings + default − borrowed. Borrowing lets you keep playing but pulls your score down.</div>
    </div>
  );
}

function LobbyChat({ lobbyId }: { lobbyId: number }) {
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [text, setText] = useState('');

  useEffect(() => {
    fetch(`/api/v1/lobbies/${lobbyId}/messages`)
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (j?.data) setMsgs(j.data); })
      .catch(() => {});
  }, [lobbyId]);

  const send = async () => {
    if (!text.trim()) return;
    const body = text.trim();
    setText('');
    try {
      const res = await fetch(`/api/v1/lobbies/${lobbyId}/messages`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text: body }),
      });
      if (res.ok) {
        const j = await res.json();
        if (j?.data) setMsgs(m => [...m, j.data]);
      } else {
        // optimistic local append on failure
        setMsgs(m => [...m, { who: 'You', text: body, t: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) }]);
      }
    } catch {
      setMsgs(m => [...m, { who: 'You', text: body, t: '--:--' }]);
    }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 460 }}>
      <div className="stack gap-12" style={{ flex: 1, overflowY: 'auto', padding: 18 }}>
        {msgs.length === 0 && <div className="row center"><span className="badge badge-muted" style={{ textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>No messages yet.</span></div>}
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
        <div className="row gap-6">{['👍', '😂', '😮', '💀'].map(e => <button key={e} className="chip chip-sm" onClick={() => { const t = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }); setMsgs(m => [...m, { who: 'You', text: e, t }]); }} style={{ fontSize: 16, padding: '4px 8px' }}>{e}</button>)}</div>
        <input className="input grow" placeholder="Talk trash…" value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()} />
        <Btn variant="primary" className="btn-icon" onClick={send}><Icon name="send" size={18} /></Btn>
      </div>
    </div>
  );
}

function LobbyMembers({ l, isHost, s, board, onChanged }: { l: Lobby; isHost: boolean; s: ScreenProps['s']; board: BoardRow[]; onChanged: () => void }) {
  const [members, setMembers] = useState<BoardRow[]>(board);
  const [adjust, setAdjust] = useState<{ userId: number; name: string; delta: number } | null>(null);
  useEffect(() => { setMembers(board); }, [board]);

  const submitAdjust = async () => {
    if (!adjust || !adjust.delta) return;
    try {
      const res = await fetch(`/api/v1/lobbies/${l.id}/members/${adjust.userId}/adjust`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ delta: adjust.delta }),
      });
      if (res.ok) { s.toastMsg(`${adjust.delta > 0 ? '+' : ''}${adjust.delta} pts → ${adjust.name}`, 'check', 'var(--green)'); setAdjust(null); onChanged(); }
      else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.code === 'INSUFFICIENT_BALANCE' ? 'Would go below zero' : 'Could not adjust points', 'alert', 'var(--danger)'); }
    } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
  };

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
                <Btn variant="ghost" size="sm" onClick={() => setAdjust({ userId: p.userId, name: p.name, delta: 0 })}>Set points</Btn>
                <Btn variant="ghost" size="sm" onClick={() => handleMakeHost(p.userId)}>Make host</Btn>
                <button className="btn-icon btn-ghost" onClick={() => handleKick(p.userId)}><Icon name="x" size={15} /></button>
              </div>
            : p.borrowed > 0 && !isHost ? <span className="badge badge-muted">Owes {p.borrowed}</span> : null}
        </div>
      ))}
      {!members.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No members yet.</p></div>}

      {adjust && (
        <Portal><div className="overlay" onClick={() => setAdjust(null)}>
          <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()} style={{ maxWidth: 360 }}>
            <div className="card-pad-lg">
              <div className="row between"><span className="eyebrow">Adjust points</span><button className="btn-icon" onClick={() => setAdjust(null)}><Icon name="x" size={18} /></button></div>
              <p className="small t2 mt-12" style={{ margin: '8px 0 0' }}>Grant or deduct lobby points for <b>{adjust.name}</b> (recorded in the ledger).</p>
              <div className="field mt-16">
                <label className="label">Delta (+ grant / − deduct)</label>
                <input className="input input-mono" type="number" value={adjust.delta} onChange={e => setAdjust(a => (a ? { ...a, delta: Math.trunc(+e.target.value || 0) } : a))} />
                <div className="row gap-8 mt-4">{[100, 500, -100, -500].map(d => <button key={d} className="chip chip-sm" onClick={() => setAdjust(a => (a ? { ...a, delta: d } : a))}>{d > 0 ? `+${d}` : d}</button>)}</div>
              </div>
              <Btn variant="primary" className="btn-block mt-16" disabled={!adjust.delta} onClick={submitAdjust}>{adjust.delta > 0 ? `Grant ${adjust.delta}` : `Deduct ${-adjust.delta}`} points</Btn>
            </div>
          </div>
        </div></Portal>
      )}
    </div>
  );
}

/* ---- Host: pending borrow-request approval queue ---- */
function LobbyRequests({ s, l, isHost, reqs, onRefetch }: { s: ScreenProps['s']; l: Lobby; isHost: boolean; reqs: Req[]; onRefetch: () => void }) {
  const [localReqs, setLocalReqs] = useState<Req[]>(reqs);
  useEffect(() => { setLocalReqs(reqs); }, [reqs]);

  const resolve = async (id: number, approve: boolean) => {
    const r = localReqs.find(x => x.id === id);
    if (!r) return;
    // Optimistic UI update
    setLocalReqs(rs => rs.map(x => x.id === id ? { ...x, state: approve ? 'approved' : 'declined' } : x));
    try {
      const res = await fetch(`/api/v1/lobbies/${l.id}/borrow-requests?requestId=${id}`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ approve }),
      });
      if (res.ok) {
        if (approve) s.toastMsg(`Approved ${r.amount} pts for ${r.who}`, 'check', 'var(--green)');
        else s.toastMsg(`Declined ${r.who}'s request`, 'x', 'var(--danger)');
        onRefetch();
      } else {
        // Revert
        setLocalReqs(rs => rs.map(x => x.id === id ? { ...x, state: 'pending' } : x));
        s.toastMsg('Could not process request', 'alert', 'var(--danger)');
      }
    } catch {
      setLocalReqs(rs => rs.map(x => x.id === id ? { ...x, state: 'pending' } : x));
      s.toastMsg('Network error', 'alert', 'var(--danger)');
    }
  };

  const pending = localReqs.filter(r => r.state === 'pending');

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
          <Btn variant="ghost" size="sm" onClick={() => { pending.forEach(r => resolve(r.id, true)); }}>Approve all</Btn>}
      </div>

      {localReqs.map(r => {
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
                      <Btn variant="ghost" size="sm" icon="x" onClick={() => resolve(r.id, false)}>Decline</Btn>
                      <Btn variant="gold" size="sm" icon="check" onClick={() => resolve(r.id, true)}>Approve {r.amount}</Btn>
                    </div>
                  : <span className="badge badge-muted">Awaiting host</span>}
            </div>
          </div>
        );
      })}

      {!localReqs.length && <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">No pending requests.</p></div>}
    </div>
  );
}

/* ===================== LOBBY DETAIL (isolated workspace) ===================== */
export function LobbyView({ s }: ScreenProps) {
  const lid = typeof s.param.id === 'number' ? s.param.id : Number(s.param.id);
  const [l, setL] = useState<Lobby | null>(null);
  const [isHost, setIsHost] = useState(false);
  const [board, setBoard] = useState<BoardRow[]>([]);
  const [reqs, setReqs] = useState<Req[]>([]);
  const [tab, setTab] = useState('matches');
  const [odds, setOdds] = useState<Record<number, Odds>>({});
  const [matches, setMatches] = useState<LobbyMatch[]>([]);
  const [editM, setEditM] = useState<LobbyMatch | null>(null);
  const [betSlip, setBetSlip] = useState<{ match: LobbyMatch; pick: Pick1X2; oddsVal: number } | null>(null);
  const [borrowAmt, setBorrowAmt] = useState<number | null>(null);

  // Fetch lobby detail
  const fetchDetail = useCallback(() => {
    fetch(`/api/v1/lobbies/${lid}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.data) {
          const d = j.data;
          setL(d);
          setIsHost(!!d.isHost);
          setBoard(d.board ?? []);
          const ms: LobbyMatch[] = d.matches ?? [];
          setMatches(ms);
          setOdds(prev => {
            const next = { ...prev };
            ms.forEach(m => { if (!next[m.id] && m.odds) next[m.id] = { mh: m.odds.mHome, md: m.odds.mDraw, ma: m.odds.mAway }; });
            return next;
          });
        }
      })
      .catch(() => {});
  }, [lid]);

  // Fetch borrow requests (host only)
  const fetchReqs = useCallback(() => {
    if (!isHost) return;
    fetch(`/api/v1/lobbies/${lid}/borrow-requests`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.data) setReqs(j.data.map((r: Omit<Req, 'state'>) => ({ ...r, state: 'pending' })));
      })
      .catch(() => {});
  }, [lid, isHost]);

  useEffect(() => { fetchDetail(); }, [fetchDetail]);
  useEffect(() => { if (isHost) fetchReqs(); }, [isHost, fetchReqs]);

  if (!l) {
    return (
      <div className="page fade-up">
        <button className="chip" onClick={() => s.go('lobbies')} style={{ marginBottom: 16 }}><Icon name="chevL" size={14} /> All lobbies</button>
        <div className="card card-pad-lg" style={{ textAlign: 'center' }}><p className="muted">Loading lobby…</p></div>
      </div>
    );
  }

  const saveOdds = (id: number, mh: number, md: number, ma: number) => {
    setOdds(p => ({ ...p, [id]: { mh, md, ma } }));
    setEditM(null);
    s.toastMsg('Lobby odds updated for this match', 'check', 'var(--sky)');
    fetch(`/api/v1/lobbies/${lid}/odds`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId: id, mHome: mh, mDraw: md, mAway: ma }),
    })
      .then(r => r.ok ? fetch(`/api/v1/lobbies/${lid}/odds`) : null)
      .then(r => (r && r.ok ? r.json() : null))
      .then(j => {
        if (j?.data) {
          setOdds(prev => {
            const next = { ...prev };
            for (const [mid, o] of Object.entries(j.data as Record<string, { mHome: number; mDraw: number; mAway: number }>)) {
              next[Number(mid)] = { mh: o.mHome, md: o.mDraw, ma: o.mAway };
            }
            return next;
          });
        }
      })
      .catch(() => {});
  };

  const openSlip = (m: LobbyMatch, pick: Pick1X2, oddsVal: number) => setBetSlip({ match: m, pick, oddsVal });
  const confirmSlip = (stake: number) => {
    if (!betSlip) return;
    const { match, pick } = betSlip;
    fetch(`/api/v1/lobbies/${lid}/predictions`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ matchId: match.id, outcome: pick, stake }),
    }).then(async r => {
      const j = await r.json().catch(() => ({}));
      if (r.ok) { s.toastMsg(`Lobby bet placed · ${stake} on ${pick}`, 'check', 'var(--green)'); setBetSlip(null); fetchDetail(); }
      else {
        const c = j?.error?.code;
        s.toastMsg(c === 'ALREADY_BET_OUTCOME' ? 'You already bet that outcome' : c === 'INSUFFICIENT_BALANCE' ? 'Not enough lobby points' : c === 'BET_LOCKED' ? 'Betting closed for this match' : 'Bet failed', 'alert', 'var(--danger)');
      }
    }).catch(() => s.toastMsg('Network error', 'alert', 'var(--danger)'));
  };

  const pendingCount = reqs.filter(r => r.state === 'pending').length;

  const tabs: [string, string][] = [
    ['matches', `Matches · ${matches.length}`],
    ['board', 'Standings'],
    ['chat', 'Chat'],
    ['requests', 'Requests'],
    ['members', 'Members'],
  ];

  const myRank = board.find(r => r.you)?.rank ?? null;
  const myScore = board.find(r => r.you)?.score ?? 0;
  const myBalance = board.find(r => r.you)?.balance ?? 0;
  const myBorrowed = board.find(r => r.you)?.borrowed ?? 0;

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
            <Btn variant="ghost" size="sm" icon="share" onClick={async () => {
              const link = `${window.location.origin}/?join=${l.code}`;
              try { await navigator.clipboard.writeText(link); s.toastMsg('Invite link copied!', 'check', 'var(--green)'); }
              catch { s.toastMsg(`Invite link: ${link}`, 'share'); }
            }}>Invite</Btn>
            {!isHost && l.borrow && <Btn variant="gold" size="sm" icon="wallet" onClick={() => setBorrowAmt(200)}>Borrow</Btn>}
          </div>
        </div>
        {/* lobby wallet strip — wallet = default + winnings + borrowed (spendable); score = default + winnings − borrowed (rank) */}
        <div className="row gap-20 mt-16 wrap-w">
          <div className="stat"><span className="s-val tnum text-gold" style={{ fontSize: 22 }}>{myBalance.toLocaleString()}</span><span className="s-lbl">Lobby wallet{myBorrowed > 0 ? ` (incl. ${myBorrowed} borrowed)` : ''}</span></div>
          <div className="stat"><span className="s-val tnum text-green" style={{ fontSize: 22 }}>{myScore.toLocaleString()}</span><span className="s-lbl">Score</span></div>
          <div className="stat"><span className="s-val tnum" style={{ fontSize: 22 }}>{myRank != null ? `#${myRank}` : '—'}</span><span className="s-lbl">Your rank</span></div>
        </div>
      </div>

      <div className="row gap-8 mt-16" style={{ overflowX: 'auto' }}>
        {tabs.map(([k, lbl]) =>
          <button key={k} className={`chip ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>
            {lbl}
            {k === 'requests' && isHost && pendingCount > 0 &&
              <span className="badge badge-gold" style={{ padding: '1px 7px', marginLeft: 2 }}>{pendingCount}</span>}
          </button>)}
      </div>

      <div className="mt-16">
        {tab === 'matches' && <LobbyMatches ownerName={l.owner} matches={matches} isHost={isHost} odds={odds} onEdit={setEditM} onBet={openSlip} />}
        {tab === 'board' && <LobbyBoard board={board} />}
        {tab === 'chat' && <LobbyChat lobbyId={lid} />}
        {tab === 'requests' && <LobbyRequests s={s} l={l} isHost={isHost} reqs={reqs} onRefetch={fetchReqs} />}
        {tab === 'members' && <LobbyMembers l={l} isHost={isHost} s={s} board={board} onChanged={fetchDetail} />}
      </div>

      {editM && <LobbyOddsModal m={editM} odds={odds[editM.id] || (editM.odds ? { mh: editM.odds.mHome, md: editM.odds.mDraw, ma: editM.odds.mAway } : { mh: 1.5, md: 2, ma: 2.5 })} onClose={() => setEditM(null)} onSave={saveOdds} />}
      {betSlip && <LobbyBetSlip match={betSlip.match} pick={betSlip.pick} oddsVal={betSlip.oddsVal} balance={myBalance} onClose={() => setBetSlip(null)} onConfirm={confirmSlip} />}
      {borrowAmt !== null && (
        <Portal><div className="overlay" onClick={() => setBorrowAmt(null)}>
          <div className="modal" onClick={(e: React.MouseEvent) => e.stopPropagation()}>
            <div className="card-pad-lg">
              <div className="row between"><span className="eyebrow">Borrow points</span><button className="btn-icon" onClick={() => setBorrowAmt(null)}><Icon name="x" size={18} /></button></div>
              <p className="t2 small mt-12">Request points from the host to keep betting. The host must approve.</p>
              <div className="field mt-16">
                <div className="row between"><label className="label">Amount</label><span className="tnum text-gold" style={{ fontWeight: 700 }}>{borrowAmt}</span></div>
                <input type="range" min={50} max={1000} step={50} value={borrowAmt} onChange={e => setBorrowAmt(+e.target.value)} style={{ width: '100%', accentColor: 'var(--gold)' }} />
              </div>
              <Btn variant="gold" size="lg" className="btn-block mt-16" onClick={async () => {
                try {
                  const res = await fetch(`/api/v1/lobbies/${lid}/borrow`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ amount: borrowAmt }) });
                  if (res.ok) { s.toastMsg('Borrow request sent to the host', 'check', 'var(--gold)'); setBorrowAmt(null); }
                  else { const j = await res.json().catch(() => ({})); s.toastMsg(j?.error?.code === 'NOT_A_MEMBER' ? 'Join the lobby first' : 'Could not send request', 'alert', 'var(--danger)'); }
                } catch { s.toastMsg('Network error', 'alert', 'var(--danger)'); }
              }}>Request {borrowAmt} points</Btn>
            </div>
          </div>
        </div></Portal>
      )}
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
