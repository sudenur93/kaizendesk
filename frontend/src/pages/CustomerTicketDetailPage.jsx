import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Ic from '../components/Icons';
import { printTicketPDF } from '../printPDF';
import {
  Avatar,
  PriorityBadge,
  SlaBar,
  Skeleton,
  SkeletonCard,
  StatusBadge,
  fmtDate,
  getInitials,
  slaInfo,
} from '../components/Common';
import {
  addTicketComment,
  customerTicketAction,
  deleteTicket,
  downloadTicketAttachment,
  getCategories,
  getProducts,
  getTicket,
  getTicketAttachments,
  getTicketComments,
  uploadTicketAttachment,
} from '../services/api';

function InlineImage({ ticketId, att, fname }) {
  const [src, setSrc] = useState(null);
  useEffect(() => {
    let alive = true;
    downloadTicketAttachment(ticketId, att.id)
      .then((blob) => { if (alive) setSrc(URL.createObjectURL(blob)); })
      .catch(() => {});
    return () => { alive = false; };
  }, [ticketId, att.id]);
  if (!src) return <span style={{ fontSize: 12, color: 'var(--text-3)' }}>⏳ {fname}</span>;
  return (
    <img src={src} alt={fname}
      style={{ maxWidth: 260, maxHeight: 180, borderRadius: 8, border: '1px solid var(--hairline)', display: 'block' }} />
  );
}

