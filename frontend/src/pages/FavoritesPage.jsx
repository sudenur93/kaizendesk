import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Ic from '../components/Icons';
import { EmptyState, PriorityBadge, StatusBadge, SkeletonTable, fmtDate } from '../components/Common';
import { getRole, getTickets } from '../services/api';
import { getFavorites, toggleFavorite } from '../favorites';

export default function FavoritesPage() {
  const navigate = useNavigate();
  const isCustomer = getRole() === 'CUSTOMER';
  const detailPath = (id) => (isCustomer ? `/customer/tickets/${id}` : `/agent/tickets/${id}`);

  const [tickets, setTickets] = useState([]);
  const [favorites, setFavoritesState] = useState(getFavorites);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getTickets();
        setTickets(data);
      } catch {
        setError('Talepler yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Favori değişimini dinle
  useEffect(() => {
    const sync = () => setFavoritesState(getFavorites());
    window.addEventListener('favorites-change', sync);
    return () => window.removeEventListener('favorites-change', sync);
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets
      .filter((t) => favorites.has(t.id))
      .filter((t) => !q || `${t.id} ${t.title || ''} ${t.createdByUsername || ''}`.toLowerCase().includes(q));
  }, [tickets, favorites, search]);

  return (
    <div className="page-content" style={{ padding: '24px 32px' }}>
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Ic.Star size={18} fill="#f59e0b" /> Favoriler
          </h1>
          <div className="sub" style={{ marginTop: 2 }}>Yıldızladığınız talepler</div>
        </div>
        <div className="spacer" />
        <div style={{ position: 'relative' }}>
          <Ic.Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} />
          <input
            className="input"
            style={{ paddingLeft: 30, width: 220, fontSize: 13 }}
            placeholder="Ara…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {error && <div className="alert alert-err">{error}</div>}

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={<Ic.Star size={32} />}
          title={favorites.size === 0 ? 'Henüz favori talebiniz yok' : 'Sonuç bulunamadı'}
          sub={favorites.size === 0
            ? 'Talep listesinde başlığın yanındaki ⭐ simgesine tıklayarak favorilere ekleyebilirsiniz.'
            : 'Arama kriterine uygun favori talep yok.'}
        />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th style={{ width: 40 }}></th>
                <th>#</th>
                <th>Başlık</th>
                <th>Durum</th>
                <th>Öncelik</th>
                <th>Tarih</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr key={t.id} style={{ cursor: 'pointer' }} onClick={() => navigate(detailPath(t.id))}>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(t.id)}
                      title="Favorilerden çıkar"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#f59e0b' }}
                    >
                      <Ic.Star size={15} fill="currentColor" />
                    </button>
                  </td>
                  <td className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>#{t.id}</td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </div>
                    {t.ticketNo && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.ticketNo}</div>}
                  </td>
                  <td><StatusBadge status={t.status} /></td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
