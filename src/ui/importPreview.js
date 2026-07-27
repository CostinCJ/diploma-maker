// src/ui/importPreview.js
// The one screen every source of names goes through — photos, paste, Word,
// Excel, CSV. Names land in the session only after the guide has seen them,
// which is also the only place duplicates can be caught before printing.
import { planImport } from '../shared/importList.js';
import { countedNoun } from '../shared/roText.js';

const LABEL = {
  existing: 'deja în listă',
  repeat: 'de două ori în import',
};

/** Show the names an import found and resolve with the ones to keep (an empty
 *  array if the guide cancelled). Duplicates start unticked but can be ticked:
 *  two children really can share a name, and only the guide knows. */
export function showImportPreview({ names, existing, source }) {
  return new Promise((resolve) => {
    const rows = planImport(existing, names);
    const fresh = rows.filter((r) => r.status === 'new').length;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal';
    overlay.appendChild(box);

    const title = document.createElement('h3');
    title.textContent = `${countedNoun(names.length, 'nume găsit', 'nume găsite')} în ${source}`;
    const summary = document.createElement('p');
    summary.className = 'muted';
    summary.textContent = rows.length === fresh
      ? 'Verifică numele și corectează-le în listă după import.'
      : `${countedNoun(fresh, 'nume nou', 'nume noi')}, ${rows.length - fresh} deja cunoscute (nebifate).`;

    const list = document.createElement('div');
    list.className = 'import-list';
    const boxes = rows.map(({ name, status }) => {
      const label = document.createElement('label');
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = status === 'new';
      const text = document.createElement('span');
      text.textContent = name; // a name may contain characters that are HTML
      label.append(check, text);
      if (status !== 'new') {
        const tag = document.createElement('em');
        tag.className = 'muted';
        tag.textContent = ` — ${LABEL[status]}`;
        label.appendChild(tag);
      }
      list.appendChild(label);
      return { check, name };
    });

    const actions = document.createElement('div');
    actions.className = 'modal-actions';
    const toggle = document.createElement('button');
    toggle.className = 'small';
    toggle.textContent = 'Bifează tot';
    const cancel = document.createElement('button');
    cancel.className = 'small';
    cancel.textContent = 'Renunță';
    const confirm = document.createElement('button');
    confirm.className = 'primary';

    const chosen = () => boxes.filter((b) => b.check.checked).map((b) => b.name);
    const refresh = () => {
      const n = chosen().length;
      confirm.textContent = n ? `Adaugă ${countedNoun(n, 'nume', 'nume')}` : 'Nu adăuga nimic';
      toggle.textContent = n === boxes.length ? 'Debifează tot' : 'Bifează tot';
    };
    list.addEventListener('change', refresh);
    toggle.addEventListener('click', () => {
      const all = chosen().length === boxes.length;
      boxes.forEach((b) => { b.check.checked = !all; });
      refresh();
    });

    function close(result) {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') close([]);
      if (e.key === 'Enter' && e.target.tagName !== 'BUTTON') close(chosen());
    }
    cancel.addEventListener('click', () => close([]));
    confirm.addEventListener('click', () => close(chosen()));
    document.addEventListener('keydown', onKey);

    actions.append(toggle, cancel, confirm);
    box.append(title, summary, list, actions);
    document.body.appendChild(overlay);
    refresh();
    confirm.focus();
  });
}
