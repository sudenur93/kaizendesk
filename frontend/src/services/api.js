/**
 * Tüm backend HTTP isteklerini ve Keycloak kimlik doğrulama işlemlerini yöneten servis katmanı.
 *
 * Temel prensipler:
 *   - api axios instance'ı: /api/v1 base URL ile oluşturulur; her isteğe JWT Bearer token eklenir
 *   - Geliştirme ortamında Vite proxy /api → localhost:8080, /auth → localhost:8081 yönlendirir
 *   - Production'da VITE_API_URL ve VITE_KEYCLOAK_URL env değişkenleri kullanılır
 *
 * Token yönetimi:
 *   - "Beni hatırla" seçiliyse → localStorage (tarayıcı kapansa da korunur)
 *   - "Beni hatırla" seçilmezse → sessionStorage (sekme kapanınca silinir)
 *   - 401/403 yanıtı: tüm depolama temizlenir, /login?expired=1 yönlendirilir
 *
 * Keycloak Admin API kullanımı:
 *   - register/approveUser/rejectUser → admin-cli credential grant ile admin token alınır
 *   - Bu token yalnızca admin işlemleri için kullanılır; kullanıcı oturumunu etkilemez
 */
import axios from 'axios';

// Production'da env var'dan gelir, geliştirmede Vite proxy üzerinden çalışır
const _API_URL   = import.meta.env.VITE_API_URL   || '';
const _KC_URL    = import.meta.env.VITE_KEYCLOAK_URL || '';

const API_BASE           = _API_URL  ? `${_API_URL}/api/v1`   : '/api/v1';
const KEYCLOAK_BASE      = _KC_URL   ? `${_KC_URL}/realms/kaizendesk/protocol/openid-connect` : '/auth/realms/kaizendesk/protocol/openid-connect';
const KEYCLOAK_ADMIN_TOKEN = _KC_URL ? `${_KC_URL}/realms/master/protocol/openid-connect/token` : '/auth/realms/master/protocol/openid-connect/token';
const KEYCLOAK_ADMIN_USERS = _KC_URL ? `${_KC_URL}/admin/realms/kaizendesk/users` : '/auth/admin/realms/kaizendesk/users';
/** Keycloak'ta tanımlı frontend client id. */
const CLIENT_ID = 'kaizendesk-app';

/** Tüm /api/v1 istekleri için temel Axios instance'ı. */
const api = axios.create({ baseURL: API_BASE });

/**
 * "Beni hatırla" tercihine göre doğru depolama alanını döner.
 * localStorage → kalıcı oturum | sessionStorage → geçici (sekme ömrü) oturum
 */
function getStorage() {
  return localStorage.getItem('rememberMe') === '1' ? localStorage : sessionStorage;
}

/**
 * İstek interceptor: her API isteğine Authorization: Bearer <token> başlığı ekler.
 * Token önce localStorage'da, yoksa sessionStorage'da aranır.
 */
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

/**
 * Yanıt interceptor: 401 (token süresi doldu) veya 403 (yetkisiz) durumunda
 * tüm oturum verilerini temizler ve kullanıcıyı login sayfasına yönlendirir.
 */
/**
 * Oturum verilerini temizler ama kullanıcı tercihlerini (avatar rengi, tema, beni hatırla)
 * korur — böylece çıkış/giriş sonrası bu ayarlar kaybolmaz.
 */
function clearSession() {
  const PRESERVE = ['avatarColor', 'theme', 'rememberMe'];
  const kept = {};
  // Tam eşleşen tercih anahtarları + 'kz_fav_' önekli favori anahtarları korunur
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (PRESERVE.includes(k) || (k && k.startsWith('kz_fav_'))) {
      kept[k] = localStorage.getItem(k);
    }
  }
  localStorage.clear();
  sessionStorage.clear();
  Object.entries(kept).forEach(([k, v]) => localStorage.setItem(k, v));
}

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      clearSession();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(err);
  }
);

/**
 * Keycloak'a password grant_type ile kimlik doğrulama isteği gönderir.
 * JWT alındıktan sonra realm_access.roles okunarak kullanıcı rolü belirlenir.
 * Token ve oturum bilgileri remember parametresine göre localStorage veya sessionStorage'a kaydedilir.
 * @returns { token, role, username, name }
 */
