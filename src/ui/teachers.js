// src/ui/teachers.js
// Each accompanying adult's diploma names one gender, so the wording is chosen
// here, next to the name — it is the only moment someone knows which it is.
const FORMS = [
  { value: 'm', label: 'însoțitor' },
  { value: 'f', label: 'însoțitoare' },
];

export function init(state, save) {
  const el = document.getElementById('step-teachers');
  el.innerHTML = `
    <h2>Însoțitori</h2>
    <p class="muted">
      Scrie numele fiecărui însoțitor și alege forma care apare pe diploma lui —
      sunt puțini, nu e nevoie de poze.
    </p>
    <table class="names"><tbody id="teacherRows"></tbody></table>
    <button class="small" id="addTeacher">+ Adaugă însoțitor</button>
    <p class="error" id="teacherWarning"></p>`;

  const rowsEl = el.querySelector('#teacherRows');
  const warningEl = el.querySelector('#teacherWarning');

  function render() {
    rowsEl.innerHTML = '';
    state.session.teachers.forEach((teacher, i) => {
      const tr = document.createElement('tr');
      const num = document.createElement('td');
      num.textContent = (i + 1) + '.';

      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = teacher.name;
      input.addEventListener('input', () => { teacher.name = input.value; save(); updateWarning(); });
      cell.appendChild(input);

      const form = document.createElement('td');
      const select = document.createElement('select');
      const empty = document.createElement('option');
      empty.value = '';
      empty.textContent = 'alege forma…';
      select.appendChild(empty);
      for (const { value, label } of FORMS) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }
      select.value = teacher.gender;
      select.classList.toggle('unset', !teacher.gender);
      select.addEventListener('change', () => {
        teacher.gender = select.value;
        select.classList.toggle('unset', !teacher.gender);
        save();
        updateWarning();
      });
      form.appendChild(select);

      const ops = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'small';
      del.textContent = '✕';
      del.addEventListener('click', () => { state.session.teachers.splice(i, 1); save(); render(); });
      ops.appendChild(del);

      tr.append(num, cell, form, ops);
      rowsEl.appendChild(tr);
    });
    updateWarning();
  }

  /** Say it here rather than only at printing time, where it blocks the job. */
  function updateWarning() {
    const unset = state.session.teachers.filter((t) => t.name.trim() && !t.gender).length;
    warningEl.textContent = unset
      ? `${unset} ${unset === 1 ? 'însoțitor așteaptă' : 'însoțitori așteaptă'} forma de pe diplomă.`
      : '';
  }

  el.querySelector('#addTeacher').addEventListener('click', () => {
    state.session.teachers.push({ name: '', gender: '' });
    save(); render();
    rowsEl.querySelector('tr:last-child input')?.focus();
  });

  render();
}
