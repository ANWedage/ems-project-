const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const Store = require('electron-store');

// Persistent local storage on the user's machine - this is how the app
// remembers "you already finished setup, go straight to login" or
// "you're already logged in" between app launches.
const store = new Store();

let mainWindow;

// Window/taskbar icon. .ico on Windows, .icns on macOS, .png on Linux all work
// with BrowserWindow's `icon` option, but a high-res PNG is the safest single
// choice for the in-app window icon (the installer/build icon is set separately
// in package.json's "build" config for each platform's packaged app icon).
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

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// --- IPC bridge for persistent local app state ---
ipcMain.handle('store:get', (event, key) => store.get(key));
ipcMain.handle('store:set', (event, key, value) => store.set(key, value));
ipcMain.handle('store:delete', (event, key) => store.delete(key));
