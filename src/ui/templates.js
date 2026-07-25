// src/ui/templates.js
import { formatDateRo } from '../shared/template.js';
import { renderDiplomaHtml } from '../shared/diplomaHtml.js';
import { DIPLOMA_CSS } from '../shared/diplomaCss.js';
import { fileUrl } from '../renderer.js';

const LINES = [
  { key: 'title', label: 'Titlu' },
  { key: 'awardLine', label: 'Linia de acordare' },
  { key: 'participationLine', label: 'Linia de participare' },
  { key: 'dateLine', label: 'Linia de dată ({start}, {end})' },
];

export function init(state, save) {
  const el = document.getElementById('step-templates');
  el.innerHTML = `
    <h2>Șabloane</h2>
    <div>
      <button class="small tpl-tab active" data-tpl="kid">Copil</button>
      <button class="small tpl-tab" data-tpl="teacher">Însoțitor</button>
    </div>
    <div class="row" style="margin-top:12px">
      <div id="tplFields"></div>
      <div class="preview-box"><div class="preview-frame" id="tplPreview"></div></div>
    </div>`;

  if (!document.getElementById('diploma-css')) {
    const style = document.createElement('style');
    style.id = 'diploma-css';
    style.textContent = DIPLOMA_CSS;
    document.head.appendChild(style);
  }

  let current = 'kid';

  function preview() {
    const ctx = {
      start: formatDateRo(state.session.startDate) || 'ZZ.LL.AAAA',
      end: formatDateRo(state.session.endDate) || 'ZZ.LL.AAAA',
    };
    const assets = {
      background: fileUrl(state.session.background),
      logoLeft: fileUrl(state.session.logoLeft),
      logoRight: fileUrl(state.session.logoRight),
    };
    document.getElementById('tplPreview').innerHTML =
      renderDiplomaHtml(state.session.templates[current], 'NUME PRENUME', ctx, assets);
  }

  function renderFields() {
    const box = el.querySelector('#tplFields');
    box.innerHTML = '';
    for (const { key, label } of LINES) {
      const wrap = document.createElement('div');
      wrap.innerHTML = `<div class="muted">${label}</div>`;
      const input = document.createElement('input');
      input.type = 'text';
      input.style.width = '420px';
      input.value = state.session.templates[current][key];
      input.addEventListener('input', () => {
        state.session.templates[current][key] = input.value;
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
      current = btn.dataset.tpl;
      renderFields(); preview();
    });
  });

  renderFields();
  preview();
}
