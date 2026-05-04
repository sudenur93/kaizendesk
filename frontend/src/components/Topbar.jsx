import Ic from './Icons';

export default function Topbar({
  crumbs = [],
  search = '',
  onSearchChange,
  theme = 'light',
  onThemeToggle,
  showSearch = true,
}) {
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
      <button type="button" className="icon-btn" style={{ position: 'relative' }} title="Bildirimler">
        <Ic.Bell size={16} />
        <span className="dot" />
      </button>
    </div>
  );
}
