import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import { EmptyState, PriorityBadge, SlaBar, SkeletonTable, StatusBadge, fmtDate, slaInfo } from '../components/Common';
import TicketDrawer from '../components/TicketDrawer';
import { getFavorites, toggleFavorite } from '../favorites';
import {
  assignTicket,
  findSimilarTickets,
  getAgents,
  getCurrentUserProfile,
  getProducts,
  getTickets,
  getRole,
  updateTicketStatus,
} from '../services/api';

/** @typedef {'all'|'mine'|'others'|'unassigned'} OwnerScope */

function exportCSV(rows, filename) {
  const PRIORITY_TR = { HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük' };
  const STATUS_TR   = { NEW: 'Yeni', IN_PROGRESS: 'İşlemde', WAITING_FOR_CUSTOMER: 'Müşteri Bekliyor', RESOLVED: 'Çözüldü', CLOSED: 'Kapalı' };
  const headers = ['ID', 'Başlık', 'Durum', 'Öncelik', 'Müşteri', 'Atanan', 'Sistem', 'SLA İhlali', 'Açılış Tarihi'];
  const escape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    headers.join(','),
    ...rows.map((t) => [
      t.id,
      escape(t.title),
      escape(STATUS_TR[t.status] || t.status),
      escape(PRIORITY_TR[t.priority] || t.priority),
      escape(t.createdByUsername),
      escape(t.assignedAgentName || '—'),
      escape(t.productName || '—'),
      t.slaBreached ? 'Evet' : 'Hayır',
      escape(t.createdAt ? new Date(t.createdAt).toLocaleString('tr-TR') : ''),
    ].join(',')),
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

const TEAM_COLOR = {
  'IT Destek':      { bg: '#e8f0fe', color: '#1a56db' },
  'Bakım & Arıza':  { bg: '#fde8e8', color: '#c81e1e' },
  'Üretim':         { bg: '#fef3c7', color: '#92400e' },
  'Kalite Kontrol': { bg: '#d1fae5', color: '#065f46' },
  'Genel':          { bg: '#f3f4f6', color: '#374151' },
};

function TeamBadge({ team, style }) {
  if (!team) return null;
  const c = TEAM_COLOR[team] || { bg: '#f3f4f6', color: '#374151' };
  return (
    <span style={{
      display: 'inline-block', padding: '1px 7px', borderRadius: 10,
      fontSize: 11, fontWeight: 600, letterSpacing: '.01em',
      background: c.bg, color: c.color, whiteSpace: 'nowrap', ...style,
    }}>
      {team}
    </span>
  );
}

const STATUS_TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'NEW', label: 'Yeni' },
  { key: 'IN_PROGRESS', label: 'İşlemde' },
  { key: 'WAITING_FOR_CUSTOMER', label: 'Müşteri' },
  { key: 'RESOLVED', label: 'Çözüldü' },
];

const STATUS_LABEL = {
  NEW: 'Yeni',
  IN_PROGRESS: 'İşlemde',
  WAITING_FOR_CUSTOMER: 'Müşteri',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapalı',
};

const KANBAN_COLUMNS = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED'];

const STATUS_TRANSITIONS = {
  NEW:                  [{ value: 'IN_PROGRESS',           label: 'İşleme Al' }],
  IN_PROGRESS:          [{ value: 'WAITING_FOR_CUSTOMER',  label: 'Müşteri Bekle' },
                         { value: 'RESOLVED',              label: 'Çözüldü' }],
  WAITING_FOR_CUSTOMER: [{ value: 'IN_PROGRESS',           label: 'Geri Al' },
                         { value: 'RESOLVED',              label: 'Çözüldü' }],
  RESOLVED:             [{ value: 'CLOSED',                label: 'Kapat' }],
  CLOSED:               [],
};

function priorityRank(p) {
  if (p === 'HIGH') return 0;
  if (p === 'MEDIUM') return 1;
  if (p === 'LOW') return 2;
  return 9;
}

function slaSortRank(info) {
  if (info.state === 'bad') return 0;
  if (info.state === 'warn') return 1;
  return 2;
}

