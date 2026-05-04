// customer.jsx — Customer portal screens
const { useState: cuS, useMemo: cuM } = React;

const TITLE_MAX = 200;
const DESC_MAX = 1000;
const FILE_MAX_MB = 20;
const FILE_MAX_BYTES = FILE_MAX_MB * 1024 * 1024;

// ============ Customer ticket list ============
function CustomerList({ tickets, navigate, search, data }) {
  const [statusFilter, setStatusFilter] = cuS("all");
  const [priorityFilter, setPriorityFilter] = cuS("all");
  const [productFilter, setProductFilter] = cuS("all");

  const myT = tickets.filter(t => t.reporter === "c1");
  const filtered = myT.filter(t => {
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (productFilter !== "all" && t.productId !== productFilter) return false;
    if (search && !(t.id + " " + t.title).toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const activeFilters = (priorityFilter !== "all" ? 1 : 0) + (productFilter !== "all" ? 1 : 0);

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="page-head">
          <div>
            <h1 className="page-title">Taleplerim</h1>
            <div className="page-sub">Açtığınız destek taleplerini buradan takip edin.</div>
          </div>
          <div className="page-actions">
            <button className="btn btn-accent" onClick={() => navigate("c-new")}>
              <Ic.Plus size={14}/> Yeni Talep
            </button>
          </div>
        </div>

        <div className="h-grid-3" style={{marginBottom: 22}}>
          <div className="card stat">
            <div className="stat-label">Açık Talepler</div>
            <div className="stat-val">{myT.filter(t => !["resolved","closed"].includes(t.status)).length}</div>
            <div className="stat-trend">son 30 gün</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Çözüm Bekleyen</div>
            <div className="stat-val">{myT.filter(t => t.status === "waiting_customer").length}</div>
            <div className="stat-trend">yanıtınızı bekliyor</div>
          </div>
          <div className="card stat">
            <div className="stat-label">Bu Ay Çözülen</div>
            <div className="stat-val">{myT.filter(t => ["resolved","closed"].includes(t.status)).length}</div>
            <div className="stat-trend up"><Ic.Trend size={12}/> ortalama 6.4 saatte</div>
          </div>
        </div>

        <div className="card">
          <div className="fbar">
            <div className="seg">
              {[["all","Tümü"],["new","Yeni"],["in_progress","İşlemde"],["waiting_customer","Bekleniyor"],["resolved","Çözüldü"]].map(([k,l]) => (
                <button key={k} className={statusFilter===k?"active":""} onClick={() => setStatusFilter(k)}>{l}</button>
              ))}
            </div>
            <div className="gap"/>
            <select className="select" style={{width:150}} value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)}>
              <option value="all">Öncelik: Tümü</option>
              <option value="high">Yüksek</option>
              <option value="medium">Orta</option>
              <option value="low">Düşük</option>
            </select>
            <select className="select" style={{width:220}} value={productFilter} onChange={e => setProductFilter(e.target.value)}>
              <option value="all">Sistem: Tümü</option>
              {data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {activeFilters > 0 && (
              <button className="btn btn-sm btn-ghost" onClick={() => { setPriorityFilter("all"); setProductFilter("all"); }}>
                <Ic.X size={12}/> Filtreleri temizle
              </button>
            )}
          </div>
          <table className="tbl">
            <thead><tr>
              <th style={{width:90}}>ID</th>
              <th>Başlık</th>
              <th style={{width:140}}>Durum</th>
              <th style={{width:100}}>Öncelik</th>
              <th style={{width:160}}>SLA</th>
              <th style={{width:120}}>Tarih</th>
            </tr></thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} onClick={() => navigate("c-detail", { id: t.id })}>
                  <td className="id">{t.id}</td>
                  <td className="ttl">{t.title}<span className="lbl">· {data.products.find(p=>p.id===t.productId).name}</span></td>
                  <td><StatusBadge status={t.status}/></td>
                  <td><PriorityBadge priority={t.priority}/></td>
                  <td><SlaBar t={t}/></td>
                  <td className="meta">{fmtDate(t.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan="6" className="muted" style={{padding:"40px", textAlign:"center"}}>
                  Bu filtreye uygun talep bulunamadı.
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ============ New ticket form ============
function NewTicket({ data, navigate, pushToast, onCreate }) {
  const [productId, setProd] = cuS("");
  const [issue, setIssue] = cuS("");
  const [title, setTitle] = cuS("");
  const [desc, setDesc] = cuS("");
  const [priority, setPriority] = cuS("medium");
  const [files, setFiles] = cuS([]);
  const product = data.products.find(p => p.id === productId);
  const totalBytes = files.reduce((s, f) => s + f.bytes, 0);
  const totalMB = (totalBytes / 1024 / 1024);
  const overLimit = totalBytes > FILE_MAX_BYTES;
  const valid = productId && issue && title.length >= 6 && title.length <= TITLE_MAX
                && desc.length >= 20 && desc.length <= DESC_MAX && !overLimit;

  function addFiles(rawFiles) {
    const accepted = [];
    const rejected = [];
    let runningTotal = totalBytes;
    Array.from(rawFiles || []).forEach(f => {
      if (f.size > FILE_MAX_BYTES || runningTotal + f.size > FILE_MAX_BYTES) {
        rejected.push(f.name);
        return;
      }
      runningTotal += f.size;
      accepted.push({
        name: f.name,
        bytes: f.size,
        size: f.size > 1024*1024 ? (f.size/1024/1024).toFixed(1)+" MB" : Math.max(1, (f.size/1024)|0)+" KB",
        kind: f.type.startsWith("image/") ? "img" : "log",
      });
    });
    if (accepted.length) setFiles(fs => [...fs, ...accepted]);
    if (rejected.length) pushToast(`Boyut sınırı aşıldı: ${rejected.join(", ")}`);
  }

  function onDrop(e) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  function onPick(e) { addFiles(e.target.files); e.target.value = ""; }

  function submit() {
    if (!valid) { pushToast("Eksik veya hatalı alanlar var"); return; }
    const id = "TK-" + (2842 + Math.floor(Math.random()*9));
    onCreate && onCreate({ id, title, productId, issue, priority, status: "new" });
    pushToast(`${id} oluşturuldu`);
    navigate("c-list");
  }

  const titleColor = title.length > TITLE_MAX ? "var(--err)" : title.length > TITLE_MAX*0.9 ? "var(--warn)" : "var(--text-3)";
  const descColor = desc.length > DESC_MAX ? "var(--err)" : desc.length > DESC_MAX*0.9 ? "var(--warn)" : "var(--text-3)";

  return (
    <div className="page">
      <div className="page-narrow" style={{maxWidth: 880}}>
        <div className="page-head">
          <div>
            <h1 className="page-title">Yeni Destek Talebi</h1>
            <div className="page-sub">Bir sistem ve sorun tipini seçin, yaşadığınız problemi anlatın.</div>
          </div>
        </div>

        <div className="card card-pad" style={{display:"flex", flexDirection:"column", gap: 20}}>
          <div className="h-grid-2">
            <div className="field">
              <label className="field-label">Ürün / Sistem<span className="req">*</span></label>
              <select className="select" value={productId} onChange={e => { setProd(e.target.value); setIssue(""); }}>
                <option value="">Sistem seçin…</option>
                {data.products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <div className="field-hint">Sorununuzun ait olduğu ana sistemi seçin.</div>
            </div>
            <div className="field">
              <label className="field-label">Sorun Tipi<span className="req">*</span></label>
              <select className="select" value={issue} onChange={e => setIssue(e.target.value)} disabled={!product}>
                <option value="">{product ? "Sorun tipi seçin…" : "Önce sistem seçin"}</option>
                {product && product.issues.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
              <div className="field-hint">Sistem seçildikten sonra ilgili sorunlar listelenir.</div>
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Başlık<span className="req">*</span>
              <span className="spacer"/>
              <span className="mono" style={{fontSize:11, color: titleColor}}>{title.length} / {TITLE_MAX}</span>
            </label>
            <input className="input" placeholder="Kısa ve açıklayıcı bir başlık yazın"
                   maxLength={TITLE_MAX}
                   value={title} onChange={e => setTitle(e.target.value.slice(0, TITLE_MAX))}/>
            <div className="field-hint">En az 6, en fazla {TITLE_MAX} karakter.</div>
          </div>

          <div className="field">
            <label className="field-label">
              Detaylı Açıklama<span className="req">*</span>
              <span className="spacer"/>
              <span className="mono" style={{fontSize:11, color: descColor}}>{desc.length} / {DESC_MAX}</span>
            </label>
            <textarea className="textarea" placeholder="Ne zaman başladı, ne tür hatalar görüyorsunuz, hangi adımlarla yeniden üretiliyor?"
                      maxLength={DESC_MAX}
                      value={desc} onChange={e => setDesc(e.target.value.slice(0, DESC_MAX))}/>
            <div className="field-hint">En az 20, en fazla {DESC_MAX} karakter.</div>
          </div>

          <div className="h-grid-2">
            <div className="field">
              <label className="field-label">Öncelik<span className="req">*</span></label>
              <div className="row" style={{gap:8}}>
                {["low","medium","high"].map(p => (
                  <button key={p}
                          className={"btn btn-sm" + (priority===p?" btn-primary":"")}
                          onClick={() => setPriority(p)}>
                    {PRIORITY[p].label}
                  </button>
                ))}
              </div>
              <div className="field-hint">Yüksek öncelik daha kısa SLA hedef süresine alınır.</div>
            </div>
            <div className="field">
              <label className="field-label">Tahmini SLA</label>
              <div className="card" style={{padding:"12px 14px", background:"var(--surface-2)"}}>
                <div className="mono" style={{fontSize:14}}>{priority==="high"?"8 saat": priority==="medium"?"12 saat":"24 saat"}</div>
                <div className="muted" style={{fontSize:11.5, marginTop:4}}>Çözüm hedefi (iş saatleri içinde)</div>
              </div>
            </div>
          </div>

          <div className="field">
            <label className="field-label">
              Ek Dosyalar
              <span className="spacer"/>
              <span className="mono" style={{fontSize:11, color: overLimit ? "var(--err)" : "var(--text-3)"}}>
                {totalMB.toFixed(1)} MB / {FILE_MAX_MB} MB
              </span>
            </label>
            <label className="dropzone" onDragOver={e=>e.preventDefault()} onDrop={onDrop} style={{cursor:"default", display:"block"}}>
              <input type="file" multiple style={{display:"none"}} onChange={onPick}
                     accept=".txt,.docx,.xlsx,.pdf,.png,.jpg,.jpeg"/>
              <Ic.Paperclip/>
              <div style={{marginTop:8}}>Dosyaları sürükleyin veya <strong>seçmek için tıklayın</strong></div>
              <div className="formats">
                <span>txt</span><span>docx</span><span>xlsx</span><span>pdf</span><span>png</span><span>jpeg</span>
              </div>
              <div className="muted" style={{fontSize:11, marginTop:8}}>
                Dosya başına ve toplamda en fazla <b>{FILE_MAX_MB} MB</b>
              </div>
            </label>
            {overLimit && (
              <div style={{fontSize:12, color:"var(--err)", display:"flex", alignItems:"center", gap:6, marginTop:6}}>
                <Ic.AlertTriangle size={12}/> Toplam boyut {FILE_MAX_MB} MB sınırını aştı. Lütfen bazı dosyaları kaldırın.
              </div>
            )}
            {files.length > 0 && (
              <div className="col" style={{gap:6, marginTop:8}}>
                {files.map((f,i) => (
                  <div key={i} className="row" style={{padding:"8px 12px", border:"1px solid var(--hairline)", borderRadius:6}}>
                    {f.kind==="img" ? <Ic.Image size={14}/> : <Ic.File size={14}/>}
                    <span style={{fontSize:13}}>{f.name}</span>
                    <span className="muted" style={{fontSize:11.5}}>{f.size}</span>
                    <span className="spacer"/>
                    <button className="btn-ghost icon-btn" onClick={() => setFiles(fs => fs.filter((_,j)=>j!==i))}><Ic.X size={12}/></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="row" style={{justifyContent:"flex-end", gap:8, marginTop:8}}>
            <button className="btn btn-ghost" onClick={() => navigate("c-list")}>Vazgeç</button>
            <button className={"btn " + (valid ? "btn-accent" : "")} disabled={!valid} onClick={submit}>
              <Ic.Send size={14}/> Talep Oluştur
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

window.CustomerList = CustomerList;
window.NewTicket = NewTicket;
