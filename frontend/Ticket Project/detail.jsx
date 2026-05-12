// detail.jsx — Ticket detail (shared by customer & agent views)
const { useState: dtS } = React;

function TicketDetail({ id, tickets, data, role, navigate, pushToast, onUpdate }) {
  const t = tickets.find(x => x.id === id) || tickets[0];
  const product = data.products.find(p => p.id === t.productId);
  const reporter = userById(t.reporter, data);
  const assignee = t.assignee ? userById(t.assignee, data) : null;
  const comments = data.comments[t.id] || data.comments["TK-2841"];
  const activity = data.activity[t.id] || data.activity["TK-2841"];

  const [tab, setTab] = dtS("external");
  const [draft, setDraft] = dtS("");
  const [worklogOpen, setWorklogOpen] = dtS(false);

  const isAgent = role !== "customer";

  function send() {
    if (!draft.trim()) return;
    pushToast(tab === "internal" ? "İç not eklendi" : "Yorum gönderildi");
    setDraft("");
  }
  function changeStatus(s) {
    if (s === "resolved" && (!prompt("Çözüm notu girin (zorunlu):") || "").trim() === "") return;
    onUpdate(t.id, { status: s });
    pushToast(`Durum: ${STATUS_TR[s]}`);
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="row" style={{marginBottom:14, color:"var(--text-3)", fontSize:12.5}}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate(role==="customer"?"c-list":"a-list")}>
            ← Listeye dön
          </button>
        </div>

        <div className="page-head" style={{alignItems:"flex-start"}}>
          <div style={{flex:1, minWidth:0}}>
            <div className="row" style={{gap:10, marginBottom:8}}>
              <span className="tag">{t.id}</span>
              <StatusBadge status={t.status}/>
              <PriorityBadge priority={t.priority}/>
              {slaInfo(t).state === "bad" && <span className="badge p-high"><Ic.AlertTriangle size={11}/> SLA İhlali</span>}
            </div>
            <h1 className="page-title" style={{marginBottom:8}}>{t.title}</h1>
            <div className="row" style={{gap:14, color:"var(--text-3)", fontSize:13}}>
              <span><b style={{color:"var(--text-2)", fontWeight:500}}>{reporter?.name}</b> tarafından açıldı</span>
              <span>·</span>
              <span>{fmtDate(t.createdAt, "datetime")}</span>
              <span>·</span>
              <span>{product?.name}</span>
            </div>
          </div>
          {isAgent && (
            <div className="page-actions">
              <button className="btn btn-sm" onClick={() => setWorklogOpen(true)}><Ic.Clock size={13}/> Worklog</button>
              {t.status === "new" && <button className="btn btn-sm" onClick={() => { onUpdate(t.id, { assignee: "u2", status: "in_progress" }); pushToast("Üzerinize aldınız"); }}>Üzerime Al</button>}
              {t.status === "in_progress" && <button className="btn btn-sm" onClick={() => changeStatus("waiting_customer")}>Müşteri Bekleniyor</button>}
              {!["resolved","closed"].includes(t.status) && <button className="btn btn-sm btn-accent" onClick={() => changeStatus("resolved")}><Ic.Check size={13}/> Çözüldü</button>}
            </div>
          )}
        </div>

        <div className="detail-grid">
          {/* main column */}
          <div className="col" style={{gap:18, minWidth:0}}>
            <div className="card card-pad">
              <div className="muted" style={{fontSize:11.5, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", marginBottom:10}}>Açıklama</div>
              <div style={{fontSize:14, lineHeight:1.6, color:"var(--text)"}}>
                Vardiya başında ekran 4 her 30 saniyede bir yaklaşık 8 saniye boyunca donuyor.
                MES arayüzü kilitleniyor ve operatörler iş emirlerini onaylayamıyor. Bu durum hat-3 üzerinde
                vardiya başına yaklaşık 12 dakika duruşa neden oluyor.
              </div>
              {t.attachments.length > 0 && (
                <>
                  <div className="muted" style={{fontSize:11.5, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", margin:"18px 0 10px"}}>Ekler ({t.attachments.length})</div>
                  <div className="row" style={{gap:8, flexWrap:"wrap"}}>
                    {t.attachments.map((a,i) => (
                      <div key={i} className="row" style={{padding:"8px 12px", border:"1px solid var(--hairline)", borderRadius:8, background:"var(--surface-2)"}}>
                        {a.kind==="img" ? <Ic.Image size={14}/> : <Ic.File size={14}/>}
                        <span style={{fontSize:13}}>{a.name}</span>
                        <span className="muted mono" style={{fontSize:11}}>{a.size}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Conversation thread */}
            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Konuşma</h3>
                  <div className="sub">Müşteri ve destek ekibi arasındaki yazışmalar</div>
                </div>
                <div className="muted" style={{fontSize:12}}>{comments.length} mesaj</div>
              </div>
              <div style={{padding:"20px", display:"flex", flexDirection:"column", gap:18}}>
                {comments.map(c => {
                  const u = userById(c.user, data);
                  return (
                    <div key={c.id} className={"msg" + (c.kind==="internal"?" internal":"")}>
                      <Avatar initials={u?.initials || "?"}/>
                      <div className="body">
                        <div className="row">
                          <span className="who">{u?.name}</span>
                          <span className="muted" style={{fontSize:11.5}}>{u?.team || u?.dept || ""}</span>
                          {c.kind === "internal" && <span className="tag-internal">İç Not</span>}
                          <span className="spacer"/>
                          <span className="time">{fmtDate(c.at, "datetime")}</span>
                        </div>
                        <div className="text">{c.text}</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{padding:"0 20px 20px"}}>
                <div className="composer">
                  <div className="composer-tabs">
                    <button className={tab==="external"?"active":""} onClick={() => setTab("external")}>
                      Müşteri Yorumu
                    </button>
                    {isAgent && <button className={"internal " + (tab==="internal"?"active":"")} onClick={() => setTab("internal")}>
                      İç Not <span style={{color:"var(--text-3)"}}>· yalnızca destek ekibi</span>
                    </button>}
                  </div>
                  <textarea placeholder={tab==="internal"?"Ekibin göreceği bir not yazın…":"Cevabınızı yazın…"}
                            value={draft} onChange={e => setDraft(e.target.value)}/>
                  <div className="composer-foot">
                    <div className="row" style={{gap:6}}>
                      <button className="btn-ghost icon-btn"><Ic.Paperclip size={14}/></button>
                    </div>
                    <button className={"btn btn-sm " + (draft.trim()?"btn-accent":"")} onClick={send}>
                      {tab==="internal"?"Not Ekle":"Gönder"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* sidebar */}
          <div className="col" style={{gap:18}}>
            <div className="card card-pad">
              <div className="muted" style={{fontSize:11.5, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", marginBottom:14}}>Detaylar</div>
              <dl className="kv">
                <dt>Durum</dt><dd><StatusBadge status={t.status}/></dd>
                <dt>Öncelik</dt><dd><PriorityBadge priority={t.priority}/></dd>
                <dt>Atanan</dt><dd>{assignee ? <span className="row" style={{gap:8}}><Avatar initials={assignee.initials} size="sm"/>{assignee.name}</span> : <span className="muted">Atanmamış</span>}</dd>
                <dt>Bildiren</dt><dd><span className="row" style={{gap:8}}><Avatar initials={reporter.initials} size="sm"/>{reporter.name}</span></dd>
                <dt>Sistem</dt><dd>{product?.name}</dd>
                <dt>Sorun Tipi</dt><dd>{t.issue}</dd>
                <dt>Etiketler</dt><dd className="row" style={{gap:4, flexWrap:"wrap"}}>{t.tags.map(tg => <span key={tg} className="tag">{tg}</span>)}</dd>
                <dt>Açıldı</dt><dd>{fmtDate(t.createdAt, "datetime")}</dd>
                <dt>Güncellendi</dt><dd>{fmtDate(t.updatedAt, "rel")}</dd>
              </dl>
            </div>

            <div className="card card-pad">
              <div className="row">
                <div className="muted" style={{fontSize:11.5, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase"}}>SLA</div>
                <span className="spacer"/>
                <span className="mono muted" style={{fontSize:11}}>{Math.round(t.slaTarget/60)}sa hedef</span>
              </div>
              <div style={{margin:"12px 0"}}><SlaBar t={t}/></div>
              <div className="muted" style={{fontSize:12, lineHeight:1.5}}>
                {slaInfo(t).state === "bad" ? "SLA hedefi aşıldı. Eskalasyon önerilir." :
                 slaInfo(t).state === "warn" ? "SLA hedefine yaklaşıyor — öncelik verilmeli." :
                 "SLA penceresi içinde."}
              </div>
            </div>

            {t.worklog.length > 0 && (
              <div className="card card-pad">
                <div className="muted" style={{fontSize:11.5, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", marginBottom:10}}>Worklog</div>
                {t.worklog.map((w,i) => {
                  const u = userById(w.user, data);
                  return (
                    <div key={i} className="col" style={{gap:4, paddingBottom:10, borderBottom: i<t.worklog.length-1?"1px solid var(--hairline)":"none", marginBottom: i<t.worklog.length-1?10:0}}>
                      <div className="row" style={{justifyContent:"space-between"}}>
                        <span style={{fontSize:13, fontWeight:500}}>{u?.name}</span>
                        <span className="mono" style={{fontSize:12, color:"var(--text-2)"}}>{w.min}dk</span>
                      </div>
                      <div className="muted" style={{fontSize:12}}>{w.note}</div>
                      <div className="muted" style={{fontSize:11}}>{fmtDate(w.when, "rel")}</div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="card card-pad">
              <div className="muted" style={{fontSize:11.5, fontWeight:600, letterSpacing:".06em", textTransform:"uppercase", marginBottom:14}}>Aktivite</div>
              <div className="timeline">
                {activity.map((a,i) => {
                  const u = a.who === "system" ? null : userById(a.who, data);
                  return (
                    <div key={i} className={"tl-item" + (i===activity.length-1?" accent":"")}>
                      <div><b>{u?.name || "Sistem"}</b> {a.text}</div>
                      <div className="when">{fmtDate(a.at, "rel")}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {worklogOpen && (
        <div className="scrim" onClick={() => setWorklogOpen(false)}>
          <div className="dialog" onClick={e => e.stopPropagation()} style={{width:480}}>
            <div className="dialog-head"><h3>Worklog Ekle</h3>
              <button className="icon-btn" onClick={() => setWorklogOpen(false)}><Ic.X size={14}/></button>
            </div>
            <div className="dialog-body col" style={{gap:14}}>
              <div className="field">
                <label className="field-label">Süre (dakika)</label>
                <input className="input" type="number" defaultValue="30"/>
              </div>
              <div className="field">
                <label className="field-label">Açıklama</label>
                <textarea className="textarea" placeholder="Hangi adımları yaptınız?"/>
              </div>
            </div>
            <div className="dialog-foot">
              <button className="btn btn-ghost" onClick={() => setWorklogOpen(false)}>Vazgeç</button>
              <button className="btn btn-accent" onClick={() => { setWorklogOpen(false); pushToast("Worklog kaydedildi"); }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

window.TicketDetail = TicketDetail;
