import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Ic from '../components/Icons';
import { register } from '../services/api';

export default function RegisterPage() {
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    passwordConfirm: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

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

    setLoading(true);
    try {
      await register(form.username, form.password, form.email, form.firstName, form.lastName);
      setSuccess('Hesabınız oluşturuldu! Giriş sayfasına yönlendiriliyorsunuz...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const status = err.response?.status;
      if (status === 409) {
        setError('Bu kullanıcı adı veya e-posta zaten kayıtlı.');
      } else {
        setError('Kayıt oluşturulamadı. Lütfen tekrar deneyin.');
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
          <h1>Yeni Hesap Oluştur</h1>
          <p className="sub">Kayıt sonrası müşteri rolüyle giriş yapabilirsiniz.</p>
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

          <div className="h-grid-2">
            <div className="field">
              <label className="field-label">Ad</label>
              <input className="input" type="text" name="firstName" value={form.firstName} onChange={handleChange} required />
            </div>
            <div className="field">
              <label className="field-label">Soyad</label>
              <input className="input" type="text" name="lastName" value={form.lastName} onChange={handleChange} required />
            </div>
          </div>

          <div className="col" style={{ gap: 12 }}>
            <div className="field">
              <label className="field-label">Kullanıcı Adı</label>
              <input className="input" type="text" name="username" value={form.username} onChange={handleChange} required />
            </div>
            <div className="field">
              <label className="field-label">E-posta</label>
              <input className="input" type="email" name="email" value={form.email} onChange={handleChange} required />
            </div>
            <div className="field">
              <label className="field-label">Şifre</label>
              <input className="input" type="password" name="password" value={form.password} onChange={handleChange} required />
            </div>
            <div className="field">
              <label className="field-label">Şifre Tekrar</label>
              <input className="input" type="password" name="passwordConfirm" value={form.passwordConfirm} onChange={handleChange} required />
            </div>
          </div>

          <button type="submit" className="btn btn-accent" style={{ justifyContent: 'center', marginTop: 14 }} disabled={loading}>
            <Ic.User size={14} />
            {loading ? 'Oluşturuluyor…' : 'Kayıt Ol'}
          </button>

          <div className="muted" style={{ textAlign: 'center', marginTop: 16 }}>
            Zaten hesabın var mı? <Link to="/login">Giriş Yap</Link>
          </div>
        </form>
      </div>
    </div>
  );
}
