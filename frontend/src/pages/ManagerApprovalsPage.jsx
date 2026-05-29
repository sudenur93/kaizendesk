import { useEffect, useState } from 'react';
import Ic from '../components/Icons';
import { Avatar, EmptyState, SkeletonTable, getInitials, fmtDate } from '../components/Common';
import { getPendingUsers, approveUser, rejectUser } from '../services/api';
import { useOutletContext } from 'react-router-dom';

export default function ManagerApprovalsPage() {
  const { pushToast } = useOutletContext() || {};
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const data = await getPendingUsers();
      setUsers(data);
    } catch {
      setError('Kullanıcılar yüklenemedi.');
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(user) {
    setProcessing(user.id);
    try {
      await approveUser(user.id);
      setUsers((u) => u.filter((x) => x.id !== user.id));
      if (pushToast) pushToast(`${user.firstName} ${user.lastName} onaylandı ✓`);
    } catch {
      if (pushToast) pushToast('Onaylama başarısız.');
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(user) {
    if (!window.confirm(`${user.firstName} ${user.lastName} reddedilsin mi? Hesap silinecek.`)) return;
    setProcessing(user.id);
    try {
      await rejectUser(user.id);
      setUsers((u) => u.filter((x) => x.id !== user.id));
      if (pushToast) pushToast(`${user.firstName} ${user.lastName} reddedildi.`);
    } catch {
      if (pushToast) pushToast('Reddetme başarısız.');
    } finally {
      setProcessing(null);
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Onay Bekleyenler</h1>
          <div className="page-sub">{users.length} kullanıcı onay bekliyor</div>
        </div>
        <button type="button" className="btn btn-sm btn-ghost" onClick={load}>
          <Ic.Refresh size={13} /> Yenile
        </button>
      </div>

      {error && (
        <div className="badge p-high" style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}>
          <Ic.AlertTriangle size={13} /> {error}
        </div>
      )}

      <div className="card">
        <table className="tbl">
          <thead>
            <tr>
              <th>Kullanıcı</th>
              <th>Kullanıcı Adı</th>
              <th>E-posta</th>
              <th style={{ width: 160 }}>Kayıt Tarihi</th>
              <th style={{ width: 160, textAlign: 'right' }}>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="5" style={{ padding: 0 }}><SkeletonTable rows={4} cols={4} /></td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan="5">
                <EmptyState type="done" title="Onay bekleyen yok" sub="Tüm kayıt talepleri işlendi." />
              </td></tr>
            ) : (
              users.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className="row" style={{ gap: 8 }}>
                      <Avatar initials={getInitials(`${u.firstName || ''} ${u.lastName || ''}`)} size="sm" />
                      <span style={{ fontSize: 13, fontWeight: 500 }}>
                        {u.firstName} {u.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="mono" style={{ fontSize: 12 }}>{u.username}</td>
                  <td style={{ fontSize: 12, color: 'var(--text-2)' }}>{u.email}</td>
                  <td className="muted" style={{ fontSize: 12 }}>
                    {u.createdTimestamp ? fmtDate(u.createdTimestamp) : '—'}
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6, justifyContent: 'flex-end' }}>
                      <button
                        type="button"
                        className="btn btn-sm"
                        style={{ background: 'var(--ok)', color: '#fff', border: 0 }}
                        onClick={() => handleApprove(u)}
                        disabled={processing === u.id}
                      >
                        <Ic.Check size={12} /> Onayla
                      </button>
                      <button
                        type="button"
                        className="btn btn-sm btn-ghost"
                        style={{ color: 'var(--err)' }}
                        onClick={() => handleReject(u)}
                        disabled={processing === u.id}
                      >
                        <Ic.AlertTriangle size={12} /> Reddet
                      </button>
                    </div>
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
