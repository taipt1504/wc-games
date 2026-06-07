'use client';
/* ============================================================
   GOLAZO — shared primitives (ported from design components.jsx)
   Icon · Flag · Avatar · Btn · Pundit (Ora) · Spark · OddsRow · MatchCard · etc.
   ============================================================ */
import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { byId, type Team } from '@/lib/wc';

/**
 * Render children at document.body — escapes transformed/animated ancestors (e.g. `.fade-up`)
 * that would otherwise trap a position:fixed overlay. Use for modals inside animated pages.
 */
export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

/* ---------------- ICONS ---------------- */
export const ICONS: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9',
  ball: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4 3 2.2-1.2 3.6h-3.6L9 9.2 12 7Z',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z',
  trophy: 'M7 4h10v3a5 5 0 0 1-10 0V4ZM5 5H3v2a3 3 0 0 0 3 3M19 5h2v2a3 3 0 0 1-3 3M9 14h6M12 14v4M9 20h6',
  users: 'M16 18v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM17 11a3 3 0 1 0-1.5-5.6M21 18v-1a4 4 0 0 0-3-3.8',
  news: 'M4 5h13a1 1 0 0 1 1 1v12a2 2 0 0 0 2-2V8M4 5a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2h13M7 9h7M7 13h7M7 17h4',
  wallet: 'M3 7a2 2 0 0 1 2-2h12v3M3 7v10a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-3M3 7h16a1 1 0 0 1 1 1v3m0 0h-4a2 2 0 0 0 0 4h4',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM5 20a7 7 0 0 1 14 0',
  bracket: 'M4 4v6a2 2 0 0 0 2 2h4M4 20v-6a2 2 0 0 1 2-2h4M14 12h6M20 12V7M20 12v5',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  sparkles: 'M12 3l1.8 4.8L18.5 9l-4.7 1.2L12 15l-1.8-4.8L5.5 9l4.7-1.2L12 3ZM18 14l.8 2.1 2.2.6-2.2.6L18 20l-.8-2.7-2.2-.6 2.2-.6L18 14Z',
  fire: 'M12 3c1 3-1.5 4.5-1.5 7A3 3 0 0 0 13 13c.5-1.2 0-2.5 0-2.5 2 1.3 3 3 3 5a4 4 0 0 1-8 0c0-3 1.5-4 1.5-6.5C9 6.5 11 4.5 12 3Z',
  flame: 'M12 3c1 3-1.5 4.5-1.5 7A3 3 0 0 0 13 13c.5-1.2 0-2.5 0-2.5 2 1.3 3 3 3 5a4 4 0 0 1-8 0c0-3 1.5-4 1.5-6.5C9 6.5 11 4.5 12 3Z',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  check: 'M5 12l5 5 9-11',
  x: 'M6 6l12 12M18 6 6 18',
  chevR: 'M9 6l6 6-6 6',
  chevL: 'M15 6l-6 6 6 6',
  chevD: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM21 21l-4.3-4.3',
  filter: 'M3 5h18M6 12h12M10 19h4',
  share: 'M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14',
  trending: 'M3 17l6-6 4 4 8-8M21 7v5h-5',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  zap: 'M13 2 4 14h7l-1 8 9-12h-7l1-8Z',
  coins: 'M9 14a6 6 0 1 0 0-12 6 6 0 0 0 0 12ZM9 8h.01M16 22a6 6 0 1 0 0-12 6 6 0 0 0 0 12Z',
  lock: 'M6 10V8a6 6 0 1 1 12 0v2M5 10h14a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1Z',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z',
  flag: 'M5 21V4M5 4c3-2 7 2 10 0v9c-3 2-7-2-10 0',
  whistle: 'M3 14a5 5 0 1 0 10 0 5 5 0 0 0-10 0ZM13 12l8-3-1 5M11 9V5h3',
  send: 'M4 12l16-8-6 16-3-6-7-2Z',
  arrowR: 'M5 12h14M13 6l6 6-6 6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
  dollar: 'M12 2v20M17 6.5C17 4.5 14.8 4 12 4S7 4.8 7 7s2.5 3 5 3.5 5 1.2 5 3.5-2.2 3-5 3-5-.5-5-2.5',
  edit: 'M4 20h4l11-11a2 2 0 0 0-3-3L5 17v3ZM14 6l3 3',
  gauge: 'M12 14l3-3M21 13a9 9 0 1 0-18 0M12 14a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z',
  alert: 'M12 9v4M12 17h.01M10.3 4 2.6 17a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4a2 2 0 0 0-3.4 0Z',
  database: 'M12 3c5 0 8 1.5 8 3s-3 3-8 3-8-1.5-8-3 3-3 8-3ZM4 6v6c0 1.5 3 3 8 3s8-1.5 8-3V6M4 12v6c0 1.5 3 3 8 3s8-1.5 8-3v-6',
  refresh: 'M21 12a9 9 0 1 1-2.6-6.3M21 4v5h-5',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7ZM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z',
  'eye-off': 'M3 3l18 18M10.6 10.6a3 3 0 0 0 4.2 4.2M9.4 5.2A9.5 9.5 0 0 1 12 5c6 0 10 7 10 7a17.3 17.3 0 0 1-3.3 3.9M6.2 6.3A17 17 0 0 0 2 12s4 7 10 7a9.4 9.4 0 0 0 3-.5',
  ban: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM5.6 5.6l12.8 12.8',
  star: 'M12 3l2.6 6.3 6.8.5-5.2 4.4 1.6 6.6L12 17.8 6.2 21.3l1.6-6.6L2.6 9.8l6.8-.5L12 3Z',
};

