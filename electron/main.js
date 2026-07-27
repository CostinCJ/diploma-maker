const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const { randomUUID } = require('crypto');
const { initUpdater } = require('./updater');

// Chromium renders <input type="date"> in its UI locale, so on an en-US build a
// Romanian guide was shown mm/dd/yyyy — American order on the one screen where
// date order matters most. Must be set before the app is ready.
app.commandLine.appendSwitch('lang', 'ro');

// --- Sessions ---
// A camp runs several shifts, so sessions are kept side by side, one file each,
// with a pointer to whichever is open. Starting the next one must never mean
// destroying the last one: those lists are the only record of who was there.
const ID_RE = /^[\w-]{1,64}$/;

function sessionsDir() {
  const dir = path.join(app.getPath('userData'), 'sessions');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const sessionPath = (id) => path.join(sessionsDir(), id + '.json');
const currentFile = () => path.join(app.getPath('userData'), 'current.json');

function assetsDir() {
  const dir = path.join(app.getPath('userData'), 'assets');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function readSession(id) {
  if (!ID_RE.test(String(id))) return null;
  try {
    return JSON.parse(fs.readFileSync(sessionPath(id), 'utf8'));
  } catch {
    return null; // missing or corrupt → the caller falls back
  }
}

function listSessionIds() {
  try {
    return fs.readdirSync(sessionsDir()).filter((f) => f.endsWith('.json')).map((f) => path.basename(f, '.json'));
  } catch {
    return [];
  }
}

const allSessions = () => listSessionIds()
  .map((id) => ({ id, data: readSession(id) }))
  .filter((s) => s.data && typeof s.data === 'object');

// Write to a temp file and rename over the target: rename is atomic, so a crash
// or power loss mid-write can never leave a truncated session file behind (that
// would read back as corrupt and silently drop the whole participant list).
function writeSession(id, session) {
  if (!ID_RE.test(String(id))) throw new Error('Sesiune invalidă.');
  const target = sessionPath(id);
  const tmp = target + '.' + process.pid + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify({ ...session, updatedAt: new Date().toISOString() }, null, 2));
  fs.renameSync(tmp, target);
}

function currentId() {
  try {
    return JSON.parse(fs.readFileSync(currentFile(), 'utf8')).id;
  } catch {
    return null;
  }
}

function setCurrentId(id) {
  fs.writeFileSync(currentFile(), JSON.stringify({ id }));
}

/** Sessions used to be a single session.json. Move it into the new layout on
 *  first run, so an upgrade opens on the same list it was left on. */
function migrateLegacySession() {
  const legacy = path.join(app.getPath('userData'), 'session.json');
  if (listSessionIds().length || !fs.existsSync(legacy)) return;
  try {
    const id = randomUUID();
    writeSession(id, JSON.parse(fs.readFileSync(legacy, 'utf8')));
    setCurrentId(id);
    fs.unlinkSync(legacy);
  } catch (err) {
    console.error('[session] could not migrate session.json', err);
  }
}

/** The id of the open session, creating one if this is a first run (or if the
 *  pointer names a session that is no longer there). */
function ensureCurrent() {
  migrateLegacySession();
  const pointed = currentId();
  if (pointed && readSession(pointed)) return pointed;
  const [first] = listSessionIds();
  const id = first ?? randomUUID();
  if (!first) writeSession(id, {}); // empty: the renderer fills in the defaults
  setCurrentId(id);
  return id;
}

const loaded = (id) => ({ id, session: readSession(id) });

ipcMain.handle('session:load', () => loaded(ensureCurrent()));

ipcMain.handle('session:save', (_e, id, session) => {
  writeSession(id, session);
  return true;
});

// Synchronous twin, used only from the renderer's `beforeunload` handler: a
// debounced save still in flight would otherwise be dropped when the window
// closes, losing the last few hundred milliseconds of edits.
ipcMain.on('session:save-sync', (e, id, session) => {
  try {
    writeSession(id, session);
    e.returnValue = true;
  } catch (err) {
    console.error('[session] sync save failed', err);
    e.returnValue = false;
  }
});

const countOf = (list) => (Array.isArray(list) ? list.length : 0);

ipcMain.handle('session:list', () => allSessions()
  .map(({ id, data }) => ({
    id,
    name: typeof data.name === 'string' ? data.name : '',
    startDate: typeof data.startDate === 'string' ? data.startDate : '',
    endDate: typeof data.endDate === 'string' ? data.endDate : '',
    kids: countOf(data.kids),
    teachers: countOf(data.teachers),
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
  }))
  .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));

ipcMain.handle('session:open', (_e, id) => {
  if (!readSession(id)) return null;
  setCurrentId(id);
  return loaded(id);
});

// `seed` carries over what is not specific to one shift — the edited wording.
ipcMain.handle('session:create', (_e, seed) => {
  const id = randomUUID();
  writeSession(id, seed && typeof seed === 'object' ? seed : {});
  setCurrentId(id);
  return loaded(id);
});

