import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Ic from '../components/Icons';
import { Avatar, PriorityBadge, SlaBar, StatusBadge, fmtDate, getInitials } from '../components/Common';
import {
  addTicketComment,
  addWorklog,
  assignTicket,
  downloadTicketAttachment,
  getCategories,
  getCurrentUserProfile,
  getProducts,
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
  NEW: [{ value: 'IN_PROGRESS', label: 'İşleme Al' }],
  IN_PROGRESS: [
    { value: 'WAITING_FOR_CUSTOMER', label: 'Müşteri Bekleniyor' },
    { value: 'RESOLVED', label: 'Çözüldü' },
  ],
  WAITING_FOR_CUSTOMER: [
    { value: 'IN_PROGRESS', label: 'İşleme Geri Al' },
    { value: 'RESOLVED', label: 'Çözüldü' },
  ],
  RESOLVED: [],
  CLOSED: [],
};

function formatFileSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusLabel(value) {
  return (
    {
      NEW: 'Açık',
      IN_PROGRESS: 'İşlemde',
      WAITING_FOR_CUSTOMER: 'Müşteri Bekleniyor',
      RESOLVED: 'Çözüldü',
      CLOSED: 'Kapalı',
    }[value] || value
  );
}

function formatSla(ticket) {
  if (!ticket?.slaTargetAt) {
    return { text: 'SLA hedefi yok', tone: 'muted', subtitle: '' };
  }
  const target = new Date(ticket.slaTargetAt).getTime();
  const now = Date.now();
  const diff = target - now;
  const totalMinutes = Math.abs(Math.round(diff / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formatted = hours > 0 ? `${hours} saat ${minutes} dakika` : `${minutes} dakika`;

  if (diff <= 0) {
    return { text: formatted, tone: 'breach', subtitle: 'gecikme süresi' };
  }
  if (diff < 2 * 60 * 60 * 1000) {
    return { text: formatted, tone: 'risk', subtitle: 'kalan süre' };
  }
  return { text: formatted, tone: 'safe', subtitle: 'kalan süre' };
}

export default function AgentTicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: shellUser, pushToast } = useOutletContext() || {};
  const [user, setUser] = useState(shellUser || null);
  const [ticket, setTicket] = useState(null);
  const [productName, setProductName] = useState('-');
  const [categoryName, setCategoryName] = useState('-');
  const [attachments, setAttachments] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [noteMode, setNoteMode] = useState(NOTE_EXTERNAL);
  const [nextStatus, setNextStatus] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [worklogs, setWorklogs] = useState([]);
  const [wlMinutes, setWlMinutes] = useState('');
  const [wlDate, setWlDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [wlNote, setWlNote] = useState('');
  const [wlWorking, setWlWorking] = useState(false);
  const [wlError, setWlError] = useState('');
  const [uploadWorking, setUploadWorking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

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
      setNextStatus('');
      setResolutionNote('');

      const product = productData.find((item) => item.id === ticketData.productId);
      setProductName(product?.name || '-');

      if (ticketData.productId) {
        const categoryData = await getCategories(ticketData.productId);
        const category = categoryData.find((item) => item.id === ticketData.categoryId);
        setCategoryName(category?.name || '-');
      }
    } catch {
      setError('Talep detayı yüklenemedi. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [id]);

  const isAssignedToMe = ticket?.assignedAgentId === user?.id;
  const isUnassigned = ticket && !ticket.assignedAgentId;
  const availableTransitions = ticket ? STATUS_TRANSITIONS[ticket.status] || [] : [];
  const sla = useMemo(() => formatSla(ticket), [ticket]);

  async function handleClaimTicket() {
    if (!user?.id || !ticket?.id) return;
    setWorking(true);
    setError('');
    try {
      const updated = await assignTicket(ticket.id, user.id);
      setTicket(updated);
      if (pushToast) pushToast(`#${ticket.id} üzerinize alındı`);
    } catch {
      setError('Talep üzerinize alınamadı. Lütfen tekrar deneyin.');
    } finally {
      setWorking(false);
    }
  }

  async function handleStatusUpdate(e) {
    e.preventDefault();
    if (!nextStatus) return;
    setWorking(true);
    setError('');
    try {
      const updated = await updateTicketStatus(ticket.id, nextStatus, resolutionNote);
      setTicket(updated);
      setNextStatus('');
      setResolutionNote('');
      if (pushToast) pushToast(`Durum güncellendi: ${statusLabel(updated.status)}`);
    } catch (err) {
      setError(err.response?.data?.message || 'Durum güncellenemedi. Geçiş kuralını kontrol edin.');
    } finally {
      setWorking(false);
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

  async function handleCommentSubmit(e) {
    e.preventDefault();
    const message = commentText.trim();
    if (!message) return;
    setWorking(true);
    setError('');
    try {
      const createdComment = await addTicketComment(ticket.id, message, noteMode === NOTE_INTERNAL);
      setComments((prev) => [...prev, createdComment]);
      setCommentText('');
      if (pushToast) pushToast(noteMode === NOTE_INTERNAL ? 'İç not eklendi' : 'Yanıt gönderildi');
    } catch {
      setError('Yanıt gönderilemedi. Lütfen tekrar deneyin.');
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
      const created = await addWorklog(ticket.id, {
        timeSpent: minutes,
        workDate: wlDate || null,
        note: wlNote.trim() || null,
      });
      setWorklogs((prev) => [...prev, created]);
      setWlMinutes('');
      setWlNote('');
      if (pushToast) pushToast('İş kaydı eklendi');
    } catch {
      setWlError('İş kaydı eklenemedi. Lütfen tekrar deneyin.');
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

  const totalWorklogMinutes = useMemo(
    () => worklogs.reduce((sum, wl) => sum + (wl.timeSpent || 0), 0),
    [worklogs]
  );

  function fmtWorklogTime(min) {
    if (!min) return '0 dk';
    const h = Math.floor(min / 60);
    const m = min % 60;
    if (h === 0) return `${m} dk`;
    if (m === 0) return `${h} saat`;
    return `${h} saat ${m} dk`;
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="row" style={{ marginBottom: 14 }}>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => navigate('/agent/tickets')}>
            ← Listeye dön
          </button>
        </div>

        {error && (
          <div className="badge p-high" style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}>
            <Ic.AlertTriangle size={13} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="card card-pad muted" style={{ textAlign: 'center', padding: 60 }}>
            Talep detayı yükleniyor…
          </div>
        ) : !ticket ? (
          <div className="card card-pad muted" style={{ textAlign: 'center', padding: 60 }}>
            Talep bulunamadı.
          </div>
        ) : (
          <>
            <div className="page-head" style={{ alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="row" style={{ gap: 10, marginBottom: 8 }}>
                  <span className="tag">#{ticket.id}</span>
                  <StatusBadge status={ticket.status} />
                  <PriorityBadge priority={ticket.priority} />
                  {isAssignedToMe && <span className="badge s-progress">Bende</span>}
                </div>
                <h1 className="page-title" style={{ marginBottom: 8 }}>
                  {ticket.title}
                </h1>
                <div className="row" style={{ gap: 14, color: 'var(--text-3)', fontSize: 13, flexWrap: 'wrap' }}>
                  <span>
                    <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>{ticket.createdByUsername || 'Müşteri'}</b>{' '}
                    tarafından açıldı
                  </span>
                  <span>·</span>
                  <span>{fmtDate(ticket.createdAt, 'datetime')}</span>
                  <span>·</span>
                  <span>{productName}</span>
                </div>
              </div>
            </div>

            <div className="detail-grid">
              <div className="col" style={{ gap: 18, minWidth: 0 }}>
                <div className="card card-pad">
                  <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 10 }}>
                    Açıklama
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.description}</div>

                  <div className="row" style={{ margin: '18px 0 10px', alignItems: 'center' }}>
                    <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      Ekler ({attachments.length})
                    </div>
                    <span className="spacer" />
                    <label
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '5px 10px', fontSize: 12, fontWeight: 500,
                        border: '1px solid var(--hairline-strong)', borderRadius: 6,
                        cursor: uploadWorking ? 'wait' : 'pointer',
                        background: 'var(--surface)', color: uploadWorking ? 'var(--text-3)' : 'var(--text-2)',
                      }}
                    >
                      <Ic.Upload size={12} />
                      {uploadWorking ? 'Yükleniyor…' : 'Dosya Ekle'}
                      <input type="file" style={{ display: 'none' }} onChange={handleFileUpload} disabled={uploadWorking} />
                    </label>
                  </div>
                  {attachments.length > 0 ? (
                    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                      {attachments.map((attachment) => (
                        <button
                          key={attachment.id}
                          type="button"
                          onClick={() => handleDownload(attachment)}
                          className="row"
                          style={{ padding: '8px 12px', border: '1px solid var(--hairline)', borderRadius: 8, background: 'var(--surface-2)', cursor: 'pointer' }}
                        >
                          <Ic.File size={14} />
                          <span style={{ fontSize: 13 }}>{attachment.originalFileName}</span>
                          <span className="muted mono" style={{ fontSize: 11 }}>
                            {formatFileSize(attachment.fileSizeBytes)}
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <p className="muted" style={{ fontSize: 13, margin: 0 }}>Henüz ek dosya yok.</p>
                  )}
                </div>

                <div className="card">
                  <div className="card-head">
                    <div>
                      <h3>Konuşma</h3>
                      <div className="sub">Müşteri ile yazışmalar</div>
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {comments.length} mesaj
                    </div>
                  </div>
                  <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                    {comments.length === 0 && <div className="muted">Henüz yanıt yok.</div>}
                    {comments.map((comment) => (
                      <div key={comment.id} className={`msg${comment.internal ? ' internal' : ''}`}>
                        <Avatar initials={getInitials(comment.authorName || 'KaizenDesk')} />
                        <div className="body">
                          <div className="row">
                            <span className="who">{comment.authorName || 'KaizenDesk'}</span>
                            {comment.internal && (
                              <span className="badge" style={{ fontSize: 10, padding: '1px 6px', background: 'color-mix(in oklab, var(--warn) 12%, var(--bg-soft))', color: 'var(--warn)', borderRadius: 4, marginLeft: 4 }}>
                                İç Not
                              </span>
                            )}
                            <span className="spacer" />
                            <span className="time">{fmtDate(comment.createdAt, 'datetime')}</span>
                          </div>
                          <div className="text" style={{ whiteSpace: 'pre-wrap' }}>
                            {comment.message}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div style={{ padding: '0 20px 20px' }}>
                    <form className="composer" onSubmit={handleCommentSubmit}>
                      <div className="composer-tabs">
                        <button
                          type="button"
                          className={noteMode === NOTE_EXTERNAL ? 'active' : ''}
                          onClick={() => setNoteMode(NOTE_EXTERNAL)}
                        >
                          Yanıt Yaz
                        </button>
                        <button
                          type="button"
                          className={noteMode === NOTE_INTERNAL ? 'active' : ''}
                          onClick={() => setNoteMode(NOTE_INTERNAL)}
                        >
                          İç Not
                        </button>
                      </div>
                      <textarea
                        placeholder={noteMode === NOTE_INTERNAL ? 'Takım içi not (müşteriye görünmez)…' : 'Müşteriye yanıtınızı yazın…'}
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        maxLength={1000}
                        disabled={working}
                        style={noteMode === NOTE_INTERNAL ? { background: 'color-mix(in oklab, var(--warn) 6%, var(--surface))' } : {}}
                      />
                      <div className="composer-foot">
                        <span className="muted mono" style={{ fontSize: 11, paddingLeft: 4 }}>
                          {commentText.length} / 1000
                        </span>
                        <button type="submit" className={`btn btn-sm ${noteMode === NOTE_INTERNAL ? 'btn-warn' : ''} ${commentText.trim() && noteMode === NOTE_EXTERNAL ? 'btn-accent' : ''}`} disabled={working || !commentText.trim()}>
                          <Ic.Send size={13} />
                          {working ? 'Gönderiliyor…' : noteMode === NOTE_INTERNAL ? 'Not Ekle' : 'Gönder'}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="card">
                  <div className="card-head">
                    <div>
                      <h3>İş Kaydı</h3>
                      <div className="sub">
                        Toplam: {fmtWorklogTime(totalWorklogMinutes)}
                        {worklogs.length > 0 && ` · ${worklogs.length} kayıt`}
                      </div>
                    </div>
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
                            {wl.note && (
                              <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 3 }}>{wl.note}</div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '14px 20px' }}>
                    {wlError && (
                      <div className="badge p-high" style={{ display: 'flex', marginBottom: 10, padding: '7px 10px', gap: 6 }}>
                        <Ic.AlertTriangle size={12} />
                        {wlError}
                      </div>
                    )}
                    <form className="col" style={{ gap: 8 }} onSubmit={handleWorklogSubmit}>
                      <div className="row" style={{ gap: 8 }}>
                        <div className="field" style={{ flex: 1 }}>
                          <label className="field-label">Süre (dakika)</label>
                          <input
                            type="number"
                            className="input"
                            min="1"
                            placeholder="ör. 30"
                            value={wlMinutes}
                            onChange={(e) => setWlMinutes(e.target.value)}
                            disabled={wlWorking}
                            required
                          />
                        </div>
                        <div className="field" style={{ flex: 1 }}>
                          <label className="field-label">Tarih</label>
                          <input
                            type="date"
                            className="input"
                            value={wlDate}
                            onChange={(e) => setWlDate(e.target.value)}
                            disabled={wlWorking}
                          />
                        </div>
                      </div>
                      <input
                        type="text"
                        className="input"
                        placeholder="Not (opsiyonel)"
                        value={wlNote}
                        onChange={(e) => setWlNote(e.target.value)}
                        maxLength={200}
                        disabled={wlWorking}
                      />
                      <button
                        type="submit"
                        className="btn"
                        disabled={wlWorking || !wlMinutes}
                        style={{ alignSelf: 'flex-end' }}
                      >
                        <Ic.Clock size={13} />
                        {wlWorking ? 'Kaydediliyor…' : 'Süre Ekle'}
                      </button>
                    </form>
                  </div>
                </div>
              </div>

              <div className="col" style={{ gap: 18 }}>
                <div className="card card-pad">
                  <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                    Durum İşlemleri
                  </div>
                  {!isAssignedToMe ? (
                    <p className="muted-helper">Durum değiştirmek için talep size atanmış olmalı.</p>
                  ) : availableTransitions.length === 0 ? (
                    <p className="muted-helper">Bu durum için geçiş yok.</p>
                  ) : (
                    <form className="col" style={{ gap: 10 }} onSubmit={handleStatusUpdate}>
                      <select className="select" value={nextStatus} onChange={(e) => setNextStatus(e.target.value)} disabled={working} required>
                        <option value="">Durum seçin</option>
                        {availableTransitions.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      {nextStatus === 'RESOLVED' && (
                        <textarea
                          className="textarea"
                          placeholder="Çözüm notu"
                          value={resolutionNote}
                          onChange={(e) => setResolutionNote(e.target.value)}
                          rows={3}
                          disabled={working}
                          required
                        />
                      )}
                      <button type="submit" className="btn btn-accent" disabled={working || !nextStatus}>
                        {working ? 'Güncelleniyor…' : 'Durumu Güncelle'}
                      </button>
                    </form>
                  )}
                </div>

                <div className="card card-pad">
                  <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                    Atama
                  </div>
                  {isUnassigned ? (
                    <button type="button" className="btn btn-accent" onClick={handleClaimTicket} disabled={working}>
                      <Ic.Check size={13} />
                      {working ? 'Alınıyor…' : 'Üzerime Al'}
                    </button>
                  ) : isAssignedToMe ? (
                    <p className="muted-helper">Bu talep zaten size atanmış.</p>
                  ) : (
                    <p className="muted-helper">Bu talep başka bir uzmanda.</p>
                  )}
                </div>

                <div className="card card-pad">
                  <div className="row">
                    <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase' }}>
                      SLA
                    </div>
                    <span className="spacer" />
                    <span className="mono muted" style={{ fontSize: 11 }}>
                      {fmtDate(ticket.slaTargetAt, 'datetime')}
                    </span>
                  </div>
                  <div style={{ margin: '12px 0' }}>
                    <SlaBar ticket={ticket} />
                  </div>
                  <div className="muted" style={{ fontSize: 12 }}>{sla.text}</div>
                </div>

                <div className="card card-pad">
                  <div className="muted" style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 14 }}>
                    Ticket Bilgileri
                  </div>
                  <dl className="kv">
                    <dt>Müşteri</dt>
                    <dd>{ticket.createdByUsername || '-'}</dd>
                    <dt>Atanan Uzman</dt>
                    <dd>{ticket.assignedAgentName || <span className="muted">Atanmamış</span>}</dd>
                    <dt>Ürün</dt>
                    <dd>{productName}</dd>
                    <dt>Kategori</dt>
                    <dd>{categoryName}</dd>
                    {ticket.resolutionNote && (
                      <>
                        <dt>Çözüm Notu</dt>
                        <dd style={{ whiteSpace: 'pre-wrap' }}>{ticket.resolutionNote}</dd>
                      </>
                    )}
                    <dt>Çözüm Tarihi</dt>
                    <dd>{fmtDate(ticket.resolvedAt, 'datetime')}</dd>
                    <dt>Kapanış</dt>
                    <dd>{fmtDate(ticket.closedAt, 'datetime')}</dd>
                  </dl>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
