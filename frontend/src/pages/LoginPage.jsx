import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Ic from '../components/Icons';
import { login } from '../services/api';

const PILLARS = [
  {
    num: '01',
    title: 'Tek Platform, Tüm Talepler',
    text:
      'Üretim hatlarından gelen tüm destek taleplerini tek bir merkezden takip edin, atayın ve sonuçlandırın.',
  },
  {
    num: '02',
    title: 'SLA Odaklı İş Akışı',
    text:
      'Önceliğe göre otomatik hesaplanan SLA hedefleri, ihlal riskinde proaktif uyarılar.',
  },
  {
    num: '03',
    title: 'Şeffaf Süreç Yönetimi',
    text:
      'jBPM tabanlı yaşam döngüsü ile her adım izlenebilir, denetlenebilir ve standart.',
  },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!username || !password || loading) return;
    setError('');
    setLoading(true);
    try {
      const { role } = await login(username.trim(), password);
      if (role === 'MANAGER') navigate('/manager/dashboard');
      else if (role === 'AGENT') navigate('/agent/tickets');
      else navigate('/customer/tickets');
    } catch (err) {
      const desc = err.response?.data?.error_description;
      if (desc === 'Invalid user credentials') {
        setError('Kullanıcı adı veya parola hatalı.');
      } else if (desc === 'Account disabled') {
        setError('Hesabınız devre dışı bırakılmış.');
      } else {
        setError('Giriş yapılamadı. Lütfen tekrar deneyin.');
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

        <div className="pillars">
          {PILLARS.map((p) => (
            <div key={p.num} className="pillar">
              <div className="num">{p.num}</div>
              <div>
                <h4>{p.title}</h4>
                <p>{p.text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="login-foot">
          <span>© 2026 KaizenDesk</span>
          <span>v1.0.0</span>
        </div>
      </div>

      <div className="login-right">
        <form className="login-card" onSubmit={handleSubmit}>
          <h1>Tekrar hoş geldiniz</h1>
          <p className="sub">Devam etmek için kurumsal hesabınızla oturum açın.</p>

          {error && (
            <div
              className="badge p-high"
              style={{ display: 'flex', padding: '8px 12px', marginBottom: 16, gap: 8 }}
            >
              <Ic.AlertTriangle size={13} />
              {error}
            </div>
          )}

          <div className="col" style={{ gap: 14 }}>
            <div className="field">
              <label className="field-label">E-posta veya kullanıcı adı</label>
              <input
                className="input"
                type="text"
                placeholder="ornek@toyota.com"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={loading}
                autoFocus
                required
              />
            </div>
            <div className="field">
              <label className="field-label">Parola</label>
              <input
                className="input"
                type="password"
                placeholder="Parolanızı girin"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>

            <div className="row" style={{ justifyContent: 'space-between' }}>
              <label className="row" style={{ gap: 8, fontSize: 13, color: 'var(--text-2)' }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                Beni hatırla
              </label>
              <Link to="/forgot-password" className="muted" style={{ fontSize: 13 }}>
                Parolamı unuttum
              </Link>
            </div>

            <button
              type="submit"
              className="btn btn-accent"
              style={{ justifyContent: 'center', padding: '12px' }}
              disabled={loading}
            >
              <Ic.Lock size={14} />
              {loading ? 'Oturum açılıyor…' : 'Oturum Aç'}
            </button>

            <div
              className="muted"
              style={{ fontSize: 11.5, textAlign: 'center', marginTop: 6 }}
            >
              Keycloak SSO ile korunur · 2FA destekli
            </div>

            <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 18 }}>
              Hesabınız yok mu?{' '}
              <Link to="/register" style={{ color: 'var(--text)', fontWeight: 500 }}>
                Kayıt Ol
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
