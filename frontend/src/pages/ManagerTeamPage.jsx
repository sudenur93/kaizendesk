import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import { Avatar, EmptyState, PriorityBadge, SlaBar, StatusBadge, fmtDate, getInitials, slaInfo } from '../components/Common';
import { analyzeTeam, getAgents, getTickets } from '../services/api';

export default function ManagerTeamPage() {
  const navigate = useNavigate();
  const { search = '' } = useOutletContext() || {};
  const [agents, setAgents] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [aiAnalyzing, setAiAnalyzing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([getAgents(), getTickets()])
      .then(([a, t]) => {
        if (cancelled) return;
        setAgents(a);
        setTickets(t);
      })
      .catch(() => {
        if (!cancelled) setError('Ekip verileri yüklenemedi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, []);

  const agentStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return agents
      .filter((agent) => {
        if (!q) return true;
        const hay = `${agent.name || ''} ${agent.email || ''}`.toLowerCase();
        return hay.includes(q);
      })
      .map((agent) => {
      const mine = tickets.filter((t) => t.assignedAgentId === agent.id);
      const open = mine.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status));
      const resolved = mine.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED');
      const breached = open.filter((t) => t.slaBreached);
      const atRisk = open.filter((t) => t.slaAtRisk && !t.slaBreached);
      const inProgress = open.filter((t) => t.status === 'IN_PROGRESS');
      return { agent, open: open.length, resolved: resolved.length, breached: breached.length, atRisk: atRisk.length, inProgress: inProgress.length, tickets: mine };
    }).sort((a, b) => b.open - a.open);
  }, [agents, tickets, search]);

  const unassigned = useMemo(
    () => tickets.filter((t) => !t.assignedAgentId && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
    [tickets]
  );

  const totalOpen = useMemo(
    () => tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length,
    [tickets]
  );

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Ekip</h1>
          <div className="page-sub">{agents.length} destek uzmanı · {totalOpen} açık talep</div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <button
            type="button"
            className="btn btn-sm"
            disabled={aiAnalyzing || agents.length === 0}
            onClick={async () => {
              setAiAnalyzing(true);
              setAiAnalysis('');
              try {
                const stats = agents.map(a => ({
                  isim: a.name,
                  acikTicket: tickets.filter(t => t.assignedAgentId === a.id && !['RESOLVED','CLOSED'].includes(t.status)).length,
                  toplamTicket: tickets.filter(t => t.assignedAgentId === a.id).length,
                  cozulen: tickets.filter(t => t.assignedAgentId === a.id && ['RESOLVED','CLOSED'].includes(t.status)).length,
                }));
                const text = await analyzeTeam(stats);
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
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => navigate('/manager/dashboard')}>
            ← Panele dön
          </button>
        </div>
      </div>

      {aiAnalysis && (
        <div className="card" style={{ marginBottom: 18, borderLeft: '3px solid var(--accent)', background: 'var(--bg-soft)' }}>
          <div className="card-head" style={{ paddingBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>✦ AI Ekip Analizi</span>
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
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Toplam Uzman</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{agents.length}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Atanmamış Talepler</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: unassigned > 0 ? 'var(--warn)' : 'var(--text)' }}>{unassigned}</div>
        </div>
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>Toplam Açık</div>
          <div style={{ fontSize: 28, fontWeight: 700 }}>{totalOpen}</div>
        </div>
      </div>

      {error && (
        <div className="badge p-high" style={{ display: 'flex', marginBottom: 14, padding: '8px 12px', gap: 8 }}>
          <Ic.AlertTriangle size={13} /> {error}
        </div>
      )}

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Uzman</th>
              <th style={{ width: 90 }}>Rol</th>
              <th style={{ width: 80 }}>Açık</th>
              <th style={{ width: 80 }}>İşlemde</th>
              <th style={{ width: 80 }}>Çözülen</th>
              <th style={{ width: 80 }}>SLA İhlal</th>
              <th style={{ width: 80 }}>Risk</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="7" className="muted" style={{ padding: 40, textAlign: 'center' }}>Yükleniyor…</td></tr>
            ) : agentStats.length === 0 ? (
              <tr><td colSpan="7">
                <EmptyState type="team" title="Henüz destek uzmanı yok" sub="Onaylanan destek uzmanları burada görünecek." />
              </td></tr>
            ) : (
              agentStats.map(({ agent, open, resolved, breached, atRisk, inProgress }) => (
                <tr key={agent.id}>
                  <td>
                    <span className="row" style={{ gap: 10 }}>
                      <Avatar initials={getInitials(agent.name)} />
                      <span>
                        <div style={{ fontWeight: 500 }}>{agent.name}</div>
                        <div className="muted" style={{ fontSize: 11.5 }}>{agent.email}</div>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span className="badge">{agent.role === 'MANAGER' ? 'Yönetici' : 'Uzman'}</span>
                  </td>
                  <td className="mono" style={{ fontWeight: 600 }}>{open}</td>
                  <td className="mono">{inProgress}</td>
                  <td className="mono" style={{ color: 'var(--ok)' }}>{resolved}</td>
                  <td className="mono" style={{ color: breached > 0 ? 'var(--err)' : 'var(--text-3)', fontWeight: breached > 0 ? 600 : 400 }}>
                    {breached > 0 ? breached : '—'}
                  </td>
                  <td className="mono" style={{ color: atRisk > 0 ? 'var(--warn)' : 'var(--text-3)' }}>
                    {atRisk > 0 ? atRisk : '—'}
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
