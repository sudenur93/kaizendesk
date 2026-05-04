import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import Ic from '../components/Icons';
import {
  Avatar,
  PriorityBadge,
  SlaBar,
  StatusBadge,
  fmtDate,
  getInitials,
  slaInfo,
} from '../components/Common';
import {
  addTicketComment,
  downloadTicketAttachment,
  getCategories,
  getProducts,
  getTicket,
  getTicketAttachments,
  getTicketComments,
} from '../services/api';

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
    if (!msg || sending) return;
    setSending(true);
    try {
      const created = await addTicketComment(ticket.id, msg);
      setComments((prev) => [...prev, created]);
      setDraft('');
      if (pushToast) pushToast('Yorum gönderildi');
    } catch {
      setError('Yanıt gönderilemedi. Lütfen tekrar deneyin.');
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="page">
        <div className="page-narrow">
          <div className="card card-pad muted" style={{ textAlign: 'center', padding: 60 }}>
            Talep detayı yükleniyor…
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
        <div className="row" style={{ marginBottom: 14 }}>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => navigate('/customer/tickets')}
          >
            ← Listeye dön
          </button>
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
                {comments.map((c) => (
                  <div key={c.id} className="msg">
                    <Avatar initials={getInitials(c.authorName || 'KaizenDesk')} />
                    <div className="body">
                      <div className="row">
                        <span className="who">{c.authorName || 'KaizenDesk'}</span>
                        <span className="spacer" />
                        <span className="time">{fmtDate(c.createdAt, 'datetime')}</span>
                      </div>
                      <div className="text" style={{ whiteSpace: 'pre-wrap' }}>
                        {c.message}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ padding: '0 20px 20px' }}>
                <form className="composer" onSubmit={handleSend}>
                  <div className="composer-tabs">
                    <button type="button" className="active">
                      Yanıt Yaz
                    </button>
                  </div>
                  <textarea
                    placeholder="Cevabınızı yazın…"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    disabled={sending}
                    maxLength={1000}
                  />
                  <div className="composer-foot">
                    <span
                      className="muted mono"
                      style={{ fontSize: 11, paddingLeft: 4 }}
                    >
                      {draft.length} / 1000
                    </span>
                    <button
                      type="submit"
                      className={'btn btn-sm ' + (draft.trim() ? 'btn-accent' : '')}
                      disabled={!draft.trim() || sending}
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
