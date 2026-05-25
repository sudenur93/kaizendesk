import axios from 'axios';

// Production'da env var'dan gelir, dev'de Vite proxy üzerinden çalışır
const _API_URL   = import.meta.env.VITE_API_URL   || '';
const _KC_URL    = import.meta.env.VITE_KEYCLOAK_URL || '';

const API_BASE           = _API_URL  ? `${_API_URL}/api/v1`   : '/api/v1';
const KEYCLOAK_BASE      = _KC_URL   ? `${_KC_URL}/realms/kaizendesk/protocol/openid-connect` : '/auth/realms/kaizendesk/protocol/openid-connect';
const KEYCLOAK_ADMIN_TOKEN = _KC_URL ? `${_KC_URL}/realms/master/protocol/openid-connect/token` : '/auth/realms/master/protocol/openid-connect/token';
const KEYCLOAK_ADMIN_USERS = _KC_URL ? `${_KC_URL}/admin/realms/kaizendesk/users` : '/auth/admin/realms/kaizendesk/users';
const CLIENT_ID = 'kaizendesk-app';

const api = axios.create({ baseURL: API_BASE });

// "Beni hatırla" seçiliyse localStorage, değilse sessionStorage kullan
function getStorage() {
  return localStorage.getItem('rememberMe') === '1' ? localStorage : sessionStorage;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token') || sessionStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      localStorage.clear();
      sessionStorage.clear();
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(err);
  }
);

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
  if (!remember) localStorage.clear(); // önceki kalıcı oturumu temizle

  storage.setItem('token', token);
  storage.setItem('refreshToken', refreshToken);
  storage.setItem('role', role);
  storage.setItem('username', payload.preferred_username);
  storage.setItem('name', payload.name || payload.preferred_username);

  return { token, role, username: payload.preferred_username, name: payload.name };
}

const KEYCLOAK_ADMIN_REALM = _KC_URL ? `${_KC_URL}/admin/realms/kaizendesk` : '/auth/admin/realms/kaizendesk';

export async function register(username, password, email, firstName, lastName, role = 'CUSTOMER') {
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
      enabled: false, // admin onayı bekliyor
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

  const roleRes = await axios.get(`${KEYCLOAK_ADMIN_REALM}/roles/${role}`, {
    headers: authHeaders,
  });
  await axios.post(
    `${KEYCLOAK_ADMIN_REALM}/users/${newUser.id}/role-mappings/realm`,
    [roleRes.data],
    { headers: authHeaders }
  );
}

export function logout() {
  localStorage.clear();
  sessionStorage.clear();
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

export async function getPendingUsers() {
  const token = await getAdminToken();
  const res = await axios.get(`${KEYCLOAK_ADMIN_USERS}?enabled=false&max=50`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return res.data || [];
}

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

export async function getDashboardSummary(from, to) {
  const params = {};
  if (from) params.from = from;
  if (to) params.to = to;
  const res = await api.get('/dashboard/summary', { params });
  return res.data;
}

export async function getWorklogs(ticketId) {
  const res = await api.get(`/tickets/${ticketId}/worklogs`);
  return res.data;
}

export async function addWorklog(ticketId, { timeSpent, workDate, note }) {
  const res = await api.post(`/tickets/${ticketId}/worklogs`, { timeSpent, workDate, note });
  return res.data;
}

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

export async function getRecentActivity(limit = 20) {
  const res = await api.get('/activity/recent', { params: { limit } });
  return res.data;
}

export default api;