export function Icon({ name, size = 20, sw = 1.8, fill, style, className }: {
  name: string; size?: number; sw?: number; fill?: string; style?: React.CSSProperties; className?: string;
}) {
  const d = ICONS[name] || ICONS.ball;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" className={className} style={style}
      fill={fill || 'none'} stroke={fill ? 'none' : 'currentColor'}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

/* ---------------- FLAG CREST ---------------- */
// Renders a real flag image when `flagUrl` is given (real DB data), else the 3-stripe
// colors crest from a WC mock Team. Both forms supported so de-mocked screens can pass
// flagUrl while mock-backed screens keep passing `team` unchanged.
export function Flag({ team, flagUrl, name, code, size = 32, showCode }: {
  team?: Team | number; flagUrl?: string; name?: string; code?: string; size?: number; showCode?: boolean;
}) {
  if (flagUrl) {
    return (
      <div className="row gap-8" style={{ minWidth: 0 }}>
        <img src={flagUrl} alt={name ?? code ?? ''} title={name} width={size} height={size}
          style={{ width: size, height: size, objectFit: 'cover', borderRadius: 4, display: 'block', flex: 'none' }} />
        {showCode && code && <span className="flag-code" style={{ fontSize: size * 0.42 }}>{code}</span>}
      </div>
    );
  }
  const t = typeof team === 'number' ? byId(team) : team;
  if (!t) return null;
  const c = t.colors;
  return (
    <div className="row gap-8" style={{ minWidth: 0 }}>
      <div className="flag" style={{ width: size, height: size }} title={t.name}>
        <span style={{ background: c[0] }} /><span style={{ background: c[1] }} /><span style={{ background: c[2] }} />
      </div>
      {showCode && <span className="flag-code" style={{ fontSize: size * 0.42 }}>{t.code}</span>}
    </div>
  );
}

/* ---------------- AVATAR ---------------- */
export function Avatar({ initials, size = 40, color = 'var(--sky)', ring }: {
  initials: string; size?: number; color?: string; ring?: string;
}) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flex: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: `linear-gradient(135deg, ${color}, var(--surface-3))`,
      fontFamily: 'var(--f-display)', fontWeight: 800, fontSize: size * 0.38, color: '#fff',
      border: ring ? `2px solid ${ring}` : '1px solid var(--line-strong)',
    }}>{initials}</div>
  );
}

