import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import Ic from '../components/Icons';
import { Avatar, PriorityBadge, SlaBar, StatusBadge, Skeleton, SkeletonCard, SkeletonTable, fmtDate, getInitials, slaInfo } from '../components/Common';
import { analyzeDashboard, getDashboardSummary, getRecentActivity, getTickets } from '../services/api';
import { printDashboardPDF } from '../printPDF';

/* ── ComplianceRing (SVG, sade) ── */
function ComplianceRing({ pct, size = 130, thickness = 11 }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const len = (pct / 100) * C;
  const color = pct >= 90 ? 'var(--ok)' : pct >= 75 ? 'var(--warn)' : 'var(--err)';
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness} />
      <circle cx={size/2} cy={size/2} r={r} fill="none"
        stroke={color} strokeWidth={thickness}
        strokeDasharray={`${len} ${C - len}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x="50%" y="46%" textAnchor="middle" fontSize="22" fontWeight="700" fill="var(--text)">%{pct}</text>
      <text x="50%" y="60%" textAnchor="middle" fontSize="9" fill="var(--text-3)" letterSpacing="0.06em">SLA UYUMU</text>
    </svg>
  );
}

/* ── Custom tooltip ── */
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      borderRadius: 8, padding: '10px 14px', fontSize: 12,
      boxShadow: 'var(--shadow-pop)',
    }}>
      <div style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text-2)' }}>{label}</div>
      {payload.map((p) => (
        <div key={p.name} style={{ color: p.color, display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, flexShrink: 0 }} />
          <span>{p.name}: <b>{p.value}</b></span>
        </div>
      ))}
    </div>
  );
}

function PieTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const d = payload[0];
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--hairline)',
      borderRadius: 8, padding: '8px 12px', fontSize: 12,
      boxShadow: 'var(--shadow-pop)',
    }}>
      <span style={{ color: d.payload.fill }}>{d.name}: </span>
      <b>{d.value}</b>
    </div>
  );
}

/* ── helpers ── */
function fmtMinutes(min) {
  if (min == null) return '—';
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h === 0 ? `${m}dk` : `${h}s ${m}dk`;
}

const STATUS_COLOR = {
  NEW: '#3563a6',
  IN_PROGRESS: '#b76b00',
  WAITING_FOR_CUSTOMER: '#7a766b',
  RESOLVED: '#2d8a4e',
  CLOSED: '#9aa0a8',
};

const EVENT_LABEL = {
  TICKET_CREATED: 'yeni talep oluşturdu',
  STATUS_CHANGED: 'durumu değiştirdi',
  AGENT_ASSIGNED: 'talebi atadı →',
  COMMENT_ADDED: 'yorum ekledi',
  INTERNAL_NOTE: 'dahili not ekledi',
};

const EVENT_COLOR = {
  TICKET_CREATED: '#e8f5e9',
  STATUS_CHANGED: '#fff8e1',
  AGENT_ASSIGNED: '#e3f2fd',
  COMMENT_ADDED: '#f3e5f5',
  INTERNAL_NOTE: '#fce4ec',
};

const EVENT_ICON = {
  TICKET_CREATED: <Ic.Plus size={14} style={{ color: '#2d8a4e' }} />,
  STATUS_CHANGED: <Ic.Clock size={14} style={{ color: '#b76b00' }} />,
  AGENT_ASSIGNED: <Ic.Users size={14} style={{ color: '#3563a6' }} />,
  COMMENT_ADDED: <Ic.Bell size={14} style={{ color: '#7b3fa0' }} />,
  INTERNAL_NOTE: <Ic.Bell size={14} style={{ color: '#c0394b' }} />,
};

function fmtRelative(isoStr) {
  if (!isoStr) return '';
  const diff = Math.floor((Date.now() - new Date(isoStr).getTime()) / 1000);
  if (diff < 60) return 'az önce';
  if (diff < 3600) return `${Math.floor(diff / 60)} dk önce`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} sa önce`;
  return `${Math.floor(diff / 86400)} gün önce`;
}