export async function login(username, password, totp = '', remember = true) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);
  if (totp) params.append('totp', totp);

  const res = await axios.post(`${KEYCLOAK_BASE}/token`, params);
  const token = res.data.access_token;
  const refreshToken = res.data.refresh_token;

  const payload = JSON.parse(atob(token.split('.')[1]));
  const realmRoles = payload.realm_access?.roles || [];

  let role = 'CUSTOMER';
  if (realmRoles.includes('MANAGER')) role = 'MANAGER';
  else if (realmRoles.includes('AGENT')) role = 'AGENT';

  // Beni hatırla: localStorage (kalıcı) vs sessionStorage (sekme kapanınca siler)
  localStorage.setItem('rememberMe', remember ? '1' : '0');
  const storage = remember ? localStorage : sessionStorage;
  if (!remember) clearSession(); // önceki kalıcı oturumu temizle (tercihleri koru)

  storage.setItem('token', token);
  storage.setItem('refreshToken', refreshToken);
  storage.setItem('role', role);
  storage.setItem('username', payload.preferred_username);
  storage.setItem('name', payload.name || payload.preferred_username);

  return { token, role, username: payload.preferred_username, name: payload.name };
}

/**
 * 3 başarısız giriş denemesi sonrası güvenlik uyarısı tetikler.
 * Kullanıcı sistemi tarafından tanınıyorsa e-posta bildirimi gönderilir.
 */
export async function notifyLoginFailed(usernameOrEmail) {
  if (!usernameOrEmail) return;
  await axios.post(`${API_BASE}/public/security/login-failed`, { usernameOrEmail });
}

const KEYCLOAK_ADMIN_REALM = _KC_URL ? `${_KC_URL}/admin/realms/kaizendesk` : '/auth/admin/realms/kaizendesk';

/**
 * Keycloak Admin API aracılığıyla yeni kullanıcı kaydı oluşturur.
 * AGENT başvuruları enabled:false olarak açılır (manager onayı gerekir).
 * CUSTOMER hesapları enabled:true olarak aktif açılır.
 * Onay sonrası approveUser() ile enabled:true yapılır.
 * Kayıt sonrası kullanıcıya rol atanır (varsayılan: CUSTOMER).
 */
export async function register(username, password, email, firstName, lastName, role = 'CUSTOMER') {
  const requestedRole = String(role || 'CUSTOMER').toUpperCase();
  const selectedRole = requestedRole === 'AGENT' ? 'AGENT' : 'CUSTOMER';
  const adminParams = new URLSearchParams();
  adminParams.append('client_id', 'admin-cli');
  adminParams.append('grant_type', 'password');
  adminParams.append('username', 'admin');
  adminParams.append('password', 'admin');

  const adminRes = await axios.post(KEYCLOAK_ADMIN_TOKEN, adminParams);
  const adminToken = adminRes.data.access_token;
  const authHeaders = {
    Authorization: `Bearer ${adminToken}`,
    'Content-Type': 'application/json',
  };

  await axios.post(
    KEYCLOAK_ADMIN_USERS,
    {
      username,
      email,
      firstName,
      lastName,
      enabled: selectedRole !== 'AGENT',
      emailVerified: true,
      credentials: [{ type: 'password', value: password, temporary: false }],
    },
    { headers: authHeaders }
  );

  const userListRes = await axios.get(
    `${KEYCLOAK_ADMIN_USERS}?username=${encodeURIComponent(username)}&exact=true`,
    { headers: authHeaders }
  );
  const newUser = Array.isArray(userListRes.data) ? userListRes.data[0] : null;
  if (!newUser?.id) {
    throw new Error('Kullanıcı oluşturuldu ancak rol atanamadı.');
  }

  const roleRes = await axios.get(`${KEYCLOAK_ADMIN_REALM}/roles/${selectedRole}`, {
    headers: authHeaders,
  });
  await axios.post(
    `${KEYCLOAK_ADMIN_REALM}/users/${newUser.id}/role-mappings/realm`,
    [roleRes.data],
    { headers: authHeaders }
  );
}

export function logout() {
  clearSession();
  window.location.href = '/login';
}

export function getRole() {
  return localStorage.getItem('role') || sessionStorage.getItem('role');
}

export function getUsername() {
  return localStorage.getItem('username') || sessionStorage.getItem('username');
}

export function getName() {
  return localStorage.getItem('name') || sessionStorage.getItem('name');
}

export function isLoggedIn() {
  return !!(localStorage.getItem('token') || sessionStorage.getItem('token'));
}

async function getAdminToken() {
  const params = new URLSearchParams();
  params.append('client_id', 'admin-cli');
  params.append('grant_type', 'password');
  params.append('username', 'admin');
  params.append('password', 'admin');
  const res = await axios.post(KEYCLOAK_ADMIN_TOKEN, params);
  return res.data.access_token;
}

