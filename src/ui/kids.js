// src/ui/kids.js
import { prepareImageFile } from '../ocr/preprocess.js';
import { readNamesFromImage } from '../ocr/readNames.js';
import { parseTextList, normalizeName } from '../shared/importList.js';
import { namesFromFile, SUPPORTED_EXTENSIONS } from '../shared/importFile.js';
import { registerImport, appendNames, removeImport, countFromImport } from '../shared/imports.js';
import { countedNoun } from '../shared/roText.js';
import { fileUrl } from '../shared/fileUrl.js';
import { showImportPreview } from './importPreview.js';

const DOC_ACCEPT = SUPPORTED_EXTENSIONS.map((e) => '.' + e).join(',');
const isImage = (file) => file.type.startsWith('image/');

// The kids step re-initialises whenever the session is replaced, so the one
// document-level listener is swapped instead of stacking up.
let pasteHandler = null;

export function init(state, save) {
  const el = document.getElementById('step-kids');
  el.innerHTML = `
    <h2>Copii</h2>
    <div class="row">
      <div id="importZone">
        <input type="file" id="kidPhotos" accept="image/*" multiple hidden>
        <input type="file" id="kidDocs" accept="${DOC_ACCEPT}" multiple hidden>
        <div class="toolbar">
          <button class="primary" id="importBtn">Importă poze cu liste…</button>
          <button class="primary" id="importDocBtn">Importă fișier…</button>
          <button class="small" id="pasteBtn">Lipește o listă</button>
          <span class="muted" id="ocrStatus"></span>
        </div>
        <p class="muted">
          Trage aici pozele sau fișierele (Word, Excel, CSV, text), lipește lista cu Ctrl+V,
          ori scrie numele unul câte unul. Numele apar mai jos — verifică-le cu poza alăturată
          și corectează unde e nevoie. Dacă ai importat ceva greșit, șterge importul din dreapta.
        </p>
        <div id="pastePanel" hidden>
          <textarea id="pasteBox" rows="8" placeholder="Un nume pe rând — copiat din Word, Excel, WhatsApp sau e-mail."></textarea>
          <div class="toolbar">
            <button class="primary" id="pasteAdd">Adaugă numele</button>
            <button class="small" id="pasteCancel">Închide</button>
          </div>
        </div>
        <div class="toolbar">
          <input type="text" id="quickAdd" placeholder="Scrie un nume și apasă Enter">
          <button class="small" id="addKid">+ Adaugă rând gol</button>
          <button class="small" id="undoBtn" hidden></button>
        </div>
        <p class="muted" id="kidCount"></p>
        <table class="names"><tbody id="kidRows"></tbody></table>
      </div>
      <div id="importPanel"></div>
    </div>`;

  const rowsEl = el.querySelector('#kidRows');
  const statusEl = el.querySelector('#ocrStatus');
  const photoInput = el.querySelector('#kidPhotos');
  const docInput = el.querySelector('#kidDocs');
  const undoBtn = el.querySelector('#undoBtn');

  // The list as it was before the last import or import removal, so one wrong
  // move can be taken back in a click. Any hand edit afterwards drops it: the
  // guide has moved on, and restoring would throw their correction away.
  let undo = null;

  function rememberFor(label) {
    undo = { label, kids: [...state.session.kids], imports: [...state.session.imports] };
  }

  function forgetUndo() {
    // Until the undo is given up, a removed import's photo has to stay on disk
    // — that is the only copy. Once it cannot come back, the file goes.
    const wasUndoable = undo !== null;
    undo = null;
    undoBtn.hidden = true;
    if (wasUndoable) window.api.purgePhotos(state.session.imports.map((i) => i.id));
  }

  function render() {
    rowsEl.innerHTML = '';
    const total = state.session.kids.length;
    el.querySelector('#kidCount').textContent = total ? countedNoun(total, 'nume în listă', 'nume în listă') : '';
    undoBtn.hidden = !undo;
    if (undo) undoBtn.textContent = `↶ Anulează ${undo.label}`;
    state.session.kids.forEach((kid, i) => {
      const tr = document.createElement('tr');
      const num = document.createElement('td');
      num.textContent = (i + 1) + '.';
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = kid.name;
      input.addEventListener('input', () => { kid.name = input.value; forgetUndo(); save(); });
      cell.appendChild(input);
      const ops = document.createElement('td');
      for (const [label, fn] of [
        ['↑', () => { if (i > 0) { const k = state.session.kids; [k[i - 1], k[i]] = [k[i], k[i - 1]]; forgetUndo(); save(); render(); } }],
        ['↓', () => { const k = state.session.kids; if (i < k.length - 1) { [k[i + 1], k[i]] = [k[i], k[i + 1]]; forgetUndo(); save(); render(); } }],
        ['✕', () => { state.session.kids.splice(i, 1); forgetUndo(); save(); render(); renderImports(); }],
      ]) {
        const b = document.createElement('button');
        b.className = 'small';
        b.textContent = label;
        b.addEventListener('click', fn);
        ops.appendChild(b);
      }
      tr.append(num, cell, ops);
      rowsEl.appendChild(tr);
    });
  }

  /** Everything that was imported, with the photo it came from when there is
   *  one, and a way out for each. */
  function renderImports() {
    const panel = el.querySelector('#importPanel');
    panel.innerHTML = '';
    if (!state.session.imports.length) return;

    const heading = document.createElement('h3');
    heading.textContent = 'Ce ai importat';
    panel.appendChild(heading);

    for (const entry of state.session.imports) {
      const count = countFromImport(state.session.kids, entry.id);
      const fig = document.createElement('figure');
      fig.className = 'import-entry';

      if (entry.photo) {
        const img = document.createElement('img');
        img.src = fileUrl(entry.photo);
        fig.appendChild(img);
      }

      const caption = document.createElement('figcaption');
      const title = document.createElement('div');
      title.textContent = entry.label; // a file name may contain <, & or quotes
      const note = document.createElement('div');
      note.className = 'muted';
      note.textContent = count ? countedNoun(count, 'nume în listă', 'nume în listă') : 'niciun nume în listă';
      const remove = document.createElement('button');
      remove.className = 'small';
      remove.textContent = '✕ Șterge importul';
      remove.addEventListener('click', () => {
        const what = count
          ? `Ștergi „${entry.label}”? Dispar și cele ${countedNoun(count, 'nume rămas', 'nume rămase')} din el.`
          : `Ștergi „${entry.label}”?`;
        if (!confirm(what)) return;
        rememberFor(`ștergerea importului „${entry.label}”`);
        const { kids, imports } = removeImport(state.session, entry.id);
        state.session.kids = kids;
        state.session.imports = imports;
        save();
        render();
        renderImports();
      });

      caption.append(title, note, remove);
      fig.appendChild(caption);
      panel.appendChild(fig);
    }
  }

  function refresh() {
    save();
    render();
    renderImports();
  }

  /** Every source ends here: show what was found and add what was ticked, under
   *  the import it came from. `into` is the import a photo was already listed
   *  as — its snapshot was taken before the photo appeared, so undoing removes
   *  the photo along with its names. */
  async function offerNames(found, source, kind, into = null) {
    const names = found.map(normalizeName).filter(Boolean);
    if (!names.length) {
      alert(`Niciun nume găsit în ${source}.`);
      return;
    }
    const chosen = await showImportPreview({ names, existing: state.session.kids.map((k) => k.name), source });
    if (!chosen.length) return;

    let id = into;
    if (!id) {
      rememberFor(`importul „${source}”`);
      const registered = registerImport(state.session, { label: source, kind });
      id = registered.id;
      state.session.imports = registered.imports;
    }
    state.session.kids = appendNames(state.session, id, chosen);
    refresh();
  }

  undoBtn.addEventListener('click', () => {
    if (!undo) return;
    const { kids, imports } = undo;
    state.session.kids = kids;
    state.session.imports = imports;
    undo = null;
    refresh();
  });

  // --- photos (OCR) ---------------------------------------------------------

  let importing = false;

  async function importPhotos(files) {
    // One OCR run at a time: the worker is shared and each run sets the page
    // segmentation mode, so overlapping imports could read with the wrong one.
    if (importing) return;
    importing = true;
    const importBtn = el.querySelector('#importBtn');
    importBtn.disabled = true;
    try {
      for (const file of files) {
        statusEl.textContent = `Se procesează ${file.name}…`;
        try {
          const prepared = await prepareImageFile(file);
          const { names } = await readNamesFromImage(
            prepared,
            async (dataUrl) => {
              const res = await window.api.ocrRecognize(dataUrl);
              if (!res.ok) throw new Error(res.error);
              return res.text;
            },
            // Several segmentation attempts may run; report which one is in
            // flight so a slow import does not look frozen.
            (label, n) => { statusEl.textContent = `${file.name}: încercarea ${n} (${label})…`; },
          );
          statusEl.textContent = '';
          if (names.length === 0) {
            alert(`Nicio linie recunoscută în ${file.name} — verifică poza și încearcă din nou.`);
          }
          // The photo is listed before the names are confirmed: it is the thing
          // being checked against, and a wrong photo has to be removable even
          // if none of its names were kept.
          rememberFor(`importul „${file.name}”`);
          const { id, imports } = registerImport(state.session, { label: file.name, kind: 'photo' });
          state.session.imports = imports;
          // Keep the photo with the session: the list is checked against it,
          // and that check often continues on another day.
          const stored = await window.api.storePhoto({
            id,
            ext: /\.[a-z0-9]+$/i.exec(file.name)?.[0]?.toLowerCase() ?? '.png',
            bytes: await file.arrayBuffer(),
          });
          if (stored.ok) imports[imports.length - 1].photo = stored.path;
          else console.error('[kids] photo not stored:', stored.error);
          refresh();
          if (names.length) await offerNames(names, file.name, 'photo', id);
        } catch (err) {
          alert(err.message);
        }
      }
    } finally {
      statusEl.textContent = '';
      importBtn.disabled = false;
      importing = false;
    }
  }

  // --- documents (Word, Excel, CSV, text) -----------------------------------

  async function importDocs(files) {
    for (const file of files) {
      try {
        statusEl.textContent = `Se citește ${file.name}…`;
        const names = await namesFromFile(file.name, await file.arrayBuffer());
        statusEl.textContent = '';
        await offerNames(names, file.name, 'file');
      } catch (err) {
        statusEl.textContent = '';
        alert(err.message);
      }
    }
  }

  /** Photos go to OCR, everything else is read as a list file. */
  async function importFiles(files) {
    const all = [...files];
    const photos = all.filter(isImage);
    const docs = all.filter((f) => !isImage(f));
    if (photos.length) await importPhotos(photos);
    if (docs.length) await importDocs(docs);
  }

  el.querySelector('#importBtn').addEventListener('click', () => photoInput.click());
  photoInput.addEventListener('change', async () => {
    await importPhotos([...photoInput.files]);
    photoInput.value = '';
  });
  el.querySelector('#importDocBtn').addEventListener('click', () => docInput.click());
  docInput.addEventListener('change', async () => {
    await importDocs([...docInput.files]);
    docInput.value = '';
  });

  const zone = el.querySelector('#importZone');
  zone.addEventListener('dragover', (e) => { e.preventDefault(); });
  zone.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (e.dataTransfer.files.length) await importFiles(e.dataTransfer.files);
  });

  // --- pasting --------------------------------------------------------------

  const pastePanel = el.querySelector('#pastePanel');
  const pasteBox = el.querySelector('#pasteBox');

  function openPastePanel(text = '') {
    pastePanel.hidden = false;
    if (text) pasteBox.value = pasteBox.value ? `${pasteBox.value}\n${text}` : text;
    pasteBox.focus();
  }

  el.querySelector('#pasteBtn').addEventListener('click', () => {
    if (pastePanel.hidden) openPastePanel(); else pastePanel.hidden = true;
  });
  el.querySelector('#pasteCancel').addEventListener('click', () => { pastePanel.hidden = true; });
  el.querySelector('#pasteAdd').addEventListener('click', async () => {
    await offerNames(parseTextList(pasteBox.value), 'lista lipită', 'paste');
    pasteBox.value = '';
    pastePanel.hidden = true;
  });

  // Ctrl+V anywhere on this step: a screenshot of a list goes to OCR, text goes
  // to the paste box. Typing into a field is left alone.
  if (pasteHandler) document.removeEventListener('paste', pasteHandler);
  pasteHandler = async (e) => {
    if (!el.classList.contains('active')) return;
    if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const image = [...(e.clipboardData?.files ?? [])].find(isImage);
    if (image) {
      e.preventDefault();
      await importPhotos([image]);
      return;
    }
    const text = e.clipboardData?.getData('text') ?? '';
    if (text.trim()) {
      e.preventDefault();
      openPastePanel(text.trim());
    }
  };
  document.addEventListener('paste', pasteHandler);

  // --- typing ---------------------------------------------------------------

  const quickAdd = el.querySelector('#quickAdd');
  quickAdd.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const name = normalizeName(quickAdd.value);
    if (!name) return;
    state.session.kids.push({ name, importId: '' });
    forgetUndo();
    save();
    render();
    quickAdd.value = '';
    quickAdd.focus(); // render() rebuilds the table, not this field
  });

  el.querySelector('#addKid').addEventListener('click', () => {
    state.session.kids.push({ name: '', importId: '' });
    forgetUndo();
    save();
    render();
    rowsEl.querySelector('tr:last-child input')?.focus();
  });

  render();
  renderImports();
}
