import { useRef, useState } from 'react';
import { aiChat } from '../services/api';

function buildTicketContext(tickets) {
  if (!tickets || tickets.length === 0) return '';
  const total = tickets.length;
  const open = tickets.filter(t => t.status === 'NEW' || t.status === 'IN_PROGRESS').length;
  const waiting = tickets.filter(t => t.status === 'WAITING_FOR_CUSTOMER').length;
  const resolved = tickets.filter(t => t.status === 'RESOLVED').length;
  const closed = tickets.filter(t => t.status === 'CLOSED').length;
  return `[Kullanıcının ticket bilgileri: Toplam ${total} ticket, ${open} açık, ${waiting} müşteri bekliyor, ${resolved} çözüldü, ${closed} kapatıldı]`;
}

export default function AiChatWidget({ tickets = [] }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Merhaba! KaizenDesk Asistan\'ım. Size nasıl yardımcı olabilirim?' },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);

  function buildContext(msgs) {
    return msgs
      .slice(-6)
      .map((m) => (m.role === 'user' ? `Kullanıcı: ${m.text}` : `Asistan: ${m.text}`))
      .join('\n');
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: 'user', text }];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const ticketCtx = buildTicketContext(tickets);
      const convCtx = buildContext(next.slice(0, -1));
      const context = ticketCtx ? ticketCtx + '\n' + convCtx : convCtx;
      const reply = await aiChat(text, context);
      setMessages((prev) => [...prev, { role: 'ai', text: reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'ai', text: 'Bir sorun oluştu. Lütfen tekrar deneyin.' }]);
    } finally {
      setLoading(false);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 200 }}>
      {open && (
        <div style={{
          width: 340, height: 460,
          background: 'var(--bg-card)',
          border: '1px solid var(--hairline)',
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,.18)',
          display: 'flex', flexDirection: 'column',
          marginBottom: 12,
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            borderBottom: '1px solid var(--hairline)',
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'var(--bg-soft)',
          }}>
            <span style={{ fontSize: 16 }}>✦</span>
            <span style={{ fontWeight: 600, fontSize: 14, flex: 1 }}>KaizenDesk Asistan</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setOpen(false)}
              style={{ padding: '2px 6px' }}
            >
              ✕
            </button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {messages.map((m, i) => (
              <div
                key={i}
                style={{
                  alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%',
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-soft)',
                  color: m.role === 'user' ? '#fff' : 'var(--text-1)',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '8px 12px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {m.text}
              </div>
            ))}
            {loading && (
              <div style={{
                alignSelf: 'flex-start', background: 'var(--bg-soft)',
                borderRadius: '12px 12px 12px 2px', padding: '8px 12px',
                fontSize: 13, color: 'var(--text-3)',
              }}>
                ···
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid var(--hairline)', display: 'flex', gap: 8 }}>
            <input
              className="input"
              style={{ flex: 1, fontSize: 13 }}
              placeholder="Mesajınızı yazın…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              disabled={loading}
            />
            <button
              type="button"
              className="btn btn-accent btn-sm"
              onClick={send}
              disabled={loading || !input.trim()}
            >
              →
            </button>
          </div>
        </div>
      )}

      {/* FAB */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: 48, height: 48, borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(0,0,0,.22)',
          fontSize: 20, color: '#fff',
          transition: 'transform .15s',
        }}
        title="AI Asistan"
      >
        {open ? '✕' : '✦'}
      </button>
    </div>
  );
}
