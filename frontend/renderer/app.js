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
        <div id="error-area"></div>
        <div class="btn-row">
          <button class="btn secondary" id="back-btn">Back</button>
          <button class="btn" id="next-btn">Next</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById('back-btn').addEventListener('click', () => goTo('role-choice'));
  document.getElementById('next-btn').addEventListener('click', async () => {
    const companyName = document.getElementById('company-name').value.trim();
    const errorArea = document.getElementById('error-area');
    const nextBtn = document.getElementById('next-btn');
    errorArea.innerHTML = '';

    if (!companyName) {
      errorArea.innerHTML = `<div class="error-msg">Please enter your company name.</div>`;
      return;
    }

    nextBtn.disabled = true;
    nextBtn.textContent = 'Checking...';
    try {
      const { exists } = await api.companyExists(companyName);
      if (exists) {
        errorArea.innerHTML = `<div class="error-msg">A company with this name is already registered. Please choose a different name.</div>`;
        return;
      }
      goTo('ceo-setup-account', { wizardCompanyName: companyName });
    } catch (err) {
      errorArea.innerHTML = `<div class="error-msg">${err.message}</div>`;
    } finally {
      nextBtn.disabled = false;
      nextBtn.textContent = 'Next';
    }
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
function dashboardShell(activeKey, navItems, contentHtml, subtitle = '') {
  const navHtml = navItems
    .map((item) => `<a data-key="${item.key}" class="${item.key === activeKey ? 'active' : ''}">${item.label}</a>`)
    .join('');

  render(`
    <div class="dashboard">
      <div class="sidebar">
        <div class="brand-block">
          <div class="brand">${state.session.companyName}</div>
          ${subtitle ? `<div class="brand-subtitle">${subtitle}</div>` : ''}
        </div>
        <nav>${navHtml}</nav>
        <div class="logout-block">
          <div class="logout" id="logout-btn" title="Log out of ${state.session.username}">
            <span class="logout-icon">⏻</span>
            <span>Logout (${state.session.username})</span>
          </div>
        </div>
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

// Looks up the department the logged-in team leader manages, by name.
// Used to show "Team Leader · <Department>" context in the sidebar.
async function getMyDepartmentName() {
  if (state.session.role !== 'team_leader') return '';
  try {
    const { departments } = await api.listDepartments();
    const mine = departments.find((d) => d.teamLeader && d.teamLeader._id === state.session.userId);
    return mine ? mine.name : '';
  } catch (err) {
    return '';
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
let ceoActiveTab = 'manage-employees';

async function screenCeoDashboard() {
  const unreadCount = await getUnreadNotificationCount();
  const navItems = [
    { key: 'manage-employees', label: 'Manage Employees', onClick: () => { ceoActiveTab = 'manage-employees'; screenCeoDashboard(); } },
    { key: 'departments', label: 'Departments', onClick: () => { ceoActiveTab = 'departments'; screenCeoDashboard(); } },
    { key: 'tasks', label: 'Department Tasks', onClick: () => { ceoActiveTab = 'tasks'; screenCeoDashboard(); } },
    { key: 'leaves', label: 'Leave Requests', onClick: () => { ceoActiveTab = 'leaves'; screenCeoDashboard(); } },
    { key: 'notifications', label: notificationNavLabel(unreadCount), onClick: () => { ceoActiveTab = 'notifications'; screenCeoDashboard(); } },
  ];

  dashboardShell(ceoActiveTab, navItems, `<p>Loading...</p>`, 'CEO');

  if (ceoActiveTab === 'manage-employees') await renderManageEmployees();
  else if (ceoActiveTab === 'departments') await renderCeoDepartments();
  else if (ceoActiveTab === 'tasks') await renderCeoTasks();
  else if (ceoActiveTab === 'leaves') await renderCeoLeaves();
  else if (ceoActiveTab === 'notifications') await renderNotificationsTab(screenCeoDashboard);
}

// ---- Manage Employees (CEO) ----
async function renderManageEmployees() {
  const { users } = await api.listUsers();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Manage Employees</h2>
      <button class="btn" id="add-user-btn">+ Add User</button>
    </div>
    <table>
      <thead>
        <tr>
          <th>Full Name</th>
          <th>Username</th>
          <th>Email</th>
          <th>Contact</th>
          <th>Role</th>
          <th>Department(s)</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users.map(u => `
          <tr class="${u.isTeamLeader ? 'leader-row' : ''}">
            <td>
              ${u.fullName || ''}
              ${u.isTeamLeader ? '<span class="leader-badge">Team Leader</span>' : ''}
            </td>
            <td>${u.username}</td>
            <td>${u.email || '-'}</td>
            <td>${u.contact || '-'}</td>
            <td>${u.role === 'team_leader' ? 'Team Leader' : 'Employee'}</td>
            <td>${renderDepartmentBadges(u.departments && u.departments.length ? u.departments : (u.department ? [u.department] : []))}</td>
            <td><span class="badge ${u.isActive ? 'active-badge' : 'inactive-badge'}">${u.isActive ? 'Active' : 'Inactive'}</span></td>
            <td class="action-cell">
              <button class="btn-icon edit-user-btn" data-id="${u._id}" title="Edit">✏️</button>
              <button class="btn-icon toggle-btn ${u.isActive ? 'btn-warn' : 'btn-ok'}" data-id="${u._id}" data-active="${u.isActive}" title="${u.isActive ? 'Deactivate' : 'Activate'}">
                ${u.isActive ? '🔒' : '🔓'}
              </button>
              <button class="btn-icon btn-del delete-user-btn" data-id="${u._id}" data-name="${u.fullName || u.username}" title="Delete">🗑️</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="8">No users yet. Add your first user above.</td></tr>'}
      </tbody>
    </table>
  `;

  document.getElementById('add-user-btn').addEventListener('click', () => showUserModal(null, renderManageEmployees));

  main.querySelectorAll('.edit-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = users.find(u => u._id === btn.dataset.id);
      if (user) showUserModal(user, renderManageEmployees);
    });
  });

  main.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const isActive = btn.dataset.active === 'true';
      if (!confirm(`${isActive ? 'Deactivate' : 'Activate'} this user?`)) return;
      try {
        await api.toggleUserActive(btn.dataset.id);
        await renderManageEmployees();
      } catch (err) { alert(err.message); }
    });
  });

  main.querySelectorAll('.delete-user-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete user "${btn.dataset.name}"? This cannot be undone.`)) return;
      try {
        await api.deleteUser(btn.dataset.id);
        await renderManageEmployees();
      } catch (err) { alert(err.message); }
    });
  });
}

