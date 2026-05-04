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
