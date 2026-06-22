const app = document.getElementById('app');

// ---------- Simple app-wide state ----------
const state = {
  screen: 'loading',
  session: null, // { token, role, username, companyName, userId }
};

function render(html) {
  app.innerHTML = html;
}

async function init() {
  const session = await window.localState.get('session');
  if (session && session.token) {
    state.session = session;
    setAuthToken(session.token);
    goTo(dashboardScreenForRole(session.role));
  } else {
    const setupDone = await window.localState.get('setupDone');
    goTo(setupDone ? 'login' : 'agreement');
  }
}

function dashboardScreenForRole(role) {
  if (role === 'ceo') return 'ceo-dashboard';
  if (role === 'team_leader') return 'leader-dashboard';
  return 'employee-dashboard';
}

async function logout() {
  await window.localState.delete('session');
  state.session = null;
  setAuthToken(null);
  goTo('login');
}

function goTo(screen, extra = {}) {
  state.screen = screen;
  Object.assign(state, extra);
  renderScreen();
}

// ---------- Screen: License Agreement ----------
function screenAgreement() {
  render(`
    <div class="wizard-screen">
      <div class="card" style="max-width:560px;">
        <h1>Software License Agreement</h1>
        <p class="subtitle">Please read and accept the agreement to continue installation.</p>
        <div class="agreement-box">
          This Employee Management System ("Software") is provided to help organizations manage
          departments, employees, tasks, attendance, and leave records. By proceeding, you agree to
          use this Software in compliance with your organization's policies and applicable law.
          Each company that registers receives its own isolated, private database; Anthropic-free
          and unaffiliated third parties cannot access another company's data. You are responsible
          for safeguarding the login credentials you create. Continued use of this application
          constitutes acceptance of these terms.
        </div>
        <label style="display:flex;align-items:center;gap:8px;margin-top:16px;font-weight:400;">
          <input type="checkbox" id="agree-checkbox" style="width:auto;" />
          I have read and accept the agreement
        </label>
        <div class="btn-row">
          <button class="btn" id="next-btn">Next</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('next-btn').addEventListener('click', () => {
    const checked = document.getElementById('agree-checkbox').checked;
    if (!checked) {
      alert('You must accept the agreement to continue.');
      return;
    }
    goTo('role-choice');
  });
}

// ---------- Screen: Choose CEO or Employee setup ----------
function screenRoleChoice() {
  render(`
    <div class="wizard-screen">
      <div class="card">
        <h1>Setup Type</h1>
        <p class="subtitle">Are you setting this up for the first time as a company owner, or installing this for an existing company as an employee?</p>
        <div class="role-options">
          <div class="role-card" id="role-ceo">
            <h3>Setup as CEO</h3>
            <p>Register your company and create the CEO account</p>
          </div>
          <div class="role-card" id="role-employee">
            <h3>Setup as Employee</h3>
            <p>Your company already exists; you'll log in with assigned credentials</p>
          </div>
        </div>
        <div class="btn-row">
          <button class="btn secondary" id="back-btn">Back</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('back-btn').addEventListener('click', () => goTo('agreement'));
  document.getElementById('role-ceo').addEventListener('click', () => goTo('ceo-setup-company'));
  document.getElementById('role-employee').addEventListener('click', async () => {
    await window.localState.set('setupDone', true);
    goTo('login');
  });
}

// ---------- Screen: CEO setup - step 1: company name ----------
function screenCeoSetupCompany() {
  render(`
    <div class="wizard-screen">
      <div class="card">
        <h1>Company Details</h1>
        <p class="subtitle">Enter your company's name. This will be used to create your private database.</p>
        <label>Company Name</label>
        <input type="text" id="company-name" placeholder="e.g. Acme Pvt Ltd" />
        <div class="btn-row">
          <button class="btn secondary" id="back-btn">Back</button>
          <button class="btn" id="next-btn">Next</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('back-btn').addEventListener('click', () => goTo('role-choice'));
  document.getElementById('next-btn').addEventListener('click', () => {
    const companyName = document.getElementById('company-name').value.trim();
    if (!companyName) return alert('Please enter your company name.');
    goTo('ceo-setup-account', { wizardCompanyName: companyName });
  });
}

// ---------- Screen: CEO setup - step 2: account credentials ----------
function screenCeoSetupAccount() {
  render(`
    <div class="wizard-screen">
      <div class="card">
        <h1>Create Your CEO Account</h1>
        <p class="subtitle">Company: <strong>${state.wizardCompanyName}</strong></p>
        <label>Username</label>
        <input type="text" id="username" placeholder="Choose a username" />
        <label>Email</label>
        <input type="email" id="email" placeholder="you@company.com" />
        <label>Password</label>
        <input type="password" id="password" placeholder="Choose a password" />
        <div id="error-area"></div>
        <div class="btn-row">
          <button class="btn secondary" id="back-btn">Back</button>
          <button class="btn" id="finish-btn">Finish</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('back-btn').addEventListener('click', () => goTo('ceo-setup-company'));
  document.getElementById('finish-btn').addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorArea = document.getElementById('error-area');
    errorArea.innerHTML = '';

    if (!username || !email || !password) {
      errorArea.innerHTML = `<div class="error-msg">All fields are required.</div>`;
      return;
    }

    try {
      const result = await api.registerCompany({
        companyName: state.wizardCompanyName,
        username,
        email,
        password,
      });
      await window.localState.set('setupDone', true);
      goTo('ceo-setup-finish', { wizardResult: result });
    } catch (err) {
      errorArea.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ---------- Screen: CEO setup - finish ----------
function screenCeoSetupFinish() {
  render(`
    <div class="wizard-screen">
      <div class="card">
        <h1>Setup Complete</h1>
        <p class="subtitle">Your company "<strong>${state.wizardResult.companyName}</strong>" and CEO account have been created successfully.</p>
        <div class="success-msg">You can now log in using your username and password.</div>
        <div class="btn-row">
          <button class="btn" id="go-login-btn">Go to Login</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('go-login-btn').addEventListener('click', () => goTo('login'));
}

// ---------- Screen: Login (used by CEO, team leader, employee) ----------
function screenLogin() {
  render(`
    <div class="wizard-screen">
      <div class="card">
        <h1>Login</h1>
        <p class="subtitle">Enter your company name and the credentials assigned to you.</p>
        <label>Company Name</label>
        <input type="text" id="companyName" placeholder="e.g. Acme Pvt Ltd" />
        <label>Username</label>
        <input type="text" id="username" placeholder="Your username" />
        <label>Password</label>
        <input type="password" id="password" placeholder="Your password" />
        <div id="error-area"></div>
        <div class="btn-row">
          <button class="btn secondary" id="back-btn">Back</button>
          <button class="btn" id="login-btn">Login</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('back-btn').addEventListener('click', () => goTo('role-choice'));

  document.getElementById('login-btn').addEventListener('click', async () => {
    const companyName = document.getElementById('companyName').value.trim();
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorArea = document.getElementById('error-area');
    errorArea.innerHTML = '';

    if (!companyName || !username || !password) {
      errorArea.innerHTML = `<div class="error-msg">All fields are required.</div>`;
      return;
    }

    try {
      const result = await api.login({ companyName, username, password });
      const session = {
        token: result.token,
        role: result.user.role,
        username: result.user.username,
        userId: result.user.id,
        companyName: result.companyName,
      };
      await window.localState.set('session', session);
      state.session = session;
      setAuthToken(session.token);
      goTo(dashboardScreenForRole(session.role));
    } catch (err) {
      errorArea.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ---------- Shared dashboard shell ----------
function dashboardShell(activeKey, navItems, contentHtml) {
  const navHtml = navItems
    .map((item) => `<a data-key="${item.key}" class="${item.key === activeKey ? 'active' : ''}">${item.label}</a>`)
    .join('');

  render(`
    <div class="dashboard">
      <div class="sidebar">
        <div class="brand">${state.session.companyName}</div>
        <nav>${navHtml}</nav>
        <div class="logout" id="logout-btn">Logout (${state.session.username})</div>
      </div>
      <div class="main-content" id="main-content">${contentHtml}</div>
    </div>
  `);

  document.getElementById('logout-btn').addEventListener('click', logout);
  navItems.forEach((item) => {
    document.querySelector(`[data-key="${item.key}"]`).addEventListener('click', item.onClick);
  });
}

// ---------- Shared: Notifications tab (used by all three dashboards) ----------
async function getUnreadNotificationCount() {
  try {
    const { unreadCount } = await api.listNotifications();
    return unreadCount;
  } catch (err) {
    return 0;
  }
}

function notificationNavLabel(unreadCount) {
  return unreadCount > 0 ? `Notifications <span class="badge pending" style="margin-left:4px;">${unreadCount}</span>` : 'Notifications';
}

async function renderNotificationsTab(refreshFn) {
  const { notifications } = await api.listNotifications();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Notifications</h2>
      <button class="btn secondary" id="mark-all-read-btn">Mark all as read</button>
    </div>
    <table>
      <thead><tr><th>Message</th><th>Type</th><th>When</th><th></th></tr></thead>
      <tbody>
        ${notifications.map(n => `
          <tr style="${n.isRead ? '' : 'font-weight:600;background:#f7f9ff;'}">
            <td>${n.message}</td>
            <td><span class="badge in_progress">${n.type.replace(/_/g, ' ')}</span></td>
            <td>${new Date(n.createdAt).toLocaleString()}</td>
            <td>${n.isRead ? '' : `<button class="btn" data-id="${n._id}" style="padding:4px 10px;font-size:12px;">Mark read</button>`}</td>
          </tr>`).join('') || '<tr><td colspan="4">No notifications yet.</td></tr>'}
      </tbody>
    </table>
  `;

  main.querySelectorAll('button[data-id]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      await api.markNotificationRead(btn.dataset.id);
      await refreshFn();
    });
  });

  document.getElementById('mark-all-read-btn').addEventListener('click', async () => {
    await api.markAllNotificationsRead();
    await refreshFn();
  });
}

// ---------- CEO Dashboard ----------
let ceoActiveTab = 'departments';

async function screenCeoDashboard() {
  const unreadCount = await getUnreadNotificationCount();
  const navItems = [
    { key: 'departments', label: 'Departments', onClick: () => { ceoActiveTab = 'departments'; screenCeoDashboard(); } },
    { key: 'employees', label: 'All Employees', onClick: () => { ceoActiveTab = 'employees'; screenCeoDashboard(); } },
    { key: 'tasks', label: 'All Tasks', onClick: () => { ceoActiveTab = 'tasks'; screenCeoDashboard(); } },
    { key: 'leaves', label: 'Leave Requests', onClick: () => { ceoActiveTab = 'leaves'; screenCeoDashboard(); } },
    { key: 'notifications', label: notificationNavLabel(unreadCount), onClick: () => { ceoActiveTab = 'notifications'; screenCeoDashboard(); } },
  ];

  dashboardShell(ceoActiveTab, navItems, `<p>Loading...</p>`);

  if (ceoActiveTab === 'departments') await renderCeoDepartments();
  else if (ceoActiveTab === 'employees') await renderCeoEmployees();
  else if (ceoActiveTab === 'tasks') await renderCeoTasks();
  else if (ceoActiveTab === 'leaves') await renderCeoLeaves();
  else if (ceoActiveTab === 'notifications') await renderNotificationsTab(screenCeoDashboard);
}

async function renderCeoDepartments() {
  const { departments } = await api.listDepartments();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Departments</h2>
      <button class="btn" id="add-dept-btn">+ New Department</button>
    </div>
    <table>
      <thead><tr><th>Department</th><th>Team Leader</th><th>Email</th></tr></thead>
      <tbody>
        ${departments.map(d => `<tr><td>${d.name}</td><td>${d.teamLeader ? d.teamLeader.username : '-'}</td><td>${d.teamLeader ? (d.teamLeader.email||'') : ''}</td></tr>`).join('') || '<tr><td colspan="3">No departments yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('add-dept-btn').addEventListener('click', showAddDepartmentModal);
}

function showAddDepartmentModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:420px;">
      <h1>New Department</h1>
      <p class="subtitle">Create a department and its team leader's login.</p>
      <label>Department Name</label>
      <input type="text" id="dept-name" placeholder="e.g. QA, Frontend, UI/UX" />
      <label>Team Leader Username</label>
      <input type="text" id="leader-username" />
      <label>Team Leader Email</label>
      <input type="email" id="leader-email" />
      <label>Team Leader Password</label>
      <input type="password" id="leader-password" />
      <div id="modal-error"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel-btn">Cancel</button>
        <button class="btn" id="create-btn">Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#create-btn').addEventListener('click', async () => {
    const departmentName = overlay.querySelector('#dept-name').value.trim();
    const leaderUsername = overlay.querySelector('#leader-username').value.trim();
    const leaderEmail = overlay.querySelector('#leader-email').value.trim();
    const leaderPassword = overlay.querySelector('#leader-password').value;
    const errorEl = overlay.querySelector('#modal-error');

    try {
      await api.createDepartment({ departmentName, leaderUsername, leaderEmail, leaderPassword });
      overlay.remove();
      await renderCeoDepartments();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

async function renderCeoEmployees() {
  const { employees } = await api.listEmployees();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <h2>All Employees</h2>
    <table>
      <thead><tr><th>Username</th><th>Full Name</th><th>Department</th></tr></thead>
      <tbody>
        ${employees.map(e => `<tr><td>${e.username}</td><td>${e.fullName||''}</td><td>${e.department ? e.department.name : '-'}</td></tr>`).join('') || '<tr><td colspan="3">No employees yet.</td></tr>'}
      </tbody>
    </table>
  `;
}

async function renderCeoTasks() {
  const { tasks } = await api.listTasks();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <h2>All Tasks</h2>
    <table>
      <thead><tr><th>Title</th><th>Assigned To</th><th>Assigned By</th><th>Status</th></tr></thead>
      <tbody>
        ${tasks.map(t => `<tr><td>${t.title}</td><td>${t.assignedTo ? t.assignedTo.username : '-'}</td><td>${t.assignedBy ? t.assignedBy.username : '-'}</td><td><span class="badge ${t.status}">${t.status}</span></td></tr>`).join('') || '<tr><td colspan="4">No tasks yet.</td></tr>'}
      </tbody>
    </table>
  `;
}

async function renderCeoLeaves() {
  const { leaves } = await api.listLeaves();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <h2>Leave Requests</h2>
    <table>
      <thead><tr><th>Employee</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${leaves.map(l => `
          <tr>
            <td>${l.user ? l.user.username : '-'}</td>
            <td>${new Date(l.fromDate).toLocaleDateString()}</td>
            <td>${new Date(l.toDate).toLocaleDateString()}</td>
            <td>${l.reason||''}</td>
            <td><span class="badge ${l.status}">${l.status}</span></td>
            <td>${l.status === 'pending' ? `<button class="btn" data-id="${l._id}" data-action="approved" style="padding:5px 10px;font-size:12px;">Approve</button> <button class="btn danger" data-id="${l._id}" data-action="rejected" style="padding:5px 10px;font-size:12px;">Reject</button>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="6">No leave requests.</td></tr>'}
      </tbody>
    </table>
  `;
  main.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.reviewLeave(btn.dataset.id, btn.dataset.action);
      await renderCeoLeaves();
    });
  });
}

// ---------- Team Leader Dashboard ----------
let leaderActiveTab = 'team';

async function screenLeaderDashboard() {
  const unreadCount = await getUnreadNotificationCount();
  const navItems = [
    { key: 'team', label: 'My Team', onClick: () => { leaderActiveTab = 'team'; screenLeaderDashboard(); } },
    { key: 'tasks', label: 'Tasks', onClick: () => { leaderActiveTab = 'tasks'; screenLeaderDashboard(); } },
    { key: 'leaves', label: 'Leave Requests', onClick: () => { leaderActiveTab = 'leaves'; screenLeaderDashboard(); } },
    { key: 'notifications', label: notificationNavLabel(unreadCount), onClick: () => { leaderActiveTab = 'notifications'; screenLeaderDashboard(); } },
  ];

  dashboardShell(leaderActiveTab, navItems, `<p>Loading...</p>`);

  if (leaderActiveTab === 'team') await renderLeaderTeam();
  else if (leaderActiveTab === 'tasks') await renderLeaderTasks();
  else if (leaderActiveTab === 'leaves') await renderLeaderLeaves();
  else if (leaderActiveTab === 'notifications') await renderNotificationsTab(screenLeaderDashboard);
}

async function renderLeaderTeam() {
  const { employees } = await api.listEmployees();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>My Team</h2>
      <button class="btn" id="add-emp-btn">+ Add Employee</button>
    </div>
    <table>
      <thead><tr><th>Username</th><th>Full Name</th></tr></thead>
      <tbody>
        ${employees.map(e => `<tr><td>${e.username}</td><td>${e.fullName||''}</td></tr>`).join('') || '<tr><td colspan="2">No team members yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('add-emp-btn').addEventListener('click', showAddEmployeeModal);
}

function showAddEmployeeModal() {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:420px;">
      <h1>Add Employee</h1>
      <label>Full Name</label>
      <input type="text" id="emp-fullname" />
      <label>Username</label>
      <input type="text" id="emp-username" />
      <label>Email</label>
      <input type="email" id="emp-email" />
      <label>Password</label>
      <input type="password" id="emp-password" />
      <div id="modal-error"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel-btn">Cancel</button>
        <button class="btn" id="create-btn">Create</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#create-btn').addEventListener('click', async () => {
    const fullName = overlay.querySelector('#emp-fullname').value.trim();
    const username = overlay.querySelector('#emp-username').value.trim();
    const email = overlay.querySelector('#emp-email').value.trim();
    const password = overlay.querySelector('#emp-password').value;
    const errorEl = overlay.querySelector('#modal-error');
    try {
      await api.addEmployee({ fullName, username, email, password });
      overlay.remove();
      await renderLeaderTeam();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

async function renderLeaderTasks() {
  const [{ tasks }, { employees }] = await Promise.all([api.listTasks(), api.listEmployees()]);
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Department Tasks</h2>
      <button class="btn" id="add-task-btn">+ Assign Task</button>
    </div>
    <table>
      <thead><tr><th>Title</th><th>Assigned To</th><th>Status</th><th>Due</th></tr></thead>
      <tbody>
        ${tasks.map(t => `<tr><td>${t.title}</td><td>${t.assignedTo ? t.assignedTo.username : '-'}</td><td><span class="badge ${t.status}">${t.status}</span></td><td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</td></tr>`).join('') || '<tr><td colspan="4">No tasks yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('add-task-btn').addEventListener('click', () => showAssignTaskModal(employees, renderLeaderTasks));
}

function showAssignTaskModal(employees, refreshFn) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:420px;">
      <h1>Assign Task</h1>
      <label>Title</label>
      <input type="text" id="task-title" />
      <label>Description</label>
      <textarea id="task-desc" rows="3"></textarea>
      <label>Assign To</label>
      <select id="task-assignee">
        ${employees.map(e => `<option value="${e._id}">${e.username}</option>`).join('')}
      </select>
      <label>Due Date</label>
      <input type="date" id="task-due" />
      <div id="modal-error"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel-btn">Cancel</button>
        <button class="btn" id="create-btn">Assign</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#create-btn').addEventListener('click', async () => {
    const title = overlay.querySelector('#task-title').value.trim();
    const description = overlay.querySelector('#task-desc').value.trim();
    const assignedTo = overlay.querySelector('#task-assignee').value;
    const dueDate = overlay.querySelector('#task-due').value;
    const errorEl = overlay.querySelector('#modal-error');
    try {
      await api.createTask({ title, description, assignedTo, dueDate });
      overlay.remove();
      await refreshFn();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

async function renderLeaderLeaves() {
  const { leaves } = await api.listLeaves();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <h2>Leave Requests</h2>
    <table>
      <thead><tr><th>Employee</th><th>From</th><th>To</th><th>Reason</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${leaves.map(l => `
          <tr>
            <td>${l.user ? l.user.username : '-'}</td>
            <td>${new Date(l.fromDate).toLocaleDateString()}</td>
            <td>${new Date(l.toDate).toLocaleDateString()}</td>
            <td>${l.reason||''}</td>
            <td><span class="badge ${l.status}">${l.status}</span></td>
            <td>${l.status === 'pending' ? `<button class="btn" data-id="${l._id}" data-action="approved" style="padding:5px 10px;font-size:12px;">Approve</button> <button class="btn danger" data-id="${l._id}" data-action="rejected" style="padding:5px 10px;font-size:12px;">Reject</button>` : ''}</td>
          </tr>`).join('') || '<tr><td colspan="6">No leave requests.</td></tr>'}
      </tbody>
    </table>
  `;
  main.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      await api.reviewLeave(btn.dataset.id, btn.dataset.action);
      await renderLeaderLeaves();
    });
  });
}

// ---------- Employee Dashboard ----------
let employeeActiveTab = 'tasks';

async function screenEmployeeDashboard() {
  const unreadCount = await getUnreadNotificationCount();
  const navItems = [
    { key: 'tasks', label: 'My Tasks', onClick: () => { employeeActiveTab = 'tasks'; screenEmployeeDashboard(); } },
    { key: 'attendance', label: 'Attendance', onClick: () => { employeeActiveTab = 'attendance'; screenEmployeeDashboard(); } },
    { key: 'leaves', label: 'My Leaves', onClick: () => { employeeActiveTab = 'leaves'; screenEmployeeDashboard(); } },
    { key: 'notifications', label: notificationNavLabel(unreadCount), onClick: () => { employeeActiveTab = 'notifications'; screenEmployeeDashboard(); } },
  ];

  dashboardShell(employeeActiveTab, navItems, `<p>Loading...</p>`);

  if (employeeActiveTab === 'tasks') await renderEmployeeTasks();
  else if (employeeActiveTab === 'attendance') await renderEmployeeAttendance();
  else if (employeeActiveTab === 'leaves') await renderEmployeeLeaves();
  else if (employeeActiveTab === 'notifications') await renderNotificationsTab(screenEmployeeDashboard);
}

async function renderEmployeeTasks() {
  const { tasks } = await api.listTasks();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <h2>My Tasks</h2>
    <table>
      <thead><tr><th>Title</th><th>Description</th><th>Due</th><th>Status</th></tr></thead>
      <tbody>
        ${tasks.map(t => `
          <tr>
            <td>${t.title}</td>
            <td>${t.description||''}</td>
            <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</td>
            <td>
              <select data-id="${t._id}" class="status-select">
                ${['pending','in_progress','completed','blocked'].map(s => `<option value="${s}" ${s===t.status?'selected':''}>${s}</option>`).join('')}
              </select>
            </td>
          </tr>`).join('') || '<tr><td colspan="4">No tasks assigned yet.</td></tr>'}
      </tbody>
    </table>
  `;
  main.querySelectorAll('.status-select').forEach(sel => {
    sel.addEventListener('change', async () => {
      await api.updateTaskStatus(sel.dataset.id, sel.value);
      await renderEmployeeTasks();
    });
  });
}

async function renderEmployeeAttendance() {
  const { records } = await api.myAttendance();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Attendance</h2>
      <div>
        <button class="btn" id="checkin-btn">Check In</button>
        <button class="btn secondary" id="checkout-btn">Check Out</button>
      </div>
    </div>
    <table>
      <thead><tr><th>Date</th><th>Check In</th><th>Check Out</th><th>Status</th></tr></thead>
      <tbody>
        ${records.map(r => `<tr><td>${r.date}</td><td>${r.checkIn ? new Date(r.checkIn).toLocaleTimeString() : '-'}</td><td>${r.checkOut ? new Date(r.checkOut).toLocaleTimeString() : '-'}</td><td>${r.status}</td></tr>`).join('') || '<tr><td colspan="4">No records yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('checkin-btn').addEventListener('click', async () => {
    try { await api.checkIn(); await renderEmployeeAttendance(); } catch (err) { alert(err.message); }
  });
  document.getElementById('checkout-btn').addEventListener('click', async () => {
    try { await api.checkOut(); await renderEmployeeAttendance(); } catch (err) { alert(err.message); }
  });
}

async function renderEmployeeLeaves() {
  const { leaves } = await api.listLeaves();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>My Leave Requests</h2>
      <button class="btn" id="request-leave-btn">+ Request Leave</button>
    </div>
    <table>
      <thead><tr><th>From</th><th>To</th><th>Reason</th><th>Status</th></tr></thead>
      <tbody>
        ${leaves.map(l => `<tr><td>${new Date(l.fromDate).toLocaleDateString()}</td><td>${new Date(l.toDate).toLocaleDateString()}</td><td>${l.reason||''}</td><td><span class="badge ${l.status}">${l.status}</span></td></tr>`).join('') || '<tr><td colspan="4">No leave requests yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('request-leave-btn').addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="card" style="max-width:400px;">
        <h1>Request Leave</h1>
        <label>From</label>
        <input type="date" id="leave-from" />
        <label>To</label>
        <input type="date" id="leave-to" />
        <label>Reason</label>
        <textarea id="leave-reason" rows="3"></textarea>
        <div id="modal-error"></div>
        <div class="btn-row">
          <button class="btn secondary" id="cancel-btn">Cancel</button>
          <button class="btn" id="submit-btn">Submit</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#submit-btn').addEventListener('click', async () => {
      const fromDate = overlay.querySelector('#leave-from').value;
      const toDate = overlay.querySelector('#leave-to').value;
      const reason = overlay.querySelector('#leave-reason').value.trim();
      const errorEl = overlay.querySelector('#modal-error');
      try {
        await api.requestLeave({ fromDate, toDate, reason });
        overlay.remove();
        await renderEmployeeLeaves();
      } catch (err) {
        errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
      }
    });
  });
}

// ---------- Router ----------
function renderScreen() {
  switch (state.screen) {
    case 'agreement': return screenAgreement();
    case 'role-choice': return screenRoleChoice();
    case 'ceo-setup-company': return screenCeoSetupCompany();
    case 'ceo-setup-account': return screenCeoSetupAccount();
    case 'ceo-setup-finish': return screenCeoSetupFinish();
    case 'login': return screenLogin();
    case 'ceo-dashboard': return screenCeoDashboard();
    case 'leader-dashboard': return screenLeaderDashboard();
    case 'employee-dashboard': return screenEmployeeDashboard();
    default: return render('<p>Loading...</p>');
  }
}

init();
