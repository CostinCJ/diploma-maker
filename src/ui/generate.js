// src/ui/generate.js
import { formatDateRo } from '../shared/template.js';
import { renderDiplomaHtml, buildPrintDocument } from '../shared/diplomaHtml.js';
import { DIPLOMA_CSS } from '../shared/diplomaCss.js';
import { validateForGeneration } from '../shared/validation.js';
import { fileUrl } from '../renderer.js';

export function init(state, save) {
  const el = document.getElementById('step-generate');
  el.innerHTML = `
    <h2>Generare</h2>
    <div class="row">
      <label>Lot:
        <select id="batch">
          <option value="all">Toți (copii + însoțitori)</option>
          <option value="kids">Doar copiii</option>
          <option value="teachers">Doar însoțitorii</option>
        </select>
      </label>
      <button class="primary" id="previewBtn">Previzualizează</button>
      <button class="primary" id="printBtn">Tipărește</button>
      <button class="primary" id="pdfBtn">Exportă PDF</button>
    </div>
    <div class="error" id="genErrors"></div>
    <div id="genPreview" style="margin-top:16px; display:flex; flex-wrap:wrap; gap:12px"></div>`;

  if (!document.getElementById('diploma-css')) {
    const style = document.createElement('style');
    style.id = 'diploma-css';
    style.textContent = DIPLOMA_CSS;
    document.head.appendChild(style);
  }

  function batchEntries(batch) {
    const clean = (list, tpl) => list.map((n) => n.trim()).filter(Boolean).map((name) => ({ name, tpl }));
    const kids = clean(state.session.kids, 'kid');
    const teachers = clean(state.session.teachers, 'teacher');
    return batch === 'kids' ? kids : batch === 'teachers' ? teachers : [...kids, ...teachers];
  }

  function buildFragments(batch) {
    const ctx = { start: formatDateRo(state.session.startDate), end: formatDateRo(state.session.endDate) };
    const assets = {
      background: fileUrl(state.session.background),
      logoLeft: fileUrl(state.session.logoLeft),
      logoRight: fileUrl(state.session.logoRight),
    };
    return batchEntries(batch).map(({ name, tpl }) =>
      renderDiplomaHtml(state.session.templates[tpl], name, ctx, assets));
  }

  /** Returns fragments if allowed to proceed, else null. */
  function guard(batch) {
    const errBox = el.querySelector('#genErrors');
    const { errors, warnings } = validateForGeneration(state.session, batch);
    if (errors.length) { errBox.textContent = errors.join(' '); return null; }
    errBox.textContent = '';
    if (warnings.length && !confirm(warnings.join('\n') + '\n\nContinui fără acestea?')) return null;
    return buildFragments(batch);
  }

  el.querySelector('#previewBtn').addEventListener('click', () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    const box = el.querySelector('#genPreview');
    box.innerHTML = '';
    for (const f of frags) {
      const cell = document.createElement('div');
      cell.className = 'preview-box';
      cell.innerHTML = `<div class="preview-frame">${f}</div>`;
      box.appendChild(cell);
    }
  });

  el.querySelector('#printBtn').addEventListener('click', async () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    try {
      const { ok, reason } = await window.api.printBatch(buildPrintDocument(frags));
      if (!ok && reason !== 'cancelled') alert('Tipărirea a eșuat: ' + reason);
    } catch (err) { alert('Tipărirea a eșuat: ' + err.message); }
  });

  el.querySelector('#pdfBtn').addEventListener('click', async () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    try {
      const res = await window.api.exportPdf(buildPrintDocument(frags));
      if (res.ok) alert('PDF salvat: ' + res.filePath);
      else if (res.reason !== 'canceled') alert('Exportul a eșuat: ' + res.reason);
    } catch (err) { alert('Exportul a eșuat: ' + err.message); }
  });
}
