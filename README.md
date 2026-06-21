# EMS Desktop — Multi-Tenant Employee Management System

## Architecture

```
ems-project/
├── backend/     Node.js + Express + MongoDB API (hosted on a server / cloud)
└── frontend/    Electron desktop client (.exe / .dmg / .AppImage)
```

Why split this way: a desktop installer cannot itself host a shared database
that a CEO's, team leaders', and employees' separate computers all need to
reach. So the backend runs centrally (a cheap VPS, Render, Railway, etc. +
MongoDB Atlas), and the Electron app is just a client that talks to it over
the internet — same way a web app would, just packaged as a desktop app.

### Multi-tenancy model (one isolated DB per company)
- A **master database** (`ems_master`) holds only a registry: `companyName -> dbName`.
- When a CEO completes "Setup as CEO," the backend:
  1. Generates a unique db name from the company name (e.g. `ems_acme_pvt_ltd_4f8a2c`).
  2. Creates a **brand new MongoDB database** with that name.
  3. Creates the CEO's user document inside that new database.
  4. Saves the `companyName -> dbName` mapping in the master registry.
- Every login requires `companyName + username + password`. The backend looks
  up which database that company lives in, then authenticates against that
  database only — so one company can never see another's data.
- JWT tokens embed the resolved `dbName`, so every authenticated request
  automatically operates on the correct company's isolated database.

### Roles
- **ceo** — created at company registration. Creates departments + team leaders.
- **team_leader** — created by CEO. Adds employees to their department, assigns tasks, approves leave.
- **employee** — created by team leader. Has tasks, check-in/out, leave requests.

## Running locally

### 1. Backend
```bash
cd backend
cp .env.example .env     # edit MONGO_BASE_URI if not running Mongo locally, set a real JWT_SECRET
npm install
npm run dev               # or: npm start
```
Requires a running MongoDB instance (local `mongod`, or a MongoDB Atlas connection string in `MONGO_BASE_URI`).

### 2. Frontend (Electron)
```bash
cd frontend
npm install
npm start
```
This launches the desktop app. On first launch it shows the license agreement
→ role choice → CEO setup (or employee login) → dashboard, exactly as described
in the product flow.

`frontend/renderer/api.js` has `API_BASE_URL` pointing at `http://localhost:5000/api`
during development — change this to your deployed backend URL before building
the installer for distribution.

### 3. Building the installer (.exe / .dmg / .AppImage)
```bash
cd frontend
npm run build:win     # or build:mac / build:linux
```
electron-builder outputs the installer to `frontend/dist/`.

## What's implemented in this scaffold
- Full company registration + per-company database creation
- Universal login (role-based JWT) for CEO / team leader / employee
- CEO: create departments + team leaders, view all employees/tasks/leaves
- Team leader: add employees, assign tasks, approve/reject leave
- Employee: view/update own tasks, check-in/out, request leave
- Electron installer-style first-run wizard (license agreement → role choice → setup/login)
- Local session persistence (electron-store) so the app remembers login between launches

## What you'll likely want to add next
- Password reset / "forgot password" flow
- Input validation hardening (express-validator is already a dependency)
- Pagination for large employee/task lists
- Notifications (e.g. task assigned, leave approved)
- Production deployment: host backend (Render/Railway/EC2) + MongoDB Atlas, then point `API_BASE_URL` at it before building installers
- Code-signing the Electron installer for Windows/Mac distribution
