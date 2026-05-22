import { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import Ic from '../components/Icons';

const KC_ADMIN_TOKEN = '/auth/realms/master/protocol/openid-connect/token';
const KC_ADMIN_USERS = '/auth/admin/realms/kaizendesk/users';
const KC_ADMIN_REALM = '/auth/admin/realms/kaizendesk';

async function getAdminToken() {
  const params = new URLSearchParams();
  params.append('client_id', 'admin-cli');
  params.append('grant_type', 'password');
  params.append('username', 'admin');
  params.append('password', 'admin');
  const res = await axios.post(KC_ADMIN_TOKEN, params);
  return res.data.access_token;
}

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
      const adminToken = await getAdminToken();
      const authHeaders = { Authorization: `Bearer ${adminToken}` };

      // Kullanıcıyı e-posta ile bul
      const usersRes = await axios.get(
        `${KC_ADMIN_USERS}?email=${encodeURIComponent(email)}&exact=true`,
        { headers: authHeaders }
      );

      if (!usersRes.data?.length) {
        setError('Bu e-posta adresine ait hesap bulunamadı.');
        return;
      }

      const userId = usersRes.data[0].id;

      // Şifre sıfırlama e-postası gönder
      await axios.put(
        `${KC_ADMIN_REALM}/users/${userId}/execute-actions-email`,
        ['UPDATE_PASSWORD'],
        { headers: { ...authHeaders, 'Content-Type': 'application/json' } }
      );

      setSuccess(
        'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi. Gelen kutunuzu kontrol edin.'
      );
    } catch (err) {
      if (err.response?.status === 400) {
        setError('E-posta gönderilemedi. Sunucu e-posta ayarları kontrol edilmeli.');
      } else {
        setError('İşlem gerçekleştirilemedi. Lütfen tekrar deneyin.');
      }
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
          <div className="eyebrow"><Ic.Lock size={11} /> Şifre Sıfırlama</div>
          <h1>Parolanızı sıfırlayın</h1>
          <p className="sub">
            Kayıtlı e-posta adresinizi girin, size sıfırlama bağlantısı gönderelim.
          </p>

          {error && (
            <div className="badge p-high" style={{ display: 'flex', padding: '8px 12px', marginBottom: 16, gap: 8 }}>
              <Ic.AlertTriangle size={13} /> {error}
            </div>
          )}
          {success && (
            <div className="badge s-resolved" style={{ display: 'flex', padding: '8px 12px', marginBottom: 16, gap: 8 }}>
              <Ic.Check size={13} /> {success}
            </div>
          )}

          <div className="col" style={{ gap: 16 }}>
            <div className="field">
              <label className="field-label">E-posta Adresiniz</label>
              <div className="input-row">
                <span className="ic-l"><Ic.Mail size={15} /></span>
                <input
                  className="input" type="email" placeholder="ornek@kaizendesk.local"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoFocus disabled={loading || !!success}
                />
              </div>
            </div>

            {!success && (
              <button type="submit" className="btn btn-accent"
                style={{ justifyContent: 'center', padding: 13, fontSize: 14 }}
                disabled={loading}>
                <Ic.Lock size={14} />
                {loading ? 'Gönderiliyor…' : 'Sıfırlama Bağlantısı Gönder'}
              </button>
            )}

            <div className="muted" style={{ textAlign: 'center', fontSize: 12.5 }}>
              <Link to="/login">← Giriş sayfasına dön</Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
