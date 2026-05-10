import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Ic from '../components/Icons';
import { login } from '../services/api';

const ROLE_OPTS = [
  { k: 'CUSTOMER', lbl: 'Müşteri', desc: 'C-PORTAL', icon: <Ic.Inbox size={16} /> },
  { k: 'AGENT', lbl: 'Destek', desc: 'A-DESK', icon: <Ic.Kanban size={16} /> },
  { k: 'MANAGER', lbl: 'Yönetici', desc: 'M-OPS', icon: <Ic.Dashboard size={16} /> },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [demoRole, setDemoRole] = useState('CUSTOMER');
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState(null);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'light');
    axios.get('/api/v1/public/stats')
      .then(r => setStats(r.data))
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password || loading) return;
    setError('');
    setLoading(true);
    try {
      const { role } = await login(email.trim(), password);
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

        <div className="login-headline">
          <div className="eyebrow"><span className="pip" />Endüstriyel Destek</div>
          <h2>
            Tek platform.<br />
            <em>Tüm talepler.</em>
          </h2>
          <p>
            Üretim hatlarından gelen destek taleplerini tek merkezden açın, takip edin ve
            SLA hedefleri içinde sonuçlandırın.
          </p>

          <div className="pillars">
            <div className="pillar">
              <div className="num">01</div>
              <div style={{ flex: 1 }}>
                <h4>Merkezi Talep Yönetimi</h4>
                <p>Tüm sistemler için tek kuyruk, tek protokol.</p>
              </div>
              <span className="ic"><Ic.Inbox size={16} /></span>
            </div>
            <div className="pillar">
              <div className="num">02</div>
              <div style={{ flex: 1 }}>
                <h4>SLA Odaklı Akış</h4>
                <p>Önceliğe göre hedef süre, riskte proaktif uyarı.</p>
              </div>
              <span className="ic"><Ic.Clock size={16} /></span>
            </div>
            <div className="pillar">
              <div className="num">03</div>
              <div style={{ flex: 1 }}>
                <h4>Şeffaf Süreç</h4>
                <p>jBPM tabanlı yaşam döngüsü — izlenebilir ve standart.</p>
              </div>
              <span className="ic"><Ic.Check size={16} /></span>
            </div>
          </div>

          <div className="login-meta-strip">
            <div>
              <div className="k">Aktif Talep</div>
              <div className="v">{stats ? stats.activeTickets : '—'}<b>/</b>{stats ? stats.totalTickets : '—'}</div>
            </div>
            <div>
              <div className="k">Toplam</div>
              <div className="v">{stats ? stats.totalTickets + ' talep' : '—'}</div>
            </div>
            <div>
              <div className="k">SLA Uyumu</div>
              <div className="v" style={{ color: stats ? (stats.slaComplianceRate >= 80 ? '#4ec27e' : '#f59e0b') : undefined }}>
                {stats ? '%' + stats.slaComplianceRate.toFixed(1) : '—'}
              </div>
            </div>
            <div>
              <div className="k">Ort. Çözüm</div>
              <div className="v">{stats ? stats.avgResolutionHours + ' sa' : '—'}</div>
            </div>
          </div>
        </div>

        <div className="login-foot">
          <span className="dotline">SİSTEM ONLINE</span>
          <span>© 2026 · KAIZENDESK</span>
        </div>
      </div>

      <div className="login-right">
        <form className="login-card login-form" onSubmit={handleSubmit}>
          <div className="eyebrow"><Ic.Lock size={11} /> Kimlik Doğrulama</div>
          <h1>Tekrar hoş geldiniz</h1>
          <p className="sub">
            Devam etmek için kurumsal hesabınızla oturum açın. Erişim Keycloak SSO ile yönetilir.
          </p>

          {error && (
            <div
              className="badge p-high"
              style={{ display: 'flex', padding: '8px 12px', marginBottom: 16, gap: 8 }}
            >
              <Ic.AlertTriangle size={13} />
              {error}
            </div>
          )}

          <div className="col" style={{ gap: 16 }}>
            <div className="field">
              <label className="field-label">E-posta veya kullanıcı adı</label>
              <div className="input-row">
                <span className="ic-l"><Ic.Mail size={15} /></span>
                <input
                  className="input"
                  type="text"
                  placeholder="ornek@kaizendesk.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  autoFocus
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label" style={{ display: 'flex' }}>
                <span>Parola</span>
                <span className="spacer" />
                <Link
                  to="/forgot-password"
                  className="muted"
                  style={{ fontSize: 11.5, whiteSpace: 'nowrap' }}
                >
                  Parolamı unuttum
                </Link>
              </label>
              <div className="input-row">
                <span className="ic-l"><Ic.Lock size={15} /></span>
                <input
                  className="input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label className="field-label">Demo rol seçin</label>
              <div className="demo-roles">
                {ROLE_OPTS.map((r) => (
                  <button
                    type="button"
                    key={r.k}
                    className={'opt' + (demoRole === r.k ? ' active' : '')}
                    onClick={() => setDemoRole(r.k)}
                    disabled={loading}
                  >
                    <span className="ic">{r.icon}</span>
                    <span className="lbl">{r.lbl}</span>
                    <span className="desc">{r.desc}</span>
                  </button>
                ))}
              </div>
            </div>

            <label className="row" style={{ gap: 8, fontSize: 12.5, color: 'var(--text-2)', marginTop: 2 }}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Bu cihazda 30 gün hatırla
            </label>

            <button
              type="submit"
              className="btn btn-accent"
              style={{ justifyContent: 'center', padding: 13, fontSize: 14, marginTop: 4 }}
              disabled={loading}
            >
              {loading ? 'Oturum açılıyor…' : 'Oturum Aç'} <Ic.ChevronRight size={14} />
            </button>

            <div className="secure-strip">
              <span className="pip" />
              <span>KEYCLOAK SSO · 2FA AKTİF · AES-256</span>
              <span className="spacer" />
              <span>v1.0.0</span>
            </div>

            <div className="muted" style={{ fontSize: 12.5, textAlign: 'center', marginTop: 6 }}>
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
