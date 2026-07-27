const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (id, session) => ipcRenderer.invoke('session:save', id, session),
  // Blocking on purpose: only for the last write while the window is closing,
  // where an async invoke would be dropped before it reaches the main process.
  saveSessionSync: (id, session) => ipcRenderer.sendSync('session:save-sync', id, session),
  listSessions: () => ipcRenderer.invoke('session:list'),
  openSession: (id) => ipcRenderer.invoke('session:open', id),
  createSession: (seed) => ipcRenderer.invoke('session:create', seed),
  deleteSession: (id) => ipcRenderer.invoke('session:delete', id),
  deleteAllSessions: () => ipcRenderer.invoke('session:delete-all'),
  pickAsset: (kind, previous) => ipcRenderer.invoke('asset:pick', kind, previous),
  storePhoto: (photo) => ipcRenderer.invoke('photo:store', photo),
  purgePhotos: (sessionId, keepIds) => ipcRenderer.invoke('photo:purge', sessionId, keepIds),
  ocrRecognize: (pngDataUrl) => ipcRenderer.invoke('ocr:recognize', pngDataUrl),
  printBatch: (html) => ipcRenderer.invoke('print:batch', html),
  exportPdf: (html) => ipcRenderer.invoke('print:pdf', html),
  // Updates. `onUpdateStatus` only ever hands the renderer the plain status
  // object — never the event, which would carry the sender with it.
  updateStatus: () => ipcRenderer.invoke('update:status'),
  onUpdateStatus: (cb) => ipcRenderer.on('update:status', (_e, status) => cb(status)),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
});