ipcMain.handle('session:delete', (_e, id) => {
  if (ID_RE.test(String(id))) { try { fs.unlinkSync(sessionPath(id)); } catch {} }
  purgeUnreferenced();
  return loaded(ensureCurrent());
});

// What the camp laptop needs before it is handed back: every name, every photo.
ipcMain.handle('session:delete-all', () => {
  for (const id of listSessionIds()) { try { fs.unlinkSync(sessionPath(id)); } catch {} }
  purgeUnreferenced();
  return loaded(ensureCurrent());
});

// kind: 'background' | 'logoLeft' | 'logoRight'. Copies into userData so the
// session keeps working even if the original file moves. `previous` is the copy
// this one replaces, deleted here — the group photo of a children's camp must
// not stay behind, and with several sessions open in turn only the exact file
// being replaced may go (a pattern would have deleted another shift's picture).
// Returns absolute path or null.
ipcMain.handle('asset:pick', async (_e, kind, previous) => {
  if (!['background', 'logoLeft', 'logoRight'].includes(kind)) return null;
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Alege imaginea',
    properties: ['openFile'],
    filters: [{ name: 'Imagini', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
  });
  if (canceled || !filePaths[0]) return null;
  const src = filePaths[0];
  // Unique filename per pick. A stable name (background.png) kept resolving to
  // the same file:// URL, so after replacing an image Chromium served the old
  // one from cache — the thumbnail worked around it with a ?t= query, but the
  // preview and the printed diploma still showed the previous picture.
  const dest = path.join(assetsDir(), `${kind}-${randomUUID()}${path.extname(src).toLowerCase()}`);
  fs.copyFileSync(src, dest);
  if (typeof previous === 'string' && previous !== dest && path.dirname(previous) === assetsDir()) {
    try { fs.unlinkSync(previous); } catch {}
  }
  return dest;
});

