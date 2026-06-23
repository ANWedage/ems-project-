// IMPORTANT: replace this with your live Render backend URL before building
// the installer, e.g. 'https://ems-project-xxxx.onrender.com/api'
// Use 'http://localhost:5000/api' only while testing locally.
const API_BASE_URL = 'https://ems-project-p5x9.onrender.com/api';

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

  // Users (CEO manages)
  createUser: (payload) => apiRequest('/users', { method: 'POST', body: payload, auth: true }),
  listUsers: () => apiRequest('/users', { auth: true }),
  searchUsers: (q) => apiRequest(`/users/search?q=${encodeURIComponent(q)}`, { auth: true }),
  updateUser: (id, payload) => apiRequest(`/users/${id}`, { method: 'PUT', body: payload, auth: true }),
  deleteUser: (id) => apiRequest(`/users/${id}`, { method: 'DELETE', auth: true }),
  toggleUserActive: (id) => apiRequest(`/users/${id}/toggle-active`, { method: 'PATCH', auth: true }),
  getMe: () => apiRequest('/users/me', { auth: true }),

  // Departments
  createDepartment: (payload) => apiRequest('/departments', { method: 'POST', body: payload, auth: true }),
  updateDepartment: (id, payload) => apiRequest(`/departments/${id}`, { method: 'PUT', body: payload, auth: true }),
  listDepartments: () => apiRequest('/departments', { auth: true }),
  deleteDepartment: (id) => apiRequest(`/departments/${id}`, { method: 'DELETE', auth: true }),

  // Employees (team leader)
  addEmployee: (payload) => apiRequest('/employees', { method: 'POST', body: payload, auth: true }),
  listEmployees: () => apiRequest('/employees', { auth: true }),
  searchAllEmployees: (q) => apiRequest(`/employees/search?q=${encodeURIComponent(q)}`, { auth: true }),
  addEmployeeToTeam: (employeeId) => apiRequest('/employees/add-to-team', { method: 'POST', body: { employeeId }, auth: true }),
  removeEmployeeFromTeam: (id) => apiRequest(`/employees/${id}/remove-from-team`, { method: 'DELETE', auth: true }),

  createTask: (payload) => apiRequest('/tasks', { method: 'POST', body: payload, auth: true }),
  createCompanyTask: (payload) => apiRequest('/tasks/company', { method: 'POST', body: payload, auth: true }),
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

  // Notices (CEO sends, all roles view)
  createNotice: (payload) => apiRequest('/notices', { method: 'POST', body: payload, auth: true }),
  listNotices: () => apiRequest('/notices', { auth: true }),
  deleteNotice: (noticeId) => apiRequest(`/notices/${noticeId}`, { method: 'DELETE', auth: true }),

  // Concerns (public submit, CEO views)
  submitConcern: (payload) => apiRequest('/concerns', { method: 'POST', body: payload }),
  listConcerns: () => apiRequest('/concerns', { auth: true }),
  updateConcernStatus: (concernId, status) => apiRequest(`/concerns/${concernId}/status`, { method: 'PATCH', body: { status }, auth: true }),
  deleteConcern: (concernId) => apiRequest(`/concerns/${concernId}`, { method: 'DELETE', auth: true }),

  // Complaints (logged-in employees/team leaders submit, CEO reviews)
  submitComplaint: (payload) => apiRequest('/complaints', { method: 'POST', body: payload, auth: true }),
  myComplaints: () => apiRequest('/complaints/mine', { auth: true }),
  listComplaints: () => apiRequest('/complaints', { auth: true }),
  updateComplaint: (complaintId, payload) => apiRequest(`/complaints/${complaintId}`, { method: 'PATCH', body: payload, auth: true }),
  deleteComplaint: (complaintId) => apiRequest(`/complaints/${complaintId}`, { method: 'DELETE', auth: true }),

  // My leaves (team leader viewing own leave requests)
  myLeaves: () => apiRequest('/leaves?mine=true', { auth: true }),

  // CEO: all attendance, optionally ?userId=&from=&to=
  getAllAttendance: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return apiRequest(`/attendance/all${qs ? '?' + qs : ''}`, { auth: true });
  },
};