function showUserModal(existingUser, refreshFn) {
  const isEdit = !!existingUser;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:440px;">
      <h1>${isEdit ? 'Edit User' : 'Add New User'}</h1>
      <label>Full Name *</label>
      <input type="text" id="u-fullname" value="${isEdit ? (existingUser.fullName || '') : ''}" placeholder="Full Name" />
      <label>Email</label>
      <input type="email" id="u-email" value="${isEdit ? (existingUser.email || '') : ''}" placeholder="email@company.com" />
      <label>Username *</label>
      <input type="text" id="u-username" value="${isEdit ? existingUser.username : ''}" placeholder="username" />
      <label>Password ${isEdit ? '(leave blank to keep current)' : '*'}</label>
      <div class="password-field">
        <input type="password" id="u-password" placeholder="${isEdit ? 'New password (optional)' : 'Password'}" />
        <button type="button" class="password-toggle-btn" data-target="u-password" title="Show/hide password">👁️</button>
      </div>
      <label>Confirm Password ${isEdit ? '' : '*'}</label>
      <div class="password-field">
        <input type="password" id="u-password-confirm" placeholder="${isEdit ? 'Confirm new password' : 'Re-enter password'}" />
        <button type="button" class="password-toggle-btn" data-target="u-password-confirm" title="Show/hide password">👁️</button>
      </div>
      <label>Contact</label>
      <input type="text" id="u-contact" value="${isEdit ? (existingUser.contact || '') : ''}" placeholder="+94 77 123 4567" />
      <div id="modal-error"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel-btn">Cancel</button>
        <button class="btn" id="save-btn">${isEdit ? 'Update' : 'Add User'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  overlay.querySelectorAll('.password-toggle-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = overlay.querySelector(`#${btn.dataset.target}`);
      input.type = input.type === 'password' ? 'text' : 'password';
      btn.textContent = input.type === 'password' ? '👁️' : '🙈';
    });
  });

  overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#save-btn').addEventListener('click', async () => {
    const fullName = overlay.querySelector('#u-fullname').value.trim();
    const email = overlay.querySelector('#u-email').value.trim();
    const username = overlay.querySelector('#u-username').value.trim();
    const password = overlay.querySelector('#u-password').value;
    const passwordConfirm = overlay.querySelector('#u-password-confirm').value;
    const contact = overlay.querySelector('#u-contact').value.trim();
    const errorEl = overlay.querySelector('#modal-error');

    if (!fullName || !username) {
      errorEl.innerHTML = `<div class="error-msg">Full Name and Username are required.</div>`;
      return;
    }
    if (!isEdit && !password) {
      errorEl.innerHTML = `<div class="error-msg">Password is required for new users.</div>`;
      return;
    }
    if (password && password !== passwordConfirm) {
      errorEl.innerHTML = `<div class="error-msg">Password and Confirm Password do not match.</div>`;
      return;
    }

    try {
      if (isEdit) {
        const payload = { fullName, email, username, contact };
        if (password) payload.password = password;
        await api.updateUser(existingUser._id, payload);
      } else {
        await api.createUser({ fullName, email, username, password, contact });
      }
      overlay.remove();
      await refreshFn();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

// ---- Departments (CEO) ----
async function renderCeoDepartments() {
  const { departments } = await api.listDepartments();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Departments</h2>
      <button class="btn" id="add-dept-btn">+ New Department</button>
    </div>
    <table>
      <thead><tr><th>Department</th><th>Team Leader</th><th>Email</th><th>Members</th><th>Actions</th></tr></thead>
      <tbody>
        ${departments.map(d => `
          <tr>
            <td>${d.name}</td>
            <td>${d.teamLeader ? `<span class="leader-inline">${d.teamLeader.fullName || d.teamLeader.username}</span>` : '<span style="color:var(--muted)">Unassigned</span>'}</td>
            <td>${d.teamLeader ? (d.teamLeader.email || '-') : '-'}</td>
            <td><span class="dept-badge">${d.memberCount || 0} ${d.memberCount === 1 ? 'member' : 'members'}</span></td>
            <td class="action-cell">
              <button class="btn-icon edit-dept-btn" data-id="${d._id}" title="Edit">✏️</button>
              <button class="btn-icon btn-del delete-dept-btn" data-id="${d._id}" data-name="${d.name}" title="Delete">🗑️</button>
            </td>
          </tr>`).join('') || '<tr><td colspan="5">No departments yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('add-dept-btn').addEventListener('click', () => showDepartmentModal(null, renderCeoDepartments));
  main.querySelectorAll('.edit-dept-btn').forEach(btn => {
    const dept = departments.find(d => d._id === btn.dataset.id);
    btn.addEventListener('click', () => showDepartmentModal(dept, renderCeoDepartments));
  });
  main.querySelectorAll('.delete-dept-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Delete the "${btn.dataset.name}" department? Its team leader and members will become unassigned employees.`)) return;
      try {
        await api.deleteDepartment(btn.dataset.id);
        await renderCeoDepartments();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}

function showDepartmentModal(existingDept, refreshFn) {
  const isEdit = !!existingDept;
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:440px;">
      <h1>${isEdit ? 'Edit Department' : 'New Department'}</h1>
      <p class="subtitle">${isEdit ? 'Update department name or reassign the team leader.' : 'Create a department and assign a team leader from your users.'}</p>
      <label>Department Name *</label>
      <input type="text" id="dept-name" value="${isEdit ? existingDept.name : ''}" placeholder="e.g. QA, Frontend, UI/UX" />
      <label>Team Leader</label>
      <div style="position:relative;">
        <input type="text" id="leader-search" placeholder="Search by name or username..." autocomplete="off"
          value="${isEdit && existingDept.teamLeader ? (existingDept.teamLeader.fullName || existingDept.teamLeader.username) : ''}" />
        <div id="leader-results" class="search-dropdown" style="display:none;"></div>
      </div>
      <input type="hidden" id="leader-id" value="${isEdit && existingDept.teamLeader ? existingDept.teamLeader._id : ''}" />
      <div id="modal-error"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel-btn">Cancel</button>
        <button class="btn" id="save-btn">${isEdit ? 'Update' : 'Create'}</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  // Leader search
  let searchTimeout;
  const searchInput = overlay.querySelector('#leader-search');
  const resultsBox = overlay.querySelector('#leader-results');
  const leaderIdInput = overlay.querySelector('#leader-id');

  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    leaderIdInput.value = '';
    const q = searchInput.value.trim();
    if (q.length < 1) { resultsBox.style.display = 'none'; return; }
    searchTimeout = setTimeout(async () => {
      try {
        const { users } = await api.searchUsers(q);
        if (!users.length) { resultsBox.style.display = 'none'; return; }
        resultsBox.innerHTML = users.map(u =>
          `<div class="search-result-item" data-id="${u._id}" data-name="${u.fullName || u.username}">
            <strong>${u.fullName || u.username}</strong> <span style="color:var(--muted)">@${u.username}</span>
            ${u.role === 'team_leader' ? '<span class="leader-badge">Leader</span>' : ''}
          </div>`
        ).join('');
        resultsBox.style.display = 'block';
        resultsBox.querySelectorAll('.search-result-item').forEach(item => {
          item.addEventListener('click', () => {
            leaderIdInput.value = item.dataset.id;
            searchInput.value = item.dataset.name;
            resultsBox.style.display = 'none';
          });
        });
      } catch (e) { resultsBox.style.display = 'none'; }
    }, 250);
  });

  document.addEventListener('click', (e) => { if (!overlay.contains(e.target)) resultsBox.style.display = 'none'; }, { once: false });

  overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#save-btn').addEventListener('click', async () => {
    const departmentName = overlay.querySelector('#dept-name').value.trim();
    const teamLeaderId = leaderIdInput.value;
    const errorEl = overlay.querySelector('#modal-error');

    if (!departmentName) {
      errorEl.innerHTML = `<div class="error-msg">Department name is required.</div>`;
      return;
    }
    if (!isEdit && !teamLeaderId) {
      errorEl.innerHTML = `<div class="error-msg">Please search and select a team leader.</div>`;
      return;
    }

    try {
      if (isEdit) {
        const payload = { departmentName };
        if (teamLeaderId) payload.teamLeaderId = teamLeaderId;
        await api.updateDepartment(existingDept._id, payload);
      } else {
        await api.createDepartment({ departmentName, teamLeaderId });
      }
      overlay.remove();
      await refreshFn();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

async function renderCeoTasks() {
  const { tasks } = await api.listTasks();
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Company Tasks</h2>
      <button class="btn" id="assign-company-task-btn">+ Assign Task to Department</button>
    </div>
    <p class="section-hint">Assign work to a department's team leader here. The leader will break it down into individual tasks for their team members.</p>
    <table>
      <thead><tr><th>Title</th><th>Assigned To</th><th>Assigned By</th><th>Status</th></tr></thead>
      <tbody>
        ${tasks.map(t => `
          <tr>
            <td>${t.title}</td>
            <td>${t.scope === 'company'
              ? `<span class="dept-badge">${t.assignedToDepartment ? t.assignedToDepartment.name : 'Department'}</span>`
              : (t.assignedTo ? t.assignedTo.username : '-')}</td>
            <td>${t.assignedBy ? t.assignedBy.username : '-'}</td>
            <td><span class="badge ${t.status}">${t.status}</span></td>
          </tr>`).join('') || '<tr><td colspan="4">No tasks yet.</td></tr>'}
      </tbody>
    </table>
  `;

  document.getElementById('assign-company-task-btn').addEventListener('click', () => showAssignCompanyTaskModal(renderCeoTasks));
}

function showAssignCompanyTaskModal(refreshFn) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:440px;">
      <h1>Assign Task to Department</h1>
      <p class="subtitle">This goes to the department's team leader, who will split it into individual tasks for their team.</p>
      <label>Title *</label>
      <input type="text" id="ct-title" />
      <label>Description</label>
      <textarea id="ct-desc" rows="3"></textarea>
      <label>Department *</label>
      <select id="ct-department"><option value="">Loading departments...</option></select>
      <label>Due Date</label>
      <input type="date" id="ct-due" />
      <div id="modal-error"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel-btn">Cancel</button>
        <button class="btn" id="assign-btn">Assign</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  (async () => {
    try {
      const { departments } = await api.listDepartments();
      const select = overlay.querySelector('#ct-department');
      const withLeader = departments.filter((d) => d.teamLeader);
      select.innerHTML = withLeader.length
        ? withLeader.map((d) => `<option value="${d._id}">${d.name} (Leader: ${d.teamLeader.fullName || d.teamLeader.username})</option>`).join('')
        : '<option value="">No departments with an assigned leader yet</option>';
    } catch (err) {
      overlay.querySelector('#modal-error').innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  })();

  overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
  overlay.querySelector('#assign-btn').addEventListener('click', async () => {
    const title = overlay.querySelector('#ct-title').value.trim();
    const description = overlay.querySelector('#ct-desc').value.trim();
    const departmentId = overlay.querySelector('#ct-department').value;
    const dueDate = overlay.querySelector('#ct-due').value;
    const errorEl = overlay.querySelector('#modal-error');

    if (!title || !departmentId) {
      errorEl.innerHTML = `<div class="error-msg">Title and Department are required.</div>`;
      return;
    }

    try {
      await api.createCompanyTask({ title, description, departmentId, dueDate });
      overlay.remove();
      await refreshFn();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
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
    { key: 'company-tasks', label: 'Company Tasks', onClick: () => { leaderActiveTab = 'company-tasks'; screenLeaderDashboard(); } },
    { key: 'tasks', label: 'Team Tasks', onClick: () => { leaderActiveTab = 'tasks'; screenLeaderDashboard(); } },
    { key: 'leaves', label: 'Leave Requests', onClick: () => { leaderActiveTab = 'leaves'; screenLeaderDashboard(); } },
    { key: 'notifications', label: notificationNavLabel(unreadCount), onClick: () => { leaderActiveTab = 'notifications'; screenLeaderDashboard(); } },
  ];

  const myDeptName = await getMyDepartmentName();
  dashboardShell(leaderActiveTab, navItems, `<p>Loading...</p>`, myDeptName ? `Team Leader · ${myDeptName}` : 'Team Leader');

  if (leaderActiveTab === 'team') await renderLeaderTeam();
  else if (leaderActiveTab === 'company-tasks') await renderLeaderCompanyTasks();
  else if (leaderActiveTab === 'tasks') await renderLeaderTasks();
  else if (leaderActiveTab === 'leaves') await renderLeaderLeaves();
  else if (leaderActiveTab === 'notifications') await renderNotificationsTab(screenLeaderDashboard);
}

// Tasks the CEO has delegated to this leader's department as a whole.
// The leader breaks each one down into individual tasks for their team.
async function renderLeaderCompanyTasks() {
  const { tasks } = await api.listTasks();
  const companyTasks = tasks.filter((t) => t.scope === 'company');
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <h2>Company Tasks</h2>
    <p class="section-hint">These were assigned to your department by the CEO. Break each one down into individual tasks for your team members from here.</p>
    <table>
      <thead><tr><th>Title</th><th>Description</th><th>Due</th><th>Status</th><th></th></tr></thead>
      <tbody>
        ${companyTasks.map(t => `
          <tr>
            <td>${t.title}</td>
            <td>${t.description || '-'}</td>
            <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</td>
            <td><span class="badge ${t.status}">${t.status}</span></td>
            <td><button class="btn-icon split-task-btn" data-id="${t._id}" data-title="${t.title}" title="Assign to team members">➗ Split</button></td>
          </tr>`).join('') || '<tr><td colspan="5">No company tasks yet.</td></tr>'}
      </tbody>
    </table>
  `;

  main.querySelectorAll('.split-task-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const { employees } = await api.listEmployees();
      showAssignTaskModal(employees, renderLeaderCompanyTasks, { id: btn.dataset.id, title: btn.dataset.title });
    });
  });
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
      <thead><tr><th>Username</th><th>Full Name</th><th>Department(s)</th><th></th></tr></thead>
      <tbody>
        ${employees.map(e => `
          <tr>
            <td>${e.username}</td>
            <td>
              ${e.fullName || ''}
              ${e.role === 'team_leader' ? '<span class="leader-badge">Team Leader</span>' : ''}
            </td>
            <td>${renderDepartmentBadges(e.departments)}</td>
            <td>${e.role === 'team_leader'
              ? ''
              : `<button class="btn-icon btn-del remove-emp-btn" data-id="${e._id}" data-name="${e.fullName || e.username}" title="Remove from team">🗑️</button>`}</td>
          </tr>`).join('') || '<tr><td colspan="4">No team members yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('add-emp-btn').addEventListener('click', () => showAddEmployeeModal(renderLeaderTeam));

  main.querySelectorAll('.remove-emp-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm(`Remove "${btn.dataset.name}" from your team?`)) return;
      try {
        await api.removeEmployeeFromTeam(btn.dataset.id);
        await renderLeaderTeam();
      } catch (err) { alert(err.message); }
    });
  });
}

