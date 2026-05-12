// agent.jsx — Agent (support) portal screens
const { useState: agS, useMemo: agM } = React;

const ME = "u2"; // current logged-in agent

function AgentList({ tickets, data, navigate, search, filterMine, onUpdate, pushToast }) {
  const [statusF, setStatusF] = agS("open");
  const [priorityF, setPriorityF] = agS("all");
  const [productF, setProductF] = agS("all");
  const [ownerF, setOwnerF] = agS(filterMine ? "mine" : "all");
  const [selected, setSelected] = agS([]);

  const list = agM(() => {
    let xs = [...tickets];
    if (filterMine) xs = xs.filter(t => t.assignee === ME);
    else if (ownerF === "mine") xs = xs.filter(t => t.assignee === ME);
    else if (ownerF === "others") xs = xs.filter(t => t.assignee && t.assignee !== ME);
    else if (ownerF === "unassigned") xs = xs.filter(t => !t.assignee);

    if (statusF === "open") xs = xs.filter(t => !["resolved","closed"].includes(t.status));
    else if (statusF !== "all") xs = xs.filter(t => t.status === statusF);
    if (priorityF !== "all") xs = xs.filter(t => t.priority === priorityF);
    if (productF !== "all") xs = xs.filter(t => t.productId === productF);
    if (search) xs = xs.filter(t => (t.id+" "+t.title+" "+(userById(t.assignee,data)?.name||"")).toLowerCase().includes(search.toLowerCase()));
    const pOrd = { critical:0, high:1, medium:2, low:3 };
    return xs.sort((a,b) => {
      const dp = pOrd[a.priority] - pOrd[b.priority];
      if (dp) return dp;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }, [tickets, statusF, priorityF, productF, ownerF, search, filterMine]);

  // Counts for owner segmented control
  const ownerCounts = agM(() => ({
    all: tickets.length,
    mine: tickets.filter(t => t.assignee === ME).length,
    others: tickets.filter(t => t.assignee && t.assignee !== ME).length,
    unassigned: tickets.filter(t => !t.assignee).length,
  }), [tickets]);

  function takeOne(id, e) {
    e && e.stopPropagation();
    onUpdate && onUpdate(id, { assignee: ME, status: "in_progress" });
    pushToast && pushToast(`${id} üzerinize alındı`);
  }
  function takeSelected() {
    selected.forEach(id => onUpdate && onUpdate(id, { assignee: ME, status: "in_progress" }));
    pushToast && pushToast(`${selected.length} talep üzerinize alındı`);
    setSelected([]);
  }

  const allSelected = selected.length === list.length && list.length > 0;
  const toggleAll = () => setSelected(allSelected ? [] : list.map(t => t.id));
  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x => x!==id) : [...s, id]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">{filterMine ? "Bana Atanan Talepler" : "Tüm Destek Talepleri"}</h1>
          <div className="page-sub">{list.length} sonuç · öncelik ve SLA durumuna göre sıralı</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm"><Ic.Refresh size={13}/> Yenile</button>
          <button className="btn btn-sm btn-primary"><Ic.Plus size={13}/> Talep Oluştur</button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="card" style={{marginBottom:12, padding:"10px 16px", display:"flex", alignItems:"center", gap:12, background:"var(--surface-2)"}}>
          <span style={{fontSize:13, fontWeight:500}}>{selected.length} ticket seçildi</span>
          <span className="spacer"/>
          <button className="btn btn-sm btn-accent" onClick={takeSelected}><Ic.Check size={12}/> Üzerime Al</button>
          <button className="btn btn-sm">Toplu Atama</button>
          <button className="btn btn-sm">Durum Değiştir</button>
          <button className="btn btn-sm">Etiket Ekle</button>
          <button className="btn btn-sm btn-ghost" onClick={() => setSelected([])}><Ic.X size={12}/> Temizle</button>
        </div>
      )}

      {!filterMine && (
        <div className="view-tabs">
          {[
            ["all","Tümü",ownerCounts.all,null],
            ["mine","Bende",ownerCounts.mine,"accent"],
            ["others","Diğer Personelde",ownerCounts.others,null],
            ["unassigned","Atanmamış",ownerCounts.unassigned,"warn"],
          ].map(([k,l,c,tone]) => (
            <button key={k} className={"vt" + (ownerF===k?" active":"")} onClick={() => setOwnerF(k)}>
              <span className="vt-label">{l}</span>
              <span className={"vt-count" + (tone?` ${tone}`:"")}>{c}</span>
            </button>
          ))}
          <span className="spacer"/>
          <span className="vt-meta"><Ic.Refresh size={11}/> 2 dk önce güncellendi</span>
        </div>
      )}

      <div className="card">
        <div className="fbar">
          <div className="seg">
            {[["open","Açık"],["new","Yeni"],["in_progress","İşlemde"],["waiting_customer","Müşteri"],["resolved","Çözüldü"],["all","Tümü"]].map(([k,l]) => (
              <button key={k} className={statusF===k?"active":""} onClick={() => setStatusF(k)}>{l}</button>
            ))}
          </div>
          <div className="gap"/>
          <select className="select" style={{width:140}} value={priorityF} onChange={e=>setPriorityF(e.target.value)}>
            <option value="all">Öncelik: Tümü</option>
            <option value="critical">Kritik</option>
            <option value="high">Yüksek</option>
            <option value="medium">Orta</option>
            <option value="low">Düşük</option>
          </select>
          <select className="select" style={{width:200}} value={productF} onChange={e=>setProductF(e.target.value)}>
            <option value="all">Sistem: Tümü</option>
            {data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <table className="tbl">
          <thead><tr>
            <th style={{width:36}}><input type="checkbox" checked={allSelected} onChange={toggleAll}/></th>
            <th style={{width:90}}>ID</th>
            <th>Başlık</th>
            <th style={{width:140}}>Durum</th>
            <th style={{width:90}}>Öncelik</th>
            <th style={{width:170}}>SLA</th>
            <th style={{width:160}}>Atanan</th>
            <th style={{width:110}}>Açıldı</th>
          </tr></thead>
          <tbody>
            {list.map(t => {
              const a = userById(t.assignee, data);
              return (
                <tr key={t.id} className={selected.includes(t.id)?"selected":""}>
                  <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selected.includes(t.id)} onChange={() => toggle(t.id)}/></td>
                  <td className="id" onClick={() => navigate("a-detail", { id: t.id })}>{t.id}</td>
                  <td className="ttl" onClick={() => navigate("a-detail", { id: t.id })}>
                    {t.title}
                    <span className="lbl">{data.products.find(p=>p.id===t.productId).name}</span>
                  </td>
                  <td><StatusBadge status={t.status}/></td>
                  <td><PriorityBadge priority={t.priority}/></td>
                  <td><SlaBar t={t}/></td>
                  <td>
                    {a
                      ? <span className="row" style={{gap:8}}><Avatar initials={a.initials} size="sm"/><span style={{fontSize:13}}>{a.name}{a.id===ME && <span className="muted" style={{fontSize:11, marginLeft:4}}>(siz)</span>}</span></span>
                      : (
                        <span className="row" style={{gap:8, justifyContent:"space-between"}}>
                          <span className="muted">Atanmamış</span>
                          <button className="btn btn-sm btn-accent" style={{padding:"3px 8px", fontSize:11}} onClick={(e) => takeOne(t.id, e)}>
                            <Ic.Check size={11}/> Üzerime Al
                          </button>
                        </span>
                      )}
                  </td>
                  <td className="meta">{fmtDate(t.createdAt, "rel")}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============ Kanban board ============
function AgentKanban({ tickets, data, navigate, onUpdate, pushToast }) {
  const [drag, setDrag] = agS(null);
  const [over, setOver] = agS(null);
  const cols = STATUS_ORDER;
  return (
    <div className="page" style={{paddingRight:24, paddingLeft:24}}>
      <div className="page-head">
        <div>
          <h1 className="page-title">Kanban</h1>
          <div className="page-sub">Sürükle-bırak ile durum güncelle. Yaşam döngüsü: New → In Progress → Waiting → Resolved → Closed</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-sm"><Ic.Filter size={13}/> Filtre</button>
          <button className="btn btn-sm btn-primary"><Ic.Plus size={13}/> Yeni</button>
        </div>
      </div>

      <div className="kanban">
        {cols.map(s => {
          const xs = tickets.filter(t => t.status === s);
          return (
            <div key={s} className={"kcol" + (over===s?" over":"")}
                 onDragOver={e => { e.preventDefault(); setOver(s); }}
                 onDragLeave={() => setOver(o => o===s?null:o)}
                 onDrop={() => {
                   if (drag && drag.status !== s) {
                     onUpdate(drag.id, { status: s });
                     pushToast(`${drag.id} → ${STATUS_TR[s]}`);
                   }
                   setDrag(null); setOver(null);
                 }}>
              <div className="kcol-head">
                <span className={"badge " + STATUS[s].key}><span className="pip"/>{STATUS_TR[s]}</span>
                <span className="spacer"/>
                <span className="ct">{xs.length}</span>
              </div>
              <div className="kcol-body">
                {xs.map(t => {
                  const a = userById(t.assignee, data);
                  return (
                    <div key={t.id}
                         className={"kcard" + (drag?.id===t.id?" drag":"")}
                         draggable
                         onDragStart={() => setDrag(t)}
                         onDragEnd={() => { setDrag(null); setOver(null); }}
                         onClick={() => navigate("a-detail", { id: t.id })}>
                      <div className="top">
                        <span className="tag">{t.id}</span>
                        <PriorityBadge priority={t.priority}/>
                      </div>
                      <div className="ttl">{t.title}</div>
                      <SlaBar t={t}/>
                      <div className="foot">
                        <span>{data.products.find(p=>p.id===t.productId).name.split(" ")[0]}</span>
                        {a ? <Avatar initials={a.initials} size="sm"/> : <span className="muted">Atanmamış</span>}
                      </div>
                    </div>
                  );
                })}
                {xs.length === 0 && <div className="muted" style={{fontSize:12, padding:"20px 8px", textAlign:"center"}}>Bu durumda ticket yok</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

window.AgentList = AgentList;
window.AgentKanban = AgentKanban;
