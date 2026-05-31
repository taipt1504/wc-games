'use client';
/* GOLAZO — News list · Article (ported from design screens-news.jsx) */
import React, { useState, useEffect } from 'react';
import { WC } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, SecHead } from '@/components/ui';

type NewsItem = {
  id: number;
  tag: string;
  title: string;
  src: string;
  time: string;
  excerpt: string;
  hot?: boolean;
  match?: number;
};

const news = WC.news as NewsItem[];

const TAGS = ['All', 'Match Preview', 'Squad News', 'Analysis', 'Transfer Buzz', 'Result', 'Off-pitch'];

/* ===================== NEWS ===================== */
export function News({ s }: ScreenProps) {
  const [tag, setTag] = useState('All');
  const [items, setItems] = useState<NewsItem[]>(news);
  useEffect(() => {
    fetch('/api/v1/news')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data?.length) setItems(j.data as NewsItem[]); })
      .catch(() => {});
  }, []);
  const list = items.filter(n => tag === 'All' || n.tag === tag);
  const lead = list[0];
  return (
    <div className="page fade-up">
      <SecHead title="World Cup wire" sub="AI-assisted coverage, reviewed by editors before publishing" />
      <div className="row gap-8 wrap-w" style={{ marginBottom: 18 }}>
        {TAGS.map(t => (
          <button key={t} className={`chip ${tag === t ? 'active' : ''}`} onClick={() => setTag(t)}>{t}</button>
        ))}
      </div>

      {lead && (
        <div
          className="panel card-pad-lg card-hover pointer"
          style={{ marginBottom: 18, background: 'linear-gradient(140deg, var(--sky-soft), transparent)' }}
          onClick={() => s.go('article', { id: lead.id })}
        >
          <div className="row between">
            <span className="badge badge-sky">{lead.tag}</span>
            {lead.hot && <span className="badge badge-magenta">Trending</span>}
          </div>
          <h2 className="h2 mt-12" style={{ maxWidth: 640 }}>{lead.title}</h2>
          <p className="t2 mt-8" style={{ maxWidth: 620 }}>{lead.excerpt}</p>
          <div className="row gap-12 mt-16 tiny muted">
            <span>Source · {lead.src}</span><span>·</span><span>{lead.time}</span>
            <span className="badge badge-muted">✨ AI-assisted</span>
          </div>
        </div>
      )}

      <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {list.slice(1).map(n => (
          <div key={n.id} className="card card-pad card-hover pointer" onClick={() => s.go('article', { id: n.id })}>
            <div style={{ height: 110, borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
              <Icon name="news" size={30} className="muted" />
            </div>
            <span className="badge badge-muted">{n.tag}</span>
            <div className="h3 mt-8" style={{ fontSize: 16 }}>{n.title}</div>
            <div className="row gap-8 mt-8 tiny muted"><span>{n.src}</span><span>·</span><span>{n.time}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ===================== ARTICLE ===================== */
export function Article({ s }: ScreenProps) {
  const [live, setLive] = useState<NewsItem[]>([]);
  useEffect(() => {
    fetch('/api/v1/news')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setLive(j.data as NewsItem[]); })
      .catch(() => {});
  }, []);
  const id = s.param.id as number;
  const n = live.find(x => x.id === id) ?? news.find(x => x.id === id) ?? news[0];
  return (
    <div className="page page-narrow fade-up">
      <button className="chip" onClick={() => s.back()} style={{ marginBottom: 16 }}>
        <Icon name="chevL" size={14} /> Back to wire
      </button>
      <span className="badge badge-sky">{n.tag}</span>
      <h1 className="h1 mt-12">{n.title}</h1>
      <div className="row gap-12 mt-12 tiny muted">
        <span>Source · {n.src}</span><span>·</span><span>{n.time}</span>
        <span className="badge badge-muted">✨ AI-assisted</span>
      </div>

      <div style={{ height: 200, borderRadius: 'var(--r-lg)', background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', display: 'grid', placeItems: 'center', margin: '20px 0' }}>
        <Icon name="news" size={44} className="muted" />
      </div>

      <div className="stack gap-16" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-2)' }}>
        <p>{n.excerpt}</p>
        <p>With the first multi-host World Cup now in full swing across the United States, Canada and Mexico, every result is reshaping the projected knockout picture. Coaches are juggling a longer group stage and the new 48-team math, where goal difference matters from the very first whistle.</p>
        <p>Analysts point to squad depth as the deciding factor over a tournament this size. The teams managing minutes smartly through the group phase look best placed for the gauntlet ahead.</p>
      </div>

      {n.match && (
        <div className="card card-pad mt-24 row between wrap gap-12" style={{ background: 'linear-gradient(120deg,var(--green-soft),transparent)' }}>
          <div className="row gap-12">
            <Icon name="ball" size={20} style={{ color: 'var(--green)' }} />
            <span style={{ fontWeight: 600 }}>This story is about an upcoming match.</span>
          </div>
          <Btn variant="primary" size="sm" onClick={() => s.go('match', { id: n.match })}>Bet this match →</Btn>
        </div>
      )}

      <div className="card-2 card-pad mt-16 tiny muted" style={{ borderRadius: 'var(--r-sm)' }}>
        This article was summarized and rewritten by AI from the cited source, then reviewed by an editor before publishing. We link sources and never copy text verbatim.
      </div>
    </div>
  );
}
