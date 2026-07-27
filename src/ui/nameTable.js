// src/ui/nameTable.js
// The editable list of participants, shared by the children and the
// accompanying adults. Both hold rows with a `name`; only the extra column
// differs (the adults choose the gender their diploma is worded for), so the
// numbering, in-place editing, reordering, deletion and the add-a-name field
// are written once and behave identically on both steps.
import { normalizeName } from '../shared/importList.js';
import { countedNoun } from '../shared/roText.js';

const GENDERS = [
  { value: 'm', label: 'însoțitor' },
  { value: 'f', label: 'însoțitoare' },
];

/**
 * @param container  element to build the table in
 * @param rows       () => the live array of rows (it may be replaced wholesale)
 * @param onEdit     called after any change the guide made by hand
 * @param newRow     () => a blank row of the right shape
 * @param gender     show the gender column (accompanying adults)
 * @param placeholder text of the add-a-name field
 * @param countNoun  [singular, plural] for the "N names in the list" line
 */
export function createNameTable(container, {
  rows,
  onEdit,
  newRow,
  gender = false,
  placeholder = 'Scrie un nume și apasă Enter',
  countNoun = ['nume în listă', 'nume în listă'],
}) {
  container.innerHTML = `
    <div class="toolbar">
      <input type="text" class="quick-add" placeholder="${placeholder}">
      <button class="small add-row">+ Adaugă rând gol</button>
    </div>
    <p class="muted row-count"></p>
    <table class="names"><tbody></tbody></table>`;

  const toolbar = container.querySelector('.toolbar');
  const quickAdd = container.querySelector('.quick-add');
  const body = container.querySelector('tbody');
  const countEl = container.querySelector('.row-count');

  function genderCell(row) {
    const cell = document.createElement('td');
    const select = document.createElement('select');
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = 'alege forma…';
    select.appendChild(empty);
    for (const { value, label } of GENDERS) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.appendChild(option);
    }
    select.value = row.gender ?? '';
    select.classList.toggle('unset', !row.gender);
    select.addEventListener('change', () => {
      row.gender = select.value;
      select.classList.toggle('unset', !row.gender);
      onEdit();
    });
    cell.appendChild(select);
    return cell;
  }

  function render() {
    const list = rows();
    body.innerHTML = '';
    countEl.textContent = list.length ? countedNoun(list.length, ...countNoun) : '';
    list.forEach((row, i) => {
      const tr = document.createElement('tr');
      const num = document.createElement('td');
      num.textContent = (i + 1) + '.';

      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'text';
      input.value = row.name;
      input.addEventListener('input', () => { row.name = input.value; onEdit(); });
      cell.appendChild(input);

      const ops = document.createElement('td');
      const swap = (j) => {
        const list2 = rows();
        [list2[i], list2[j]] = [list2[j], list2[i]];
        onEdit();
        render();
      };
      for (const [label, fn] of [
        ['↑', () => { if (i > 0) swap(i - 1); }],
        ['↓', () => { if (i < rows().length - 1) swap(i + 1); }],
        ['✕', () => { rows().splice(i, 1); onEdit(); render(); }],
      ]) {
        const b = document.createElement('button');
        b.className = 'small';
        b.textContent = label;
        b.addEventListener('click', fn);
        ops.appendChild(b);
      }

      tr.append(num, cell, ...(gender ? [genderCell(row)] : []), ops);
      body.appendChild(tr);
    });
  }

  function add(row, focusIt) {
    rows().push(row);
    onEdit();
    render();
    if (focusIt) body.querySelector('tr:last-child input')?.focus();
  }

  quickAdd.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const name = normalizeName(quickAdd.value);
    if (!name) return;
    add({ ...newRow(), name }, false);
    quickAdd.value = '';
    quickAdd.focus(); // render() rebuilds the table, not this field
  });
  container.querySelector('.add-row').addEventListener('click', () => add(newRow(), true));

  render();
  return { render, toolbar };
}