/* ---------------- BUTTON ---------------- */
type BtnProps = {
  variant?: 'primary' | 'gold' | 'ghost' | 'outline' | 'danger';
  size?: 'lg' | 'sm';
  icon?: string;
  iconR?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Btn({ variant = 'primary', size, icon, iconR, children, className = '', ...p }: BtnProps) {
  const cls = `btn btn-${variant} ${size ? 'btn-' + size : ''} ${className}`.trim();
  return (
    <button className={cls} {...p}>
      {icon && <Icon name={icon} size={size === 'lg' ? 20 : 17} />}
      {children}
      {iconR && <Icon name={iconR} size={size === 'lg' ? 20 : 17} />}
    </button>
  );
}

/* ---------------- PUNDIT MASCOT (ORA) ---------------- */
export function Pundit({ size = 56, mood = 'idle', glow }: { size?: number; mood?: 'idle' | 'happy' | 'think'; glow?: boolean }) {
  return (
    <div className="rel" style={{ width: size, height: size, flex: 'none' }}>
      {glow && <div className="abs" style={{ inset: -6, borderRadius: '50%', background: 'radial-gradient(circle, rgba(63,192,240,.45), transparent 70%)', filter: 'blur(4px)' }} />}
      <svg viewBox="0 0 64 64" width={size} height={size} className="rel">
        <defs>
          <linearGradient id="puBody" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2C3E63" /><stop offset="1" stopColor="#16213B" />
          </linearGradient>
        </defs>
        <path d="M32 8c12 0 19 8 19 21 0 14-8 27-19 27S13 43 13 29C13 16 20 8 32 8Z" fill="url(#puBody)" stroke="#3FC0F0" strokeWidth="2" />
        <ellipse cx="32" cy="40" rx="11" ry="13" fill="#0B1120" opacity=".55" />
        <path d="M20 13l3 7-7-2Z" fill="#3FC0F0" /><path d="M44 13l-3 7 7-2Z" fill="#3FC0F0" />
        <circle cx="25" cy="27" r="8" fill="#0B1120" /><circle cx="39" cy="27" r="8" fill="#0B1120" />
        <circle cx={mood === 'think' ? 27 : 25} cy="27" r="3.4" fill="#2BE08A" />
        <circle cx={mood === 'think' ? 41 : 39} cy="27" r="3.4" fill="#2BE08A" />
        {mood === 'happy'
          ? <path d="M29 36q3 4 6 0" stroke="#FFC83D" strokeWidth="2.5" fill="none" strokeLinecap="round" />
          : <path d="M32 34l3 4h-6Z" fill="#FFC83D" />}
        <path d="M16 27a16 16 0 0 1 32 0" stroke="#FFC83D" strokeWidth="2.4" fill="none" />
        <rect x="13" y="26" width="5" height="9" rx="2" fill="#FFC83D" />
        <rect x="46" y="26" width="5" height="9" rx="2" fill="#FFC83D" />
        <path d="M48 33q3 6-3 9h-4" stroke="#FFC83D" strokeWidth="2" fill="none" />
        <circle cx="40" cy="44" r="2.4" fill="#FF4D8D" />
      </svg>
    </div>
  );
}

/* ---------------- SPARKLINE ---------------- */
export function Spark({ data, w = 80, h = 28, color = 'var(--green)' }: { data: number[]; w?: number; h?: number; color?: string }) {
  const max = Math.max(...data), min = Math.min(...data);
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((v - min) / (max - min || 1)) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ---------------- SECTION HEADER ---------------- */
export function SecHead({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="row between" style={{ marginBottom: 14 }}>
      <div>
        <div className="h3">{title}</div>
        {sub && <div className="small muted" style={{ marginTop: 2 }}>{sub}</div>}
      </div>
      {action}
    </div>
  );
}

/* ---------------- TIER PILL ---------------- */
export const TIER_C: Record<string, string> = { Legend: '#FF4D8D', Diamond: '#3FC0F0', Platinum: '#9B7DFF', Gold: '#FFC83D', Silver: '#AEB8D0', Bronze: '#c08457' };
export function TierPill({ tier }: { tier: string }) {
  return (
    <span className="badge" style={{ background: 'transparent', border: `1px solid ${TIER_C[tier]}55`, color: TIER_C[tier] }}>
      <span className="dot" style={{ background: TIER_C[tier] }} />{tier}
    </span>
  );
}

/* ---------------- TOAST ---------------- */
export interface ToastData { msg: string; icon?: string; color?: string }
export function Toast({ toast }: { toast: ToastData | null }) {
  if (!toast) return null;
  return (
    <div className="scale-in" style={{
      position: 'fixed', bottom: 92, left: '50%', transform: 'translateX(-50%)', zIndex: 200,
      background: 'var(--surface-2)', border: '1px solid var(--line-strong)', borderRadius: 'var(--r-pill)',
      padding: '12px 20px', boxShadow: 'var(--sh-3)', display: 'flex', alignItems: 'center', gap: 10,
    }}>
      <Icon name={toast.icon || 'check'} size={18} style={{ color: toast.color || 'var(--green)' }} />
      <span style={{ fontWeight: 600, fontSize: 14 }}>{toast.msg}</span>
    </div>
  );
}
