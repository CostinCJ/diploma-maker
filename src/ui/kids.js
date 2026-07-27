// src/ui/kids.js
import { normalizeName } from '../shared/importList.js';
import { registerImport, appendNames, removeImport, countFromImport } from '../shared/imports.js';
import { countedNoun } from '../shared/roText.js';
import { fileUrl } from '../shared/fileUrl.js';
import { createImportSources } from './importSources.js';
import { createNameTable } from './nameTable.js';
import { showImportPreview } from './importPreview.js';

export function init(state, save) {
  const el = document.getElementById('step-kids');
  el.innerHTML = `
    <h2>Copii</h2>
    <div class="row">
      <div id="importZone">
        <div id="kidSources"></div>
        <div id="kidTable"></div>
      </div>
      <div id="importPanel"></div>
    </div>`;

  // The list as it was before the last import or import removal, so one wrong
  // move can be taken back in a click. Any hand edit afterwards drops it: the
  // guide has moved on, and restoring would throw their correction away.
  let undo = null;

  const undoBtn = document.createElement('button');
  undoBtn.id = 'undoBtn';
  undoBtn.className = 'small';
  undoBtn.hidden = true;

  function showUndo() {
    undoBtn.hidden = !undo;
    if (undo) undoBtn.textContent = `↶ Anulează ${undo.label}`;
  }

  function rememberFor(label) {
    undo = { label, kids: [...state.session.kids], imports: [...state.session.imports] };
    showUndo();
  }

  function forgetUndo() {
    // Until the undo is given up, a removed import's photo has to stay on disk
    // — that is the only copy. Once it cannot come back, the file goes.
    const wasUndoable = undo !== null;
    undo = null;
    showUndo();
    if (wasUndoable) window.api.purgePhotos(state.session.imports.map((i) => i.id));
  }

  const table = createNameTable(el.querySelector('#kidTable'), {
    rows: () => state.session.kids,
    newRow: () => ({ name: '', importId: '' }),
    onEdit: () => { forgetUndo(); save(); renderImports(); },
  });
  table.toolbar.appendChild(undoBtn);

  function refresh() {
    save();
    table.render();
    renderImports();
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
        refresh();
      });

      caption.append(title, note, remove);
      fig.appendChild(caption);
      panel.appendChild(fig);
    }
  }

  undoBtn.addEventListener('click', () => {
    if (!undo) return;
    const { kids, imports } = undo;
    state.session.kids = kids;
    state.session.imports = imports;
    undo = null;
    showUndo();
    refresh();
  });

  /** Every source ends here: keep the photo it came from, show what was found,
   *  and add the names that were ticked under that import. */
  async function receive({ names: found, label, kind, file }) {
    const names = found.map(normalizeName).filter(Boolean);
    let id = null;

    if (file) {
      // The photo is listed before the names are confirmed: it is the thing
      // being checked against, and a wrong photo has to be removable even if
      // none of its names were kept.
      rememberFor(`importul „${label}”`);
      const registered = registerImport(state.session, { label, kind });
      id = registered.id;
      state.session.imports = registered.imports;
      // Keep it with the session: the check against the photo often continues
      // on another day.
      const stored = await window.api.storePhoto({
        id,
        ext: /\.[a-z0-9]+$/i.exec(file.name)?.[0]?.toLowerCase() ?? '.png',
        bytes: await file.arrayBuffer(),
      });
      if (stored.ok) registered.imports[registered.imports.length - 1].photo = stored.path;
      else console.error('[kids] photo not stored:', stored.error);
      refresh();
    }

    if (!names.length) {
      if (!file) alert(`Niciun nume găsit în ${label}.`); // photos report it themselves
      return;
    }
    const chosen = await showImportPreview({
      names,
      existing: state.session.kids.map((k) => k.name),
      source: label,
    });
    if (!chosen.length) return;

    if (!id) {
      rememberFor(`importul „${label}”`);
      const registered = registerImport(state.session, { label, kind });
      id = registered.id;
      state.session.imports = registered.imports;
    }
    state.session.kids = appendNames(state.session, id, chosen);
    refresh();
  }

  createImportSources(el.querySelector('#kidSources'), {
    onNames: receive,
    isActive: () => el.classList.contains('active'),
    dropZone: el.querySelector('#importZone'), // the whole left half, not just the buttons
  });

  renderImports();
}
