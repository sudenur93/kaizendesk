import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Ic from './Icons';
import { fmtDate } from './Common';

export default function Topbar({
  crumbs = [],
  search = '',
  onSearchChange,
  theme = 'light',
  onThemeToggle,
  showSearch = true,
  notifications = [],
}) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const popRef = useRef(null);

  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!open) return;
    function onClick(e) {
      if (popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  function handleNotifClick(n) {
    setOpen(false);
    if (n.ticketId) {
      const role = localStorage.getItem('role');
      const path = role === 'CUSTOMER' ? `/customer/tickets/${n.ticketId}` : `/agent/tickets/${n.ticketId}`;
      navigate(path);
    }
  }

  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {i > 0 && (
              <span className="sep">
                <Ic.ChevronRight size={12} />
              </span>
            )}
            <span className={i === crumbs.length - 1 ? 'here' : ''}>{c}</span>
          </span>
        ))}
      </div>
      {showSearch && (
        <div className="search">
          <Ic.Search size={14} />
          <input
            placeholder="Ticket ID, başlık veya açıklamada ara…"
            value={search}
            onChange={(e) => onSearchChange?.(e.target.value)}
          />
          <span className="kbd">⌘ K</span>
        </div>
      )}
      <button
        type="button"
        className="icon-btn"
        onClick={onThemeToggle}
        title={theme === 'dark' ? 'Aydınlık moda geç' : 'Karanlık moda geç'}
      >
        {theme === 'dark' ? <Ic.Sun size={16} /> : <Ic.Moon size={16} />}
      </button>
      <div ref={popRef} style={{ position: 'relative' }}>
        <button
          type="button"
          className="icon-btn"
          style={{ position: 'relative' }}
          title="Bildirimler"
          onClick={() => setOpen((o) => !o)}
        >
          <Ic.Bell size={16} />
          {unread > 0 && <span className="dot" />}
        </button>
        {open && (
          <div
            className="card"
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 360,
              maxHeight: 480,
              overflow: 'auto',
              boxShadow: 'var(--shadow-pop)',
              zIndex: 50,
            }}
          >
            <div className="card-head">
              <div>
                <h3>Bildirimler</h3>
                <div className="sub">{unread} okunmamış</div>
              </div>
            </div>
            {notifications.length === 0 ? (
              <div className="muted" style={{ padding: 24, textAlign: 'center', fontSize: 13 }}>
                Henüz bildirim yok.
              </div>
            ) : (
              <div className="col" style={{ gap: 0 }}>
                {notifications.slice(0, 12).map((n) => (
                  <button
                    type="button"
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className="col"
                    style={{
                      gap: 4,
                      padding: '12px 16px',
                      borderTop: '1px solid var(--hairline)',
                      background: n.read ? 'transparent' : 'var(--bg-soft)',
                      textAlign: 'left',
                      cursor: 'pointer',
                      width: '100%',
                      border: 'none',
                      borderTopWidth: 1,
                      borderTopStyle: 'solid',
                      borderTopColor: 'var(--hairline)',
                    }}
                  >
                    <div className="row" style={{ gap: 8, alignItems: 'flex-start' }}>
                      {!n.read && (
                        <span
                          style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: 'var(--accent)', marginTop: 6, flexShrink: 0,
                          }}
                        />
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text)' }}>
                          {n.title}
                        </div>
                        <div className="muted" style={{ fontSize: 12, marginTop: 2, lineHeight: 1.4 }}>
                          {n.message}
                        </div>
                        <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                          {fmtDate(n.createdAt, 'rel')}
                          {n.ticketId && <span> · #{n.ticketId}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
