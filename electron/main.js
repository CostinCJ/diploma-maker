const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

function sessionFile() {
  return path.join(app.getPath('userData'), 'session.json');
}

function assetsDir() {
  const dir = path.join(app.getPath('userData'), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

ipcMain.handle('session:load', () => {
  try {
    return JSON.parse(fs.readFileSync(sessionFile(), 'utf8'));
  } catch {
    return null; // first run or corrupt file → renderer falls back to defaults
  }
});

ipcMain.handle('session:save', (_e, session) => {
  fs.writeFileSync(sessionFile(), JSON.stringify(session, null, 2));
  return true;
});

// kind: 'background' | 'logoLeft' | 'logoRight'. Copies into userData so the
// session keeps working even if the original file moves. Returns absolute path or null.
ipcMain.handle('asset:pick', async (_e, kind) => {
  if (!['background', 'logoLeft', 'logoRight'].includes(kind)) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Alege imaginea',
    properties: ['openFile'],
    filters: [{ name: 'Imagini', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (canceled || !filePaths[0]) return null;
  const src = filePaths[0];
  const dest = path.join(assetsDir(), kind + path.extname(src).toLowerCase());
  fs.copyFileSync(src, dest);
  return dest;
});

// --- OCR (fully local: bundled Romanian model, no network) ---
// NOTE: `langPath` must NOT be used here. Inside an Electron-spawned worker
// thread, tesseract.js env detection (is-electron) reports 'electron', not
// 'node', so langPath is treated as a URL and passed to node-fetch, which
// rejects ("Only absolute URLs are supported"). Instead we point the *cache*
// at our bundled ocr-data dir with cacheMethod 'readOnly': the cache reader is
// plain fs.readFile (env-independent), it never writes or deletes our file,
// and no fetch is ever attempted because the "cached" traineddata is found.
const { createWorker, PSM } = require('tesseract.js');
let ocrWorkerPromise = null;

function ocrDataDir() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'ocr-data')
    : path.join(__dirname, '..', 'ocr-data');
}

function getOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = (async () => {
      // Guard: if the bundled model is missing, fail cleanly here instead of
      // letting tesseract.js fall back to a CDN download (privacy: no network).
      const trainedData = path.join(ocrDataDir(), 'ron.traineddata');
      if (!fs.existsSync(trainedData)) {
        throw new Error('Modelul OCR lipsește: ' + trainedData);
      }
      return createWorker('ron', 1, {
        cachePath: ocrDataDir(),
        cacheMethod: 'readOnly',
        // Worker-job rejections must become logged errors, never uncaught
        // exceptions (without errorHandler, tesseract.js throws inside an
        // event listener and crashes the whole app).
        errorHandler: (err) => console.error('[ocr]', err),
      });
    })().catch((err) => {
      ocrWorkerPromise = null; // allow retry on the next OCR call
      throw err;
    });
  }
  return ocrWorkerPromise;
}

async function recognizeDataUrl(pngDataUrl, layout) {
  if (
    typeof pngDataUrl !== 'string'
    || !pngDataUrl.startsWith('data:image/')
    || !pngDataUrl.includes(',')
  ) {
    throw new Error('Imagine invalidă pentru OCR.');
  }
  const worker = await getOcrWorker();
  // 'table' = one column of names (participant lists) → PSM SINGLE_COLUMN;
  // anything else falls back to Tesseract's automatic page segmentation.
  await worker.setParameters({
    tessedit_pageseg_mode: layout === 'table' ? PSM.SINGLE_COLUMN : PSM.AUTO,
  });
  const buf = Buffer.from(pngDataUrl.split(',')[1], 'base64');
  const { data } = await worker.recognize(buf);
  return data.text;
}

ipcMain.handle('ocr:recognize', async (_e, pngDataUrl, layout) => {
  try {
    return await recognizeDataUrl(pngDataUrl, layout);
  } catch (err) {
    // Rejections propagate to the renderer as rejected promises; keep the
    // message clean and user-presentable.
    throw new Error(err && err.message ? err.message : 'OCR a eșuat.');
  }
});

// --- Printing & PDF (renders the standalone print document in a hidden window) ---
async function loadPrintWindow(fullHtml) {
  const file = path.join(app.getPath('userData'), 'print.html');
  fs.writeFileSync(file, fullHtml);
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await w.loadFile(file);
  return w;
}

ipcMain.handle('print:batch', async (_e, fullHtml) => {
  let w = null;
  try {
    w = await loadPrintWindow(fullHtml);
    const win = w;
    // `await` keeps us inside try until the print callback resolves, so
    // finally only destroys the window after printing finishes. No timeout
    // race: silent:false shows the system print dialog and the callback
    // legitimately waits on the user.
    return await new Promise((resolve) => {
      win.webContents.print(
        { printBackground: true, landscape: true, margins: { marginType: 'none' } },
        (ok, reason) => resolve({ ok, reason: reason || '' }),
      );
    });
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    if (w && !w.isDestroyed()) w.destroy();
    // The temp document contains kids' names — remove it after use.
    try { fs.unlinkSync(path.join(app.getPath('userData'), 'print.html')); } catch {}
  }
});

ipcMain.handle('print:pdf', async (_e, fullHtml) => {
  let w = null;
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: 'diplome.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { ok: false, reason: 'canceled' };
    w = await loadPrintWindow(fullHtml);
    const pdf = await w.webContents.printToPDF({
      landscape: true, pageSize: 'A4', printBackground: true,
      margins: { marginType: 'none' },
    });
    fs.writeFileSync(filePath, pdf);
    return { ok: true, filePath };
  } catch (err) {
    return { ok: false, reason: err.message };
  } finally {
    if (w && !w.isDestroyed()) w.destroy();
    // The temp document contains kids' names — remove it after use.
    try { fs.unlinkSync(path.join(app.getPath('userData'), 'print.html')); } catch {}
  }
});

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    webPreferences: { preload: path.join(__dirname, 'preload.js') },
  });
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
}

// OCR self-test, gated by env var (kept on purpose: also used to verify the
// packaged app loads the bundled model — see Task 13). Runs the exact same
// code path as the ocr:recognize IPC handler on a 1x1 PNG inside the real
// Electron environment, prints OCR_SELFTEST_OK / OCR_SELFTEST_FAIL, and exits.
const OCR_SELFTEST_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

app.whenReady().then(() => {
  if (process.env.DIPLOME_OCR_SELFTEST === '1') {
    recognizeDataUrl(OCR_SELFTEST_PNG)
      .then(() => console.log('OCR_SELFTEST_OK'))
      .catch((err) => console.log('OCR_SELFTEST_FAIL: ' + err.message))
      .then(() => app.quit());
    return;
  }
  createWindow();
});
app.on('window-all-closed', () => app.quit());
