import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Ic from '../components/Icons';
import { Avatar, PriorityBadge, SlaBar, StatusBadge, fmtDate, getInitials, slaInfo } from '../components/Common';
import {
  addTicketComment,
  addWorklog,
  assignTicket,
  downloadTicketAttachment,
  getAgents,
  getCategories,
  getCurrentUserProfile,
  getIssueTypes,
  getProducts,
  getRole,
  getTicket,
  getTicketAttachments,
  getTicketComments,
  getWorklogs,
  updateTicketStatus,
  uploadTicketAttachment,
} from '../services/api';

const NOTE_INTERNAL = 'internal';
const NOTE_EXTERNAL = 'external';

const STATUS_TRANSITIONS = {
  NEW:                  [{ value: 'IN_PROGRESS',          label: 'İşleme Al',      accent: true }],
  IN_PROGRESS:          [{ value: 'WAITING_FOR_CUSTOMER', label: 'Müşteri Bekle',  accent: false },
                         { value: 'RESOLVED',             label: 'Çözüldü',        accent: true }],
  WAITING_FOR_CUSTOMER: [{ value: 'IN_PROGRESS',          label: 'Geri Al',        accent: false },
                         { value: 'RESOLVED',             label: 'Çözüldü',        accent: true }],
  RESOLVED:             [{ value: 'CLOSED',               label: 'Kapat',          accent: false }],
  CLOSED:               [],
};

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(value) {
  return { NEW: 'Yeni', IN_PROGRESS: 'İşlemde', WAITING_FOR_CUSTOMER: 'Müşteri Bekleniyor', RESOLVED: 'Çözüldü', CLOSED: 'Kapalı' }[value] || value;
}