// Renders every department this employee belongs to as small pill badges.
function renderDepartmentBadges(departments) {
  if (!departments || !departments.length) {
    return '<span style="color:var(--muted)">-</span>';
  }
  return departments.map(d => `<span class="dept-badge">${d.name}</span>`).join(' ');
}

function showAddEmployeeModal(refreshFn) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:460px;">
      <h1>Add Employee to Team</h1>
      <p class="subtitle">Search across all employees in the company and add them to your team. An employee can belong to more than one team.</p>
      <label>Search Employee</label>
      <div style="position:relative;">
        <input type="text" id="emp-search" placeholder="Search by name or username..." autocomplete="off" />
        <div id="emp-results" class="search-dropdown" style="display:none;"></div>
      </div>
      <div id="selected-emp" style="margin-top:10px;"></div>
      <input type="hidden" id="selected-emp-id" value="" />
      <div id="modal-error"></div>
      <div class="btn-row">
        <button class="btn secondary" id="cancel-btn">Cancel</button>
        <button class="btn" id="add-btn" disabled>Add to Team</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  const searchInput = overlay.querySelector('#emp-search');
  const resultsBox = overlay.querySelector('#emp-results');
  const selectedBox = overlay.querySelector('#selected-emp');
  const selectedIdInput = overlay.querySelector('#selected-emp-id');
  const addBtn = overlay.querySelector('#add-btn');
  const errorEl = overlay.querySelector('#modal-error');

  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    selectedIdInput.value = '';
    selectedBox.innerHTML = '';
    addBtn.disabled = true;
    const q = searchInput.value.trim();
    if (q.length < 1) { resultsBox.style.display = 'none'; return; }
    searchTimeout = setTimeout(async () => {
      try {
        const { employees } = await api.searchAllEmployees(q);
        if (!employees.length) {
          resultsBox.innerHTML = `<div class="search-result-item" style="color:var(--muted);cursor:default;">No matching employees found</div>`;
          resultsBox.style.display = 'block';
          return;
        }
        resultsBox.innerHTML = employees.map(e => `
          <div class="search-result-item" data-id="${e._id}" data-name="${e.fullName || e.username}">
            <strong>${e.fullName || e.username}</strong> <span style="color:var(--muted)">@${e.username}</span>
            <div>${renderDepartmentBadges(e.departments)}</div>
          </div>`
        ).join('');
        resultsBox.style.display = 'block';
        resultsBox.querySelectorAll('.search-result-item[data-id]').forEach(item => {
          item.addEventListener('click', () => {
            selectedIdInput.value = item.dataset.id;
            selectedBox.innerHTML = `Selected: <strong>${item.dataset.name}</strong>`;
            searchInput.value = item.dataset.name;
            resultsBox.style.display = 'none';
            addBtn.disabled = false;
          });
        });
      } catch (e) { resultsBox.style.display = 'none'; }
    }, 250);
  });

  document.addEventListener('click', (e) => { if (!overlay.contains(e.target)) resultsBox.style.display = 'none'; }, { once: false });

  overlay.querySelector('#cancel-btn').addEventListener('click', () => overlay.remove());
  addBtn.addEventListener('click', async () => {
    const employeeId = selectedIdInput.value;
    if (!employeeId) {
      errorEl.innerHTML = `<div class="error-msg">Please search and select an employee.</div>`;
      return;
    }
    try {
      await api.addEmployeeToTeam(employeeId);
      overlay.remove();
      await refreshFn();
    } catch (err) {
      errorEl.innerHTML = `<div class="error-msg">${err.message}</div>`;
    }
  });
}

