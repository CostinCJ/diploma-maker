// src/ui/templates.js
import { resolveTemplate } from '../shared/template.js';
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

const linesFor = (variant) => [
  { key: 'title', label: 'Titlu' },
  { key: awardKey(variant), label: 'Linia de acordare' },
  { key: 'participationLine', label: 'Linia de participare' },
  { key: 'dateLine', label: 'Linia de dată ({start}, {end})' },
];

export function init(state, save) {
  const el = document.getElementById('step-templates');
  el.innerHTML = `
    <h2>Șabloane</h2>
    <div>
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

  function renderFields() {
    const box = el.querySelector('#tplFields');
    box.innerHTML = '';
    for (const { key, label } of linesFor(current)) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="muted">${label}</div>`;
      const input = document.createElement('input');
      input.type = 'text';
      input.style.width = '420px';
      input.value = state.session.templates[current.tpl][key];
      input.addEventListener('input', () => {
        state.session.templates[current.tpl][key] = input.value;
        save(); preview();
      });
      wrap.appendChild(input);
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
