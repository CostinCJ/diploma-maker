// src/ui/templates.js
import { resolveTemplate, MIN_LINE_SIZE, MAX_LINE_SIZE } from '../shared/template.js';
import { renderDiplomaHtml } from '../shared/diplomaHtml.js';
import { ensureDiplomaCss, diplomaAssets, previewCtx } from './diplomaPreview.js';

// The two teacher variants differ only in the award line; the other lines are
// one and the same text, edited from either tab.
const VARIANTS = {
  kid: { tpl: 'kid', gender: '', label: 'Copil' },
  teacherM: { tpl: 'teacher', gender: 'm', label: 'Însoțitor' },
  teacherF: { tpl: 'teacher', gender: 'f', label: 'Însoțitoare' },
};

const awardKey = ({ gender }) => (gender === 'm' ? 'awardLineM' : gender === 'f' ? 'awardLineF' : 'awardLine');

// Top to bottom, as they sit on the sheet. `slot` is the line's place on the
// diploma, which is what the size and the emphasis belong to; the name has no
// `key` because its text comes from the list, not from here.
const linesFor = (variant) => [
  { key: 'title', slot: 'title', label: 'Titlu' },
  { key: awardKey(variant), slot: 'award', label: 'Linia de acordare' },
  { slot: 'name', label: 'Numele (se completează din listă)' },
  { key: 'participationLine', slot: 'part', label: 'Linia de participare' },
  { key: 'dateLine', slot: 'dates', label: 'Linia de dată ({start}, {end})' },
];

export function init(state, save) {
  const el = document.getElementById('step-templates');
  el.innerHTML = `
    <h2>Șabloane</h2>
    <div class="tabs">
      ${Object.entries(VARIANTS).map(([key, { label }], i) =>
    `<button class="small tpl-tab${i === 0 ? ' active' : ''}" data-variant="${key}">${label}</button>`).join('')}
    </div>
    <p class="muted">Doar linia de acordare diferă între însoțitor și însoțitoare; restul textului e comun.</p>
    <div class="row" style="margin-top:12px">
      <div id="tplFields"></div>
      <div class="preview-box"><div class="preview-frame" id="tplPreview"></div></div>
    </div>`;

  ensureDiplomaCss();

  let current = VARIANTS.kid;

  function preview() {
    document.getElementById('tplPreview').innerHTML = renderDiplomaHtml(
      resolveTemplate(state.session.templates, current),
      'NUME PRENUME',
      previewCtx(state.session),
      diplomaAssets(state.session),
    );
  }

  /** How big one line is set, and whether it is bold or italic. The two
   *  teacher variants word the award line differently but print it the same
   *  way, so the choice is kept per line of the sheet, not per variant. */
  function formatBar(slot) {
    const style = state.session.templates[current.tpl].styles[slot];
    const bar = document.createElement('div');
    bar.className = 'format-bar';

    const size = document.createElement('input');
    size.type = 'number';
    size.className = 'size-input';
    size.min = String(MIN_LINE_SIZE);
    size.max = String(MAX_LINE_SIZE);
    size.value = String(style.size);
    size.title = 'Mărimea literelor';
    size.addEventListener('input', () => {
      const n = Number(size.value);
      // A half-typed number ('' while retyping) is not a choice yet.
      if (!size.value.trim() || !Number.isFinite(n)) return;
      if (n < MIN_LINE_SIZE || n > MAX_LINE_SIZE) return;
      style.size = Math.round(n);
      save(); preview();
    });
    size.addEventListener('blur', () => { size.value = String(style.size); });

    const unit = document.createElement('span');
    unit.className = 'muted size-unit';
    unit.textContent = 'pt';

    const toggle = (prop, letter, title) => {
      const btn = document.createElement('button');
      btn.className = 'small fmt fmt-' + prop;
      btn.textContent = letter;
      btn.title = title;
      const show = () => {
        btn.classList.toggle('active', style[prop]);
        btn.setAttribute('aria-pressed', String(style[prop]));
      };
      btn.addEventListener('click', () => {
        style[prop] = !style[prop];
        show();
        save(); preview();
      });
      show();
      return btn;
    };

    bar.append(size, unit, toggle('bold', 'B', 'Îngroșat'), toggle('italic', 'I', 'Cursiv'));
    return bar;
  }

  function renderFields() {
    const box = el.querySelector('#tplFields');
    box.innerHTML = '';
    for (const { key, slot, label } of linesFor(current)) {
      const wrap = document.createElement('div');
      wrap.className = 'field';
      const head = document.createElement('div');
      head.className = 'field-head';
      head.innerHTML = `<div class="muted">${label}</div>`;
      head.appendChild(formatBar(slot));
      wrap.appendChild(head);

      if (key) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = state.session.templates[current.tpl][key];
        input.addEventListener('input', () => {
          state.session.templates[current.tpl][key] = input.value;
          save(); preview();
        });
        wrap.appendChild(input);
      }
      box.appendChild(wrap);
    }
  }

  el.querySelectorAll('.tpl-tab').forEach((btn) => {
    btn.addEventListener('click', () => {
      el.querySelectorAll('.tpl-tab').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      current = VARIANTS[btn.dataset.variant];
      renderFields(); preview();
    });
  });

  renderFields();
  preview();
}
