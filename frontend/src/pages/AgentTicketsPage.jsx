import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import { EmptyState, PriorityBadge, SlaBar, SkeletonTable, StatusBadge, fmtDate, slaInfo } from '../components/Common';
import {
  assignTicket,
  getCurrentUserProfile,
  getProducts,
  getTickets,
  updateTicketStatus,
} from '../services/api';

/** @typedef {'all'|'mine'|'others'|'unassigned'} OwnerScope */

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

const KANBAN_COLUMNS = ['NEW', 'IN_PROGRESS', 'WAITING_FOR_CUSTOMER', 'RESOLVED', 'CLOSED'];

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
  const [loading, setLoading] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [error, setError] = useState('');
  const [transitioning, setTransitioning] = useState(/** @type {number|null} */ (null));
  const [resolveModal, setResolveModal] = useState(/** @type {null|{ticketId:number,toStatus:string}} */ (null));
  const [resolveNote, setResolveNote] = useState('');
  const [resolveWorking, setResolveWorking] = useState(false);

  async function loadPage() {
    setLoading(true);
    setError('');
    try {
      const [userData, ticketData, productData] = await Promise.all([
        getCurrentUserProfile(),
        getTickets(),
        getProducts(),
      ]);
      setUser(userData);
      setTickets(ticketData);
      setProducts(productData);
    } catch {
      setError('Talepler yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPage();
  }, []);

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
      if (view === 'sla') {
        const s = slaInfo(ticket).state;
        if (s !== 'warn' && s !== 'bad') return false;
      }
      if (statusFilter !== 'all' && ticket.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && ticket.priority !== priorityFilter) return false;
      if (productFilter !== 'all' && String(ticket.productId) !== String(productFilter)) return false;
      if (q) {
        const text = `${ticket.id} ${ticket.title || ''} ${ticket.createdByUsername || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [ownerScope, tickets, user, statusFilter, priorityFilter, productFilter, search, view]);

  const visibleTickets = useMemo(() => [...filteredTickets].sort(compareTicketsByPriorityThenSla), [filteredTickets]);

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
                                onClick={() => navigate(`/agent/tickets/${ticket.id}`)}
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
            <table className="tbl">
              <thead>
                <tr>
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
                    <tr key={ticket.id} onClick={() => navigate(`/agent/tickets/${ticket.id}`)}>
                      <td className="id">#{ticket.id}</td>
                      <td className="ttl">
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
                        <td className="meta">{ticket.assignedAgentName || <span className="muted">—</span>}</td>
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
    </div>
  );
}