function fmtSize(bytes) {
  if (!bytes && bytes !== 0) return '-';
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  if (bytes >= 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${bytes} B`;
}

function slaHelperText(state) {
  if (state === 'bad') return 'SLA hedefi aşıldı. Eskalasyon önerilir.';
  if (state === 'warn') return 'SLA hedefine yaklaşıyor — öncelik verilmeli.';
  return 'SLA penceresi içinde.';
}

export default function CustomerTicketDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, pushToast } = useOutletContext() || {};

  const [ticket, setTicket] = useState(null);
  const [productName, setProductName] = useState('-');
  const [categoryName, setCategoryName] = useState('-');
  const [attachments, setAttachments] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [actionWorking, setActionWorking] = useState(false);
  const [commentImage, setCommentImage] = useState(null); // {file, previewUrl}

  async function handleCustomerAction(action) {
    setActionWorking(true);
    try {
      const updated = await customerTicketAction(ticket.id, action);
      setTicket(updated);
      if (pushToast) pushToast(action === 'confirm' ? 'Çözüm onaylandı, talep kapatıldı.' : 'Talep yeniden açıldı.');
    } catch {
      if (pushToast) pushToast('İşlem gerçekleştirilemedi.');
    } finally {
      setActionWorking(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteTicket(ticket.id);
      if (pushToast) pushToast('Talep silindi.');
      navigate('/customer/tickets');
    } catch {
      if (pushToast) pushToast('Talep silinemedi.');
      setDeleteConfirm(false);
    } finally {
      setDeleting(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [t, prods, atts, coms] = await Promise.all([
          getTicket(id),
          getProducts(),
          getTicketAttachments(id),
          getTicketComments(id),
        ]);
        if (cancelled) return;
        setTicket(t);
        setAttachments(atts);
        setComments(coms);
        // okundu işaretle
        localStorage.setItem(`kz_seen_${id}`, new Date().toISOString());
        const prod = prods.find((p) => p.id === t.productId);
        setProductName(prod?.name || '-');
        if (t.productId) {
          const cats = await getCategories(t.productId);
          if (cancelled) return;
          const cat = cats.find((c) => c.id === t.categoryId);
          setCategoryName(cat?.name || '-');
        }
      } catch {
        if (!cancelled) setError('Talep detayı yüklenemedi. Lütfen tekrar deneyin.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const sla = useMemo(() => (ticket ? slaInfo(ticket) : { state: 'ok' }), [ticket]);

  async function handleDownload(att) {
    try {
      const blob = await downloadTicketAttachment(ticket.id, att.id);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = att.originalFileName;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      if (pushToast) pushToast('Dosya indirilemedi');
    }
  }

  async function handleSend(e) {
    e.preventDefault();
    const msg = draft.trim();
    if (!msg && !commentImage) return;
    if (sending) return;
    setSending(true);
    try {
      let finalMsg = msg;
      if (commentImage) {
        const att = await uploadTicketAttachment(ticket.id, commentImage.file);
        setAttachments((prev) => [...prev, att]);
        const marker = `📎 [${commentImage.file.name}]`;
        finalMsg = msg ? `${msg}\n${marker}` : marker;
        URL.revokeObjectURL(commentImage.previewUrl);
        setCommentImage(null);
      }
      const created = await addTicketComment(ticket.id, finalMsg);
      setComments((prev) => [...prev, created]);
      setDraft('');
      if (pushToast) pushToast('Yorum gönderildi');
    } catch {
      setError('Yanıt gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSending(false);
    }
  }

  function handleImagePick(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (commentImage) URL.revokeObjectURL(commentImage.previewUrl);
    setCommentImage({ file, previewUrl: URL.createObjectURL(file) });
    e.target.value = '';
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div style={{ marginBottom: 14 }}>
            <Skeleton width={100} height={28} radius={6} />
          </div>
          <div style={{ marginBottom: 20 }}>
            <div className="row" style={{ gap: 8, marginBottom: 10 }}>
              <Skeleton width={40} height={20} radius={6} />
              <Skeleton width={60} height={20} radius={10} />
              <Skeleton width={60} height={20} radius={10} />
            </div>
            <Skeleton width="60%" height={26} radius={6} style={{ marginBottom: 8 }} />
            <Skeleton width="40%" height={14} radius={4} />
          </div>
          <div className="detail-grid">
            <div className="col" style={{ gap: 18 }}>
              <div className="card card-pad"><SkeletonCard rows={4} /></div>
              <div className="card card-pad"><SkeletonCard rows={5} /></div>
            </div>
            <div className="col" style={{ gap: 18 }}>
              <div className="card card-pad"><SkeletonCard rows={5} /></div>
              <div className="card card-pad"><SkeletonCard rows={2} /></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="card card-pad muted" style={{ textAlign: 'center', padding: 60 }}>
            {error || 'Talep bulunamadı.'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-narrow">
        <div className="row" style={{ marginBottom: 14, justifyContent: 'space-between' }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/customer/tickets')}
          >
            ← Listeye dön
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => printTicketPDF({ ticket, comments, attachments, productName, categoryName })}
              title="PDF olarak indir"
            >
              ↓ PDF
            </button>
          {ticket?.status === 'NEW' && (
            deleteConfirm ? (
              <div className="row" style={{ gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--text-2)' }}>Emin misin?</span>
                <button type="button" className="btn btn-sm btn-ghost" onClick={() => setDeleteConfirm(false)}>Vazgeç</button>
                <button type="button" className="btn btn-sm" style={{ background: 'var(--err)', color: '#fff', border: 'none' }}
                  disabled={deleting} onClick={handleDelete}>
                  {deleting ? 'Siliniyor…' : 'Evet, Sil'}
                </button>
              </div>
            ) : (
              <button type="button" className="btn btn-sm btn-ghost"
                style={{ color: 'var(--err)' }} onClick={() => setDeleteConfirm(true)}>
                Talebi Sil
              </button>
            )
          )}
          </div>
        </div>

        {error && (
          <div
            className="badge p-high"
            style={{ display: 'flex', padding: '10px 14px', marginBottom: 14, gap: 8 }}
          >
            <Ic.AlertTriangle size={13} />
            {error}
          </div>
        )}

        {/* WAITING_FOR_CUSTOMER banner */}
        {ticket?.status === 'WAITING_FOR_CUSTOMER' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12,
            background: 'color-mix(in oklab,#f59e0b 12%,var(--bg))',
            border: '1px solid #f59e0b',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          }}>
            <Ic.AlertTriangle size={16} style={{ color: '#b45309', flexShrink: 0 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#92400e' }}>Yanıtınızı bekliyoruz</div>
              <div style={{ fontSize: 13, color: '#92400e', marginTop: 2 }}>
                Destek ekibi sizden ek bilgi bekliyor. Lütfen aşağıdaki alandan yanıt verin.
              </div>
            </div>
          </div>
        )}

        {/* RESOLVED — onayla / yeniden aç */}
        {ticket?.status === 'RESOLVED' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            background: 'color-mix(in oklab,#10b981 10%,var(--bg))',
            border: '1px solid #10b981',
            borderRadius: 10, padding: '12px 16px', marginBottom: 16,
          }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#065f46' }}>Talep çözüme kavuşturuldu</div>
              <div style={{ fontSize: 13, color: '#065f46', marginTop: 2 }}>
                Sorun gerçekten çözüldüyse onaylayın, aksi hâlde yeniden açın.
              </div>
            </div>
            <div className="row" style={{ gap: 8, flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-sm"
                style={{ background: '#10b981', color: '#fff', border: 'none' }}
                disabled={actionWorking}
                onClick={() => handleCustomerAction('confirm')}
              >
                ✓ Çözümü Onayla
              </button>
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                disabled={actionWorking}
                onClick={() => handleCustomerAction('reopen')}
              >
                ↩ Yeniden Aç
              </button>
            </div>
          </div>
        )}

        <div className="page-head" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 10, marginBottom: 8 }}>
              <span className="tag">#{ticket.id}</span>
              <StatusBadge status={ticket.status} />
              <PriorityBadge priority={ticket.priority} />
              {sla.state === 'bad' && (
                <span className="badge p-high">
                  <Ic.AlertTriangle size={11} /> SLA İhlali
                </span>
              )}
            </div>
            <h1 className="page-title" style={{ marginBottom: 8 }}>
              {ticket.title}
            </h1>
            <div
              className="row"
              style={{ gap: 14, color: 'var(--text-3)', fontSize: 13, flexWrap: 'wrap' }}
            >
              <span>
                <b style={{ color: 'var(--text-2)', fontWeight: 500 }}>
                  {ticket.createdByUsername || user?.name || 'Müşteri'}
                </b>{' '}
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
              <div
                className="muted"
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Açıklama
              </div>
              <div
                style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: 'var(--text)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {ticket.description}
              </div>

              {attachments.length > 0 && (
                <>
                  <div
                    className="muted"
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      letterSpacing: '.06em',
                      textTransform: 'uppercase',
                      margin: '18px 0 10px',
                    }}
                  >
                    Ekler ({attachments.length})
                  </div>
                  <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                    {attachments.map((a) => (
                      <button
                        type="button"
                        key={a.id}
                        onClick={() => handleDownload(a)}
                        className="row"
                        style={{
                          padding: '8px 12px',
                          border: '1px solid var(--hairline)',
                          borderRadius: 8,
                          background: 'var(--surface-2)',
                          cursor: 'pointer',
                        }}
                        title="İndir"
                      >
                        {String(a.contentType || '').startsWith('image/') ? (
                          <Ic.Image size={14} />
                        ) : (
                          <Ic.File size={14} />
                        )}
                        <span style={{ fontSize: 13 }}>{a.originalFileName}</span>
                        <span className="muted mono" style={{ fontSize: 11 }}>
                          {fmtSize(a.fileSizeBytes)}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="card">
              <div className="card-head">
                <div>
                  <h3>Konuşma</h3>
                  <div className="sub">Destek ekibi ile yazışmalarınız</div>
                </div>
                <div className="muted" style={{ fontSize: 12 }}>
                  {comments.length} mesaj
                </div>
              </div>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: 18 }}>
                {comments.length === 0 && (
                  <div className="muted" style={{ fontSize: 13 }}>
                    Henüz yanıt yok. Aşağıdaki alandan ilk mesajınızı gönderebilirsiniz.
                  </div>
                )}
                {comments.map((c) => {
                  // 📎 [filename] markerlarını bul, geri kalanı metin
                  const parts = c.message.split(/(📎 \[[^\]]+\])/g);
                  return (
                    <div key={c.id} className="msg">
                      <Avatar initials={getInitials(c.authorName || 'KaizenDesk')} />
                      <div className="body">
                        <div className="row">
                          <span className="who">{c.authorName || 'KaizenDesk'}</span>
                          <span className="spacer" />
                          <span className="time">{fmtDate(c.createdAt, 'datetime')}</span>
                        </div>
                        <div className="text" style={{ whiteSpace: 'pre-wrap' }}>
                          {parts.map((part, i) => {
                            const match = part.match(/^📎 \[(.+)\]$/);
                            if (match) {
                              const fname = match[1];
                              const att = attachments.find((a) => a.originalFileName === fname);
                              const isImg = att && String(att.contentType || '').startsWith('image/');
                              return (
                                <span key={i}>
                                  {isImg ? (
                                    <button
                                      type="button"
                                      onClick={() => att && handleDownload(att)}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'block', marginTop: 6 }}
                                      title="Görseli indir / büyüt"
                                    >
                                      <InlineImage ticketId={ticket.id} att={att} fname={fname} downloadFn={handleDownload} />
                                      <span style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2, display: 'block' }}>📎 {fname}</span>
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => att && handleDownload(att)}
                                      style={{ background: 'none', border: 'none', padding: 0, cursor: att ? 'pointer' : 'default', color: 'var(--accent)', fontSize: 13 }}
                                    >
                                      📎 {fname}
                                    </button>
                                  )}
                                </span>
                              );
                            }
                            return <span key={i}>{part}</span>;
                          })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div style={{ padding: '0 20px 20px' }}>
                <form className="composer" onSubmit={handleSend}>
                  <div className="composer-tabs">
                    <button type="button" className="active">Yanıt Yaz</button>
                  </div>
                  {commentImage && (
                    <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10 }}>
                      <img src={commentImage.previewUrl} alt="önizleme"
                        style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--hairline)' }} />
                      <span style={{ fontSize: 12, color: 'var(--text-2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {commentImage.file.name}
                      </span>
                      <button type="button" className="btn btn-ghost btn-sm"
                        onClick={() => { URL.revokeObjectURL(commentImage.previewUrl); setCommentImage(null); }}
                        disabled={sending}>✕</button>
                    </div>
                  )}
                  <textarea
                    placeholder="Cevabınızı yazın…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={sending}
                    maxLength={1000}
                  />
                  <div className="composer-foot">
                    <label style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }} title="Görsel ekle">
                      <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleImagePick} disabled={sending} />
                      <span className="btn btn-sm btn-ghost" style={{ padding: '4px 8px' }}>
                        <Ic.Image size={14} />
                      </span>
                    </label>
                    <span className="muted mono" style={{ fontSize: 11, paddingLeft: 4 }}>
                      {draft.length} / 1000
                    </span>
                    <button
                      type="submit"
                      className={'btn btn-sm ' + ((draft.trim() || commentImage) ? 'btn-accent' : '')}
                      disabled={(!draft.trim() && !commentImage) || sending}
                    >
                      <Ic.Send size={13} />
                      {sending ? 'Gönderiliyor…' : 'Gönder'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>

          <div className="col" style={{ gap: 18 }}>
            <div className="card card-pad">
              <div
                className="muted"
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  letterSpacing: '.06em',
                  textTransform: 'uppercase',
                  marginBottom: 14,
                }}
              >
                Detaylar
              </div>
              <dl className="kv">
                <dt>Durum</dt>
                <dd>
                  <StatusBadge status={ticket.status} />
                </dd>
                <dt>Öncelik</dt>
                <dd>
                  <PriorityBadge priority={ticket.priority} />
                </dd>
                <dt>Atanan</dt>
                <dd>
                  {ticket.assignedAgentName ? (
                    <span className="row" style={{ gap: 8 }}>
                      <Avatar initials={getInitials(ticket.assignedAgentName)} size="sm" />
                      {ticket.assignedAgentName}
                    </span>
                  ) : ticket.assignedAgentId ? (
                    <span>Uzman #{ticket.assignedAgentId}</span>
                  ) : (
                    <span className="muted">Atanmamış</span>
                  )}
                </dd>
                <dt>Bildiren</dt>
                <dd>
                  <span className="row" style={{ gap: 8 }}>
                    <Avatar
                      initials={getInitials(ticket.createdByUsername || user?.name)}
                      size="sm"
                    />
                    {ticket.createdByUsername || user?.name || '-'}
                  </span>
                </dd>
                <dt>Sistem</dt>
                <dd>{productName}</dd>
                <dt>Kategori</dt>
                <dd>{categoryName}</dd>
                <dt>Açıldı</dt>
                <dd>{fmtDate(ticket.createdAt, 'datetime')}</dd>
                <dt>Güncellendi</dt>
                <dd>{fmtDate(ticket.updatedAt || ticket.createdAt, 'rel')}</dd>
              </dl>
            </div>

            <div className="card card-pad">
              <div className="row">
                <div
                  className="muted"
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    letterSpacing: '.06em',
                    textTransform: 'uppercase',
                  }}
                >
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
              <div className="muted" style={{ fontSize: 12, lineHeight: 1.5 }}>
                {slaHelperText(sla.state)}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
