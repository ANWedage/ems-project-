const { app, BrowserWindow, ipcMain, Menu, shell, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');

// ─── Auto-updater setup ───────────────────────────────────────────────────────
autoUpdater.autoDownload = false;        // user must confirm download
autoUpdater.autoInstallOnAppQuit = true; // install on next quit if downloaded

// Suppress errors in dev (no built package = no update feed)
if (!app.isPackaged) {
  autoUpdater.updateConfigPath = null;
}

// Persistent local storage on the user's machine
const store = new Store();

let mainWindow;

const appIcon = path.join(__dirname, 'build', 'icons', 'icon.png');

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 600,
    icon: appIcon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));
}

// ─── Application Menu ─────────────────────────────────────────────────────────
// Only File, Window, and Help — no Edit or View menus.
function buildMenu() {
  const isMac = process.platform === 'darwin';

  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    { role: 'windowMenu' },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About EMS Desktop',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About EMS Desktop',
              icon: appIcon,
              message: 'EMS Desktop',
              detail: [
                `Version:   ${app.getVersion()}`,
                '',
                'Employee Management System',
              ].join('\n'),
              buttons: ['OK'],
            });
          },
        },
        { type: 'separator' },
        {
          label: 'Check for Updates…',
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('updater:open-modal');
            }
          },
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();

  // Auto-check for updates 5 seconds after launch (delay lets the window fully load first)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 5000);
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ─── IPC: local app state ─────────────────────────────────────────────────────
ipcMain.handle('store:get', (event, key) => store.get(key));
ipcMain.handle('store:set', (event, key, value) => store.set(key, value));
ipcMain.handle('store:delete', (event, key) => store.delete(key));
ipcMain.handle('app:version', () => app.getVersion());

// ─── IPC: auto-updater ────────────────────────────────────────────────────────
function pushToRenderer(event, data = {}) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('updater:status', { event, ...data });
  }
}

autoUpdater.on('checking-for-update',   ()     => pushToRenderer('checking'));
autoUpdater.on('update-not-available',  (info) => pushToRenderer('not-available', { version: info.version }));
autoUpdater.on('update-available',      (info) => pushToRenderer('available', {
  version:      info.version,
  releaseNotes: info.releaseNotes || '',
  releaseDate:  info.releaseDate  || '',
}));
autoUpdater.on('download-progress', (p) => pushToRenderer('progress', {
  percent:        Math.round(p.percent),
  transferred:    p.transferred,
  total:          p.total,
  bytesPerSecond: p.bytesPerSecond,
}));
autoUpdater.on('update-downloaded', (info) => pushToRenderer('downloaded', {
  version:      info.version,
  releaseNotes: info.releaseNotes || '',
}));
autoUpdater.on('error', (err) => pushToRenderer('error', { message: err.message }));

ipcMain.handle('updater:check', async () => {
  if (!app.isPackaged) return { devMode: true };
  try { await autoUpdater.checkForUpdates(); return { ok: true }; }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('updater:download', () => {
  try { autoUpdater.downloadUpdate(); return { ok: true }; }
  catch (err) { return { error: err.message }; }
});

ipcMain.handle('updater:install', () => autoUpdater.quitAndInstall(false, true));
