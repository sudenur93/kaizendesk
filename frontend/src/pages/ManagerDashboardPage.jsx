import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import { Avatar, PriorityBadge, SlaBar, StatusBadge, fmtDate, getInitials, slaInfo } from '../components/Common';
import { getDashboardSummary, getTickets } from '../services/api';

/* ── SVG mini-charts ── */
function Donut({ data, size = 160, thickness = 22, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness} />
      {data.map((d, i) => {
        const len = total > 0 ? (d.value / total) * C : 0;
        const dash = `${len} ${C - len}`;
        const offset = -acc;
        acc += len;
        return (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={d.color} strokeWidth={thickness}
            strokeDasharray={dash} strokeDashoffset={offset}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        );
      })}
      <text x="50%" y="47%" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">{centerValue ?? total}</text>
      <text x="50%" y="60%" textAnchor="middle" fontSize="9.5" fill="var(--text-3)" letterSpacing="0.06em">{centerLabel || 'TOPLAM'}</text>
    </svg>
  );
}

function ComplianceRing({ pct, size = 130, thickness = 11 }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const len = (pct / 100) * C;
  const color = pct >= 90 ? 'var(--ok)' : pct >= 75 ? 'var(--warn)' : 'var(--err)';
  return (
    <svg width={size} height={size}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={thickness}
        strokeDasharray={`${len} ${C - len}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="46%" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">%{pct}</text>
      <text x="50%" y="60%" textAnchor="middle" fontSize="9" fill="var(--text-3)" letterSpacing="0.06em">SLA UYUMU</text>
    </svg>
  );
}

function TrendChart({ opened, closed, labels, height = 160 }) {
  const w = 540;
  const h = height;
  const pad = { l: 26, r: 10, t: 12, b: 22 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(...opened, ...closed, 1);
  const n = labels.length;
  const xs = labels.map((_, i) => pad.l + (n > 1 ? (i / (n - 1)) * innerW : innerW / 2));
  const yFor = (v) => pad.t + innerH - (v / maxY) * innerH;
  const line = (arr) => arr.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${yFor(v)}`).join(' ');
  const area = (arr) => `${line(arr)} L ${xs[xs.length - 1]} ${pad.t + innerH} L ${xs[0]} ${pad.t + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height, display: 'block' }}>
      <defs>
        <linearGradient id="og" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--warn)" stopOpacity="0.3" />
          <stop offset="100%" stopColor="var(--warn)" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="rg" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.25" />
          <stop offset="100%" stopColor="var(--ok)" stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => {
        const y = pad.t + (i / 3) * innerH;
        const v = Math.round(maxY * (1 - i / 3));
        return (
          <g key={i}>
            <line x1={pad.l} x2={w - pad.r} y1={y} y2={y} stroke="var(--hairline)" strokeWidth="1" />
            <text x={pad.l - 4} y={y + 3} fontSize="9" fill="var(--text-3)" textAnchor="end">{v}</text>
          </g>
        );
      })}
      <path d={area(opened)} fill="url(#og)" />
      <path d={line(opened)} fill="none" stroke="var(--warn)" strokeWidth="2" />
      <path d={area(closed)} fill="url(#rg)" />
      <path d={line(closed)} fill="none" stroke="var(--ok)" strokeWidth="2" />
      {opened.map((v, i) => <circle key={`o${i}`} cx={xs[i]} cy={yFor(v)} r="2.5" fill="var(--warn)" />)}
      {closed.map((v, i) => <circle key={`r${i}`} cx={xs[i]} cy={yFor(v)} r="2.5" fill="var(--ok)" />)}
      {labels.map((l, i) =>
        i % 2 === 0 ? <text key={i} x={xs[i]} y={h - 5} fontSize="9" fill="var(--text-3)" textAnchor="middle">{l}</text> : null
      )}
    </svg>
  );
}

/* ── helpers ── */
function fmtMinutes(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}dk`;
  return `${h}s ${m}dk`;
}

const STATUS_COLOR = {
  NEW: '#3563a6',
  IN_PROGRESS: '#b76b00',
  WAITING_FOR_CUSTOMER: '#7a766b',
  RESOLVED: '#2d8a4e',
  CLOSED: '#9aa0a8',
};

const DATE_PRESETS = [
  { key: '7', label: 'Son 7 gün' },
  { key: '30', label: 'Son 30 gün' },
  { key: '90', label: 'Son 90 gün' },
];

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { pushToast } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [urgentTickets, setUrgentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeDays, setRangeDays] = useState('30');

  const { from, to } = useMemo(() => {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - parseInt(rangeDays, 10));
    return { from: f.toISOString().slice(0, 10), to: t.toISOString().slice(0, 10) };
  }, [rangeDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getDashboardSummary(from, to), getTickets()])
      .then(([summary, tickets]) => {
        if (cancelled) return;
        setData(summary);
        const urgent = tickets
          .filter((t) => (t.slaBreached || t.slaAtRisk) && !['RESOLVED', 'CLOSED'].includes(t.status))
          .sort((a, b) => {
            if (a.slaBreached && !b.slaBreached) return -1;
            if (!a.slaBreached && b.slaBreached) return 1;
            const sa = slaInfo(a), sb = slaInfo(b);
            return (sa.pct ?? 0) - (sb.pct ?? 0);
          })
          .slice(0, 6);
        setUrgentTickets(urgent);
      })
      .catch(() => { if (!cancelled) setError('Dashboard verileri yüklenemedi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  /* chart data */
  const statusDonut = useMemo(() => {
    if (!data?.statusCounts) return [];
    return [
      { label: 'Yeni', value: data.statusCounts.NEW || 0, color: STATUS_COLOR.NEW },
      { label: 'İşlemde', value: data.statusCounts.IN_PROGRESS || 0, color: STATUS_COLOR.IN_PROGRESS },
      { label: 'Müşteri', value: data.statusCounts.WAITING_FOR_CUSTOMER || 0, color: STATUS_COLOR.WAITING_FOR_CUSTOMER },
      { label: 'Çözüldü', value: data.statusCounts.RESOLVED || 0, color: STATUS_COLOR.RESOLVED },
      { label: 'Kapalı', value: data.statusCounts.CLOSED || 0, color: STATUS_COLOR.CLOSED },
    ].filter((d) => d.value > 0);
  }, [data]);

  const { trendOpened, trendClosed, trendLabels } = useMemo(() => {
    if (!data?.dailyCreatedCounts?.length) return { trendOpened: [], trendClosed: [], trendLabels: [] };
    const labels = data.dailyCreatedCounts.map((d) => {
      const parts = d.date.split('-');
      return `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}`;
    });
    return {
      trendOpened: data.dailyCreatedCounts.map((d) => d.count),
      trendClosed: (data.dailyClosedCounts || []).map((d) => d.count),
      trendLabels: labels,
    };
  }, [data]);

  const slaRate = data?.slaComplianceRate != null ? Math.round(data.slaComplianceRate) : null;
  const openCount = (data?.statusCounts?.NEW || 0) + (data?.statusCounts?.IN_PROGRESS || 0) + (data?.statusCounts?.WAITING_FOR_CUSTOMER || 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Yönetici Paneli</h1>
          <div className="page-sub">
            {loading ? 'Yükleniyor…' : error ? error : fmtDate(Date.now(), 'datetime')}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg" style={{ display: 'inline-flex', background: 'var(--bg-soft)', borderRadius: 7, padding: 3 }}>
            {DATE_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => setRangeDays(p.key)}
                style={{ border: 0, background: rangeDays === p.key ? 'var(--surface)' : 'transparent',
                  color: rangeDays === p.key ? 'var(--text)' : 'var(--text-2)',
                  padding: '5px 12px', fontSize: 12.5, borderRadius: 5, fontWeight: rangeDays === p.key ? 500 : 400,
                  boxShadow: rangeDays === p.key ? 'var(--shadow-1)' : 'none', cursor: 'pointer' }}>
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRangeDays(rangeDays)}>
            <Ic.Refresh size={13} /> Yenile
          </button>
        </div>
      </div>

      {error && (
        <div className="badge p-high" style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}>
          <Ic.AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {[
          { label: 'Açık Talepler', value: openCount, tone: 'warn' },
          { label: 'Bugün Kapatılan', value: data?.closedToday, tone: null },
          { label: 'SLA İhlali', value: data?.slaBreachedCount, tone: 'bad' },
          { label: 'Ort. Çözüm', value: fmtMinutes(data?.avgResolutionMinutes), tone: null, sub: 'çözüm süresi' },
        ].map((kpi) => (
          <div key={kpi.label} className="card" style={{ padding: '16px 18px' }}>
            <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 8 }}>{kpi.label}</div>
            <div style={{ fontSize: 30, fontWeight: 700, lineHeight: 1, color: kpi.tone === 'bad' ? 'var(--err)' : kpi.tone === 'warn' ? 'var(--warn)' : 'var(--text)' }}>
              {kpi.value ?? '—'}
            </div>
            {kpi.sub && <div className="muted" style={{ fontSize: 11.5, marginTop: 5 }}>{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* ── Row 1: Trend + Status donut ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Talep Hacmi Trendi</h3>
              <div className="sub">Son 14 gün · açılan vs çözülen</div>
            </div>
            <div className="row" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--warn)' }} />Açılan
              </span>
              <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: 'var(--ok)' }} />Çözülen
              </span>
            </div>
          </div>
          <div style={{ padding: '16px 20px 8px' }}>
            {trendLabels.length > 0 ? (
              <TrendChart opened={trendOpened} closed={trendClosed} labels={trendLabels} />
            ) : (
              <div className="muted" style={{ textAlign: 'center', padding: '40px 0', fontSize: 13 }}>Veri yükleniyor…</div>
            )}
          </div>
          {trendLabels.length > 0 && (
            <div className="row" style={{ padding: '10px 20px 14px', gap: 24, borderTop: '1px solid var(--hairline)' }}>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Toplam Açılan</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>{trendOpened.reduce((a, b) => a + b, 0)}</div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Toplam Çözülen</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: 'var(--ok)' }}>{trendClosed.reduce((a, b) => a + b, 0)}</div>
              </div>
              <span className="spacer" />
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Net Bakiye</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                  {trendOpened.reduce((a, b) => a + b, 0) - trendClosed.reduce((a, b) => a + b, 0) >= 0 ? '+' : ''}
                  {trendOpened.reduce((a, b) => a + b, 0) - trendClosed.reduce((a, b) => a + b, 0)}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>Açık Talep Dağılımı</h3><div className="sub">Statüye göre kırılım</div></div>
          </div>
          <div style={{ padding: '16px 20px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
            <Donut data={statusDonut} centerLabel="AÇIK" centerValue={openCount} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {statusDonut.map((d) => {
                const pct = openCount > 0 ? Math.round((d.value / openCount) * 100) : 0;
                return (
                  <div key={d.label}>
                    <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                      <span style={{ width: 9, height: 9, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{d.label}</span>
                      <span className="spacer" />
                      <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{d.value}</span>
                      <span className="muted mono" style={{ fontSize: 10.5, width: 28, textAlign: 'right' }}>%{pct}</span>
                    </div>
                    <div style={{ height: 3, background: 'var(--bg-soft)', borderRadius: 99 }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: d.color, borderRadius: 99 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 2: SLA risk list + SLA compliance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>Aciliyet Listesi</h3><div className="sub">SLA süresi dolmak üzere · hemen aksiyon</div></div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/manager/sla')}>Tümünü gör →</button>
          </div>
          <table className="tbl">
            <tbody>
              {urgentTickets.length === 0 ? (
                <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center' }}>
                  <div className="row" style={{ justifyContent: 'center', gap: 8, color: 'var(--ok)', fontSize: 13 }}>
                    <Ic.Check size={14} /> SLA riski olan açık talep yok
                  </div>
                </td></tr>
              ) : (
                urgentTickets.map((t) => (
                  <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/agent/tickets/${t.id}`)}>
                    <td className="id" style={{ width: 74 }}>#{t.id}</td>
                    <td className="ttl">
                      {t.title}
                      <span className="lbl">· <PriorityBadge priority={t.priority} /></span>
                    </td>
                    <td style={{ width: 140 }}><SlaBar ticket={t} /></td>
                    <td style={{ width: 100 }}>
                      {t.assignedAgentName
                        ? <span className="row" style={{ gap: 6 }}><Avatar initials={getInitials(t.assignedAgentName)} size="sm" /><span style={{ fontSize: 12 }}>{t.assignedAgentName.split(' ')[0]}</span></span>
                        : <span className="muted" style={{ fontSize: 12 }}>Atanmamış</span>}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>SLA Performansı</h3><div className="sub">Genel uyum oranı ve risk durumu</div></div>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
            <ComplianceRing pct={slaRate ?? 0} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { label: 'Hedefte', value: (data?.totalTickets || 0) - (data?.slaBreachedCount || 0), color: 'var(--ok)' },
                { label: 'SLA İhlali', value: data?.slaBreachedCount, color: 'var(--err)' },
              ].map((r) => (
                <div key={r.label} className="row" style={{ gap: 10 }}>
                  <div style={{ width: 6, height: 34, background: r.color, borderRadius: 2 }} />
                  <div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: r.label === 'SLA İhlali' && (r.value || 0) > 0 ? r.color : 'var(--text)' }}>{r.value ?? '—'}</div>
                    <div className="muted" style={{ fontSize: 11 }}>{r.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ borderTop: '1px solid var(--hairline)', padding: '10px 20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/manager/sla')}>SLA raporu →</button>
          </div>
        </div>
      </div>

      {/* ── Row 3: Team performance ── */}
      {data?.agentPerformances?.length > 0 && (
        <div className="card">
          <div className="card-head">
            <div><h3>Ekip Performansı</h3><div className="sub">Seçili dönemde atama ve çözüm sayıları</div></div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/manager/team')}>Detay →</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Uzman</th>
                <th style={{ width: 100, textAlign: 'right' }}>Atanan</th>
                <th style={{ width: 100, textAlign: 'right' }}>Çözülen</th>
                <th style={{ width: 100, textAlign: 'right' }}>Kapatılan</th>
                <th style={{ width: 140, textAlign: 'right' }}>Ort. Çözüm</th>
              </tr>
            </thead>
            <tbody>
              {[...data.agentPerformances].sort((a, b) => (b.resolvedCount || 0) - (a.resolvedCount || 0)).map((ap, i) => (
                <tr key={ap.agentId}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar initials={getInitials(ap.agentName || '?')} size="sm" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                          {ap.agentName || `#${ap.agentId}`}
                          {i === 0 && <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'color-mix(in oklab, var(--ok) 14%, var(--bg-soft))', color: 'var(--ok)', fontWeight: 600 }}>TOP</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{ textAlign: 'right' }}>{ap.assignedCount}</td>
                  <td className="mono" style={{ textAlign: 'right', fontWeight: 600 }}>{ap.resolvedCount}</td>
                  <td className="mono" style={{ textAlign: 'right' }}>{ap.closedCount}</td>
                  <td className="mono" style={{ textAlign: 'right', color: 'var(--text-2)' }}>{fmtMinutes(ap.avgResolutionMinutes)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
