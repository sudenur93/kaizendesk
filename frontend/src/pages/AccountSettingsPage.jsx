import { useEffect, useState } from 'react';
import Ic from '../components/Icons';
import { Avatar, getInitials } from '../components/Common';
import { getCurrentUserProfile, updateUserProfile, changePassword, getName, getRole } from '../services/api';

const AVATAR_COLORS = [
  '#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
];

const NOTIF_KEYS = [
  { key: 'notif_new_ticket',     label: 'Yeni ticket oluşturuldu',          desc: 'Ticket açıldığında bildir' },
  { key: 'notif_status_change',  label: 'Statü değişikliği',                desc: 'Ticket durumu güncellendiğinde bildir' },
  { key: 'notif_customer_reply', label: 'Müşteri yanıtı',                   desc: 'Müşteri yorum yaptığında bildir' },
  { key: 'notif_sla_breach',     label: 'SLA ihlali',                       desc: 'SLA süresi aşıldığında bildir' },
  { key: 'notif_email',          label: 'E-posta bildirimleri',             desc: 'Bildirimleri e-posta ile de gönder' },
];

function readNotifPrefs() {
  const prefs = {};
  NOTIF_KEYS.forEach(({ key }) => {
    prefs[key] = localStorage.getItem(key) !== '0';
  });
  return prefs;
}

function readAvatarColor() {
  return localStorage.getItem('avatarColor') || AVATAR_COLORS[0];
}

function Section({ icon, title, children }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="card-head" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="ic">{icon}</span>
        <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
      </div>
      <div style={{ padding: '20px 20px 20px' }}>{children}</div>
    </div>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  const ok = msg.type === 'success';
  return (
    <div
      className={'badge ' + (ok ? 's-resolved' : 'p-high')}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', marginBottom: 16 }}
    >
      {ok ? <Ic.Check size={13} /> : <Ic.AlertTriangle size={13} />}
      <span>{msg.text}</span>
    </div>
  );
}