async function renderLeaderTasks() {
  const [{ tasks }, { employees }] = await Promise.all([api.listTasks(), api.listEmployees()]);
  const teamTasks = tasks.filter((t) => t.scope !== 'company');
  const main = document.getElementById('main-content');
  main.innerHTML = `
    <div class="toolbar">
      <h2>Team Tasks</h2>
      <button class="btn" id="add-task-btn">+ Assign Task</button>
    </div>
    <table>
      <thead><tr><th>Title</th><th>Assigned To</th><th>From Company Task</th><th>Status</th><th>Due</th></tr></thead>
      <tbody>
        ${teamTasks.map(t => `
          <tr>
            <td>${t.title}</td>
            <td>${t.assignedTo ? t.assignedTo.username : '-'}</td>
            <td>${t.parentTask ? '<span class="dept-badge">Linked</span>' : '<span style="color:var(--muted)">-</span>'}</td>
            <td><span class="badge ${t.status}">${t.status}</span></td>
            <td>${t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '-'}</td>
          </tr>`).join('') || '<tr><td colspan="5">No tasks yet.</td></tr>'}
      </tbody>
    </table>
  `;
  document.getElementById('add-task-btn').addEventListener('click', () => showAssignTaskModal(employees, renderLeaderTasks));
}

function showAssignTaskModal(employees, refreshFn, parentTask = null) {
  // The leader's own row is included in "My Team" (since they're a member
  // of the department they lead), but tasks should go to actual reports,
  // not to the leader themself.
  const assignableEmployees = employees.filter((e) => e.role !== 'team_leader');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="card" style="max-width:420px;">
      <h1>${parentTask ? 'Assign Part of Company Task' : 'Assign Task'}</h1>
      ${parentTask ? `<p class="subtitle">Splitting from company task: <strong>${parentTask.title}</strong></p>` : ''}
      <label>Title</label>
      <input type="text" id="task-title" value="${parentTask ? parentTask.title : ''}" />
      <label>Description</label>
      <textarea id="task-desc" rows="3"></textarea>
      <label>Assign To</label>
      <select id="task-assignee">
        ${assignableEmployees.map(e => `<option value="${e._id}">${e.username}</option>`).join('')}
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
      await api.createTask({ title, description, assignedTo, dueDate, parentTaskId: parentTask ? parentTask.id : undefined });
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

  const myTeamsLabel = await getMyTeamsLabel();
  dashboardShell(employeeActiveTab, navItems, `<p>Loading...</p>`, myTeamsLabel);

  if (employeeActiveTab === 'tasks') await renderEmployeeTasks();
  else if (employeeActiveTab === 'attendance') await renderEmployeeAttendance();
  else if (employeeActiveTab === 'leaves') await renderEmployeeLeaves();
  else if (employeeActiveTab === 'notifications') await renderNotificationsTab(screenEmployeeDashboard);
}

// Looks up the employee's own department names for the sidebar subtitle,
// e.g. "QA, Frontend" when they belong to more than one team.
async function getMyTeamsLabel() {
  if (state.session.role !== 'employee') return '';
  try {
    const { user } = await api.getMe();
    const names = (user.departments || []).map((d) => d.name);
    return names.length ? names.join(', ') : 'No team assigned yet';
  } catch (err) {
    return '';
  }
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
