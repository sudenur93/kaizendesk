// manager.jsx — Manager portal screens
const { useState: mgS, useMemo: mgM } = React;

function Donut({ data, size = 170, thickness = 26, centerLabel, centerValue }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  let acc = 0;
  return (
    <svg width={size} height={size} className="donut">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness}/>
      {data.map((d, i) => {
        const len = total > 0 ? (d.value / total) * C : 0;
        const dash = `${len} ${C - len}`;
        const offset = -acc;
        acc += len;
        return <circle key={i} cx={size/2} cy={size/2} r={r} fill="none"
                       stroke={d.color} strokeWidth={thickness}
                       strokeDasharray={dash} strokeDashoffset={offset}
                       transform={`rotate(-90 ${size/2} ${size/2})`}
                       strokeLinecap="butt"/>;
      })}
      <text x="50%" y="46%" textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--text)" style={{fontVariantNumeric:"tabular-nums"}}>{centerValue ?? total}</text>
      <text x="50%" y="60%" textAnchor="middle" fontSize="10.5" fill="var(--text-3)" letterSpacing="0.06em">{centerLabel || "TOPLAM"}</text>
    </svg>
  );
}

// dual-line area chart for "açılan vs çözülen"
function DualTrend({ opened, resolved, labels, height = 180 }) {
  const w = 560, h = height, pad = { l: 30, r: 12, t: 14, b: 24 };
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const maxY = Math.max(...opened, ...resolved, 1);
  const yTicks = 4;
  const xs = labels.map((_, i) => pad.l + (i / (labels.length - 1)) * innerW);
  const yFor = v => pad.t + innerH - (v / maxY) * innerH;
  const line = arr => arr.map((v, i) => `${i===0?"M":"L"} ${xs[i]} ${yFor(v)}`).join(" ");
  const area = arr => `${line(arr)} L ${xs[xs.length-1]} ${pad.t+innerH} L ${xs[0]} ${pad.t+innerH} Z`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{width:"100%", height: h, display:"block"}}>
      {/* grid */}
      {Array.from({length: yTicks+1}).map((_, i) => {
        const y = pad.t + (i/yTicks) * innerH;
        const v = Math.round(maxY * (1 - i/yTicks));
        return (
          <g key={i}>
            <line x1={pad.l} x2={w-pad.r} y1={y} y2={y} stroke="var(--hairline)" strokeWidth="1"/>
            <text x={pad.l-6} y={y+3} fontSize="10" fill="var(--text-3)" textAnchor="end">{v}</text>
          </g>
        );
      })}
      {/* opened (warn) */}
      <path d={area(opened)} fill="url(#openedGrad)" opacity="0.5"/>
      <path d={line(opened)} fill="none" stroke="var(--warn)" strokeWidth="2"/>
      {/* resolved (ok) */}
      <path d={area(resolved)} fill="url(#resolvedGrad)" opacity="0.45"/>
      <path d={line(resolved)} fill="none" stroke="var(--ok)" strokeWidth="2"/>
      {/* points */}
      {opened.map((v,i) => <circle key={"o"+i} cx={xs[i]} cy={yFor(v)} r="2.5" fill="var(--warn)"/>)}
      {resolved.map((v,i) => <circle key={"r"+i} cx={xs[i]} cy={yFor(v)} r="2.5" fill="var(--ok)"/>)}
      {/* x labels */}
      {labels.map((l, i) => (
        i % 2 === 0 ? <text key={i} x={xs[i]} y={h-6} fontSize="10" fill="var(--text-3)" textAnchor="middle">{l}</text> : null
      ))}
      <defs>
        <linearGradient id="openedGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--warn)" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="var(--warn)" stopOpacity="0"/>
        </linearGradient>
        <linearGradient id="resolvedGrad" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="var(--ok)" stopOpacity="0.3"/>
          <stop offset="100%" stopColor="var(--ok)" stopOpacity="0"/>
        </linearGradient>
      </defs>
    </svg>
  );
}

// SLA compliance ring
function ComplianceRing({ pct, size = 140, thickness = 12 }) {
  const r = (size - thickness) / 2;
  const C = 2 * Math.PI * r;
  const len = (pct / 100) * C;
  const color = pct >= 90 ? "var(--ok)" : pct >= 75 ? "var(--warn)" : "var(--err)";
  return (
    <svg width={size} height={size}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg-soft)" strokeWidth={thickness}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none"
              stroke={color} strokeWidth={thickness}
              strokeDasharray={`${len} ${C-len}`}
              strokeLinecap="round"
              transform={`rotate(-90 ${size/2} ${size/2})`}/>
      <text x="50%" y="48%" textAnchor="middle" fontSize="26" fontWeight="600" fill="var(--text)" style={{fontVariantNumeric:"tabular-nums"}}>%{pct}</text>
      <text x="50%" y="62%" textAnchor="middle" fontSize="10" fill="var(--text-3)" letterSpacing="0.06em">SLA UYUMU</text>
    </svg>
  );
}

