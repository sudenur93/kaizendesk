import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Ic from '../components/Icons';
import { EmptyState, PriorityBadge, SkeletonTable, fmtDate } from '../components/Common';
import { getRole, getTickets } from '../services/api';

export default function ArchivePage() {
  const navigate = useNavigate();
  const isCustomer = getRole() === 'CUSTOMER';
  const detailPath = (id) => isCustomer ? `/customer/tickets/${id}` : `/agent/tickets/${id}`;
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await getTickets();
        setTickets(data.filter((t) => t.archived));
      } catch {
        setError('Arşiv yüklenemedi.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) =>
      `${t.id} ${t.title || ''} ${t.createdByUsername || ''}`.toLowerCase().includes(q)
    );
  }, [tickets, search]);

  return (
    <div className="page-content" style={{ padding: '24px 32px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Arşiv</h1>
          <div className="sub" style={{ marginTop: 2 }}>Kapatılan talepler</div>
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

      {/* Stats */}
      <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--text-2)' }}>
        {!loading && (
          <span>
            <strong style={{ color: 'var(--text)' }}>{tickets.length}</strong> kapalı talep
            {search && `, ${visible.length} sonuç`}
          </span>
        )}
      </div>

      {/* Table */}
      {error && <div className="alert alert-err">{error}</div>}

      {loading ? (
        <SkeletonTable rows={8} cols={5} />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Ic.Archive size={32} />} title="Arşiv boş" sub={search ? 'Arama kriterine uygun talep bulunamadı.' : 'Henüz kapatılan talep yok.'} />
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>#</th>
                <th>Başlık</th>
                <th>Öncelik</th>
                <th>Oluşturan</th>
                <th>Atanan</th>
                <th>Kapatılma</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((t) => (
                <tr
                  key={t.id}
                  style={{ cursor: 'pointer', opacity: 0.85 }}
                  onClick={() => navigate(detailPath(t.id))}
                >
                  <td className="mono" style={{ color: 'var(--text-3)', fontSize: 12 }}>#{t.id}</td>
                  <td style={{ maxWidth: 320 }}>
                    <div style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.title}
                    </div>
                    {t.ticketNo && (
                      <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{t.ticketNo}</div>
                    )}
                  </td>
                  <td><PriorityBadge priority={t.priority} /></td>
                  <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.createdByUsername || '—'}</td>
                  <td style={{ fontSize: 13, color: 'var(--text-2)' }}>{t.assignedAgentName || <span style={{ color: 'var(--text-3)' }}>—</span>}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-3)' }}>{t.closedAt ? fmtDate(t.closedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
