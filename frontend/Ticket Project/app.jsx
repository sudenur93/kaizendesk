// app.jsx — main application
const { useState: aS, useEffect: aE, useMemo: aM } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "theme": "light",
  "variant": "a",
  "density": "spacious",
  "showLogin": true
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [route, setRoute] = aS({ name: "login", params: {} });
  const [role, setRole] = aS("customer");
  const [search, setSearch] = aS("");
  const [tickets, setTickets] = aS(KD_DATA.tickets);
  const [pushToast, toastsNode] = useToasts();

  aE(() => {
    document.documentElement.setAttribute("data-theme", tweaks.theme);
  }, [tweaks.theme]);

  function navigate(name, params = {}) { setRoute({ name, params }); }
  function onUpdate(id, patch) {
    setTickets(ts => ts.map(t => t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t));
  }
  function onCreate(stub) {
    const full = {
      id: stub.id, title: stub.title, productId: stub.productId, issue: stub.issue,
      priority: stub.priority, status: "new", reporter: "c1", assignee: null,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      slaDeadline: new Date(Date.now() + (stub.priority==="high"?8:stub.priority==="medium"?12:24)*3600*1000).toISOString(),
      slaTarget: (stub.priority==="high"?8:stub.priority==="medium"?12:24)*60,
      tags: [], worklog: [], attachments: [],
    };
    setTickets(ts => [full, ...ts]);
  }

  function onLogin(r) { setRole(r); navigate(r === "customer" ? "c-list" : r === "agent" ? "a-list" : "m-dash"); }

  // Auto-route mismatch when role changes via sidebar
  aE(() => {
    if (route.name === "login") return;
    const prefix = route.name.split("-")[0];
    if (role === "customer" && prefix !== "c") navigate("c-list");
    else if (role === "agent" && prefix !== "a") navigate("a-list");
    else if (role === "manager" && prefix !== "m") navigate("m-dash");
  }, [role]);

  if (route.name === "login" && tweaks.showLogin) {
    return <>
      <Login onLogin={onLogin}/>
      {toastsNode}
      <Tweaks tweaks={tweaks} setTweak={setTweak}/>
    </>;
  }

  // Crumbs map
  const crumbsMap = {
    "c-list": ["Müşteri Portalı", "Taleplerim"],
    "c-new":  ["Müşteri Portalı", "Yeni Talep"],
    "c-detail":["Müşteri Portalı", "Taleplerim", route.params.id || ""],
    "c-archive":["Müşteri Portalı","Arşiv"],
    "a-list": ["Destek Portalı", "Tüm Talepler"],
    "a-mine": ["Destek Portalı", "Bana Atananlar"],
    "a-board":["Destek Portalı", "Kanban"],
    "a-sla":  ["Destek Portalı", "SLA Riski"],
    "a-detail":["Destek Portalı", "Talepler", route.params.id || ""],
    "m-dash": ["Yönetici Portalı", "Genel Bakış"],
    "m-team": ["Yönetici Portalı", "Ekip Performansı"],
    "m-sla":  ["Yönetici Portalı", "SLA İhlalleri"],
    "m-reports":["Yönetici Portalı", "Raporlar"],
  };

  return (
    <div className="app" data-variant={tweaks.variant}>
      <Sidebar role={role} setRole={setRole} current={route.name} navigate={navigate} data={KD_DATA} tickets={tickets}/>
      <div className="main">
        <Topbar
          crumbs={crumbsMap[route.name] || []}
          search={search} setSearch={setSearch}
          theme={tweaks.theme}
          onTheme={() => setTweak("theme", tweaks.theme === "light" ? "dark" : "light")}
        />
        {/* customer */}
        {route.name === "c-list" && <CustomerList tickets={tickets} navigate={navigate} search={search} data={KD_DATA}/>}
        {route.name === "c-new"  && <NewTicket data={KD_DATA} navigate={navigate} pushToast={pushToast} onCreate={onCreate}/>}
        {route.name === "c-detail" && <TicketDetail id={route.params.id} tickets={tickets} data={KD_DATA} role="customer" navigate={navigate} pushToast={pushToast} onUpdate={onUpdate}/>}
        {route.name === "c-archive" && <ArchivePlaceholder/>}
        {/* agent */}
        {route.name === "a-list" && <AgentList tickets={tickets} data={KD_DATA} navigate={navigate} search={search} filterMine={false} onUpdate={onUpdate} pushToast={pushToast}/>}
        {route.name === "a-mine" && <AgentList tickets={tickets} data={KD_DATA} navigate={navigate} search={search} filterMine={true} onUpdate={onUpdate} pushToast={pushToast}/>}
        {route.name === "a-board" && <AgentKanban tickets={tickets} data={KD_DATA} navigate={navigate} onUpdate={onUpdate} pushToast={pushToast}/>}
        {route.name === "a-sla"  && <ManagerSLA tickets={tickets} data={KD_DATA} navigate={navigate}/>}
        {route.name === "a-detail" && <TicketDetail id={route.params.id || "TK-2841"} tickets={tickets} data={KD_DATA} role="agent" navigate={navigate} pushToast={pushToast} onUpdate={onUpdate}/>}
        {/* manager */}
        {route.name === "m-dash" && <ManagerDash tickets={tickets} data={KD_DATA} navigate={navigate}/>}
        {route.name === "m-team" && <ManagerTeam tickets={tickets} data={KD_DATA}/>}
        {route.name === "m-sla"  && <ManagerSLA tickets={tickets} data={KD_DATA} navigate={navigate}/>}
        {route.name === "m-reports" && <ReportsPlaceholder/>}
      </div>
      {toastsNode}
      <Tweaks tweaks={tweaks} setTweak={setTweak}/>
    </div>
  );
}

function ArchivePlaceholder() {
  return (<div className="page"><div className="page-narrow"><h1 className="page-title">Arşiv</h1>
    <div className="placeholder" style={{height:300, marginTop:20}}>Çözülmüş ve kapatılmış talepleriniz burada listelenir</div>
  </div></div>);
}
function ReportsPlaceholder() {
  return (<div className="page"><h1 className="page-title">Raporlar</h1>
    <div className="placeholder" style={{height:300, marginTop:20}}>Raporlama modülü — özelleştirilebilir grafikler ve dışa aktarma</div>
  </div>);
}

function Tweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel>
      <TweakSection label="Tema"/>
      <TweakRadio label="Görünüm" value={tweaks.theme} options={["light","dark"]}
                  onChange={v => setTweak("theme", v)}/>
      <TweakSection label="Düzen Varyasyonu"/>
      <TweakRadio label="Stil" value={tweaks.variant} options={["a","b"]}
                  onChange={v => setTweak("variant", v)}/>
      <div style={{fontSize:11, color:"rgba(41,38,27,.55)", lineHeight:1.4, marginTop:-4}}>
        <b>A:</b> Spacious & premium · <b>B:</b> Compact & dense
      </div>
      <TweakSection label="Demo"/>
      <TweakButton label="Login ekranını göster" onClick={() => location.reload()}/>
    </TweaksPanel>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App/>);
