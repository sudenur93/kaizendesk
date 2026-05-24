import { useCallback, useState } from 'react';

export const STATUS = {
  NEW: { label: 'Yeni', key: 's-new' },
  IN_PROGRESS: { label: 'İşlemde', key: 's-progress' },
  WAITING_FOR_CUSTOMER: { label: 'Müşteri Bekleniyor', key: 's-waiting' },
  RESOLVED: { label: 'Çözüldü', key: 's-resolved' },
  CLOSED: { label: 'Kapatıldı', key: 's-closed' },
};

export const STATUS_ORDER = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];

export const PRIORITY = {
  LOW: { label: 'Düşük', key: 'p-low' },
  MEDIUM: { label: 'Orta', key: 'p-medium' },
  HIGH: { label: 'Yüksek', key: 'p-high' },
  CRITICAL: { label: 'Kritik', key: 'p-critical' },
};

export const PRIORITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

export function StatusBadge({ status }) {
  const meta = STATUS[status] || { label: status, key: 's-new' };
  return (
    <span className={'badge ' + meta.key}>
      <span className="pip" />
      {meta.label}
    </span>
  );
}

export function PriorityBadge({ priority }) {
  const meta = PRIORITY[priority] || { label: priority, key: 'p-low' };
  return <span className={'badge ' + meta.key}>{meta.label}</span>;
}

export function Avatar({ initials, size = '' }) {
  return <span className={'av ' + (size ? 'av-' + size : '')}>{initials || '?'}</span>;
}

export function getInitials(name) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function fmtDate(value, opt = 'short') {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  if (opt === 'rel') {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (Math.abs(diff) < 60) return 'şimdi';
    if (Math.abs(diff) < 3600) return Math.round(diff / 60) + ' dk önce';
    if (Math.abs(diff) < 86400) return Math.round(diff / 3600) + ' saat önce';
    if (Math.abs(diff) < 86400 * 7) return Math.round(diff / 86400) + ' gün önce';
    return d.toLocaleDateString('tr-TR');
  }
  if (opt === 'datetime') {
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleDateString('tr-TR', { day: '2-digit', month: 'short' });
}

export function slaInfo(ticket) {
  if (!ticket?.slaTargetAt) {
    return { state: 'ok', remain: 0, elapsed: 0 };
  }
  const target = new Date(ticket.slaTargetAt).getTime();
  const created = ticket.createdAt ? new Date(ticket.createdAt).getTime() : Date.now();
  const total = Math.max(1, target - created);
  const now = Date.now();
  const remain = target - now;
  const elapsed = Math.max(0, Math.min(1, (now - created) / total));
  let state = 'ok';
  if (remain < 0) state = 'bad';
  else if (remain < total * 0.2) state = 'warn';
  if (['RESOLVED', 'CLOSED'].includes(ticket.status)) state = 'ok';
  return { state, remain, elapsed };
}

export function fmtRemain(min) {
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (abs < 60) return `${m}dk${min < 0 ? ' gec' : ''}`;
  if (h < 24) return `${h}sa ${m}dk${min < 0 ? ' gec' : ''}`;
  return `${Math.floor(h / 24)}g ${h % 24}sa${min < 0 ? ' gec' : ''}`;
}

export function SlaBar({ ticket }) {
  const info = slaInfo(ticket);
  const remainMin = Math.round(info.remain / 60000);
  return (
    <div className={'sla ' + info.state}>
      <div className="sla-bar">
        <div style={{ width: (Math.min(1, info.elapsed) * 100).toFixed(0) + '%' }} />
      </div>
      <span className="sla-time">{ticket?.slaTargetAt ? fmtRemain(remainMin) : '-'}</span>
    </div>
  );
}

/* ── Skeleton loading ── */
export function Skeleton({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'var(--bg-soft)',
      animation: 'skeleton-pulse 1.4s ease-in-out infinite',
      ...style,
    }} />
  );
}

export function SkeletonCard({ rows = 3 }) {
  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton width="40%" height={14} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} width={i === rows - 1 ? '60%' : '100%'} height={12} />
      ))}
    </div>
  );
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{
          display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: 16, padding: '12px 16px',
          borderBottom: '1px solid var(--hairline)',
        }}>
          {Array.from({ length: cols }).map((_, j) => (
            <Skeleton key={j} height={12} width={j === 0 ? '80%' : '60%'} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* ── Empty State ── */
const EMPTY_ILLUSTRATIONS = {
  tickets: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <rect x="12" y="18" width="56" height="44" rx="6" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
      <rect x="20" y="30" width="24" height="3" rx="1.5" fill="var(--text-4)"/>
      <rect x="20" y="38" width="40" height="3" rx="1.5" fill="var(--text-4)"/>
      <rect x="20" y="46" width="32" height="3" rx="1.5" fill="var(--text-4)"/>
      <rect x="28" y="10" width="24" height="8" rx="4" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
      <circle cx="40" cy="14" r="2" fill="var(--text-4)"/>
    </svg>
  ),
  search: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="36" cy="36" r="18" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
      <line x1="49" y1="49" x2="64" y2="64" stroke="var(--hairline)" strokeWidth="3" strokeLinecap="round"/>
      <line x1="30" y1="30" x2="42" y2="42" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round"/>
      <line x1="42" y1="30" x2="30" y2="42" stroke="var(--text-4)" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  ),
  done: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="26" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
      <path d="M28 40l8 8 16-16" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  team: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="28" r="12" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
      <path d="M16 62c0-13.255 10.745-24 24-24s24 10.745 24 24" stroke="var(--hairline)" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="62" cy="24" r="8" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
      <circle cx="18" cy="24" r="8" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
    </svg>
  ),
  sla: (
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
      <circle cx="40" cy="40" r="26" fill="var(--bg-soft)" stroke="var(--hairline)" strokeWidth="1.5"/>
      <path d="M40 26v14l8 8" stroke="var(--ok)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

export function EmptyState({ type = 'tickets', title, sub, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', gap: 12, textAlign: 'center',
    }}>
      {EMPTY_ILLUSTRATIONS[type]}
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginTop: 4 }}>
        {title}
      </div>
      {sub && <div className="muted" style={{ fontSize: 13, maxWidth: 280, lineHeight: 1.5 }}>{sub}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function useToasts() {
  const [list, setList] = useState([]);
  const push = useCallback((text) => {
    const id = Math.random();
    setList((l) => [...l, { id, text }]);
    setTimeout(() => setList((l) => l.filter((x) => x.id !== id)), 2600);
  }, []);
  const node = (
    <div className="toasts">
      {list.map((t) => (
        <div className="toast" key={t.id}>
          <span className="pip" />
          {t.text}
        </div>
      ))}
    </div>
  );
  return [push, node];
}
