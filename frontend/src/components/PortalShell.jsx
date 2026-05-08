import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useToasts } from './Common';
import { getCurrentUserProfile, getNotifications, getRole } from '../services/api';

const ShellContext = createContext({});

export function useShell() {
  return useContext(ShellContext);
}

const CRUMB_MAP = {
  '/customer/tickets': ['Müşteri Portalı', 'Taleplerim'],
  '/customer/tickets/new': ['Müşteri Portalı', 'Yeni Talep'],
  '/agent/tickets': ['Destek Portalı', 'Talepler'],
  '/manager/dashboard': ['Yönetici Portalı', 'Genel Bakış'],
  '/manager/sla': ['Yönetici Portalı', 'SLA İzleme'],
  '/manager/team': ['Yönetici Portalı', 'Ekip'],
};

function buildCrumbs(pathname) {
  if (CRUMB_MAP[pathname]) return CRUMB_MAP[pathname];
  if (pathname.startsWith('/customer/tickets/')) {
    return ['Müşteri Portalı', 'Taleplerim', pathname.split('/').pop()];
  }
  if (pathname.startsWith('/agent/tickets/')) {
    return ['Destek Portalı', 'Talepler', pathname.split('/').pop()];
  }
  return [];
}

function readStoredTheme() {
  try {
    return localStorage.getItem('theme') || 'light';
  } catch {
    return 'light';
  }
}

export default function PortalShell() {
  const location = useLocation();
  const role = getRole();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState(readStoredTheme);
  const [pushToast, toastsNode] = useToasts();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  useEffect(() => {
    let cancelled = false;
    getCurrentUserProfile()
      .then((data) => {
        if (!cancelled) setUser(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    function load() {
      getNotifications()
        .then((data) => {
          if (!cancelled) setNotifications(data);
        })
        .catch(() => {});
    }
    load();
    const id = setInterval(load, 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, []);

  const crumbs = useMemo(() => buildCrumbs(location.pathname), [location.pathname]);

  const ctx = useMemo(
    () => ({
      role,
      user,
      search,
      setSearch,
      pushToast,
      theme,
      setTheme,
    }),
    [role, user, search, pushToast, theme]
  );

  return (
    <ShellContext.Provider value={ctx}>
      <div className="app">
        <Sidebar role={role} user={user} />
        <div className="main">
          <Topbar
            crumbs={crumbs}
            search={search}
            onSearchChange={setSearch}
            theme={theme}
            onThemeToggle={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
            notifications={notifications}
          />
          <Outlet context={ctx} />
        </div>
        {toastsNode}
      </div>
    </ShellContext.Provider>
  );
}
