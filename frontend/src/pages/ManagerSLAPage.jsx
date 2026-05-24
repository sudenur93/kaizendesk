import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import { Avatar, EmptyState, PriorityBadge, SlaBar, StatusBadge, getInitials, slaInfo } from '../components/Common';
import { analyzeSla, getTickets } from '../services/api';

export default function ManagerSLAPage() {
  const navigate = useNavigate();
  const { search = '' } = useOutletContext() || {};
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterMode, setFilterMode] = useState('all');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false); // all | breached | atrisk

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getTickets()
      .then((data) => { if (!cancelled) setTickets(data); })
      .catch(() => { if (!cancelled) setError('Talepler yüklenemedi.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets
      .filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status))
      .filter((t) => {
        if (filterMode === 'breached') return t.slaBreached;
        if (filterMode === 'atrisk') return t.slaAtRisk && !t.slaBreached;
        return t.slaBreached || t.slaAtRisk;
      })
      .filter((t) => {
        if (!q) return true;
        const hay = `${t.id} ${t.title || ''} ${t.assignedAgentName || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        if (a.slaBreached && !b.slaBreached) return -1;
        if (!a.slaBreached && b.slaBreached) return 1;
        const sa = slaInfo(a), sb = slaInfo(b);
        return (sa.pct ?? 0) - (sb.pct ?? 0);
      });
  }, [tickets, filterMode, search]);

  const breachedCount = useMemo(
    () => tickets.filter((t) => t.slaBreached && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
    [tickets]
  );
  const atRiskCount = useMemo(
    () => tickets.filter((t) => t.slaAtRisk && !t.slaBreached && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
    [tickets]
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">SLA İzleme</h1>
          <div className="page-sub">{filtered.length} talep risk altında veya hedefini aştı</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm"
            disabled={aiAnalyzing || tickets.length === 0}
            onClick={async () => {
              setAiAnalyzing(true);
              setAiAnalysis('');
              try {
                const stats = {
                  toplamAcik: tickets.filter(t => !['RESOLVED','CLOSED'].includes(t.status)).length,
                  slaIhlali: tickets.filter(t => t.slaBreached).length,
                  riskAltinda: tickets.filter(t => t.slaAtRisk && !t.slaBreached).length,
                  kritikTicketlar: tickets
                    .filter(t => t.slaBreached || t.slaAtRisk)
                    .slice(0, 5)
                    .map(t => ({ baslik: t.title, oncelik: t.priority, durum: t.status })),
                };
                const text = await analyzeSla(stats);
                setAiAnalysis(text);
              } catch {
                setAiAnalysis('Analiz oluşturulamadı.');
              } finally {
                setAiAnalyzing(false);
              }
            }}
          >
            {aiAnalyzing ? '…' : '✦ AI Risk Analizi'}
          </button>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/manager/dashboard')}>
            ← Panele dön
          </button>
        </div>
      </div>

      {aiAnalysis && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--accent)', background: 'var(--bg-soft)' }}>
          <div className="card-head" style={{ paddingBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>✦ AI SLA Risk Analizi</span>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAiAnalysis('')}>✕</button>
          </div>
          <div style={{ padding: '0 20px 16px', fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-2)' }}>
            {aiAnalysis}
          </div>
        </div>
      )}

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 18 }}>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>SLA İhlali</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: breachedCount > 0 ? 'var(--err)' : 'var(--text)' }}>{breachedCount}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Risk Altında</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: atRiskCount > 0 ? 'var(--warn)' : 'var(--text)' }}>{atRiskCount}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Toplam Açık</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length}</div>
        </div>
      </div>

      <div className="card">
        <div className="fbar">
          <div className="seg">
            {[
              { key: 'all', label: `Tümü (${breachedCount + atRiskCount})` },
              { key: 'breached', label: `İhlal (${breachedCount})` },
              { key: 'atrisk', label: `Risk (${atRiskCount})` },
            ].map(({ key, label }) => (
              <button key={key} type="button" className={filterMode === key ? 'active' : ''} onClick={() => setFilterMode(key)}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="badge p-high" style={{ display: 'flex', margin: '12px 16px', padding: '8px 12px', gap: 8 }}>
            <Ic.AlertTriangle size={13} /> {error}
          </div>
        )}

        <table className="tbl">
          <thead>
            <tr>
              <th style={{ width: 80 }}>ID</th>
              <th>Başlık</th>
              <th style={{ width: 140 }}>Durum</th>
              <th style={{ width: 90 }}>Öncelik</th>
              <th style={{ width: 180 }}>SLA</th>
              <th style={{ width: 160 }}>Atanan</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="6" className="muted" style={{ padding: 40, textAlign: 'center' }}>Yükleniyor…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan="6">
                <EmptyState
                  type="sla"
                  title="SLA ihlali yok"
                  sub="Tüm talepler SLA süresi içinde. Harika iş!"
                />
              </td></tr>
            ) : (
              filtered.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/agent/tickets/${t.id}`)}>
                  <td className="id">#{t.id}</td>
                  <td className="ttl">
                    {t.title}
                    {t.slaBreached && (
                      <span className="badge p-high" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '1px 6px', marginLeft: 6, fontSize: 10 }}>
                        <Ic.AlertTriangle size={10} /> İhlal
                      </span>
                    )}
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td><SlaBar ticket={t} /></td>
                  <td>
                    {t.assignedAgentName
                      ? <span className="row" style={{ gap: 6 }}><Avatar initials={getInitials(t.assignedAgentName)} size="sm" /><span style={{ fontSize: 13 }}>{t.assignedAgentName}</span></span>
                      : <span className="muted">Atanmamış</span>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
