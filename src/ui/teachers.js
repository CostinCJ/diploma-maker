// src/ui/teachers.js
export function init(state, save) {
  const el = document.getElementById('step-teachers');
  el.innerHTML = `
    <h2>Însoțitori</h2>
    <p class="muted">Scrie numele fiecărui însoțitor — sunt puțini, nu e nevoie de poze.</p>
    <table class="names"><tbody id="teacherRows"></tbody></table>
    <button class="small" id="addTeacher">+ Adaugă însoțitor</button>`;

  const rowsEl = el.querySelector('#teacherRows');

  function render() {
    rowsEl.innerHTML = '';
    state.session.teachers.forEach((name, i) => {
      const tr = document.createElement('tr');
      const num = document.createElement('td');
      num.textContent = (i + 1) + '.';
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = name;
      input.addEventListener('input', () => { state.session.teachers[i] = input.value; save(); });
      cell.appendChild(input);
      const ops = document.createElement('td');
      const del = document.createElement('button');
      del.className = 'small';
      del.textContent = '✕';
      del.addEventListener('click', () => { state.session.teachers.splice(i, 1); save(); render(); });
      ops.appendChild(del);
      tr.append(num, cell, ops);
      rowsEl.appendChild(tr);
    });
  }

  el.querySelector('#addTeacher').addEventListener('click', () => {
    state.session.teachers.push('');
    save(); render();
    rowsEl.querySelector('tr:last-child input')?.focus();
  });

  render();
}