function toDateParam(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

const DATE_PRESETS = [
  { key: '7', label: 'Son 7 gün' },
  { key: '30', label: 'Son 30 gün' },
  { key: '90', label: 'Son 90 gün' },
];

/* ── KPI Card with optional trend ── */
function KpiCard({ label, value, tone, sub, icon }) {
  return (
    <div className="card" style={{ padding: '18px 20px', display: 'flex', gap: 14, alignItems: 'center' }}>
      {icon && (
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: tone === 'bad' ? 'color-mix(in oklab,var(--err) 12%,var(--bg-soft))'
            : tone === 'warn' ? 'color-mix(in oklab,var(--warn) 12%,var(--bg-soft))'
            : tone === 'ok' ? 'color-mix(in oklab,var(--ok) 12%,var(--bg-soft))'
            : 'var(--bg-soft)',
          color: tone === 'bad' ? 'var(--err)' : tone === 'warn' ? 'var(--warn)' : tone === 'ok' ? 'var(--ok)' : 'var(--text-2)',
        }}>
          {icon}
        </div>
      )}
      <div>
        <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 28, fontWeight: 700, lineHeight: 1, color: tone === 'bad' ? 'var(--err)' : tone === 'warn' ? 'var(--warn)' : 'var(--text)' }}>
          {value ?? '—'}
        </div>
        {sub && <div className="muted" style={{ fontSize: 11.5, marginTop: 4 }}>{sub}</div>}
      </div>
    </div>
  );
}

