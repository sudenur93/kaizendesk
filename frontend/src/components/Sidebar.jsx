import { Link, useLocation } from 'react-router-dom';
import Ic from './Icons';
import { Avatar, getInitials } from './Common';
import { logout } from '../services/api';

const NAVS = {
  CUSTOMER: {
    label: 'Müşteri Portalı',
    items: [
      { id: 'c-list', to: '/customer/tickets', label: 'Taleplerim', icon: <Ic.Inbox /> },
      { id: 'c-new', to: '/customer/tickets/new', label: 'Yeni Talep', icon: <Ic.Plus /> },
    ],
  },
  AGENT: {
    label: 'Destek Portalı',
    items: [
      { id: 'a-list', to: '/agent/tickets', label: 'Tüm Talepler', icon: <Ic.List /> },
      { id: 'a-mine', to: '/agent/tickets?mine=1', label: 'Bana Atananlar', icon: <Ic.Inbox /> },
      { id: 'a-kanban', to: '/agent/tickets?view=kanban', label: 'Kanban', icon: <Ic.Kanban /> },
      { id: 'a-sla', to: '/agent/tickets?view=sla', label: 'SLA Riski', icon: <Ic.AlertTriangle /> },
    ],
  },
  MANAGER: {
    label: 'Yönetici Portalı',
    items: [
      { id: 'm-dash', to: '/manager/dashboard', label: 'Genel Bakış', icon: <Ic.Dashboard /> },
    ],
  },
};

function isActive(currentPath, currentSearch, item) {
  if (item.to.includes('?')) {
    const [path, query] = item.to.split('?');
    return currentPath === path && currentSearch.includes(query);
  }
  if (item.id === 'a-list') {
    return currentPath === '/agent/tickets' && currentSearch === '';
  }
  return currentPath === item.to;
}

export default function Sidebar({ role, user, counts = {}, onLogout }) {
  const loc = useLocation();
  const nav = NAVS[role] || NAVS.CUSTOMER;
  const initials = getInitials(user?.name);
  const roleLabel =
    role === 'CUSTOMER' ? 'Müşteri' : role === 'AGENT' ? 'Destek Uzmanı' : 'Yönetici';

  function handleLogout() {
    if (onLogout) onLogout();
    else logout();
  }

  return (
    <aside className="sb">
      <div className="sb-brand">
        <div className="logo">K</div>
        <div className="name">
          KaizenDesk
          <small>Ticket Yönetimi</small>
        </div>
      </div>

      <div className="sb-section">
        <div className="sb-section-label">{nav.label}</div>
        {nav.items.map((item) => {
          const active = isActive(loc.pathname, loc.search, item);
          const count = counts[item.id];
          return (
            <Link
              key={item.id}
              to={item.to}
              className={'sb-item' + (active ? ' active' : '')}
            >
              <span className="ic">{item.icon}</span>
              <span>{item.label}</span>
              {count != null && <span className="count">{count}</span>}
            </Link>
          );
        })}
      </div>

      <div className="sb-foot">
        <div className="user-card" role="button" onClick={handleLogout} title="Çıkış yap">
          <Avatar initials={initials} />
          <div className="who">
            {user?.name || 'Kullanıcı'}
            <small>{roleLabel}</small>
          </div>
          <span className="spacer" />
          <span className="ic" style={{ color: 'var(--text-3)' }}>
            <Ic.Logout size={14} />
          </span>
        </div>
      </div>
    </aside>
  );
}
