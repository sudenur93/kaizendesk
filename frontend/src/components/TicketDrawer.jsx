import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Ic from './Icons';
import { Avatar, PriorityBadge, SlaBar, StatusBadge, fmtDate, getInitials } from './Common';
import {
  addTicketComment,
  assignTicket,
  getAgents,
  getRole,
  getTicket,
  getTicketComments,
  updateTicketStatus,
} from '../services/api';

const STATUS_TRANSITIONS = {
  NEW:                  [{ value: 'IN_PROGRESS',          label: 'İşleme Al',     accent: true }],
  IN_PROGRESS:          [{ value: 'WAITING_FOR_CUSTOMER', label: 'Müşteri Bekle', accent: false },
                         { value: 'RESOLVED',             label: 'Çözüldü',       accent: true }],
  WAITING_FOR_CUSTOMER: [{ value: 'IN_PROGRESS',          label: 'Geri Al',       accent: false },
                         { value: 'RESOLVED',             label: 'Çözüldü',       accent: true }],
  RESOLVED:             [{ value: 'CLOSED',               label: 'Kapat',         accent: false }],
  CLOSED:               [],
};

const STATUS_LABEL = {
  NEW: 'Yeni', IN_PROGRESS: 'İşlemde',
  WAITING_FOR_CUSTOMER: 'Müşteri Bekleniyor',
  RESOLVED: 'Çözüldü', CLOSED: 'Kapalı',
};

