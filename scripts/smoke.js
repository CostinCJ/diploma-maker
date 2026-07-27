// scripts/smoke.js — `npm run smoke`
//
// Drives the real app (real main process, real IPC handlers, real session file)
// through the paths the unit tests cannot reach: the five steps of the UI, the
// session written to disk and read back, and the photos kept beside it. The
// vitest suite covers the pure modules; everything in src/ui and electron/ is
// only ever exercised here, so run this before cutting a release.
//
// It runs in a throwaway profile directory — a smoke run must never touch a
// real camp session — and prints one line per check, exiting non-zero on the
// first failure it survives to report.
const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const os = require('os');
const path = require('path');

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'diploma-smoke-'));
app.setPath('userData', profile);

// The real main process: same window, same handlers, same session file.
require('../electron/main.js');

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok || !detail ? '' : `\n         ${detail}`}`);
}
const eq = (name, actual, expected) => check(
  name,
  JSON.stringify(actual) === JSON.stringify(expected),
  `expected ${JSON.stringify(expected)}\n         got      ${JSON.stringify(actual)}`,
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(run, expression, what) {
  for (let i = 0; i < 100; i++) {
    if (await run(expression).catch(() => false)) return;
    await sleep(100);
  }
  throw new Error(`timed out waiting for ${what}`);
}

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

app.whenReady().then(async () => {
  const [win] = BrowserWindow.getAllWindows();
  win.hide(); // headless run: nothing to look at, and a window would steal focus
  const run = (code) => win.webContents.executeJavaScript(code);
  const problems = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level >= 2) problems.push(message);
  });

  try {
    await waitFor(run, '!!document.getElementById("kidRows")', 'the UI to start');

    // Native dialogs never return in a hidden window: answer them in the page.
    await run(`(() => {
      window.__confirm = true;
      window.__alerts = [];
      window.confirm = () => window.__confirm;
      window.alert = (m) => window.__alerts.push(m);
      return 'ok';
    })()`);

    const step = (name) => `document.querySelector('button[data-step="${name}"]').click()`;
    const names = () => run('[...document.querySelectorAll("#kidRows input")].map((i) => i.value)');

    // --- the session itself -------------------------------------------------
    await run(`(async () => {
      ${step('setup')};
      for (const [id, value] of [['startDate', '2026-07-07'], ['endDate', '2026-07-12']]) {
        const field = document.getElementById(id);
        field.value = value;
        field.dispatchEvent(new Event('change'));
      }
      await new Promise((r) => setTimeout(r, 400));
      return 'ok';
    })()`);
    check('the dates are written to the session file',
      JSON.parse(fs.readFileSync(path.join(profile, 'session.json'), 'utf8')).startDate === '2026-07-07');

    // --- adding children ---------------------------------------------------
    await run(`(async () => {
      ${step('kids')};
      document.getElementById('pasteBtn').click();
      document.getElementById('pasteBox').value = 'Nr\\tNumele și prenumele\\n1.\\tPopescu Ion\\n2.\\tIonescu Maria\\n3.\\tPopescu Ion';
      document.getElementById('pasteAdd').click();
      await new Promise((r) => setTimeout(r, 200));
      document.querySelector('.modal-actions button.primary').click();
      await new Promise((r) => setTimeout(r, 100));
      return 'ok';
    })()`);
    eq('a pasted list drops its header and row numbers', await names(), ['Popescu Ion', 'Ionescu Maria']);
    check('the repeated name was left unticked', (await run('window.__alerts.length')) === 0);

    await run(`(async () => {
      const q = document.getElementById('quickAdd');
      q.value = '  radu   eric ';
      q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise((r) => setTimeout(r, 50));
      return 'ok';
    })()`);
    eq('a typed name is added and tidied', (await names())[2], 'radu eric');

    // --- a photo import, kept with the session -----------------------------
    const photoId = await run(`(async () => {
      const { registerImport, appendNames } = await import('./shared/imports.js');
      const { state, save } = await import('./renderer.js');
      const { id, imports } = registerImport(state.session, { label: 'lista.png', kind: 'photo' });
      state.session.imports = imports;
      const stored = await window.api.storePhoto({
        id, ext: '.png', bytes: new Uint8Array([${[...PNG].join(',')}]).buffer,
      });
      imports[imports.length - 1].photo = stored.ok ? stored.path : '';
      state.session.kids = appendNames(state.session, id, ['GHIȚĂ ELENA']);
      save();
      await new Promise((r) => setTimeout(r, 400));
      return id;
    })()`);
    check('the photo is written into the app data directory',
      fs.existsSync(path.join(profile, 'photos', photoId + '.png')));

    // --- it all comes back after a restart ---------------------------------
    win.reload();
    await waitFor(run, '!!document.getElementById("kidRows")', 'the UI to come back');
    await run(`(() => { window.__confirm = true; window.__alerts = []; window.confirm = () => window.__confirm; window.alert = (m) => window.__alerts.push(m); return 'ok'; })()`);
    await run(step('kids'));
    eq('the list survives a restart', await names(), ['Popescu Ion', 'Ionescu Maria', 'radu eric', 'GHIȚĂ ELENA']);
    eq('the imports survive with it',
      await run('[...document.querySelectorAll(".import-entry figcaption > div")].map((d) => d.textContent)'),
      ['lista lipită', '2 nume în listă', 'lista.png', '1 nume în listă']);
    check('the photo is shown from the app data directory',
      await run(`document.querySelector('.import-entry img').src.includes('${photoId}')`));

    // --- removing a wrong import -------------------------------------------
    await run(`(async () => {
      [...document.querySelectorAll('.import-entry button')].pop().click();
      await new Promise((r) => setTimeout(r, 100));
      return 'ok';
    })()`);
    eq('removing an import takes its names with it', await names(), ['Popescu Ion', 'Ionescu Maria', 'radu eric']);
    check('the removal can still be undone', await run('!document.getElementById("undoBtn").hidden'));
    check('its photo is kept while undo is still possible',
      fs.existsSync(path.join(profile, 'photos', photoId + '.png')));

    await run(`(async () => {
      const first = document.querySelector('#kidRows input');
      first.value = 'POPESCU ION-CORECTAT';
      first.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 400));
      return 'ok';
    })()`);
    check('giving up the undo deletes the photo',
      !fs.existsSync(path.join(profile, 'photos', photoId + '.png')));

    // --- teachers, one gender per diploma ----------------------------------
    await run(`(async () => {
      ${step('teachers')};
      document.getElementById('addTeacher').click();
      const row = document.querySelector('#teacherRows tr');
      row.querySelector('input').value = 'MARIN ELENA';
      row.querySelector('input').dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 50));
      return 'ok';
    })()`);
    await run(`(async () => {
      ${step('generate')};
      document.getElementById('batch').value = 'teachers';
      document.getElementById('previewBtn').click();
      await new Promise((r) => setTimeout(r, 150));
      return 'ok';
    })()`);
    check('an undecided teacher blocks printing, by name',
      (await run('document.getElementById("genErrors").textContent')).includes('MARIN ELENA'));

    await run(`(async () => {
      ${step('teachers')};
      const select = document.querySelector('#teacherRows select');
      select.value = 'f';
      select.dispatchEvent(new Event('change'));
      ${step('generate')};
      document.getElementById('previewBtn').click();
      await new Promise((r) => setTimeout(r, 150));
      return 'ok';
    })()`);
    eq('her diploma names one gender',
      await run('[...document.querySelectorAll("#genPreview .diploma .award")].map((p) => p.textContent)'),
      ['SE ACORDĂ D-NEI ÎNSOȚITOARE']);

    // --- printing the children ---------------------------------------------
    await run(`(async () => {
      document.getElementById('batch').value = 'kids';
      document.getElementById('previewBtn').click();
      await new Promise((r) => setTimeout(r, 150));
      return 'ok';
    })()`);
    eq('one page per child', await run('document.querySelectorAll("#genPreview .diploma").length'), 3);
    eq('and the names on them are the corrected ones',
      await run('[...document.querySelectorAll("#genPreview .diploma .name")].map((p) => p.textContent)'),
      ['POPESCU ION-CORECTAT', 'Ionescu Maria', 'radu eric']);

    check('nothing was logged as an error', problems.length === 0, problems.join('\n         '));
  } catch (err) {
    check('the run finished', false, err.stack || String(err));
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(failed ? 1 : 0);
});