// --- Imported list photos ---
// The photos names were read from are what the guide checks the list against,
// so they are kept with the session: a verification left half-done at night can
// be picked up in the morning. One file per import, named after the import id.
function photosDir() {
  const dir = path.join(app.getPath('userData'), 'photos');
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const PHOTO_ID_RE = /^[\w-]{1,64}$/;
const PHOTO_EXT_RE = /^\.(png|jpe?g|webp|bmp|gif)$/i;

ipcMain.handle('photo:store', (_e, { id, ext, bytes } = {}) => {
  try {
    // The id becomes a filename, so it may not carry a path of its own.
    if (!PHOTO_ID_RE.test(String(id)) || !PHOTO_EXT_RE.test(String(ext))) {
      throw new Error('Poză invalidă.');
    }
    const dest = path.join(photosDir(), id + String(ext).toLowerCase());
    fs.writeFileSync(dest, Buffer.from(bytes));
    return { ok: true, path: dest };
  } catch (err) {
    console.error('[photo]', err);
    return { ok: false, error: err.message };
  }
});

/** Drop every stored photo and copied image that no session refers to any more.
 *  These are pictures of a children's list, so a removed import — or a deleted
 *  session — must not leave its copy behind.
 *
 *  `live` lets the open session speak for itself: its own edits may not have
 *  reached disk yet, and reading its stale file would resurrect a photo the
 *  guide has just removed (or delete one they have just added). Every *other*
 *  session is read from disk, so switching shifts never costs a photo. */
function purgeUnreferenced(live = null) {
  const photoIds = new Set(live?.photoIds?.filter((id) => typeof id === 'string') ?? []);
  const assets = new Set(live?.assets?.filter((p) => typeof p === 'string') ?? []);
  for (const { id, data } of allSessions()) {
    if (live && id === live.id) continue;
    for (const entry of Array.isArray(data.imports) ? data.imports : []) {
      if (entry && typeof entry.id === 'string') photoIds.add(entry.id);
    }
    for (const key of ['background', 'logoLeft', 'logoRight']) {
      if (typeof data[key] === 'string' && data[key]) assets.add(data[key]);
    }
  }
  const sweep = (dir, keeps) => {
    try {
      for (const f of fs.readdirSync(dir)) {
        if (!keeps(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
      }
    } catch {}
  };
  sweep(photosDir(), (f) => photoIds.has(path.parse(f).name));
  sweep(assetsDir(), (f) => assets.has(path.join(assetsDir(), f)));
}

ipcMain.handle('photo:purge', (_e, id, keepIds) => {
  purgeUnreferenced({ id, photoIds: Array.isArray(keepIds) ? keepIds : [], assets: currentAssets(id) });
  return true;
});

/** The open session's images, read from its file — the renderer only reports
 *  the imports it is authoritative about. */
function currentAssets(id) {
  const data = readSession(id) ?? {};
  return ['background', 'logoLeft', 'logoRight'].map((k) => data[k]).filter((p) => typeof p === 'string' && p);
}

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

async function recognizeDataUrl(pngDataUrl) {
  if (
    typeof pngDataUrl !== 'string'
    || !pngDataUrl.startsWith('data:image/')
    || !pngDataUrl.includes(',')
  ) {
    throw new Error('Imagine invalidă pentru OCR.');
  }
  const worker = await getOcrWorker();
  // Always automatic segmentation. SINGLE_COLUMN used to be the default for
  // participant lists, but measured no better on single-column pages and much
  // worse on two-column ones; the renderer now splits columns itself and picks
  // the best of several attempts, which is where the real gain is.
  await worker.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
  const buf = Buffer.from(pngDataUrl.split(',')[1], 'base64');
  const { data } = await worker.recognize(buf);
  return data.text;
}

// Returns { ok: true, text } | { ok: false, error }. Deliberately not a
// rejection: ipcRenderer.invoke prefixes rejected errors with "Error invoking
// remote method 'ocr:recognize': Error: ...", which ends up in front of the
// user. Matches the shape print:batch / print:pdf already use.
ipcMain.handle('ocr:recognize', async (_e, pngDataUrl) => {
  try {
    return { ok: true, text: await recognizeDataUrl(pngDataUrl) };
  } catch (err) {
    console.error('[ocr]', err);
    return { ok: false, error: err && err.message ? err.message : 'OCR a eșuat.' };
  }
});

// --- Printing & PDF (renders the standalone print document in a hidden window) ---
const PRINT_DOC_RE = /^print(-[\w-]+)?\.html$/;

// One temp file per job: print and PDF export can legitimately overlap (the
// print dialog waits on the user), and a shared fixed name meant whichever job
// finished first deleted the document the other one was still rendering.
function writePrintDoc(fullHtml) {
  if (typeof fullHtml !== 'string' || !fullHtml) throw new Error('Document de tipărit invalid.');
  const file = path.join(app.getPath('userData'), `print-${randomUUID()}.html`);
  fs.writeFileSync(file, fullHtml);
  return file;
}

function removePrintDoc(file) {
  // The temp document contains kids' names — remove it as soon as we are done.
  if (file) { try { fs.unlinkSync(file); } catch {} }
}

// A crash or forced quit during printing leaves a document full of names in
// userData; clear any leftovers on startup.
function purgeStalePrintDocs() {
  try {
    const dir = app.getPath('userData');
    for (const f of fs.readdirSync(dir)) {
      if (PRINT_DOC_RE.test(f)) { try { fs.unlinkSync(path.join(dir, f)); } catch {} }
    }
  } catch {}
}

async function openPrintWindow(file) {
  const w = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await w.loadFile(file);
  return w;
}

/** Electron/Chromium report a user-cancelled print job through the failure
 *  reason, spelled 'canceled' or 'cancelled' depending on version — match both
 *  so cancelling never surfaces as an error alert. */
const isCancelReason = (reason) => /cancel/i.test(String(reason || ''));

ipcMain.handle('print:batch', async (_e, fullHtml) => {
  let w = null;
  let file = null;
  try {
    file = writePrintDoc(fullHtml);
    w = await openPrintWindow(file);
    const win = w;
    // `await` keeps us inside try until the print callback resolves, so
    // finally only destroys the window after printing finishes. No timeout
    // race: silent:false shows the system print dialog and the callback
    // legitimately waits on the user.
    return await new Promise((resolve) => {
      win.webContents.print(
        { printBackground: true, landscape: true, margins: { marginType: 'none' } },
        (ok, reason) => resolve({ ok, canceled: !ok && isCancelReason(reason), reason: reason || '' }),
      );
    });
  } catch (err) {
    return { ok: false, canceled: false, reason: err.message };
  } finally {
    if (w && !w.isDestroyed()) w.destroy();
    removePrintDoc(file);
  }
});

ipcMain.handle('print:pdf', async (_e, fullHtml) => {
  let w = null;
  let file = null;
  try {
    const { canceled, filePath } = await dialog.showSaveDialog({
      defaultPath: 'diplome.pdf',
      filters: [{ name: 'PDF', extensions: ['pdf'] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true, reason: 'canceled' };
    file = writePrintDoc(fullHtml);
    w = await openPrintWindow(file);
    const pdf = await w.webContents.printToPDF({
      landscape: true, pageSize: 'A4', printBackground: true,
      margins: { marginType: 'none' },
    });
    fs.writeFileSync(filePath, pdf);
    return { ok: true, canceled: false, filePath };
  } catch (err) {
    return { ok: false, canceled: false, reason: err.message };
  } finally {
    if (w && !w.isDestroyed()) w.destroy();
    removePrintDoc(file);
  }
});

let mainWindow = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    // The canvas colour from styles.css, so the window does not flash white
    // before the page paints.
    backgroundColor: '#f2f1ec',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      // Electron 33 defaults, pinned explicitly so a future default change
      // cannot quietly hand node access to the renderer.
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  // The app is a single local page: nothing may open a window or navigate away.
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  mainWindow = win;
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
  // A second instance would overwrite the first one's session.json (both save
  // the whole session on every edit) and purge its temp print document — keep
  // one window and focus it instead.
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  app.on('second-instance', () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });
  purgeStalePrintDocs();
  ensureCurrent();      // migrates a pre-multi-session session.json
  purgeUnreferenced();  // photos and images a crash left behind
  createWindow();
  initUpdater(() => mainWindow);
});
app.on('window-all-closed', () => app.quit());
