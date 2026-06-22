// IMPORTANT: replace this with your live Render backend URL before building
// the installer, e.g. 'https://ems-project-xxxx.onrender.com/api'
// Use 'http://localhost:5000/api' only while testing locally.
const API_BASE_URL = 'https://YOUR-RENDER-URL-HERE.onrender.com/api';

let authToken = null;

function setAuthToken(token) {
  authToken = token;
}

async function apiRequest(path, { method = 'GET', body, auth = false } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth && authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.message || `Request failed (${res.status})`);
  }
  return data;
}

const api = {
  registerCompany: (payload) => apiRequest('/auth/register-company', { method: 'POST', body: payload }),
  login: (payload) => apiRequest('/auth/login', { method: 'POST', body: payload }),
  companyExists: (companyName) => apiRequest(`/auth/company-exists?companyName=${encodeURIComponent(companyName)}`),

  createDepartment: (payload) => apiRequest('/departments', { method: 'POST', body: payload, auth: true }),
  listDepartments: () => apiRequest('/departments', { auth: true }),

  addEmployee: (payload) => apiRequest('/employees', { method: 'POST', body: payload, auth: true }),
  listEmployees: () => apiRequest('/employees', { auth: true }),

  createTask: (payload) => apiRequest('/tasks', { method: 'POST', body: payload, auth: true }),
  listTasks: () => apiRequest('/tasks', { auth: true }),
  updateTaskStatus: (taskId, status) => apiRequest(`/tasks/${taskId}/status`, { method: 'PATCH', body: { status }, auth: true }),

  checkIn: () => apiRequest('/attendance/check-in', { method: 'POST', auth: true }),
  checkOut: () => apiRequest('/attendance/check-out', { method: 'POST', auth: true }),
  myAttendance: () => apiRequest('/attendance', { auth: true }),

  requestLeave: (payload) => apiRequest('/leaves', { method: 'POST', body: payload, auth: true }),
  listLeaves: () => apiRequest('/leaves', { auth: true }),
  reviewLeave: (leaveId, status) => apiRequest(`/leaves/${leaveId}/review`, { method: 'PATCH', body: { status }, auth: true }),

  listNotifications: () => apiRequest('/notifications', { auth: true }),
  markNotificationRead: (notificationId) => apiRequest(`/notifications/${notificationId}/read`, { method: 'PATCH', auth: true }),
  markAllNotificationsRead: () => apiRequest('/notifications/read-all', { method: 'PATCH', auth: true }),
};