function compareTicketsByPriorityThenSla(a, b) {
  const pd = priorityRank(a.priority) - priorityRank(b.priority);
  if (pd !== 0) return pd;
  const ia = slaInfo(a);
  const ib = slaInfo(b);
  const sr = slaSortRank(ia) - slaSortRank(ib);
  if (sr !== 0) return sr;
  const ra = ia.remain ?? 0;
  const rb = ib.remain ?? 0;
  const rd = ra - rb;
  if (rd !== 0) return rd;
  return (b.id || 0) - (a.id || 0);
}


export default function AgentTicketsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const view = query.get('view');
  const isMineQuery = query.get('mine') === '1';

  function normalizeScopeFromUrl() {
    if (view === 'kanban') return 'mine';
    if (isMineQuery) return 'mine';
    return 'all';
  }

  const { search = '', pushToast } = useOutletContext() || {};
  const [user, setUser] = useState(null);
  const [tickets, setTickets] = useState([]);
  const [products, setProducts] = useState([]);
  const [ownerScope, setOwnerScope] = useState(/** @type {OwnerScope} */ (normalizeScopeFromUrl()));
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [favorites, setFavorites] = useState(getFavorites);
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [error, setError] = useState('');
  const [drawerTicketId, setDrawerTicketId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkWorking, setBulkWorking] = useState(false);
  const [agents, setAgents] = useState([]);
  const isManager = getRole() === 'MANAGER';
  const [similarModal, setSimilarModal] = useState(null); // {loading, results, sourceTicket}

  const [transitioning, setTransitioning] = useState(/** @type {number|null} */ (null));
  const [resolveModal, setResolveModal] = useState(/** @type {null|{ticketId:number,toStatus:string}} */ (null));
  const [resolveNote, setResolveNote] = useState('');
  const [resolveWorking, setResolveWorking] = useState(false);

  async function loadPage() {
    setLoading(true);
    setError('');
    try {
      const [userData, ticketData, productData, agentData] = await Promise.all([
        getCurrentUserProfile(),
        getTickets(),
        getProducts(),
        getAgents().catch(() => []),
      ]);
      setUser(userData);
      setTickets(ticketData);
      setProducts(productData);
      setAgents(agentData);
    } catch {
      setError('Talepler yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  /* ── Bulk actions ── */
  function toggleSelect(id, e) {
    e.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === visibleTickets.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(visibleTickets.map((t) => t.id)));
    }
  }

  async function bulkAssign(agentId) {
    if (!agentId) return;
    setBulkWorking(true);
    try {
      const results = await Promise.allSettled(
        [...selectedIds].map((id) => assignTicket(id, Number(agentId)))
      );
      const updated = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      setTickets((prev) => prev.map((t) => updated.find((u) => u.id === t.id) || t));
      setSelectedIds(new Set());
    } finally { setBulkWorking(false); }
  }

  async function bulkStatus(status) {
    setBulkWorking(true);
    try {
      const results = await Promise.allSettled(
        [...selectedIds].map((id) => updateTicketStatus(id, status, ''))
      );
      const updated = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
      setTickets((prev) => prev.map((t) => updated.find((u) => u.id === t.id) || t));
      setSelectedIds(new Set());
    } finally { setBulkWorking(false); }
  }

  async function handleFindSimilar() {
    const ticketId = [...selectedIds][0];
    const sourceTicket = tickets.find((t) => t.id === ticketId);
    setSimilarModal({ loading: true, results: [], sourceTicket });
    try {
      const raw = await findSimilarTickets(ticketId);
      // JSON parse — Gemini bazen ```json ... ``` içinde döndürür
      const match = raw.match(/\[[\s\S]*\]/);
      const parsed = match ? JSON.parse(match[0]) : [];
      // ticket listesiyle zenginleştir
      const enriched = parsed.map((item) => ({
        ...item,
        ticket: tickets.find((t) => t.id === item.id),
      }));
      setSimilarModal({ loading: false, results: enriched, sourceTicket });
    } catch {
      setSimilarModal({ loading: false, results: [], sourceTicket, error: 'Analiz başarısız.' });
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

  // Favori değişikliklerini dinle (yıldız toggle'ında anında güncelle)
  useEffect(() => {
    const sync = () => setFavorites(getFavorites());
    window.addEventListener('favorites-change', sync);
    return () => window.removeEventListener('favorites-change', sync);
  }, []);

  function handleToggleFavorite(e, ticketId) {
    e.stopPropagation();
    toggleFavorite(ticketId);
  }

  useEffect(() => {
    const next = normalizeScopeFromUrl();
    setOwnerScope((prev) => (prev === next ? prev : /** @type {OwnerScope} */ (next)));
  }, [location.search, isMineQuery, view]);

  const productMap = useMemo(() => {
    const m = new Map();
    products.forEach((p) => m.set(p.id, p.name));
    return m;
  }, [products]);

  const counts = useMemo(() => {
    const uid = user?.id;
    let mine = 0;
    let others = 0;
    let unassigned = 0;
    for (const ticket of tickets) {
      const aid = ticket?.assignedAgentId;
      if (aid == null) unassigned++;
      else if (uid != null && String(aid) === String(uid)) mine++;
      else others++;
    }
    return {
      all: tickets.length,
      mine,
      others,
      unassigned,
    };
  }, [tickets, user]);

  function baseForOwnerScope(scope) {
    const uid = user?.id;
    if (scope === 'all') return tickets;
    if (scope === 'mine') return tickets.filter((t) => uid != null && String(t.assignedAgentId) === String(uid));
    if (scope === 'others')
      return tickets.filter((t) => t.assignedAgentId != null && (uid == null || String(t.assignedAgentId) !== String(uid)));
    return tickets.filter((t) => !t.assignedAgentId);
  }

  const filteredTickets = useMemo(() => {
    const base = baseForOwnerScope(ownerScope);
    const q = search.trim().toLowerCase();
    return base.filter((ticket) => {
      if (ticket.status === 'CLOSED') return false;
      if (view === 'sla') {
        const s = slaInfo(ticket).state;
        if (s !== 'warn' && s !== 'bad') return false;
      }
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (productFilter !== 'all' && String(ticket.productId) !== String(productFilter)) return false;
      if (teamFilter !== 'all') {
        const assignedAgent = agents.find((a) => a.id === ticket.assignedAgentId);
        if (!assignedAgent || assignedAgent.team !== teamFilter) return false;
      }
      // Tarih aralığı filtresi (açılış tarihine göre)
      if (dateFrom || dateTo) {
        const created = ticket.createdAt ? new Date(ticket.createdAt) : null;
        if (!created) return false;
        if (dateFrom && created < new Date(dateFrom + 'T00:00:00')) return false;
        if (dateTo && created > new Date(dateTo + 'T23:59:59')) return false;
      }
      if (q) {
        const text = `${ticket.id} ${ticket.title || ''} ${ticket.createdByUsername || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [ownerScope, tickets, user, statusFilter, priorityFilter, productFilter, teamFilter, dateFrom, dateTo, agents, search, view]);

  const visibleTickets = useMemo(() => [...filteredTickets].sort(compareTicketsByPriorityThenSla), [filteredTickets]);

  // Ekip arkadaşları — mevcut kullanıcıyla aynı ekiptekilerin ticket sayıları
  const myTeammates = useMemo(() => {
    if (!user || agents.length === 0) return null;
    const me = agents.find((a) => String(a.id) === String(user.id));
    if (!me?.team) return null;
    return agents
      .filter((a) => a.team === me.team)
      .map((a) => ({
        ...a,
        openCount: tickets.filter((t) => t.assignedAgentId === a.id && !['RESOLVED', 'CLOSED'].includes(t.status)).length,
        isMe: String(a.id) === String(user.id),
      }))
      .sort((a, b) => b.openCount - a.openCount);
  }, [agents, user, tickets]);

  // Filtre değişince seçimi temizle
  useEffect(() => { setSelectedIds(new Set()); }, [ownerScope, statusFilter, priorityFilter, productFilter, teamFilter, dateFrom, dateTo]);

  function setOwnerTab(scope) {
    setOwnerScope(scope);
    const next = new URLSearchParams(location.search);
    next.delete('mine');
    if (view === 'kanban' && scope !== 'mine') {
      next.delete('view');
    }
    if (scope === 'mine') {
      next.set('mine', '1');
    }
    const qs = next.toString();
    navigate({ pathname: location.pathname, search: qs ? `?${qs}` : '' }, { replace: true });
  }

  async function handleClaimTicket(e, ticketId) {
    e.stopPropagation();
    if (!user?.id) return;
    setClaimingId(ticketId);
    setError('');
    try {
      await assignTicket(ticketId, user.id);
      if (pushToast) pushToast(`#${ticketId} üzerinize alındı`);
      await loadPage();
      setOwnerTab('mine');
    } catch {
      setError('Talep üzerinize alınamadı. Lütfen tekrar deneyin.');
    } finally {
      setClaimingId(null);
    }
  }

  async function applyTransition(ticketId, toStatus, note = '') {
    setTransitioning(ticketId);
    try {
      const updated = await updateTicketStatus(ticketId, toStatus, note);
      setTickets((list) => list.map((t) => (t.id === ticketId ? updated : t)));
      if (pushToast) pushToast(`#${ticketId} → ${STATUS_LABEL[toStatus] || toStatus}`);
    } catch (err) {
      const msg = err.response?.data?.message || err.response?.data?.detail || 'Durum güncellenemedi.';
      if (pushToast) pushToast(`Hata: ${msg}`);
    } finally {
      setTransitioning(null);
    }
  }

  function handleTransitionClick(e, ticketId, toStatus) {
    e.stopPropagation();
    if (toStatus === 'RESOLVED') {
      setResolveModal({ ticketId, toStatus });
      setResolveNote('');
    } else {
      applyTransition(ticketId, toStatus);
    }
  }

  async function confirmResolve() {
    if (!resolveModal) return;
    const note = resolveNote.trim();
    if (!note) { if (pushToast) pushToast('Çözüm notu zorunludur.'); return; }
    setResolveWorking(true);
    try {
      await applyTransition(resolveModal.ticketId, resolveModal.toStatus, note);
      setResolveModal(null);
      setResolveNote('');
    } finally {
      setResolveWorking(false);
    }
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="page-head">
          <div>
            <h1 className="page-title">Tüm Destek Talepleri</h1>
            <div className="page-sub">
              {view === 'kanban'
                ? 'Kanban görünümü · öncelik ve SLA durumuna göre sıralı'
                : view === 'sla'
                  ? `${visibleTickets.length} sonuç · SLA riski (öncelik ve SLA durumuna göre sıralı)`
                  : `${visibleTickets.length} sonuç · öncelik ve SLA durumuna göre sıralı`}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => exportCSV(visibleTickets, `talepler-${new Date().toISOString().slice(0,10)}.csv`)}
            disabled={loading || visibleTickets.length === 0}
            title="Görünümdeki talepleri CSV olarak indir"
          >
            ↓ CSV
          </button>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={loadPage}
            disabled={loading}
          >
            <Ic.Refresh size={13} /> Yenile
          </button>
        </div>

        <div className="view-tabs">
          <button
            type="button"
            className={`vt ${ownerScope === 'all' ? 'active' : ''}`}
            onClick={() => setOwnerTab('all')}
          >
            <span className="vt-label">Tümü</span>
            <span className="vt-count">{counts.all}</span>
          </button>
          <button
            type="button"
            className={`vt ${ownerScope === 'mine' ? 'active' : ''}`}
            onClick={() => setOwnerTab('mine')}
          >
            <span className="vt-label">Bende</span>
            <span className="vt-count accent">{counts.mine}</span>
          </button>
          <button
            type="button"
            className={`vt ${ownerScope === 'others' ? 'active' : ''}`}
            onClick={() => setOwnerTab('others')}
          >
            <span className="vt-label">Diğer Personelde</span>
            <span className="vt-count">{counts.others}</span>
          </button>
          <button
            type="button"
            className={`vt ${ownerScope === 'unassigned' ? 'active' : ''}`}
            onClick={() => setOwnerTab('unassigned')}
          >
            <span className="vt-label">Atanmamış</span>
            <span className="vt-count warn">{counts.unassigned}</span>
          </button>
        </div>

        <div className="card">
          <div className="fbar">
            <div className="seg">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  className={statusFilter === tab.key ? 'active' : ''}
                  onClick={() => setStatusFilter(tab.key)}
                  type="button"
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <div className="gap" />
            <select
              className="select"
              style={{ width: 150 }}
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">Öncelik: Tümü</option>
              <option value="HIGH">Yüksek</option>
              <option value="MEDIUM">Orta</option>
              <option value="LOW">Düşük</option>
            </select>
            <select
              className="select"
              style={{ width: 220 }}
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
            >
              <option value="all">Sistem: Tümü</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            {(() => {
              const teams = [...new Set(agents.map((a) => a.team).filter(Boolean))].sort();
              if (teams.length === 0) return null;
              return (
                <select
                  className="select"
                  style={{ width: 170 }}
                  value={teamFilter}
                  onChange={(e) => setTeamFilter(e.target.value)}
                >
                  <option value="all">Ekip: Tümü</option>
                  {teams.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              );
            })()}
            <div className="row" style={{ gap: 6, alignItems: 'center' }} title="Açılış tarihine göre filtrele">
              <Ic.Clock size={13} style={{ color: 'var(--text-3)' }} />
              <input type="date" className="select" style={{ width: 140, padding: '6px 8px' }}
                value={dateFrom} max={dateTo || undefined}
                onChange={(e) => setDateFrom(e.target.value)} />
              <span style={{ color: 'var(--text-3)', fontSize: 12 }}>–</span>
              <input type="date" className="select" style={{ width: 140, padding: '6px 8px' }}
                value={dateTo} min={dateFrom || undefined}
                onChange={(e) => setDateTo(e.target.value)} />
              {(dateFrom || dateTo) && (
                <button type="button" className="btn btn-sm btn-ghost" style={{ padding: '4px 8px' }}
                  onClick={() => { setDateFrom(''); setDateTo(''); }} title="Tarih filtresini temizle">
                  <Ic.X size={12} />
                </button>
              )}
            </div>
          </div>

          {error && (
            <div
              className="badge p-high"
              style={{ display: 'flex', margin: '12px 16px', padding: '8px 12px', gap: 8 }}
            >
              <Ic.AlertTriangle size={13} />
              {error}
            </div>
          )}

          {view === 'kanban' ? (
            <div style={{ overflowX: 'auto', padding: '12px 0' }}>
              <div className="kanban" style={{ minWidth: 1300 }}>
                {KANBAN_COLUMNS.map((status) => {
                  const colTickets = visibleTickets.filter((t) => t.status === status);
                  return (
                    <div key={status} className="kcol">
                      <div className="kcol-head">
                        <span className="lbl">{STATUS_LABEL[status] || status}</span>
                        <span className="ct">{colTickets.length}</span>
                      </div>
                      <div className="kcol-body">
                        {colTickets.length === 0 ? (
                          <EmptyState
                            type="tickets"
                            title="Talep yok"
                            sub="Bu sütunda henüz talep bulunmuyor."
                          />
                        ) : (
                          colTickets.map((ticket) => {
                            const transitions = STATUS_TRANSITIONS[ticket.status] || [];
                            const isBusy = transitioning === ticket.id;
                            return (
                              <div
                                key={ticket.id}
                                className="kcard"
                                onClick={() => setDrawerTicketId(ticket.id)}
                                style={{ cursor: 'pointer' }}
                              >
                                <div className="top">
                                  <span className="tag">#{ticket.id}</span>
                                  <PriorityBadge priority={ticket.priority} />
                                </div>
                                <div className="ttl">{ticket.title}</div>
                                <SlaBar ticket={ticket} />
                                <div className="foot">
                                  <span>{productMap.get(ticket.productId) || 'Ürün'}</span>
                                  <span>{ticket.createdByUsername || '-'}</span>
                                </div>
                                {transitions.length > 0 && (
                                  <div
                                    style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {transitions.map((tr) => (
                                      <button
                                        key={tr.value}
                                        type="button"
                                        className="btn btn-sm"
                                        style={{ fontSize: 11, padding: '2px 8px' }}
                                        disabled={isBusy}
                                        onClick={(e) => handleTransitionClick(e, ticket.id, tr.value)}
                                      >
                                        {isBusy ? '…' : `→ ${tr.label}`}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <>
            {/* ── Bulk action toolbar (Jira style) ── */}
            {selectedIds.size > 0 && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 0,
                background: 'var(--bg)', border: '1px solid var(--hairline)',
                borderRadius: 8, marginBottom: 8, overflow: 'hidden',
                boxShadow: '0 1px 4px rgba(0,0,0,.06)',
              }}>
                {/* Seçili sayı */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '0 14px', height: 40, borderRight: '1px solid var(--hairline)',
                  background: 'var(--accent-soft)',
                }}>
                  <input
                    type="checkbox" checked readOnly
                    style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
                    onClick={() => setSelectedIds(new Set())}
                  />
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                    {selectedIds.size} seçili
                  </span>
                </div>

                {/* Ayraç */}
                <div style={{ width: 1, height: 40, background: 'var(--hairline)' }} />

                {/* Benzer talepleri bul — sadece tek seçimde aktif */}
                <button
                  type="button"
                  disabled={selectedIds.size !== 1 || bulkWorking}
                  onClick={handleFindSimilar}
                  title={selectedIds.size !== 1 ? 'Tek bir ticket seçin' : 'AI ile benzer talepler bul'}
                  style={{
                    height: 40, border: 'none', background: 'transparent',
                    padding: '0 14px', fontSize: 13, cursor: selectedIds.size === 1 ? 'pointer' : 'not-allowed',
                    color: selectedIds.size === 1 ? 'var(--text-2)' : 'var(--text-4)',
                    fontWeight: 500, display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => { if (selectedIds.size === 1) e.currentTarget.style.background = 'var(--bg-soft)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  ✦ Benzer talepleri bul
                </button>

                <div style={{ width: 1, height: 40, background: 'var(--hairline)' }} />

                {/* Durum değiştir — dropdown trigger */}
                <div style={{ position: 'relative' }}>
                  <select
                    className="select"
                    style={{
                      height: 40, border: 'none', borderRadius: 0, background: 'transparent',
                      fontSize: 13, padding: '0 14px', cursor: 'pointer', fontWeight: 500,
                      color: 'var(--text-2)', appearance: 'none', paddingRight: 28,
                    }}
                    defaultValue=""
                    disabled={bulkWorking}
                    onChange={(e) => { if (e.target.value) { bulkStatus(e.target.value); e.target.value = ''; } }}
                  >
                    <option value="">→ Durum değişikliği</option>
                    <option value="IN_PROGRESS">İşleme Al</option>
                    <option value="WAITING_FOR_CUSTOMER">Müşteri Bekle</option>
                    <option value="RESOLVED">Çözüldü</option>
                  </select>
                </div>

                <div style={{ width: 1, height: 40, background: 'var(--hairline)' }} />

                {/* Ajan ata */}
                {isManager && agents.length > 0 && (
                  <>
                    <div style={{ position: 'relative' }}>
                      <select
                        className="select"
                        style={{
                          height: 40, border: 'none', borderRadius: 0, background: 'transparent',
                          fontSize: 13, padding: '0 14px', cursor: 'pointer', fontWeight: 500,
                          color: 'var(--text-2)', appearance: 'none', paddingRight: 28,
                        }}
                        defaultValue=""
                        disabled={bulkWorking}
                        onChange={(e) => { if (e.target.value) { bulkAssign(e.target.value); e.target.value = ''; } }}
                      >
                        <option value="">⊙ Atayın</option>
                        {agents.map((a) => (
                          <option key={a.id} value={a.id}>{a.name || a.username}</option>
                        ))}
                      </select>
                    </div>
                    <div style={{ width: 1, height: 40, background: 'var(--hairline)' }} />
                  </>
                )}

                {/* Seçimi temizle */}
                <button
                  type="button"
                  onClick={() => setSelectedIds(new Set())}
                  style={{
                    height: 40, border: 'none', background: 'transparent',
                    padding: '0 14px', fontSize: 13, cursor: 'pointer',
                    color: 'var(--text-3)', fontWeight: 500,
                  }}
                  onMouseEnter={(e) => e.target.style.background = 'var(--bg-soft)'}
                  onMouseLeave={(e) => e.target.style.background = 'transparent'}
                >
                  ✕ Seçimi temizle
                </button>
              </div>
            )}
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      style={{ cursor: 'pointer' }}
                      checked={visibleTickets.length > 0 && selectedIds.size === visibleTickets.length}
                      ref={(el) => { if (el) el.indeterminate = selectedIds.size > 0 && selectedIds.size < visibleTickets.length; }}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th style={{ width: 90 }}>ID</th>
                  <th>Başlık</th>
                  <th style={{ width: 130 }}>Durum</th>
                  <th style={{ width: 90 }}>Öncelik</th>
                  <th style={{ width: 160 }}>SLA</th>
                  <th style={{ width: 120 }}>Açıldı</th>
                  <th style={{ width: 150 }}>Müşteri</th>
                  {(ownerScope === 'all' || ownerScope === 'others') && <th style={{ width: 140 }}>Atanan</th>}
                  {ownerScope === 'unassigned' && <th style={{ width: 130 }}>Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={ownerScope === 'unassigned' ? 7 : 6} style={{ padding: 0 }}>
                      <SkeletonTable rows={6} cols={5} />
                    </td>
                  </tr>
                ) : visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan={ownerScope === 'unassigned' ? 7 : 7}>
                      <EmptyState
                        type="search"
                        title="Talep bulunamadı"
                        sub="Seçili filtrelerle eşleşen talep yok. Filtreleri değiştirmeyi deneyin."
                      />
                    </td>
                  </tr>
                ) : (
                  visibleTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => setDrawerTicketId(ticket.id)}
                      style={{ cursor: 'pointer', background: selectedIds.has(ticket.id) ? 'var(--accent-soft)' : undefined }}
                    >
                      <td onClick={(e) => e.stopPropagation()} style={{ padding: '0 10px' }}>
                        <input
                          type="checkbox"
                          style={{ cursor: 'pointer' }}
                          checked={selectedIds.has(ticket.id)}
                          onChange={(e) => toggleSelect(ticket.id, e)}
                        />
                      </td>
                      <td className="id">#{ticket.id}</td>
                      <td className="ttl">
                        <button
                          type="button"
                          onClick={(e) => handleToggleFavorite(e, ticket.id)}
                          title={favorites.has(ticket.id) ? 'Favorilerden çıkar' : 'Favorilere ekle'}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                            marginRight: 8, verticalAlign: 'middle',
                            color: favorites.has(ticket.id) ? '#f59e0b' : 'var(--text-3)',
                          }}
                        >
                          <Ic.Star size={15} fill={favorites.has(ticket.id) ? 'currentColor' : 'none'} />
                        </button>
                        {ticket.title}
                        <span className="lbl">
                          {' '}
                          · {productMap.get(ticket.productId) || 'Ürün'}
                        </span>
                      </td>
                      <td>
                        <StatusBadge status={ticket.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={ticket.priority} />
                      </td>
                      <td>
                        <SlaBar ticket={ticket} />
                      </td>
                      <td className="meta">{fmtDate(ticket.createdAt, 'datetime')}</td>
                      <td className="meta">{ticket.createdByUsername || '-'}</td>
                      {(ownerScope === 'all' || ownerScope === 'others') && (
                        <td className="meta">
                          {ticket.assignedAgentName ? (
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span>{ticket.assignedAgentName}</span>
                              {(() => {
                                const ag = agents.find((a) => a.id === ticket.assignedAgentId);
                                return ag?.team ? <TeamBadge team={ag.team} /> : null;
                              })()}
                            </span>
                          ) : <span className="muted">—</span>}
                        </td>
                      )}
                      {ownerScope === 'unassigned' && (
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-accent"
                            onClick={(e) => handleClaimTicket(e, ticket.id)}
                            disabled={claimingId === ticket.id}
                          >
                            <Ic.Check size={12} />
                            {claimingId === ticket.id ? 'Alınıyor…' : 'Üzerime Al'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            </>
          )}
        </div>

        <div className="muted" style={{ marginTop: 12, fontSize: 12 }}>
          Son güncelleme: {fmtDate(Date.now(), 'datetime')}
        </div>
      </div>

      {resolveModal && (
        <div className="scrim" role="presentation" onClick={() => { if (!resolveWorking) { setResolveModal(null); setResolveNote(''); } }}>
          <div role="dialog" aria-modal="true" className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head">
              <h3>Çözüm notu gerekli</h3>
            </div>
            <div className="dialog-body">
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                #{resolveModal.ticketId} talep Çözüldü durumuna taşınıyor. Açıklama zorunludur.
              </p>
              <textarea
                className="textarea"
                rows={4}
                placeholder="Çözüm notunu yazın…"
                value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)}
                disabled={resolveWorking}
                maxLength={2000}
                autoFocus
              />
            </div>
            <div className="dialog-foot">
              <button type="button" className="btn btn-ghost" disabled={resolveWorking}
                onClick={() => { setResolveModal(null); setResolveNote(''); }}>
                Vazgeç
              </button>
              <button type="button" className="btn btn-accent" disabled={resolveWorking} onClick={confirmResolve}>
                {resolveWorking ? 'Kaydediliyor…' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ticket Drawer ── */}
      {drawerTicketId && (
        <TicketDrawer
          ticketId={drawerTicketId}
          onClose={() => setDrawerTicketId(null)}
          onTicketUpdated={(updated) => {
            setTickets((prev) => prev.map((t) => t.id === updated.id ? updated : t));
          }}
        />
      )}

      {/* ── Benzer Talepler Modalı ── */}
      {similarModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 300,
            background: 'rgba(0,0,0,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            animation: 'fadeIn .15s ease',
          }}
          onClick={() => { if (!similarModal.loading) setSimilarModal(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--bg)', borderRadius: 12, width: 520,
              maxWidth: '90vw', maxHeight: '80vh', display: 'flex', flexDirection: 'column',
              boxShadow: '0 20px 60px rgba(0,0,0,.3)',
              border: '1px solid var(--hairline)',
            }}
          >
            {/* Header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: 15 }}>✦ Benzer Talepler</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  #{similarModal.sourceTicket?.id} — {similarModal.sourceTicket?.title}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSimilarModal(null)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: 'var(--text-3)', lineHeight: 1, padding: 4 }}
              >×</button>
            </div>

            {/* Body */}
            <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
              {similarModal.loading ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                  <div style={{ fontSize: 28, marginBottom: 12 }}>✦</div>
                  <div style={{ fontSize: 14 }}>Gemini AI analiz ediyor…</div>
                </div>
              ) : similarModal.error ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--danger)' }}>
                  {similarModal.error}
                </div>
              ) : similarModal.results.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)' }}>
                  Benzer talep bulunamadı.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {similarModal.results.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => { setSimilarModal(null); setDrawerTicketId(item.id); }}
                      style={{
                        padding: '12px 16px', borderRadius: 8, border: '1px solid var(--hairline)',
                        cursor: 'pointer', transition: 'background .15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-soft)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = ''}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 600 }}>#{item.id}</span>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{item.ticket?.title ?? `Talep #${item.id}`}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{item.reason}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
