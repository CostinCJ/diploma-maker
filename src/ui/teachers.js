// src/ui/teachers.js
// The same editable list as the children's, plus the one thing an accompanying
// adult's diploma needs: the gender it is worded for, chosen next to the name.
import { createNameTable } from './nameTable.js';

export function init(state, save) {
  const el = document.getElementById('step-teachers');
  el.innerHTML = `
    <h2>Însoțitori</h2>
    <p class="muted">
      Scrie numele fiecărui însoțitor și alege forma care apare pe diploma lui —
      sunt puțini, nu e nevoie de poze.
    </p>
    <div id="teacherTable"></div>
    <p class="error" id="teacherWarning"></p>`;

  const warningEl = el.querySelector('#teacherWarning');

  /** Say it here rather than only at printing time, where it blocks the job. */
  function updateWarning() {
    const unset = state.session.teachers.filter((t) => t.name.trim() && !t.gender).length;
    warningEl.textContent = unset
      ? `${unset} ${unset === 1 ? 'însoțitor așteaptă' : 'însoțitori așteaptă'} forma de pe diplomă.`
      : '';
  }

  createNameTable(el.querySelector('#teacherTable'), {
    rows: () => state.session.teachers,
    newRow: () => ({ name: '', gender: '' }),
    gender: true,
    placeholder: 'Scrie un nume și apasă Enter',
    countNoun: ['însoțitor în listă', 'însoțitori în listă'],
    onEdit: () => { save(); updateWarning(); },
  });

  updateWarning();
}
