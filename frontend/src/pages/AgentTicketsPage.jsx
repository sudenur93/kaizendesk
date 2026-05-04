import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import { PriorityBadge, SlaBar, StatusBadge, fmtDate, slaInfo } from '../components/Common';
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

/** Backend TicketService.isAllowedTransition ile uyumlu (tek adım kenarları). */
const STATUS_NEXT = {
  NEW: ['IN_PROGRESS'],
  IN_PROGRESS: ['WAITING_FOR_CUSTOMER', 'RESOLVED'],
  WAITING_FOR_CUSTOMER: ['IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['CLOSED'],
  CLOSED: [],
};

const KANBAN_RESOLVED_NOTE = 'Kanban tahtasından taşındı.';

/**
 * from → to için sırayla PATCH edilecek hedef durumlar (from hariç).
 * Örn. NEW→RESOLVED → ["IN_PROGRESS","RESOLVED"]
 */
function kanbanStatusChain(fromStatus, toStatus) {
  if (fromStatus === toStatus) return [];
  const queue = [fromStatus];
  const prev = /** @type {Record<string, string|null>} */ ({ [fromStatus]: null });

  while (queue.length > 0) {
    const cur = /** @type {string} */ (queue.shift());
    for (const nxt of STATUS_NEXT[cur] || []) {
      if (Object.prototype.hasOwnProperty.call(prev, nxt)) continue;
      prev[nxt] = cur;
      if (nxt === toStatus) {
        const chain = [];
        let walk = /** @type {string|null} */ (toStatus);
        while (walk != null && walk !== fromStatus) {
          chain.unshift(walk);
          walk = prev[walk] ?? null;
        }
        if (walk !== fromStatus) return null;
        return chain;
      }
      queue.push(nxt);
    }
  }
  return null;
}

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
  const [dragId, setDragId] = useState(null);
  const [overCol, setOverCol] = useState(null);
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

  function allowDrop(e, status) {
    const dt = e.dataTransfer;
    if (!dt) return;
    e.preventDefault();
    try {
      dt.dropEffect = 'move';
    } catch {
      /* ignore */
    }
    setOverCol(status);
  }

  function handleDragStart(e, ticketId) {
    setDragId(ticketId);
    const dt = e.dataTransfer;
    if (dt) {
      dt.effectAllowed = 'move';
      try {
        dt.setData('text/plain', String(ticketId));
      } catch {
        /* Safari */
      }
    }
  }

  function handleDragEnd() {
    setDragId(null);
    setOverCol(null);
  }

  function handleDragLeave(e, status) {
    const next = /** @type {Node|null} */ (e.relatedTarget);
    if (next && e.currentTarget.contains(next)) return;
    setOverCol((prev) => (prev === status ? null : prev));
  }

  async function handleDrop(e, targetStatus) {
    e.preventDefault();
    e.stopPropagation();
    setOverCol(null);

    const raw = e.dataTransfer?.getData('text/plain')?.trim?.() ?? '';
    let id = Number.parseInt(raw, 10);
    if (!Number.isFinite(id) && dragId != null)
      id = Number.parseInt(String(dragId), 10);

    /* drag görselinden kalan stale state */
    setDragId(null);
    if (!Number.isFinite(id)) return;

    const ticket = tickets.find((t) => Number(t.id) === id);
    if (!ticket || ticket.status === targetStatus) return;

    const chain = kanbanStatusChain(String(ticket.status), String(targetStatus));
    if (chain === null) {
      if (pushToast) pushToast('Bu kartı bu kolona taşıyamazsınız.');
      return;
    }
    if (!chain.length) return;

    const prevSnapshot = [...tickets];
    setTickets((list) =>
      list.map((t) => (Number(t.id) === id ? { ...t, status: targetStatus } : t)),
    );

    try {
      let updated = ticket;
      for (const step of chain) {
        updated = await updateTicketStatus(
          id,
          step,
          step === 'RESOLVED' ? KANBAN_RESOLVED_NOTE : '',
        );
      }
      const finalTicket = updated;
      setTickets((list) =>
        list.map((t) => (Number(t.id) === id ? finalTicket : t)),
      );
      if (pushToast)
        pushToast(`#${id} → ${STATUS_LABEL[targetStatus] || targetStatus}`);
    } catch (err) {
      setTickets(prevSnapshot);
      const msg =
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'Geçiş başarısız.';
      if (pushToast) pushToast(`Hata: ${msg}`);
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
            <div className="kanban" style={{ padding: 12 }}>
              {KANBAN_COLUMNS.map((status) => {
                const colTickets = visibleTickets.filter((t) => t.status === status);
                const isOver = overCol === status;
                return (
                  <div
                    key={status}
                    className={'kcol' + (isOver ? ' over' : '')}
                    onDragEnterCapture={(e) => allowDrop(e, status)}
                    onDragOverCapture={(e) => allowDrop(e, status)}
                    onDragLeave={(e) => handleDragLeave(e, status)}
                    onDrop={(e) => handleDrop(e, status)}
                  >
                    <div className="kcol-head">
                      <span className="lbl">{STATUS_LABEL[status] || status}</span>
                      <span className="ct">{colTickets.length}</span>
                    </div>
                    <div className="kcol-body">
                      {colTickets.length === 0 ? (
                        <div
                          className="muted"
                          style={{
                            fontSize: 12, textAlign: 'center', padding: 16,
                            border: isOver ? '2px dashed var(--accent)' : '2px dashed transparent',
                            borderRadius: 6, transition: 'border-color .15s',
                          }}
                        >
                          {isOver ? 'Buraya bırak' : 'Ticket yok'}
                        </div>
                      ) : (
                        colTickets.map((ticket) => {
                          const isDragging =
                            dragId !== null &&
                            dragId !== undefined &&
                            String(dragId) === String(ticket.id);
                          return (
                            <div
                              key={ticket.id}
                              className={'kcard' + (isDragging ? ' drag' : '')}
                              draggable
                              onDragStart={(e) => handleDragStart(e, ticket.id)}
                              onDragEnd={handleDragEnd}
                              onClick={() => navigate(`/agent/tickets/${ticket.id}`)}
                              style={{ cursor: 'grab' }}
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
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
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
                  <th style={{ width: 150 }}>Müşteri</th>
                  {(ownerScope === 'all' || ownerScope === 'others') && <th style={{ width: 140 }}>Atanan</th>}
                  {ownerScope === 'unassigned' && <th style={{ width: 130 }}>Aksiyon</th>}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={ownerScope === 'unassigned' ? 7 : ownerScope === 'all' || ownerScope === 'others' ? 7 : 6} className="muted" style={{ padding: 40, textAlign: 'center' }}>
                      Talepler yükleniyor…
                    </td>
                  </tr>
                ) : visibleTickets.length === 0 ? (
                  <tr>
                    <td colSpan={ownerScope === 'unassigned' ? 7 : ownerScope === 'all' || ownerScope === 'others' ? 7 : 6} className="muted" style={{ padding: 40, textAlign: 'center' }}>
                      Bu sekmede görüntülenecek talep yok.
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
    </div>
  );
}
