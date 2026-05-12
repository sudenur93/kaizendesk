// shell.jsx — Sidebar, Topbar
const { useState: useS, useEffect: useE } = React;

function Sidebar({ role, setRole, current, navigate, data, tickets }) {
  const counts = {
    all: tickets.length,
    open: tickets.filter(t => !["resolved","closed"].includes(t.status)).length,
    mine: tickets.filter(t => t.assignee === "u2").length,
    sla: tickets.filter(t => slaInfo(t).state !== "ok" && !["resolved","closed"].includes(t.status)).length,
    new: tickets.filter(t => t.status === "new").length,
    closed: tickets.filter(t => t.status === "closed").length,
    customerMine: tickets.filter(t => t.reporter === "c1").length,
  };

  const customerNav = [
    { id: "c-list",   label: "Taleplerim",        icon: <Ic.Inbox/>, count: counts.customerMine },
    { id: "c-new",    label: "Yeni Talep",        icon: <Ic.Plus/> },
    { id: "c-archive",label: "Arşiv",             icon: <Ic.File/> },
  ];
  const agentNav = [
    { id: "a-list",   label: "Tüm Talepler",      icon: <Ic.List/>,    count: counts.all },
    { id: "a-mine",   label: "Bana Atananlar",    icon: <Ic.Inbox/>,   count: counts.mine },
    { id: "a-board",  label: "Kanban",            icon: <Ic.Kanban/> },
    { id: "a-sla",    label: "SLA Riski",         icon: <Ic.AlertTriangle/>, count: counts.sla },
  ];
  const managerNav = [
    { id: "m-dash",   label: "Genel Bakış",       icon: <Ic.Dashboard/> },
    { id: "m-team",   label: "Ekip Performansı",  icon: <Ic.Users/> },
    { id: "m-sla",    label: "SLA İhlalleri",     icon: <Ic.AlertTriangle/>, count: counts.sla },
    { id: "m-reports",label: "Raporlar",          icon: <Ic.BarChart/> },
  ];
  const nav = role === "customer" ? customerNav : role === "agent" ? agentNav : managerNav;
  const sectionLabel = role === "customer" ? "Müşteri Portalı" : role === "agent" ? "Destek Portalı" : "Yönetici Portalı";

  const me = role === "customer" ? data.customers[0] : role === "agent" ? data.agents[1] : data.manager;
  const meRole = role === "customer" ? "Müşteri • " + (me.dept || "") : role === "agent" ? "Destek • " + (me.team || "") : "Yönetici";

  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="logo">K</div>
        <div className="name">KaizenDesk<small>Ticket Yönetimi</small></div>
      </div>

      <div className="sb-section">
        <div className="sb-section-label">{sectionLabel}</div>
        {nav.map(n => (
          <div key={n.id}
               className={"sb-item" + (current === n.id ? " active" : "")}
               onClick={() => navigate(n.id)}>
            <span className="ic">{n.icon}</span>
            <span>{n.label}</span>
            {n.count != null && <span className="count">{n.count}</span>}
          </div>
        ))}
      </div>

      {role !== "customer" && (
        <div className="sb-section">
          <div className="sb-section-label">Sistemler</div>
          {data.products.slice(0,4).map(p => (
            <div key={p.id} className="sb-item" onClick={() => navigate("a-list", { product: p.id })}>
              <span className="ic" style={{display:"inline-block", width:8, height:8, borderRadius:2,
                background: ({uts:"#305a9e",kanban:"#1f7a4a",qc:"#b76b00",net:"#c8202a"})[p.id]}}/>
              <span style={{fontSize:13}}>{p.name}</span>
            </div>
          ))}
        </div>
      )}

      <div className="sb-foot">
        <div className="role-switch">
          <div className="lbl">Rol görünümü</div>
          <div className="opts">
            {[["customer","Müşteri"],["agent","Destek"],["manager","Yönetici"]].map(([k,l]) => (
              <div key={k} className={"opt" + (role === k ? " active" : "")} onClick={() => setRole(k)}>{l}</div>
            ))}
          </div>
        </div>
        <div className="user-card">
          <Avatar initials={me.initials}/>
          <div className="who">{me.name}<small>{meRole}</small></div>
          <span className="spacer"/>
          <span className="ic" style={{color:"var(--text-3)"}}><Ic.Logout size={14}/></span>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, search, setSearch, onTheme, theme }) {
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i>0 && <span className="sep"><Ic.ChevronRight size={12}/></span>}
            <span className={i === crumbs.length-1 ? "here" : ""}>{c}</span>
          </React.Fragment>
        ))}
      </div>
      <div className="search">
        <Ic.Search size={14}/>
        <input placeholder="Ticket ID, başlık, atanan veya sistem ara…"
               value={search} onChange={e => setSearch(e.target.value)}/>
        <span className="kbd">⌘ K</span>
      </div>
      <button className="icon-btn" onClick={onTheme} title={theme==="dark"?"Aydınlık moda geç":"Karanlık moda geç"}>
        {theme === "dark" ? <Ic.Sun size={16}/> : <Ic.Moon size={16}/>}
      </button>
      <button className="icon-btn" style={{position:"relative"}}>
        <Ic.Bell size={16}/>
        <span className="dot"/>
      </button>
    </div>
  );
}

Object.assign(window, { Sidebar, Topbar });
