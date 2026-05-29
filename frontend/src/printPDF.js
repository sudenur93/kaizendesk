/**
 * Tarayıcının yerleşik yazdır/PDF-kaydet diyaloğunu kullanarak
 * yeni bir pencerede ticket detayını PDF olarak sunar.
 * Harici kütüphane gerektirmez.
 */

const PRIORITY_TR = { HIGH: 'Yüksek', MEDIUM: 'Orta', LOW: 'Düşük' };
const STATUS_TR   = {
  NEW: 'Yeni',
  IN_PROGRESS: 'İşlemde',
  WAITING_FOR_CUSTOMER: 'Müşteri Bekliyor',
  RESOLVED: 'Çözüldü',
  CLOSED: 'Kapalı',
};

function fmtDt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function commentsHtml(comments) {
  if (!comments || comments.length === 0) return '<p style="color:#888;font-size:13px">Henüz yorum yok.</p>';
  return comments.map((c) => `
    <div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 14px;margin-bottom:10px">
      <div style="display:flex;justify-content:space-between;margin-bottom:6px">
        <strong style="font-size:13px">${esc(c.authorName || 'KaizenDesk')}</strong>
        <span style="font-size:12px;color:#888">${fmtDt(c.createdAt)}</span>
      </div>
      <div style="font-size:13px;line-height:1.6;white-space:pre-wrap">${esc(c.message)}</div>
    </div>
  `).join('');
}