function fmtWorklogTime(min) {
  if (!min) return '0 dk';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} dk`;
  if (m === 0) return `${h} saat`;
  return `${h} saat ${m} dk`;
}

export default function AgentTicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: shellUser, pushToast } = useOutletContext() || {};
  const [user, setUser] = useState(shellUser || null);
  const [ticket, setTicket] = useState(null);
  const [productName, setProductName] = useState('-');
  const [categoryName, setCategoryName] = useState('-');
  const [issueTypeName, setIssueTypeName] = useState('-');
  const [attachments, setAttachments] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [noteMode, setNoteMode] = useState(NOTE_EXTERNAL);
  const [worklogs, setWorklogs] = useState([]);
  const [showWorklog, setShowWorklog] = useState(false);
  const [wlMinutes, setWlMinutes] = useState('');
  const [wlDate, setWlDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [wlNote, setWlNote] = useState('');
  const [wlWorking, setWlWorking] = useState(false);
  const [wlError, setWlError] = useState('');
  const [uploadWorking, setUploadWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [resolveModal, setResolveModal] = useState(null);
  const [resolveNote, setResolveNote] = useState('');
  const [resolveWorking, setResolveWorking] = useState(false);
  const isManager = getRole() === 'MANAGER';
  const [agents, setAgents] = useState([]);
  const [reassigning, setReassigning] = useState(false);

  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    getAgents()
      .then((list) => { if (!cancelled) setAgents(list); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [isManager]);

  async function handleReassign(newAgentId) {
    if (!ticket?.id || !newAgentId) return;
    setReassigning(true);
    try {
      const updated = await assignTicket(ticket.id, Number(newAgentId));
      setTicket(updated);
      const target = agents.find((a) => String(a.id) === String(newAgentId));
      if (pushToast) pushToast(`#${ticket.id} → ${target?.name || 'uzman'} atandı`);
    } catch {
      if (pushToast) pushToast('Atama yapılamadı.');
    } finally {
      setReassigning(false);
    }
  }

  async function loadDetail() {
    setLoading(true);
    setError('');
    try {
      const [userData, ticketData, productData, attachmentData, commentData, worklogData] = await Promise.all([
        getCurrentUserProfile(),
        getTicket(id),
        getProducts(),
        getTicketAttachments(id),
        getTicketComments(id),
        getWorklogs(id),
      ]);

      setUser(userData);
      setTicket(ticketData);
      setAttachments(attachmentData);
      setComments(commentData);
      setWorklogs(worklogData);

      const product = productData.find((p) => p.id === ticketData.productId);
      setProductName(product?.name || '-');

      if (ticketData.productId && ticketData.categoryId) {
        const categoryData = await getCategories(ticketData.productId);
        const category = categoryData.find((c) => c.id === ticketData.categoryId);
        setCategoryName(category?.name || '-');

        if (ticketData.issueTypeIds?.length > 0) {
          const issueTypeData = await getIssueTypes(ticketData.categoryId);
          const it = issueTypeData.find((x) => x.id === ticketData.issueTypeIds[0]);
          setIssueTypeName(it?.name || '-');
        }
      }
    } catch {
      setError('Talep detayı yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDetail(); }, [id]);

  const isAssignedToMe = ticket != null && user != null && String(ticket.assignedAgentId) === String(user.id);
  const isUnassigned = ticket && !ticket.assignedAgentId;
  const availableTransitions = ticket ? (STATUS_TRANSITIONS[ticket.status] || []) : [];
  const sla = useMemo(() => slaInfo(ticket), [ticket]);

  /* Aktivite: ticket meta + yorumlar → kronolojik zaman çizelgesi */
  const activities = useMemo(() => {
    const items = [];
    if (ticket?.createdAt) {
      items.push({ id: 'created', at: ticket.createdAt, text: `${ticket.createdByName || ticket.createdByUsername || 'Müşteri'} ticket'ı açtı` });
    }
    if (ticket?.slaTargetAt) {
      items.push({ id: 'sla', at: ticket.slaTargetAt, text: `Sistem SLA hedefi atandı` });
    }
    comments.forEach((c) => {
      items.push({ id: `c-${c.id}`, at: c.createdAt, text: `${c.authorName || '?'} ${c.internal ? 'iç not ekledi' : 'yorum yaptı'}` });
    });
    if (ticket?.resolvedAt) {
      items.push({ id: 'resolved', at: ticket.resolvedAt, text: 'Çözüldü olarak işaretlendi' });
    }
    if (ticket?.closedAt) {
      items.push({ id: 'closed', at: ticket.closedAt, text: 'Kapatıldı' });
    }
    return items.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [ticket, comments]);

  async function handleClaimTicket() {
    if (!user?.id || !ticket?.id) return;
    setWorking(true);
    try {
      const updated = await assignTicket(ticket.id, user.id);
      setTicket(updated);
      if (pushToast) pushToast(`#${ticket.id} üzerinize alındı`);
    } catch {
      if (pushToast) pushToast('Talep üzerinize alınamadı.');
    } finally {
      setWorking(false);
    }
  }

  function handleTransitionClick(toStatus) {
    if (toStatus === 'RESOLVED') {
      setResolveModal({ toStatus });
      setResolveNote('');
    } else {
      applyTransition(toStatus, '');
    }
  }

  async function applyTransition(toStatus, note) {
    setWorking(true);
    try {
      const updated = await updateTicketStatus(ticket.id, toStatus, note);
      setTicket(updated);
      if (pushToast) pushToast(`Durum güncellendi: ${statusLabel(updated.status)}`);
    } catch (err) {
      if (pushToast) pushToast(err.response?.data?.message || 'Durum güncellenemedi.');
    } finally {
      setWorking(false);
    }
  }

  async function confirmResolve() {
    const note = resolveNote.trim();
    if (!note) { if (pushToast) pushToast('Çözüm notu zorunludur.'); return; }
    setResolveWorking(true);
    try {
      await applyTransition(resolveModal.toStatus, note);
      setResolveModal(null);
      setResolveNote('');
    } finally {
      setResolveWorking(false);
    }
  }

  async function handleCommentSubmit(e) {
    e.preventDefault();
    const message = commentText.trim();
    if (!message) return;
    setWorking(true);
    try {
      const created = await addTicketComment(ticket.id, message, noteMode === NOTE_INTERNAL);
      setComments((prev) => [...prev, created]);
      setCommentText('');
      if (pushToast) pushToast(noteMode === NOTE_INTERNAL ? 'İç not eklendi' : 'Yanıt gönderildi');
    } catch {
      if (pushToast) pushToast('Yanıt gönderilemedi.');
    } finally {
      setWorking(false);
    }
  }

  async function handleWorklogSubmit(e) {
    e.preventDefault();
    const minutes = parseInt(wlMinutes, 10);
    if (!minutes || minutes <= 0) return;
    setWlWorking(true);
    setWlError('');
    try {
      const created = await addWorklog(ticket.id, { timeSpent: minutes, workDate: wlDate || null, note: wlNote.trim() || null });
      setWorklogs((prev) => [...prev, created]);
      setWlMinutes('');
      setWlNote('');
      if (pushToast) pushToast('İş kaydı eklendi');
    } catch {
      setWlError('İş kaydı eklenemedi.');
    } finally {
      setWlWorking(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file || !ticket?.id) return;
    setUploadWorking(true);
    try {
      const created = await uploadTicketAttachment(ticket.id, file);
      setAttachments((prev) => [...prev, created]);
      if (pushToast) pushToast(`"${file.name}" yüklendi`);
    } catch {
      if (pushToast) pushToast('Dosya yüklenemedi.');
    } finally {
      setUploadWorking(false);
      e.target.value = '';
    }
  }

  async function handleDownload(attachment) {
    const blob = await downloadTicketAttachment(ticket.id, attachment.id);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = attachment.originalFileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  const totalWorklogMinutes = useMemo(() => worklogs.reduce((s, w) => s + (w.timeSpent || 0), 0), [worklogs]);

  return (
    <div className="page">
      <div className="page-narrow">

        {/* Geri */}
        <div style={{ marginBottom: 14 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/agent/tickets')}>
            ← Listeye dön
          </button>
        </div>

        {error && (
          <div className="badge p-high" style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}>
            <Ic.AlertTriangle size={13} /> {error}
          </div>
        )}

        {loading ? (
          <div className="card card-pad muted" style={{ textAlign: 'center', padding: 60 }}>Yükleniyor…</div>
        ) : !ticket ? (
          <div className="card card-pad muted" style={{ textAlign: 'center', padding: 60 }}>Talep bulunamadı.</div>
        ) : (
          <>
            {/* ── Başlık satırı ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span className="tag" style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
                    #{ticket.id}
                  </span>
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                  {ticket.slaBreached && (
                    <span className="badge p-high" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Ic.AlertTriangle size={11} /> SLA İhlali
                    </span>
                  )}
                  {!ticket.slaBreached && ticket.slaAtRisk && (
                    <span className="badge p-medium" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Ic.AlertTriangle size={11} /> SLA Riski
                    </span>
                  )}
                </div>
                <h1 className="page-title" style={{ marginBottom: 8 }}>{ticket.title}</h1>
                <div className="row" style={{ gap: 10, color: 'var(--text-3)', fontSize: 13, flexWrap: 'wrap' }}>
                  <span><b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{ticket.createdByName || ticket.createdByUsername || 'Müşteri'}</b> tarafından açıldı</span>
                  {ticket.createdAt && <><span>·</span><span>{fmtDate(ticket.createdAt, 'datetime')}</span></>}
                  <span>·</span><span>{productName}</span>
                </div>
              </div>

              {/* Header aksiyon butonları */}
              <div className="row" style={{ gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  className={`btn btn-sm${showWorklog ? ' btn-accent' : ''}`}
                  onClick={() => setShowWorklog((v) => !v)}
                >
                  <Ic.Clock size={13} />
                  Worklog {worklogs.length > 0 && `(${fmtWorklogTime(totalWorklogMinutes)})`}
                </button>
                {isUnassigned && (
                  <button type="button" className="btn btn-sm btn-accent" onClick={handleClaimTicket} disabled={working}>
                    <Ic.Check size={13} /> Üzerime Al
                  </button>
                )}
                {isAssignedToMe && availableTransitions.map((tr) => (
                  <button
                    key={tr.value}
                    type="button"
                    className={`btn btn-sm${tr.accent ? ' btn-accent' : ''}`}
                    disabled={working}
                    onClick={() => handleTransitionClick(tr.value)}
                  >
                    {working ? '…' : `✓ ${tr.label}`}
                  </button>
                ))}
              </div>
            </div>

            {/* ── Worklog panel (toggle) ── */}
            {showWorklog && (
              <div className="card" style={{ marginBottom: 18 }}>
                <div className="card-head">
                  <div>
                    <h3>İş Kaydı</h3>
                    <div className="sub">Toplam: {fmtWorklogTime(totalWorklogMinutes)}{worklogs.length > 0 && ` · ${worklogs.length} kayıt`}</div>
                  </div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowWorklog(false)}>
                    <Ic.X size={13} />
                  </button>
                </div>
                {worklogs.length > 0 && (
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--hairline)' }}>
                    <div className="timeline">
                      {[...worklogs].reverse().map((wl) => (
                        <div key={wl.id} className="tl-item">
                          <div className="row" style={{ gap: 8 }}>
                            <b>{fmtWorklogTime(wl.timeSpent)}</b>
                            <span className="muted" style={{ fontSize: 12 }}>· {wl.authorUsername}</span>
                            <span className="spacer" />
                            <span className="when">{wl.workDate || fmtDate(wl.createdAt, 'short')}</span>
                          </div>
                          {wl.note && <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>{wl.note}</div>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div style={{ padding: '14px 20px' }}>
                  {wlError && (
                    <div className="badge p-high" style={{ display: 'flex', marginBottom: 10, padding: '7px 10px', gap: 6 }}>
                      <Ic.AlertTriangle size={12} /> {wlError}
                    </div>
                  )}
                  <form className="col" style={{ gap: 8 }} onSubmit={handleWorklogSubmit}>
                    <div className="row" style={{ gap: 8 }}>
                      <div className="field" style={{ flex: 1 }}>
                        <label className="field-label">
                          Süre (dakika)
                          {wlMinutes > 0 && <span className="muted" style={{ fontWeight: 400, marginLeft: 6 }}>= {fmtWorklogTime(Number(wlMinutes))}</span>}
                        </label>
                        <input type="number" className="input" min="1" placeholder="ör. 30" value={wlMinutes} onChange={(e) => setWlMinutes(e.target.value)} disabled={wlWorking} required />
                      </div>
                      <div className="field" style={{ flex: 1 }}>
                        <label className="field-label">Tarih</label>
                        <input type="date" className="input" value={wlDate} onChange={(e) => setWlDate(e.target.value)} disabled={wlWorking} />
                      </div>
                    </div>
                    <input type="text" className="input" placeholder="Not (opsiyonel)" value={wlNote} onChange={(e) => setWlNote(e.target.value)} maxLength={200} disabled={wlWorking} />
                    <button type="submit" className="btn" disabled={wlWorking || !wlMinutes} style={{ alignSelf: 'flex-end' }}>
                      <Ic.Clock size={13} /> {wlWorking ? 'Kaydediliyor…' : 'Süre Ekle'}
                    </button>
                  </form>
                </div>
              </div>
            )}

            {/* ── Ana grid ── */}
            <div className="detail-grid">

              {/* Sol: Açıklama + Konuşma */}
              <div className="col" style={{ gap: 18, minWidth: 0 }}>

                {/* Açıklama */}
                <div className="card card-pad">
                  <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Açıklama
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.65, whiteSpace: 'pre-wrap', color: 'var(--text-2)' }}>
                    {ticket.description}
                  </div>

                  {/* Ekler */}
                  {(attachments.length > 0 || true) && (
                    <>
                      <div className="row" style={{ marginTop: 20, marginBottom: 10 }}>
                        <span className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase' }}>
                          Ekler ({attachments.length})
                        </span>
                        <span className="spacer" />
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', fontSize: 12, fontWeight: 500, border: '1px solid var(--hairline-strong)', borderRadius: 6, cursor: uploadWorking ? 'wait' : 'pointer', color: 'var(--text-2)' }}>
                          <Ic.Upload size={12} />
                          {uploadWorking ? 'Yükleniyor…' : 'Dosya Ekle'}
                          <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadWorking} />
                        </label>
                      </div>
                      {attachments.length > 0 ? (
                        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                          {attachments.map((att) => (
                            <button key={att.id} type="button" onClick={() => handleDownload(att)}
                              className="row" style={{ padding: '7px 12px', border: '1px solid var(--hairline)', borderRadius: 8, background: 'var(--surface-2)', cursor: 'pointer', gap: 8 }}>
                              <Ic.File size={13} />
                              <span style={{ fontSize: 13 }}>{att.originalFileName}</span>
                              <span className="muted mono" style={{ fontSize: 11 }}>{formatFileSize(att.fileSizeBytes)}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="muted" style={{ fontSize: 13, margin: 0 }}>Henüz ek dosya yok.</p>
                      )}
                    </>
                  )}
                </div>

                {/* Konuşma */}
                <div className="card">
                  <div className="card-head">
                    <div>
                      <h3>Konuşma</h3>
                      <div className="sub">Müşteri ve destek ekibi arasındaki yazışmalar</div>
                    </div>
                    <span className="muted" style={{ fontSize: 12 }}>{comments.length} mesaj</span>
                  </div>

                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {comments.length === 0 && <p className="muted" style={{ fontSize: 13, margin: 0 }}>Henüz yanıt yok.</p>}
                    {comments.map((c) => (
                      <div key={c.id} className={`msg${c.internal ? ' internal' : ''}`}>
                        <Avatar initials={getInitials(c.authorName || '?')} size={c.internal ? 'sm' : undefined} />
                        <div className="body">
                          <div className="row" style={{ gap: 6 }}>
                            <span className="who">{c.authorName || 'Sistem'}</span>
                            {c.internal && (
                              <span style={{ fontSize: 10, padding: '1px 6px', background: 'color-mix(in oklab, var(--warn) 14%, var(--bg-soft))', color: 'var(--warn)', borderRadius: 4, fontWeight: 600, letterSpacing: '.04em' }}>
                                İÇ NOT
                              </span>
                            )}
                            <span className="spacer" />
                            <span className="time">{fmtDate(c.createdAt, 'datetime')}</span>
                          </div>
                          <div className="text" style={{ whiteSpace: 'pre-wrap' }}>{c.message}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '0 20px 20px' }}>
                    <form className="composer" onSubmit={handleCommentSubmit}>
                      <div className="composer-tabs">
                        <button type="button" className={noteMode === NOTE_EXTERNAL ? 'active' : ''} onClick={() => setNoteMode(NOTE_EXTERNAL)}>
                          Müşteri Yorumu
                        </button>
                        <button type="button" className={noteMode === NOTE_INTERNAL ? 'active internal' : ''} onClick={() => setNoteMode(NOTE_INTERNAL)}>
                          İç Not · yalnızca destek ekibi
                        </button>
                      </div>
                      <textarea
                        placeholder={noteMode === NOTE_INTERNAL ? 'Takım içi not (müşteriye görünmez)…' : 'Müşteriye yanıtınızı yazın… (Ctrl+Enter ile gönder)'}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey) && commentText.trim()) handleCommentSubmit(e); }}
                        maxLength={1000}
                        disabled={working}
                        style={noteMode === NOTE_INTERNAL ? { background: 'color-mix(in oklab, var(--warn) 6%, var(--surface))' } : {}}
                      />
                      <div className="composer-foot">
                        <span className="muted mono" style={{ fontSize: 11, paddingLeft: 4 }}>{commentText.length} / 1000</span>
                        <button type="submit"
                          className={`btn btn-sm ${noteMode === NOTE_INTERNAL ? 'btn-warn' : ''} ${commentText.trim() && noteMode === NOTE_EXTERNAL ? 'btn-accent' : ''}`}
                          disabled={working || !commentText.trim()}>
                          <Ic.Send size={13} />
                          {working ? 'Gönderiliyor…' : noteMode === NOTE_INTERNAL ? 'Not Ekle' : 'Gönder'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>
              </div>

              {/* Sağ: Detaylar + SLA + Aktivite */}
              <div className="col" style={{ gap: 18 }}>

                {/* Detaylar */}
                <div className="card card-pad">
                  <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 16 }}>
                    Detaylar
                  </div>
                  <dl className="kv" style={{ rowGap: 10 }}>
                    <dt>Durum</dt>
                    <dd><StatusBadge status={ticket.status} /></dd>

                    <dt>Öncelik</dt>
                    <dd><PriorityBadge priority={ticket.priority} /></dd>

                    <dt>Atanan</dt>
                    <dd>
                      {isManager ? (
                        <select
                          className="select"
                          style={{ padding: '4px 8px', fontSize: 12.5 }}
                          value={ticket.assignedAgentId || ''}
                          onChange={(e) => handleReassign(e.target.value)}
                          disabled={reassigning}
                        >
                          <option value="" disabled>Uzman seçin…</option>
                          {agents.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.name}{a.email ? ` · ${a.email}` : ''} {a.role === 'MANAGER' ? '(Yönetici)' : ''}
                            </option>
                          ))}
                        </select>
                      ) : ticket.assignedAgentName ? (
                        <span className="row" style={{ gap: 6 }}>
                          <Avatar initials={getInitials(ticket.assignedAgentName)} size="sm" />
                          <span style={{ fontSize: 13 }}>{ticket.assignedAgentName}</span>
                          {isAssignedToMe && <span className="muted" style={{ fontSize: 11 }}>(siz)</span>}
                        </span>
                      ) : (
                        <span className="row" style={{ gap: 6 }}>
                          <span className="muted">Atanmamış</span>
                          {isUnassigned && (
                            <button type="button" className="btn btn-sm btn-accent" style={{ padding: '2px 8px', fontSize: 11 }} onClick={handleClaimTicket} disabled={working}>
                              Al
                            </button>
                          )}
                        </span>
                      )}
                    </dd>

                    <dt>Bildiren</dt>
                    <dd>
                      <span className="row" style={{ gap: 6 }}>
                        <Avatar initials={getInitials(ticket.createdByName || ticket.createdByUsername || '?')} size="sm" />
                        <span style={{ fontSize: 13 }}>{ticket.createdByName || ticket.createdByUsername || '-'}</span>
                      </span>
                    </dd>

                    <dt>Sistem</dt>
                    <dd style={{ fontSize: 13 }}>{productName}</dd>

                    {categoryName && categoryName !== '-' && (
                      <>
                        <dt>Kategori</dt>
                        <dd style={{ fontSize: 13 }}>{categoryName}</dd>
                      </>
                    )}

                    {issueTypeName && issueTypeName !== '-' && (
                      <>
                        <dt>Sorun Tipi</dt>
                        <dd style={{ fontSize: 13 }}>{issueTypeName}</dd>
                      </>
                    )}

                    {ticket.createdAt && (
                      <>
                        <dt>Açıldı</dt>
                        <dd style={{ fontSize: 13 }}>{fmtDate(ticket.createdAt, 'datetime')}</dd>
                      </>
                    )}

                    {ticket.updatedAt && (
                      <>
                        <dt>Güncellendi</dt>
                        <dd style={{ fontSize: 13 }}>{fmtDate(ticket.updatedAt, 'rel')}</dd>
                      </>
                    )}

                    {ticket.resolutionNote && (
                      <>
                        <dt>Çözüm Notu</dt>
                        <dd style={{ fontSize: 13, whiteSpace: 'pre-wrap' }}>{ticket.resolutionNote}</dd>
                      </>
                    )}
                  </dl>
                </div>

                {/* SLA */}
                <div className="card card-pad">
                  <div className="row" style={{ marginBottom: 12 }}>
                    <span className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase' }}>SLA</span>
                    <span className="spacer" />
                    <span className="mono muted" style={{ fontSize: 11 }}>{ticket.slaTargetAt ? `${Math.round(Math.abs(new Date(ticket.slaTargetAt) - new Date(ticket.createdAt || ticket.slaTargetAt)) / 3600000)}sa hedef` : ''}</span>
                  </div>
                  <SlaBar ticket={ticket} />
                  <div className="muted" style={{ marginTop: 10, fontSize: 12 }}>
                    {ticket.slaBreached
                      ? 'SLA hedefi aşıldı. Eskalasyon önerilir.'
                      : ticket.slaAtRisk
                        ? 'SLA hedefi riski var.'
                        : 'SLA hedefi içinde.'}
                  </div>
                </div>

                {/* Aktivite */}
                {activities.length > 0 && (
                  <div className="card card-pad">
                    <div className="muted" style={{ fontSize: 11, fontWeight: 600, letterSpacing: '.07em', textTransform: 'uppercase', marginBottom: 14 }}>
                      Aktivite
                    </div>
                    <div className="col" style={{ gap: 12 }}>
                      {activities.map((act) => (
                        <div key={act.id} className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--hairline-strong)', flexShrink: 0, marginTop: 5 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.4 }}>{act.text}</div>
                            <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{fmtDate(act.at, 'rel')}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Çözüm notu modal */}
      {resolveModal && (
        <div className="scrim" role="presentation" onClick={() => { if (!resolveWorking) { setResolveModal(null); setResolveNote(''); } }}>
          <div role="dialog" aria-modal="true" className="dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-head"><h3>Çözüm notu gerekli</h3></div>
            <div className="dialog-body">
              <p className="muted" style={{ marginTop: 0, fontSize: 13 }}>
                Çözüldü adımına geçerken açıklama zorunludur.
              </p>
              <textarea className="textarea" rows={4} placeholder="Çözüm notunu yazın…" value={resolveNote}
                onChange={(e) => setResolveNote(e.target.value)} disabled={resolveWorking} maxLength={2000} autoFocus />
            </div>
            <div className="dialog-foot">
              <button type="button" className="btn btn-ghost" disabled={resolveWorking}
                onClick={() => { setResolveModal(null); setResolveNote(''); }}>Vazgeç</button>
              <button type="button" className="btn btn-accent" disabled={resolveWorking} onClick={confirmResolve}>
                {resolveWorking ? 'Kaydediliyor…' : 'Onayla'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