export default function ManagerDashboardPage() {
  const navigate = useNavigate();
  const { pushToast } = useOutletContext() || {};
  const [data, setData] = useState(null);
  const [urgentTickets, setUrgentTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rangeDays, setRangeDays] = useState('30');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [activity, setActivity] = useState([]);
  const [allTickets, setAllTickets] = useState([]);

  const { from, to } = useMemo(() => {
    const t = new Date();
    const f = new Date();
    f.setDate(f.getDate() - parseInt(rangeDays, 10) + 1);
    return { from: toDateParam(f), to: toDateParam(t) };
  }, [rangeDays]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    Promise.all([getDashboardSummary(from, to), getTickets(), getRecentActivity(5)])
      .then(([summary, tickets, acts]) => {
        if (cancelled) return;
        setData(summary);
        setAllTickets(tickets);
        setActivity(acts);
        const urgent = tickets
          .filter((t) => (t.slaBreached || t.slaAtRisk) && !['RESOLVED', 'CLOSED'].includes(t.status))
          .sort((a, b) => {
            if (a.slaBreached && !b.slaBreached) return -1;
            if (!a.slaBreached && b.slaBreached) return 1;
            return (slaInfo(a).pct ?? 0) - (slaInfo(b).pct ?? 0);
          })
          .slice(0, 6);
        setUrgentTickets(urgent);
      })
      .catch(() => { if (!cancelled) setError('Dashboard verileri yüklenemedi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [from, to]);

  /* chart data */
  const trendData = useMemo(() => {
    if (!data?.dailyCreatedCounts?.length) return [];
    return data.dailyCreatedCounts.map((d, i) => {
      const parts = d.date.split('-');
      return {
        label: `${parseInt(parts[2], 10)}/${parseInt(parts[1], 10)}`,
        'Açılan': d.count,
        'Çözülen': data.dailyClosedCounts?.[i]?.count ?? 0,
      };
    });
  }, [data]);

  const pieData = useMemo(() => {
    if (!data?.statusCounts) return [];
    return [
      { name: 'Yeni', value: data.statusCounts.NEW || 0, fill: STATUS_COLOR.NEW },
      { name: 'İşlemde', value: data.statusCounts.IN_PROGRESS || 0, fill: STATUS_COLOR.IN_PROGRESS },
      { name: 'Müşteri', value: data.statusCounts.WAITING_FOR_CUSTOMER || 0, fill: STATUS_COLOR.WAITING_FOR_CUSTOMER },
      { name: 'Çözüldü', value: data.statusCounts.RESOLVED || 0, fill: STATUS_COLOR.RESOLVED },
      { name: 'Kapalı', value: data.statusCounts.CLOSED || 0, fill: STATUS_COLOR.CLOSED },
    ].filter((d) => d.value > 0);
  }, [data]);

  const agentBarData = useMemo(() => {
    if (!data?.agentPerformances?.length) return [];
    return [...data.agentPerformances]
      .sort((a, b) => (b.resolvedCount || 0) - (a.resolvedCount || 0))
      .slice(0, 6)
      .map((ap) => ({
        name: (ap.agentName || '?').split(' ')[0],
        'Atanan': ap.assignedCount || 0,
        'Çözülen': ap.resolvedCount || 0,
        'Kapatılan': ap.closedCount || 0,
      }));
  }, [data]);

  // Anlık SLA — tarih aralığından bağımsız, tüm açık ticketlardan hesapla
  const liveOpenTickets = allTickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status));
  const liveBreached   = liveOpenTickets.filter((t) => t.slaBreached).length;
  const liveInTarget   = liveOpenTickets.filter((t) => !t.slaBreached).length;
  const liveSlaRate    = liveOpenTickets.length > 0
    ? Math.round((liveInTarget / liveOpenTickets.length) * 100)
    : 100;

  // CSAT — müşteri memnuniyeti (puanlanmış talepler ortalaması)
  const ratedTickets = allTickets.filter((t) => t.satisfactionRating);
  const avgCsat = ratedTickets.length > 0
    ? (ratedTickets.reduce((s, t) => s + t.satisfactionRating, 0) / ratedTickets.length).toFixed(1)
    : null;

  const openCount = (data?.statusCounts?.NEW || 0) + (data?.statusCounts?.IN_PROGRESS || 0) + (data?.statusCounts?.WAITING_FOR_CUSTOMER || 0);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Yönetici Paneli</h1>
          <div className="page-sub">{loading ? 'Yükleniyor…' : error || fmtDate(Date.now(), 'datetime')}</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="seg" style={{ display: 'inline-flex', background: 'var(--bg-soft)', borderRadius: 7, padding: 3 }}>
            {DATE_PRESETS.map((p) => (
              <button key={p.key} type="button" onClick={() => setRangeDays(p.key)}
                style={{
                  border: 0, background: rangeDays === p.key ? 'var(--surface)' : 'transparent',
                  color: rangeDays === p.key ? 'var(--text)' : 'var(--text-2)',
                  padding: '5px 12px', fontSize: 12.5, borderRadius: 5,
                  fontWeight: rangeDays === p.key ? 500 : 400,
                  boxShadow: rangeDays === p.key ? 'var(--shadow-1)' : 'none', cursor: 'pointer',
                }}>
                {p.label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setRangeDays(rangeDays)}>
            <Ic.Refresh size={13} /> Yenile
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            disabled={loading || !data}
            onClick={() => printDashboardPDF({
              data,
              rangeDays,
              liveSlaRate,
              liveBreached,
              liveInTarget,
              agentStats: data?.agentPerformances,
            })}
            title="Dashboard özetini PDF olarak indir"
          >
            ↓ PDF
          </button>
          <button
            type="button"
            className="btn btn-sm"
            disabled={aiAnalyzing || !data}
            onClick={async () => {
              setAiAnalyzing(true);
              setAiAnalysis('');
              try {
                const stats = {
                  slaUyumu: slaRate,
                  toplamTicket: data.totalTickets,
                  durumDagilimi: data.statusCounts,
                  ajanPerformans: data.agentPerformances?.slice(0, 5),
                };
                const text = await analyzeDashboard(stats);
                setAiAnalysis(text);
              } catch {
                setAiAnalysis('Analiz oluşturulamadı.');
              } finally {
                setAiAnalyzing(false);
              }
            }}
          >
            {aiAnalyzing ? '…' : '✦ AI Analiz'}
          </button>
        </div>
      </div>

      {aiAnalysis && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--accent)', background: 'var(--bg-soft)' }}>
          <div className="card-head" style={{ paddingBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>✦ AI Dashboard Analizi</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAiAnalysis('')}>✕</button>
          </div>
          <div style={{ padding: '0 20px 16px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>
            {aiAnalysis}
          </div>
        </div>
      )}

      {error && (
        <div className="badge p-high" style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}>
          <Ic.AlertTriangle size={13} /> {error}
        </div>
      )}

      {/* ── KPI strip ── */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 18 }}>
          {[1,2,3,4,5].map(i => <SkeletonCard key={i} rows={2} />)}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 18 }}>
          <KpiCard label="Açık Talepler" value={openCount} tone="warn" icon={<Ic.Inbox size={18} />} />
          <KpiCard label="Bugün Kapatılan" value={data?.closedToday} tone="ok" icon={<Ic.Check size={18} />} />
          <KpiCard label="SLA İhlali" value={data?.slaBreachedCount} tone="bad" icon={<Ic.AlertTriangle size={18} />} />
          <KpiCard label="Ort. Çözüm" value={fmtMinutes(data?.avgResolutionMinutes)} sub="çözüm süresi" icon={<Ic.Clock size={18} />} />
          <KpiCard label="Memnuniyet" value={avgCsat ? `${avgCsat} / 5` : '—'} tone="ok" sub={avgCsat ? `${ratedTickets.length} değerlendirme` : 'henüz puan yok'} icon={<Ic.Star size={18} />} />
        </div>
      )}

      {/* ── Row 1: Trend chart + Pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>Talep Hacmi Trendi</h3><div className="sub">Açılan vs çözülen</div></div>
            <div className="row" style={{ gap: 14 }}>
              <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: '#f59e0b' }} />Açılan
              </span>
              <span className="row" style={{ gap: 5, fontSize: 12, color: 'var(--text-2)' }}>
                <span style={{ width: 9, height: 9, borderRadius: 2, background: '#10b981' }} />Çözülen
              </span>
            </div>
          </div>
          <div style={{ padding: '8px 20px 16px' }}>
            {loading ? (
              <Skeleton height={180} radius={8} />
            ) : trendData.length === 0 ? (
              <div className="muted" style={{ textAlign: 'center', padding: '60px 0', fontSize: 13 }}>Bu dönemde veri yok.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={trendData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorAcilan" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="colorCozulen" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="Açılan" stroke="#f59e0b" strokeWidth={2} fill="url(#colorAcilan)" dot={{ r: 3, fill: '#f59e0b' }} activeDot={{ r: 5 }} />
                  <Area type="monotone" dataKey="Çözülen" stroke="#10b981" strokeWidth={2} fill="url(#colorCozulen)" dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          {!loading && trendData.length > 0 && (
            <div className="row" style={{ padding: '10px 20px 14px', gap: 24, borderTop: '1px solid var(--hairline)' }}>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Toplam Açılan</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                  {trendData.reduce((a, d) => a + d['Açılan'], 0)}
                </div>
              </div>
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Toplam Çözülen</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700, color: '#10b981' }}>
                  {trendData.reduce((a, d) => a + d['Çözülen'], 0)}
                </div>
              </div>
              <span className="spacer" />
              <div>
                <div className="muted" style={{ fontSize: 11 }}>Net Bakiye</div>
                <div className="mono" style={{ fontSize: 18, fontWeight: 700 }}>
                  {(() => {
                    const net = trendData.reduce((a, d) => a + d['Açılan'] - d['Çözülen'], 0);
                    return (net >= 0 ? '+' : '') + net;
                  })()}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>Talep Dağılımı</h3><div className="sub">Statüye göre kırılım</div></div>
          </div>
          <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {loading ? (
              <Skeleton height={200} radius={100} width={200} style={{ borderRadius: '50%' }} />
            ) : pieData.length === 0 ? (
              <div className="muted" style={{ padding: '40px 0', fontSize: 13 }}>Veri yok</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                      paddingAngle={3} dataKey="value" animationBegin={0} animationDuration={800}>
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} stroke="none" />
                      ))}
                    </Pie>
                    <Tooltip content={<PieTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 7 }}>
                  {pieData.map((d) => {
                    const totalCount = pieData.reduce((s, x) => s + x.value, 0);
                    const pct = totalCount > 0 ? Math.round((d.value / totalCount) * 100) : 0;
                    return (
                      <div key={d.name}>
                        <div className="row" style={{ gap: 6, marginBottom: 3 }}>
                          <span style={{ width: 9, height: 9, borderRadius: 2, background: d.fill, flexShrink: 0 }} />
                          <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{d.name}</span>
                          <span className="spacer" />
                          <span className="mono" style={{ fontSize: 12, fontWeight: 600 }}>{d.value}</span>
                          <span className="muted mono" style={{ fontSize: 10.5, width: 28, textAlign: 'right' }}>%{pct}</span>
                        </div>
                        <div style={{ height: 3, background: 'var(--bg-soft)', borderRadius: 99 }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: d.fill, borderRadius: 99, transition: 'width 0.6s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── Row 2: SLA risk + SLA performance ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 18, marginBottom: 18 }}>
        <div className="card">
          <div className="card-head">
            <div><h3>Aciliyet Listesi</h3><div className="sub">SLA süresi dolmak üzere</div></div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/manager/sla')}>Tümünü gör →</button>
          </div>
          {loading ? <SkeletonTable rows={4} cols={4} /> : (
            <table className="tbl">
              <tbody>
                {urgentTickets.length === 0 ? (
                  <tr><td colSpan="4" style={{ padding: '32px', textAlign: 'center' }}>
                    <div className="row" style={{ justifyContent: 'center', gap: 8, color: 'var(--ok)', fontSize: 13 }}>
                      <Ic.Check size={14} /> SLA riski olan açık talep yok
                    </div>
                  </td></tr>
                ) : urgentTickets.map((t) => (
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
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>SLA Performansı</h3><div className="sub">Anlık durum · {liveOpenTickets.length} açık talep</div></div>
          </div>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 20 }}>
            {loading ? <Skeleton width={130} height={130} style={{ borderRadius: '50%' }} /> : (
              <ComplianceRing pct={liveSlaRate} />
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading ? <SkeletonCard rows={2} /> : [
                { label: 'Hedefte', value: liveInTarget, color: 'var(--ok)' },
                { label: 'SLA İhlali', value: liveBreached, color: 'var(--err)' },
              ].map((r) => (
                <div key={r.label} className="row" style={{ gap: 10 }}>
                  <div style={{ width: 6, height: 34, background: r.color, borderRadius: 2 }} />
                  <div>
                    <div className="mono" style={{ fontSize: 17, fontWeight: 700, color: r.label === 'SLA İhlali' && (r.value || 0) > 0 ? r.color : 'var(--text)' }}>{r.value}</div>
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

      {/* ── Row 3: Agent performance bar chart ── */}
      {(loading || data?.agentPerformances?.length > 0) && (
        <div className="card">
          <div className="card-head">
            <div><h3>Ekip Performansı</h3><div className="sub">Atama ve çözüm sayıları</div></div>
            <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/manager/team')}>Detay →</button>
          </div>
          {loading ? (
            <div style={{ padding: '16px 20px' }}><Skeleton height={200} radius={8} /></div>
          ) : (
            <div style={{ padding: '8px 20px 20px' }}>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentBarData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--hairline)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: 'var(--text-2)' }} tickLine={false} axisLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--text-3)' }} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-soft)' }} />
                  <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                  <Bar dataKey="Atanan" fill="#6366f1" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Çözülen" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  <Bar dataKey="Kapatılan" fill="#9aa0a8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── Row 4: En Son Etkinlikler ── */}
      <div className="card">
        <div className="card-head">
          <div><h3>En Son Etkinlikler</h3><div className="sub">Son 5 sistem hareketi</div></div>
        </div>
        {loading ? (
          <div style={{ padding: '12px 20px' }}><SkeletonTable rows={5} cols={3} /></div>
        ) : activity.length === 0 ? (
          <div style={{ padding: '24px 20px', color: 'var(--text-3)', fontSize: 13, textAlign: 'center' }}>Henüz etkinlik yok</div>
        ) : (
          <div style={{ padding: '4px 0 8px' }}>
            {activity.map((a) => (
              <div
                key={a.id}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 20px', borderBottom: '1px solid var(--hairline)', cursor: a.ticketId ? 'pointer' : 'default' }}
                onClick={() => a.ticketId && navigate(`/agent/tickets/${a.ticketId}`)}
              >
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: EVENT_COLOR[a.eventType] || 'var(--bg-soft)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  {EVENT_ICON[a.eventType] || <Ic.Bell size={14} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, color: 'var(--text)' }}>
                    <strong>{a.actor || '—'}</strong>
                    {' '}{EVENT_LABEL[a.eventType] || a.eventType}
                    {a.ticketNo && <span style={{ marginLeft: 6, color: 'var(--accent)', fontWeight: 600 }}>{a.ticketNo}</span>}
                    {a.detail && <span style={{ color: 'var(--text-2)', marginLeft: 4 }}>· {a.detail}</span>}
                  </div>
                  {a.ticketTitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.ticketTitle}</div>}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0, marginTop: 2 }}>{fmtRelative(a.createdAt)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