function ManagerDash({ tickets, data, navigate }) {
  const [range, setRange] = mgS("week");

  // ===== KPIs =====
  const open = tickets.filter(t => !["resolved","closed"].includes(t.status));
  const breached = tickets.filter(t => slaInfo(t).state === "bad" && !["resolved","closed"].includes(t.status));
  const atRisk = tickets.filter(t => slaInfo(t).state === "warn" && !["resolved","closed"].includes(t.status));
  const closedToday = 11;
  const avgResHours = 6.4;
  const avgResTarget = 8.0;

  // ===== Report 1: Status distribution (open tickets) =====
  const statusDist = [
    { label: STATUS_TR.new,             value: tickets.filter(t => t.status === "new").length,             color: "#3563a6", key: "new" },
    { label: STATUS_TR.in_progress,     value: tickets.filter(t => t.status === "in_progress").length,     color: "#b76b00", key: "in_progress" },
    { label: STATUS_TR.waiting_customer,value: tickets.filter(t => t.status === "waiting_customer").length,color: "#7a766b", key: "waiting_customer" },
  ].filter(d => d.value > 0);

  // ===== Report 2: 14-day trend =====
  const trendLabels = ["19 Nis","20","21","22","23","24","25","26","27","28","29","30","1 May","2"];
  const opened   = [12, 9, 14, 11, 8, 5, 4, 13, 16, 12, 10, 14, 9, 11];
  const resolved = [10, 11, 9, 13, 9, 4, 3, 11, 12, 14, 11, 13, 10, 12];

  // ===== Report 3: Volume by system =====
  const productVolume = data.products.map(p => {
    const ts = tickets.filter(t => t.productId === p.id);
    return {
      id: p.id, name: p.name,
      total: ts.length,
      high: ts.filter(t => t.priority === "high").length,
      medium: ts.filter(t => t.priority === "medium").length,
      low: ts.filter(t => t.priority === "low").length,
      avgHours: (4 + Math.random()*8).toFixed(1),
    };
  }).sort((a,b) => b.total - a.total);
  const productMax = Math.max(...productVolume.map(p => p.total), 1);

  // ===== Report 4: SLA compliance =====
  const totalRecent = tickets.length;
  const compliantPct = Math.round(((totalRecent - breached.length) / Math.max(totalRecent,1)) * 100);
  const slaRiskList = tickets
    .filter(t => slaInfo(t).state !== "ok" && !["resolved","closed"].includes(t.status))
    .sort((a,b) => slaInfo(a).pct - slaInfo(b).pct)
    .slice(0, 5);

  // ===== Report 5: Team performance =====
  const teamPerf = data.agents.map((a, i) => {
    const ts = tickets.filter(t => t.assignee === a.id);
    const resolved = ts.filter(t => ["resolved","closed"].includes(t.status)).length;
    const slaPct = [94, 91, 86, 78, 95][i % 5];
    const avgH = [4.2, 5.1, 6.8, 7.9, 3.6][i % 5];
    return { ...a, resolved, total: ts.length, sla: slaPct, avgH };
  }).sort((a,b) => b.resolved - a.resolved);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Yönetici Panosu</h1>
          <div className="page-sub">2 Mayıs 2026, Cumartesi · Son güncelleme 1 dk önce</div>
        </div>
        <div className="page-actions">
          <div className="seg" style={{display:"inline-flex", background:"var(--bg-soft)", borderRadius:7, padding:3}}>
            {[["today","Bugün"],["week","Bu hafta"],["month","Bu ay"],["q","Çeyrek"]].map(([k,l]) => (
              <button key={k} onClick={() => setRange(k)}
                      className={range===k?"active":""}
                      style={{border:0, background: range===k?"var(--surface)":"transparent", color: range===k?"var(--text)":"var(--text-2)",
                              padding:"5px 12px", fontSize:12.5, borderRadius:5, fontWeight: range===k?500:400,
                              boxShadow: range===k?"var(--shadow-1)":"none", cursor:"pointer"}}>{l}</button>
            ))}
          </div>
          <button className="btn btn-sm"><Ic.Refresh size={13}/> Yenile</button>
          <button className="btn btn-sm btn-primary"><Ic.BarChart size={13}/> Rapor İndir</button>
        </div>
      </div>

      {/* ============ KPI strip ============ */}
      <div className="h-grid-4" style={{marginBottom:18}}>
        <div className="card stat">
          <div className="stat-label">Açık Talepler</div>
          <div className="stat-val">{open.length}</div>
          <div className="stat-trend up"><Ic.ArrowUp size={11}/> dünden +3</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Bugün Kapatılan</div>
          <div className="stat-val">{closedToday}</div>
          <div className="stat-trend">hedef 8 / gün</div>
        </div>
        <div className="card stat">
          <div className="stat-label">SLA İhlali</div>
          <div className="stat-val" style={{color: breached.length ? "var(--err)":"var(--text)"}}>{breached.length}</div>
          <div className="stat-trend down"><Ic.AlertTriangle size={11}/> {atRisk.length} risk altında</div>
        </div>
        <div className="card stat">
          <div className="stat-label">Ort. Çözüm Süresi</div>
          <div className="stat-val">{avgResHours}<span style={{fontSize:14, color:"var(--text-3)", fontWeight:400, marginLeft:2}}>sa</span></div>
          <div className="stat-trend up"><Ic.ArrowDown size={11}/> hedefin %{Math.round((1-avgResHours/avgResTarget)*100)} altı</div>
        </div>
      </div>

      {/* ============ Row 1: Trend (wide) + Status donut ============ */}
      <div style={{display:"grid", gridTemplateColumns:"1.55fr 1fr", gap:18, marginBottom:18}}>
        <div className="card">
          <div className="card-head">
            <div>
              <h3>Talep Hacmi Trendi</h3>
              <div className="sub">Son 14 gün · açılan vs çözülen talep</div>
            </div>
            <div className="row" style={{gap:14}}>
              <span className="row" style={{gap:6, fontSize:12, color:"var(--text-2)"}}>
                <span style={{width:10, height:10, borderRadius:2, background:"var(--warn)"}}/>Açılan
              </span>
              <span className="row" style={{gap:6, fontSize:12, color:"var(--text-2)"}}>
                <span style={{width:10, height:10, borderRadius:2, background:"var(--ok)"}}/>Çözülen
              </span>
            </div>
          </div>
          <div style={{padding:"18px 20px 8px"}}>
            <DualTrend opened={opened} resolved={resolved} labels={trendLabels}/>
          </div>
          <div className="row" style={{padding:"10px 20px 16px", gap:24, borderTop:"1px solid var(--hairline)"}}>
            <div><div className="muted" style={{fontSize:11.5}}>Toplam Açılan</div><div className="mono" style={{fontSize:18, fontWeight:600}}>{opened.reduce((a,b)=>a+b,0)}</div></div>
            <div><div className="muted" style={{fontSize:11.5}}>Toplam Çözülen</div><div className="mono" style={{fontSize:18, fontWeight:600, color:"var(--ok)"}}>{resolved.reduce((a,b)=>a+b,0)}</div></div>
            <div><div className="muted" style={{fontSize:11.5}}>Net Bakiye</div><div className="mono" style={{fontSize:18, fontWeight:600}}>{opened.reduce((a,b)=>a+b,0) - resolved.reduce((a,b)=>a+b,0) >= 0 ? "+" : ""}{opened.reduce((a,b)=>a+b,0) - resolved.reduce((a,b)=>a+b,0)}</div></div>
            <span className="spacer"/>
            <div><div className="muted" style={{fontSize:11.5}}>Çözüm Oranı</div><div className="mono" style={{fontSize:18, fontWeight:600, color: resolved.reduce((a,b)=>a+b,0) >= opened.reduce((a,b)=>a+b,0) ? "var(--ok)":"var(--warn)"}}>%{Math.round(resolved.reduce((a,b)=>a+b,0)/opened.reduce((a,b)=>a+b,0)*100)}</div></div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>Açık Talep Dağılımı</h3><div className="sub">Statüye göre kırılım</div></div>
          </div>
          <div style={{padding:"18px 20px 20px", display:"flex", alignItems:"center", gap:24}}>
            <Donut data={statusDist} centerLabel="AÇIK" centerValue={open.length}/>
            <div className="legend" style={{flex:1, display:"flex", flexDirection:"column", gap:10}}>
              {statusDist.map((d,i) => {
                const pct = Math.round((d.value / open.length) * 100);
                return (
                  <div key={i}>
                    <div className="row" style={{gap:8, marginBottom:4}}>
                      <span style={{width:10, height:10, borderRadius:2, background:d.color, flexShrink:0}}/>
                      <span style={{fontSize:12.5, color:"var(--text-2)"}}>{d.label}</span>
                      <span className="spacer"/>
                      <span className="mono" style={{fontSize:12.5, fontWeight:600}}>{d.value}</span>
                      <span className="muted mono" style={{fontSize:11, width:32, textAlign:"right"}}>%{pct}</span>
                    </div>
                    <div style={{height:3, background:"var(--bg-soft)", borderRadius:99}}>
                      <div style={{height:"100%", width:pct+"%", background:d.color, borderRadius:99}}/>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ============ Row 2: System volume + SLA compliance ============ */}
      <div style={{display:"grid", gridTemplateColumns:"1.55fr 1fr", gap:18, marginBottom:18}}>
        <div className="card">
          <div className="card-head">
            <div><h3>Sistem Bazlı Talep Yoğunluğu</h3><div className="sub">Kaynak sisteme göre, öncelik kırılımı</div></div>
            <span className="muted mono" style={{fontSize:11}}>{tickets.length} toplam</span>
          </div>
          <div style={{padding:"6px 0 4px"}}>
            <table className="tbl" style={{borderCollapse:"collapse"}}>
              <thead>
                <tr>
                  <th style={{width:"32%"}}>Sistem</th>
                  <th>Hacim</th>
                  <th style={{width:90, textAlign:"right"}}>Toplam</th>
                  <th style={{width:80, textAlign:"right"}}>Yüksek</th>
                  <th style={{width:90, textAlign:"right"}}>Ort. Çözüm</th>
                </tr>
              </thead>
              <tbody>
                {productVolume.map(p => (
                  <tr key={p.id} style={{cursor:"default"}}>
                    <td className="ttl" style={{paddingTop:12, paddingBottom:12}}>{p.name}</td>
                    <td>
                      <div style={{display:"flex", height:8, borderRadius:99, overflow:"hidden", background:"var(--bg-soft)", minWidth:140}}>
                        <div style={{width: (p.high/productMax*100)+"%", background:"var(--err)"}}/>
                        <div style={{width: (p.medium/productMax*100)+"%", background:"var(--warn)"}}/>
                        <div style={{width: (p.low/productMax*100)+"%", background:"#9aa0a8"}}/>
                      </div>
                    </td>
                    <td className="mono" style={{textAlign:"right", fontWeight:600}}>{p.total}</td>
                    <td className="mono" style={{textAlign:"right", color: p.high > 2 ? "var(--err)" : "var(--text-2)"}}>{p.high}</td>
                    <td className="mono" style={{textAlign:"right", color:"var(--text-2)"}}>{p.avgHours} sa</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{padding:"10px 20px 14px", gap:14, borderTop:"1px solid var(--hairline)", fontSize:11.5, color:"var(--text-3)"}}>
            <span className="row" style={{gap:5}}><span style={{width:9, height:9, borderRadius:2, background:"var(--err)"}}/>Yüksek</span>
            <span className="row" style={{gap:5}}><span style={{width:9, height:9, borderRadius:2, background:"var(--warn)"}}/>Orta</span>
            <span className="row" style={{gap:5}}><span style={{width:9, height:9, borderRadius:2, background:"#9aa0a8"}}/>Düşük</span>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>SLA Performansı</h3><div className="sub">Genel uyum oranı ve risk durumu</div></div>
          </div>
          <div style={{padding:"18px 20px", display:"flex", alignItems:"center", gap:24}}>
            <ComplianceRing pct={compliantPct}/>
            <div style={{flex:1, display:"flex", flexDirection:"column", gap:12}}>
              <div className="row" style={{gap:10}}>
                <div style={{width:8, height:36, background:"var(--ok)", borderRadius:2}}/>
                <div style={{flex:1}}>
                  <div className="mono" style={{fontSize:18, fontWeight:600}}>{tickets.length - breached.length - atRisk.length}</div>
                  <div className="muted" style={{fontSize:11}}>Hedefte</div>
                </div>
              </div>
              <div className="row" style={{gap:10}}>
                <div style={{width:8, height:36, background:"var(--warn)", borderRadius:2}}/>
                <div style={{flex:1}}>
                  <div className="mono" style={{fontSize:18, fontWeight:600, color:"var(--warn)"}}>{atRisk.length}</div>
                  <div className="muted" style={{fontSize:11}}>Risk Altında</div>
                </div>
              </div>
              <div className="row" style={{gap:10}}>
                <div style={{width:8, height:36, background:"var(--err)", borderRadius:2}}/>
                <div style={{flex:1}}>
                  <div className="mono" style={{fontSize:18, fontWeight:600, color:"var(--err)"}}>{breached.length}</div>
                  <div className="muted" style={{fontSize:11}}>İhlal Edildi</div>
                </div>
              </div>
            </div>
          </div>
          <div style={{borderTop:"1px solid var(--hairline)", padding:"12px 20px", display:"flex", justifyContent:"space-between", alignItems:"center"}}>
            <div className="muted" style={{fontSize:11.5}}>Önceki dönemden <span style={{color:"var(--ok)", fontWeight:600}}>+%4</span></div>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate("m-sla")}>SLA raporu →</button>
          </div>
        </div>
      </div>

      {/* ============ Row 3: SLA risk list + team performance ============ */}
      <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:18}}>
        <div className="card">
          <div className="card-head">
            <div><h3>Aciliyet Listesi</h3><div className="sub">SLA süresi dolmak üzere · hemen aksiyon</div></div>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate("m-sla")}>Tümünü gör →</button>
          </div>
          <table className="tbl">
            <tbody>
              {slaRiskList.map(t => {
                const a = userById(t.assignee, data);
                const info = slaInfo(t);
                return (
                  <tr key={t.id} onClick={() => navigate("a-detail", { id: t.id })} style={{cursor:"pointer"}}>
                    <td className="id" style={{width:74}}>{t.id}</td>
                    <td className="ttl">{t.title}<span className="lbl">· <PriorityBadge priority={t.priority}/></span></td>
                    <td style={{width:130}}><SlaBar t={t}/></td>
                    <td style={{width:36, textAlign:"right"}}>{a ? <Avatar initials={a.initials} size="sm"/> : <span className="muted" style={{fontSize:11}}>—</span>}</td>
                  </tr>
                );
              })}
              {slaRiskList.length === 0 && (
                <tr><td colSpan="4" style={{padding:"32px", textAlign:"center"}}>
                  <div className="row" style={{justifyContent:"center", gap:8, color:"var(--ok)", fontSize:13}}>
                    <Ic.Check size={14}/> SLA riski olan talep yok
                  </div>
                </td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-head">
            <div><h3>Ekip Performansı</h3><div className="sub">Bu hafta · çözüm sayısına göre sıralı</div></div>
            <button className="btn btn-sm btn-ghost" onClick={() => navigate("m-team")}>Detay →</button>
          </div>
          <table className="tbl">
            <thead><tr>
              <th>Personel</th>
              <th style={{textAlign:"right", width:60}}>Aktif</th>
              <th style={{textAlign:"right", width:70}}>Çözülen</th>
              <th style={{textAlign:"right", width:70}}>Ort.</th>
              <th style={{width:120}}>SLA</th>
            </tr></thead>
            <tbody>
              {teamPerf.map((p, i) => (
                <tr key={p.id}>
                  <td>
                    <div className="row" style={{gap:8}}>
                      <Avatar initials={p.initials} size="sm"/>
                      <div>
                        <div style={{fontSize:13, fontWeight:500, display:"flex", alignItems:"center", gap:6}}>
                          {p.name}
                          {i === 0 && <span style={{fontSize:10, padding:"1px 6px", borderRadius:99, background:"color-mix(in oklab, var(--ok) 14%, var(--bg-soft))", color:"var(--ok)", fontWeight:600}}>TOP</span>}
                        </div>
                        <div className="muted" style={{fontSize:11}}>{p.team}</div>
                      </div>
                    </div>
                  </td>
                  <td className="mono" style={{textAlign:"right"}}>{p.total}</td>
                  <td className="mono" style={{textAlign:"right", fontWeight:600}}>{p.resolved}</td>
                  <td className="mono" style={{textAlign:"right", color:"var(--text-2)"}}>{p.avgH} sa</td>
                  <td>
                    <div className="row" style={{gap:8}}>
                      <div style={{flex:1, height:5, background:"var(--bg-soft)", borderRadius:99, minWidth:50, overflow:"hidden"}}>
                        <div style={{height:"100%", width:p.sla+"%", background: p.sla>=90 ? "var(--ok)" : p.sla>=80 ? "var(--warn)" : "var(--err)", borderRadius:99}}/>
                      </div>
                      <span className="mono" style={{fontSize:11.5, color:"var(--text-2)", minWidth:32, textAlign:"right"}}>%{p.sla}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ManagerSLA({ tickets, data, navigate }) {
  const xs = tickets.filter(t => slaInfo(t).state !== "ok" && !["resolved","closed"].includes(t.status));
  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">SLA İhlalleri</h1>
          <div className="page-sub">{xs.length} talep risk altında veya hedefini aştı</div>
        </div>
        <div className="page-actions"><button className="btn btn-sm"><Ic.Mail size={13}/> Eskalasyon Gönder</button></div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr>
            <th>ID</th><th>Başlık</th><th>Sistem</th><th>Atanan</th><th>SLA</th><th>Öncelik</th>
          </tr></thead>
          <tbody>
            {xs.map(t => {
              const a = userById(t.assignee, data);
              return (
                <tr key={t.id} onClick={() => navigate("a-detail", { id: t.id })}>
                  <td className="id">{t.id}</td>
                  <td className="ttl">{t.title}</td>
                  <td className="meta">{data.products.find(p=>p.id===t.productId).name}</td>
                  <td>{a ? <span className="row" style={{gap:8}}><Avatar initials={a.initials} size="sm"/>{a.name}</span> : <span className="muted">Atanmamış</span>}</td>
                  <td><SlaBar t={t}/></td>
                  <td><PriorityBadge priority={t.priority}/></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ManagerTeam({ tickets, data }) {
  const teamPerf = data.agents.map(a => {
    const ts = tickets.filter(t => t.assignee === a.id);
    const resolved = ts.filter(t => ["resolved","closed"].includes(t.status)).length;
    return { ...a, resolved, total: ts.length, sla: 92 - Math.floor(Math.random()*12), avg: (4 + Math.random()*5).toFixed(1) };
  });
  return (
    <div className="page">
      <div className="page-head">
        <div><h1 className="page-title">Ekip Performansı</h1><div className="page-sub">Destek personeli iş yükü ve SLA uyum metrikleri</div></div>
      </div>
      <div className="h-grid-3" style={{marginBottom:18}}>
        {teamPerf.slice(0,3).map(p => (
          <div key={p.id} className="card card-pad">
            <div className="row" style={{gap:12}}>
              <Avatar initials={p.initials} size="lg"/>
              <div><div style={{fontSize:15, fontWeight:600}}>{p.name}</div><div className="muted" style={{fontSize:12}}>{p.team}</div></div>
            </div>
            <div style={{display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:14, marginTop:18}}>
              <div><div className="muted" style={{fontSize:11}}>Aktif</div><div style={{fontSize:20, fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{p.total}</div></div>
              <div><div className="muted" style={{fontSize:11}}>Ort. saat</div><div style={{fontSize:20, fontWeight:600, fontVariantNumeric:"tabular-nums"}}>{p.avg}</div></div>
              <div><div className="muted" style={{fontSize:11}}>SLA</div><div style={{fontSize:20, fontWeight:600, fontVariantNumeric:"tabular-nums", color: p.sla>85?"var(--ok)":"var(--warn)"}}>%{p.sla}</div></div>
            </div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="card-head"><h3>Tüm Personel</h3></div>
        <table className="tbl">
          <thead><tr><th>Personel</th><th>Ekip</th><th>Aktif</th><th>Çözülen</th><th>SLA Uyumu</th><th>Ort. Çözüm</th></tr></thead>
          <tbody>
            {teamPerf.map(p => (
              <tr key={p.id}>
                <td><div className="row" style={{gap:8}}><Avatar initials={p.initials} size="sm"/>{p.name}</div></td>
                <td className="meta">{p.team}</td>
                <td className="mono">{p.total}</td>
                <td className="mono">{p.resolved}</td>
                <td>
                  <div className="row" style={{gap:8, minWidth:140}}>
                    <div style={{flex:1, height:4, background:"var(--bg-soft)", borderRadius:99}}>
                      <div style={{height:"100%", width:p.sla+"%", background: p.sla>85?"var(--ok)":"var(--warn)", borderRadius:99}}/>
                    </div>
                    <span className="mono" style={{fontSize:11.5}}>%{p.sla}</span>
                  </div>
                </td>
                <td className="mono">{p.avg} sa</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

window.ManagerDash = ManagerDash;
window.ManagerSLA = ManagerSLA;
window.ManagerTeam = ManagerTeam;
