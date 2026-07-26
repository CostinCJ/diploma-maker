const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (session) => ipcRenderer.invoke('session:save', session),
  // Blocking on purpose: only for the last write while the window is closing,
  // where an async invoke would be dropped before it reaches the main process.
  saveSessionSync: (session) => ipcRenderer.sendSync('session:save-sync', session),
  pickAsset: (kind) => ipcRenderer.invoke('asset:pick', kind),
  ocrRecognize: (pngDataUrl) => ipcRenderer.invoke('ocr:recognize', pngDataUrl),
  printBatch: (html) => ipcRenderer.invoke('print:batch', html),
  exportPdf: (html) => ipcRenderer.invoke('print:pdf', html),
});