export default function TicketDrawer({ ticketId, onClose, onTicketUpdated }) {
  const navigate = useNavigate();
  const isManager = getRole() === 'MANAGER';
  const isAgent   = getRole() === 'AGENT';

  const [ticket,   setTicket]   = useState(null);
  const [comments, setComments] = useState([]);
  const [agents,   setAgents]   = useState([]);
  const [loading,  setLoading]  = useState(true);

  const [commentText,    setCommentText]    = useState('');
  const [isInternal,     setIsInternal]     = useState(false);
  const [submitting,     setSubmitting]     = useState(false);
  const [resolveModal,   setResolveModal]   = useState(null);
  const [resolveNote,    setResolveNote]    = useState('');
  const [resolveWorking, setResolveWorking] = useState(false);

  const commentsEndRef = useRef(null);

  useEffect(() => {
    if (!ticketId) return;
    setLoading(true);
    setTicket(null);
    setComments([]);
    setCommentText('');
    Promise.all([
      getTicket(ticketId),
      getTicketComments(ticketId),
      (isManager || isAgent) ? getAgents() : Promise.resolve([]),
    ]).then(([t, c, a]) => {
      setTicket(t);
      setComments(c);
      setAgents(a);
    }).finally(() => setLoading(false));
  }, [ticketId]);

  useEffect(() => {
    commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  /* Durum değiştir */
  async function handleStatusChange(newStatus) {
    if (newStatus === 'RESOLVED') { setResolveModal(newStatus); return; }
    try {
      const updated = await updateTicketStatus(ticketId, newStatus, '');
      setTicket(updated);
      onTicketUpdated?.(updated);
    } catch { /* ignored */ }
  }

  async function handleResolve() {
    if (!resolveNote.trim()) return;
    setResolveWorking(true);
    try {
      const updated = await updateTicketStatus(ticketId, 'RESOLVED', resolveNote);
      setTicket(updated);
      onTicketUpdated?.(updated);
      setResolveModal(null);
      setResolveNote('');
    } catch { /* ignored */ }
    finally { setResolveWorking(false); }
  }

  /* Yorum gönder */
  async function handleComment(e) {
    e.preventDefault();
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      const c = await addTicketComment(ticketId, commentText, isInternal);
      setComments((prev) => [...prev, c]);
      setCommentText('');
    } catch { /* ignored */ }
    finally { setSubmitting(false); }
  }

  /* Ajan ata */
  async function handleAssign(agentId) {
    try {
      const updated = await assignTicket(ticketId, Number(agentId));
      setTicket(updated);
      onTicketUpdated?.(updated);
    } catch { /* ignored */ }
  }

  const transitions = ticket ? (STATUS_TRANSITIONS[ticket.status] || []) : [];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,.25)',
          zIndex: 300, animation: 'fadeIn .15s ease',
        }}
      />

      {/* Drawer panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0,
        width: 'min(560px, 100vw)',
        background: 'var(--bg)',
        borderLeft: '1px solid var(--hairline)',
        boxShadow: '-4px 0 24px rgba(0,0,0,.12)',
        zIndex: 301,
        display: 'flex', flexDirection: 'column',
        animation: 'slideInRight .2s ease',
        overflow: 'hidden',
      }}>

        {/* ── Header ── */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--hairline)', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button type="button" className="btn btn-ghost btn-sm icon-btn" onClick={onClose} title="Kapat">
            <Ic.X size={16} />
          </button>
          {ticket && (
            <span className="mono" style={{ fontSize: 12, color: 'var(--text-3)' }}>{ticket.ticketNo}</span>
          )}
          <div className="spacer" />
          {ticket && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => navigate(`/agent/tickets/${ticketId}`)}
              title="Tam sayfa aç"
              style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}
            >
              <Ic.ExternalLink size={13} />
              Tam sayfa
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Yükleniyor…
          </div>
        ) : !ticket ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-3)', fontSize: 13 }}>
            Ticket bulunamadı.
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>

            {/* ── Ticket başlık + meta ── */}
            <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid var(--hairline)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ flex: 1 }}>
                  <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0, lineHeight: 1.4 }}>{ticket.title}</h2>
                </div>
              </div>

              {/* Badges row */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <StatusBadge status={ticket.status} />
                <PriorityBadge priority={ticket.priority} />
                <div style={{ flex: 1, minWidth: 120 }}>
                  <SlaBar ticket={ticket} />
                </div>
              </div>

              {/* Meta grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px', fontSize: 12, color: 'var(--text-2)' }}>
                <div><span style={{ color: 'var(--text-3)' }}>Oluşturan:</span> {ticket.createdByUsername || '—'}</div>
                <div><span style={{ color: 'var(--text-3)' }}>Tarih:</span> {fmtDate(ticket.createdAt)}</div>
                <div>
                  <span style={{ color: 'var(--text-3)' }}>Atanan:</span>{' '}
                  {ticket.assignedAgentName || <span style={{ color: 'var(--text-3)' }}>Atanmamış</span>}
                </div>
                {ticket.productName && <div><span style={{ color: 'var(--text-3)' }}>Ürün:</span> {ticket.productName}</div>}
              </div>

              {/* Ajan ata (manager) */}
              {isManager && agents.length > 0 && ticket.status !== 'CLOSED' && (
                <div style={{ marginTop: 10 }}>
                  <select
                    className="input"
                    style={{ fontSize: 12, padding: '4px 8px', height: 30 }}
                    value={ticket.assignedAgentId || ''}
                    onChange={(e) => e.target.value && handleAssign(e.target.value)}
                  >
                    <option value="">— Ajan ata —</option>
                    {agents.map((a) => (
                      <option key={a.id} value={a.id}>{a.name || a.username}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Durum butonları */}
              {transitions.length > 0 && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                  {transitions.map((tr) => (
                    <button
                      key={tr.value}
                      type="button"
                      className={tr.accent ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                      onClick={() => handleStatusChange(tr.value)}
                    >
                      {tr.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── Açıklama ── */}
            {ticket.description && (
              <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--hairline)' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>Açıklama</div>
                <p style={{ fontSize: 13, color: 'var(--text-2)', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{ticket.description}</p>
              </div>
            )}

            {/* ── Yorumlar ── */}
            <div style={{ flex: 1, padding: '14px 20px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 10 }}>
                Yorumlar {comments.length > 0 && `(${comments.length})`}
              </div>

              {comments.length === 0 ? (
                <div style={{ fontSize: 13, color: 'var(--text-3)', textAlign: 'center', padding: '20px 0' }}>Henüz yorum yok</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {comments.map((c) => (
                    <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                      <Avatar name={c.authorName || '?'} size={28} />
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{c.authorName || '?'}</span>
                          {c.internal && (
                            <span style={{ fontSize: 10, background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: 4, fontWeight: 600 }}>Dahili</span>
                          )}
                          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{fmtDate(c.createdAt)}</span>
                        </div>
                        <div style={{
                          fontSize: 13, color: 'var(--text)', lineHeight: 1.5,
                          background: c.internal ? 'rgba(255,152,0,.06)' : 'var(--bg-soft)',
                          borderRadius: 8, padding: '8px 12px',
                          borderLeft: c.internal ? '3px solid #ff9800' : 'none',
                        }}>
                          {c.message}
                        </div>
                      </div>
                    </div>
                  ))}
                  <div ref={commentsEndRef} />
                </div>
              )}
            </div>

            {/* ── Yorum yaz ── */}
            {ticket.status !== 'CLOSED' && (
              <div style={{ padding: '12px 20px 16px', borderTop: '1px solid var(--hairline)', flexShrink: 0 }}>
                {(isAgent || isManager) && (
                  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                    {[{ key: false, label: 'Yanıt' }, { key: true, label: 'Dahili Not' }].map((m) => (
                      <button
                        key={String(m.key)}
                        type="button"
                        className={`btn btn-sm ${isInternal === m.key ? 'btn-primary' : 'btn-ghost'}`}
                        style={{ fontSize: 11 }}
                        onClick={() => setIsInternal(m.key)}
                      >
                        {m.label}
                      </button>
                    ))}
                  </div>
                )}
                <form onSubmit={handleComment} style={{ display: 'flex', gap: 8 }}>
                  <textarea
                    className="input"
                    style={{ flex: 1, resize: 'none', fontSize: 13, minHeight: 60, borderRadius: 8 }}
                    placeholder={isInternal ? 'Dahili not…' : 'Yanıt yaz…'}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleComment(e); }}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    disabled={submitting || !commentText.trim()}
                    style={{ alignSelf: 'flex-end', padding: '0 12px', height: 34 }}
                  >
                    <Ic.Send size={14} />
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Çözüm notu modal */}
      {resolveModal && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,.4)' }}>
          <div className="card" style={{ width: 400, padding: 24 }}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>Çözüm Notu</h3>
            <textarea
              className="input"
              style={{ width: '100%', minHeight: 80, resize: 'none', fontSize: 13 }}
              placeholder="Sorunu nasıl çözdünüzü kısaca açıklayın…"
              value={resolveNote}
              onChange={(e) => setResolveNote(e.target.value)}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12 }}>
              <button type="button" className="btn btn-sm" onClick={() => { setResolveModal(null); setResolveNote(''); }}>İptal</button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                disabled={resolveWorking || !resolveNote.trim()}
                onClick={handleResolve}
              >
                {resolveWorking ? 'Kaydediliyor…' : 'Çözüldü olarak işaretle'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
