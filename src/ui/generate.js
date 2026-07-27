// src/ui/generate.js
import { formatDateRo, resolveTemplate } from '../shared/template.js';
import { renderDiplomaHtml, buildPrintDocument } from '../shared/diplomaHtml.js';
import { DIPLOMA_CSS } from '../shared/diplomaCss.js';
import { validateForGeneration } from '../shared/validation.js';
import { fileUrl } from '../shared/fileUrl.js';

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
    <p class="muted" id="genCount"></p>
    <div id="genPreview" style="margin-top:16px; display:flex; flex-wrap:wrap; gap:12px"></div>`;

  if (!document.getElementById('diploma-css')) {
    const style = document.createElement('style');
    style.id = 'diploma-css';
    style.textContent = DIPLOMA_CSS;
    document.head.appendChild(style);
  }

  function batchEntries(batch) {
    const entries = (list, tpl) => list
      .map(({ name, gender }) => ({ name: name.trim(), gender, tpl }))
      .filter((e) => e.name);
    const kids = entries(state.session.kids, 'kid');
    const teachers = entries(state.session.teachers, 'teacher');
    return batch === 'kids' ? kids : batch === 'teachers' ? teachers : [...kids, ...teachers];
  }

  function buildFragments(batch) {
    const ctx = { start: formatDateRo(state.session.startDate), end: formatDateRo(state.session.endDate) };
    const assets = {
      background: fileUrl(state.session.background),
      logoLeft: fileUrl(state.session.logoLeft),
      logoRight: fileUrl(state.session.logoRight),
    };
    return batchEntries(batch).map((entry) =>
      renderDiplomaHtml(resolveTemplate(state.session.templates, entry), entry.name, ctx, assets));
  }

  /** Returns fragments if allowed to proceed, else null. */
  function guard(batch) {
    const errBox = el.querySelector('#genErrors');
    const { errors, warnings } = validateForGeneration(state.session, batch);
    if (errors.length) {
      errBox.textContent = errors.join(' ');
      el.querySelector('#genCount').textContent = ''; // don't leave a stale count
      return null;
    }
    errBox.textContent = '';
    // Warnings now cover duplicate names as well as missing images, so the
    // question has to stay generic.
    if (warnings.length && !confirm(warnings.join('\n') + '\n\nContinui oricum?')) return null;
    return buildFragments(batch);
  }

  el.querySelector('#previewBtn').addEventListener('click', () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    // Page count up front: this is also the number of sheets about to be printed.
    el.querySelector('#genCount').textContent = frags.length === 1
      ? '1 diplomă' : `${frags.length} diplome`;
    const box = el.querySelector('#genPreview');
    box.innerHTML = '';
    for (const f of frags) {
      const cell = document.createElement('div');
      cell.className = 'preview-box';
      cell.innerHTML = `<div class="preview-frame">${f}</div>`;
      box.appendChild(cell);
    }
  });

  const actionButtons = ['#previewBtn', '#printBtn', '#pdfBtn'].map((s) => el.querySelector(s));

  /** Runs one print/export job with the buttons locked, so a second click
   *  cannot start an overlapping job while the system dialog is open. */
  async function runExclusive(fn) {
    actionButtons.forEach((b) => { b.disabled = true; });
    try {
      await fn();
    } finally {
      actionButtons.forEach((b) => { b.disabled = false; });
    }
  }

  el.querySelector('#printBtn').addEventListener('click', () => runExclusive(async () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    try {
      const res = await window.api.printBatch(buildPrintDocument(frags));
      if (!res.ok && !res.canceled) alert('Tipărirea a eșuat: ' + res.reason);
    } catch (err) { alert('Tipărirea a eșuat: ' + err.message); }
  }));

  el.querySelector('#pdfBtn').addEventListener('click', () => runExclusive(async () => {
    const frags = guard(el.querySelector('#batch').value);
    if (!frags) return;
    try {
      const res = await window.api.exportPdf(buildPrintDocument(frags));
      if (res.ok) alert('PDF salvat: ' + res.filePath);
      else if (!res.canceled) alert('Exportul a eșuat: ' + res.reason);
    } catch (err) { alert('Exportul a eșuat: ' + err.message); }
  }));
}
