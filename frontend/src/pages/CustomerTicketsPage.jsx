import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import Ic from '../components/Icons';
import {
  PriorityBadge,
  SlaBar,
  STATUS,
  StatusBadge,
  fmtDate,
} from '../components/Common';
import { getProducts, getTickets } from '../services/api';

const STATUS_TABS = [
  { key: 'all', label: 'Tümü' },
  { key: 'NEW', label: 'Yeni' },
  { key: 'IN_PROGRESS', label: 'İşlemde' },
  { key: 'WAITING_FOR_CUSTOMER', label: 'Bekleniyor' },
  { key: 'RESOLVED', label: 'Çözüldü' },
];

export default function CustomerTicketsPage() {
  const navigate = useNavigate();
  const { search = '' } = useOutletContext() || {};
  const [tickets, setTickets] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [ticketData, productData] = await Promise.all([
          getTickets(),
          getProducts(),
        ]);
        if (cancelled) return;
        setTickets(ticketData);
        setProducts(productData);
      } catch {
        if (!cancelled) setError('Talepler yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const productMap = useMemo(() => {
    const m = new Map();
    products.forEach((p) => m.set(p.id, p));
    return m;
  }, [products]);

  const filtered = useMemo(() => {
    const q = (search || '').trim().toLowerCase();
    return tickets.filter((t) => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (productFilter !== 'all' && String(t.productId) !== String(productFilter)) return false;
      if (q) {
        const hay = `${t.id} ${t.title || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [tickets, statusFilter, priorityFilter, productFilter, search]);

  const stats = useMemo(() => {
    const open = tickets.filter((t) => !['RESOLVED', 'CLOSED'].includes(t.status)).length;
    const waiting = tickets.filter((t) => t.status === 'WAITING_FOR_CUSTOMER').length;
    const resolved = tickets.filter((t) => ['RESOLVED', 'CLOSED'].includes(t.status)).length;
    return { open, waiting, resolved };
  }, [tickets]);

  const activeFilters =
    (priorityFilter !== 'all' ? 1 : 0) + (productFilter !== 'all' ? 1 : 0);

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="page-head">
          <div>
            <h1 className="page-title">Taleplerim</h1>
            <div className="page-sub">Açtığınız destek taleplerini buradan takip edin.</div>
          </div>
          <div className="page-actions">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => navigate('/customer/tickets/new')}
            >
              <Ic.Plus size={14} /> Yeni Talep
            </button>
          </div>
        </div>

        <div className="h-grid-3" style={{ marginBottom: 22 }}>
          <div className="card stat">
            <div className="stat-label">Açık Talepler</div>
            <div className="stat-val">{stats.open}</div>
            <div className="stat-trend">aktif olarak takip edilenler</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Yanıt Bekleyen</div>
            <div className="stat-val">{stats.waiting}</div>
            <div className="stat-trend">yanıtınızı bekliyor</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Çözülen</div>
            <div className="stat-val">{stats.resolved}</div>
            <div className="stat-trend up">tamamlanmış</div>
          </div>
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
              style={{ width: 160 }}
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
            {activeFilters > 0 && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setPriorityFilter('all');
                  setProductFilter('all');
                }}
              >
                <Ic.X size={12} /> Filtreleri temizle
              </button>
            )}
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

          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 90 }}>ID</th>
                <th>Başlık</th>
                <th style={{ width: 140 }}>Durum</th>
                <th style={{ width: 100 }}>Öncelik</th>
                <th style={{ width: 160 }}>SLA</th>
                <th style={{ width: 120 }}>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" className="muted" style={{ padding: '40px', textAlign: 'center' }}>
                    Talepler yükleniyor…
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="muted" style={{ padding: '40px', textAlign: 'center' }}>
                    Bu filtreye uygun talep bulunamadı.
                  </td>
                </tr>
              ) : (
                filtered.map((t) => {
                  const product = productMap.get(t.productId);
                  return (
                    <tr key={t.id} onClick={() => navigate(`/customer/tickets/${t.id}`)}>
                      <td className="id">#{t.id}</td>
                      <td className="ttl">
                        {t.title}
                        {product && <span className="lbl"> · {product.name}</span>}
                      </td>
                      <td>
                        <StatusBadge status={t.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={t.priority} />
                      </td>
                      <td>
                        <SlaBar ticket={t} />
                      </td>
                      <td className="meta">{fmtDate(t.createdAt)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div
          className="muted"
          style={{ marginTop: 14, fontSize: 12, display: 'flex', justifyContent: 'space-between' }}
        >
          <span>Toplam {filtered.length} talep listeleniyor.</span>
          <span>
            Aktif durum: <b style={{ color: 'var(--text-2)' }}>{statusFilter === 'all' ? 'Tümü' : STATUS[statusFilter]?.label}</b>
          </span>
        </div>
      </div>
    </div>
  );
}
