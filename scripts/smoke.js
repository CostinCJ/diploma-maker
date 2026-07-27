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

// A session left by an older version: one file, names as plain strings, the
// teacher award line naming both genders. Starting on it exercises the
// migration every existing install will go through on upgrade.
fs.writeFileSync(path.join(profile, 'session.json'), JSON.stringify({
  kids: ['MIGRAT ION'],
  teachers: ['MARIN ELENA'],
  templates: { teacher: { awardLine: 'SE ACORDĂ D-LUI/D-NEI ÎNSOȚITOR/ÎNSOȚITOARE' } },
}));

const currentSession = () => JSON.parse(fs.readFileSync(
  path.join(profile, 'sessions', JSON.parse(fs.readFileSync(path.join(profile, 'current.json'), 'utf8')).id + '.json'),
  'utf8',
));

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

async function waitFor(run, expression, what, tries = 100) {
  for (let i = 0; i < tries; i++) {
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
    await waitFor(run, '!!document.querySelector("#kidTable tbody")', 'the UI to start');

    // Native dialogs never return in a hidden window: answer them in the page.
    await run(`(() => {
      window.__confirm = true;
      window.__alerts = [];
      window.confirm = () => window.__confirm;
      window.alert = (m) => window.__alerts.push(m);
      return 'ok';
    })()`);

    const step = (name) => `document.querySelector('button[data-step="${name}"]').click()`;
    const names = () => run('[...document.querySelectorAll("#kidTable tbody input")].map((i) => i.value)');

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
    check('the dates are written to the session file', currentSession().startDate === '2026-07-07');
    check('a session.json from an older version was migrated',
      !fs.existsSync(path.join(profile, 'session.json')));

    // A group photo to try the slider against (picking one opens a dialog).
    const background = path.join(profile, 'group.png');
    fs.writeFileSync(background, PNG);
    eq('the group photo slider reaches the rendered diploma',
      await run(`(async () => {
        ${step('setup')};
        const { state, save } = await import('./renderer.js');
        state.session.background = ${JSON.stringify(background)};
        const slider = document.getElementById('bgOpacity');
        slider.value = '20';
        slider.dispatchEvent(new Event('input'));
        await new Promise((r) => setTimeout(r, 400));
        return [
          document.querySelector('#setupPreview .bg').getAttribute('style'),
          document.getElementById('bgOpacityValue').textContent,
          state.session.backgroundOpacity,
        ];
      })()`), ['opacity:0.2', '20%', 0.2]);
    check('and is written to the session file', currentSession().backgroundOpacity === 0.2);
    eq('the printed diploma uses the same value',
      await run(`(async () => {
        const { renderDiplomaHtml } = await import('./shared/diplomaHtml.js');
        const { diplomaAssets } = await import('./ui/diplomaPreview.js');
        const { state } = await import('./renderer.js');
        const { DEFAULT_TEMPLATES } = await import('./shared/template.js');
        const html = renderDiplomaHtml(DEFAULT_TEMPLATES.kid, 'A B', { start: '', end: '' }, diplomaAssets(state.session));
        return /<img class="bg"[^>]*style="([^"]*)"/.exec(html)[1];
      })()`), 'opacity:0.2');

    // --- adding children ---------------------------------------------------
    await run(`(async () => {
      ${step('kids')};
      document.querySelector('#kidSources .paste-btn').click();
      document.querySelector('#kidSources .paste-box').value = 'Nr\\tNumele și prenumele\\n1.\\tPopescu Ion\\n2.\\tIonescu Maria\\n3.\\tPopescu Ion';
      document.querySelector('#kidSources .paste-add').click();
      await new Promise((r) => setTimeout(r, 200));
      document.querySelector('.modal-actions button.primary').click();
      await new Promise((r) => setTimeout(r, 100));
      return 'ok';
    })()`);
    eq('the names of an older session are still there, with the pasted ones',
      await names(), ['MIGRAT ION', 'Popescu Ion', 'Ionescu Maria']);
    check('the repeated name was left unticked', (await run('window.__alerts.length')) === 0);

    await run(`(async () => {
      const q = document.querySelector('#kidTable .quick-add');
      q.value = '  radu   eric ';
      q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
      await new Promise((r) => setTimeout(r, 50));
      return 'ok';
    })()`);
    eq('a typed name is added and tidied', (await names())[3], 'radu eric');

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
    await waitFor(run, '!!document.querySelector("#kidTable tbody")', 'the UI to come back');
    await run(`(() => { window.__confirm = true; window.__alerts = []; window.confirm = () => window.__confirm; window.alert = (m) => window.__alerts.push(m); return 'ok'; })()`);
    await run(step('kids'));
    eq('the list survives a restart', await names(),
      ['MIGRAT ION', 'Popescu Ion', 'Ionescu Maria', 'radu eric', 'GHIȚĂ ELENA']);
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
    eq('removing an import takes its names with it', await names(),
      ['MIGRAT ION', 'Popescu Ion', 'Ionescu Maria', 'radu eric']);
    check('the removal can still be undone', await run('!document.getElementById("undoBtn").hidden'));
    check('its photo is kept while undo is still possible',
      fs.existsSync(path.join(profile, 'photos', photoId + '.png')));

    await run(`(async () => {
      const row = document.querySelectorAll('#kidTable tbody input')[1];
      row.value = 'POPESCU ION-CORECTAT';
      row.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 400));
      return 'ok';
    })()`);
    check('giving up the undo deletes the photo',
      !fs.existsSync(path.join(profile, 'photos', photoId + '.png')));

    // --- teachers, one gender per diploma ----------------------------------
    await run(`(async () => {
      ${step('teachers')};
      const row = document.querySelector('#teacherTable tbody tr');
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
    eq('the adults get the same add-a-name field as the children',
      await run(`(async () => {
        const q = document.querySelector('#teacherTable .quick-add');
        q.value = 'BARBU ANDREI';
        q.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
        await new Promise((r) => setTimeout(r, 50));
        const rows = [...document.querySelectorAll('#teacherTable tbody tr')];
        return rows.map((tr) => tr.querySelector('input').value);
      })()`), ['MARIN ELENA', 'BARBU ANDREI']);
    await run(`(async () => {
      [...document.querySelectorAll('#teacherTable tbody tr')].pop().querySelector('button:nth-child(3)').click();
      await new Promise((r) => setTimeout(r, 50));
      return 'ok';
    })()`);

    check('an undecided teacher blocks printing, by name',
      (await run('document.getElementById("genErrors").textContent')).includes('MARIN ELENA'));

    await run(`(async () => {
      ${step('teachers')};
      const select = document.querySelector('#teacherTable select');
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

    // --- how each line of the sheet is set ---------------------------------
    await run(`(async () => {
      ${step('templates')};
      const fields = [...document.querySelectorAll('#tplFields .field')];
      const size = fields[0].querySelector('.size-input');
      size.value = '52';
      size.dispatchEvent(new Event('input'));
      fields[0].querySelector('.fmt-italic').click();
      // The name line has no text field here — its text comes from the list —
      // but it is the one whose size matters most.
      fields[2].querySelector('.fmt-bold').click();
      await new Promise((r) => setTimeout(r, 400));
      return 'ok';
    })()`);
    eq('the size and the emphasis of a line reach the preview',
      await run('document.querySelector("#tplPreview h1").getAttribute("style")'),
      'font-size:52pt;font-style:italic');
    eq('the name line can be set even though its text is not typed here',
      await run('document.querySelector("#tplPreview .name").getAttribute("style")'),
      'font-weight:normal');
    check('and all of it is written to the session file',
      currentSession().templates.kid.styles.title.size === 52
      && currentSession().templates.kid.styles.title.italic === true
      && currentSession().templates.kid.styles.name.bold === false);
    check('a line left alone is still left to the stylesheet',
      await run('!document.querySelector("#tplPreview .dates").getAttribute("style")'));

    // --- printing the children ---------------------------------------------
    await run(`(async () => {
      document.getElementById('batch').value = 'kids';
      document.getElementById('previewBtn').click();
      await new Promise((r) => setTimeout(r, 150));
      return 'ok';
    })()`);
    eq('one page per child', await run('document.querySelectorAll("#genPreview .diploma").length'), 4);
    eq('the pages about to be printed carry the chosen line settings',
      await run('document.querySelector("#genPreview .diploma h1").getAttribute("style")'),
      'font-size:52pt;font-style:italic');
    eq('and the names on them are the corrected ones',
      await run('[...document.querySelectorAll("#genPreview .diploma .name")].map((p) => p.textContent)'),
      ['MIGRAT ION', 'POPESCU ION-CORECTAT', 'Ionescu Maria', 'radu eric']);

    // --- a second session, side by side ------------------------------------
    await run(`(async () => {
      ${step('setup')};
      const name = document.getElementById('sessionName');
      name.value = 'Seria 1';
      name.dispatchEvent(new Event('input'));
      await new Promise((r) => setTimeout(r, 400));
      document.getElementById('newSession').click();
      await new Promise((r) => setTimeout(r, 400));
      return 'ok';
    })()`);
    eq('a new session starts empty', await names(), []);
    eq('and does not disturb the first one',
      (await run('window.api.listSessions()')).map((s) => `${s.name}:${s.kids}`).sort(),
      [':0', 'Seria 1:4']);
    eq('the edited wording comes along',
      await run(`(async () => {
        const { state } = await import('./renderer.js');
        return state.session.templates.teacher.awardLineF;
      })()`),
      'SE ACORDĂ D-NEI ÎNSOȚITOARE');

    await run(`(async () => {
      ${step('setup')};
      const picker = document.getElementById('sessionPicker');
      picker.value = [...picker.options].find((o) => o.textContent.startsWith('Seria 1')).value;
      picker.dispatchEvent(new Event('change'));
      await new Promise((r) => setTimeout(r, 500));
      return 'ok';
    })()`);
    eq('switching back brings the first list with it', await names(),
      ['MIGRAT ION', 'POPESCU ION-CORECTAT', 'Ionescu Maria', 'radu eric']);

    await run(`(async () => {
      ${step('setup')};
      document.getElementById('deleteSession').click();
      await new Promise((r) => setTimeout(r, 500));
      return 'ok';
    })()`);
    eq('deleting a session leaves the other one open',
      (await run('window.api.listSessions()')).length, 1);
    eq('and clears its names', await names(), []);

    // --- a real photo, through OCR ------------------------------------------
    // The model is not in the repository, so this stage is skipped where it is
    // missing rather than failing (see "Getting started" in the README).
    if (!fs.existsSync(path.join(__dirname, '..', 'ocr-data', 'ron.traineddata'))) {
      console.log('  skip  the OCR import (ocr-data/ron.traineddata is missing)');
    } else {
      await run(`(async () => {
        ${step('kids')};
        // A printed list, drawn rather than photographed: this checks the
        // pipeline from a dropped file to names in the table, not Tesseract.
        const canvas = document.createElement('canvas');
        canvas.width = 1000;
        canvas.height = 700;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000';
        ctx.font = '48px sans-serif';
        ['TABEL PARTICIPANTI', '1. POPESCU ANDREI', '2. MARIN VLAD', '3. RADU STEFAN']
          .forEach((line, i) => ctx.fillText(line, 60, 120 + i * 130));
        const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], 'lista-scanata.png', { type: 'image/png' });
        const data = new DataTransfer();
        data.items.add(file);
        document.getElementById('importZone').dispatchEvent(
          new DragEvent('drop', { dataTransfer: data, bubbles: true, cancelable: true }),
        );
        return 'ok';
      })()`);
      await waitFor(run, '!!document.querySelector(".modal")', 'OCR to finish', 600);
      await run(`(async () => {
        document.querySelector('.modal-actions button.primary').click();
        await new Promise((r) => setTimeout(r, 300));
        return 'ok';
      })()`);
      const read = await names();
      check('a dropped photo is read and its names land in the list',
        read.length >= 2, `got ${JSON.stringify(read)}`);
      check('the photo it was read from is kept',
        (await run('document.querySelectorAll(".import-entry img").length')) === 1);
    }

    check('nothing was logged as an error', problems.length === 0, problems.join('\n         '));
  } catch (err) {
    check('the run finished', false, err.stack || String(err));
  }

  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  fs.rmSync(profile, { recursive: true, force: true });
  app.exit(failed ? 1 : 0);
});
