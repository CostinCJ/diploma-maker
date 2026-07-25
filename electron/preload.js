const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  loadSession: () => ipcRenderer.invoke('session:load'),
  saveSession: (session) => ipcRenderer.invoke('session:save', session),
  pickAsset: (kind) => ipcRenderer.invoke('asset:pick', kind),
  ocrRecognize: (pngDataUrl, layout) => ipcRenderer.invoke('ocr:recognize', pngDataUrl, layout),
  printBatch: (html) => ipcRenderer.invoke('print:batch', html),
  exportPdf: (html) => ipcRenderer.invoke('print:pdf', html),
});
