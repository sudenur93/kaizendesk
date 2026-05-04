import axios from 'axios';

const API_BASE = '/api/v1';
const KEYCLOAK_BASE = '/auth/realms/kaizendesk/protocol/openid-connect';
const KEYCLOAK_ADMIN_TOKEN = '/auth/realms/master/protocol/openid-connect/token';
const KEYCLOAK_ADMIN_USERS = '/auth/admin/realms/kaizendesk/users';
const CLIENT_ID = 'kaizendesk-app';

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
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
      if (!window.location.pathname.startsWith('/login')) {
        window.location.href = '/login?expired=1';
      }
    }
    return Promise.reject(err);
  }
);

export async function login(username, password) {
  const params = new URLSearchParams();
  params.append('client_id', CLIENT_ID);
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);

  const res = await axios.post(`${KEYCLOAK_BASE}/token`, params);
  const token = res.data.access_token;
  const refreshToken = res.data.refresh_token;

  const payload = JSON.parse(atob(token.split('.')[1]));
  const realmRoles = payload.realm_access?.roles || [];

  let role = 'CUSTOMER';
  if (realmRoles.includes('MANAGER')) role = 'MANAGER';
  else if (realmRoles.includes('AGENT')) role = 'AGENT';

  localStorage.setItem('token', token);
  localStorage.setItem('refreshToken', refreshToken);
  localStorage.setItem('role', role);
  localStorage.setItem('username', payload.preferred_username);
  localStorage.setItem('name', payload.name || payload.preferred_username);

  return { token, role, username: payload.preferred_username, name: payload.name };
}

const KEYCLOAK_ADMIN_REALM = '/auth/admin/realms/kaizendesk';

export async function register(username, password, email, firstName, lastName) {
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
      enabled: true,
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

  const roleRes = await axios.get(`${KEYCLOAK_ADMIN_REALM}/roles/CUSTOMER`, {
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
  window.location.href = '/login';
}

export function getRole() {
  return localStorage.getItem('role');
}

export function getUsername() {
  return localStorage.getItem('username');
}

export function getName() {
  return localStorage.getItem('name');
}

export function isLoggedIn() {
  return !!localStorage.getItem('token');
}

export async function getCurrentUserProfile() {
  const res = await api.get('/users/me');
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

export default api;
