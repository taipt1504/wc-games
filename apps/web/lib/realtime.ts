import { useEffect } from 'react';

/* Client realtime: one shared EventSource to /api/v1/stream, dispatching events to handlers by type. */
type RtEvent = { type: string; [k: string]: unknown };
type Handler = (ev: RtEvent) => void;

const handlers = new Map<string, Set<Handler>>();
let es: EventSource | null = null;

export function openRealtime() {
  if (es || typeof window === 'undefined') return;
  es = new EventSource('/api/v1/stream');
  es.onmessage = (m) => {
    try {
      const ev = JSON.parse(m.data) as RtEvent;
      handlers.get(ev.type)?.forEach((h) => h(ev));
    } catch { /* ignore heartbeat / malformed frame */ }
  };
  es.onerror = () => { /* EventSource auto-reconnects */ };
}

export function closeRealtime() {
  es?.close();
  es = null;
}

export function onRealtime(type: string, h: Handler): () => void {
  if (!handlers.has(type)) handlers.set(type, new Set());
  handlers.get(type)!.add(h);
  return () => { handlers.get(type)?.delete(h); };
}

export function useRealtime(type: string, h: Handler) {
  useEffect(() => onRealtime(type, h), [type, h]);
}
