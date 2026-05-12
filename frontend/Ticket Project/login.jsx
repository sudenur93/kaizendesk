// login.jsx — Login screen
const { useState: lgS } = React;
function Login({ onLogin }) {
  const [email, setE] = lgS("ahmet.celik@kaizendesk.local");
  const [pw, setP] = lgS("••••••••••");
  const [role, setR] = lgS("customer");
  return (
    <div className="login">
      <div className="login-left">
        <div className="login-brand-l">
          <div className="logo">K</div>
          <div className="name"><b>KaizenDesk</b><small>Ticket Yönetim Sistemi</small></div>
        </div>
        <div className="pillars">
          <div className="pillar"><div className="num">01</div><div><h4>Tek Platform, Tüm Talepler</h4><p>Üretim hatlarından gelen tüm destek taleplerini tek bir merkezden takip edin, atayın ve sonuçlandırın.</p></div></div>
          <div className="pillar"><div className="num">02</div><div><h4>SLA Odaklı İş Akışı</h4><p>Önceliğe göre otomatik hesaplanan SLA hedefleri, ihlal riskinde proaktif uyarılar.</p></div></div>
          <div className="pillar"><div className="num">03</div><div><h4>Şeffaf Süreç Yönetimi</h4><p>jBPM tabanlı yaşam döngüsü ile her adım izlenebilir, denetlenebilir ve standart.</p></div></div>
        </div>
        <div className="login-foot">
          <span>© 2026 KaizenDesk</span>
          <span>v1.0.0</span>
        </div>
      </div>
      <div className="login-right">
        <div className="login-card">
          <h1>Tekrar hoş geldiniz</h1>
          <p className="sub">Devam etmek için kurumsal hesabınızla oturum açın.</p>
          <div className="col" style={{gap:14}}>
            <div className="field">
              <label className="field-label">E-posta</label>
              <input className="input" value={email} onChange={e=>setE(e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Parola</label>
              <input className="input" type="password" value={pw} onChange={e=>setP(e.target.value)}/>
            </div>
            <div className="field">
              <label className="field-label">Demo rol</label>
              <div className="row" style={{gap:6}}>
                {[["customer","Müşteri"],["agent","Destek"],["manager","Yönetici"]].map(([k,l]) => (
                  <button key={k} className={"btn btn-sm" + (role===k?" btn-primary":"")} onClick={()=>setR(k)}>{l}</button>
                ))}
              </div>
            </div>
            <div className="row" style={{justifyContent:"space-between"}}>
              <label className="row" style={{gap:8, fontSize:13, color:"var(--text-2)"}}>
                <input type="checkbox" defaultChecked/> Beni hatırla
              </label>
              <a className="muted" style={{fontSize:13}}>Parolamı unuttum</a>
            </div>
            <button className="btn btn-accent" style={{justifyContent:"center", padding:"12px"}} onClick={() => onLogin(role)}>
              <Ic.Lock size={14}/> Oturum Aç
            </button>
            <div className="muted" style={{fontSize:11.5, textAlign:"center", marginTop:6}}>
              Keycloak SSO ile korunur · 2FA destekli
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
window.Login = Login;