export default function AccountSettingsPage() {
  const [profile, setProfile] = useState({ firstName: '', lastName: '', email: '' });
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileMsg, setProfileMsg] = useState(null);

  const [passwords, setPasswords] = useState({ newPassword: '', confirmPassword: '' });
  const [pwLoading, setPwLoading] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [showPw, setShowPw] = useState(false);

  const [avatarColor, setAvatarColor] = useState(readAvatarColor);
  const [notifPrefs, setNotifPrefs] = useState(readNotifPrefs);

  const displayName = getName() || '';
  const initials = getInitials(displayName);
  const role = getRole();
  const roleLabel = role === 'MANAGER' ? 'Yönetici' : role === 'AGENT' ? 'Destek Uzmanı' : 'Müşteri';

  useEffect(() => {
    getCurrentUserProfile()
      .then((data) => {
        const name = data.name || '';
        const spaceIdx = name.indexOf(' ');
        setProfile({
          firstName: spaceIdx > -1 ? name.slice(0, spaceIdx) : name,
          lastName:  spaceIdx > -1 ? name.slice(spaceIdx + 1) : '',
          email:     data.email || '',
        });
      })
      .catch(() => {});
  }, []);

  async function handleProfileSave(e) {
    e.preventDefault();
    setProfileMsg(null);
    setProfileLoading(true);
    try {
      await updateUserProfile(profile.firstName, profile.lastName, profile.email);
      setProfileMsg({ type: 'success', text: 'Profil bilgileri güncellendi.' });
    } catch (err) {
      setProfileMsg({ type: 'error', text: 'Güncelleme başarısız. ' + (err.response?.data?.errorMessage || err.message || '') });
    } finally {
      setProfileLoading(false);
    }
  }

  async function handlePasswordSave(e) {
    e.preventDefault();
    setPwMsg(null);
    if (passwords.newPassword.length < 6) {
      setPwMsg({ type: 'error', text: 'Şifre en az 6 karakter olmalıdır.' });
      return;
    }
    if (passwords.newPassword !== passwords.confirmPassword) {
      setPwMsg({ type: 'error', text: 'Şifreler eşleşmiyor.' });
      return;
    }
    setPwLoading(true);
    try {
      await changePassword(passwords.newPassword);
      setPwMsg({ type: 'success', text: 'Şifreniz başarıyla güncellendi.' });
      setPasswords({ newPassword: '', confirmPassword: '' });
    } catch (err) {
      setPwMsg({ type: 'error', text: 'Şifre değiştirilemedi. ' + (err.response?.data?.errorMessage || err.message || '') });
    } finally {
      setPwLoading(false);
    }
  }

  function handleAvatarColorClick(color) {
    setAvatarColor(color);
    localStorage.setItem('avatarColor', color);
  }

  function handleNotifToggle(key) {
    setNotifPrefs((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(key, next[key] ? '1' : '0');
      return next;
    });
  }

  return (
    <div style={{ padding: '24px 28px 48px' }}>

      {/* Kullanıcı özeti — tam genişlik */}
      <div className="card" style={{ marginBottom: 24, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 20,
          padding: '24px',
          background: 'var(--bg-soft)',
          borderBottom: '1px solid var(--hairline)',
        }}>
          <div style={{
            width: 64, height: 64, borderRadius: '50%',
            background: avatarColor,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 700, fontSize: 22, letterSpacing: 1,
            flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'background 0.3s',
          }}>
            {initials}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{displayName || 'Kullanıcı'}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>{roleLabel}</div>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{profile.email}</div>
          </div>
        </div>
        <div style={{ padding: '12px 24px', fontSize: 13, color: 'var(--text-2)' }}>
          Profilinizi, şifrenizi ve bildirim tercihlerinizi buradan yönetebilirsiniz.
        </div>
      </div>

      {/* İki kolon */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

        {/* Sol kolon: Profil + Şifre */}
        <div className="col" style={{ gap: 20 }}>

          <Section icon={<Ic.User size={15} />} title="Profil Bilgileri">
            <Msg msg={profileMsg} />
            <form onSubmit={handleProfileSave} className="col" style={{ gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="field">
                  <label className="field-label">Ad</label>
                  <input className="input" type="text" value={profile.firstName}
                    onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                    required disabled={profileLoading} />
                </div>
                <div className="field">
                  <label className="field-label">Soyad</label>
                  <input className="input" type="text" value={profile.lastName}
                    onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                    disabled={profileLoading} />
                </div>
              </div>
              <div className="field">
                <label className="field-label">E-posta</label>
                <input className="input" type="email" value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  required disabled={profileLoading} />
              </div>
              <div>
                <button type="submit" className="btn btn-accent" style={{ gap: 6 }} disabled={profileLoading}>
                  <Ic.Check size={13} />
                  {profileLoading ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}
                </button>
              </div>
            </form>
          </Section>

          <Section icon={<Ic.Lock size={15} />} title="Şifre Değiştir">
            <Msg msg={pwMsg} />
            <form onSubmit={handlePasswordSave} className="col" style={{ gap: 14 }}>
              <div className="field">
                <label className="field-label">Yeni Şifre</label>
                <div className="input-row">
                  <span className="ic-l"><Ic.Lock size={14} /></span>
                  <input className="input" type={showPw ? 'text' : 'password'}
                    placeholder="En az 6 karakter"
                    value={passwords.newPassword}
                    onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
                    required disabled={pwLoading} />
                  <button type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: '0 10px' }}
                    onClick={() => setShowPw(v => !v)} tabIndex={-1}>
                    <Ic.Eye size={14} />
                  </button>
                </div>
              </div>
              <div className="field">
                <label className="field-label">Şifre Tekrar</label>
                <div className="input-row">
                  <span className="ic-l"><Ic.Lock size={14} /></span>
                  <input className="input" type={showPw ? 'text' : 'password'}
                    placeholder="Şifreyi tekrar girin"
                    value={passwords.confirmPassword}
                    onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
                    required disabled={pwLoading} />
                </div>
                {passwords.newPassword && passwords.confirmPassword && passwords.newPassword !== passwords.confirmPassword && (
                  <div style={{ fontSize: 11.5, marginTop: 4, color: 'var(--p-high)' }}>Şifreler eşleşmiyor.</div>
                )}
              </div>
              <div>
                <button type="submit" className="btn btn-accent" style={{ gap: 6 }} disabled={pwLoading}>
                  <Ic.Lock size={13} />
                  {pwLoading ? 'Güncelleniyor…' : 'Şifreyi Güncelle'}
                </button>
              </div>
            </form>
          </Section>

        </div>

        {/* Sağ kolon: Avatar + Bildirimler */}
        <div className="col" style={{ gap: 20 }}>

          <Section icon={<Ic.User size={15} />} title="Avatar Rengi">
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, paddingTop: 8 }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: avatarColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontWeight: 700, fontSize: 26,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                transition: 'background 0.3s',
              }}>
                {initials}
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
                {AVATAR_COLORS.map((color) => (
                  <button key={color} type="button"
                    onClick={() => handleAvatarColorClick(color)}
                    style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: color, padding: 0, cursor: 'pointer',
                      border: avatarColor === color ? '3px solid var(--text)' : '3px solid transparent',
                      outline: avatarColor === color ? `2px solid ${color}` : 'none',
                      outlineOffset: 3,
                      transition: 'all 0.15s',
                    }}
                  />
                ))}
              </div>
              <div className="muted" style={{ fontSize: 12 }}>Seçim otomatik kaydedilir.</div>
            </div>
          </Section>

          <Section icon={<Ic.Bell size={15} />} title="Bildirim Tercihleri">
            <div className="col" style={{ gap: 0 }}>
              {NOTIF_KEYS.map(({ key, label, desc }, i) => (
                <label key={key} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  gap: 12, padding: '13px 0',
                  borderBottom: i < NOTIF_KEYS.length - 1 ? '1px solid var(--hairline)' : 'none',
                  cursor: 'pointer',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>{label}</div>
                    <div className="muted" style={{ fontSize: 11.5, marginTop: 1 }}>{desc}</div>
                  </div>
                  <span style={{ position: 'relative', flexShrink: 0 }}>
                    <input type="checkbox" checked={notifPrefs[key]}
                      onChange={() => handleNotifToggle(key)}
                      style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
                    <span style={{
                      display: 'inline-flex', width: 40, height: 22, borderRadius: 11,
                      background: notifPrefs[key] ? 'var(--accent)' : 'var(--border)',
                      transition: 'background 0.2s', position: 'relative', cursor: 'pointer',
                    }}>
                      <span style={{
                        position: 'absolute', top: 3,
                        left: notifPrefs[key] ? 20 : 3,
                        width: 16, height: 16, borderRadius: '50%',
                        background: '#fff', transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }} />
                    </span>
                  </span>
                </label>
              ))}
            </div>
            <div className="muted" style={{ fontSize: 12, marginTop: 12 }}>
              Değişiklikler otomatik kaydedilir.
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
