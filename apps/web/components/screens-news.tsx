'use client';
/* World Cup Games — News list · Article (ported from design screens-news.jsx) */
import React, { useState, useEffect } from 'react';
import { WC } from '@/lib/wc';
import type { ScreenProps } from '@/lib/store';
import { Btn, Icon, SecHead } from '@/components/ui';
import { useT } from '@/lib/i18n/hooks';

type NewsItem = {
  id: number;
  tag: string;
  title: string;
  src: string;
  time: string;
  excerpt: string;
  body?: string;
  hot?: boolean;
  match?: number;
};

// Tag values stay English — they are the canonical filter keys matched against the feed's `tag`
// field. Only the on-screen label is translated via TAG_KEYS below.
const TAGS = ['All', 'Match Preview', 'Squad News', 'Analysis', 'Transfer Buzz', 'Result', 'Off-pitch'];
const TAG_KEYS: Record<string, string> = {
  'All': 'news.tagAll', 'Match Preview': 'news.tagPreview', 'Squad News': 'news.tagSquad',
  'Analysis': 'news.tagAnalysis', 'Transfer Buzz': 'news.tagTransfer', 'Result': 'news.tagResult', 'Off-pitch': 'news.tagOff',
};

/* ===================== NEWS ===================== */
export function News({ s }: ScreenProps) {
  const { t, locale } = useT();
  const tagLabel = (tag: string) => (TAG_KEYS[tag] ? t(TAG_KEYS[tag]) : tag);
  const [tag, setTag] = useState('All');
  const [items, setItems] = useState<NewsItem[]>(WC.news as NewsItem[]);
  useEffect(() => {
    fetch(`/api/v1/news?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setItems(j.data as NewsItem[]); })
      .catch(() => {});
  }, [locale]);
  const list = items.filter(n => tag === 'All' || n.tag === tag);
  const lead = list[0] ?? null;
  return (
    <div className="page fade-up">
      <SecHead title={t('news.wireTitle')} sub={t('news.wireSub')} />
      <div className="row gap-8 wrap-w" style={{ marginBottom: 18 }}>
        {TAGS.map(tg => (
          <button key={tg} className={`chip ${tag === tg ? 'active' : ''}`} onClick={() => setTag(tg)}>{tagLabel(tg)}</button>
        ))}
      </div>

      {list.length === 0 && (
        <p className="muted" style={{ margin: '32px 0' }}>{t('news.empty')}</p>
      )}

      {lead && (
        <div
          className="panel card-pad-lg card-hover pointer"
          style={{ marginBottom: 18, background: 'linear-gradient(140deg, var(--sky-soft), transparent)' }}
          onClick={() => s.go('article', { id: lead.id })}
        >
          <div className="row between">
            <span className="badge badge-sky">{tagLabel(lead.tag)}</span>
            {lead.hot && <span className="badge badge-magenta">{t('news.trending')}</span>}
          </div>
          <h2 className="h2 mt-12" style={{ maxWidth: 640 }}>{lead.title}</h2>
          <p className="t2 mt-8" style={{ maxWidth: 620 }}>{lead.excerpt}</p>
          <div className="row gap-12 mt-16 tiny muted">
            <span>{t('news.source')} · {lead.src}</span><span>·</span><span>{lead.time}</span>
            <span className="badge badge-muted">{t('news.aiAssisted')}</span>
          </div>
        </div>
      )}

      <div className="grid gap-14" style={{ gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))' }}>
        {list.slice(1).map(n => (
          <div key={n.id} className="card card-pad card-hover pointer" onClick={() => s.go('article', { id: n.id })}>
            <div style={{ height: 110, borderRadius: 'var(--r-sm)', background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', display: 'grid', placeItems: 'center', marginBottom: 14 }}>
              <Icon name="news" size={30} className="muted" />
            </div>
            <span className="badge badge-muted">{tagLabel(n.tag)}</span>
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
  const { t, locale } = useT();
  const tagLabel = (tag: string) => (TAG_KEYS[tag] ? t(TAG_KEYS[tag]) : tag);
  const [live, setLive] = useState<NewsItem[]>([]);
  useEffect(() => {
    fetch(`/api/v1/news?locale=${locale}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.data) setLive(j.data as NewsItem[]); })
      .catch(() => {});
  }, [locale]);
  const id = s.param.id as number;
  const n = live.find(x => x.id === id) ?? (WC.news as NewsItem[]).find(x => x.id === id) ?? null;

  if (!n) {
    return (
      <div className="page page-narrow fade-up">
        <button className="chip" onClick={() => s.back()} style={{ marginBottom: 16 }}>
          <Icon name="chevL" size={14} /> {t('news.backToWire')}
        </button>
        <p className="muted">{t('news.notFound')}</p>
      </div>
    );
  }

  return (
    <div className="page page-narrow fade-up">
      <button className="chip" onClick={() => s.back()} style={{ marginBottom: 16 }}>
        <Icon name="chevL" size={14} /> {t('news.backToWire')}
      </button>
      <span className="badge badge-sky">{tagLabel(n.tag)}</span>
      <h1 className="h1 mt-12">{n.title}</h1>
      <div className="row gap-12 mt-12 tiny muted">
        <span>{t('news.source')} · {n.src}</span><span>·</span><span>{n.time}</span>
        <span className="badge badge-muted">{t('news.aiAssisted')}</span>
      </div>

      <div style={{ height: 200, borderRadius: 'var(--r-lg)', background: 'linear-gradient(135deg, var(--surface-2), var(--surface-3))', display: 'grid', placeItems: 'center', margin: '20px 0' }}>
        <Icon name="news" size={44} className="muted" />
      </div>

      <div className="stack gap-16" style={{ fontSize: 16, lineHeight: 1.7, color: 'var(--text-2)' }}>
        {(n.body || n.excerpt || '').split(/\n\s*\n/).map((para, i) => para.trim() && <p key={i}>{para.trim()}</p>)}
      </div>

      {n.match && (
        <div className="card card-pad mt-24 row between wrap gap-12" style={{ background: 'linear-gradient(120deg,var(--green-soft),transparent)' }}>
          <div className="row gap-12">
            <Icon name="ball" size={20} style={{ color: 'var(--green)' }} />
            <span style={{ fontWeight: 600 }}>{t('news.aboutMatch')}</span>
          </div>
          <Btn variant="primary" size="sm" onClick={() => s.go('match', { id: n.match })}>{t('news.betMatch')}</Btn>
        </div>
      )}

      <div className="card-2 card-pad mt-16 tiny muted" style={{ borderRadius: 'var(--r-sm)' }}>
        {t('news.disclaimer')}
      </div>
    </div>
  );
}