export function printTicketPDF({ ticket, comments = [], attachments = [], productName = '—', categoryName = '—' }) {
  const priority    = PRIORITY_TR[ticket.priority] || ticket.priority || '—';
  const status      = STATUS_TR[ticket.status]     || ticket.status   || '—';
  const slaState    = ticket.slaBreached ? '🔴 SLA İhlali' : ticket.slaAtRisk ? '🟡 SLA Riski' : '🟢 Zamanında';
  const slaTarget   = fmtDt(ticket.slaTargetAt);
  const assignee    = ticket.assignedAgentName || (ticket.assignedAgentId ? `#${ticket.assignedAgentId}` : 'Atanmamış');
  const reporter    = ticket.createdByUsername || '—';
  const attList     = attachments.length > 0
    ? attachments.map((a) => `<li>${esc(a.originalFileName)}</li>`).join('')
    : '<li style="color:#888">Ek yok</li>';

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>Talep #${ticket.id} — KaizenDesk</title>
  <style>
    @page { size: A4; margin: 20mm 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 14px; color: #111; background: #fff; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #555; margin: 24px 0 10px; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 2px solid #111; }
    .logo { font-size: 13px; font-weight: 700; letter-spacing: .04em; color: #555; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
    .meta-row { display: flex; gap: 8px; font-size: 13px; }
    .meta-label { color: #888; min-width: 90px; flex-shrink: 0; }
    .description { font-size: 14px; line-height: 1.6; white-space: pre-wrap; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px 14px; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; }
    .badge-high   { background: #fee2e2; color: #991b1b; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low    { background: #dcfce7; color: #166534; }
    .footer { margin-top: 32px; font-size: 11px; color: #aaa; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>

<button class="no-print" onclick="window.print()"
  style="position:fixed;top:16px;right:16px;padding:8px 18px;background:#111;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;z-index:99">
  ⬇ PDF Kaydet
</button>

<div class="header">
  <div>
    <div class="logo">KaizenDesk</div>
    <h1>${esc(ticket.title)}</h1>
    <div style="font-size:13px;color:#888;margin-top:4px">Talep #${ticket.id} · ${fmtDt(ticket.createdAt)}</div>
  </div>
  <div style="text-align:right;font-size:13px;color:#555">
    <div>${status}</div>
    <div style="margin-top:4px">${slaState}</div>
  </div>
</div>

<h2>Detaylar</h2>
<div class="meta-grid">
  <div class="meta-row"><span class="meta-label">Durum</span><span>${status}</span></div>
  <div class="meta-row"><span class="meta-label">Öncelik</span>
    <span class="badge badge-${(ticket.priority || '').toLowerCase()}">${priority}</span>
  </div>
  <div class="meta-row"><span class="meta-label">Bildiren</span><span>${esc(reporter)}</span></div>
  <div class="meta-row"><span class="meta-label">Atanan</span><span>${esc(assignee)}</span></div>
  <div class="meta-row"><span class="meta-label">Sistem</span><span>${esc(productName)}</span></div>
  <div class="meta-row"><span class="meta-label">Kategori</span><span>${esc(categoryName)}</span></div>
  <div class="meta-row"><span class="meta-label">SLA Hedefi</span><span>${slaTarget}</span></div>
  <div class="meta-row"><span class="meta-label">SLA Durumu</span><span>${slaState}</span></div>
  <div class="meta-row"><span class="meta-label">Güncellendi</span><span>${fmtDt(ticket.updatedAt || ticket.createdAt)}</span></div>
</div>

<h2>Açıklama</h2>
<div class="description">${esc(ticket.description || '—')}</div>

<h2>Ekler (${attachments.length})</h2>
<ul style="font-size:13px;margin:0;padding-left:18px">${attList}</ul>

<h2>Konuşma (${comments.filter(c => !c.internal).length} mesaj)</h2>
${commentsHtml(comments.filter(c => !c.internal))}

<div class="footer">
  KaizenDesk · Talep #${ticket.id} · Yazdırıldı: ${new Date().toLocaleString('tr-TR')}
</div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) {
    alert('Açılır pencere engellendi. Lütfen tarayıcı ayarlarından açılır pencereye izin verin.');
    return;
  }
  win.document.write(html);
  win.document.close();
  // Kısa gecikme — tarayıcının içeriği render etmesini bekle
  setTimeout(() => win.print(), 600);
}

/**
 * Yönetici paneli özet PDF'i.
 * @param {{ data, rangeDays, liveSlaRate, liveBreached, liveInTarget, agentStats }} opts
 */
export function printDashboardPDF({ data, rangeDays, liveSlaRate, liveBreached, liveInTarget, agentStats = [] }) {
  const rangeLabel = rangeDays === '7' ? 'Son 7 gün' : rangeDays === '30' ? 'Son 30 gün' : 'Son 90 gün';

  const statusRows = [
    ['Yeni',            data?.statusCounts?.NEW                  || 0],
    ['İşlemde',         data?.statusCounts?.IN_PROGRESS          || 0],
    ['Müşteri Bekliyor',data?.statusCounts?.WAITING_FOR_CUSTOMER || 0],
    ['Çözüldü',         data?.statusCounts?.RESOLVED             || 0],
    ['Kapalı',          data?.statusCounts?.CLOSED               || 0],
  ];

  const agentRows = (agentStats || []).slice(0, 10).map((ap) => `
    <tr>
      <td>${esc(ap.agentName || '—')}</td>
      <td style="text-align:center">${ap.assignedCount || 0}</td>
      <td style="text-align:center">${ap.resolvedCount || 0}</td>
      <td style="text-align:center">${ap.closedCount   || 0}</td>
    </tr>
  `).join('');

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8"/>
  <title>Dashboard Özeti — KaizenDesk</title>
  <style>
    @page { size: A4; margin: 18mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 13px; color: #111; background: #fff; margin: 0; }
    h1 { font-size: 20px; margin: 0 0 4px; }
    h2 { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #555; margin: 20px 0 8px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; padding-bottom: 14px; border-bottom: 2px solid #111; }
    .logo { font-size: 12px; font-weight: 700; letter-spacing: .04em; color: #888; }
    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 4px; }
    .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 10px 14px; }
    .kpi-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: #888; margin-bottom: 4px; }
    .kpi-val { font-size: 26px; font-weight: 700; line-height: 1; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th { text-align: left; padding: 6px 8px; background: #f9fafb; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
    td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
    .footer { margin-top: 24px; font-size: 10px; color: #aaa; text-align: right; border-top: 1px solid #e5e7eb; padding-top: 6px; }
    @media print { .no-print { display: none !important; } }
  </style>
</head>
<body>

<button class="no-print" onclick="window.print()"
  style="position:fixed;top:16px;right:16px;padding:8px 18px;background:#111;color:#fff;border:none;border-radius:6px;font-size:13px;cursor:pointer;z-index:99">
  ⬇ PDF Kaydet
</button>

<div class="header">
  <div>
    <div class="logo">KaizenDesk</div>
    <h1>Yönetici Paneli Özeti</h1>
    <div style="font-size:12px;color:#888;margin-top:4px">${rangeLabel} · ${new Date().toLocaleDateString('tr-TR')}</div>
  </div>
  <div style="text-align:right;font-size:13px">
    <div style="font-size:28px;font-weight:700;color:${liveSlaRate >= 90 ? '#166534' : liveSlaRate >= 75 ? '#92400e' : '#991b1b'}">%${liveSlaRate}</div>
    <div style="font-size:11px;color:#888">Anlık SLA Uyumu</div>
  </div>
</div>

<h2>Genel KPI'lar (${rangeLabel})</h2>
<div class="kpi-grid">
  <div class="kpi">
    <div class="kpi-label">Toplam Talep</div>
    <div class="kpi-val">${data?.totalTickets ?? '—'}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Çözülen</div>
    <div class="kpi-val" style="color:#166534">${data?.resolvedTickets ?? '—'}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">SLA İhlali (anlık)</div>
    <div class="kpi-val" style="color:${liveBreached > 0 ? '#991b1b' : '#166534'}">${liveBreached}</div>
  </div>
  <div class="kpi">
    <div class="kpi-label">Hedefte (anlık)</div>
    <div class="kpi-val" style="color:#166534">${liveInTarget}</div>
  </div>
</div>

<h2>Durum Dağılımı</h2>
<table>
  <thead><tr><th>Durum</th><th style="text-align:center">Sayı</th></tr></thead>
  <tbody>
    ${statusRows.map(([label, val]) => `<tr><td>${label}</td><td style="text-align:center;font-weight:600">${val}</td></tr>`).join('')}
  </tbody>
</table>

${agentRows ? `
<h2>Uzman Performansı</h2>
<table>
  <thead><tr><th>Uzman</th><th style="text-align:center">Atanan</th><th style="text-align:center">Çözülen</th><th style="text-align:center">Kapatılan</th></tr></thead>
  <tbody>${agentRows}</tbody>
</table>
` : ''}

<div class="footer">
  KaizenDesk · Dashboard Özeti · Yazdırıldı: ${new Date().toLocaleString('tr-TR')}
</div>

</body>
</html>`;

  const win = window.open('', '_blank', 'width=860,height=660');
  if (!win) {
    alert('Açılır pencere engellendi. Lütfen tarayıcı ayarlarından açılır pencereye izin verin.');
    return;
  }
  win.document.write(html);
  win.document.close();
  setTimeout(() => win.print(), 600);
}
