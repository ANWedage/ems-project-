const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('localState', {
  get: (key) => ipcRenderer.invoke('store:get', key),
  set: (key, value) => ipcRenderer.invoke('store:set', key, value),
  delete: (key) => ipcRenderer.invoke('store:delete', key),
});

// App metadata
contextBridge.exposeInMainWorld('appMeta', {
  version: () => ipcRenderer.invoke('app:version'),
});

// Auto-updater bridge
contextBridge.exposeInMainWorld('updater', {
  check:    ()  => ipcRenderer.invoke('updater:check'),
  download: ()  => ipcRenderer.invoke('updater:download'),
  install:  ()  => ipcRenderer.invoke('updater:install'),
  // Fired by main when Help → Check for Updates menu item is clicked
  onOpenModal: (cb) => ipcRenderer.on('updater:open-modal', () => cb()),
  // Fired by main for all updater lifecycle events
  onStatus:    (cb) => ipcRenderer.on('updater:status', (_e, data) => cb(data)),
  // Call this when closing the modal to avoid listener leaks
  removeListeners: () => {
    ipcRenderer.removeAllListeners('updater:status');
  },
});
