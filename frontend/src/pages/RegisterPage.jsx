import { useState } from 'react';
import { Link } from 'react-router-dom';
import Ic from '../components/Icons';
import { register } from '../services/api';

const ROLE_OPTS = [
  {
    k: 'CUSTOMER',
    lbl: 'Müşteri',
    desc: 'Destek talebi açabilirsiniz',
    icon: <Ic.Inbox size={18} />,
  },
  {
    k: 'AGENT',
    lbl: 'Destek Uzmanı',
    desc: 'Admin onayı gerektirir',
    icon: <Ic.Kanban size={18} />,
  },
];

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [role, setRole] = useState('CUSTOMER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (form.password !== form.passwordConfirm) {
      setError('Şifreler eşleşmiyor.');
      return;
    }
    if (form.password.length < 6) {
      setError('Şifre en az 6 karakter olmalıdır.');
      return;
    }
    if (!/^[a-zA-Z0-9._-]+$/.test(form.username)) {
      setError('Kullanıcı adı sadece harf, rakam, nokta, tire ve alt çizgi içerebilir. Boşluk kullanılamaz.');
      return;
    }

    setLoading(true);
    try {
      await register(form.username, form.password, form.email, form.firstName, form.lastName, role);
      setSuccess(
        role === 'AGENT'
          ? 'Başvurunuz alındı! Yönetici onayının ardından giriş yapabileceksiniz.'
          : 'Hesabınız oluşturuldu! Şimdi giriş yapabilirsiniz.'
      );
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.errorMessage || err.response?.data?.error_description || err.message || '';
      console.error('Kayıt hatası:', status, msg, err);
      if (status === 409) {
        setError('Bu kullanıcı adı veya e-posta zaten kayıtlı.');
      } else if (status === 400) {
        setError(`Geçersiz bilgi: ${msg || 'Lütfen tüm alanları kontrol edin.'}`);
      } else if (status === 401 || status === 403) {
        setError('Yetkilendirme hatası. Lütfen tekrar deneyin.');
      } else {
        setError(`Kayıt oluşturulamadı. ${msg ? '(' + msg + ')' : 'Lütfen tekrar deneyin.'}`);
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
          <div className="eyebrow"><Ic.User size={11} /> Yeni Hesap</div>
          <h1>Hesap Oluştur</h1>
          <p className="sub">Rolünüzü seçin ve bilgilerinizi doldurun.</p>

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

          {!success && (
            <div className="col" style={{ gap: 14 }}>
              {/* Rol seçimi */}
              <div className="field">
                <label className="field-label">Hesap Türü</label>
                <div className="demo-roles">
                  {ROLE_OPTS.map((r) => (
                    <button
                      type="button" key={r.k}
                      className={'opt' + (role === r.k ? ' active' : '')}
                      onClick={() => setRole(r.k)}
                      disabled={loading}
                    >
                      <span className="ic">{r.icon}</span>
                      <span className="lbl">{r.lbl}</span>
                      <span className="desc">{r.desc}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ad / Soyad */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div className="field">
                  <label className="field-label">Ad</label>
                  <input className="input" type="text" name="firstName" value={form.firstName} onChange={handleChange} required disabled={loading} />
                </div>
                <div className="field">
                  <label className="field-label">Soyad</label>
                  <input className="input" type="text" name="lastName" value={form.lastName} onChange={handleChange} required disabled={loading} />
                </div>
              </div>

              <div className="field">
                <label className="field-label">Kullanıcı Adı</label>
                <input className="input" type="text" name="username" placeholder="ornek.kullanici" value={form.username} onChange={handleChange} required disabled={loading} />
                <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>Boşluk ve Türkçe karakter kullanılamaz.</div>
              </div>
              <div className="field">
                <label className="field-label">E-posta</label>
                <input className="input" type="email" name="email" value={form.email} onChange={handleChange} required disabled={loading} />
              </div>
              <div className="field">
                <label className="field-label">Şifre</label>
                <input className="input" type="password" name="password" value={form.password} onChange={handleChange} required disabled={loading} />
              </div>
              <div className="field">
                <label className="field-label">Şifre Tekrar</label>
                <input className="input" type="password" name="passwordConfirm" value={form.passwordConfirm} onChange={handleChange} required disabled={loading} />
              </div>

              <button type="submit" className="btn btn-accent"
                style={{ justifyContent: 'center', padding: 13, fontSize: 14, marginTop: 4 }}
                disabled={loading}>
                <Ic.User size={14} />
                {loading ? 'Oluşturuluyor…' : 'Kayıt Ol'}
              </button>
            </div>
          )}

          <div className="muted" style={{ textAlign: 'center', marginTop: 16, fontSize: 12.5 }}>
            Zaten hesabın var mı? <Link to="/login">Giriş Yap</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