async function getUserRealmRoles(userId, token) {
  const res = await axios.get(`${KEYCLOAK_ADMIN_REALM}/users/${userId}/role-mappings/realm`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return Array.isArray(res.data) ? res.data.map((role) => role.name) : [];
}

/** Manager onayı bekleyen AGENT başvurularını listeler. */
export async function getPendingUsers() {
  const token = await getAdminToken();
  const res = await axios.get(`${KEYCLOAK_ADMIN_USERS}?enabled=false&max=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const disabledUsers = res.data || [];
  const usersWithRoles = await Promise.all(
    disabledUsers.map(async (user) => ({
      ...user,
      realmRoles: await getUserRealmRoles(user.id, token).catch(() => []),
    }))
  );
  return usersWithRoles.filter((user) => user.realmRoles.includes('AGENT'));
}

/** Kullanıcıyı onaylar (enabled:true) ve hoş geldin e-postası gönderir. */
export async function approveUser(userId) {
  const token = await getAdminToken();
  await axios.put(`${KEYCLOAK_ADMIN_USERS}/${userId}`, { enabled: true }, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  // Hoş geldin maili gönder
  await axios.put(`${KEYCLOAK_ADMIN_USERS}/${userId}/execute-actions-email`, [], {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  }).catch(() => {});
}

/** Kullanıcı kaydını Keycloak'tan kalıcı olarak siler (reddetme). */
export async function rejectUser(userId) {
  const token = await getAdminToken();
  await axios.delete(`${KEYCLOAK_ADMIN_USERS}/${userId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function getCurrentUserProfile() {
  const res = await api.get('/users/me');
  return res.data;
}

export async function getAgents() {
  const res = await api.get('/users/agents');
  return res.data;
}

export async function updateAgentTeam(agentId, team) {
  const res = await api.patch(`/users/${agentId}/team`, { team });
  return res.data;
}

export async function getNotifications() {
  const res = await api.get('/notifications');
  return res.data;
}

// ─── Bilet CRUD ──────────────────────────────────────────────────────────────

/** Biletleri filtreli listeler. Müşteri rolünde backend otomatik olarak sadece kendi biletlerini döner. */
export async function getTickets(params = {}) {
  const res = await api.get('/tickets', { params });
  return res.data;
}

export async function getTicket(ticketId) {
  const res = await api.get(`/tickets/${ticketId}`);
  return res.data;
}

export async function createTicket(payload) {
  const res = await api.post('/tickets', payload);
  return res.data;
}

export async function assignTicket(ticketId, agentId) {
  const res = await api.patch(`/tickets/${ticketId}/assign`, { agentId });
  return res.data;
}

export async function updateTicketStatus(ticketId, status, resolutionNote = '') {
  const res = await api.patch(`/tickets/${ticketId}/status`, { status, resolutionNote });
  return res.data;
}

export async function updateTicketPriority(ticketId, priority) {
  const res = await api.patch(`/tickets/${ticketId}/priority`, { priority });
  return res.data;
}

export async function deleteTicket(ticketId) {
  await api.delete(`/tickets/${ticketId}`);
}

export async function customerTicketAction(ticketId, action, archive = false) {
  const res = await api.patch(`/tickets/${ticketId}/customer-action`, {
    action,
    archive: archive ? 'true' : 'false',
  });
  return res.data;
}

export async function rateTicket(ticketId, rating, comment = '') {
  const res = await api.patch(`/tickets/${ticketId}/rating`, {
    rating: String(rating),
    comment,
  });
  return res.data;
}

export async function getProducts() {
  const res = await api.get('/products');
  return res.data;
}

export async function getCategories(productId) {
  const res = await api.get(`/products/${productId}/categories`);
  return res.data;
}

export async function getIssueTypes(categoryId) {
  const res = await api.get(`/categories/${categoryId}/issue-types`);
  return res.data;
}

// ─── Dosya Ekleri ────────────────────────────────────────────────────────────

/** Bilette dosya yükler. multipart/form-data formatında gönderilir. */
export async function uploadTicketAttachment(ticketId, file) {
  const formData = new FormData();
  formData.append('file', file);
  const res = await api.post(`/tickets/${ticketId}/attachments`, formData);
  return res.data;
}

export async function getTicketAttachments(ticketId) {
  const res = await api.get(`/tickets/${ticketId}/attachments`);
  return res.data;
}

export async function downloadTicketAttachment(ticketId, attachmentId) {
  const res = await api.get(`/tickets/${ticketId}/attachments/${attachmentId}/file`, {
    responseType: 'blob',
  });
  return res.data;
}

// ─── Yorumlar ────────────────────────────────────────────────────────────────

/** Bilete ait yorumları listeler. Müşteri dahili notları (INTERNAL) göremez. */
export async function getTicketComments(ticketId) {
  const res = await api.get(`/tickets/${ticketId}/comments`);
  return res.data;
}

export async function addTicketComment(ticketId, message, internal = false) {
  const res = await api.post(`/tickets/${ticketId}/comments`, {
    message,
    internal,
  });
  return res.data;
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

/** Tarih aralığına göre dashboard özet istatistiklerini getirir. */
export async function getDashboardSummary(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await api.get('/dashboard/summary', { params });
  return res.data;
}

// ─── Çalışma Günlüğü ─────────────────────────────────────────────────────────

/** Bilete ait worklog kayıtlarını getirir. */
export async function getWorklogs(ticketId) {
  const res = await api.get(`/tickets/${ticketId}/worklogs`);
  return res.data;
}

export async function addWorklog(ticketId, { timeSpent, workDate, note }) {
  const res = await api.post(`/tickets/${ticketId}/worklogs`, { timeSpent, workDate, note });
  return res.data;
}

// ─── Hesap Ayarları ──────────────────────────────────────────────────────────

/**
 * Kullanıcının adını ve e-postasını Keycloak'ta günceller.
 * Admin API kullanılır; güncelleme sonrası storage'daki name de güncellenir.
 */
export async function updateUserProfile(firstName, lastName, email) {
  const adminToken = await getAdminToken();
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const username = getUsername();
  const userListRes = await axios.get(
    `${KEYCLOAK_ADMIN_USERS}?username=${encodeURIComponent(username)}&exact=true`,
    { headers }
  );
  const user = Array.isArray(userListRes.data) ? userListRes.data[0] : null;
  if (!user?.id) throw new Error('Kullanıcı bulunamadı.');

  await axios.put(
    `${KEYCLOAK_ADMIN_USERS}/${user.id}`,
    { firstName, lastName, email },
    { headers }
  );

  const storage = localStorage.getItem('rememberMe') === '1' ? localStorage : sessionStorage;
  storage.setItem('name', `${firstName} ${lastName}`.trim());
}

export async function changePassword(newPassword) {
  const adminToken = await getAdminToken();
  const headers = { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' };

  const username = getUsername();
  const userListRes = await axios.get(
    `${KEYCLOAK_ADMIN_USERS}?username=${encodeURIComponent(username)}&exact=true`,
    { headers }
  );
  const user = Array.isArray(userListRes.data) ? userListRes.data[0] : null;
  if (!user?.id) throw new Error('Kullanıcı bulunamadı.');

  await axios.put(
    `${KEYCLOAK_ADMIN_USERS}/${user.id}/reset-password`,
    { type: 'password', value: newPassword, temporary: false },
    { headers }
  );
}

/** Müşteri hesabını soft delete ile kapatır (Keycloak devre dışı + DB anonimleştirme). */
export async function deleteMyAccount() {
  await api.delete('/users/me');
}

// ─── AI Endpoint'leri ────────────────────────────────────────────────────────

/** Gemini'ye başlık ve açıklama göndererek önerilen önceliği (LOW/MEDIUM/HIGH/CRITICAL) alır. */
export async function suggestPriority(title, description) {
  const res = await api.post('/ai/suggest-priority', { title, description });
  return res.data.text;
}

export async function suggestReply(ticketId) {
  const res = await api.post(`/ai/suggest-reply/${ticketId}`);
  return res.data.text;
}

export async function analyzeDashboard(stats) {
  const res = await api.post('/ai/analyze-dashboard', { stats: JSON.stringify(stats) });
  return res.data.text;
}

export async function analyzeTeam(stats) {
  const res = await api.post('/ai/analyze-team', { stats: JSON.stringify(stats) });
  return res.data.text;
}

export async function analyzeSla(stats) {
  const res = await api.post('/ai/analyze-sla', { stats: JSON.stringify(stats) });
  return res.data.text;
}

export async function summarizeTicket(ticketId) {
  const res = await api.post(`/ai/summarize/${ticketId}`);
  return res.data.text;
}

export async function aiChat(message, context = '') {
  const res = await api.post('/ai/chat', { message, context });
  return res.data.text;
}

export async function findSimilarTickets(ticketId) {
  const res = await api.post(`/ai/similar-tickets/${ticketId}`);
  return res.data.text;
}

// ─── Aktivite Logu ───────────────────────────────────────────────────────────

/** Son N aktivite logu kaydını getirir (varsayılan: 20). Manager dashboard'unda kullanılır. */
export async function getRecentActivity(limit = 20) {
  const res = await api.get('/activity/recent', { params: { limit } });
  return res.data;
}

export default api;
