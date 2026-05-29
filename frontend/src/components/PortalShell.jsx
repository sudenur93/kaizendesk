import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useToasts } from './Common';
import { getCurrentUserProfile, getNotifications, getRole, getPendingUsers } from '../services/api';

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
  '/agent/team': ['Ekibim', 'Ekip üyeleri ve iş yükü'],
  '/archive': ['Arşiv', 'Kapalı Talepler'],
  '/settings': ['Ayarlar', 'Hesap Ayarları'],
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
    const stored = localStorage.getItem('theme');
    if (stored) return stored;
    // Sistem tercihini algıla
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {
    // ses desteklenmiyorsa sessizce geç
  }
}

function showBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body, icon: '/favicon.ico' });
  }
}

export default function PortalShell() {
  const location = useLocation();
  const role = getRole();
  const [user, setUser] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [search, setSearch] = useState('');
  const [theme, setTheme] = useState(readStoredTheme);
  const [pushToast, toastsNode] = useToasts();
  const prevNotifCount = useRef(null);

  // Sistem tema tercihi değişirse güncelle
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (!localStorage.getItem('theme')) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem('theme', theme);
    } catch {
      // ignore
    }
  }, [theme]);

  // Bildirim izni iste
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
          if (!cancelled) {
            // Yeni bildirim var mı kontrol et
            if (prevNotifCount.current !== null && data.length > prevNotifCount.current) {
              const newCount = data.length - prevNotifCount.current;
              playNotificationSound();
              showBrowserNotification('KaizenDesk', `${newCount} yeni bildiriminiz var`);
            }
            prevNotifCount.current = data.length;
            setNotifications(data);
          }
        })
        .catch(() => {});
    }
    load();
    const id = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Manager ise onay bekleyen kullanıcı sayısını çek
  useEffect(() => {
    if (role !== 'MANAGER') return;
    let cancelled = false;
    function loadPending() {
      getPendingUsers()
        .then((data) => { if (!cancelled) setPendingCount(data.length); })
        .catch(() => {});
    }
    loadPending();
    const id = setInterval(loadPending, 30000);
    return () => { cancelled = true; clearInterval(id); };
  }, [role]);

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
        <Sidebar role={role} user={user} counts={{ 'm-approvals': pendingCount > 0 ? pendingCount : undefined }} />
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
