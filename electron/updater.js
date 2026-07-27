// --- Automatic updates ---
// The only code in the app that talks to the network. Everything else — OCR,
// printing, the sessions — is local by design, so the rules here are narrow:
//
//   * one check, shortly after the window is up, against the GitHub releases
//     of this repository (the `publish` block in package.json);
//   * nothing is downloaded until the guide asks for it. A camp laptop is
//     often on a phone hotspot, and the installer is ~90 MB;
//   * a failed check is silent. No internet at the camp is the normal case,
//     not an error worth an alert in front of the user.
//
// Only ever active in a packaged app: in development there is no
// app-update.yml and electron-updater would fail on every start.
const { app, ipcMain } = require('electron');

// Required on first use, not on startup: in development nothing here ever
// runs, and the app should not pay for — or risk — loading it.
let cached = null;
function autoUpdater() {
  if (!cached) cached = require('electron-updater').autoUpdater;
  return cached;
}

// Long enough for the first paint and the session load to be done with.
const CHECK_DELAY_MS = 4000;

/** Last status pushed to the renderer. The window may still be loading when
 *  the check finishes, so the renderer asks for this on start instead of
 *  relying on having been there for the event. */
let status = { state: 'idle' };

/** Errors are only worth showing once the guide has asked for something —
 *  a failed background check is just a laptop that is offline. */
let userAsked = false;

function initUpdater(getWindow) {
  const send = (next) => {
    status = next;
    const win = getWindow();
    if (win && !win.isDestroyed()) win.webContents.send('update:status', status);
  };

  ipcMain.handle('update:status', () => status);

  // Registered even when updates are off, so the renderer's calls resolve
  // instead of throwing "No handler registered" at it.
  ipcMain.handle('update:download', () => {
    if (!app.isPackaged) return status;
    userAsked = true;
    // Said now rather than at the first progress event: on a slow connection
    // that is several seconds of a button that looks like it did nothing.
    send({ state: 'downloading', version: status.version });
    autoUpdater().downloadUpdate().catch((err) => console.error('[update]', err));
    return status;
  });

  ipcMain.handle('update:install', () => {
    if (!app.isPackaged) return status;
    // isSilent: false — the NSIS installer shows its progress, so the wait
    // between the app closing and coming back is not a blank screen.
    setImmediate(() => autoUpdater().quitAndInstall(false, true));
    return status;
  });

  if (!app.isPackaged || process.env.DIPLOME_NO_UPDATE_CHECK === '1') return;

  const updater = autoUpdater();
  updater.autoDownload = false;
  // A downloaded update that the guide did not restart for is still installed
  // when they close the app, so the next camp day starts on the new version.
  updater.autoInstallOnAppQuit = true;
  updater.logger = { info: () => {}, warn: () => {}, error: (...a) => console.error('[update]', ...a), debug: () => {} };

  updater.on('checking-for-update', () => send({ state: 'checking' }));
  updater.on('update-available', (info) => send({ state: 'available', version: info.version }));
  updater.on('update-not-available', () => send({ state: 'idle' }));
  updater.on('download-progress', (p) => send({
    state: 'downloading',
    version: status.version,
    percent: Math.round(p.percent ?? 0),
  }));
  updater.on('update-downloaded', (info) => send({ state: 'ready', version: info.version }));
  updater.on('error', (err) => {
    console.error('[update]', err);
    // Offline, GitHub unreachable, rate-limited: none of that is the guide's
    // problem unless they were waiting on a download they asked for.
    send(userAsked
      ? { state: 'error', version: status.version, message: err && err.message ? err.message : '' }
      : { state: 'idle' });
  });

  setTimeout(() => {
    updater.checkForUpdates().catch((err) => console.error('[update]', err));
  }, CHECK_DELAY_MS);
}

module.exports = { initUpdater };
