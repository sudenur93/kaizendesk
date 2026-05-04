import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Ic from '../components/Icons';

const KEYCLOAK_ADMIN_TOKEN = '/auth/realms/master/protocol/openid-connect/token';
const KEYCLOAK_ADMIN_USERS = '/auth/admin/realms/kaizendesk/users';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const adminParams = new URLSearchParams();
      adminParams.append('client_id', 'kaizendesk-app');
      adminParams.append('grant_type', 'password');
      adminParams.append('username', 'admin');
      adminParams.append('password', 'admin');

      const adminRes = await axios.post(KEYCLOAK_ADMIN_TOKEN, adminParams);
      const adminToken = adminRes.data.access_token;

      const usersRes = await axios.get(
        `${KEYCLOAK_ADMIN_USERS}?email=${encodeURIComponent(email)}`,
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );

      if (usersRes.data.length === 0) {
        setError('Bu e-posta adresine ait hesap bulunamadı.');
        return;
      }

      const userId = usersRes.data[0].id;

      await axios.put(
        `${KEYCLOAK_ADMIN_USERS}/${userId}`,
        { requiredActions: ['UPDATE_PASSWORD'] },
        { headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' } }
      );

      setSuccess(
        'Şifre sıfırlama talebi oluşturuldu. Bir sonraki girişinizde yeni şifre belirlemeniz istenecektir.'
      );
    } catch {
      setError('İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login">
      <div className="login-left">
        <div className="login-brand-l">
          <div className="logo">K</div>
          <div className="name">
            <b>KaizenDesk</b>
            <small>Ticket Yönetim Sistemi</small>
          </div>
        </div>
      </div>
      <div className="login-right">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Şifre Sıfırlama</h1>
          <p className="sub">Kayıtlı e-posta ile reset işlemi başlatılır.</p>

          {error && (
            <div className="badge p-high" style={{ display: 'flex', padding: '8px 12px', marginBottom: 16, gap: 8 }}>
              <Ic.AlertTriangle size={13} />
              {error}
            </div>
          )}
          {success && (
            <div className="badge s-resolved" style={{ display: 'flex', padding: '8px 12px', marginBottom: 16, gap: 8 }}>
              <Ic.Check size={13} />
              {success}
            </div>
          )}

          <div className="field">
            <label className="field-label">E-posta Adresiniz</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>

          <button type="submit" className="btn btn-accent" style={{ justifyContent: 'center', marginTop: 14 }} disabled={loading}>
            <Ic.Lock size={14} />
            {loading ? 'Gönderiliyor…' : 'Sıfırlama Talebi Gönder'}
          </button>

          <div className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/login">← Giriş sayfasına dön</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
