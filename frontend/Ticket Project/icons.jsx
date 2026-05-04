// icons.jsx — minimal stroke icons; assigned to window for cross-script access
const Ic = (() => {
  const make = (path, opts = {}) => ({ size = 16, stroke = 1.6, ...rest } = {}) =>
    (<svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" {...rest}>
      {path}
    </svg>);
  return {
    Inbox: make(<><path d="M3 12l4-7h10l4 7"/><path d="M3 12v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/><path d="M3 12h5l1 2h6l1-2h5"/></>),
    List: make(<><path d="M8 6h12"/><path d="M8 12h12"/><path d="M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></>),
    Plus: make(<><path d="M12 5v14M5 12h14"/></>),
    Search: make(<><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></>),
    Bell: make(<><path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9z"/><path d="M10 21a2 2 0 0 0 4 0"/></>),
    Filter: make(<><path d="M3 5h18l-7 9v6l-4-2v-4z"/></>),
    Kanban: make(<><rect x="3" y="4" width="6" height="14" rx="1"/><rect x="11" y="4" width="6" height="9" rx="1"/><rect x="19" y="4" width="2" height="14" rx="1"/></>),
    Dashboard: make(<><rect x="3" y="3" width="8" height="10" rx="1"/><rect x="13" y="3" width="8" height="6" rx="1"/><rect x="13" y="11" width="8" height="10" rx="1"/><rect x="3" y="15" width="8" height="6" rx="1"/></>),
    Settings: make(<><circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1.2l2-1.5-2-3.4-2.4.8a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.5a7 7 0 0 0-2 1.2l-2.4-.8-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.5 2 3.4 2.4-.8c.6.5 1.3.9 2 1.2L10 21h4l.5-2.5a7 7 0 0 0 2-1.2l2.4.8 2-3.4-2-1.5c.1-.4.1-.8.1-1.2z"/></>),
    Users: make(<><circle cx="9" cy="8" r="3"/><path d="M3 20a6 6 0 0 1 12 0"/><circle cx="17" cy="8" r="3"/><path d="M15 20a6 6 0 0 1 6-6"/></>),
    Chart: make(<><path d="M4 19V5"/><path d="M4 19h16"/><path d="M8 16v-5"/><path d="M12 16V9"/><path d="M16 16v-3"/></>),
    Clock: make(<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>),
    Tag: make(<><path d="M3 12V5a2 2 0 0 1 2-2h7l9 9-9 9z"/><circle cx="8" cy="8" r="1.5"/></>),
    Paperclip: make(<><path d="M21 11.5 12 21a5 5 0 0 1-7-7l9-9a3.5 3.5 0 0 1 5 5l-9 9a2 2 0 0 1-3-3l8-8"/></>),
    Send: make(<><path d="M22 2 11 13"/><path d="M22 2l-7 20-4-9-9-4z"/></>),
    Check: make(<><path d="m5 12 4 4 10-10"/></>),
    X: make(<><path d="M6 6l12 12M18 6L6 18"/></>),
    More: make(<><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></>),
    ArrowDown: make(<><path d="M12 5v14M5 12l7 7 7-7"/></>),
    ArrowUp: make(<><path d="M12 19V5M5 12l7-7 7 7"/></>),
    Lock: make(<><rect x="4" y="11" width="16" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></>),
    Eye: make(<><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></>),
    Sparkle: make(<><path d="M12 3v6M12 15v6M3 12h6M15 12h6"/></>),
    Flag: make(<><path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/></>),
    File: make(<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></>),
    Image: make(<><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 9"/></>),
    Logout: make(<><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></>),
    Refresh: make(<><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 4v5h-5"/></>),
    AlertTriangle: make(<><path d="M10.3 3.7 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.7a2 2 0 0 0-3.4 0z"/><path d="M12 9v4"/><circle cx="12" cy="17" r="0.7" fill="currentColor"/></>),
    ChevronRight: make(<><path d="m9 6 6 6-6 6"/></>),
    ChevronDown: make(<><path d="m6 9 6 6 6-6"/></>),
    Sun: make(<><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>),
    Moon: make(<><path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10z"/></>),
    Building: make(<><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/></>),
    BarChart: make(<><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>),
    Trend: make(<><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></>),
    Mail: make(<><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></>),
  };
})();
window.Ic = Ic;
