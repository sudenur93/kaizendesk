// common.jsx — shared UI helpers (avatars, badges, sla, etc.)
const { useState, useEffect, useMemo, useRef, useCallback } = React;

const STATUS = {
  new:               { label: "New",                key: "s-new" },
  in_progress:       { label: "In Progress",        key: "s-progress" },
  waiting_customer:  { label: "Waiting for Customer", key: "s-waiting" },
  resolved:          { label: "Resolved",           key: "s-resolved" },
  closed:            { label: "Closed",             key: "s-closed" },
};
const STATUS_TR = {
  new: "Yeni",
  in_progress: "İşlemde",
  waiting_customer: "Müşteri Bekleniyor",
  resolved: "Çözüldü",
  closed: "Kapatıldı",
};
const STATUS_ORDER = ["new", "in_progress", "waiting_customer", "resolved", "closed"];

const PRIORITY = {
  low:      { label: "Düşük",   key: "p-low" },
  medium:   { label: "Orta",    key: "p-medium" },
  high:     { label: "Yüksek",  key: "p-high" },
  critical: { label: "Kritik",  key: "p-critical" },
};
const PRIORITY_ORDER = ["critical", "high", "medium", "low"];

function StatusBadge({ status }) {
  const s = STATUS[status];
  return <span className={"badge " + s.key}><span className="pip"/>{STATUS_TR[status]}</span>;
}
function PriorityBadge({ priority }) {
  const p = PRIORITY[priority];
  return <span className={"badge " + p.key}>{p.label}</span>;
}

function Avatar({ initials, size = "" }) {
  return <span className={"av " + (size ? "av-" + size : "")}>{initials}</span>;
}

function userById(id, data) {
  if (!id) return null;
  return data.agents.find(a => a.id === id) || data.customers.find(c => c.id === id) || (id === data.manager.id ? data.manager : null);
}

function fmtDate(iso, opt = "short") {
  const d = new Date(iso);
  if (opt === "rel") {
    const diff = (Date.now() - d.getTime()) / 1000;
    if (diff < 60) return "şimdi";
    if (diff < 3600) return Math.round(diff/60) + " dk önce";
    if (diff < 86400) return Math.round(diff/3600) + " saat önce";
    if (diff < 86400*7) return Math.round(diff/86400) + " gün önce";
    return d.toLocaleDateString("tr-TR");
  }
  if (opt === "datetime") return d.toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

// SLA helpers — uses a fixed "now" so demo is deterministic
const NOW = new Date("2026-05-02T11:00:00").getTime();
function slaInfo(t) {
  const dl = new Date(t.slaDeadline).getTime();
  const created = new Date(t.createdAt).getTime();
  const total = dl - created;
  const remain = dl - NOW;
  const elapsed = Math.max(0, Math.min(1, (NOW - created) / total));
  let state = "ok";
  if (remain < 0) state = "bad";
  else if (remain < total * 0.2) state = "warn";
  if (["resolved","closed"].includes(t.status)) state = "ok";
  return { state, remain, elapsed: Math.min(1, elapsed) };
}
function fmtRemain(min) {
  const abs = Math.abs(min);
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (abs < 60) return `${m}dk${min<0?" gec":""}`;
  if (h < 24) return `${h}sa ${m}dk${min<0?" gec":""}`;
  return `${Math.floor(h/24)}g ${h%24}sa${min<0?" gec":""}`;
}
function SlaBar({ t }) {
  const info = slaInfo(t);
  const remainMin = Math.round(info.remain / 60000);
  return (
    <div className={"sla " + info.state}>
      <div className="sla-bar"><div style={{ width: (Math.min(1, info.elapsed) * 100).toFixed(0) + "%" }}/></div>
      <span className="sla-time">{fmtRemain(remainMin)}</span>
    </div>
  );
}

// Toasts
function useToasts() {
  const [list, setList] = useState([]);
  const push = useCallback((text) => {
    const id = Math.random();
    setList(l => [...l, { id, text }]);
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 2600);
  }, []);
  const node = (
    <div className="toasts">
      {list.map(t => <div className="toast" key={t.id}><span className="pip"/>{t.text}</div>)}
    </div>
  );
  return [push, node];
}

Object.assign(window, {
  STATUS, STATUS_TR, STATUS_ORDER, PRIORITY, PRIORITY_ORDER,
  StatusBadge, PriorityBadge, Avatar, userById, fmtDate, slaInfo, fmtRemain, SlaBar,
  useToasts, NOW,
});
