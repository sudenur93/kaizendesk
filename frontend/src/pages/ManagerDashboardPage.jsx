import { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import { fmtDate } from '../components/Common';
import { getDashboardSummary } from '../services/api';

function StatCard({ label, value, sub, tone }) {
  return (
    <div className="card card-pad" style={{ flex: 1, minWidth: 140 }}>
      <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
        {label}
      </div>
      <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1, color: tone === 'bad' ? 'var(--p-high)' : tone === 'warn' ? 'var(--warn)' : 'var(--text)' }}>
        {value ?? '—'}
      </div>
      {sub && <div className="muted" style={{ marginTop: 6, fontSize: 12 }}>{sub}</div>}
    </div>
  );
}

function MiniBar({ label, value, max, tone }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const color = tone === 'bad' ? 'var(--p-high)' : tone === 'warn' ? 'var(--warn)' : 'var(--accent)';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
      <span style={{ flex: '0 0 150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: 'var(--bg-soft)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: pct + '%', height: '100%', background: color, borderRadius: 4, transition: 'width .4s' }} />
      </div>
      <span className="mono" style={{ flex: '0 0 28px', textAlign: 'right', color: 'var(--text-2)' }}>{value}</span>
    </div>
  );
}

function fmtMinutes(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}dk`;
  return `${h}s ${m}dk`;
}

const DATE_PRESETS = [
  { key: '7', label: 'Son 7 gün' },
  { key: '30', label: 'Son 30 gün' },
  { key: '90', label: 'Son 90 gün' },
];

export default function ManagerDashboardPage() {
  const { pushToast } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeDays, setRangeDays] = useState('30');

  const { from, to } = useMemo(() => {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - parseInt(rangeDays, 10));
    return {
      from: f.toISOString().slice(0, 10),
      to: t.toISOString().slice(0, 10),
    };
  }, [rangeDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    getDashboardSummary(from, to)
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError('Dashboard verileri yüklenemedi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  const statusRows = useMemo(() => {
    if (!data?.statusCounts) return [];
    const order = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];
    const label = { NEW: 'Yeni', IN_PROGRESS: 'İşlemde', WAITING_FOR_CUSTOMER: 'Müşteri Bekleniyor', RESOLVED: 'Çözüldü', CLOSED: 'Kapalı' };
    const total = Object.values(data.statusCounts).reduce((s, v) => s + v, 0) || 1;
    return order.map((k) => ({ key: k, label: label[k] || k, value: data.statusCounts[k] || 0, max: total }));
  }, [data]);

  const priorityRows = useMemo(() => {
    if (!data?.priorityCounts) return [];
    const order = ['HIGH', 'MEDIUM', 'LOW'];
    const label = { HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük' };
    const tones = { HIGH: 'bad', MEDIUM: 'warn', LOW: null };
    const total = Object.values(data.priorityCounts).reduce((s, v) => s + v, 0) || 1;
    return order.map((k) => ({ key: k, label: label[k] || k, value: data.priorityCounts[k] || 0, max: total, tone: tones[k] }));
  }, [data]);

  const productRows = useMemo(() => {
    if (!data?.productCounts) return [];
    const total = Object.values(data.productCounts).reduce((s, v) => s + v, 0) || 1;
    return Object.entries(data.productCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, label: k, value: v, max: total }));
  }, [data]);

  const slaRate = data?.slaComplianceRate != null ? `%${(data.slaComplianceRate * 100).toFixed(1)}` : '—';

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="page-head">
          <div>
            <h1 className="page-title">Yönetici Paneli</h1>
            <div className="page-sub">
              {loading ? 'Veriler yükleniyor…' : error ? error : `Son güncelleme: ${fmtDate(Date.now(), 'datetime')}`}
            </div>
          </div>
          <div className="row" style={{ gap: 6 }}>
            {DATE_PRESETS.map((p) => (
              <button
                key={p.key}
                type="button"
                className={`btn btn-sm ${rangeDays === p.key ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => setRangeDays(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="badge p-high" style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}>
            <Ic.AlertTriangle size={13} />
            {error}
          </div>
        )}

        <div className="row" style={{ gap: 14, flexWrap: 'wrap', marginBottom: 18 }}>
          <StatCard label="Toplam Talep" value={data?.totalTickets} />
          <StatCard label="Açık" value={data?.openTickets} tone="warn" />
          <StatCard label="İşlemde" value={data?.inProgressTickets} />
          <StatCard label="Çözüldü (dönem)" value={data?.closedInRange} />
          <StatCard label="SLA İhlali" value={data?.slaBreachedCount} tone="bad" sub={`Uyum: ${slaRate}`} />
          <StatCard label="Ort. Çözüm" value={fmtMinutes(data?.avgResolutionMinutes)} sub="çözüm süresi" />
        </div>

        <div className="row" style={{ gap: 14, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <div className="card card-pad" style={{ flex: '1 1 260px' }}>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
              Durum Dağılımı
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {statusRows.map((r) => <MiniBar key={r.key} {...r} />)}
            </div>
          </div>

          <div className="card card-pad" style={{ flex: '1 1 220px' }}>
            <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
              Öncelik Dağılımı
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {priorityRows.map((r) => <MiniBar key={r.key} {...r} />)}
            </div>
          </div>

          {productRows.length > 0 && (
            <div className="card card-pad" style={{ flex: '1 1 220px' }}>
              <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                Ürün / Sistem
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {productRows.map((r) => <MiniBar key={r.key} {...r} />)}
              </div>
            </div>
          )}
        </div>

        {data?.agentPerformances?.length > 0 && (
          <div className="card" style={{ marginTop: 18 }}>
            <div className="card-head">
              <div>
                <h3>Uzman Performansı</h3>
                <div className="sub">Seçili dönemde atama ve çözüm</div>
              </div>
            </div>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Uzman</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Atanan</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Çözülen</th>
                  <th style={{ width: 110, textAlign: 'right' }}>Kapatılan</th>
                  <th style={{ width: 140, textAlign: 'right' }}>Ort. Çözüm</th>
                </tr>
              </thead>
              <tbody>
                {data.agentPerformances.map((ap) => (
                  <tr key={ap.agentId}>
                    <td className="ttl">{ap.agentName || `#${ap.agentId}`}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{ap.assignedCount}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{ap.resolvedCount}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{ap.closedCount}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtMinutes(ap.avgResolutionMinutes)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
